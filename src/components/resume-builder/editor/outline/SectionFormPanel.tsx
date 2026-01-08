'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronRight, GripVertical, Minus, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type {
  Achievement,
  Certification,
  ContactInfo,
  Education,
  Experience,
  Project,
  ResumeData,
} from '@/components/resume/ResumeDocument';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { SECTION_CONFIGS } from '@/types/resume-editor';

import { AIQuickGeneratePopup } from '../ai/AIQuickGeneratePopup';

// ============================================================================
// Helper Text for each section
// ============================================================================

const SECTION_HELPER_TEXT: Record<string, string> = {
  contact: 'Add your contact details so employers can reach you.',
  summary:
    'Highlight relevant skills, experiences, and accomplishments tailored to the job. Use concise language, industry-specific keywords, and quantify achievements. Show passion and enthusiasm.',
  experience:
    'List your work history with accomplishments and metrics. Focus on results and impact.',
  education: 'Include your degrees, certifications, and relevant coursework.',
  skills: 'Add technical and soft skills relevant to your target role.',
  projects: 'Showcase personal or professional projects that demonstrate your abilities.',
  achievements: 'Highlight awards, honors, and notable accomplishments.',
  certifications: 'List professional certifications and licenses.',
};

// ============================================================================
// Props & Types
// ============================================================================

interface SectionFormPanelProps {
  sectionOrder: string[];
  enabledSections: string[];
  resumeData: ResumeData;
  onReorderSections: (newOrder: string[]) => void;
  onAddSection: (sectionId: string) => void;
  onUpdateContactInfo: (field: keyof ContactInfo, value: string) => void;
  onUpdateSummary: (summary: string) => void;
  onUpdateExperience: (experiences: Experience[]) => void;
  onUpdateEducation: (education: Education[]) => void;
  onUpdateProjects: (projects: Project[]) => void;
  onUpdateSkills: (skills: string[]) => void;
  onUpdateAchievements?: (achievements: Achievement[]) => void;
  onUpdateCertifications?: (certifications: Certification[]) => void;
  onGenerateAI?: (sectionId: string) => void;
}

// ============================================================================
// Collapsible Section Header (Sortable)
// ============================================================================

interface CollapsibleSectionProps {
  sectionId: string;
  label: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  helperText?: string;
  onAIClick?: () => void;
  onGenerate?: () => void;
  showGenerate?: boolean;
}

function CollapsibleSection({
  sectionId,
  label,
  isExpanded,
  onToggle,
  children,
  helperText,
  onAIClick,
  onGenerate,
  showGenerate = true,
}: CollapsibleSectionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sectionId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'border border-slate-200 rounded-xl overflow-hidden bg-white',
        isDragging && 'opacity-50 shadow-lg z-50',
      )}
    >
      {/* Section Header */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors',
          'hover:bg-slate-50',
          isExpanded && 'border-b border-slate-100',
        )}
        onClick={onToggle}
      >
        {/* Drag handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className={cn(
            'cursor-grab active:cursor-grabbing p-1 -ml-1 rounded flex-shrink-0',
            'text-slate-400 hover:text-slate-600 hover:bg-slate-100',
            'focus:outline-none focus:ring-2 focus:ring-primary-500',
          )}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Drag to reorder ${label}`}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Expand/Collapse icon */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="p-0.5 rounded text-slate-400 hover:text-slate-600 flex-shrink-0"
          aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
        >
          {isExpanded ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </button>

        {/* Label */}
        <span className="flex-1 text-sm font-semibold text-slate-900">{label}</span>

        {/* AI Button */}
        {onAIClick && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAIClick();
            }}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium',
              'border border-primary-200 text-primary-600',
              'hover:bg-primary-50 transition-colors',
            )}
          >
            <Sparkles className="h-3 w-3" />
            AI
          </button>
        )}
      </div>

      {/* Section Content */}
      {isExpanded && (
        <div className="px-3 py-3 space-y-4">
          {/* Helper Text */}
          {helperText && (
            <p className="text-sm text-slate-500 italic leading-relaxed">{helperText}</p>
          )}

          {/* Form Content */}
          {children}

          {/* Generate Button */}
          {showGenerate && onGenerate && (
            <div className="flex justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onGenerate}
                className="gap-1.5 text-primary-600 border-primary-200 hover:bg-primary-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Generate
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Form Field Component
// ============================================================================

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}

function FormField({ label, value, onChange, placeholder, multiline, rows = 3 }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-700">{label}</label>
      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="text-sm resize-none rounded-sm border border-slate-200 hover:border-[#5371FF] focus:border-[#5371FF] focus:shadow-[0_0_0_1px_#5371FF] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors"
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="text-sm rounded-sm border border-slate-200 hover:border-[#5371FF] focus:border-[#5371FF] focus:shadow-[0_0_0_1px_#5371FF] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors"
        />
      )}
    </div>
  );
}

