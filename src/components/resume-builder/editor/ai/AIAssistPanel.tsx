'use client';

import {
  ArrowRight,
  Briefcase,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  FileText,
  GraduationCap,
  Lightbulb,
  Sparkles,
  Target,
  User,
  Wrench,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ResumeData } from '@/components/resume/ResumeDocument';
import type { AIAssistMode } from '@/contexts/ResumeAIContext';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface SectionStep {
  id: string;
  label: string;
  icon: React.ReactNode;
  isComplete: boolean;
  isEmpty: boolean;
  helpText: string;
  tips: string[];
  focusSpanId?: string;
  missingFields: MissingField[];
  progress: { completed: number; total: number };
  fields: SectionField[];
}

interface AIAssistPanelProps {
  mode: AIAssistMode;
  isLoading: boolean;
  resumeData: ResumeData;
  currentSection?: string | null;
  onSelectSection?: (sectionId: string, focusSpanId?: string) => void;
  onStartFromScratch?: () => void;
  onImportResume?: () => void;
  onGetAIHelp?: (sectionId: string) => void;
}

// ============================================================================
// SECTION COMPLETION HELPERS
// ============================================================================

export function isSectionComplete(sectionId: string, data: ResumeData): boolean {
  switch (sectionId) {
    case 'contact':
      return !!(
        data.contactInfo.name &&
        data.contactInfo.email &&
        (data.contactInfo.phone || data.contactInfo.linkedin)
      );
    case 'summary':
      return !!(data.summary && data.summary.trim().length >= 50);
    case 'experience':
      return !!(
        data.experience &&
        data.experience.length > 0 &&
        data.experience.some(
          (exp) => exp.title && exp.company && exp.description && exp.description.length >= 50,
        )
      );
    case 'education':
      return !!(
        data.education &&
        data.education.length > 0 &&
        data.education.some((edu) => edu.school && edu.degree)
      );
    case 'skills':
      return !!(data.skills && data.skills.length >= 5);
    case 'projects':
      // Projects are optional, consider complete if empty or has content
      return !data.projects || data.projects.length === 0 || data.projects.some((p) => p.name);
    default:
      return false;
  }
}

function isSectionEmpty(sectionId: string, data: ResumeData): boolean {
  switch (sectionId) {
    case 'contact':
      return !data.contactInfo.name && !data.contactInfo.email;
    case 'summary':
      return !data.summary || data.summary.trim().length === 0;
    case 'experience':
      return (
        !data.experience ||
        data.experience.length === 0 ||
        !data.experience.some((exp) => exp.title || exp.company)
      );
    case 'education':
      return (
        !data.education ||
        data.education.length === 0 ||
        !data.education.some((edu) => edu.school || edu.degree)
      );
    case 'skills':
      return !data.skills || data.skills.length === 0;
    case 'projects':
      return !data.projects || data.projects.length === 0;
    default:
      return true;
  }
}

/**
 * Get the spanId of the next field that needs attention in a section
 */
function getNextFocusField(sectionId: string, data: ResumeData): string | undefined {
  switch (sectionId) {
    case 'contact':
      if (!data.contactInfo.name) return 'contact-name';
      if (!data.contactInfo.email) return 'contact-email';
      if (!data.contactInfo.phone) return 'contact-phone';
      if (!data.contactInfo.linkedin) return 'contact-linkedin';
      return 'contact-name';
    case 'summary':
      return 'summary-text';
    case 'experience':
      if (!data.experience || data.experience.length === 0) {
        return undefined; // Need to add experience first
      }
      // Find first experience with missing fields
      for (const exp of data.experience) {
        if (!exp.title) return `experience-${exp.id}-title`;
        if (!exp.company) return `experience-${exp.id}-company`;
        if (!exp.description || exp.description.length < 50) {
          return `experience-${exp.id}-description-0`;
        }
      }
      return `experience-${data.experience[0].id}-description-0`;
    case 'education':
      if (!data.education || data.education.length === 0) {
        return undefined; // Need to add education first
      }
      for (const edu of data.education) {
        if (!edu.school) return `education-${edu.id}-school`;
        if (!edu.degree) return `education-${edu.id}-degree`;
      }
      return `education-${data.education[0].id}-school`;
    case 'skills':
      return 'skills-input';
    case 'projects':
      if (!data.projects || data.projects.length === 0) {
        return undefined;
      }
      for (const proj of data.projects) {
        if (!proj.name) return `projects-${proj.id}-name`;
        if (!proj.description) return `projects-${proj.id}-description`;
      }
      return `projects-${data.projects[0].id}-name`;
    default:
      return undefined;
  }
}

