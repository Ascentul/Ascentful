'use client';

import React from 'react';

import type { ResumeData } from '@/components/resume/ResumeDocument';

import { TEMPLATE_LAYOUTS } from '../types';
import {
  ContactLine,
  EducationItem,
  ExperienceItem,
  getFontStyles,
  ProjectItem,
  SectionContainer,
  SectionHeader,
  SkillsList,
  SummaryText,
} from './BaseTemplate';

// ============================================================================
// Clean Template
// Simple, minimalist single-column layout with thin gray accent lines
// ============================================================================

interface CleanTemplateProps {
  data: ResumeData;
  className?: string;
}

export function CleanTemplate({ data, className = '' }: CleanTemplateProps) {
  const config = TEMPLATE_LAYOUTS.clean;
  const fonts = getFontStyles(config.fontPairing);
  const { contactInfo, summary, skills, experience, education, projects } = data;

  return (
    <div
      className={`clean-template bg-white ${className}`}
      style={{
        width: '8.5in',
        minHeight: '11in',
        padding: '0.7in',
        fontFamily: fonts.body,
        fontSize: '11pt',
        lineHeight: '1.3',
        color: '#000',
      }}
    >
      {/* Header */}
      <header
        style={{
          paddingBottom: '12px',
          marginBottom: '16px',
          borderBottom: `1px solid ${config.accentColor}40`,
        }}
      >
        <h1
          style={{
            fontFamily: fonts.heading,
            fontSize: '20pt',
            fontWeight: 700,
            lineHeight: '1.2',
            color: '#000',
            marginBottom: '8px',
          }}
        >
          {contactInfo.name}
        </h1>
        <ContactLine
          items={[
            contactInfo.location,
            contactInfo.phone,
            contactInfo.email,
            contactInfo.linkedin,
            contactInfo.github,
            contactInfo.website,
          ]}
          config={config}
        />
      </header>

      {/* Summary */}
      {summary && summary.trim() && (
        <SectionContainer config={config}>
          <SectionHeader config={config}>Professional Summary</SectionHeader>
          <SummaryText text={summary} config={config} />
        </SectionContainer>
      )}

      {/* Skills */}
      {skills && skills.length > 0 && (
        <SectionContainer config={config}>
          <SectionHeader config={config}>Skills</SectionHeader>
          <SkillsList skills={skills} config={config} />
        </SectionContainer>
      )}

      {/* Experience */}
      {experience && experience.length > 0 && (
        <SectionContainer config={config}>
          <SectionHeader config={config}>Experience</SectionHeader>
          {experience.map((exp, index) => (
            <ExperienceItem key={exp.id} experience={exp} config={config} isFirst={index === 0} />
          ))}
        </SectionContainer>
      )}

      {/* Education */}
      {education && education.length > 0 && (
        <SectionContainer config={config}>
          <SectionHeader config={config}>Education</SectionHeader>
          {education.map((edu, index) => (
            <EducationItem key={edu.id} education={edu} config={config} isFirst={index === 0} />
          ))}
        </SectionContainer>
      )}

      {/* Projects */}
      {projects && projects.length > 0 && (
        <SectionContainer config={config}>
          <SectionHeader config={config}>Projects</SectionHeader>
          {projects.map((project, index) => (
            <ProjectItem key={project.id} project={project} config={config} isFirst={index === 0} />
          ))}
        </SectionContainer>
      )}
    </div>
  );
}
