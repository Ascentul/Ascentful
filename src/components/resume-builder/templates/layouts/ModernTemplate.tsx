'use client';

import React from 'react';

import type { ResumeData } from '@/components/resume/ResumeDocument';

import type { StyleConfig } from '../types';
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
// Modern Template
// Single-column with blue accent bar on left, brand blue accents
// ============================================================================

interface ModernTemplateProps {
  data: ResumeData;
  styleConfig?: StyleConfig;
  className?: string;
}

export function ModernTemplate({ data, className = '' }: ModernTemplateProps) {
  const config = TEMPLATE_LAYOUTS.modern;
  const fonts = getFontStyles(config.fontPairing);
  const { contactInfo, summary, skills, experience, education, projects } = data;

  return (
    <div
      className={`modern-template bg-white ${className}`}
      style={{
        width: '8.5in',
        minHeight: '11in',
        display: 'flex',
        fontFamily: fonts.body,
        fontSize: '11pt',
        lineHeight: '1.3',
        color: '#000',
      }}
    >
      {/* Left accent bar */}
      <div
        style={{
          width: '4px',
          backgroundColor: config.accentColor,
          flexShrink: 0,
        }}
      />

      {/* Main content */}
      <div
        style={{
          flex: 1,
          padding: '0.7in',
          paddingLeft: '0.6in',
        }}
      >
        {/* Header */}
        <header
          style={{
            paddingBottom: '12px',
            marginBottom: '16px',
            borderBottom: `2px solid ${config.accentColor}`,
          }}
        >
          <h1
            style={{
              fontFamily: fonts.heading,
              fontSize: '22pt',
              fontWeight: 700,
              lineHeight: '1.2',
              color: config.accentColor,
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
              <ProjectItem
                key={project.id}
                project={project}
                config={config}
                isFirst={index === 0}
              />
            ))}
          </SectionContainer>
        )}
      </div>
    </div>
  );
}
