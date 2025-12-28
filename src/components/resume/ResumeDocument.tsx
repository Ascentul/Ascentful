/**
 * ResumeDocument Component
 *
 * SINGLE SOURCE OF TRUTH for resume layout and styling.
 *
 * This component is used for:
 * 1. In-app preview (renders as React/HTML)
 * 2. PDF export (structure mirrored in resume-pdf-generator.ts)
 *
 * Any layout or styling changes MUST be made here and reflected in the PDF generator
 * to ensure preview and export remain visually identical.
 *
 * Design principles:
 * - ATS-friendly: Single column, simple structure, no complex layouts
 * - Professional: Clean typography, comfortable spacing, minimal color
 * - Readable: Good contrast, clear hierarchy, proper line-height
 * - Brand-aligned: Uses #5371FF as primary accent color
 */

import React from 'react';

import { formatDateRange, parseDescription } from '@/lib/resume-utils';

export interface ContactInfo {
  name: string;
  email: string;
  phone: string;
  location: string;
  country?: string;
  postalCode?: string;
  photoUrl?: string;
  linkedin?: string;
  github?: string;
  website?: string;
}

export interface Experience {
  id: string;
  title: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
  // New format fields
  summary?: string;
  keyContributions?: string[];
}

export interface Education {
  id: string;
  school: string;
  degree: string;
  field: string;
  location: string;
  startYear: string;
  endYear: string;
  gpa?: string;
  honors?: string;
}

export interface Project {
  id: string;
  name: string;
  role: string;
  description: string;
  technologies: string;
  url?: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  date: string;
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  date: string;
  expirationDate?: string;
  credentialId?: string;
  url?: string;
}

export interface ResumeData {
  contactInfo: ContactInfo;
  summary?: string;
  skills?: string[];
  experience?: Experience[];
  education?: Education[];
  projects?: Project[];
  achievements?: Achievement[];
  certifications?: Certification[];
}

interface ResumeDocumentProps {
  data: ResumeData;
  className?: string;
}

// Color constants (brand-aligned)
const COLORS = {
  PRIMARY_ACCENT: '#5371FF',
  BLACK: '#000000',
  DARK_GRAY: '#2D3748',
  GRAY: '#4A5568',
  LIGHT_GRAY: '#718096',
  SUBTLE_ACCENT: 'rgba(83, 113, 255, 0.3)',
};

// Typography constants
const FONT_SIZES = {
  name: '20pt',
  sectionHeading: '13pt',
  company: '12pt',
  body: '11pt',
  small: '10pt',
};

