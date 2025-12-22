import type { ResumeData } from '@/components/resume/ResumeDocument';

// Resume Builder 2.0 Funnel Types
export type ResumeIntent = 'internship' | 'fulltime' | 'parttime' | 'grad_school' | 'unsure';

export type ResumeStartSource = 'profile' | 'upload' | 'blank';

export type TemplateId = 'clean' | 'modern' | 'bold' | 'minimal' | 'classic' | 'ats';

export type SectionId =
  | 'summary'
  | 'experience'
  | 'education'
  | 'projects'
  | 'certifications'
  | 'skills'
  | 'achievements';

export interface FunnelData {
  startSource: ResumeStartSource;
  intent: ResumeIntent | null;
  templateId: TemplateId | null;
  enabledSections: SectionId[];
  sectionOrder: SectionId[];
  // For upload source, store parsed data
  uploadedContent?: ResumeData | null;
  // File reference for upload
  uploadedFile?: File | null;
}

export const INTENT_OPTIONS: { value: ResumeIntent; label: string; description: string }[] = [
  { value: 'internship', label: 'Internship', description: 'Summer or semester internships' },
  { value: 'fulltime', label: 'Full-time job', description: 'Permanent full-time positions' },
  { value: 'parttime', label: 'Part-time job', description: 'Flexible part-time work' },
  {
    value: 'grad_school',
    label: 'Graduate school',
    description: "Master's, PhD, or professional programs",
  },
  { value: 'unsure', label: 'Not sure yet', description: 'Exploring my options' },
];

export const TEMPLATE_OPTIONS: { id: TemplateId; name: string; description: string }[] = [
  { id: 'clean', name: 'Clean', description: 'Simple and elegant' },
  { id: 'modern', name: 'Modern', description: 'Contemporary design' },
  { id: 'bold', name: 'Bold', description: 'Strong typography' },
  { id: 'minimal', name: 'Minimal', description: 'Whitespace-focused' },
  { id: 'classic', name: 'Classic', description: 'Traditional format' },
  { id: 'ats', name: 'Executive', description: 'Two-column professional' },
];

export const SECTION_OPTIONS: { id: SectionId; label: string; description: string }[] = [
  { id: 'summary', label: 'Summary', description: 'Professional overview' },
  { id: 'experience', label: 'Experience', description: 'Work history and internships' },
  { id: 'education', label: 'Education', description: 'Degrees and certifications' },
  { id: 'projects', label: 'Projects', description: 'Personal and academic projects' },
  { id: 'skills', label: 'Skills', description: 'Technical and soft skills' },
  { id: 'certifications', label: 'Certifications', description: 'Professional certifications' },
  { id: 'achievements', label: 'Achievements', description: 'Awards and accomplishments' },
];

export const DEFAULT_SECTION_ORDER: SectionId[] = [
  'summary',
  'experience',
  'education',
  'projects',
  'skills',
  'certifications',
  'achievements',
];

export const DEFAULT_ENABLED_SECTIONS: SectionId[] = [
  'summary',
  'experience',
  'education',
  'skills',
];
