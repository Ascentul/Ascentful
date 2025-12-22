'use client';

import React from 'react';

import type { ResumeData } from '@/components/resume/ResumeDocument';

import { TEMPLATE_LAYOUTS } from '../types';
import {
  EducationItem,
  ExperienceItem,
  getFontStyles,
  ProjectItem,
  SummaryText,
} from './BaseTemplate';

// ============================================================================
// Executive Template (Two-Column)
// Left sidebar with contact & skills, main content on right
// 30/70 column split
// ============================================================================

interface ExecutiveTemplateProps {
  data: ResumeData;
  className?: string;
}

interface SidebarHeaderProps {
  children: React.ReactNode;
  fontFamily: string;
}

function SidebarHeader({ children, fontFamily }: SidebarHeaderProps) {
  return (
    <h3
      style={{
        fontFamily,
        fontSize: '10pt',
        fontWeight: 600,
        color: '#fff',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: '12px',
        paddingBottom: '6px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
      }}
    >
      {children}
    </h3>
  );
}

interface MainHeaderProps {
  children: React.ReactNode;
  fontFamily: string;
  color: string;
}

function MainHeader({ children, fontFamily, color }: MainHeaderProps) {
  return (
    <h2
      style={{
        fontFamily,
        fontSize: '13pt',
        fontWeight: 700,
        color,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '10px',
        paddingBottom: '6px',
        borderBottom: `1px solid ${color}30`,
      }}
    >
      {children}
    </h2>
  );
}

export function ExecutiveTemplate({ data, className = '' }: ExecutiveTemplateProps) {
  const config = TEMPLATE_LAYOUTS.ats;
  const fonts = getFontStyles(config.fontPairing);
  const { contactInfo, summary, skills, experience, education, projects } = data;

  return (
    <div
      className={`executive-template bg-white ${className}`}
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
      {/* Left Sidebar */}
      <aside
        style={{
          width: '2.4in',
          backgroundColor: config.accentColor,
          color: '#fff',
          padding: '0.6in 0.4in',
          flexShrink: 0,
        }}
      >
        {/* Name in sidebar */}
        <div style={{ marginBottom: '32px' }}>
          <h1
            style={{
              fontFamily: fonts.heading,
              fontSize: '18pt',
              fontWeight: 700,
              lineHeight: '1.2',
              color: '#fff',
              marginBottom: '4px',
            }}
          >
            {(() => {
              const nameParts = contactInfo.name.split(' ').filter(Boolean);
              const firstName = nameParts[0] || '';
              const lastName = nameParts.slice(1).join(' ');

              return (
                <>
                  <span style={{ display: 'block' }}>{firstName}</span>
                  {lastName && <span style={{ display: 'block' }}>{lastName}</span>}
                </>
              );
            })()}
          </h1>
        </div>

        {/* Contact Info */}
        <div style={{ marginBottom: '28px' }}>
          <SidebarHeader fontFamily={fonts.heading}>Contact</SidebarHeader>
          <div style={{ fontSize: '9pt', lineHeight: '1.6' }}>
            {contactInfo.phone && <div style={{ marginBottom: '6px' }}>{contactInfo.phone}</div>}
            {contactInfo.email && (
              <div style={{ marginBottom: '6px', wordBreak: 'break-all' }}>{contactInfo.email}</div>
            )}
            {contactInfo.location && (
              <div style={{ marginBottom: '6px' }}>{contactInfo.location}</div>
            )}
            {contactInfo.linkedin && (
              <div style={{ marginBottom: '6px', wordBreak: 'break-all' }}>
                {contactInfo.linkedin}
              </div>
            )}
            {contactInfo.github && (
              <div style={{ marginBottom: '6px', wordBreak: 'break-all' }}>
                {contactInfo.github}
              </div>
            )}
            {contactInfo.website && (
              <div style={{ wordBreak: 'break-all' }}>{contactInfo.website}</div>
            )}
          </div>
        </div>

        {/* Skills in sidebar */}
        {skills && skills.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            <SidebarHeader fontFamily={fonts.heading}>Skills</SidebarHeader>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {skills.map((skill, idx) => (
                <li
                  key={idx}
                  style={{
                    fontSize: '9pt',
                    lineHeight: '1.5',
                    marginBottom: '4px',
                    paddingLeft: '8px',
                    borderLeft: '2px solid rgba(255, 255, 255, 0.4)',
                  }}
                >
                  {skill}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Education in sidebar (if short) */}
        {education && education.length > 0 && education.length <= 2 && (
          <div>
            <SidebarHeader fontFamily={fonts.heading}>Education</SidebarHeader>
            {education.map((edu) => (
              <div key={edu.id} style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '10pt', fontWeight: 600, marginBottom: '2px' }}>
                  {edu.degree}
                </div>
                <div style={{ fontSize: '9pt', marginBottom: '2px' }}>{edu.field}</div>
                <div style={{ fontSize: '9pt', opacity: 0.8 }}>{edu.school}</div>
                <div style={{ fontSize: '8pt', opacity: 0.7 }}>{edu.endYear}</div>
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main
        style={{
          flex: 1,
          padding: '0.6in',
        }}
      >
        {/* Summary */}
        {summary && summary.trim() && (
          <section style={{ marginBottom: '20px' }}>
            <MainHeader fontFamily={fonts.heading} color={config.accentColor}>
              Professional Summary
            </MainHeader>
            <SummaryText text={summary} config={config} />
          </section>
        )}

        {/* Experience */}
        {experience && experience.length > 0 && (
          <section style={{ marginBottom: '20px' }}>
            <MainHeader fontFamily={fonts.heading} color={config.accentColor}>
              Experience
            </MainHeader>
            {experience.map((exp, index) => (
              <ExperienceItem key={exp.id} experience={exp} config={config} isFirst={index === 0} />
            ))}
          </section>
        )}

        {/* Education (if more than 2, put in main) */}
        {education && education.length > 2 && (
          <section style={{ marginBottom: '20px' }}>
            <MainHeader fontFamily={fonts.heading} color={config.accentColor}>
              Education
            </MainHeader>
            {education.map((edu, index) => (
              <EducationItem key={edu.id} education={edu} config={config} isFirst={index === 0} />
            ))}
          </section>
        )}

        {/* Projects */}
        {projects && projects.length > 0 && (
          <section style={{ marginBottom: '20px' }}>
            <MainHeader fontFamily={fonts.heading} color={config.accentColor}>
              Projects
            </MainHeader>
            {projects.map((project, index) => (
              <ProjectItem
                key={project.id}
                project={project}
                config={config}
                isFirst={index === 0}
              />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
