'use client';

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
  onUpdateSkills: (skills: string[]) => void;
  onUpdateProjects: (projects: Project[]) => void;
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
  onUpdateSkills,
  onUpdateProjects,
}: ResumeCanvasProps) {
  // Get template-specific layout configuration
  const templateConfig = (() => {
    switch (templateId) {
      case 'clean':
        return TEMPLATE_LAYOUTS.clean;
      case 'bold':
        return TEMPLATE_LAYOUTS.bold;
      case 'minimal':
        return TEMPLATE_LAYOUTS.minimal;
      case 'classic':
        return TEMPLATE_LAYOUTS.classic;
      case 'ats':
        return TEMPLATE_LAYOUTS.ats;
      case 'modern':
      default:
        return TEMPLATE_LAYOUTS.modern;
    }
  })();
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
    const hex = sidebarBgColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
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
              {(data.experience || []).map((exp, index) => (
                <ExperienceEntry
                  key={exp.id}
                  experience={exp}
                  suggestions={suggestions}
                  coachEnabled={coachEnabled}
                  accentColor={accentColor}
                  onChange={(updated) => {
                    const newExperiences = (data.experience || []).map((exp, i) =>
                      i === index ? updated : exp,
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
              {(data.education || []).map((edu, index) => (
                <EducationEntry
                  key={edu.id}
                  education={edu}
                  suggestions={suggestions}
                  coachEnabled={coachEnabled}
                  onChange={(updated) => {
                    const newEducation = (data.education || []).map((edu, i) =>
                      i === index ? updated : edu,
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
              onChange={onUpdateSkills}
              suggestions={suggestions}
              coachEnabled={coachEnabled}
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
              {(data.projects || []).map((project, index) => (
                <ProjectEntry
                  key={project.id}
                  project={project}
                  suggestions={suggestions}
                  coachEnabled={coachEnabled}
                  onChange={(updated) => {
                    const newProjects = (data.projects || []).map((project, i) =>
                      i === index ? updated : project,
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
      <header
        className={`pb-3 mb-6 ${sectionDivider === 'accent-line' ? 'border-b-2' : 'border-b-2'}`}
        style={{ borderColor: accentColor }}
      >
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
                borderColor: isSidebarDark ? accentColor : accentColor,
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
                  borderColor: isSidebarDark ? accentColor : accentColor,
                  color: isSidebarDark ? '#ffffff' : accentColor,
                }}
              >
                Skills
              </h3>
              <SkillsEditor
                skills={data.skills || []}
                onChange={onUpdateSkills}
                suggestions={suggestions}
                coachEnabled={coachEnabled}
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
  onChange: _onChange,
  suggestions,
  coachEnabled,
  compact = false,
  darkMode = false,
}: {
  skills: string[];
  onChange: (skills: string[]) => void;
  suggestions: Suggestion[];
  coachEnabled: boolean;
  compact?: boolean;
  darkMode?: boolean;
}) {
  const hasSuggestion = coachEnabled && suggestions.some((s) => s.spanId.startsWith('skills-'));

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
            <div key={idx} className="flex items-center gap-1">
              <span
                className="w-1 h-1 rounded-full"
                style={{ backgroundColor: darkMode ? '#94a3b8' : '#94a3b8' }}
              />
              {skill}
            </div>
          ))
        ) : (
          <span style={{ color: darkMode ? '#64748b' : '#cbd5e1' }}>Add your skills...</span>
        )}
      </div>
    );
  }

  // Standard inline view
  return (
    <div
      data-span-id="skills-list"
      className={`text-[11pt] ${
        hasSuggestion
          ? 'underline decoration-wavy decoration-amber-400 underline-offset-4 decoration-2'
          : ''
      }`}
    >
      {skills.length > 0 ? (
        skills.join(' • ')
      ) : (
        <span className="text-slate-300">Add your skills...</span>
      )}
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
