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
  SectionHeader,
  SkillsList,
  SummaryText,
} from './BaseTemplate';

// ============================================================================
// Bold Template
// Single-column with dark header background, large bold name, high contrast
// ============================================================================

interface BoldTemplateProps {
  data: ResumeData;
  className?: string;
}

export function BoldTemplate({ data, className = '' }: BoldTemplateProps) {
  const config = TEMPLATE_LAYOUTS.bold;
  const fonts = getFontStyles(config.fontPairing);
  const { contactInfo, summary, skills, experience, education, projects } = data;

  return (
    <div
      className={`bold-template bg-white ${className}`}
      style={{
        width: '8.5in',
        minHeight: '11in',
        fontFamily: fonts.body,
        fontSize: '11pt',
        lineHeight: '1.3',
        color: '#000',
      }}
    >
      {/* Dark Header */}
      <header
        style={{
          backgroundColor: config.accentColor,
          color: '#fff',
          padding: '32px 0.7in 24px',
          marginBottom: '16px',
        }}
      >
        <h1
          style={{
            fontFamily: fonts.heading,
            fontSize: '28pt',
            fontWeight: 800,
            lineHeight: '1.1',
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            marginBottom: '12px',
          }}
        >
          {contactInfo.name}
        </h1>
        <div
          style={{
            fontSize: '10pt',
            color: 'rgba(255, 255, 255, 0.8)',
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

      {/* Main Content */}
      <div style={{ padding: '0 0.7in 0.7in' }}>
        {/* Summary */}
        {summary && summary.trim() && (
          <SectionContainer config={config}>
            <SectionHeader config={config} style={{ color: config.accentColor, fontWeight: 800 }}>
              Professional Summary
            </SectionHeader>
            <SummaryText text={summary} config={config} />
          </SectionContainer>
        )}

        {/* Skills */}
        {skills && skills.length > 0 && (
          <SectionContainer config={config}>
            <SectionHeader config={config} style={{ color: config.accentColor, fontWeight: 800 }}>
              Skills
            </SectionHeader>
            <SkillsList skills={skills} config={config} />
          </SectionContainer>
        )}

        {/* Experience */}
        {experience && experience.length > 0 && (
          <SectionContainer config={config}>
            <SectionHeader config={config} style={{ color: config.accentColor, fontWeight: 800 }}>
              Experience
            </SectionHeader>
            {experience.map((exp, index) => (
              <ExperienceItem key={exp.id} experience={exp} config={config} isFirst={index === 0} />
            ))}
          </SectionContainer>
        )}

        {/* Education */}
        {education && education.length > 0 && (
          <SectionContainer config={config}>
            <SectionHeader config={config} style={{ color: config.accentColor, fontWeight: 800 }}>
              Education
            </SectionHeader>
            {education.map((edu, index) => (
              <EducationItem key={edu.id} education={edu} config={config} isFirst={index === 0} />
            ))}
          </SectionContainer>
        )}

        {/* Projects */}
        {projects && projects.length > 0 && (
          <SectionContainer config={config}>
            <SectionHeader config={config} style={{ color: config.accentColor, fontWeight: 800 }}>
              Projects
            </SectionHeader>
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