// ============================================================================
// Personal Info Form (Contact)
// ============================================================================

interface PersonalInfoFormProps {
  contactInfo: ContactInfo;
  onUpdate: (field: keyof ContactInfo, value: string) => void;
}

function PersonalInfoForm({ contactInfo, onUpdate }: PersonalInfoFormProps) {
  // Note: Name splitting uses simple first-word/rest-of-words logic.
  // This handles "John Van der Berg" correctly for display, but editing
  // either field will recombine as "FirstName LastName" (two parts only).
  // For MVP this is acceptable; consider separate firstName/lastName fields
  // in ContactInfo if more complex name handling is needed.
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="First Name"
          value={contactInfo.name?.split(' ')[0] || ''}
          onChange={(value) => {
            const lastName = contactInfo.name?.split(' ').slice(1).join(' ') || '';
            onUpdate('name', `${value} ${lastName}`.trim());
          }}
          placeholder="John"
        />
        <FormField
          label="Last Name"
          value={contactInfo.name?.split(' ').slice(1).join(' ') || ''}
          onChange={(value) => {
            const firstName = contactInfo.name?.split(' ')[0] || '';
            onUpdate('name', `${firstName} ${value}`.trim());
          }}
          placeholder="Doe"
        />
      </div>
      <FormField
        label="Email"
        value={contactInfo.email || ''}
        onChange={(value) => onUpdate('email', value)}
        placeholder="john@example.com"
      />
      <FormField
        label="Phone Number"
        value={contactInfo.phone || ''}
        onChange={(value) => onUpdate('phone', value)}
        placeholder="(555) 123-4567"
      />
      <FormField
        label="Location"
        value={contactInfo.location || ''}
        onChange={(value) => onUpdate('location', value)}
        placeholder="City, State"
      />
      <FormField
        label="LinkedIn"
        value={contactInfo.linkedin || ''}
        onChange={(value) => onUpdate('linkedin', value)}
        placeholder="linkedin.com/in/yourprofile"
      />
      <FormField
        label="Website"
        value={contactInfo.website || ''}
        onChange={(value) => onUpdate('website', value)}
        placeholder="yourwebsite.com"
      />
    </div>
  );
}

// ============================================================================
// Summary Form
// ============================================================================

interface SummaryFormProps {
  summary: string;
  onUpdate: (summary: string) => void;
}

function SummaryForm({ summary, onUpdate }: SummaryFormProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea to fit content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Set height to scrollHeight to show all content
      textarea.style.height = `${Math.max(200, textarea.scrollHeight)}px`;
    }
  }, [summary]);

  return (
    <div className="space-y-1.5">
      <textarea
        ref={textareaRef}
        value={summary}
        onChange={(e) => onUpdate(e.target.value)}
        placeholder="Write a compelling summary of your professional background..."
        className="w-full text-sm border border-slate-200 hover:border-[#5371FF] focus:border-[#5371FF] focus:shadow-[0_0_0_1px_#5371FF] rounded-sm px-3 py-2 outline-none transition-colors"
        style={{ minHeight: '200px', resize: 'vertical', overflow: 'hidden' }}
      />
    </div>
  );
}

// ============================================================================
// Experience Form
// ============================================================================

interface ExperienceFormProps {
  experiences: Experience[];
  onUpdate: (experiences: Experience[]) => void;
}

/**
 * Converts structured format back to description for backward compatibility
 */
function structuredToDescription(summary: string, keyContributions: string[]): string {
  const parts: string[] = [];
  if (summary?.trim()) {
    parts.push(summary.trim());
  }
  if (keyContributions && keyContributions.length > 0) {
    if (parts.length > 0) parts.push(''); // Add blank line between summary and bullets
    for (const bullet of keyContributions) {
      if (bullet.trim()) {
        parts.push(`• ${bullet.trim()}`);
      }
    }
  }
  return parts.join('\n');
}

