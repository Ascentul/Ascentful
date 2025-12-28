'use client';

import React from 'react';

import type { ResumeData } from '@/components/resume/ResumeDocument';

import { TEMPLATE_LAYOUTS } from '../types';
import {
  EducationItem,
  ExperienceItem,
  getFontStyles,
  ProjectItem,
  SkillsList,
} from './BaseTemplate';

// ============================================================================
// Minimal Template
// Maximum whitespace, light font weights, no accent colors, very clean
// ============================================================================

interface MinimalTemplateProps {
  data: ResumeData;
  className?: string;
}

interface MinimalSectionHeaderProps {
  children: React.ReactNode;
  fontFamily: string;
}

function MinimalSectionHeader({ children, fontFamily }: MinimalSectionHeaderProps) {
  return (
    <h2
      style={{
        fontFamily,
        fontSize: '12pt',
        fontWeight: 400,
        color: '#374151',
        textTransform: 'none',
        letterSpacing: '0.02em',
        marginBottom: '16px',
      }}
    >
      {children}
    </h2>
  );
}

export function MinimalTemplate({ data, className = '' }: MinimalTemplateProps) {
  const config = TEMPLATE_LAYOUTS.minimal;
  const fonts = getFontStyles(config.fontPairing);
  const { contactInfo, summary, skills, experience, education, projects } = data;

  return (
    <div
      className={`minimal-template bg-white ${className}`}
      style={{
        width: '8.5in',
        minHeight: '11in',
        padding: '1in',
        fontFamily: fonts.body,
        fontSize: '11pt',
        fontWeight: 300,
        lineHeight: '1.5',
        color: '#374151',
      }}
    >
      {/* Header - very spacious */}
      <header
        style={{
          marginBottom: '48px',
        }}
      >
        <h1
          style={{
            fontFamily: fonts.heading,
            fontSize: '24pt',
            fontWeight: 300,
            lineHeight: '1.2',
            color: '#111827',
            marginBottom: '16px',
          }}
        >
          {contactInfo.name}
        </h1>
        <div
          style={{
            fontSize: '10pt',
            color: '#6B7280',
            lineHeight: '1.6',
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
        <section style={{ marginBottom: '40px' }}>
          <MinimalSectionHeader fontFamily={fonts.heading}>Summary</MinimalSectionHeader>
          <p
            style={{
              fontFamily: fonts.body,
              fontSize: '11pt',
              fontWeight: 300,
              lineHeight: '1.7',
              color: '#4B5563',
            }}
          >
            {summary}
          </p>
        </section>
      )}

      {/* Experience */}
      {experience && experience.length > 0 && (
        <section style={{ marginBottom: '40px' }}>
          <MinimalSectionHeader fontFamily={fonts.heading}>Experience</MinimalSectionHeader>
          {experience.map((exp, index) => (
            <ExperienceItem key={exp.id} experience={exp} config={config} isFirst={index === 0} />
          ))}
        </section>
      )}

      {/* Education */}
      {education && education.length > 0 && (
        <section style={{ marginBottom: '40px' }}>
          <MinimalSectionHeader fontFamily={fonts.heading}>Education</MinimalSectionHeader>
          {education.map((edu, index) => (
            <EducationItem key={edu.id} education={edu} config={config} isFirst={index === 0} />
          ))}
        </section>
      )}

      {/* Skills */}
      {skills && skills.length > 0 && (
        <section style={{ marginBottom: '40px' }}>
          <MinimalSectionHeader fontFamily={fonts.heading}>Skills</MinimalSectionHeader>
          <SkillsList skills={skills} config={config} />
        </section>
      )}

      {/* Projects */}
      {projects && projects.length > 0 && (
        <section style={{ marginBottom: '40px' }}>
          <MinimalSectionHeader fontFamily={fonts.heading}>Projects</MinimalSectionHeader>
          {projects.map((project, index) => (
            <ProjectItem key={project.id} project={project} config={config} isFirst={index === 0} />
          ))}
        </section>
      )}
    </div>
  );
}
