'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { Loader2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  Achievement,
  Certification,
  ContactInfo,
  Education,
  Experience,
  Project,
  ResumeData,
} from '@/components/resume/ResumeDocument';
import { ThreePanelEditor } from '@/components/resume-builder/editor/ThreePanelEditor';
import {
  DEFAULT_ENABLED_SECTIONS,
  DEFAULT_SECTION_ORDER,
} from '@/components/resume-builder/funnel/types';
import type { StyleConfig, TemplateId } from '@/components/resume-builder/templates/types';
import { DEFAULT_STYLE_CONFIG } from '@/components/resume-builder/templates/types';
import { useToast } from '@/hooks/use-toast';
import { generateResumePDF } from '@/lib/resume-pdf-generator';

type ResumeResponse = FunctionReturnType<typeof api.resumes.getResumeById>;

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
    certifications: [],
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
  const [isDirty, setIsDirty] = useState(false);

  // Autosave timer ref
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  // Convex
  const clerkId = clerkUser?.id;
  const existingResume = useQuery(
    api.resumes.getResumeById,
    !isNewResume && clerkId ? { clerkId, resumeId: resumeId as Id<'resumes'> } : 'skip',
  ) as ResumeResponse | null | undefined;

  const autosaveMutation = useMutation(api.resumes.autosaveResume);
  const createResumeMutation = useMutation(api.resumes.createResume);

  // Handle resume not found - redirect via useEffect to avoid side effects during render
  useEffect(() => {
    if (!isNewResume && existingResume === null) {
      router.push('/resume-studio');
    }
  }, [isNewResume, existingResume, router]);

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
      const resume = existingResume;
      const content = resume?.content ?? {};
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
        certifications: content.certifications || [],
      });
      setTitle(resume.title || 'My Resume');
      setTemplateId(resume.template_id || 'modern');
      const storedStyleConfig = (resume.style_config ?? {}) as Partial<StyleConfig>;
      setStyleConfig({ ...DEFAULT_STYLE_CONFIG, ...storedStyleConfig });
      setSectionOrder(resume.sections_config?.section_order || DEFAULT_SECTION_ORDER);
      setEnabledSections(resume.sections_config?.enabled_sections || DEFAULT_ENABLED_SECTIONS);
      setIsInitialized(true);
    }
  }, [isNewResume, existingResume, clerkUser, isInitialized]);

  // Autosave logic
  const triggerAutosave = useCallback(async () => {
    if (!clerkId || isNewResume) return;
    const resumeConvexId = resumeId as Id<'resumes'>;

    setSaveStatus('saving');
    try {
      await autosaveMutation({
        clerkId,
        resumeId: resumeConvexId,
        content: {
          contactInfo: resumeData.contactInfo,
          summary: resumeData.summary,
          skills: resumeData.skills,
          experiences: resumeData.experience,
          education: resumeData.education,
          projects: resumeData.projects,
          achievements: resumeData.achievements,
          certifications: resumeData.certifications,
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

      // Reset to idle after 2 seconds (shorter for snappier feel)
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
      statusTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
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

  // Canva-like autosave - saves quickly after every change
  // Short debounce (500ms) catches rapid typing while still feeling instant
  useEffect(() => {
    if (!isDirty || isNewResume) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    // Show "Saving..." indicator immediately when dirty
    setSaveStatus('saving');

    autosaveTimerRef.current = setTimeout(() => {
      triggerAutosave();
    }, 500); // Reduced from 2000ms to 500ms for faster saves

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [isDirty, isNewResume, triggerAutosave]);

  // Mark as dirty when data changes - triggers autosave
  const markDirty = () => {
    setIsDirty(true);
  };

  // Update handlers
  const handleUpdateContactInfo = (field: keyof ContactInfo, value: string) => {
    setResumeData((prev) => ({
      ...prev,
      // eslint-disable-next-line security/detect-object-injection
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

  const handleUpdateProjects = (projects: Project[]) => {
    setResumeData((prev) => ({ ...prev, projects }));
    markDirty();
  };

  const handleUpdateSkills = (skills: string[]) => {
    setResumeData((prev) => ({ ...prev, skills }));
    markDirty();
  };

  const handleUpdateAchievements = (achievements: Achievement[]) => {
    setResumeData((prev) => ({ ...prev, achievements }));
    markDirty();
  };

  const handleUpdateCertifications = (certifications: Certification[]) => {
    setResumeData((prev) => ({ ...prev, certifications }));
    markDirty();
  };

  const handleSetSectionOrder = (newOrder: string[]) => {
    setSectionOrder(newOrder);
    markDirty();
  };

  const handleToggleSection = (sectionId: string, enabled: boolean) => {
    setEnabledSections((prev) =>
      enabled
        ? prev.includes(sectionId)
          ? prev
          : [...prev, sectionId]
        : prev.filter((id) => id !== sectionId),
    );
    // When enabling a section, also add it to sectionOrder if not present
    if (enabled) {
      setSectionOrder((prev) => (prev.includes(sectionId) ? prev : [...prev, sectionId]));
    }
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

  /**
   * Batch update handler for applying multiple resume changes atomically.
   * Use this when applying AI optimizations or bulk edits to avoid multiple
   * re-renders, save operations, and undo stack entries.
   *
   * @example
   * ```typescript
   * handleBatchUpdate({
   *   summary: "New summary",
   *   experience: [...],
   *   skills: [...]
   * });
   * ```
   */
  const handleBatchUpdate = useCallback((updates: Partial<ResumeData>) => {
    setResumeData((prev) => ({ ...prev, ...updates }));
    markDirty();
  }, []);

  // Close handler
  const handleClose = async () => {
    // Cancel any pending autosave
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    if (isDirty) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to leave?');
      if (!confirmed) return;
    }

    // Check if resume has meaningful content worth saving
    const hasContent =
      resumeData.contactInfo.name ||
      resumeData.summary ||
      (resumeData.experience?.length ?? 0) > 0 ||
      (resumeData.education?.length ?? 0) > 0 ||
      (resumeData.skills?.length ?? 0) > 0;

    // For new resumes, create before leaving if there's content
    if (isNewResume && clerkId && hasContent) {
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
            certifications: resumeData.certifications,
          },
          visibility: 'private',
          source: 'manual',
        });
        toast({
          title: 'Resume saved',
          description: 'Your resume was saved before exiting.',
          variant: 'success',
        });
      } catch (error) {
        console.error('Error saving resume:', error);
        toast({
          title: 'Save failed',
          description: 'Could not save your resume. Please try again.',
          variant: 'destructive',
        });
        const leaveAnyway = window.confirm('Save failed. Do you want to leave without saving?');
        if (!leaveAnyway) return;
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

  // Loading state
  if (!isUserLoaded || (!isNewResume && existingResume === undefined)) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  // Resume not found - useEffect handles redirect
  if (!isNewResume && existingResume === null) {
    return null;
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
      resumeId={isNewResume ? undefined : resumeId}
      currentVersionNumber={existingResume?.version_counter}
      onUpdateContactInfo={handleUpdateContactInfo}
      onUpdateSummary={handleUpdateSummary}
      onUpdateExperience={handleUpdateExperience}
      onUpdateEducation={handleUpdateEducation}
      onUpdateProjects={handleUpdateProjects}
      onUpdateSkills={handleUpdateSkills}
      onUpdateAchievements={handleUpdateAchievements}
      onUpdateCertifications={handleUpdateCertifications}
      onBatchUpdate={handleBatchUpdate}
      onSetSectionOrder={handleSetSectionOrder}
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
