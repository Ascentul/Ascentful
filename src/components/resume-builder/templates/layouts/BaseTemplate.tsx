'use client';

import React from 'react';

import type { Education, Experience, Project } from '@/components/resume/ResumeDocument';
import {
  formatDateRange,
  parseDescription,
  parseDescriptionToStructured,
} from '@/lib/resume-utils';

import type { FontPairingId, TemplateLayoutConfig } from '../types';
import { FONT_PAIRINGS } from '../types';

// ============================================================================
// Base Template Primitives
// Shared components used by all template layouts
// ============================================================================

// Pattern to detect action verb bullets (hoisted to avoid per-render compilation)
const ACTION_VERB_PATTERN =
  /^(Led|Managed|Developed|Built|Created|Implemented|Designed|Launched|Delivered|Achieved|Increased|Reduced|Improved|Optimized|Coordinated|Executed|Analyzed|Conducted|Oversaw|Spearheaded|Initiated|Established|Directed)\b/i;

interface BaseProps {
  config: TemplateLayoutConfig;
  className?: string;
  style?: React.CSSProperties;
}

// Get font styles from pairing
export function getFontStyles(fontPairing: FontPairingId) {
  const fonts = FONT_PAIRINGS[fontPairing] ?? FONT_PAIRINGS.classic;
  return {
    heading: fonts.heading,
    body: fonts.body,
  };
}

// ============================================================================
// Section Header
// ============================================================================

interface SectionHeaderProps extends BaseProps {
  children: React.ReactNode;
}

export function SectionHeader({ children, config, className, style }: SectionHeaderProps) {
  const fonts = getFontStyles(config.fontPairing);
  const isLight = config.fontWeight === 'light';

  const baseStyles: React.CSSProperties = {
    fontFamily: fonts.heading,
    fontSize: '13pt',
    fontWeight: isLight ? 400 : 700,
    color: config.accentColor,
    textTransform: config.sectionDivider === 'none' ? 'none' : 'uppercase',
    letterSpacing: config.sectionDivider === 'none' ? 'normal' : '0.05em',
    marginBottom: '8px',
    paddingBottom: '4px',
    ...style,
  };

  // Apply section divider styles
  if (config.sectionDivider === 'line') {
    baseStyles.borderBottom = `1px solid ${config.accentColor}30`;
  } else if (config.sectionDivider === 'double-line') {
    baseStyles.borderBottom = `3px double ${config.accentColor}50`;
  } else if (config.sectionDivider === 'accent-line') {
    baseStyles.borderBottom = `2px solid ${config.accentColor}`;
  }

  return (
    <h2 className={className} style={baseStyles}>
      {children}
    </h2>
  );
}

// ============================================================================
// Section Container
// ============================================================================

interface SectionContainerProps extends BaseProps {
  children: React.ReactNode;
}

export function SectionContainer({ children, config, className, style }: SectionContainerProps) {
  const spacing = config.density === 'comfortable' ? '16px' : '12px';

  return (
    <section
      className={className}
      style={{
        marginTop: spacing,
        marginBottom: spacing,
        ...style,
      }}
    >
      {children}
    </section>
  );
}

// ============================================================================
// Contact Line
// ============================================================================

interface ContactLineProps extends BaseProps {
  items: (string | undefined)[];
  separator?: string;
  centered?: boolean;
}

export function ContactLine({
  items,
  separator = ' · ',
  centered = false,
  config,
  style,
}: ContactLineProps) {
  const fonts = getFontStyles(config.fontPairing);
  const filteredItems = items.filter(Boolean);

  return (
    <div
      style={{
        fontFamily: fonts.body,
        fontSize: '10pt',
        color: '#718096',
        lineHeight: '1.2',
        textAlign: centered ? 'center' : 'left',
        ...style,
      }}
    >
      {filteredItems.join(separator)}
    </div>
  );
}

// ============================================================================
// Experience Item
// ============================================================================

interface ExperienceItemProps extends BaseProps {
  experience: Experience;
  isFirst?: boolean;
}

