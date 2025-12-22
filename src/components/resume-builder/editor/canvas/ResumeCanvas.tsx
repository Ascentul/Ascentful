'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  Education,
  Experience,
  Project,
  ResumeData,
} from '@/components/resume/ResumeDocument';
import type { StyleConfig, TemplateId } from '@/components/resume-builder/templates/types';
import { FONT_PAIRINGS, TEMPLATE_LAYOUTS } from '@/components/resume-builder/templates/types';
import { bulletPointsToDescription, parseBulletPoints } from '@/lib/resume-editor/span-utils';
import type { Suggestion } from '@/types/resume-editor';

import { BulletEditable, InlineEditableText } from './InlineEditableText';

interface ResumeCanvasProps {
  data: ResumeData;
  templateId: TemplateId;
  styleConfig: StyleConfig;
  sectionOrder: string[];
  enabledSections: string[];
  suggestions: Suggestion[];
  coachEnabled: boolean;
  onUpdateContactInfo: (field: string, value: string) => void;
  onUpdateSummary: (value: string) => void;
  onUpdateExperience: (experiences: Experience[]) => void;
  onUpdateEducation: (education: Education[]) => void;
  onUpdateProjects: (projects: Project[]) => void;
  onUpdateSkills: (skills: string[]) => void;
}

/* Intentionally keeping types as Experience[] since the handlers
   should always receive non-undefined arrays */

