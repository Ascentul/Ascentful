'use client';

import type {
  Education,
  Experience,
  Project,
  ResumeData,
} from '@/components/resume/ResumeDocument';
import type { StyleConfig, TemplateId } from '@/components/resume-builder/templates/types';
import { FONT_PAIRINGS } from '@/components/resume-builder/templates/types';
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
  const fontPairing = FONT_PAIRINGS[styleConfig.font_pairing];
  const accentColor = styleConfig.accent_color;
  const isCompact = styleConfig.density === 'compact';
  const isCaps = styleConfig.heading_style === 'caps';

  // Build CSS variables
  const cssVars = {
    '--font-heading': fontPairing.heading,
    '--font-body': fontPairing.body,
    '--color-accent': accentColor,
  } as React.CSSProperties;

  const sectionHeadingClass = `text-[13pt] font-semibold mb-2 ${
    isCaps ? 'uppercase tracking-wider' : ''
  }`;

  const renderSection = (sectionId: string) => {
    if (!enabledSections.includes(sectionId)) return null;

    switch (sectionId) {
      case 'summary':
        return (
          <section key={sectionId} className={isCompact ? 'mb-4' : 'mb-6'}>
            <h2 className={sectionHeadingClass} style={{ color: accentColor }}>
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
            <h2 className={sectionHeadingClass} style={{ color: accentColor }}>
              Work Experience
            </h2>
            <div className="space-y-4">
              {(data.experience || []).map((exp, index) => (
                <ExperienceEntry
                  key={exp.id}
                  experience={exp}
                  index={index}
                  suggestions={suggestions}
                  coachEnabled={coachEnabled}
                  accentColor={accentColor}
                  onChange={(updated) => {
                    const newExperiences = [...(data.experience || [])];
                    newExperiences[index] = updated;
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
            <h2 className={sectionHeadingClass} style={{ color: accentColor }}>
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
                    const newEducation = [...(data.education || [])];
                    newEducation[index] = updated;
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
            <h2 className={sectionHeadingClass} style={{ color: accentColor }}>
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
            <h2 className={sectionHeadingClass} style={{ color: accentColor }}>
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
                    const newProjects = [...(data.projects || [])];
                    newProjects[index] = updated;
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

  return (
    <div
      className="p-[0.7in] font-sans text-[11pt] leading-[1.3] text-slate-900"
      style={{
        ...cssVars,
        fontFamily: 'var(--font-body)',
      }}
    >
      {/* Header / Contact Info */}
      <header className="border-b-2 pb-3 mb-6" style={{ borderColor: accentColor }}>
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
        </div>
      </header>

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
  index,
  suggestions,
  coachEnabled,
  accentColor,
  onChange,
}: {
  experience: Experience;
  index: number;
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
          itemId={experience.id}
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
          value={`${education.degree}${education.field ? ` in ${education.field}` : ''}`}
          onChange={(value) => {
            const parts = value.split(' in ');
            onChange({
              ...education,
              degree: parts[0] || '',
              field: parts[1] || '',
            });
          }}
          placeholder="Degree in Field of Study"
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
  onChange,
  suggestions,
  coachEnabled,
}: {
  skills: string[];
  onChange: (skills: string[]) => void;
  suggestions: Suggestion[];
  coachEnabled: boolean;
}) {
  const hasSuggestion = coachEnabled && suggestions.some((s) => s.spanId.startsWith('skills-'));

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
