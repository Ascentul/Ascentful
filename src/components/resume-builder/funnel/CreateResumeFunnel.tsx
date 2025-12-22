'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ResumeData } from '@/components/resume/ResumeDocument';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

import { FunnelProgress } from './FunnelProgress';
import { IntentStep } from './IntentStep';
import { SectionsStep } from './SectionsStep';
import { TemplateStep } from './TemplateStep';
import type { FunnelData, ResumeIntent, SectionId, TemplateId } from './types';
import { DEFAULT_ENABLED_SECTIONS, DEFAULT_SECTION_ORDER } from './types';

interface CreateResumeFunnelProps {
  open: boolean;
  onClose: () => void;
  startSource: 'profile' | 'upload' | 'blank';
  uploadedContent?: ResumeData | null;
}

const TOTAL_STEPS = 3;

export function CreateResumeFunnel({
  open,
  onClose,
  startSource,
  uploadedContent,
}: CreateResumeFunnelProps) {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const { toast } = useToast();
  const clerkId = clerkUser?.id;

  const [currentStep, setCurrentStep] = useState(0);
  const [isCreating, setIsCreating] = useState(false);

  // Funnel state
  const [funnelData, setFunnelData] = useState<FunnelData>({
    startSource,
    intent: null,
    templateId: null,
    enabledSections: DEFAULT_ENABLED_SECTIONS,
    sectionOrder: DEFAULT_SECTION_ORDER,
    uploadedContent,
  });

  // Queries
  const profileData = useQuery(api.resumes.getUserProfileForResume, clerkId ? { clerkId } : 'skip');

  // Mutations
  const createResumeMutation = useMutation(api.resumes.createResumeFromFunnel);

  // Compute which sections have data from profile
  const profileSectionData = useMemo(() => {
    if (!profileData) return undefined;
    return {
      hasWorkHistory: (profileData.work_history?.length ?? 0) > 0,
      hasEducation: (profileData.education_history?.length ?? 0) > 0,
      hasSkills: !!profileData.skills && profileData.skills.length > 0,
      hasProjects: (profileData.projects?.length ?? 0) > 0,
      hasBio: !!profileData.bio,
      hasAchievements: (profileData.achievements_history?.length ?? 0) > 0,
    };
  }, [profileData]);

  // Auto-enable sections that have data when source is profile
  const getInitialEnabledSections = useCallback((): SectionId[] => {
    if (startSource === 'profile' && profileSectionData) {
      const sections: SectionId[] = [];
      if (profileSectionData.hasBio) sections.push('summary');
      if (profileSectionData.hasWorkHistory) sections.push('experience');
      if (profileSectionData.hasEducation) sections.push('education');
      if (profileSectionData.hasProjects) sections.push('projects');
      if (profileSectionData.hasSkills) sections.push('skills');
      if (profileSectionData.hasAchievements) sections.push('achievements');
      return sections.length > 0 ? sections : DEFAULT_ENABLED_SECTIONS;
    }
    return DEFAULT_ENABLED_SECTIONS;
  }, [startSource, profileSectionData]);

  // Update enabled sections when profile data loads
  useEffect(() => {
    if (startSource === 'profile' && profileSectionData) {
      setFunnelData((prev) => ({
        ...prev,
        enabledSections: getInitialEnabledSections(),
      }));
    }
  }, [startSource, profileSectionData, getInitialEnabledSections]);

  const handleIntentChange = (intent: ResumeIntent) => {
    setFunnelData((prev) => ({ ...prev, intent }));
  };

  const handleTemplateChange = (templateId: TemplateId) => {
    setFunnelData((prev) => ({ ...prev, templateId }));
  };

  const handleSectionsChange = (sections: SectionId[]) => {
    setFunnelData((prev) => ({
      ...prev,
      enabledSections: sections,
      // Update order to only include enabled sections
      sectionOrder: DEFAULT_SECTION_ORDER.filter((s) => sections.includes(s)),
    }));
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 0:
        return funnelData.intent !== null;
      case 1:
        return funnelData.templateId !== null;
      case 2:
        return funnelData.enabledSections.length > 0;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const buildResumeContent = () => {
    // Build initial content based on start source
    if (startSource === 'upload' && uploadedContent) {
      return uploadedContent;
    }

    if (startSource === 'profile' && profileData) {
      // Map profile data to resume format
      return {
        contactInfo: {
          name: profileData.name || '',
          email: profileData.email || '',
          phone: profileData.phone || '',
          location: profileData.location || '',
          linkedin: profileData.linkedin || '',
          github: profileData.github || '',
          website: profileData.website || '',
        },
        summary: profileData.bio || '',
        skills: profileData.skills
          ? profileData.skills
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean)
          : [],
        experience: (profileData.work_history || []).map((job, index: number) => ({
          id: `exp-${index}`,
          title: job.role || '',
          company: job.company || '',
          location: job.location || '',
          startDate: job.start_date || '',
          endDate: job.is_current ? 'Present' : job.end_date || '',
          current: job.is_current || false,
          description: job.summary || '',
        })),
        education: (profileData.education_history || []).map((edu, index: number) => ({
          id: `edu-${index}`,
          school: edu.school || '',
          degree: edu.degree || '',
          field: edu.field_of_study || '',
          location: '',
          startYear: edu.start_year || '',
          endYear: edu.is_current ? 'Present' : edu.end_year || '',
        })),
        projects: (profileData.projects || []).map((proj, index: number) => ({
          id: `proj-${index}`,
          name: proj.title || '',
          role: proj.role || '',
          description: proj.description || '',
          technologies: (proj.technologies || []).join(', '),
          url: proj.url || '',
        })),
        achievements: (profileData.achievements_history || []).map((ach, index: number) => ({
          id: `ach-${index}`,
          title: ach.title || '',
          description: ach.description || '',
          date: ach.date || '',
        })),
      };
    }

    // Blank resume
    return {
      contactInfo: {
        name: clerkUser?.fullName || '',
        email: clerkUser?.primaryEmailAddress?.emailAddress || '',
        phone: '',
        location: '',
        linkedin: '',
        github: '',
        website: '',
      },
      summary: '',
      skills: [],
      experience: [],
      education: [],
      projects: [],
      achievements: [],
    };
  };

  const handleCreate = async () => {
    if (!clerkId || !funnelData.intent || !funnelData.templateId) return;

    setIsCreating(true);

    try {
      const content = buildResumeContent();

      const resumeId = await createResumeMutation({
        clerkId,
        title: 'My Resume',
        intent: funnelData.intent,
        startSource: funnelData.startSource,
        templateId: funnelData.templateId,
        enabledSections: funnelData.enabledSections,
        sectionOrder: funnelData.sectionOrder,
        content,
        styleConfig: {
          font_pairing: 'modern',
          accent_color: '#5371FF',
          density: 'comfortable',
          heading_style: 'title_case',
        },
      });

      toast({
        title: 'Resume created',
        description: 'Opening editor...',
        variant: 'success',
      });

      onClose();
      router.push(`/resumes/builder/${resumeId}`);
    } catch (error) {
      console.error('Failed to create resume:', error);
      toast({
        title: 'Error',
        description: 'Failed to create resume. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <IntentStep value={funnelData.intent} onChange={handleIntentChange} />;
      case 1:
        return <TemplateStep value={funnelData.templateId} onChange={handleTemplateChange} />;
      case 2:
        return (
          <SectionsStep
            enabledSections={funnelData.enabledSections}
            onChange={handleSectionsChange}
            startSource={startSource}
            profileData={profileSectionData}
          />
        );
      default:
        return null;
    }
  };

  const handleClose = () => {
    setCurrentStep(0);
    setFunnelData({
      startSource,
      intent: null,
      templateId: null,
      enabledSections: DEFAULT_ENABLED_SECTIONS,
      sectionOrder: DEFAULT_SECTION_ORDER,
      uploadedContent: undefined,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white">
        <DialogTitle className="sr-only">Create Resume</DialogTitle>
        <DialogDescription className="sr-only">
          Create a new resume in 3 easy steps
        </DialogDescription>

        <div className="px-8 py-8">
          {/* Progress indicator */}
          <div className="mb-8">
            <FunnelProgress currentStep={currentStep} totalSteps={TOTAL_STEPS} />
          </div>

          {/* Step content */}
          <div className="min-h-[400px]">{renderStep()}</div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 0}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            {currentStep < TOTAL_STEPS - 1 ? (
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
                className="gap-2 bg-primary-500 hover:bg-primary-700"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleCreate}
                disabled={!canProceed() || isCreating}
                className="gap-2 bg-primary-500 hover:bg-primary-700"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create my resume'
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
