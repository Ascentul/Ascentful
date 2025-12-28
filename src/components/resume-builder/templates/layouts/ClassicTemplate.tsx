'use client';

import React from 'react';

import type { ResumeData } from '@/components/resume/ResumeDocument';

import { TEMPLATE_LAYOUTS } from '../types';
import {
  EducationItem,
  ExperienceItem,
  getFontStyles,
  ProjectItem,
  SectionContainer,
  SkillsList,
  SummaryText,
} from './BaseTemplate';

// ============================================================================
// Classic Template
// Centered header, serif fonts, double-line dividers, traditional formal look
// ============================================================================

interface ClassicTemplateProps {
  data: ResumeData;
  className?: string;
}

interface ClassicSectionHeaderProps {
  children: React.ReactNode;
  color: string;
  fontFamily: string;
}

function ClassicSectionHeader({ children, color, fontFamily }: ClassicSectionHeaderProps) {
  return (
    <h2
      style={{
        fontFamily,
        fontSize: '13pt',
        fontWeight: 700,
        color,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        textAlign: 'center',
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: `1px solid ${color}40`,
      }}
    >
      {children}
    </h2>
  );
}

export function ClassicTemplate({ data, className = '' }: ClassicTemplateProps) {
  const config = TEMPLATE_LAYOUTS.classic;
  const fonts = getFontStyles(config.fontPairing);
  const { contactInfo, summary, skills, experience, education, projects } = data;

  return (
    <div
      className={`classic-template bg-white ${className}`}
      style={{
        width: '8.5in',
        minHeight: '11in',
        padding: '0.75in',
        fontFamily: fonts.body,
        fontSize: '11pt',
        lineHeight: '1.35',
        color: '#000',
      }}
    >
      {/* Centered Header with double-line border */}
      <header
        style={{
          textAlign: 'center',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: `3px double ${config.accentColor}`,
        }}
      >
        <h1
          style={{
            fontFamily: fonts.heading,
            fontSize: '24pt',
            fontWeight: 700,
            lineHeight: '1.2',
            color: '#000',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            marginBottom: '8px',
          }}
        >
          {contactInfo.name}
        </h1>
        <div
          style={{
            fontSize: '10pt',
            color: '#4A5568',
            lineHeight: '1.4',
          }}
        >
          {[
            contactInfo.location,
            contactInfo.phone,
            contactInfo.email,
            contactInfo.linkedin,
            contactInfo.github,
            contactInfo.website,
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
      </header>

      {/* Summary */}
      {summary && summary.trim() && (
        <SectionContainer config={config}>
          <ClassicSectionHeader color={config.accentColor} fontFamily={fonts.heading}>
            Professional Summary
          </ClassicSectionHeader>
          <SummaryText text={summary} config={config} />
        </SectionContainer>
      )}

      {/* Experience */}
      {experience && experience.length > 0 && (
        <SectionContainer config={config}>
          <ClassicSectionHeader color={config.accentColor} fontFamily={fonts.heading}>
            Professional Experience
          </ClassicSectionHeader>
          {experience.map((exp, index) => (
            <ExperienceItem key={exp.id} experience={exp} config={config} isFirst={index === 0} />
          ))}
        </SectionContainer>
      )}

      {/* Education */}
      {education && education.length > 0 && (
        <SectionContainer config={config}>
          <ClassicSectionHeader color={config.accentColor} fontFamily={fonts.heading}>
            Education
          </ClassicSectionHeader>
          {education.map((edu, index) => (
            <EducationItem key={edu.id} education={edu} config={config} isFirst={index === 0} />
          ))}
        </SectionContainer>
      )}

      {/* Skills */}
      {skills && skills.length > 0 && (
        <SectionContainer config={config}>
          <ClassicSectionHeader color={config.accentColor} fontFamily={fonts.heading}>
            Skills & Competencies
          </ClassicSectionHeader>
          <SkillsList skills={skills} config={config} />
        </SectionContainer>
      )}

      {/* Projects */}
      {projects && projects.length > 0 && (
        <SectionContainer config={config}>
          <ClassicSectionHeader color={config.accentColor} fontFamily={fonts.heading}>
            Projects
          </ClassicSectionHeader>
          {projects.map((project, index) => (
            <ProjectItem key={project.id} project={project} config={config} isFirst={index === 0} />
          ))}
        </SectionContainer>
      )}
    </div>
  );
}
