'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { Loader2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  ContactInfo,
  Education,
  Experience,
  Project,
  ResumeData,
} from '@/components/resume/ResumeDocument';
import { ThreePanelEditor } from '@/components/resume-builder/editor/ThreePanelEditor';
import type { StyleConfig, TemplateId } from '@/components/resume-builder/templates/types';
import { DEFAULT_STYLE_CONFIG } from '@/components/resume-builder/templates/types';
import { useToast } from '@/hooks/use-toast';
import { generateResumePDF } from '@/lib/resume-pdf-generator';

// Default section order
const DEFAULT_SECTION_ORDER = ['summary', 'experience', 'education', 'projects', 'skills'];
const DEFAULT_ENABLED_SECTIONS = ['summary', 'experience', 'education', 'skills'];

export default function ResumeBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const { user: clerkUser, isLoaded: isUserLoaded } = useUser();
  const { toast } = useToast();

  const resumeId = params.id as string;
  const isNewResume = resumeId === 'new';

  // Resume data state
  const [resumeData, setResumeData] = useState<ResumeData>({
    contactInfo: { name: '', email: '', phone: '', location: '' },
    summary: '',
    skills: [],
    experience: [],
    education: [],
    projects: [],
    achievements: [],
  });
  const [templateId, setTemplateId] = useState<TemplateId>('modern');
  const [styleConfig, setStyleConfig] = useState<StyleConfig>(DEFAULT_STYLE_CONFIG);
  const [sectionOrder, setSectionOrder] = useState<string[]>(DEFAULT_SECTION_ORDER);
  const [enabledSections, setEnabledSections] = useState<string[]>(DEFAULT_ENABLED_SECTIONS);
  const [title, setTitle] = useState('My Resume');

  // UI state
  const [isInitialized, setIsInitialized] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Autosave timer ref
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Convex
  const clerkId = clerkUser?.id;
  const existingResume = useQuery(
    api.resumes.getResumeById,
    !isNewResume && clerkId ? { clerkId, resumeId: resumeId as any } : 'skip',
  );

  const autosaveMutation = useMutation(api.resumes.autosaveResume);
  const createResumeMutation = useMutation(api.resumes.createResume);

  // Initialize from existing resume
  useEffect(() => {
    if (isInitialized) return;

    if (isNewResume) {
      // For new resumes, just use defaults
      if (clerkUser) {
        setResumeData((prev) => ({
          ...prev,
          contactInfo: {
            ...prev.contactInfo,
            name: clerkUser.fullName || '',
            email: clerkUser.primaryEmailAddress?.emailAddress || '',
          },
        }));
      }
      setIsInitialized(true);
    } else if (existingResume) {
      // Load existing resume data
      const content = existingResume.content || {};
      setResumeData({
        contactInfo: content.contactInfo || {
          name: '',
          email: '',
          phone: '',
          location: '',
        },
        summary: content.summary || '',
        skills: content.skills || [],
        experience: content.experiences || content.experience || [],
        education: content.education || [],
        projects: content.projects || [],
        achievements: content.achievements || [],
      });
      setTitle(existingResume.title || 'My Resume');
      setTemplateId((existingResume as any).template_id || 'modern');
      setStyleConfig((existingResume as any).style_config || DEFAULT_STYLE_CONFIG);
      setSectionOrder(
        (existingResume as any).sections_config?.section_order || DEFAULT_SECTION_ORDER,
      );
      setEnabledSections(
        (existingResume as any).sections_config?.enabled_sections || DEFAULT_ENABLED_SECTIONS,
      );
      setIsInitialized(true);
    }
  }, [isNewResume, existingResume, clerkUser, isInitialized]);

  // Autosave logic
  const triggerAutosave = useCallback(async () => {
    if (!clerkId || isNewResume) return;

    setSaveStatus('saving');
    try {
      await autosaveMutation({
        clerkId,
        resumeId: resumeId as any,
        content: {
          contactInfo: resumeData.contactInfo,
          summary: resumeData.summary,
          skills: resumeData.skills,
          experiences: resumeData.experience,
          education: resumeData.education,
          projects: resumeData.projects,
          achievements: resumeData.achievements,
        },
        styleConfig,
        sectionsConfig: {
          enabled_sections: enabledSections,
          section_order: sectionOrder,
        },
        templateId,
      });
      setSaveStatus('saved');
      setLastSavedAt(Date.now());
      setIsDirty(false);

      // Reset to idle after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Autosave error:', error);
      setSaveStatus('error');
    }
  }, [
    clerkId,
    isNewResume,
    resumeId,
    resumeData,
    styleConfig,
    enabledSections,
    sectionOrder,
    templateId,
    autosaveMutation,
  ]);

  // Debounced autosave
  useEffect(() => {
    if (!isDirty || isNewResume) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      triggerAutosave();
    }, 2000);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [isDirty, isNewResume, triggerAutosave]);

  // Mark as dirty when data changes
  const markDirty = () => {
    setIsDirty(true);
    setSaveStatus('idle');
  };

  // Update handlers
  const handleUpdateContactInfo = (field: keyof ContactInfo, value: string) => {
    setResumeData((prev) => ({
      ...prev,
      contactInfo: { ...prev.contactInfo, [field]: value },
    }));
    markDirty();
  };

  const handleUpdateSummary = (summary: string) => {
    setResumeData((prev) => ({ ...prev, summary }));
    markDirty();
  };

  const handleUpdateExperience = (experience: Experience[]) => {
    setResumeData((prev) => ({ ...prev, experience }));
    markDirty();
  };

  const handleUpdateEducation = (education: Education[]) => {
    setResumeData((prev) => ({ ...prev, education }));
    markDirty();
  };

  const handleUpdateSkills = (skills: string[]) => {
    setResumeData((prev) => ({ ...prev, skills }));
    markDirty();
  };

  const handleUpdateProjects = (projects: Project[]) => {
    setResumeData((prev) => ({ ...prev, projects }));
    markDirty();
  };

  const handleReorderSection = (fromIndex: number, toIndex: number) => {
    setSectionOrder((prev) => {
      const newOrder = [...prev];
      const [moved] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, moved);
      return newOrder;
    });
    markDirty();
  };

  const handleToggleSection = (sectionId: string, enabled: boolean) => {
    setEnabledSections((prev) =>
      enabled ? [...prev, sectionId] : prev.filter((id) => id !== sectionId),
    );
    markDirty();
  };

  const handleTemplateChange = (newTemplateId: TemplateId) => {
    setTemplateId(newTemplateId);
    markDirty();
  };

  const handleStyleChange = (config: Partial<StyleConfig>) => {
    setStyleConfig((prev) => ({ ...prev, ...config }));
    markDirty();
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    markDirty();
  };

  // Close handler
  const handleClose = async () => {
    if (isDirty) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to leave?');
      if (!confirmed) return;
    }

    // For new resumes, create before leaving if there's content
    if (isNewResume && clerkId && resumeData.contactInfo.name) {
      try {
        await createResumeMutation({
          clerkId,
          title,
          content: {
            contactInfo: resumeData.contactInfo,
            summary: resumeData.summary,
            skills: resumeData.skills,
            experiences: resumeData.experience,
            education: resumeData.education,
            projects: resumeData.projects,
            achievements: resumeData.achievements,
          },
          visibility: 'private',
          source: 'manual',
        });
      } catch (error) {
        console.error('Error saving resume:', error);
      }
    }

    router.push('/resume-studio');
  };

  // Export handlers
  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      await generateResumePDF(resumeData, `${title}.pdf`);
      toast({
        title: 'PDF downloaded',
        description: 'Your resume has been exported as a PDF',
        variant: 'success',
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export failed',
        description: 'Failed to export resume as PDF',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // AI handlers (placeholder - will be connected to actual endpoints)
  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    try {
      // TODO: Call AI endpoint to generate summary
      const response = await fetch('/api/resumes/ai/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeData,
          intent: 'fulltime',
        }),
      });

      if (response.ok) {
        const { summary } = await response.json();
        setResumeData((prev) => ({ ...prev, summary }));
        markDirty();
        toast({
          title: 'Summary generated',
          description: 'AI has created a professional summary for you',
          variant: 'success',
        });
      }
    } catch (error) {
      console.error('AI generation error:', error);
      toast({
        title: 'Generation failed',
        description: 'Failed to generate summary. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateBullets = async (experienceIndex: number) => {
    setIsGenerating(true);
    try {
      const experience = resumeData.experience?.[experienceIndex];
      if (!experience) return;

      // TODO: Call AI endpoint to generate bullets
      const response = await fetch('/api/resumes/ai/generate-bullets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experience,
          intent: 'fulltime',
        }),
      });

      if (response.ok) {
        const { bullets } = await response.json();
        const newExperience = [...(resumeData.experience || [])];
        newExperience[experienceIndex] = {
          ...experience,
          description: bullets.map((b: string) => `• ${b}`).join('\n'),
        };
        setResumeData((prev) => ({ ...prev, experience: newExperience }));
        markDirty();
        toast({
          title: 'Bullets generated',
          description: 'AI has created bullet points for this experience',
          variant: 'success',
        });
      }
    } catch (error) {
      console.error('AI generation error:', error);
      toast({
        title: 'Generation failed',
        description: 'Failed to generate bullets. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSuggestSkills = async () => {
    setIsGenerating(true);
    try {
      // TODO: Call AI endpoint to suggest skills
      const response = await fetch('/api/resumes/ai/suggest-skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeData,
          intent: 'fulltime',
        }),
      });

      if (response.ok) {
        const { skills } = await response.json();
        setResumeData((prev) => ({
          ...prev,
          skills: [...new Set([...(prev.skills || []), ...skills])],
        }));
        markDirty();
        toast({
          title: 'Skills suggested',
          description: 'AI has added relevant skills to your resume',
          variant: 'success',
        });
      }
    } catch (error) {
      console.error('AI suggestion error:', error);
      toast({
        title: 'Suggestion failed',
        description: 'Failed to suggest skills. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Loading state
  if (!isUserLoaded || (!isNewResume && existingResume === undefined)) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <ThreePanelEditor
      resumeData={resumeData}
      templateId={templateId}
      styleConfig={styleConfig}
      sectionOrder={sectionOrder}
      enabledSections={enabledSections}
      title={title}
      saveStatus={saveStatus}
      lastSavedAt={lastSavedAt}
      onUpdateContactInfo={handleUpdateContactInfo}
      onUpdateSummary={handleUpdateSummary}
      onUpdateExperience={handleUpdateExperience}
      onUpdateEducation={handleUpdateEducation}
      onUpdateSkills={handleUpdateSkills}
      onUpdateProjects={handleUpdateProjects}
      onReorderSection={handleReorderSection}
      onToggleSection={handleToggleSection}
      onTemplateChange={handleTemplateChange}
      onStyleChange={handleStyleChange}
      onTitleChange={handleTitleChange}
      onClose={handleClose}
      onExportPDF={handleExportPDF}
      onSave={triggerAutosave}
      isExporting={isExporting}
    />
  );
}