export function ResumeCanvas({
  data,
  templateId,
  styleConfig,
  sectionOrder,
  enabledSections,
  suggestions,
  coachEnabled,
  onUpdateContactInfo,
  onUpdateSummary,
  onUpdateExperience,
  onUpdateEducation,
  onUpdateProjects,
  onUpdateSkills,
}: ResumeCanvasProps) {
  // Get template-specific layout configuration
  const templateConfig = TEMPLATE_LAYOUTS[templateId] ?? TEMPLATE_LAYOUTS.modern;
  const fontPairing = Object.prototype.hasOwnProperty.call(FONT_PAIRINGS, styleConfig.font_pairing)
    ? FONT_PAIRINGS[styleConfig.font_pairing]
    : FONT_PAIRINGS.modern;
  const accentColor = styleConfig.accent_color;
  const isCompact = styleConfig.density === 'compact';
  const isCaps = styleConfig.heading_style === 'caps';

  // Template-specific properties
  const headerStyle = templateConfig.headerStyle;
  const layoutType = templateConfig.layoutType;
  const sectionDivider = templateConfig.sectionDivider;
  const isLightFont = templateConfig.fontWeight === 'light';
  const sidebarBgColor = styleConfig.sidebar_bg_color || '#f8fafc'; // Default to slate-50

  // Helper to determine if sidebar background is dark (for text contrast)
  const isSidebarDark = (() => {
    let hex = sidebarBgColor.replace('#', '');
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((char) => char + char)
        .join('');
    }
    if (hex.length !== 6) return false;
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return false;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  })();

  // Build CSS variables
  const cssVars = {
    '--font-heading': fontPairing.heading,
    '--font-body': fontPairing.body,
    '--color-accent': accentColor,
  } as React.CSSProperties;

  const sectionHeadingClass = `text-[13pt] font-semibold mb-2 ${
    isCaps ? 'uppercase tracking-wider' : ''
  } ${isLightFont ? 'font-light' : ''}`;

  // Build section heading with divider
  const getSectionHeadingStyle = () => {
    const baseStyle = { color: accentColor };
    if (sectionDivider === 'accent-line') {
      return {
        ...baseStyle,
        borderBottom: `2px solid ${accentColor}`,
        paddingBottom: '4px',
      };
    }
    if (sectionDivider === 'double-line') {
      return {
        ...baseStyle,
        borderBottom: '3px double',
        borderColor: accentColor,
        paddingBottom: '4px',
      };
    }
    if (sectionDivider === 'line') {
      return {
        ...baseStyle,
        borderBottom: '1px solid #e2e8f0',
        paddingBottom: '4px',
      };
    }
    return baseStyle;
  };

  const renderSection = (sectionId: string) => {
    if (!enabledSections.includes(sectionId)) return null;

    switch (sectionId) {
      case 'summary':
        return (
          <section key={sectionId} className={isCompact ? 'mb-4' : 'mb-6'}>
            <h2 className={sectionHeadingClass} style={getSectionHeadingStyle()}>
              Professional Summary
            </h2>
            <InlineEditableText
              spanId="summary-text"
              value={data.summary || ''}
              onChange={onUpdateSummary}
              multiline
              suggestions={suggestions}
              coachEnabled={coachEnabled}
              placeholder="Write a compelling summary of your professional background..."
              className="text-[11pt] leading-relaxed"
            />
          </section>
        );

      case 'experience':
        return (
          <section key={sectionId} className={isCompact ? 'mb-4' : 'mb-6'}>
            <h2 className={sectionHeadingClass} style={getSectionHeadingStyle()}>
              Work Experience
            </h2>
            <div className="space-y-4">
              {(data.experience || []).map((item, index) => (
                <ExperienceEntry
                  key={item.id}
                  experience={item}
                  suggestions={suggestions}
                  coachEnabled={coachEnabled}
                  accentColor={accentColor}
                  onChange={(updated) => {
                    const newExperiences = (data.experience || []).map((e, i) =>
                      i === index ? updated : e,
                    );
                    onUpdateExperience(newExperiences);
                  }}
                />
              ))}
            </div>
          </section>
        );

      case 'education':
        return (
          <section key={sectionId} className={isCompact ? 'mb-4' : 'mb-6'}>
            <h2 className={sectionHeadingClass} style={getSectionHeadingStyle()}>
              Education
            </h2>
            <div className="space-y-3">
              {(data.education || []).map((item, index) => (
                <EducationEntry
                  key={item.id}
                  education={item}
                  suggestions={suggestions}
                  coachEnabled={coachEnabled}
                  onChange={(updated) => {
                    const newEducation = (data.education || []).map((e, i) =>
                      i === index ? updated : e,
                    );
                    onUpdateEducation(newEducation);
                  }}
                />
              ))}
            </div>
          </section>
        );

      case 'skills':
        return (
          <section key={sectionId} className={isCompact ? 'mb-4' : 'mb-6'}>
            <h2 className={sectionHeadingClass} style={getSectionHeadingStyle()}>
              Skills
            </h2>
            <SkillsEditor
              skills={data.skills || []}
              suggestions={suggestions}
              coachEnabled={coachEnabled}
              onChange={onUpdateSkills}
            />
          </section>
        );

      case 'projects':
        return (
          <section key={sectionId} className={isCompact ? 'mb-4' : 'mb-6'}>
            <h2 className={sectionHeadingClass} style={getSectionHeadingStyle()}>
              Projects
            </h2>
            <div className="space-y-3">
              {(data.projects || []).map((item, index) => (
                <ProjectEntry
                  key={item.id}
                  project={item}
                  suggestions={suggestions}
                  coachEnabled={coachEnabled}
                  onChange={(updated) => {
                    const newProjects = (data.projects || []).map((p, i) =>
                      i === index ? updated : p,
                    );
                    onUpdateProjects(newProjects);
                  }}
                />
              ))}
            </div>
          </section>
        );

      default:
        return null;
    }
  };

  // Render header based on template headerStyle
  const renderHeader = () => {
    const contactItems = (
      <>
        {data.contactInfo.email && (
          <InlineEditableText
            spanId="contact-email"
            value={data.contactInfo.email}
            onChange={(value) => onUpdateContactInfo('email', value)}
            placeholder="email@example.com"
            suggestions={suggestions}
            coachEnabled={coachEnabled}
          />
        )}
        {data.contactInfo.phone && (
          <InlineEditableText
            spanId="contact-phone"
            value={data.contactInfo.phone}
            onChange={(value) => onUpdateContactInfo('phone', value)}
            placeholder="(555) 123-4567"
            suggestions={suggestions}
            coachEnabled={coachEnabled}
          />
        )}
        {data.contactInfo.location && (
          <InlineEditableText
            spanId="contact-location"
            value={data.contactInfo.location}
            onChange={(value) => onUpdateContactInfo('location', value)}
            placeholder="City, State"
            suggestions={suggestions}
            coachEnabled={coachEnabled}
          />
        )}
        {data.contactInfo.linkedin && (
          <InlineEditableText
            spanId="contact-linkedin"
            value={data.contactInfo.linkedin}
            onChange={(value) => onUpdateContactInfo('linkedin', value)}
            placeholder="linkedin.com/in/yourprofile"
            suggestions={suggestions}
            coachEnabled={coachEnabled}
            className="text-blue-600"
          />
        )}
      </>
    );

    // Dark background header (Bold template)
    if (headerStyle === 'dark-bg') {
      return (
        <header className="mb-6">
          <div className="bg-gray-900 text-white px-6 py-4 -mx-[0.7in] -mt-[0.7in] mb-4">
            <InlineEditableText
              spanId="contact-name"
              value={data.contactInfo.name}
              onChange={(value) => onUpdateContactInfo('name', value)}
              placeholder="Your Name"
              suggestions={suggestions}
              coachEnabled={coachEnabled}
              className="text-[24pt] font-bold"
              style={{ fontFamily: 'var(--font-heading)', color: 'white' } as React.CSSProperties}
            />
          </div>
          <div className="text-[10pt] text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
            {contactItems}
          </div>
        </header>
      );
    }

    // Centered header (Classic template)
    if (headerStyle === 'center') {
      return (
        <header className="pb-3 mb-6">
          <InlineEditableText
            spanId="contact-name"
            value={data.contactInfo.name}
            onChange={(value) => onUpdateContactInfo('name', value)}
            placeholder="Your Name"
            suggestions={suggestions}
            coachEnabled={coachEnabled}
            className="text-center text-[20pt] font-bold"
            style={{ fontFamily: 'var(--font-heading)' } as React.CSSProperties}
          />
          <div className="text-center text-[10pt] text-slate-600 mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
            {contactItems}
          </div>
          <div
            className="mt-3 mx-auto"
            style={{
              width: '80%',
              borderBottom: '3px double',
              borderColor: accentColor,
            }}
          />
        </header>
      );
    }

    // Left-aligned header (Clean, Modern, Minimal templates)
    return (
      <header className="pb-3 mb-6 border-b-2" style={{ borderColor: accentColor }}>
        <InlineEditableText
          spanId="contact-name"
          value={data.contactInfo.name}
          onChange={(value) => onUpdateContactInfo('name', value)}
          placeholder="Your Name"
          suggestions={suggestions}
          coachEnabled={coachEnabled}
          className={`text-[20pt] font-bold ${isLightFont ? 'font-light' : ''}`}
          style={{ fontFamily: 'var(--font-heading)' } as React.CSSProperties}
        />
        <div className="text-[10pt] text-slate-600 mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {contactItems}
        </div>
      </header>
    );
  };

  // Two-column sidebar layout (Executive/ATS template)
  if (layoutType === 'two-column-sidebar') {
    // Text colors for sidebar based on background darkness
    const sidebarTextColor = isSidebarDark ? '#ffffff' : '#1e293b';
    const sidebarMutedColor = isSidebarDark ? '#cbd5e1' : '#64748b';
    const sidebarLinkColor = isSidebarDark ? '#93c5fd' : '#2563eb';

    return (
      <div
        className="font-sans text-[11pt] leading-[1.3] text-slate-900 flex"
        style={{
          ...cssVars,
          fontFamily: 'var(--font-body)',
        }}
      >
        {/* Left Sidebar */}
        <aside className="w-[30%] p-6 min-h-full" style={{ backgroundColor: sidebarBgColor }}>
          {/* Name in sidebar */}
          <div className="mb-6">
            <InlineEditableText
              spanId="contact-name"
              value={data.contactInfo.name}
              onChange={(value) => onUpdateContactInfo('name', value)}
              placeholder="Your Name"
              suggestions={suggestions}
              coachEnabled={coachEnabled}
              className="text-[16pt] font-bold leading-tight"
              style={
                {
                  fontFamily: 'var(--font-heading)',
                  color: sidebarTextColor,
                } as React.CSSProperties
              }
            />
          </div>

          {/* Contact Section */}
          <div className="mb-6">
            <h3
              className="text-[11pt] font-semibold mb-2 uppercase tracking-wider border-b pb-1"
              style={{
                borderColor: accentColor,
                color: isSidebarDark ? '#ffffff' : accentColor,
              }}
            >
              Contact
            </h3>
            <div className="space-y-1 text-[9pt]" style={{ color: sidebarMutedColor }}>
              {data.contactInfo.email && (
                <InlineEditableText
                  spanId="contact-email"
                  value={data.contactInfo.email}
                  onChange={(value) => onUpdateContactInfo('email', value)}
                  placeholder="email@example.com"
                  suggestions={suggestions}
                  coachEnabled={coachEnabled}
                />
              )}
              {data.contactInfo.phone && (
                <InlineEditableText
                  spanId="contact-phone"
                  value={data.contactInfo.phone}
                  onChange={(value) => onUpdateContactInfo('phone', value)}
                  placeholder="(555) 123-4567"
                  suggestions={suggestions}
                  coachEnabled={coachEnabled}
                />
              )}
              {data.contactInfo.location && (
                <InlineEditableText
                  spanId="contact-location"
                  value={data.contactInfo.location}
                  onChange={(value) => onUpdateContactInfo('location', value)}
                  placeholder="City, State"
                  suggestions={suggestions}
                  coachEnabled={coachEnabled}
                />
              )}
              {data.contactInfo.linkedin && (
                <InlineEditableText
                  spanId="contact-linkedin"
                  value={data.contactInfo.linkedin}
                  onChange={(value) => onUpdateContactInfo('linkedin', value)}
                  placeholder="linkedin.com/in/yourprofile"
                  suggestions={suggestions}
                  coachEnabled={coachEnabled}
                  style={{ color: sidebarLinkColor }}
                />
              )}
            </div>
          </div>

          {/* Skills in sidebar */}
          {enabledSections.includes('skills') && (
            <div className="mb-6">
              <h3
                className="text-[11pt] font-semibold mb-2 uppercase tracking-wider border-b pb-1"
                style={{
                  borderColor: accentColor,
                  color: isSidebarDark ? '#ffffff' : accentColor,
                }}
              >
                Skills
              </h3>
              <SkillsEditor
                skills={data.skills || []}
                suggestions={suggestions}
                coachEnabled={coachEnabled}
                onChange={onUpdateSkills}
                compact
                darkMode={isSidebarDark}
              />
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="w-[70%] p-[0.7in]">
          {sectionOrder
            .filter((s) => s !== 'skills') // Skills are in sidebar
            .map(renderSection)}
        </main>
      </div>
    );
  }

  // Single-column layout (default for Clean, Modern, Bold, Minimal, Classic)
  return (
    <div
      className={`p-[0.7in] font-sans text-[11pt] leading-[1.3] text-slate-900 ${isLightFont ? 'font-light' : ''}`}
      style={{
        ...cssVars,
        fontFamily: 'var(--font-body)',
      }}
    >
      {/* Header / Contact Info */}
      {renderHeader()}

      {/* Sections based on order */}
      {sectionOrder.map(renderSection)}
    </div>
  );
}

// ============================================================================
// Experience Entry
// ============================================================================

function ExperienceEntry({
  experience,
  suggestions,
  coachEnabled,
  accentColor,
  onChange,
}: {
  experience: Experience;
  suggestions: Suggestion[];
  coachEnabled: boolean;
  accentColor: string;
  onChange: (updated: Experience) => void;
}) {
  const bullets = parseBulletPoints(experience.description || '');

  const handleBulletsChange = (newBullets: string[]) => {
    onChange({
      ...experience,
      description: bulletPointsToDescription(newBullets),
    });
  };

  return (
    <div>
      <div className="flex justify-between items-baseline">
        <div>
          <InlineEditableText
            spanId={`experience-${experience.id}-title`}
            value={experience.title}
            onChange={(value) => onChange({ ...experience, title: value })}
            placeholder="Job Title"
            suggestions={suggestions}
            coachEnabled={coachEnabled}
            className="font-semibold text-[12pt]"
          />
          <span className="mx-2 text-slate-400">|</span>
          <InlineEditableText
            spanId={`experience-${experience.id}-company`}
            value={experience.company}
            onChange={(value) => onChange({ ...experience, company: value })}
            placeholder="Company Name"
            suggestions={suggestions}
            coachEnabled={coachEnabled}
            className="text-[12pt]"
            style={{ color: accentColor } as React.CSSProperties}
          />
        </div>
        <div className="text-[10pt] text-slate-500">
          {experience.startDate} – {experience.current ? 'Present' : experience.endDate}
        </div>
      </div>
      {experience.location && (
        <div className="text-[10pt] text-slate-500 mb-1">{experience.location}</div>
      )}
      <div className="mt-2 text-[11pt]">
        <BulletEditable
          spanId={`experience-${experience.id}-bullets`}
          bullets={bullets.length > 0 ? bullets : ['']}
          onChange={handleBulletsChange}
          suggestions={suggestions}
          coachEnabled={coachEnabled}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Education Entry
// ============================================================================

function EducationEntry({
  education,
  suggestions,
  coachEnabled,
  onChange,
}: {
  education: Education;
  suggestions: Suggestion[];
  coachEnabled: boolean;
  onChange: (updated: Education) => void;
}) {
  return (
    <div>
      <div className="flex justify-between items-baseline">
        <div>
          <InlineEditableText
            spanId={`education-${education.id}-school`}
            value={education.school}
            onChange={(value) => onChange({ ...education, school: value })}
            placeholder="University Name"
            suggestions={suggestions}
            coachEnabled={coachEnabled}
            className="font-semibold text-[12pt]"
          />
        </div>
        <div className="text-[10pt] text-slate-500">
          {education.startYear} – {education.endYear}
        </div>
      </div>
      <div className="text-[11pt]">
        <InlineEditableText
          spanId={`education-${education.id}-degree`}
          value={education.degree}
          onChange={(value) => onChange({ ...education, degree: value })}
          placeholder="Degree"
          suggestions={suggestions}
          coachEnabled={coachEnabled}
        />
        <span className="text-slate-500"> in </span>
        <InlineEditableText
          spanId={`education-${education.id}-field`}
          value={education.field}
          onChange={(value) => onChange({ ...education, field: value })}
          placeholder="Field of Study"
          suggestions={suggestions}
          coachEnabled={coachEnabled}
        />
      </div>
      {education.gpa && <div className="text-[10pt] text-slate-600">GPA: {education.gpa}</div>}
    </div>
  );
}

// ============================================================================
// Skills Editor
// ============================================================================

function SkillsEditor({
  skills,
  suggestions,
  coachEnabled,
  onChange,
  compact = false,
  darkMode = false,
}: {
  skills: string[];
  suggestions: Suggestion[];
  coachEnabled: boolean;
  onChange?: (skills: string[]) => void;
  compact?: boolean;
  darkMode?: boolean;
}) {
  const hasSuggestion = coachEnabled && suggestions.some((s) => s.spanId.startsWith('skills-'));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newSkillValue, setNewSkillValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const newInputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingIndex !== null && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingIndex]);

  useEffect(() => {
    if (isAddingNew && newInputRef.current) {
      newInputRef.current.focus();
    }
  }, [isAddingNew]);

  const handleStartEdit = useCallback((index: number, skill: string) => {
    setEditingIndex(index);
    setEditValue(skill);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingIndex === null || !onChange) return;

    const trimmed = editValue.trim();
    if (trimmed) {
      const newSkills = [...skills];
      newSkills[editingIndex] = trimmed;
      onChange(newSkills);
    }
    setEditingIndex(null);
    setEditValue('');
  }, [editingIndex, editValue, skills, onChange]);

  const handleDeleteSkill = useCallback(
    (index: number) => {
      if (!onChange) return;
      const newSkills = skills.filter((_, i) => i !== index);
      onChange(newSkills);
    },
    [skills, onChange],
  );

  const handleAddSkill = useCallback(() => {
    if (!onChange) return;
    const trimmed = newSkillValue.trim();
    if (trimmed) {
      onChange([...skills, trimmed]);
    }
    setNewSkillValue('');
    setIsAddingNew(false);
  }, [newSkillValue, skills, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, type: 'edit' | 'add') => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (type === 'edit') {
          handleSaveEdit();
        } else {
          handleAddSkill();
        }
      } else if (e.key === 'Escape') {
        if (type === 'edit') {
          setEditingIndex(null);
          setEditValue('');
        } else {
          setIsAddingNew(false);
          setNewSkillValue('');
        }
      }
    },
    [handleSaveEdit, handleAddSkill],
  );

  // Compact view for sidebar (vertical list)
  if (compact) {
    return (
      <div
        data-span-id="skills-list"
        className={`text-[9pt] space-y-1 ${
          hasSuggestion
            ? 'underline decoration-wavy decoration-amber-400 underline-offset-4 decoration-2'
            : ''
        }`}
        style={{ color: darkMode ? '#e2e8f0' : undefined }}
      >
        {skills.length > 0 ? (
          skills.map((skill, idx) => (
            <div key={idx} className="group flex items-center gap-1">
              <span
                className="w-1 h-1 rounded-full flex-shrink-0"
                style={{ backgroundColor: darkMode ? '#94a3b8' : '#94a3b8' }}
              />
              {editingIndex === idx ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={handleSaveEdit}
                  onKeyDown={(e) => handleKeyDown(e, 'edit')}
                  className="flex-1 bg-transparent border-b border-slate-400 outline-none text-[9pt] min-w-0"
                  style={{ color: darkMode ? '#e2e8f0' : undefined }}
                />
              ) : (
                <>
                  <span
                    className="flex-1 cursor-text hover:bg-slate-100/20 rounded px-0.5 -mx-0.5"
                    onClick={() => onChange && handleStartEdit(idx, skill)}
                  >
                    {skill}
                  </span>
                  {onChange && (
                    <button
                      onClick={() => handleDeleteSkill(idx)}
                      className="opacity-0 group-hover:opacity-100 text-[8pt] text-red-400 hover:text-red-500 transition-opacity"
                      aria-label={`Delete ${skill}`}
                    >
                      ×
                    </button>
                  )}
                </>
              )}
            </div>
          ))
        ) : (
          <span
            style={{ color: darkMode ? '#64748b' : '#cbd5e1' }}
            className={onChange ? 'cursor-pointer hover:underline' : ''}
            onClick={() => onChange && setIsAddingNew(true)}
          >
            {onChange ? 'Click to add skills...' : 'Add your skills...'}
          </span>
        )}
        {/* Add new skill input */}
        {onChange && isAddingNew && (
          <div className="flex items-center gap-1">
            <span
              className="w-1 h-1 rounded-full flex-shrink-0"
              style={{ backgroundColor: darkMode ? '#94a3b8' : '#94a3b8' }}
            />
            <input
              ref={newInputRef}
              type="text"
              value={newSkillValue}
              onChange={(e) => setNewSkillValue(e.target.value)}
              onBlur={() => {
                handleAddSkill();
                setIsAddingNew(false);
              }}
              onKeyDown={(e) => handleKeyDown(e, 'add')}
              placeholder="Type skill..."
              className="flex-1 bg-transparent border-b border-slate-400 outline-none text-[9pt] min-w-0"
              style={{ color: darkMode ? '#e2e8f0' : undefined }}
            />
          </div>
        )}
        {/* Add button */}
        {onChange && !isAddingNew && skills.length > 0 && (
          <button
            onClick={() => setIsAddingNew(true)}
            className="text-[8pt] text-slate-400 hover:text-slate-600 mt-1"
          >
            + Add skill
          </button>
        )}
      </div>
    );
  }

  // Standard inline view (pill/tag style)
  return (
    <div
      data-span-id="skills-list"
      className={`text-[11pt] flex flex-wrap gap-1.5 ${
        hasSuggestion
          ? 'underline decoration-wavy decoration-amber-400 underline-offset-4 decoration-2'
          : ''
      }`}
    >
      {skills.length > 0
        ? skills.map((skill, idx) => (
            <span
              key={idx}
              className="group inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 rounded px-2 py-0.5 transition-colors"
            >
              {editingIndex === idx ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={handleSaveEdit}
                  onKeyDown={(e) => handleKeyDown(e, 'edit')}
                  className="bg-transparent outline-none text-[11pt] min-w-[60px] w-auto"
                  style={{ width: `${Math.max(60, editValue.length * 8)}px` }}
                />
              ) : (
                <>
                  <span
                    className={onChange ? 'cursor-text' : ''}
                    onClick={() => onChange && handleStartEdit(idx, skill)}
                  >
                    {skill}
                  </span>
                  {onChange && (
                    <button
                      onClick={() => handleDeleteSkill(idx)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 text-xs transition-opacity ml-0.5"
                      aria-label={`Delete ${skill}`}
                    >
                      ×
                    </button>
                  )}
                </>
              )}
            </span>
          ))
        : null}
      {/* Add new skill */}
      {onChange && isAddingNew ? (
        <span className="inline-flex items-center bg-slate-100 rounded px-2 py-0.5">
          <input
            ref={newInputRef}
            type="text"
            value={newSkillValue}
            onChange={(e) => setNewSkillValue(e.target.value)}
            onBlur={() => {
              handleAddSkill();
              setIsAddingNew(false);
            }}
            onKeyDown={(e) => handleKeyDown(e, 'add')}
            placeholder="Type skill..."
            className="bg-transparent outline-none text-[11pt] min-w-[80px]"
          />
        </span>
      ) : onChange ? (
        <button
          onClick={() => setIsAddingNew(true)}
          className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded px-2 py-0.5 transition-colors border border-dashed border-slate-300"
        >
          + Add skill
        </button>
      ) : skills.length === 0 ? (
        <span className="text-slate-300">Add your skills...</span>
      ) : null}
    </div>
  );
}