export function ExperienceItem({ experience, config, isFirst = false }: ExperienceItemProps) {
  const fonts = getFontStyles(config.fontPairing);
  const spacing = config.density === 'comfortable' ? '12px' : '8px';

  // Check if using structured format (summary + keyContributions)
  const hasStructuredData =
    experience.summary || (experience.keyContributions && experience.keyContributions.length > 0);

  // If no structured data, parse description into summary + bullets
  // This handles legacy data that only has description field populated
  const parsedFromDescription =
    !hasStructuredData && experience.description
      ? parseDescriptionToStructured(experience.description)
      : null;

  // Use structured fields if available, otherwise use parsed description
  let displaySummary = experience.summary || parsedFromDescription?.summary || '';
  let displayBullets = experience.keyContributions?.length
    ? experience.keyContributions
    : parsedFromDescription?.keyContributions || [];

  // If summary is empty but we have bullets, consider using the first bullet as the summary
  // Only promote if it looks like a descriptive summary (>60 chars, doesn't start with action verb)
  // This handles cases where the AI put all content in keyContributions
  if (!displaySummary && displayBullets.length > 0) {
    const firstBullet = displayBullets[0];

    // Promote to summary if it's long and doesn't start with action verb (likely descriptive)
    if (firstBullet.length > 60 && !ACTION_VERB_PATTERN.test(firstBullet)) {
      displaySummary = firstBullet;
      displayBullets = displayBullets.slice(1);
    }
  }

  // Legacy fallback: if parsing found nothing useful, use old parseDescription for raw bullets
  const legacyBullets =
    !displaySummary && displayBullets.length === 0 && experience.description
      ? parseDescription(experience.description)
      : [];

  return (
    <div style={{ marginTop: isFirst ? 0 : spacing }}>
      {/* Company and Date */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: '8px',
          marginBottom: '4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span
            style={{ fontFamily: fonts.heading, fontSize: '12pt', fontWeight: 700, color: '#000' }}
          >
            {experience.company}
          </span>
          {experience.location && (
            <span style={{ fontFamily: fonts.body, fontSize: '10pt', color: '#718096' }}>
              {experience.location}
            </span>
          )}
        </div>
        <span
          style={{
            fontFamily: fonts.body,
            fontSize: '10pt',
            color: '#718096',
            whiteSpace: 'nowrap',
          }}
        >
          {formatDateRange(experience.startDate, experience.endDate, experience.current)}
        </span>
      </div>

      {/* Role */}
      <div
        style={{
          fontFamily: fonts.body,
          fontSize: '11pt',
          fontWeight: 600,
          color: '#4A5568',
          marginBottom: '4px',
        }}
      >
        {experience.title}
      </div>

      {/* Summary/Overview - rendered as paragraph */}
      {displaySummary && (
        <p
          style={{
            fontFamily: fonts.body,
            fontSize: '11pt',
            marginTop: '4px',
            marginBottom: '8px',
            lineHeight: '1.4',
            color: '#2D3748',
          }}
        >
          {displaySummary}
        </p>
      )}

      {/* Accomplishments Header + Bullets */}
      {displayBullets.length > 0 && (
        <>
          <div
            style={{
              fontFamily: fonts.body,
              fontSize: '10pt',
              fontWeight: 600,
              color: '#718096',
              fontStyle: 'italic',
              marginTop: displaySummary ? '4px' : '0',
              marginBottom: '4px',
            }}
          >
            Accomplishments:
          </div>
          <BulletList items={displayBullets} config={config} />
        </>
      )}

      {/* Legacy fallback for truly unstructured data - also show Accomplishments label */}
      {legacyBullets.length > 0 && (
        <>
          <div
            style={{
              fontFamily: fonts.body,
              fontSize: '10pt',
              fontWeight: 600,
              color: '#718096',
              fontStyle: 'italic',
              marginTop: '0',
              marginBottom: '4px',
            }}
          >
            Accomplishments:
          </div>
          <BulletList items={legacyBullets} config={config} />
        </>
      )}
    </div>
  );
}

// ============================================================================
// Education Item
// ============================================================================

interface EducationItemProps extends BaseProps {
  education: Education;
  isFirst?: boolean;
}

export function EducationItem({ education, config, isFirst = false }: EducationItemProps) {
  const fonts = getFontStyles(config.fontPairing);
  const spacing = config.density === 'comfortable' ? '12px' : '8px';

  return (
    <div style={{ marginTop: isFirst ? 0 : spacing }}>
      {/* School and Dates */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: '8px',
          marginBottom: '4px',
        }}
      >
        <span
          style={{ fontFamily: fonts.heading, fontSize: '12pt', fontWeight: 700, color: '#000' }}
        >
          {education.school}
        </span>
        <span
          style={{
            fontFamily: fonts.body,
            fontSize: '10pt',
            color: '#718096',
            whiteSpace: 'nowrap',
          }}
        >
          {education.startYear && education.endYear
            ? `${education.startYear} - ${education.endYear}`
            : education.startYear
              ? `${education.startYear} - Present`
              : education.endYear || ''}
        </span>
      </div>

      {/* Degree and Field */}
      <div style={{ fontFamily: fonts.body, fontSize: '11pt' }}>
        {education.degree && education.field
          ? `${education.degree} in ${education.field}`
          : education.degree || education.field || ''}
      </div>

      {/* Location */}
      {education.location && (
        <div style={{ fontFamily: fonts.body, fontSize: '10pt', color: '#718096' }}>
          {education.location}
        </div>
      )}

      {/* GPA and Honors */}
      {(education.gpa || education.honors) && (
        <div
          style={{ fontFamily: fonts.body, fontSize: '10pt', color: '#4A5568', marginTop: '4px' }}
        >
          {[education.gpa && `GPA: ${education.gpa}`, education.honors].filter(Boolean).join(' · ')}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Project Item
// ============================================================================

interface ProjectItemProps extends BaseProps {
  project: Project;
  isFirst?: boolean;
}

export function ProjectItem({ project, config, isFirst = false }: ProjectItemProps) {
  const fonts = getFontStyles(config.fontPairing);
  const bullets = parseDescription(project.description);
  const spacing = config.density === 'comfortable' ? '12px' : '8px';

  return (
    <div style={{ marginTop: isFirst ? 0 : spacing }}>
      {/* Project Name and Role */}
      <div style={{ marginBottom: '4px' }}>
        <span
          style={{ fontFamily: fonts.heading, fontSize: '12pt', fontWeight: 700, color: '#000' }}
        >
          {project.name}
        </span>
        {project.role && (
          <span
            style={{
              fontFamily: fonts.body,
              fontSize: '10pt',
              fontStyle: 'italic',
              color: '#4A5568',
              marginLeft: '8px',
            }}
          >
            {project.role}
          </span>
        )}
      </div>

      {/* Technologies */}
      {project.technologies && (
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: '10pt',
            color: '#718096',
            marginBottom: '4px',
          }}
        >
          Technologies: {project.technologies}
        </div>
      )}

      {/* URL */}
      {project.url && /^https?:\/\//i.test(project.url) && (
        <div style={{ fontFamily: fonts.body, fontSize: '10pt', marginBottom: '4px' }}>
          <a href={project.url} style={{ color: config.accentColor, textDecoration: 'underline' }}>
            {project.url}
          </a>
        </div>
      )}

      {/* Description */}
      {bullets.length > 0 && <BulletList items={bullets} config={config} />}
    </div>
  );
}

// ============================================================================
// Bullet List
// ============================================================================

interface BulletListProps extends BaseProps {
  items: string[];
}

export function BulletList({ items, config }: BulletListProps) {
  const fonts = getFontStyles(config.fontPairing);

  if (items.length === 0) return null;

  return (
    <ul
      style={{
        listStyleType: 'disc',
        listStylePosition: 'outside',
        paddingLeft: '20px',
        marginTop: '4px',
      }}
    >
      {items.map((item, idx) => (
        <li
          key={idx}
          style={{
            fontFamily: fonts.body,
            fontSize: '11pt',
            lineHeight: '1.3',
            marginBottom: '4px',
          }}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

// ============================================================================
// Skills List
// ============================================================================

interface SkillsListProps extends BaseProps {
  skills: string[];
  inline?: boolean;
}

export function SkillsList({ skills, config, inline = true }: SkillsListProps) {
  const fonts = getFontStyles(config.fontPairing);

  if (inline) {
    return <p style={{ fontFamily: fonts.body, fontSize: '11pt' }}>{skills.join(', ')}</p>;
  }

  return (
    <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
      {skills.map((skill, idx) => (
        <li
          key={idx}
          style={{
            fontFamily: fonts.body,
            fontSize: '11pt',
            lineHeight: '1.4',
          }}
        >
          {skill}
        </li>
      ))}
    </ul>
  );
}

// ============================================================================
// Summary Text
// ============================================================================

interface SummaryTextProps extends BaseProps {
  text: string;
}

export function SummaryText({ text, config }: SummaryTextProps) {
  const fonts = getFontStyles(config.fontPairing);

  return (
    <p
      style={{
        fontFamily: fonts.body,
        fontSize: '11pt',
        // Justified text creates clean block edges typical of professional resumes.
        // May cause awkward spacing on very short summaries (<2 lines).
        textAlign: 'justify',
      }}
    >
      {text}
    </p>
  );
}