export interface MissingField {
  label: string;
  spanId: string;
}

/**
 * Get list of missing fields for a section with their labels
 */
export function getMissingFields(sectionId: string, data: ResumeData): MissingField[] {
  const missing: MissingField[] = [];

  switch (sectionId) {
    case 'contact':
      if (!data.contactInfo.name) missing.push({ label: 'Name', spanId: 'contact-name' });
      if (!data.contactInfo.email) missing.push({ label: 'Email', spanId: 'contact-email' });
      if (!data.contactInfo.phone) missing.push({ label: 'Phone', spanId: 'contact-phone' });
      if (!data.contactInfo.linkedin)
        missing.push({ label: 'LinkedIn', spanId: 'contact-linkedin' });
      break;
    case 'summary':
      if (!data.summary || data.summary.trim().length < 50) {
        missing.push({ label: 'Professional Summary', spanId: 'summary-text' });
      }
      break;
    case 'experience':
      if (!data.experience || data.experience.length === 0) {
        missing.push({ label: 'Add work experience', spanId: '' });
      } else {
        for (const exp of data.experience) {
          if (!exp.title)
            missing.push({
              label: `Job Title (${exp.company || 'New Entry'})`,
              spanId: `experience-${exp.id}-title`,
            });
          if (!exp.company)
            missing.push({ label: 'Company Name', spanId: `experience-${exp.id}-company` });
          if (!exp.description || exp.description.length < 50) {
            missing.push({
              label: `Job Description (${exp.company || exp.title || 'Entry'})`,
              spanId: `experience-${exp.id}-description-0`,
            });
          }
        }
      }
      break;
    case 'education':
      if (!data.education || data.education.length === 0) {
        missing.push({ label: 'Add education', spanId: '' });
      } else {
        for (const edu of data.education) {
          if (!edu.school)
            missing.push({ label: 'School Name', spanId: `education-${edu.id}-school` });
          if (!edu.degree) missing.push({ label: 'Degree', spanId: `education-${edu.id}-degree` });
        }
      }
      break;
    case 'skills':
      if (!data.skills || data.skills.length < 3) {
        const count = data.skills?.length || 0;
        missing.push({
          label: `Add ${3 - count} more skill${3 - count > 1 ? 's' : ''}`,
          spanId: 'skills-input',
        });
      }
      break;
    case 'projects':
      if (data.projects && data.projects.length > 0) {
        for (const proj of data.projects) {
          if (!proj.name)
            missing.push({ label: 'Project Name', spanId: `projects-${proj.id}-name` });
          if (!proj.description)
            missing.push({
              label: `Description (${proj.name || 'Project'})`,
              spanId: `projects-${proj.id}-description`,
            });
        }
      }
      break;
  }

  return missing;
}

/**
 * Get the current step's section ID (first incomplete required section)
 */
export function getCurrentStepId(data: ResumeData): string | null {
  const requiredOrder = ['contact', 'summary', 'experience', 'education', 'skills'];
  for (const sectionId of requiredOrder) {
    if (!isSectionComplete(sectionId, data)) {
      return sectionId;
    }
  }
  return null; // All complete
}

/**
 * Get missing spanIds for the current step (for highlighting on canvas)
 * Only returns the FIRST missing field to focus user attention on one field at a time
 */
export function getCurrentStepMissingSpanIds(data: ResumeData): Set<string> {
  const currentStepId = getCurrentStepId(data);
  if (!currentStepId) return new Set();

  const missingFields = getMissingFields(currentStepId, data);
  // Only highlight the first missing field to guide user through one at a time
  const firstMissing = missingFields.find((f) => f.spanId);
  return firstMissing ? new Set([firstMissing.spanId]) : new Set();
}