export const ResumeDocument: React.FC<ResumeDocumentProps> = ({ data, className = '' }) => {
  const {
    contactInfo,
    summary,
    skills,
    experience,
    education,
    projects,
    achievements,
    certifications,
  } = data;

  return (
    <div
      className={`resume-document bg-white ${className}`}
      style={{
        maxWidth: '8.5in',
        minHeight: '11in',
        margin: '0 auto',
        padding: '0.7in',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: FONT_SIZES.body,
        lineHeight: '1.3',
        color: COLORS.BLACK,
      }}
    >
      {/* Header - Contact Information with Strip Design */}
      <header
        style={{
          paddingTop: '8px',
          paddingBottom: '12px',
          marginBottom: '24px',
          borderBottom: `1px solid ${COLORS.PRIMARY_ACCENT}`,
        }}
      >
        <h1
          className="text-center mb-2"
          style={{
            fontSize: FONT_SIZES.name,
            fontWeight: 700,
            lineHeight: '1.2',
            color: COLORS.BLACK,
          }}
        >
          {contactInfo.name}
        </h1>
        <div
          className="text-center"
          style={{
            fontSize: FONT_SIZES.small,
            color: COLORS.LIGHT_GRAY,
            lineHeight: '1.2',
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

      {/* Summary Section */}
      {summary && summary.trim() && (
        <section style={{ marginTop: '16px', marginBottom: '16px' }}>
          <h2
            className="font-bold uppercase tracking-wide"
            style={{
              fontSize: FONT_SIZES.sectionHeading,
              color: COLORS.PRIMARY_ACCENT,
              marginBottom: '8px',
              paddingBottom: '4px',
              borderBottom: `1px solid ${COLORS.SUBTLE_ACCENT}`,
            }}
          >
            Professional Summary
          </h2>
          <p className="text-justify" style={{ fontSize: FONT_SIZES.body }}>
            {summary}
          </p>
        </section>
      )}

      {/* Skills Section */}
      {skills && skills.length > 0 && (
        <section style={{ marginTop: '16px', marginBottom: '16px' }}>
          <h2
            className="font-bold uppercase tracking-wide"
            style={{
              fontSize: FONT_SIZES.sectionHeading,
              color: COLORS.PRIMARY_ACCENT,
              marginBottom: '8px',
              paddingBottom: '4px',
              borderBottom: `1px solid ${COLORS.SUBTLE_ACCENT}`,
            }}
          >
            Skills
          </h2>
          <p style={{ fontSize: FONT_SIZES.body }}>{skills.join(', ')}</p>
        </section>
      )}

      {/* Experience Section */}
      {experience && experience.length > 0 && (
        <section style={{ marginTop: '16px', marginBottom: '16px' }}>
          <h2
            className="font-bold uppercase tracking-wide"
            style={{
              fontSize: FONT_SIZES.sectionHeading,
              color: COLORS.PRIMARY_ACCENT,
              marginBottom: '8px',
              paddingBottom: '4px',
              borderBottom: `1px solid ${COLORS.SUBTLE_ACCENT}`,
            }}
          >
            Experience
          </h2>
          {experience.map((exp, index) => {
            const bullets = parseDescription(exp.description);

            return (
              <div key={exp.id} style={{ marginTop: index > 0 ? '12px' : '0' }}>
                {/* Company and Date - Flex Layout */}
                <div
                  className="flex justify-between items-baseline gap-2"
                  style={{ marginBottom: '4px' }}
                >
                  <div className="flex items-baseline gap-2">
                    <span
                      style={{ fontSize: FONT_SIZES.company, fontWeight: 700, color: COLORS.BLACK }}
                    >
                      {exp.company}
                    </span>
                    {exp.location && (
                      <span style={{ fontSize: FONT_SIZES.small, color: COLORS.LIGHT_GRAY }}>
                        {exp.location}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: FONT_SIZES.small,
                      color: COLORS.LIGHT_GRAY,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatDateRange(exp.startDate, exp.endDate, exp.current)}
                  </span>
                </div>

                {/* Role */}
                <div
                  style={{
                    fontSize: FONT_SIZES.body,
                    fontWeight: 600,
                    color: COLORS.GRAY,
                    marginBottom: '4px',
                  }}
                >
                  {exp.title}
                </div>

                {/* Summary paragraph (new format) */}
                {exp.summary && (
                  <p style={{ fontSize: FONT_SIZES.body, marginTop: '4px', marginBottom: '4px' }}>
                    {exp.summary}
                  </p>
                )}

                {/* Key Contributions (new format) */}
                {exp.keyContributions && exp.keyContributions.length > 0 && (
                  <div style={{ marginTop: '4px' }}>
                    <div
                      style={{
                        fontSize: FONT_SIZES.small,
                        fontWeight: 600,
                        color: COLORS.DARK_GRAY,
                        marginBottom: '4px',
                      }}
                    >
                      Key Contributions
                    </div>
                    <ul
                      style={{
                        listStyleType: 'disc',
                        listStylePosition: 'outside',
                        paddingLeft: '20px',
                      }}
                    >
                      {exp.keyContributions.map((contribution, idx) => (
                        <li
                          key={idx}
                          style={{
                            fontSize: FONT_SIZES.body,
                            lineHeight: '1.3',
                            marginBottom: '4px',
                          }}
                        >
                          {contribution}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Description Bullets (fallback for old format) */}
                {!exp.summary && !exp.keyContributions && bullets.length > 0 && (
                  <ul
                    style={{
                      listStyleType: 'disc',
                      listStylePosition: 'outside',
                      paddingLeft: '20px',
                      marginTop: '4px',
                    }}
                  >
                    {bullets.map((bullet, idx) => (
                      <li
                        key={idx}
                        style={{
                          fontSize: FONT_SIZES.body,
                          lineHeight: '1.3',
                          marginBottom: '4px',
                        }}
                      >
                        {bullet}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Education Section */}
      {education && education.length > 0 && (
        <section style={{ marginTop: '16px', marginBottom: '16px' }}>
          <h2
            className="font-bold uppercase tracking-wide"
            style={{
              fontSize: FONT_SIZES.sectionHeading,
              color: COLORS.PRIMARY_ACCENT,
              marginBottom: '8px',
              paddingBottom: '4px',
              borderBottom: `1px solid ${COLORS.SUBTLE_ACCENT}`,
            }}
          >
            Education
          </h2>
          {education.map((edu, index) => (
            <div key={edu.id} style={{ marginTop: index > 0 ? '12px' : '0' }}>
              {/* School and Dates */}
              <div
                className="flex justify-between items-baseline gap-2"
                style={{ marginBottom: '4px' }}
              >
                <span
                  style={{ fontSize: FONT_SIZES.company, fontWeight: 700, color: COLORS.BLACK }}
                >
                  {edu.school}
                </span>
                <span
                  style={{
                    fontSize: FONT_SIZES.small,
                    color: COLORS.LIGHT_GRAY,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {edu.startYear && edu.endYear
                    ? `${edu.startYear} - ${edu.endYear}`
                    : edu.endYear || ''}
                </span>
              </div>

              {/* Degree and Field */}
              <div style={{ fontSize: FONT_SIZES.body }}>
                {edu.degree && edu.field
                  ? `${edu.degree} in ${edu.field}`
                  : edu.degree || edu.field || ''}
              </div>

              {/* Location */}
              {edu.location && (
                <div style={{ fontSize: FONT_SIZES.small, color: COLORS.LIGHT_GRAY }}>
                  {edu.location}
                </div>
              )}

              {/* GPA and Honors */}
              {(edu.gpa || edu.honors) && (
                <div style={{ fontSize: FONT_SIZES.small, color: COLORS.GRAY, marginTop: '4px' }}>
                  {[edu.gpa && `GPA: ${edu.gpa}`, edu.honors].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Projects Section */}
      {projects && projects.length > 0 && (
        <section style={{ marginTop: '16px', marginBottom: '16px' }}>
          <h2
            className="font-bold uppercase tracking-wide"
            style={{
              fontSize: FONT_SIZES.sectionHeading,
              color: COLORS.PRIMARY_ACCENT,
              marginBottom: '8px',
              paddingBottom: '4px',
              borderBottom: `1px solid ${COLORS.SUBTLE_ACCENT}`,
            }}
          >
            Projects
          </h2>
          {projects.map((project, index) => {
            const bullets = parseDescription(project.description);

            return (
              <div key={project.id} style={{ marginTop: index > 0 ? '12px' : '0' }}>
                {/* Project Name and Role */}
                <div style={{ marginBottom: '4px' }}>
                  <span
                    style={{ fontSize: FONT_SIZES.company, fontWeight: 700, color: COLORS.BLACK }}
                  >
                    {project.name}
                  </span>
                  {project.role && (
                    <span
                      style={{
                        fontSize: FONT_SIZES.small,
                        fontStyle: 'italic',
                        color: COLORS.GRAY,
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
                      fontSize: FONT_SIZES.small,
                      color: COLORS.LIGHT_GRAY,
                      marginBottom: '4px',
                    }}
                  >
                    Technologies: {project.technologies}
                  </div>
                )}

                {/* URL */}
                {project.url && /^https?:\/\//i.test(project.url) && (
                  <div style={{ fontSize: FONT_SIZES.small, marginBottom: '4px' }}>
                    <a
                      href={project.url}
                      style={{ color: COLORS.PRIMARY_ACCENT, textDecoration: 'underline' }}
                    >
                      {project.url}
                    </a>
                  </div>
                )}

                {/* Description */}
                {bullets.length > 0 && (
                  <ul
                    style={{
                      listStyleType: 'disc',
                      listStylePosition: 'outside',
                      paddingLeft: '20px',
                      marginTop: '4px',
                    }}
                  >
                    {bullets.map((bullet, idx) => (
                      <li
                        key={idx}
                        style={{
                          fontSize: FONT_SIZES.body,
                          lineHeight: '1.3',
                          marginBottom: '4px',
                        }}
                      >
                        {bullet}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Achievements Section */}
      {achievements && achievements.length > 0 && (
        <section style={{ marginTop: '16px', marginBottom: '16px' }}>
          <h2
            className="font-bold uppercase tracking-wide"
            style={{
              fontSize: FONT_SIZES.sectionHeading,
              color: COLORS.PRIMARY_ACCENT,
              marginBottom: '8px',
              paddingBottom: '4px',
              borderBottom: `1px solid ${COLORS.SUBTLE_ACCENT}`,
            }}
          >
            Achievements
          </h2>
          <ul
            style={{
              listStyleType: 'disc',
              listStylePosition: 'outside',
              paddingLeft: '20px',
              marginTop: '4px',
            }}
          >
            {achievements.map((achievement) => (
              <li
                key={achievement.id}
                style={{
                  fontSize: FONT_SIZES.body,
                  lineHeight: '1.3',
                  marginBottom: '8px',
                }}
              >
                <span style={{ fontWeight: 600 }}>{achievement.title}</span>
                {achievement.date && (
                  <span
                    style={{
                      fontSize: FONT_SIZES.small,
                      color: COLORS.LIGHT_GRAY,
                      marginLeft: '8px',
                    }}
                  >
                    ({achievement.date})
                  </span>
                )}
                {achievement.description && (
                  <span className="block" style={{ marginTop: '4px' }}>
                    {achievement.description}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Certifications Section */}
      {certifications && certifications.length > 0 && (
        <section style={{ marginTop: '16px', marginBottom: '16px' }}>
          <h2
            className="font-bold uppercase tracking-wide"
            style={{
              fontSize: FONT_SIZES.sectionHeading,
              color: COLORS.PRIMARY_ACCENT,
              marginBottom: '8px',
              paddingBottom: '4px',
              borderBottom: `1px solid ${COLORS.SUBTLE_ACCENT}`,
            }}
          >
            Certifications
          </h2>
          {certifications.map((cert, index) => (
            <div key={cert.id} style={{ marginTop: index > 0 ? '12px' : '0' }}>
              {/* Certification Name and Date */}
              <div
                className="flex justify-between items-baseline gap-2"
                style={{ marginBottom: '4px' }}
              >
                <span
                  style={{ fontSize: FONT_SIZES.company, fontWeight: 700, color: COLORS.BLACK }}
                >
                  {cert.name}
                </span>
                <span
                  style={{
                    fontSize: FONT_SIZES.small,
                    color: COLORS.LIGHT_GRAY,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cert.date}
                  {cert.expirationDate && ` - ${cert.expirationDate}`}
                </span>
              </div>

              {/* Issuer */}
              <div style={{ fontSize: FONT_SIZES.body, color: COLORS.GRAY }}>{cert.issuer}</div>

              {/* Credential ID and URL */}
              {(cert.credentialId || cert.url) && (
                <div
                  style={{ fontSize: FONT_SIZES.small, color: COLORS.LIGHT_GRAY, marginTop: '4px' }}
                >
                  {cert.credentialId && <span>Credential ID: {cert.credentialId}</span>}
                  {cert.credentialId && cert.url && /^https?:\/\//i.test(cert.url) && (
                    <span> · </span>
                  )}
                  {cert.url && /^https?:\/\//i.test(cert.url) && (
                    <a
                      href={cert.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: COLORS.PRIMARY_ACCENT, textDecoration: 'underline' }}
                    >
                      View Certificate
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
};
