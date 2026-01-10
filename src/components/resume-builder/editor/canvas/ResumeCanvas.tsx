'use client';

import { Copy, Plus, Trash2 } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  Achievement,
  Certification,
  Education,
  Experience,
  Project,
  ResumeData,
} from '@/components/resume/ResumeDocument';
import type { StyleConfig, TemplateId } from '@/components/resume-builder/templates/types';
import {
  DEFAULT_SIDEBAR_BG_COLOR,
  FONT_PAIRINGS,
  TEMPLATE_LAYOUTS,
} from '@/components/resume-builder/templates/types';
import type { Suggestion as AISuggestion } from '@/lib/ai/schemas';
import { bulletPointsToDescription, parseBulletPoints } from '@/lib/resume-editor/span-utils';
import { cn } from '@/lib/utils';
import type { Suggestion } from '@/types/resume-editor';

import type { EditorMode } from '../EditorTopBar';
import { BulletEditable, InlineEditableText } from './InlineEditableText';

// ============================================================================
// Entry Toolbar - Add/Duplicate/Delete buttons for entries
// ============================================================================

interface EntryToolbarProps {
  onAdd: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  canDelete?: boolean;
  className?: string;
}

function EntryToolbar({
  onAdd,
  onDuplicate,
  onDelete,
  canDelete = true,
  className,
}: EntryToolbarProps) {
  return (
    <div
      className={cn(
        'absolute -right-2 top-0 flex flex-col gap-0.5 opacity-0 group-hover/entry:opacity-100 transition-opacity',
        'bg-white rounded-lg shadow-lg border border-slate-200 p-0.5',
        className,
      )}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-primary-600 transition-colors"
        title="Add new entry"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDuplicate();
        }}
        className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-primary-600 transition-colors"
        title="Duplicate entry"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
      {canDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1.5 rounded hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors"
          title="Delete entry"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

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
  onUpdateProjects: (projects: Project[]) => void;
  onUpdateSkills: (skills: string[]) => void;
  onUpdateAchievements?: (achievements: Achievement[]) => void;
  onUpdateCertifications?: (certifications: Certification[]) => void;
  // Selection state from outline panel
  selectedSectionId?: string | null;
  selectedItemId?: string | null;
  // Missing field spanIds for form validation-style highlighting
  missingSpanIds?: Set<string>;
  // Editor/Review mode toggle
  editorMode?: EditorMode;
  aiSuggestions?: AISuggestion[];
  // Bidirectional linking - highlight track changes for focused suggestion
  focusedSuggestionId?: string | null;
  onTrackChangeClick?: (suggestionId: string) => void;
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
  onUpdateProjects,
  onUpdateSkills,
  onUpdateAchievements,
  onUpdateCertifications,
  selectedSectionId,
  selectedItemId,
  missingSpanIds,
  editorMode = 'editor',
  aiSuggestions,
  focusedSuggestionId,
  onTrackChangeClick,
}: ResumeCanvasProps) {
  // Get template-specific layout configuration
  const templateConfig = TEMPLATE_LAYOUTS[templateId] ?? TEMPLATE_LAYOUTS.modern;
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
  const sidebarBgColor = styleConfig.sidebar_bg_color || DEFAULT_SIDEBAR_BG_COLOR;

  // Helper to determine if sidebar background is dark (for text contrast)
  const isSidebarDark = (() => {
    let hex = sidebarBgColor.replace('#', '');
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((char) => char + char)
        .join('');
    }
    if (hex.length !== 6) return false;
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return false;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  })();

  // Build CSS variables
  const cssVars = {
    '--font-heading': fontPairing.heading,
    '--font-body': fontPairing.body,
    '--color-accent': accentColor,
  } as CSSProperties;

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

    const isSectionSelected = selectedSectionId === sectionId && !selectedItemId;

    switch (sectionId) {
      case 'summary':
        return (
          <section
            key={sectionId}
            className={cn(
              isCompact ? 'mb-4' : 'mb-6',
              isSectionSelected && 'ring-2 ring-primary-400 ring-offset-4 rounded',
            )}
            style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
          >
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
              placeholder={
                missingSpanIds?.has('summary-text')
                  ? 'Write 2-3 sentences about your experience and career goals...'
                  : 'Write a compelling summary of your professional background...'
              }
              className="text-[11pt] leading-relaxed"
              isMissing={missingSpanIds?.has('summary-text')}
              editorMode={editorMode}
              aiSuggestions={aiSuggestions}
              focusedSuggestionId={focusedSuggestionId}
              onTrackChangeClick={onTrackChangeClick}
            />
          </section>
        );

      case 'experience': {
        // Pre-populate with empty entry if none exist
        const experiences =
          data.experience && data.experience.length > 0
            ? data.experience
            : [
                {
                  id: 'exp-empty',
                  title: '',
                  company: '',
                  location: '',
                  startDate: '',
                  endDate: '',
                  current: false,
                  description: '',
                },
              ];

        const isPlaceholder = experiences.length === 1 && experiences[0].id === 'exp-empty';

        return (
          <section
            key={sectionId}
            className={cn(
              isCompact ? 'mb-4' : 'mb-6',
              isSectionSelected && 'ring-2 ring-primary-400 ring-offset-4 rounded',
            )}
            style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
          >
            <h2 className={sectionHeadingClass} style={getSectionHeadingStyle()}>
              Work Experience
            </h2>
            <div className="space-y-4">
              {experiences.map((item, index) => (
                <ExperienceEntry
                  key={item.id}
                  experience={item}
                  suggestions={suggestions}
                  coachEnabled={coachEnabled}
                  accentColor={accentColor}
                  isSelected={selectedSectionId === sectionId && selectedItemId === item.id}
                  missingSpanIds={missingSpanIds}
                  editorMode={editorMode}
                  aiSuggestions={aiSuggestions}
                  focusedSuggestionId={focusedSuggestionId}
                  onTrackChangeClick={onTrackChangeClick}
                  onChange={(updated) => {
                    // If editing the placeholder entry, add it to real data
                    if (item.id === 'exp-empty') {
                      const newExp = { ...updated, id: `exp-${crypto.randomUUID()}` };
                      onUpdateExperience([newExp]);
                    } else {
                      const newExperiences = (data.experience || []).map((e) =>
                        e.id === item.id ? updated : e,
                      );
                      onUpdateExperience(newExperiences);
                    }
                  }}
                  onAdd={() => {
                    const currentExps = isPlaceholder ? [] : data.experience || [];
                    const newExp: Experience = {
                      id: `exp-${crypto.randomUUID()}`,
                      title: '',
                      company: '',
                      location: '',
                      startDate: '',
                      endDate: '',
                      current: false,
                      description: '',
                    };
                    // Insert after current item
                    const newExperiences = [
                      ...currentExps.slice(0, index + 1),
                      newExp,
                      ...currentExps.slice(index + 1),
                    ];
                    onUpdateExperience(newExperiences);
                  }}
                  onDuplicate={() => {
                    if (isPlaceholder) return;
                    const duplicated: Experience = {
                      ...item,
                      id: `exp-${crypto.randomUUID()}`,
                    };
                    const currentExps = data.experience || [];
                    const newExperiences = [
                      ...currentExps.slice(0, index + 1),
                      duplicated,
                      ...currentExps.slice(index + 1),
                    ];
                    onUpdateExperience(newExperiences);
                  }}
                  onDelete={() => {
                    if (isPlaceholder) return;
                    const currentExps = data.experience || [];
                    const newExperiences = currentExps.filter((_, i) => i !== index);
                    onUpdateExperience(newExperiences);
                  }}
                  canDelete={!isPlaceholder && experiences.length > 1}
                />
              ))}
            </div>
          </section>
        );
      }

      case 'education': {
        // Pre-populate with empty entry if none exist
        const educationItems =
          data.education && data.education.length > 0
            ? data.education
            : [
                {
                  id: 'edu-empty',
                  school: '',
                  degree: '',
                  field: '',
                  location: '',
                  startYear: '',
                  endYear: '',
                },
              ];

        const isEduPlaceholder =
          educationItems.length === 1 && educationItems[0].id === 'edu-empty';

        return (
          <section
            key={sectionId}
            className={cn(
              isCompact ? 'mb-4' : 'mb-6',
              isSectionSelected && 'ring-2 ring-primary-400 ring-offset-4 rounded',
            )}
            style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
          >
            <h2 className={sectionHeadingClass} style={getSectionHeadingStyle()}>
              Education
            </h2>
            <div className="space-y-3">
              {educationItems.map((item, index) => (
                <EducationEntry
                  key={item.id}
                  education={item}
                  suggestions={suggestions}
                  coachEnabled={coachEnabled}
                  isSelected={selectedSectionId === sectionId && selectedItemId === item.id}
                  missingSpanIds={missingSpanIds}
                  editorMode={editorMode}
                  aiSuggestions={aiSuggestions}
                  focusedSuggestionId={focusedSuggestionId}
                  onTrackChangeClick={onTrackChangeClick}
                  onChange={(updated) => {
                    // If editing the placeholder entry, add it to real data
                    if (item.id === 'edu-empty') {
                      const newEdu = { ...updated, id: `edu-${crypto.randomUUID()}` };
                      onUpdateEducation([newEdu]);
                    } else {
                      const newEducation = (data.education || []).map((e) =>
                        e.id === item.id ? updated : e,
                      );
                      onUpdateEducation(newEducation);
                    }
                  }}
                  onAdd={() => {
                    const currentEdus = isEduPlaceholder ? [] : data.education || [];
                    const newEdu: Education = {
                      id: `edu-${crypto.randomUUID()}`,
                      school: '',
                      degree: '',
                      field: '',
                      location: '',
                      startYear: '',
                      endYear: '',
                    };
                    const newEducation = [
                      ...currentEdus.slice(0, index + 1),
                      newEdu,
                      ...currentEdus.slice(index + 1),
                    ];
                    onUpdateEducation(newEducation);
                  }}
                  onDuplicate={() => {
                    if (isEduPlaceholder) return;
                    const duplicated: Education = {
                      ...item,
                      id: `edu-${crypto.randomUUID()}`,
                    };
                    const currentEdus = data.education || [];
                    const newEducation = [
                      ...currentEdus.slice(0, index + 1),
                      duplicated,
                      ...currentEdus.slice(index + 1),
                    ];
                    onUpdateEducation(newEducation);
                  }}
                  onDelete={() => {
                    if (isEduPlaceholder) return;
                    const currentEdus = data.education || [];
                    const newEducation = currentEdus.filter((_, i) => i !== index);
                    onUpdateEducation(newEducation);
                  }}
                  canDelete={!isEduPlaceholder && educationItems.length > 1}
                />
              ))}
            </div>
          </section>
        );
      }

      case 'skills':
        return (
          <section
            key={sectionId}
            className={cn(
              isCompact ? 'mb-4' : 'mb-6',
              isSectionSelected && 'ring-2 ring-primary-400 ring-offset-4 rounded',
            )}
            style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
          >
            <h2 className={sectionHeadingClass} style={getSectionHeadingStyle()}>
              Skills
            </h2>
            <SkillsEditor
              skills={data.skills || []}
              suggestions={suggestions}
              coachEnabled={coachEnabled}
              onChange={onUpdateSkills}
            />
          </section>
        );

      case 'projects': {
        // Pre-populate with empty entry if none exist
        const projects =
          data.projects && data.projects.length > 0
            ? data.projects
            : [{ id: 'proj-empty', name: '', role: '', description: '', technologies: '' }];

        const isProjPlaceholder = projects.length === 1 && projects[0].id === 'proj-empty';

        return (
          <section
            key={sectionId}
            className={cn(
              isCompact ? 'mb-4' : 'mb-6',
              isSectionSelected && 'ring-2 ring-primary-400 ring-offset-4 rounded',
            )}
            style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
          >
            <h2 className={sectionHeadingClass} style={getSectionHeadingStyle()}>
              Projects
            </h2>
            <div className="space-y-3">
              {projects.map((item, index) => (
                <ProjectEntry
                  key={item.id}
                  project={item}
                  suggestions={suggestions}
                  coachEnabled={coachEnabled}
                  isSelected={selectedSectionId === sectionId && selectedItemId === item.id}
                  editorMode={editorMode}
                  aiSuggestions={aiSuggestions}
                  focusedSuggestionId={focusedSuggestionId}
                  onTrackChangeClick={onTrackChangeClick}
                  onChange={(updated) => {
                    // If editing the placeholder entry, add it to real data
                    if (item.id === 'proj-empty') {
                      const newProj = { ...updated, id: `proj-${crypto.randomUUID()}` };
                      onUpdateProjects([newProj]);
                    } else {
                      const newProjects = (data.projects || []).map((p) =>
                        p.id === item.id ? updated : p,
                      );
                      onUpdateProjects(newProjects);
                    }
                  }}
                  onAdd={() => {
                    const currentProjs = isProjPlaceholder ? [] : data.projects || [];
                    const newProj: Project = {
                      id: `proj-${crypto.randomUUID()}`,
                      name: '',
                      role: '',
                      description: '',
                      technologies: '',
                    };
                    const newProjects = [
                      ...currentProjs.slice(0, index + 1),
                      newProj,
                      ...currentProjs.slice(index + 1),
                    ];
                    onUpdateProjects(newProjects);
                  }}
                  onDuplicate={() => {
                    if (isProjPlaceholder) return;
                    const duplicated: Project = {
                      ...item,
                      id: `proj-${crypto.randomUUID()}`,
                    };
                    const currentProjs = data.projects || [];
                    const newProjects = [
                      ...currentProjs.slice(0, index + 1),
                      duplicated,
                      ...currentProjs.slice(index + 1),
                    ];
                    onUpdateProjects(newProjects);
                  }}
                  onDelete={() => {
                    if (isProjPlaceholder) return;
                    const currentProjs = data.projects || [];
                    const newProjects = currentProjs.filter((_, i) => i !== index);
                    onUpdateProjects(newProjects);
                  }}
                  canDelete={!isProjPlaceholder && projects.length > 1}
                />
              ))}
            </div>
          </section>
        );
      }

      case 'achievements': {
        if (!onUpdateAchievements) return null;
        // Pre-populate with empty entry if none exist
        const achievements =
          data.achievements && data.achievements.length > 0
            ? data.achievements
            : [{ id: 'ach-empty', title: '', description: '', date: '' }];

        const isAchPlaceholder = achievements.length === 1 && achievements[0].id === 'ach-empty';

        return (
          <section
            key={sectionId}
            className={cn(
              isCompact ? 'mb-4' : 'mb-6',
              isSectionSelected && 'ring-2 ring-primary-400 ring-offset-4 rounded',
            )}
            style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
          >
            <h2 className={sectionHeadingClass} style={getSectionHeadingStyle()}>
              Achievements
            </h2>
            <div className="space-y-3">
              {achievements.map((item, index) => (
                <AchievementEntry
                  key={item.id}
                  achievement={item}
                  suggestions={suggestions}
                  coachEnabled={coachEnabled}
                  isSelected={selectedSectionId === sectionId && selectedItemId === item.id}
                  missingSpanIds={missingSpanIds}
                  editorMode={editorMode}
                  aiSuggestions={aiSuggestions}
                  focusedSuggestionId={focusedSuggestionId}
                  onTrackChangeClick={onTrackChangeClick}
                  onChange={(updated) => {
                    // If editing the placeholder entry, add it to real data
                    if (item.id === 'ach-empty') {
                      const newAch = { ...updated, id: `ach-${crypto.randomUUID()}` };
                      onUpdateAchievements?.([newAch]);
                    } else {
                      const newAchievements = (data.achievements || []).map((a) =>
                        a.id === item.id ? updated : a,
                      );
                      onUpdateAchievements?.(newAchievements);
                    }
                  }}
                  onAdd={() => {
                    if (!onUpdateAchievements) return;
                    const currentAchs = isAchPlaceholder ? [] : data.achievements || [];
                    const newAch: Achievement = {
                      id: `ach-${crypto.randomUUID()}`,
                      title: '',
                      description: '',
                      date: '',
                    };
                    const newAchievements = [
                      ...currentAchs.slice(0, index + 1),
                      newAch,
                      ...currentAchs.slice(index + 1),
                    ];
                    onUpdateAchievements(newAchievements);
                  }}
                  onDuplicate={() => {
                    if (!onUpdateAchievements || isAchPlaceholder) return;
                    const duplicated: Achievement = {
                      ...item,
                      id: `ach-${crypto.randomUUID()}`,
                    };
                    const currentAchs = data.achievements || [];
                    const newAchievements = [
                      ...currentAchs.slice(0, index + 1),
                      duplicated,
                      ...currentAchs.slice(index + 1),
                    ];
                    onUpdateAchievements(newAchievements);
                  }}
                  onDelete={() => {
                    if (!onUpdateAchievements || isAchPlaceholder) return;
                    const currentAchs = data.achievements || [];
                    const newAchievements = currentAchs.filter((_, i) => i !== index);
                    onUpdateAchievements(newAchievements);
                  }}
                  canDelete={!isAchPlaceholder && achievements.length > 1}
                />
              ))}
            </div>
          </section>
        );
      }

      case 'certifications': {
        if (!onUpdateCertifications) return null;
        // Pre-populate with empty entry if none exist
        const certifications =
          data.certifications && data.certifications.length > 0
            ? data.certifications
            : [{ id: 'cert-empty', name: '', issuer: '', date: '' }];

        const isCertPlaceholder =
          certifications.length === 1 && certifications[0].id === 'cert-empty';

        return (
          <section
            key={sectionId}
            className={cn(
              isCompact ? 'mb-4' : 'mb-6',
              isSectionSelected && 'ring-2 ring-primary-400 ring-offset-4 rounded',
            )}
            style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
          >
            <h2 className={sectionHeadingClass} style={getSectionHeadingStyle()}>
              Awards & Certifications
            </h2>
            <div className="space-y-3">
              {certifications.map((item, index) => (
                <CertificationEntry
                  key={item.id}
                  certification={item}
                  suggestions={suggestions}
                  coachEnabled={coachEnabled}
                  accentColor={accentColor}
                  isSelected={selectedSectionId === sectionId && selectedItemId === item.id}
                  missingSpanIds={missingSpanIds}
                  editorMode={editorMode}
                  aiSuggestions={aiSuggestions}
                  focusedSuggestionId={focusedSuggestionId}
                  onTrackChangeClick={onTrackChangeClick}
                  onChange={(updated) => {
                    // If editing the placeholder entry, add it to real data
                    if (item.id === 'cert-empty') {
                      const newCert = { ...updated, id: `cert-${crypto.randomUUID()}` };
                      onUpdateCertifications?.([newCert]);
                    } else {
                      const newCertifications = (data.certifications || []).map((c) =>
                        c.id === item.id ? updated : c,
                      );
                      onUpdateCertifications?.(newCertifications);
                    }
                  }}
                  onAdd={() => {
                    if (!onUpdateCertifications) return;
                    const currentCerts = isCertPlaceholder ? [] : data.certifications || [];
                    const newCert: Certification = {
                      id: `cert-${crypto.randomUUID()}`,
                      name: '',
                      issuer: '',
                      date: '',
                    };
                    const newCertifications = [
                      ...currentCerts.slice(0, index + 1),
                      newCert,
                      ...currentCerts.slice(index + 1),
                    ];
                    onUpdateCertifications(newCertifications);
                  }}
                  onDuplicate={() => {
                    if (!onUpdateCertifications || isCertPlaceholder) return;
                    const duplicated: Certification = {
                      ...item,
                      id: `cert-${crypto.randomUUID()}`,
                    };
                    const currentCerts = data.certifications || [];
                    const newCertifications = [
                      ...currentCerts.slice(0, index + 1),
                      duplicated,
                      ...currentCerts.slice(index + 1),
                    ];
                    onUpdateCertifications(newCertifications);
                  }}
                  onDelete={() => {
                    if (!onUpdateCertifications || isCertPlaceholder) return;
                    const currentCerts = data.certifications || [];
                    const newCertifications = currentCerts.filter((_, i) => i !== index);
                    onUpdateCertifications(newCertifications);
                  }}
                  canDelete={!isCertPlaceholder && certifications.length > 1}
                />
              ))}
            </div>
          </section>
        );
      }

      default:
        return null;
    }
  };

  // Render header based on template headerStyle
  const renderHeader = () => {
    // Always show contact fields so users can add missing info
    const contactItems = (
      <>
        <InlineEditableText
          spanId="contact-email"
          value={data.contactInfo.email || ''}
          onChange={(value) => onUpdateContactInfo('email', value)}
          placeholder={
            missingSpanIds?.has('contact-email') ? 'Enter your email address' : 'email@example.com'
          }
          suggestions={suggestions}
          coachEnabled={coachEnabled}
          isMissing={missingSpanIds?.has('contact-email')}
        />
        <InlineEditableText
          spanId="contact-phone"
          value={data.contactInfo.phone || ''}
          onChange={(value) => onUpdateContactInfo('phone', value)}
          placeholder={
            missingSpanIds?.has('contact-phone') ? 'Enter your phone number' : '(555) 123-4567'
          }
          suggestions={suggestions}
          coachEnabled={coachEnabled}
          isMissing={missingSpanIds?.has('contact-phone')}
        />
        <InlineEditableText
          spanId="contact-location"
          value={data.contactInfo.location || ''}
          onChange={(value) => onUpdateContactInfo('location', value)}
          placeholder={
            missingSpanIds?.has('contact-location') ? 'Enter your location' : 'City, State'
          }
          suggestions={suggestions}
          coachEnabled={coachEnabled}
          isMissing={missingSpanIds?.has('contact-location')}
        />
        <InlineEditableText
          spanId="contact-linkedin"
          value={data.contactInfo.linkedin || ''}
          onChange={(value) => onUpdateContactInfo('linkedin', value)}
          placeholder={
            missingSpanIds?.has('contact-linkedin')
              ? 'Enter your LinkedIn URL'
              : 'linkedin.com/in/yourprofile'
          }
          suggestions={suggestions}
          coachEnabled={coachEnabled}
          className="text-blue-600"
          isMissing={missingSpanIds?.has('contact-linkedin')}
        />
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
              placeholder={
                missingSpanIds?.has('contact-name') ? 'Enter your full name' : 'Your Name'
              }
              suggestions={suggestions}
              coachEnabled={coachEnabled}
              className="text-[24pt] font-bold"
              style={{ fontFamily: 'var(--font-heading)', color: 'white' } as CSSProperties}
              isMissing={missingSpanIds?.has('contact-name')}
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
            placeholder={missingSpanIds?.has('contact-name') ? 'Enter your full name' : 'Your Name'}
            suggestions={suggestions}
            coachEnabled={coachEnabled}
            className="text-center text-[20pt] font-bold"
            style={{ fontFamily: 'var(--font-heading)' } as CSSProperties}
            isMissing={missingSpanIds?.has('contact-name')}
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
      <header className="pb-3 mb-6 border-b-2" style={{ borderColor: accentColor }}>
        <InlineEditableText
          spanId="contact-name"
          value={data.contactInfo.name}
          onChange={(value) => onUpdateContactInfo('name', value)}
          placeholder={missingSpanIds?.has('contact-name') ? 'Enter your full name' : 'Your Name'}
          suggestions={suggestions}
          coachEnabled={coachEnabled}
          className={`text-[20pt] font-bold ${isLightFont ? 'font-light' : ''}`}
          style={{ fontFamily: 'var(--font-heading)' } as CSSProperties}
          isMissing={missingSpanIds?.has('contact-name')}
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
        className="font-sans text-[11pt] leading-[1.3] text-slate-900 flex min-h-[11in]"
        style={{
          ...cssVars,
          fontFamily: 'var(--font-body)',
        }}
      >
        {/* Left Sidebar - stretches to full page height */}
        <aside className="w-[30%] p-6 flex-shrink-0" style={{ backgroundColor: sidebarBgColor }}>
          {/* Name in sidebar */}
          <div className="mb-6">
            <InlineEditableText
              spanId="contact-name"
              value={data.contactInfo.name}
              onChange={(value) => onUpdateContactInfo('name', value)}
              placeholder={
                missingSpanIds?.has('contact-name') ? 'Enter your full name' : 'Your Name'
              }
              suggestions={suggestions}
              coachEnabled={coachEnabled}
              className="text-[16pt] font-bold leading-tight"
              style={
                {
                  fontFamily: 'var(--font-heading)',
                  color: sidebarTextColor,
                } as CSSProperties
              }
              isMissing={missingSpanIds?.has('contact-name')}
            />
          </div>

          {/* Contact Section - Always show all fields */}
          <div className="mb-6">
            <h3
              className="text-[11pt] font-semibold mb-2 uppercase tracking-wider border-b pb-1"
              style={{
                borderColor: accentColor,
                color: isSidebarDark ? '#ffffff' : accentColor,
              }}
            >
              Contact
            </h3>
            <div className="space-y-1 text-[9pt]" style={{ color: sidebarMutedColor }}>
              <InlineEditableText
                spanId="contact-email"
                value={data.contactInfo.email || ''}
                onChange={(value) => onUpdateContactInfo('email', value)}
                placeholder={
                  missingSpanIds?.has('contact-email')
                    ? 'Enter your email address'
                    : 'email@example.com'
                }
                suggestions={suggestions}
                coachEnabled={coachEnabled}
                isMissing={missingSpanIds?.has('contact-email')}
              />
              <InlineEditableText
                spanId="contact-phone"
                value={data.contactInfo.phone || ''}
                onChange={(value) => onUpdateContactInfo('phone', value)}
                placeholder={
                  missingSpanIds?.has('contact-phone')
                    ? 'Enter your phone number'
                    : '(555) 123-4567'
                }
                suggestions={suggestions}
                coachEnabled={coachEnabled}
                isMissing={missingSpanIds?.has('contact-phone')}
              />
              <InlineEditableText
                spanId="contact-location"
                value={data.contactInfo.location || ''}
                onChange={(value) => onUpdateContactInfo('location', value)}
                placeholder={
                  missingSpanIds?.has('contact-location') ? 'Enter your location' : 'City, State'
                }
                suggestions={suggestions}
                coachEnabled={coachEnabled}
                isMissing={missingSpanIds?.has('contact-location')}
              />
              <InlineEditableText
                spanId="contact-linkedin"
                value={data.contactInfo.linkedin || ''}
                onChange={(value) => onUpdateContactInfo('linkedin', value)}
                placeholder={
                  missingSpanIds?.has('contact-linkedin')
                    ? 'Enter your LinkedIn URL'
                    : 'linkedin.com/in/yourprofile'
                }
                suggestions={suggestions}
                coachEnabled={coachEnabled}
                style={{ color: sidebarLinkColor }}
                isMissing={missingSpanIds?.has('contact-linkedin')}
              />
            </div>
          </div>

          {/* Skills in sidebar */}
          {enabledSections.includes('skills') && (
            <div className="mb-6">
              <h3
                className="text-[11pt] font-semibold mb-2 uppercase tracking-wider border-b pb-1"
                style={{
                  borderColor: accentColor,
                  color: isSidebarDark ? '#ffffff' : accentColor,
                }}
              >
                Skills
              </h3>
              <SkillsEditor
                skills={data.skills || []}
                suggestions={suggestions}
                coachEnabled={coachEnabled}
                onChange={onUpdateSkills}
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
  isSelected,
  missingSpanIds,
  editorMode,
  aiSuggestions,
  focusedSuggestionId,
  onTrackChangeClick,
  onChange,
  onAdd,
  onDuplicate,
  onDelete,
  canDelete,
}: {
  experience: Experience;
  suggestions: Suggestion[];
  coachEnabled: boolean;
  accentColor: string;
  isSelected?: boolean;
  missingSpanIds?: Set<string>;
  editorMode?: EditorMode;
  aiSuggestions?: AISuggestion[];
  focusedSuggestionId?: string | null;
  onTrackChangeClick?: (suggestionId: string) => void;
  onChange: (updated: Experience) => void;
  onAdd?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
}) {
  // Use keyContributions if available, otherwise parse from description
  const hasKeyContributions = experience.keyContributions && experience.keyContributions.length > 0;
  const allBullets: string[] = hasKeyContributions
    ? (experience.keyContributions ?? [])
    : parseBulletPoints(experience.description || '');

  // Split: first item = summary (paragraph), rest = accomplishments (bullets)
  const displaySummary = experience.summary || (allBullets.length > 0 ? allBullets[0] : '');
  const displayBullets: string[] = experience.summary
    ? allBullets // If summary exists separately, all bullets are accomplishments
    : allBullets.slice(1); // Otherwise, first bullet became summary

  const handleBulletsChange = (newBullets: string[]) => {
    // If using keyContributions, update that field
    if (hasKeyContributions || experience.keyContributions !== undefined) {
      onChange({
        ...experience,
        keyContributions: newBullets,
      });
    } else {
      onChange({
        ...experience,
        description: bulletPointsToDescription(newBullets),
      });
    }
  };

  const handleSummaryChange = (newSummary: string) => {
    onChange({
      ...experience,
      summary: newSummary,
    });
  };

  // Check if any bullet in this experience is missing (needs description)
  const bulletSpanId = `experience-${experience.id}-bullets`;

  const titleIsMissing = missingSpanIds?.has(`experience-${experience.id}-title`);
  const companyIsMissing = missingSpanIds?.has(`experience-${experience.id}-company`);
  const bulletIsMissing = missingSpanIds?.has(bulletSpanId);

  const showToolbar = onAdd && onDuplicate && onDelete;

  return (
    <div
      className={cn(
        'relative group/entry pr-6',
        isSelected && 'ring-2 ring-primary-400 ring-offset-4 rounded',
      )}
      style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
    >
      {showToolbar && (
        <EntryToolbar
          onAdd={onAdd}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          canDelete={canDelete}
        />
      )}
      {/* Title and Date Row */}
      <div className="flex justify-between items-baseline">
        <InlineEditableText
          spanId={`experience-${experience.id}-title`}
          value={experience.title}
          onChange={(value) => onChange({ ...experience, title: value })}
          placeholder={titleIsMissing ? 'Enter job title (e.g. Software Engineer)' : 'Job Title'}
          suggestions={suggestions}
          coachEnabled={coachEnabled}
          className="font-semibold text-[12pt]"
          isMissing={titleIsMissing}
          editorMode={editorMode}
          aiSuggestions={aiSuggestions}
          focusedSuggestionId={focusedSuggestionId}
          onTrackChangeClick={onTrackChangeClick}
        />
        <div className="text-[10pt] text-slate-500">
          {experience.startDate} – {experience.current ? 'Present' : experience.endDate}
        </div>
      </div>
      {/* Company Row */}
      <InlineEditableText
        spanId={`experience-${experience.id}-company`}
        value={experience.company}
        onChange={(value) => onChange({ ...experience, company: value })}
        placeholder={companyIsMissing ? 'Enter company name' : 'Company Name'}
        suggestions={suggestions}
        coachEnabled={coachEnabled}
        className="text-[12pt]"
        style={{ color: accentColor } as CSSProperties}
        isMissing={companyIsMissing}
        editorMode={editorMode}
        aiSuggestions={aiSuggestions}
        focusedSuggestionId={focusedSuggestionId}
        onTrackChangeClick={onTrackChangeClick}
      />
      {experience.location && (
        <div className="text-[10pt] text-slate-500 mb-1">{experience.location}</div>
      )}
      {/* Summary/Overview - rendered as paragraph */}
      {displaySummary && (
        <p className="mt-2 text-[11pt] text-slate-700 leading-relaxed">{displaySummary}</p>
      )}
      {/* Accomplishments label + bullets */}
      {displayBullets.length > 0 && (
        <div className="mt-2 text-[11pt]">
          <div className="text-[10pt] font-semibold text-slate-500 italic mb-1">
            Accomplishments:
          </div>
          <BulletEditable
            spanId={`experience-${experience.id}-bullets`}
            bullets={displayBullets}
            onChange={handleBulletsChange}
            suggestions={suggestions}
            coachEnabled={coachEnabled}
            isMissing={bulletIsMissing}
            placeholder={
              bulletIsMissing ? 'Describe your achievement or responsibility...' : undefined
            }
            editorMode={editorMode}
            aiSuggestions={aiSuggestions}
            focusedSuggestionId={focusedSuggestionId}
            onTrackChangeClick={onTrackChangeClick}
          />
        </div>
      )}
      {/* Fallback: show bullets without label if no summary and no displayBullets */}
      {!displaySummary && displayBullets.length === 0 && allBullets.length > 0 && (
        <div className="mt-2 text-[11pt]">
          <BulletEditable
            spanId={`experience-${experience.id}-bullets`}
            bullets={allBullets}
            onChange={handleBulletsChange}
            suggestions={suggestions}
            coachEnabled={coachEnabled}
            isMissing={bulletIsMissing}
            placeholder={
              bulletIsMissing ? 'Describe your achievement or responsibility...' : undefined
            }
            editorMode={editorMode}
            aiSuggestions={aiSuggestions}
            focusedSuggestionId={focusedSuggestionId}
            onTrackChangeClick={onTrackChangeClick}
          />
        </div>
      )}
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
  isSelected,
  missingSpanIds,
  editorMode,
  aiSuggestions,
  focusedSuggestionId,
  onTrackChangeClick,
  onChange,
  onAdd,
  onDuplicate,
  onDelete,
  canDelete,
}: {
  education: Education;
  suggestions: Suggestion[];
  coachEnabled: boolean;
  isSelected?: boolean;
  missingSpanIds?: Set<string>;
  editorMode?: EditorMode;
  aiSuggestions?: AISuggestion[];
  focusedSuggestionId?: string | null;
  onTrackChangeClick?: (suggestionId: string) => void;
  onChange: (updated: Education) => void;
  onAdd?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
}) {
  const schoolIsMissing = missingSpanIds?.has(`education-${education.id}-school`);
  const degreeIsMissing = missingSpanIds?.has(`education-${education.id}-degree`);
  const fieldIsMissing = missingSpanIds?.has(`education-${education.id}-field`);

  const showToolbar = onAdd && onDuplicate && onDelete;

  return (
    <div
      className={cn(
        'relative group/entry pr-6',
        isSelected && 'ring-2 ring-primary-400 ring-offset-4 rounded',
      )}
      style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
    >
      {showToolbar && (
        <EntryToolbar
          onAdd={onAdd}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          canDelete={canDelete}
        />
      )}
      <div className="flex justify-between items-baseline">
        <div>
          <InlineEditableText
            spanId={`education-${education.id}-school`}
            value={education.school}
            onChange={(value) => onChange({ ...education, school: value })}
            placeholder={schoolIsMissing ? 'Enter school/university name' : 'University Name'}
            suggestions={suggestions}
            coachEnabled={coachEnabled}
            className="font-semibold text-[12pt]"
            isMissing={schoolIsMissing}
            editorMode={editorMode}
            aiSuggestions={aiSuggestions}
            focusedSuggestionId={focusedSuggestionId}
            onTrackChangeClick={onTrackChangeClick}
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
          placeholder={degreeIsMissing ? 'Enter degree (e.g. Bachelor of Science)' : 'Degree'}
          suggestions={suggestions}
          coachEnabled={coachEnabled}
          isMissing={degreeIsMissing}
          editorMode={editorMode}
          aiSuggestions={aiSuggestions}
          focusedSuggestionId={focusedSuggestionId}
          onTrackChangeClick={onTrackChangeClick}
        />
        <span className="text-slate-500"> in </span>
        <InlineEditableText
          spanId={`education-${education.id}-field`}
          value={education.field}
          onChange={(value) => onChange({ ...education, field: value })}
          placeholder={fieldIsMissing ? 'Enter field of study' : 'Field of Study'}
          suggestions={suggestions}
          coachEnabled={coachEnabled}
          isMissing={fieldIsMissing}
          editorMode={editorMode}
          aiSuggestions={aiSuggestions}
          focusedSuggestionId={focusedSuggestionId}
          onTrackChangeClick={onTrackChangeClick}
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
  suggestions,
  coachEnabled,
  onChange,
  compact = false,
  darkMode = false,
}: {
  skills: string[];
  suggestions: Suggestion[];
  coachEnabled: boolean;
  onChange?: (skills: string[]) => void;
  compact?: boolean;
  darkMode?: boolean;
}) {
  const hasSuggestion = coachEnabled && suggestions.some((s) => s.spanId.startsWith('skills-'));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newSkillValue, setNewSkillValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const newInputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingIndex !== null && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingIndex]);

  useEffect(() => {
    if (isAddingNew && newInputRef.current) {
      newInputRef.current.focus();
    }
  }, [isAddingNew]);

  const handleStartEdit = useCallback((index: number, skill: string) => {
    setEditingIndex(index);
    setEditValue(skill);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingIndex === null || !onChange) return;

    const trimmed = editValue.trim();
    if (trimmed) {
      const newSkills = [...skills];
      newSkills[editingIndex] = trimmed;
      onChange(newSkills);
    }
    setEditingIndex(null);
    setEditValue('');
  }, [editingIndex, editValue, skills, onChange]);

  const handleDeleteSkill = useCallback(
    (index: number) => {
      if (!onChange) return;
      const newSkills = skills.filter((_, i) => i !== index);
      onChange(newSkills);
    },
    [skills, onChange],
  );

  const handleAddSkill = useCallback(() => {
    if (!onChange) return;
    const trimmed = newSkillValue.trim();
    if (trimmed) {
      onChange([...skills, trimmed]);
    }
    setNewSkillValue('');
    setIsAddingNew(false);
  }, [newSkillValue, skills, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, type: 'edit' | 'add') => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (type === 'edit') {
          handleSaveEdit();
        } else {
          handleAddSkill();
        }
      } else if (e.key === 'Escape') {
        if (type === 'edit') {
          setEditingIndex(null);
          setEditValue('');
        } else {
          setIsAddingNew(false);
          setNewSkillValue('');
        }
      }
    },
    [handleSaveEdit, handleAddSkill],
  );

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
            <div key={idx} className="group flex items-center gap-1">
              <span
                className="w-1 h-1 rounded-full flex-shrink-0"
                style={{ backgroundColor: '#94a3b8' }}
              />
              {editingIndex === idx ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={handleSaveEdit}
                  onKeyDown={(e) => handleKeyDown(e, 'edit')}
                  className="flex-1 bg-transparent border-b border-slate-400 outline-none text-[9pt] min-w-0"
                  style={{ color: darkMode ? '#e2e8f0' : undefined }}
                />
              ) : (
                <>
                  <span
                    className="flex-1 cursor-text hover:bg-slate-100/20 rounded px-0.5 -mx-0.5"
                    onClick={() => onChange && handleStartEdit(idx, skill)}
                  >
                    {skill}
                  </span>
                  {onChange && (
                    <button
                      onClick={() => handleDeleteSkill(idx)}
                      className="opacity-0 group-hover:opacity-100 text-[8pt] text-red-400 hover:text-red-500 transition-opacity"
                      aria-label={`Delete ${skill}`}
                    >
                      ×
                    </button>
                  )}
                </>
              )}
            </div>
          ))
        ) : (
          <span
            style={{ color: darkMode ? '#64748b' : '#cbd5e1' }}
            className={onChange ? 'cursor-pointer hover:underline' : ''}
            onClick={() => onChange && setIsAddingNew(true)}
          >
            {onChange ? 'Click to add skills...' : 'Add your skills...'}
          </span>
        )}
        {/* Add new skill input */}
        {onChange && isAddingNew && (
          <div className="flex items-center gap-1">
            <span
              className="w-1 h-1 rounded-full flex-shrink-0"
              style={{ backgroundColor: '#94a3b8' }}
            />
            <input
              ref={newInputRef}
              type="text"
              value={newSkillValue}
              onChange={(e) => setNewSkillValue(e.target.value)}
              onBlur={handleAddSkill}
              onKeyDown={(e) => handleKeyDown(e, 'add')}
              placeholder="Type skill..."
              className="flex-1 bg-transparent border-b border-slate-400 outline-none text-[9pt] min-w-0"
              style={{ color: darkMode ? '#e2e8f0' : undefined }}
            />
          </div>
        )}
        {/* Add button */}
        {onChange && !isAddingNew && skills.length > 0 && (
          <button
            onClick={() => setIsAddingNew(true)}
            className="text-[8pt] text-slate-400 hover:text-slate-600 mt-1"
          >
            + Add skill
          </button>
        )}
      </div>
    );
  }

  // Standard inline view (pill/tag style)
  return (
    <div
      data-span-id="skills-list"
      className={`text-[11pt] flex flex-wrap gap-1.5 ${
        hasSuggestion
          ? 'underline decoration-wavy decoration-amber-400 underline-offset-4 decoration-2'
          : ''
      }`}
    >
      {skills.length > 0
        ? skills.map((skill, idx) => (
            <span
              key={idx}
              className="group inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 rounded px-2 py-0.5 transition-colors"
            >
              {editingIndex === idx ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={handleSaveEdit}
                  onKeyDown={(e) => handleKeyDown(e, 'edit')}
                  className="bg-transparent outline-none text-[11pt] min-w-[60px] w-auto"
                  style={{ width: `${Math.max(60, editValue.length * 8)}px` }}
                />
              ) : (
                <>
                  <span
                    className={onChange ? 'cursor-text' : ''}
                    onClick={() => onChange && handleStartEdit(idx, skill)}
                  >
                    {skill}
                  </span>
                  {onChange && (
                    <button
                      onClick={() => handleDeleteSkill(idx)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 text-xs transition-opacity ml-0.5"
                      aria-label={`Delete ${skill}`}
                    >
                      ×
                    </button>
                  )}
                </>
              )}
            </span>
          ))
        : null}
      {/* Add new skill */}
      {onChange && isAddingNew ? (
        <span className="inline-flex items-center bg-slate-100 rounded px-2 py-0.5">
          <input
            ref={newInputRef}
            type="text"
            value={newSkillValue}
            onChange={(e) => setNewSkillValue(e.target.value)}
            onBlur={handleAddSkill}
            onKeyDown={(e) => handleKeyDown(e, 'add')}
            placeholder="Type skill..."
            className="bg-transparent outline-none text-[11pt] min-w-[80px]"
          />
        </span>
      ) : onChange ? (
        <button
          onClick={() => setIsAddingNew(true)}
          className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded px-2 py-0.5 transition-colors border border-dashed border-slate-300"
        >
          + Add skill
        </button>
      ) : skills.length === 0 ? (
        <span className="text-slate-300">Add your skills...</span>
      ) : null}
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
  isSelected,
  editorMode,
  aiSuggestions,
  focusedSuggestionId,
  onTrackChangeClick,
  onChange,
  onAdd,
  onDuplicate,
  onDelete,
  canDelete,
}: {
  project: Project;
  suggestions: Suggestion[];
  coachEnabled: boolean;
  isSelected?: boolean;
  editorMode?: EditorMode;
  aiSuggestions?: AISuggestion[];
  focusedSuggestionId?: string | null;
  onTrackChangeClick?: (suggestionId: string) => void;
  onChange: (updated: Project) => void;
  onAdd?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
}) {
  const showToolbar = onAdd && onDuplicate && onDelete;

  return (
    <div
      className={cn(
        'relative group/entry pr-6',
        isSelected && 'ring-2 ring-primary-400 ring-offset-4 rounded',
      )}
      style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
    >
      {showToolbar && (
        <EntryToolbar
          onAdd={onAdd}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          canDelete={canDelete}
        />
      )}
      <div className="flex justify-between items-baseline">
        <InlineEditableText
          spanId={`projects-${project.id}-name`}
          value={project.name}
          onChange={(value) => onChange({ ...project, name: value })}
          placeholder="Project Name"
          suggestions={suggestions}
          coachEnabled={coachEnabled}
          className="font-semibold text-[12pt]"
          editorMode={editorMode}
          aiSuggestions={aiSuggestions}
          focusedSuggestionId={focusedSuggestionId}
          onTrackChangeClick={onTrackChangeClick}
        />
        {project.url && /^https?:\/\//i.test(project.url) && (
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
        editorMode={editorMode}
        aiSuggestions={aiSuggestions}
        focusedSuggestionId={focusedSuggestionId}
        onTrackChangeClick={onTrackChangeClick}
      />
      {project.technologies && (
        <div className="text-[10pt] text-slate-500 mt-1">
          <span className="font-medium">Tech:</span> {project.technologies}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Achievement Entry
// ============================================================================

function AchievementEntry({
  achievement,
  suggestions,
  coachEnabled,
  isSelected,
  missingSpanIds,
  editorMode,
  aiSuggestions,
  focusedSuggestionId,
  onTrackChangeClick,
  onChange,
  onAdd,
  onDuplicate,
  onDelete,
  canDelete,
}: {
  achievement: Achievement;
  suggestions: Suggestion[];
  coachEnabled: boolean;
  isSelected?: boolean;
  missingSpanIds?: Set<string>;
  editorMode?: EditorMode;
  aiSuggestions?: AISuggestion[];
  focusedSuggestionId?: string | null;
  onTrackChangeClick?: (suggestionId: string) => void;
  onChange: (updated: Achievement) => void;
  onAdd?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
}) {
  const titleIsMissing = missingSpanIds?.has(`achievement-${achievement.id}-title`);

  const showToolbar = onAdd && onDuplicate && onDelete;

  return (
    <div
      className={cn(
        'relative group/entry pr-6',
        isSelected && 'ring-2 ring-primary-400 ring-offset-4 rounded',
      )}
      style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
    >
      {showToolbar && (
        <EntryToolbar
          onAdd={onAdd}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          canDelete={canDelete}
        />
      )}
      <div className="flex justify-between items-baseline">
        <InlineEditableText
          spanId={`achievement-${achievement.id}-title`}
          value={achievement.title}
          onChange={(value) => onChange({ ...achievement, title: value })}
          placeholder={titleIsMissing ? 'Enter achievement title' : 'Achievement Title'}
          suggestions={suggestions}
          coachEnabled={coachEnabled}
          className="font-semibold text-[12pt]"
          isMissing={titleIsMissing}
          editorMode={editorMode}
          aiSuggestions={aiSuggestions}
          focusedSuggestionId={focusedSuggestionId}
          onTrackChangeClick={onTrackChangeClick}
        />
        {achievement.date && <span className="text-[10pt] text-slate-500">{achievement.date}</span>}
      </div>
      <InlineEditableText
        spanId={`achievement-${achievement.id}-description`}
        value={achievement.description}
        onChange={(value) => onChange({ ...achievement, description: value })}
        placeholder="Describe this achievement..."
        multiline
        suggestions={suggestions}
        coachEnabled={coachEnabled}
        className="text-[11pt] mt-1"
        editorMode={editorMode}
        aiSuggestions={aiSuggestions}
        focusedSuggestionId={focusedSuggestionId}
        onTrackChangeClick={onTrackChangeClick}
      />
    </div>
  );
}

// ============================================================================
// Certification Entry
// ============================================================================

function CertificationEntry({
  certification,
  suggestions,
  coachEnabled,
  accentColor,
  isSelected,
  missingSpanIds,
  editorMode,
  aiSuggestions,
  focusedSuggestionId,
  onTrackChangeClick,
  onChange,
  onAdd,
  onDuplicate,
  onDelete,
  canDelete,
}: {
  certification: Certification;
  suggestions: Suggestion[];
  coachEnabled: boolean;
  accentColor: string;
  isSelected?: boolean;
  missingSpanIds?: Set<string>;
  editorMode?: EditorMode;
  aiSuggestions?: AISuggestion[];
  focusedSuggestionId?: string | null;
  onTrackChangeClick?: (suggestionId: string) => void;
  onChange: (updated: Certification) => void;
  onAdd?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
}) {
  const nameIsMissing = missingSpanIds?.has(`certification-${certification.id}-name`);
  const issuerIsMissing = missingSpanIds?.has(`certification-${certification.id}-issuer`);

  const showToolbar = onAdd && onDuplicate && onDelete;

  return (
    <div
      className={cn(
        'relative group/entry pr-6',
        isSelected && 'ring-2 ring-primary-400 ring-offset-4 rounded',
      )}
      style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
    >
      {showToolbar && (
        <EntryToolbar
          onAdd={onAdd}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          canDelete={canDelete}
        />
      )}
      <div className="flex justify-between items-baseline">
        <div>
          <InlineEditableText
            spanId={`certification-${certification.id}-name`}
            value={certification.name}
            onChange={(value) => onChange({ ...certification, name: value })}
            placeholder={nameIsMissing ? 'Enter certification name' : 'Certification Name'}
            suggestions={suggestions}
            coachEnabled={coachEnabled}
            className="font-semibold text-[12pt]"
            isMissing={nameIsMissing}
            editorMode={editorMode}
            aiSuggestions={aiSuggestions}
            focusedSuggestionId={focusedSuggestionId}
            onTrackChangeClick={onTrackChangeClick}
          />
          <span className="mx-2 text-slate-400">|</span>
          <InlineEditableText
            spanId={`certification-${certification.id}-issuer`}
            value={certification.issuer}
            onChange={(value) => onChange({ ...certification, issuer: value })}
            placeholder={issuerIsMissing ? 'Enter issuing organization' : 'Issuing Organization'}
            suggestions={suggestions}
            coachEnabled={coachEnabled}
            className="text-[12pt]"
            style={{ color: accentColor } as CSSProperties}
            isMissing={issuerIsMissing}
            editorMode={editorMode}
            aiSuggestions={aiSuggestions}
            focusedSuggestionId={focusedSuggestionId}
            onTrackChangeClick={onTrackChangeClick}
          />
        </div>
        <div className="text-[10pt] text-slate-500">
          {certification.date}
          {certification.expirationDate && ` – ${certification.expirationDate}`}
        </div>
      </div>
      {certification.credentialId && (
        <div className="text-[10pt] text-slate-500 mt-1">
          Credential ID: {certification.credentialId}
        </div>
      )}
      {certification.url && (
        <a
          href={certification.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10pt] text-blue-600 hover:underline mt-1 inline-block"
        >
          View Credential
        </a>
      )}
    </div>
  );
}