/**
 * Get field completion count for a section
 */
function getSectionFieldProgress(
  sectionId: string,
  data: ResumeData,
): { completed: number; total: number } {
  switch (sectionId) {
    case 'contact': {
      const fields = [
        !!data.contactInfo.name,
        !!data.contactInfo.email,
        !!data.contactInfo.phone,
        !!data.contactInfo.linkedin,
      ];
      return { completed: fields.filter(Boolean).length, total: 4 };
    }
    case 'summary': {
      const hasContent = data.summary && data.summary.trim().length >= 50;
      return { completed: hasContent ? 1 : 0, total: 1 };
    }
    case 'experience': {
      if (!data.experience || data.experience.length === 0) {
        return { completed: 0, total: 1 };
      }
      let completed = 0;
      let total = 0;
      for (const exp of data.experience) {
        total += 3; // title, company, description
        if (exp.title) completed++;
        if (exp.company) completed++;
        if (exp.description && exp.description.length >= 50) completed++;
      }
      return { completed, total };
    }
    case 'education': {
      if (!data.education || data.education.length === 0) {
        return { completed: 0, total: 1 };
      }
      let completed = 0;
      let total = 0;
      for (const edu of data.education) {
        total += 2; // school, degree
        if (edu.school) completed++;
        if (edu.degree) completed++;
      }
      return { completed, total };
    }
    case 'skills': {
      const count = data.skills?.length || 0;
      return { completed: Math.min(count, 5), total: 5 };
    }
    case 'projects': {
      if (!data.projects || data.projects.length === 0) {
        return { completed: 0, total: 0 }; // Optional section
      }
      let completed = 0;
      let total = 0;
      for (const proj of data.projects) {
        total += 2; // name, description
        if (proj.name) completed++;
        if (proj.description) completed++;
      }
      return { completed, total };
    }
    default:
      return { completed: 0, total: 0 };
  }
}

/**
 * Get all fields for a section (for expandable dropdown)
 */
interface SectionField {
  label: string;
  spanId: string;
  isComplete: boolean;
}

function getSectionFields(sectionId: string, data: ResumeData): SectionField[] {
  const fields: SectionField[] = [];

  switch (sectionId) {
    case 'contact':
      fields.push({ label: 'Name', spanId: 'contact-name', isComplete: !!data.contactInfo.name });
      fields.push({
        label: 'Email',
        spanId: 'contact-email',
        isComplete: !!data.contactInfo.email,
      });
      fields.push({
        label: 'Phone',
        spanId: 'contact-phone',
        isComplete: !!data.contactInfo.phone,
      });
      fields.push({
        label: 'LinkedIn',
        spanId: 'contact-linkedin',
        isComplete: !!data.contactInfo.linkedin,
      });
      fields.push({
        label: 'Location',
        spanId: 'contact-location',
        isComplete: !!data.contactInfo.location,
      });
      break;
    case 'summary':
      fields.push({
        label: 'Professional Summary',
        spanId: 'summary-text',
        isComplete: !!(data.summary && data.summary.trim().length >= 50),
      });
      break;
    case 'experience':
      if (data.experience && data.experience.length > 0) {
        for (const exp of data.experience) {
          const entryLabel = exp.company || exp.title || 'New Entry';
          fields.push({
            label: `Job Title (${entryLabel})`,
            spanId: `experience-${exp.id}-title`,
            isComplete: !!exp.title,
          });
          fields.push({
            label: `Company (${entryLabel})`,
            spanId: `experience-${exp.id}-company`,
            isComplete: !!exp.company,
          });
          fields.push({
            label: `Description (${entryLabel})`,
            spanId: `experience-${exp.id}-description-0`,
            isComplete: !!(exp.description && exp.description.length >= 50),
          });
        }
      } else {
        fields.push({ label: 'Add work experience', spanId: '', isComplete: false });
      }
      break;
    case 'education':
      if (data.education && data.education.length > 0) {
        for (const edu of data.education) {
          const entryLabel = edu.school || 'New Entry';
          fields.push({
            label: `School (${entryLabel})`,
            spanId: `education-${edu.id}-school`,
            isComplete: !!edu.school,
          });
          fields.push({
            label: `Degree (${entryLabel})`,
            spanId: `education-${edu.id}-degree`,
            isComplete: !!edu.degree,
          });
        }
      } else {
        fields.push({ label: 'Add education', spanId: '', isComplete: false });
      }
      break;
    case 'skills': {
      const skillCount = data.skills?.length || 0;
      fields.push({
        label: `Skills (${skillCount}/5 minimum)`,
        spanId: 'skills-input',
        isComplete: skillCount >= 3,
      });
      break;
    }
    case 'projects':
      if (data.projects && data.projects.length > 0) {
        for (const proj of data.projects) {
          const entryLabel = proj.name || 'New Project';
          fields.push({
            label: `Name (${entryLabel})`,
            spanId: `projects-${proj.id}-name`,
            isComplete: !!proj.name,
          });
          fields.push({
            label: `Description (${entryLabel})`,
            spanId: `projects-${proj.id}-description`,
            isComplete: !!proj.description,
          });
        }
      }
      break;
  }

  return fields;
}