function ExperienceForm({ experiences, onUpdate }: ExperienceFormProps) {
  const [expandedId, setExpandedId] = useState<string | null>(experiences[0]?.id || null);

  const handleFieldChange = (
    id: string,
    field: keyof Experience,
    value: string | boolean | string[],
  ) => {
    const updated = experiences.map((exp) => {
      if (exp.id !== id) return exp;
      const newExp = { ...exp, [field]: value };

      // Keep description in sync for backward compatibility
      if (field === 'summary' || field === 'keyContributions') {
        const summary = field === 'summary' ? (value as string) : exp.summary || '';
        const bullets =
          field === 'keyContributions' ? (value as string[]) : exp.keyContributions || [];
        newExp.description = structuredToDescription(summary, bullets);
      }

      return newExp;
    });
    onUpdate(updated);
  };

  const handleBulletChange = (expId: string, bulletIdx: number, value: string) => {
    const exp = experiences.find((e) => e.id === expId);
    if (!exp) return;
    const bullets = [...(exp.keyContributions || [])];
    bullets[bulletIdx] = value;
    handleFieldChange(expId, 'keyContributions', bullets);
  };

  const handleAddBullet = (expId: string) => {
    const exp = experiences.find((e) => e.id === expId);
    if (!exp) return;
    const bullets = [...(exp.keyContributions || []), ''];
    handleFieldChange(expId, 'keyContributions', bullets);
  };

  const handleRemoveBullet = (expId: string, bulletIdx: number) => {
    const exp = experiences.find((e) => e.id === expId);
    if (!exp) return;
    const bullets = [...(exp.keyContributions || [])];
    bullets.splice(bulletIdx, 1);
    handleFieldChange(expId, 'keyContributions', bullets);
  };

  const handleAdd = () => {
    const newExp: Experience = {
      id: `exp-${crypto.randomUUID()}`,
      title: '',
      company: '',
      location: '',
      startDate: '',
      endDate: '',
      current: false,
      description: '',
      summary: '',
      keyContributions: [],
    };
    onUpdate([...experiences, newExp]);
    setExpandedId(newExp.id);
  };

  const handleDelete = (id: string) => {
    const remaining = experiences.filter((exp) => exp.id !== id);
    onUpdate(remaining);
    if (expandedId === id) {
      setExpandedId(remaining[0]?.id || null);
    }
  };

  if (experiences.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-slate-500 mb-3">No work experience added yet</p>
        <Button variant="outline" size="sm" onClick={handleAdd} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Experience
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {experiences.map((exp) => (
        <div
          key={exp.id}
          className={cn(
            'border rounded-lg overflow-hidden',
            expandedId === exp.id ? 'border-primary-200 bg-primary-50/30' : 'border-slate-200',
          )}
        >
          {/* Experience Header */}
          <div
            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50"
            onClick={() => setExpandedId(expandedId === exp.id ? null : exp.id)}
          >
            <ChevronRight
              className={cn(
                'h-4 w-4 text-slate-400 transition-transform',
                expandedId === exp.id && 'rotate-90',
              )}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900 truncate">
                {exp.title || 'Untitled Position'}
              </div>
              {exp.company && <div className="text-xs text-slate-500 truncate">{exp.company}</div>}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(exp.id);
              }}
              className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50"
              aria-label="Delete experience"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Experience Fields */}
          {expandedId === exp.id && (
            <div className="px-3 py-3 space-y-3 border-t border-slate-100">
              <FormField
                label="Job Title"
                value={exp.title}
                onChange={(value) => handleFieldChange(exp.id, 'title', value)}
                placeholder="Software Engineer"
              />
              <FormField
                label="Company"
                value={exp.company}
                onChange={(value) => handleFieldChange(exp.id, 'company', value)}
                placeholder="Acme Inc."
              />
              <FormField
                label="Location"
                value={exp.location || ''}
                onChange={(value) => handleFieldChange(exp.id, 'location', value)}
                placeholder="San Francisco, CA"
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="Start Date"
                  value={exp.startDate}
                  onChange={(value) => handleFieldChange(exp.id, 'startDate', value)}
                  placeholder="Jan 2020"
                />
                <FormField
                  label="End Date"
                  value={exp.current ? 'Present' : exp.endDate}
                  onChange={(value) => handleFieldChange(exp.id, 'endDate', value)}
                  placeholder="Dec 2023"
                />
              </div>

              {/* Role Overview */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Role Overview</label>
                <p className="text-xs text-slate-500">
                  Brief paragraph about your role and responsibilities
                </p>
                <Textarea
                  value={exp.summary || ''}
                  onChange={(e) => handleFieldChange(exp.id, 'summary', e.target.value)}
                  placeholder="Led a team of engineers to deliver critical features..."
                  rows={3}
                  className="text-sm resize-none rounded-sm border border-slate-200 hover:border-[#5371FF] focus:border-[#5371FF] focus:shadow-[0_0_0_1px_#5371FF] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors"
                />
              </div>

              {/* Key Accomplishments */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Accomplishments</label>
                <p className="text-xs text-slate-500">Specific achievements with metrics</p>
                <div className="space-y-2">
                  {(exp.keyContributions || []).map((bullet, bulletIdx) => (
                    <div key={bulletIdx} className="flex items-start gap-2">
                      <span className="text-slate-400 mt-2 text-sm">•</span>
                      <Input
                        value={bullet}
                        onChange={(e) => handleBulletChange(exp.id, bulletIdx, e.target.value)}
                        placeholder="Increased revenue by 25%..."
                        className="flex-1 text-sm rounded-sm border border-slate-200 hover:border-[#5371FF] focus:border-[#5371FF] focus:shadow-[0_0_0_1px_#5371FF] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveBullet(exp.id, bulletIdx)}
                        className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50"
                        aria-label="Remove accomplishment"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAddBullet(exp.id)}
                    className="gap-1.5 text-slate-600 hover:text-slate-900"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Bullet
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleAdd}
        className="w-full gap-1.5 text-primary-600 hover:text-primary-700 hover:bg-primary-50"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Experience
      </Button>
    </div>
  );
}

// ============================================================================
// Education Form
// ============================================================================

interface EducationFormProps {
  education: Education[];
  onUpdate: (education: Education[]) => void;
}

function EducationForm({ education, onUpdate }: EducationFormProps) {
  const [expandedId, setExpandedId] = useState<string | null>(education[0]?.id || null);

  const handleFieldChange = (id: string, field: keyof Education, value: string) => {
    const updated = education.map((edu) => (edu.id === id ? { ...edu, [field]: value } : edu));
    onUpdate(updated);
  };

  const handleAdd = () => {
    const newEdu: Education = {
      id: `edu-${crypto.randomUUID()}`,
      school: '',
      degree: '',
      field: '',
      location: '',
      startYear: '',
      endYear: '',
    };
    onUpdate([...education, newEdu]);
    setExpandedId(newEdu.id);
  };

  const handleDelete = (id: string) => {
    const remaining = education.filter((edu) => edu.id !== id);
    onUpdate(remaining);
    if (expandedId === id) {
      setExpandedId(remaining[0]?.id || null);
    }
  };

  if (education.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-slate-500 mb-3">No education added yet</p>
        <Button variant="outline" size="sm" onClick={handleAdd} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Education
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {education.map((edu) => (
        <div
          key={edu.id}
          className={cn(
            'border rounded-lg overflow-hidden',
            expandedId === edu.id ? 'border-primary-200 bg-primary-50/30' : 'border-slate-200',
          )}
        >
          {/* Education Header */}
          <div
            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50"
            onClick={() => setExpandedId(expandedId === edu.id ? null : edu.id)}
          >
            <ChevronRight
              className={cn(
                'h-4 w-4 text-slate-400 transition-transform',
                expandedId === edu.id && 'rotate-90',
              )}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900 truncate">
                {edu.school || 'Untitled School'}
              </div>
              {edu.degree && (
                <div className="text-xs text-slate-500 truncate">
                  {edu.degree}
                  {edu.field && ` in ${edu.field}`}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(edu.id);
              }}
              className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50"
              aria-label="Delete education"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Education Fields */}
          {expandedId === edu.id && (
            <div className="px-3 py-3 space-y-3 border-t border-slate-100">
              <FormField
                label="School / University"
                value={edu.school}
                onChange={(value) => handleFieldChange(edu.id, 'school', value)}
                placeholder="Stanford University"
              />
              <FormField
                label="Degree"
                value={edu.degree}
                onChange={(value) => handleFieldChange(edu.id, 'degree', value)}
                placeholder="Bachelor of Science"
              />
              <FormField
                label="Field of Study"
                value={edu.field}
                onChange={(value) => handleFieldChange(edu.id, 'field', value)}
                placeholder="Computer Science"
              />
              <FormField
                label="Location"
                value={edu.location || ''}
                onChange={(value) => handleFieldChange(edu.id, 'location', value)}
                placeholder="Stanford, CA"
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="Start Year"
                  value={edu.startYear}
                  onChange={(value) => handleFieldChange(edu.id, 'startYear', value)}
                  placeholder="2018"
                />
                <FormField
                  label="End Year"
                  value={edu.endYear}
                  onChange={(value) => handleFieldChange(edu.id, 'endYear', value)}
                  placeholder="2022"
                />
              </div>
              <FormField
                label="GPA (Optional)"
                value={edu.gpa || ''}
                onChange={(value) => handleFieldChange(edu.id, 'gpa', value)}
                placeholder="3.8"
              />
            </div>
          )}
        </div>
      ))}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleAdd}
        className="w-full gap-1.5 text-primary-600 hover:text-primary-700 hover:bg-primary-50"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Education
      </Button>
    </div>
  );
}

// ============================================================================
// Skills Form
// ============================================================================

interface SkillsFormProps {
  skills: string[];
  onUpdate: (skills: string[]) => void;
}

function SkillsForm({ skills, onUpdate }: SkillsFormProps) {
  const [newSkill, setNewSkill] = useState('');

  const handleAddSkill = () => {
    if (newSkill.trim()) {
      onUpdate([...skills, newSkill.trim()]);
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (index: number) => {
    onUpdate(skills.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSkill();
    }
  };

  return (
    <div className="space-y-3">
      {/* Skill Tags */}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {skills.map((skill, index) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-full"
            >
              {skill}
              <button
                type="button"
                onClick={() => handleRemoveSkill(index)}
                className="text-slate-400 hover:text-red-500"
                aria-label={`Remove ${skill}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add Skill Input */}
      <div className="flex gap-2">
        <Input
          value={newSkill}
          onChange={(e) => setNewSkill(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a skill..."
          className="text-sm flex-1 rounded-sm border border-slate-200 hover:border-[#5371FF] focus:border-[#5371FF] focus:shadow-[0_0_0_1px_#5371FF] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddSkill}
          disabled={!newSkill.trim()}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Projects Form
// ============================================================================

interface ProjectsFormProps {
  projects: Project[];
  onUpdate: (projects: Project[]) => void;
}

function ProjectsForm({ projects, onUpdate }: ProjectsFormProps) {
  const [expandedId, setExpandedId] = useState<string | null>(projects[0]?.id || null);

  const handleFieldChange = (id: string, field: keyof Project, value: string) => {
    const updated = projects.map((proj) => (proj.id === id ? { ...proj, [field]: value } : proj));
    onUpdate(updated);
  };

  const handleAdd = () => {
    const newProj: Project = {
      id: `proj-${crypto.randomUUID()}`,
      name: '',
      role: '',
      description: '',
      technologies: '',
    };
    onUpdate([...projects, newProj]);
    setExpandedId(newProj.id);
  };

  const handleDelete = (id: string) => {
    const remaining = projects.filter((proj) => proj.id !== id);
    onUpdate(remaining);
    if (expandedId === id) {
      setExpandedId(remaining[0]?.id || null);
    }
  };

  if (projects.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-slate-500 mb-3">No projects added yet</p>
        <Button variant="outline" size="sm" onClick={handleAdd} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Project
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {projects.map((proj) => (
        <div
          key={proj.id}
          className={cn(
            'border rounded-lg overflow-hidden',
            expandedId === proj.id ? 'border-primary-200 bg-primary-50/30' : 'border-slate-200',
          )}
        >
          <div
            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50"
            onClick={() => setExpandedId(expandedId === proj.id ? null : proj.id)}
          >
            <ChevronRight
              className={cn(
                'h-4 w-4 text-slate-400 transition-transform',
                expandedId === proj.id && 'rotate-90',
              )}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900 truncate">
                {proj.name || 'Untitled Project'}
              </div>
              {proj.role && <div className="text-xs text-slate-500 truncate">{proj.role}</div>}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(proj.id);
              }}
              className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50"
              aria-label="Delete project"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {expandedId === proj.id && (
            <div className="px-3 py-3 space-y-3 border-t border-slate-100">
              <FormField
                label="Project Name"
                value={proj.name}
                onChange={(value) => handleFieldChange(proj.id, 'name', value)}
                placeholder="My Awesome Project"
              />
              <FormField
                label="Role"
                value={proj.role || ''}
                onChange={(value) => handleFieldChange(proj.id, 'role', value)}
                placeholder="Lead Developer"
              />
              <FormField
                label="Description"
                value={proj.description}
                onChange={(value) => handleFieldChange(proj.id, 'description', value)}
                placeholder="What did you build and what impact did it have?"
                multiline
                rows={3}
              />
              <FormField
                label="Technologies"
                value={proj.technologies || ''}
                onChange={(value) => handleFieldChange(proj.id, 'technologies', value)}
                placeholder="React, TypeScript, Node.js"
              />
              <FormField
                label="URL (Optional)"
                value={proj.url || ''}
                onChange={(value) => handleFieldChange(proj.id, 'url', value)}
                placeholder="https://github.com/..."
              />
            </div>
          )}
        </div>
      ))}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleAdd}
        className="w-full gap-1.5 text-primary-600 hover:text-primary-700 hover:bg-primary-50"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Project
      </Button>
    </div>
  );
}

// ============================================================================
// Achievements Form
// ============================================================================

interface AchievementsFormProps {
  achievements: Achievement[];
  onUpdate: (achievements: Achievement[]) => void;
}

function AchievementsForm({ achievements, onUpdate }: AchievementsFormProps) {
  const [expandedId, setExpandedId] = useState<string | null>(achievements[0]?.id || null);

  const handleFieldChange = (id: string, field: keyof Achievement, value: string) => {
    const updated = achievements.map((ach) => (ach.id === id ? { ...ach, [field]: value } : ach));
    onUpdate(updated);
  };

  const handleAdd = () => {
    const newAch: Achievement = {
      id: `ach-${crypto.randomUUID()}`,
      title: '',
      description: '',
      date: '',
    };
    onUpdate([...achievements, newAch]);
    setExpandedId(newAch.id);
  };

  const handleDelete = (id: string) => {
    const remaining = achievements.filter((ach) => ach.id !== id);
    onUpdate(remaining);
    if (expandedId === id) {
      setExpandedId(remaining[0]?.id || null);
    }
  };

  if (achievements.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-slate-500 mb-3">No achievements added yet</p>
        <Button variant="outline" size="sm" onClick={handleAdd} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Achievement
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {achievements.map((ach) => (
        <div
          key={ach.id}
          className={cn(
            'border rounded-lg overflow-hidden',
            expandedId === ach.id ? 'border-primary-200 bg-primary-50/30' : 'border-slate-200',
          )}
        >
          <div
            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50"
            onClick={() => setExpandedId(expandedId === ach.id ? null : ach.id)}
          >
            <ChevronRight
              className={cn(
                'h-4 w-4 text-slate-400 transition-transform',
                expandedId === ach.id && 'rotate-90',
              )}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900 truncate">
                {ach.title || 'Untitled Achievement'}
              </div>
              {ach.date && <div className="text-xs text-slate-500 truncate">{ach.date}</div>}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(ach.id);
              }}
              className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50"
              aria-label="Delete achievement"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {expandedId === ach.id && (
            <div className="px-3 py-3 space-y-3 border-t border-slate-100">
              <FormField
                label="Title"
                value={ach.title}
                onChange={(value) => handleFieldChange(ach.id, 'title', value)}
                placeholder="Dean's List"
              />
              <FormField
                label="Date"
                value={ach.date || ''}
                onChange={(value) => handleFieldChange(ach.id, 'date', value)}
                placeholder="2023"
              />
              <FormField
                label="Description"
                value={ach.description || ''}
                onChange={(value) => handleFieldChange(ach.id, 'description', value)}
                placeholder="Brief description of the achievement"
                multiline
                rows={2}
              />
            </div>
          )}
        </div>
      ))}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleAdd}
        className="w-full gap-1.5 text-primary-600 hover:text-primary-700 hover:bg-primary-50"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Achievement
      </Button>
    </div>
  );
}

// ============================================================================
// Certifications Form
// ============================================================================

interface CertificationsFormProps {
  certifications: Certification[];
  onUpdate: (certifications: Certification[]) => void;
}

function CertificationsForm({ certifications, onUpdate }: CertificationsFormProps) {
  const [expandedId, setExpandedId] = useState<string | null>(certifications[0]?.id || null);

  const handleFieldChange = (id: string, field: keyof Certification, value: string) => {
    const updated = certifications.map((cert) =>
      cert.id === id ? { ...cert, [field]: value } : cert,
    );
    onUpdate(updated);
  };

  const handleAdd = () => {
    const newCert: Certification = {
      id: `cert-${crypto.randomUUID()}`,
      name: '',
      issuer: '',
      date: '',
    };
    onUpdate([...certifications, newCert]);
    setExpandedId(newCert.id);
  };

  const handleDelete = (id: string) => {
    const remaining = certifications.filter((cert) => cert.id !== id);
    onUpdate(remaining);
    if (expandedId === id) {
      setExpandedId(remaining[0]?.id || null);
    }
  };

  if (certifications.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-slate-500 mb-3">No certifications added yet</p>
        <Button variant="outline" size="sm" onClick={handleAdd} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Certification
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {certifications.map((cert) => (
        <div
          key={cert.id}
          className={cn(
            'border rounded-lg overflow-hidden',
            expandedId === cert.id ? 'border-primary-200 bg-primary-50/30' : 'border-slate-200',
          )}
        >
          <div
            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50"
            onClick={() => setExpandedId(expandedId === cert.id ? null : cert.id)}
          >
            <ChevronRight
              className={cn(
                'h-4 w-4 text-slate-400 transition-transform',
                expandedId === cert.id && 'rotate-90',
              )}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900 truncate">
                {cert.name || 'Untitled Certification'}
              </div>
              {cert.issuer && <div className="text-xs text-slate-500 truncate">{cert.issuer}</div>}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(cert.id);
              }}
              className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50"
              aria-label="Delete certification"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {expandedId === cert.id && (
            <div className="px-3 py-3 space-y-3 border-t border-slate-100">
              <FormField
                label="Certification Name"
                value={cert.name}
                onChange={(value) => handleFieldChange(cert.id, 'name', value)}
                placeholder="AWS Solutions Architect"
              />
              <FormField
                label="Issuing Organization"
                value={cert.issuer}
                onChange={(value) => handleFieldChange(cert.id, 'issuer', value)}
                placeholder="Amazon Web Services"
              />
              <FormField
                label="Date"
                value={cert.date || ''}
                onChange={(value) => handleFieldChange(cert.id, 'date', value)}
                placeholder="Jan 2024"
              />
              <FormField
                label="Credential ID (Optional)"
                value={cert.credentialId || ''}
                onChange={(value) => handleFieldChange(cert.id, 'credentialId', value)}
                placeholder="ABC123XYZ"
              />
              <FormField
                label="URL (Optional)"
                value={cert.url || ''}
                onChange={(value) => handleFieldChange(cert.id, 'url', value)}
                placeholder="https://..."
              />
            </div>
          )}
        </div>
      ))}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleAdd}
        className="w-full gap-1.5 text-primary-600 hover:text-primary-700 hover:bg-primary-50"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Certification
      </Button>
    </div>
  );
}

// ============================================================================
// Main Section Form Panel
// ============================================================================

const SECTION_CONFIG_MAP = Object.fromEntries(
  Object.values(SECTION_CONFIGS).map((config) => [config.id, config]),
);

export function SectionFormPanel({
  sectionOrder,
  enabledSections,
  resumeData,
  onReorderSections,
  onAddSection,
  onUpdateContactInfo,
  onUpdateSummary,
  onUpdateExperience,
  onUpdateEducation,
  onUpdateProjects,
  onUpdateSkills,
  onUpdateAchievements,
  onUpdateCertifications,
  onGenerateAI,
}: SectionFormPanelProps) {
  // Track which section is expanded (only one at a time - accordion behavior)
  // Start with no section expanded to show all sections
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // AI Quick Generate Popup state
  const [quickGenerateOpen, setQuickGenerateOpen] = useState(false);
  const [quickGenerateSection, setQuickGenerateSection] = useState<string>('');
  const [quickGenerateSectionLabel, setQuickGenerateSectionLabel] = useState<string>('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Only show enabled sections in the order they appear in sectionOrder
  // Always include 'contact' as the first section
  const visibleSections = ['contact', ...sectionOrder.filter((id) => enabledSections.includes(id))];

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // Don't allow moving the contact section
    if (active.id === 'contact' || over?.id === 'contact') return;

    if (over && active.id !== over.id) {
      const sectionsWithoutContact = visibleSections.filter((id) => id !== 'contact');
      const oldIndex = sectionsWithoutContact.indexOf(active.id as string);
      const newIndex = sectionsWithoutContact.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;
      const newVisibleOrder = arrayMove(sectionsWithoutContact, oldIndex, newIndex);

      // Rebuild full section order
      const result: string[] = [];
      let visibleIdx = 0;
      for (const id of sectionOrder) {
        if (enabledSections.includes(id)) {
          result.push(newVisibleOrder[visibleIdx]);
          visibleIdx += 1;
        } else {
          result.push(id);
        }
      }
      onReorderSections(result);
    }
  };

  // Toggle section - only one open at a time (accordion)
  const toggleSection = (sectionId: string) => {
    setExpandedSection((prev) => (prev === sectionId ? null : sectionId));
  };

  // Get available sections that can be added
  const availableSections = Object.values(SECTION_CONFIGS).filter(
    (config) => !enabledSections.includes(config.id) && config.id !== 'contact',
  );

  // Get section label
  const getSectionLabel = (sectionId: string): string => {
    if (sectionId === 'contact') return 'Personal Info';
    return SECTION_CONFIG_MAP[sectionId]?.label || sectionId;
  };

  // Check if section should show Generate button
  const shouldShowGenerate = (sectionId: string): boolean => {
    // Show generate for sections that can use AI
    // Note: experience excluded until handleAcceptGenerated supports it
    return ['summary', 'skills'].includes(sectionId);
  };

  // Open quick generate popup
  const openQuickGenerate = (sectionId: string) => {
    const label = getSectionLabel(sectionId);
    setQuickGenerateSection(sectionId);
    setQuickGenerateSectionLabel(label);
    setQuickGenerateOpen(true);
  };

  // Handle accepting generated content
  const handleAcceptGenerated = (value: string) => {
    switch (quickGenerateSection) {
      case 'summary':
        onUpdateSummary(value);
        break;
      case 'skills':
        // Parse skills from comma-separated string
        const skills = value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        onUpdateSkills(skills);
        break;
      // For other sections, we'd need different handling
      default:
        break;
    }
  };

  // Render form content based on section type
  const renderSectionContent = (sectionId: string) => {
    switch (sectionId) {
      case 'contact':
        return (
          <PersonalInfoForm contactInfo={resumeData.contactInfo} onUpdate={onUpdateContactInfo} />
        );
      case 'summary':
        return <SummaryForm summary={resumeData.summary || ''} onUpdate={onUpdateSummary} />;
      case 'experience':
        return (
          <ExperienceForm experiences={resumeData.experience || []} onUpdate={onUpdateExperience} />
        );
      case 'education':
        return (
          <EducationForm education={resumeData.education || []} onUpdate={onUpdateEducation} />
        );
      case 'skills':
        return <SkillsForm skills={resumeData.skills || []} onUpdate={onUpdateSkills} />;
      case 'projects':
        return <ProjectsForm projects={resumeData.projects || []} onUpdate={onUpdateProjects} />;
      case 'achievements':
        return onUpdateAchievements ? (
          <AchievementsForm
            achievements={resumeData.achievements || []}
            onUpdate={onUpdateAchievements}
          />
        ) : null;
      case 'certifications':
        return onUpdateCertifications ? (
          <CertificationsForm
            certifications={resumeData.certifications || []}
            onUpdate={onUpdateCertifications}
          />
        ) : null;
      default:
        return null;
    }
  };

  // When a section is expanded, only show that section
  const sectionsToShow = expandedSection
    ? visibleSections.filter((id) => id === expandedSection)
    : visibleSections;

  return (
    <div className="flex flex-col h-full overflow-x-hidden">
      {/* Section list */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar px-3 py-3 space-y-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleSections} strategy={verticalListSortingStrategy}>
            {sectionsToShow.map((sectionId) => (
              <CollapsibleSection
                key={sectionId}
                sectionId={sectionId}
                label={getSectionLabel(sectionId)}
                isExpanded={expandedSection === sectionId}
                onToggle={() => toggleSection(sectionId)}
                helperText={SECTION_HELPER_TEXT[sectionId]}
                onAIClick={sectionId !== 'contact' ? () => onGenerateAI?.(sectionId) : undefined}
                onGenerate={
                  shouldShowGenerate(sectionId) ? () => openQuickGenerate(sectionId) : undefined
                }
                showGenerate={shouldShowGenerate(sectionId)}
              >
                {renderSectionContent(sectionId)}
              </CollapsibleSection>
            ))}
          </SortableContext>
        </DndContext>

        {/* Add section button - only show when no section is expanded */}
        {!expandedSection && availableSections.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-slate-600 hover:text-slate-900"
              >
                <Plus className="h-4 w-4" />
                <span>Add Section</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {availableSections.map((config) => (
                <DropdownMenuItem key={config.id} onClick={() => onAddSection(config.id)}>
                  {config.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* AI Quick Generate Popup */}
      <AIQuickGeneratePopup
        open={quickGenerateOpen}
        onClose={() => setQuickGenerateOpen(false)}
        section={quickGenerateSection}
        sectionLabel={quickGenerateSectionLabel}
        currentResumeData={resumeData}
        onAccept={handleAcceptGenerated}
      />
    </div>
  );
}