// ============================================================================
// Project Entry
// ============================================================================

function ProjectEntry({
  project,
  suggestions,
  coachEnabled,
  onChange,
}: {
  project: Project;
  suggestions: Suggestion[];
  coachEnabled: boolean;
  onChange: (updated: Project) => void;
}) {
  return (
    <div>
      <div className="flex justify-between items-baseline">
        <InlineEditableText
          spanId={`projects-${project.id}-name`}
          value={project.name}
          onChange={(value) => onChange({ ...project, name: value })}
          placeholder="Project Name"
          suggestions={suggestions}
          coachEnabled={coachEnabled}
          className="font-semibold text-[12pt]"
        />
        {project.url && (
          <a
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10pt] text-blue-600 hover:underline"
          >
            View Project
          </a>
        )}
      </div>
      <InlineEditableText
        spanId={`projects-${project.id}-description`}
        value={project.description}
        onChange={(value) => onChange({ ...project, description: value })}
        placeholder="Describe your project..."
        multiline
        suggestions={suggestions}
        coachEnabled={coachEnabled}
        className="text-[11pt] mt-1"
      />
      {project.technologies && (
        <div className="text-[10pt] text-slate-500 mt-1">
          <span className="font-medium">Tech:</span> {project.technologies}
        </div>
      )}
    </div>
  );
}