function getSectionTips(sectionId: string): string[] {
  switch (sectionId) {
    case 'contact':
      return [
        'Include a professional email address',
        'Add LinkedIn URL if available',
        'Location can be city/state only',
      ];
    case 'summary':
      return [
        'Keep it to 2-3 sentences',
        'Highlight your key value proposition',
        'Tailor it to your target role',
      ];
    case 'experience':
      return [
        'Start bullets with strong action verbs',
        'Include numbers and metrics when possible',
        'Focus on achievements, not just duties',
      ];
    case 'education':
      return [
        'Include degree, field, and graduation year',
        'Add GPA if 3.5+ (or recently graduated)',
        'List relevant coursework if applicable',
      ];
    case 'skills':
      return [
        'Group by category (technical, soft skills)',
        'Include tools and technologies you know',
        'Match skills to job requirements',
      ];
    case 'projects':
      return [
        'Include personal or open source projects',
        'Describe the tech stack used',
        'Highlight your specific contributions',
      ];
    default:
      return [];
  }
}

function getSectionHelpText(sectionId: string, isEmpty: boolean, isComplete: boolean): string {
  if (isComplete) {
    switch (sectionId) {
      case 'contact':
        return 'Contact info looks good!';
      case 'summary':
        return 'Summary complete. You can refine it later.';
      case 'experience':
        return 'Experience added. Consider adding metrics.';
      case 'education':
        return 'Education section complete.';
      case 'skills':
        return 'Skills listed. Match them to job postings.';
      case 'projects':
        return 'Projects section complete.';
      default:
        return 'Section complete.';
    }
  }

  if (isEmpty) {
    switch (sectionId) {
      case 'contact':
        return 'Add your name, email, and phone number.';
      case 'summary':
        return 'Write a brief professional summary.';
      case 'experience':
        return 'Add your work experience with descriptions.';
      case 'education':
        return 'Add your educational background.';
      case 'skills':
        return 'List your technical and professional skills.';
      case 'projects':
        return 'Add notable projects (optional).';
      default:
        return 'Complete this section.';
    }
  }

  // Partially complete
  switch (sectionId) {
    case 'contact':
      return 'Add missing contact details.';
    case 'summary':
      return 'Expand your summary (aim for 2-3 sentences).';
    case 'experience':
      return 'Add descriptions to your experience entries.';
    case 'education':
      return 'Complete your education details.';
    case 'skills':
      return 'Add more skills (aim for at least 5).';
    case 'projects':
      return 'Add project details.';
    default:
      return 'Continue working on this section.';
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AIAssistPanel({
  mode,
  isLoading,
  resumeData,
  currentSection,
  onSelectSection,
  onStartFromScratch,
  onImportResume,
  onGetAIHelp,
}: AIAssistPanelProps) {
  // Build section steps with completion status
  const sections: SectionStep[] = useMemo(() => {
    const sectionDefs = [
      { id: 'contact', label: 'Contact Info', icon: <User className="h-4 w-4" /> },
      { id: 'summary', label: 'Summary', icon: <FileText className="h-4 w-4" /> },
      { id: 'experience', label: 'Experience', icon: <Briefcase className="h-4 w-4" /> },
      { id: 'education', label: 'Education', icon: <GraduationCap className="h-4 w-4" /> },
      { id: 'skills', label: 'Skills', icon: <Wrench className="h-4 w-4" /> },
      { id: 'projects', label: 'Projects', icon: <Target className="h-4 w-4" /> },
    ];

    return sectionDefs.map((def) => {
      const isComplete = isSectionComplete(def.id, resumeData);
      const isEmpty = isSectionEmpty(def.id, resumeData);
      const focusSpanId = getNextFocusField(def.id, resumeData);
      const missingFields = getMissingFields(def.id, resumeData);
      const progress = getSectionFieldProgress(def.id, resumeData);
      const fields = getSectionFields(def.id, resumeData);
      return {
        ...def,
        isComplete,
        isEmpty,
        helpText: getSectionHelpText(def.id, isEmpty, isComplete),
        tips: getSectionTips(def.id),
        focusSpanId,
        missingFields,
        progress,
        fields,
      };
    });
  }, [resumeData]);

  // Find the current step (first incomplete required section)
  const currentStep = useMemo(() => {
    // Required sections in order
    const requiredOrder = ['contact', 'summary', 'experience', 'education', 'skills'];
    for (const sectionId of requiredOrder) {
      const section = sections.find((s) => s.id === sectionId);
      if (section && !section.isComplete) {
        return section;
      }
    }
    // All required complete, check optional
    const projectsSection = sections.find((s) => s.id === 'projects');
    if (projectsSection && projectsSection.isEmpty) {
      return projectsSection;
    }
    return null; // All done
  }, [sections]);

  // Calculate overall progress (only count required sections, not optional like projects)
  const requiredSections = sections.filter((s) => s.id !== 'projects');
  const completedRequired = requiredSections.filter((s) => s.isComplete).length;
  const totalCount = requiredSections.length;
  const progressPercent = Math.round((completedRequired / totalCount) * 100);

  // Track expanded sections in the "All Sections" list
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    // Start with current section expanded
    const currentId = getCurrentStepId(resumeData);
    return currentId ? new Set([currentId]) : new Set();
  });

  const toggleSectionExpanded = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  // Get next section after current
  const getNextSection = useCallback(
    (currentId: string): SectionStep | null => {
      const requiredOrder = ['contact', 'summary', 'experience', 'education', 'skills', 'projects'];
      const currentIndex = requiredOrder.indexOf(currentId);
      if (currentIndex === -1 || currentIndex >= requiredOrder.length - 1) return null;

      const nextId = requiredOrder[currentIndex + 1];
      return sections.find((s) => s.id === nextId) || null;
    },
    [sections],
  );

  // Handle continue button - always moves to next section
  const handleContinue = useCallback(() => {
    if (!currentStep) return;

    // Always move to next section
    const nextSection = getNextSection(currentStep.id);
    if (nextSection) {
      onSelectSection?.(nextSection.id, nextSection.focusSpanId);
      // Collapse current section and expand next section
      setExpandedSections((prev) => {
        const next = new Set(prev);
        next.delete(currentStep.id);
        next.add(nextSection.id);
        return next;
      });
    } else {
      // No next section - just focus on current
      onSelectSection?.(currentStep.id, currentStep.focusSpanId);
    }
  }, [currentStep, getNextSection, onSelectSection]);

  // Auto-collapse completed sections and expand next incomplete section
  const prevCurrentStepId = useRef<string | null>(null);
  useEffect(() => {
    const currentId = currentStep?.id || null;
    if (prevCurrentStepId.current && currentId && prevCurrentStepId.current !== currentId) {
      // Current step changed - collapse old, expand new
      setExpandedSections((prev) => {
        const next = new Set(prev);
        next.delete(prevCurrentStepId.current!);
        next.add(currentId);
        return next;
      });
    }
    prevCurrentStepId.current = currentId;
  }, [currentStep?.id]);

  // Onboarding Mode - for new/empty resumes
  if (mode === 'onboarding') {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary-500" />
          <h3 className="font-semibold text-slate-900">Welcome!</h3>
        </div>

        <p className="text-sm text-slate-600">
          Let's build your resume step by step. I'll guide you through each section.
        </p>

        <div className="space-y-2">
          <button
            type="button"
            onClick={onStartFromScratch}
            className={cn(
              'w-full flex items-center gap-3 p-3 rounded-xl border-2 border-primary-200',
              'bg-primary-50 hover:bg-primary-100 transition-colors text-left',
            )}
          >
            <div className="p-2 rounded-lg bg-primary-100">
              <Zap className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <span className="font-medium text-slate-900 block">Start building</span>
              <span className="text-xs text-slate-500">I'll guide you step by step</span>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 ml-auto" />
          </button>

          <button
            type="button"
            onClick={onImportResume}
            className={cn(
              'w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200',
              'hover:border-slate-300 hover:bg-slate-50 transition-colors text-left',
            )}
          >
            <div className="p-2 rounded-lg bg-slate-100">
              <ArrowRight className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <span className="font-medium text-slate-700 block">Import existing</span>
              <span className="text-xs text-slate-500">Upload or paste resume</span>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // Active/Strategy Mode - Step-by-step guidance
  return (
    <div className="p-4 space-y-4">
      {/* Header with Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary-500" />
            <h3 className="font-semibold text-slate-900">Building Your Resume</h3>
          </div>
          <span className="text-xs font-medium text-slate-500">{progressPercent}%</span>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Current Task */}
      {currentStep ? (
        <div className="space-y-3">
          {/* Current Step Card */}
          <div className="p-4 rounded-xl bg-primary-50 border border-primary-100">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary-100 text-primary-600">
                {currentStep.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-900">{currentStep.label}</div>
                <p className="text-sm text-slate-600 mt-0.5">{currentStep.helpText}</p>
              </div>
            </div>

            {/* Missing Fields - shown in red */}
            {currentStep.missingFields.length > 0 && (
              <div className="mt-3 pt-3 border-t border-primary-100">
                <div className="text-xs font-medium text-red-600 mb-2">Fill in these fields:</div>
                <div className="flex flex-wrap gap-1.5">
                  {currentStep.missingFields.slice(0, 4).map((field) => (
                    <button
                      key={field.spanId || field.label}
                      type="button"
                      onClick={() =>
                        field.spanId && onSelectSection?.(currentStep.id, field.spanId)
                      }
                      className={cn(
                        'text-xs px-2 py-1 rounded-full bg-red-100 text-red-700',
                        'hover:bg-red-200 transition-colors cursor-pointer',
                      )}
                      aria-label={`Go to ${field.label} field`}
                    >
                      {field.label}
                    </button>
                  ))}
                  {currentStep.missingFields.length > 4 && (
                    <span className="text-xs px-2 py-1 text-red-500">
                      +{currentStep.missingFields.length - 4} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Tips - only show when section is complete or nearly complete */}
            {currentStep.missingFields.length === 0 && (
              <div className="mt-3 pt-3 border-t border-primary-100">
                <div className="text-xs font-medium text-primary-700 mb-2">Tips to improve:</div>
                <ul className="space-y-1.5">
                  {currentStep.tips.slice(0, 2).map((tip, idx) => (
                    <li key={idx} className="text-xs text-primary-700 flex items-start gap-2">
                      <Lightbulb className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleContinue}
                className={cn(
                  'flex-1 py-2 px-3 rounded-lg text-sm font-medium',
                  'bg-primary-500 text-white hover:bg-primary-600 transition-colors',
                )}
              >
                {currentStep.isEmpty ? 'Start' : 'Next Section →'}
              </button>
              {onGetAIHelp && (
                <button
                  type="button"
                  onClick={() => onGetAIHelp(currentStep.id)}
                  disabled={isLoading}
                  aria-label="Get AI help for this section"
                  className={cn(
                    'py-2 px-3 rounded-lg text-sm font-medium',
                    'bg-white border border-primary-200 text-primary-600',
                    'hover:bg-primary-50 transition-colors',
                    isLoading && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  <Sparkles className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Section Progress List - Expandable */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-500 px-1 mb-2">All Sections</div>
            {sections.map((section) => {
              const isCurrent = currentStep?.id === section.id;
              const isOptional = section.id === 'projects';
              const hasProgress = section.progress.total > 0;
              const sectionProgressPercent = hasProgress
                ? Math.round((section.progress.completed / section.progress.total) * 100)
                : 0;
              const isExpanded = expandedSections.has(section.id);
              const hasFields = section.fields.length > 0;

              return (
                <div key={section.id} className="space-y-0.5">
                  {/* Section Header */}
                  <div
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors',
                      isCurrent
                        ? 'bg-primary-50 border border-primary-200'
                        : section.isComplete
                          ? 'bg-green-50/50'
                          : 'hover:bg-slate-50',
                    )}
                  >
                    {/* Expand/collapse toggle */}
                    {hasFields && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSectionExpanded(section.id);
                        }}
                        className="p-0.5 hover:bg-slate-200 rounded transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                        )}
                      </button>
                    )}

                    {/* Completion indicator */}
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
                        section.isComplete
                          ? 'bg-green-500 text-white'
                          : isCurrent
                            ? 'bg-primary-500 text-white'
                            : 'bg-slate-200 text-slate-400',
                      )}
                    >
                      {section.isComplete ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <span className="text-[10px] font-medium">
                          {sections.findIndex((s) => s.id === section.id) + 1}
                        </span>
                      )}
                    </div>

                    {/* Section info - clickable to navigate */}
                    <button
                      type="button"
                      onClick={() => onSelectSection?.(section.id, section.focusSpanId)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            'text-sm font-medium',
                            section.isComplete ? 'text-green-700' : 'text-slate-700',
                          )}
                        >
                          {section.label}
                          {isOptional && (
                            <span className="text-xs font-normal text-slate-400 ml-1">
                              (optional)
                            </span>
                          )}
                        </span>
                        {/* Progress indicator */}
                        {!section.isComplete && hasProgress && (
                          <span className="text-xs text-slate-400">
                            {section.progress.completed}/{section.progress.total}
                          </span>
                        )}
                      </div>
                      {/* Progress bar for current or in-progress sections */}
                      {isCurrent && hasProgress && !section.isComplete && (
                        <div className="mt-1 h-1 bg-primary-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary-400 rounded-full transition-all duration-300"
                            style={{ width: `${sectionProgressPercent}%` }}
                          />
                        </div>
                      )}
                    </button>

                    {/* Status */}
                    {section.isComplete ? (
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    ) : null}
                  </div>

                  {/* Expanded Fields Dropdown */}
                  {isExpanded && hasFields && (
                    <div className="ml-6 pl-4 border-l-2 border-slate-200 space-y-0.5">
                      {section.fields.map((field, fieldIdx) => (
                        <button
                          key={fieldIdx}
                          type="button"
                          onClick={() =>
                            field.spanId && onSelectSection?.(section.id, field.spanId)
                          }
                          disabled={!field.spanId}
                          className={cn(
                            'w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-colors',
                            field.isComplete
                              ? 'text-green-600 hover:bg-green-50'
                              : 'text-slate-600 hover:bg-slate-50',
                            !field.spanId && 'opacity-50 cursor-not-allowed',
                          )}
                        >
                          {/* Field completion indicator */}
                          <div
                            className={cn(
                              'w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0',
                              field.isComplete
                                ? 'bg-green-500 text-white'
                                : 'border border-slate-300 bg-white',
                            )}
                          >
                            {field.isComplete && <Check className="h-2 w-2" />}
                          </div>
                          <span className={field.isComplete ? 'line-through opacity-70' : ''}>
                            {field.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        // All complete
        <div className="p-4 rounded-xl bg-green-50 border border-green-100 text-center">
          <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
          <div className="font-medium text-green-800">All sections complete!</div>
          <p className="text-sm text-green-600 mt-1">
            Review your resume and check the score panel for improvement suggestions.
          </p>
        </div>
      )}
    </div>
  );
}
