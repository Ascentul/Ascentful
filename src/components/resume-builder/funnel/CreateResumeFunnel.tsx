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
import { QuickWinsPreviewStep } from './QuickWinsPreviewStep';
import type { RoleTargetingData } from './RoleTargetingStep';
import { RoleTargetingStep } from './RoleTargetingStep';
import { SectionsStep } from './SectionsStep';
import { TemplateStep } from './TemplateStep';
import type { FunnelData, SectionId, TemplateId } from './types';
import { DEFAULT_ENABLED_SECTIONS, DEFAULT_ROLE_TARGETING, DEFAULT_SECTION_ORDER } from './types';

interface CreateResumeFunnelProps {
  open: boolean;
  onClose: () => void;
  startSource: 'profile' | 'upload' | 'blank';
  uploadedContent?: ResumeData | null;
}

// Step indices: 0=RoleTargeting, 1=QuickWins (profile/upload only), 2=Template, 3=Sections
// For blank resumes, QuickWins is skipped, so it becomes: 0=RoleTargeting, 1=Template, 2=Sections

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

  // Determine total steps based on source (blank skips QuickWins)
  const hasQuickWinsStep = startSource !== 'blank';
  const TOTAL_STEPS = hasQuickWinsStep ? 4 : 3;

  // Funnel state
  const [funnelData, setFunnelData] = useState<FunnelData>({
    startSource,
    intent: null,
    roleTargeting: DEFAULT_ROLE_TARGETING,
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

  // Shared helper to map profile data to resume format
  const mapProfileToResumeData = useCallback(
    (profile: typeof profileData): ResumeData => {
      if (!profile) {
        // Blank resume with Clerk user info
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
      }

      return {
        contactInfo: {
          name: profile.name || '',
          email: profile.email || '',
          phone: profile.phone || '',
          location: profile.location || '',
          linkedin: profile.linkedin || '',
          github: profile.github || '',
          website: profile.website || '',
        },
        summary: profile.bio || '',
        skills: profile.skills
          ? profile.skills
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean)
          : [],
        experience: (profile.work_history || []).map((job, index: number) => {
          // Parse the job summary to extract overview and bullet points
          const jobSummary = job.summary || '';
          const lines = jobSummary.split('\n');
          const summaryLines: string[] = [];
          const bullets: string[] = [];
          let foundBullet = false;

          for (const line of lines) {
            const trimmed = line.trim();
            // Check if line starts with a bullet character
            if (/^[•\-\*]/.test(trimmed)) {
              foundBullet = true;
              const cleanBullet = trimmed.replace(/^[•\-\*]\s*/, '').trim();
              if (cleanBullet) {
                bullets.push(cleanBullet);
              }
            } else if (!foundBullet && trimmed) {
              summaryLines.push(trimmed);
            } else if (foundBullet && trimmed) {
              bullets.push(trimmed);
            }
          }

          return {
            id: `exp-${index}`,
            title: job.role || '',
            company: job.company || '',
            location: job.location || '',
            startDate: job.start_date || '',
            endDate: job.is_current ? 'Present' : job.end_date || '',
            current: job.is_current || false,
            // Keep description for backward compatibility
            description: jobSummary,
            // New structured fields
            summary: summaryLines.join(' '),
            keyContributions: bullets,
          };
        }),
        education: (profile.education_history || []).map((edu, index: number) => ({
          id: `edu-${index}`,
          school: edu.school || '',
          degree: edu.degree || '',
          field: edu.field_of_study || '',
          location: '',
          startYear: edu.start_year || '',
          endYear: edu.is_current ? 'Present' : edu.end_year || '',
        })),
        projects: (profile.projects || []).map((proj, index: number) => ({
          id: `proj-${index}`,
          name: proj.title || '',
          role: proj.role || '',
          description: proj.description || '',
          technologies: (proj.technologies || []).join(', '),
          url: proj.url || '',
        })),
        achievements: (profile.achievements_history || []).map((ach, index: number) => ({
          id: `ach-${index}`,
          title: ach.title || '',
          description: ach.description || '',
          date: ach.date || '',
        })),
      };
    },
    [clerkUser],
  );

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

  const handleRoleTargetingChange = (roleTargeting: RoleTargetingData) => {
    setFunnelData((prev) => ({ ...prev, roleTargeting }));
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

  // Map logical step to actual step based on whether QuickWins is shown
  const getStepType = (step: number): 'roleTargeting' | 'quickWins' | 'template' | 'sections' => {
    if (hasQuickWinsStep) {
      // Flow: RoleTargeting(0) → QuickWins(1) → Template(2) → Sections(3)
      switch (step) {
        case 0:
          return 'roleTargeting';
        case 1:
          return 'quickWins';
        case 2:
          return 'template';
        case 3:
          return 'sections';
        default:
          return 'roleTargeting';
      }
    } else {
      // Blank flow: RoleTargeting(0) → Template(1) → Sections(2)
      switch (step) {
        case 0:
          return 'roleTargeting';
        case 1:
          return 'template';
        case 2:
          return 'sections';
        default:
          return 'roleTargeting';
      }
    }
  };

  const canProceed = (): boolean => {
    const stepType = getStepType(currentStep);
    switch (stepType) {
      case 'roleTargeting':
        // Role targeting is always optional - user can proceed without filling anything
        return true;
      case 'quickWins':
        // Always can proceed from quick wins preview
        return true;
      case 'template':
        return funnelData.templateId !== null;
      case 'sections':
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
      return mapProfileToResumeData(profileData);
    }
    // Blank resume
    return mapProfileToResumeData(null);
  };

  const handleCreate = async () => {
    if (!clerkId || !funnelData.templateId) return;

    setIsCreating(true);

    try {
      const content = buildResumeContent();

      const resumeId = await createResumeMutation({
        clerkId,
        title: 'My Resume',
        intent: funnelData.intent || 'fulltime', // Default to fulltime if not set
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

  // Build resume content for preview (uses shared helper to ensure parity with buildResumeContent)
  const previewContent = useMemo(() => {
    if (startSource === 'upload' && uploadedContent) {
      return uploadedContent;
    }
    if (startSource === 'profile' && profileData) {
      return mapProfileToResumeData(profileData);
    }
    return null;
  }, [startSource, uploadedContent, profileData, mapProfileToResumeData]);

  const renderStep = () => {
    const stepType = getStepType(currentStep);
    switch (stepType) {
      case 'roleTargeting':
        return (
          <RoleTargetingStep
            value={funnelData.roleTargeting}
            onChange={handleRoleTargetingChange}
          />
        );
      case 'quickWins':
        return (
          <QuickWinsPreviewStep
            resumeContent={previewContent}
            startSource={startSource}
            jobDescription={funnelData.roleTargeting.jobDescription}
          />
        );
      case 'template':
        return <TemplateStep value={funnelData.templateId} onChange={handleTemplateChange} />;
      case 'sections':
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
      roleTargeting: DEFAULT_ROLE_TARGETING,
      templateId: null,
      enabledSections: DEFAULT_ENABLED_SECTIONS,
      sectionOrder: DEFAULT_SECTION_ORDER,
      uploadedContent,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white">
        <DialogTitle className="sr-only">Create Resume</DialogTitle>
        <DialogDescription className="sr-only">
          Create a new resume in {TOTAL_STEPS} easy steps
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
