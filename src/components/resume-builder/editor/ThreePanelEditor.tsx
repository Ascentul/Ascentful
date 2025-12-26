'use client';

import type { Id } from 'convex/_generated/dataModel';
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  FileText,
  GraduationCap,
  ImageIcon,
  LayoutList,
  Lightbulb,
  Mail,
  Plus,
  Sparkles,
  Target,
  Type,
  User,
  Wrench,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  Achievement,
  Certification,
  ContactInfo,
  Education,
  Experience,
  Project,
  ResumeData,
} from '@/components/resume/ResumeDocument';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ResumeAIProvider, useResumeAIActions, useResumeAIState } from '@/contexts/ResumeAIContext';
import { useEditorKeyboard } from '@/hooks/useEditorKeyboard';
import {
  createApplySuggestionAction,
  createReorderSectionAction,
  useResumeUndo,
} from '@/hooks/useResumeUndo';
import type { ScoreResponse } from '@/lib/ai/schemas';
import {
  bulletPointsToDescription,
  focusSpan,
  parseBulletPoints,
  parseSpanId,
  scrollToSpan,
} from '@/lib/resume-editor/span-utils';
import { cn } from '@/lib/utils';
import type { EditorAction, ZoomLevel } from '@/types/resume-editor';
import { SECTION_CONFIGS } from '@/types/resume-editor';

import type { FontPairingId, StyleConfig, TemplateId } from '../templates/types';
import {
  ACCENT_COLORS,
  FONT_CATEGORIES,
  FONT_PAIRINGS,
  getFontPairingsByCategory,
  getGoogleFontsUrl,
  TEMPLATE_METADATA,
} from '../templates/types';
import { AIAssistPanel, getCurrentStepMissingSpanIds } from './ai/AIAssistPanel';
import { AIGuidanceModal } from './ai/AIGuidanceModal';
import { CanvasPanel } from './canvas/CanvasPanel';
import { ZoomControls } from './canvas/ZoomControls';
import { CoachPanel } from './coach/CoachPanel';
import { type EditorMode, EditorTopBar } from './EditorTopBar';
import { OutlinePanel } from './outline/OutlinePanel';
import { SectionFormPanel } from './outline/SectionFormPanel';
import { FontPairingPicker } from './style/FontPairingPicker';
import { TemplateSwitcher } from './style/TemplateSwitcher';
import { VersionHistoryPanel } from './VersionHistoryPanel';

// Side rail panel types
type SideRailPanel = 'ai-assist' | 'sections' | 'templates' | 'fonts' | 'uploads' | null;

interface ThreePanelEditorProps {
  resumeData: ResumeData;
  templateId: TemplateId;
  styleConfig: StyleConfig;
  sectionOrder: string[];
  enabledSections: string[];
  title: string;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt?: number | null;
  resumeId?: string;
  currentVersionNumber?: number;
  onUpdateContactInfo: (field: keyof ContactInfo, value: string) => void;
  onUpdateSummary: (summary: string) => void;
  onUpdateExperience: (experiences: Experience[]) => void;
  onUpdateEducation: (education: Education[]) => void;
  onUpdateProjects: (projects: Project[]) => void;
  onUpdateSkills: (skills: string[]) => void;
  onUpdateAchievements?: (achievements: Achievement[]) => void;
  onUpdateCertifications?: (certifications: Certification[]) => void;
  onSetSectionOrder: (newOrder: string[]) => void;
  onToggleSection: (sectionId: string, enabled: boolean) => void;
  onTemplateChange: (templateId: TemplateId) => void;
  onStyleChange: (config: Partial<StyleConfig>) => void;
  onTitleChange: (title: string) => void;
  onClose: () => void;
  onExportPDF: () => void;
  onExportDOCX?: () => void;
  onSave?: () => void;
  isExporting?: boolean;
}

// Inner component that uses the AI context
function ThreePanelEditorInner({
  resumeData,
  templateId,
  styleConfig,
  sectionOrder,
  enabledSections,
  title,
  saveStatus,
  lastSavedAt,
  resumeId,
  currentVersionNumber,
  onUpdateContactInfo,
  onUpdateSummary,
  onUpdateExperience,
  onUpdateEducation,
  onUpdateProjects,
  onUpdateSkills,
  onUpdateAchievements,
  onUpdateCertifications,
  onSetSectionOrder,
  onToggleSection,
  onTemplateChange,
  onStyleChange,
  onTitleChange,
  onClose,
  onExportPDF,
  onExportDOCX: _onExportDOCX,
  onSave,
  isExporting,
}: ThreePanelEditorProps) {
  // UI State
  const [activeSidePanel, setActiveSidePanel] = useState<SideRailPanel>('sections');
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(80);
  const [editorMode, setEditorMode] = useState<EditorMode>('editor');
  // Focused suggestion ID - for bidirectional linking between canvas and coach panel
  const [focusedSuggestionId, setFocusedSuggestionId] = useState<string | null>(null);
  // Version history panel state
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);

  // Coach is always enabled
  const coachEnabled = true;

  // Load Google Fonts for the currently selected font pairing
  useEffect(() => {
    const url = getGoogleFontsUrl(styleConfig.font_pairing);
    if (!url) return;

    // Check if already loaded
    const existingLink = document.querySelector(`link[href="${url}"]`);
    if (existingLink) return;

    // Create and append link element
    const link = document.createElement('link');
    link.href = url;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, [styleConfig.font_pairing]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [inlineEditingSpanId, setInlineEditingSpanId] = useState<string | null>(null);

  // AI Guidance Modal State
  const [aiGuidanceOpen, setAIGuidanceOpen] = useState(false);
  const [aiGuidanceSection, setAIGuidanceSection] = useState<string>('');
  const [aiGuidanceSectionLabel, setAIGuidanceSectionLabel] = useState<string>('');

  // Undo/Redo
  const { pushAction, undo, redo, canUndo, canRedo } = useResumeUndo();

  // AI Context - provides score, suggestions, JD analysis, and match scoring
  const {
    effectiveScore,
    legacyScore,
    legacyGroupedSuggestions,
    aiScore,
    aiSuggestions,
    scoreLoading,
    suggestionsLoading,
    jobDescription,
    jdAnalysis,
    jdLoading,
    matchScore,
    assistMode,
  } = useResumeAIState();

  const {
    setJobDescription,
    analyzeJobDescription,
    dismissSuggestion: dismissAISuggestion,
    applySuggestion: applyAISuggestion,
    refreshSuggestions,
  } = useResumeAIActions();

  // Use legacy-compatible formats for existing components
  const score = legacyScore;
  const groupedSuggestions = legacyGroupedSuggestions;

  // =============================================================================
  // Resume Completeness Analysis
  // =============================================================================
  type GuidanceItem = {
    id: string;
    icon: typeof User;
    label: string;
    description: string;
    status: 'complete' | 'incomplete' | 'needs-improvement';
    priority: 'high' | 'medium' | 'low';
    action: () => void;
    spanId?: string;
  };

  // Analyze resume completeness for guidance
  const getGuidanceItems = useCallback((): GuidanceItem[] => {
    const items: GuidanceItem[] = [];
    const { contactInfo, experience, education, skills, summary } = resumeData;

    // Contact Info
    const hasBasicContact = contactInfo.name && contactInfo.email;
    const hasFullContact = hasBasicContact && contactInfo.phone && contactInfo.location;
    items.push({
      id: 'contact',
      icon: User,
      label: 'Contact Information',
      description: !hasBasicContact
        ? 'Add your name and email'
        : !hasFullContact
          ? 'Add phone and location'
          : 'Contact info complete',
      status: !hasBasicContact ? 'incomplete' : !hasFullContact ? 'needs-improvement' : 'complete',
      priority: !hasBasicContact ? 'high' : 'low',
      action: () => {
        setSelectedSectionId('contact');
        scrollToSpan('contact-name');
      },
      spanId: 'contact-name',
    });

    // Summary
    const hasSummary = summary && summary.trim().length > 20;
    const summaryLength = summary?.trim().length || 0;
    items.push({
      id: 'summary',
      icon: FileText,
      label: 'Professional Summary',
      description: !hasSummary
        ? 'Write a compelling summary'
        : summaryLength < 100
          ? 'Consider expanding your summary'
          : 'Summary looks good',
      status: !hasSummary ? 'incomplete' : summaryLength < 100 ? 'needs-improvement' : 'complete',
      priority: !hasSummary ? 'high' : 'medium',
      action: () => {
        setSelectedSectionId('summary');
        scrollToSpan('summary-text');
      },
      spanId: 'summary-text',
    });

    // Experience
    const hasExperience = experience && experience.length > 0;
    const experienceWithBullets = experience?.filter(
      (exp) => exp.description && exp.description.trim().length > 50,
    );
    const hasDetailedExperience = experienceWithBullets && experienceWithBullets.length > 0;
    items.push({
      id: 'experience',
      icon: Briefcase,
      label: 'Work Experience',
      description: !hasExperience
        ? 'Add your work experience'
        : !hasDetailedExperience
          ? 'Add bullet points to your roles'
          : `${experience.length} position${experience.length > 1 ? 's' : ''} added`,
      status: !hasExperience
        ? 'incomplete'
        : !hasDetailedExperience
          ? 'needs-improvement'
          : 'complete',
      priority: !hasExperience ? 'high' : !hasDetailedExperience ? 'high' : 'low',
      action: () => {
        setSelectedSectionId('experience');
        if (experience && experience.length > 0) {
          scrollToSpan(`experience-${experience[0].id}-title`);
        }
      },
      spanId: experience?.[0] ? `experience-${experience[0].id}-title` : undefined,
    });

    // Education
    const hasEducation = education && education.length > 0;
    items.push({
      id: 'education',
      icon: GraduationCap,
      label: 'Education',
      description: !hasEducation
        ? 'Add your education'
        : `${education.length} degree${education.length > 1 ? 's' : ''} added`,
      status: !hasEducation ? 'incomplete' : 'complete',
      priority: !hasEducation ? 'medium' : 'low',
      action: () => {
        setSelectedSectionId('education');
        if (education && education.length > 0) {
          scrollToSpan(`education-${education[0].id}-school`);
        }
      },
      spanId: education?.[0] ? `education-${education[0].id}-school` : undefined,
    });

    // Skills
    const hasSkills = skills && skills.length > 0;
    const hasEnoughSkills = skills && skills.length >= 5;
    items.push({
      id: 'skills',
      icon: Wrench,
      label: 'Skills',
      description: !hasSkills
        ? 'Add your key skills'
        : !hasEnoughSkills
          ? `Add more skills (${skills.length}/5 minimum)`
          : `${skills.length} skills listed`,
      status: !hasSkills ? 'incomplete' : !hasEnoughSkills ? 'needs-improvement' : 'complete',
      priority: !hasSkills ? 'medium' : !hasEnoughSkills ? 'low' : 'low',
      action: () => {
        setSelectedSectionId('skills');
        scrollToSpan('skills-list');
      },
      spanId: 'skills-list',
    });

    return items;
  }, [resumeData, setSelectedSectionId]);

  const guidanceItems = getGuidanceItems();
  const completedCount = guidanceItems.filter((item) => item.status === 'complete').length;
  const completionPercentage = Math.round((completedCount / guidanceItems.length) * 100);

  // Compute missing spanIds for current step when AI Assist panel is open
  const missingSpanIds = useMemo(() => {
    if (activeSidePanel !== 'ai-assist') return new Set<string>();
    return getCurrentStepMissingSpanIds(resumeData);
  }, [activeSidePanel, resumeData]);

  // =============================================================================
  // AI Guidance Modal Handlers
  // =============================================================================
  const openAIGuidance = useCallback((sectionId: string, sectionLabel: string) => {
    setAIGuidanceSection(sectionId);
    setAIGuidanceSectionLabel(sectionLabel);
    setAIGuidanceOpen(true);
    // Also switch to AI assist panel
    setActiveSidePanel('ai-assist');
  }, []);

  const handleAIApplyContent = useCallback(
    (field: string, value: string, action: 'set' | 'append') => {
      // Route the content to the appropriate update handler based on field
      const [section, subfield] = field.split('.');

      switch (section) {
        case 'contact':
          if (subfield && subfield in resumeData.contactInfo) {
            onUpdateContactInfo(subfield as keyof ContactInfo, value);
          }
          break;

        case 'summary':
          if (action === 'append' && resumeData.summary) {
            onUpdateSummary(resumeData.summary + '\n' + value);
          } else {
            onUpdateSummary(value);
          }
          break;

        case 'experience':
          // For experience, we might receive structured data
          try {
            const expData = typeof value === 'string' ? JSON.parse(value) : value;
            const currentExperience = resumeData.experience || [];
            if (Array.isArray(expData)) {
              onUpdateExperience([...currentExperience, ...expData]);
            } else if (expData.id) {
              // Update existing experience
              const updated = currentExperience.map((exp) =>
                exp.id === expData.id ? { ...exp, ...expData } : exp,
              );
              onUpdateExperience(updated);
            } else {
              // Add new experience with generated ID
              const newExp = {
                ...expData,
                id: `exp-${Date.now()}`,
              };
              onUpdateExperience([...currentExperience, newExp]);
            }
          } catch (e) {
            // If not JSON, it might be a bullet point to add
            if (process.env.NODE_ENV === 'development') {
              console.warn('Experience value is not JSON:', value, e);
            }
          }
          break;

        case 'education':
          try {
            const eduData = typeof value === 'string' ? JSON.parse(value) : value;
            const currentEducation = resumeData.education || [];
            if (Array.isArray(eduData)) {
              onUpdateEducation([...currentEducation, ...eduData]);
            } else {
              const newEdu = {
                ...eduData,
                id: `edu-${Date.now()}`,
              };
              onUpdateEducation([...currentEducation, newEdu]);
            }
          } catch {
            if (process.env.NODE_ENV === 'development') {
              console.warn('Education value is not JSON:', value);
            }
          }
          break;

        case 'skills':
          try {
            // Skills can be a comma-separated string or array
            let newSkills: string[] = [];
            if (typeof value === 'string') {
              newSkills = value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
            } else if (Array.isArray(value)) {
              newSkills = value;
            }
            if (action === 'append') {
              const existingSkills = resumeData.skills || [];
              const combined = [...new Set([...existingSkills, ...newSkills])];
              onUpdateSkills(combined);
            } else {
              onUpdateSkills(newSkills);
            }
          } catch {
            if (process.env.NODE_ENV === 'development') {
              console.warn('Skills value parsing error:', value);
            }
          }
          break;

        default:
          if (process.env.NODE_ENV === 'development') {
            console.warn('Unknown field for AI content:', field);
          }
      }
    },
    [
      resumeData,
      onUpdateContactInfo,
      onUpdateSummary,
      onUpdateExperience,
      onUpdateEducation,
      onUpdateSkills,
    ],
  );

  // Keyboard shortcuts
  const getSpanValue = useCallback(
    (spanId: string): string | null => {
      const parsed = parseSpanId(spanId);
      if (!parsed) return null;

      switch (parsed.sectionType) {
        case 'summary':
          return parsed.field === 'text' ? resumeData.summary || '' : null;
        case 'skills': {
          const skills = resumeData.skills || [];
          return skills.join(', ');
        }
        case 'contact': {
          const { contactInfo } = resumeData;
          switch (parsed.field) {
            case 'name':
              return contactInfo.name || '';
            case 'email':
              return contactInfo.email || '';
            case 'phone':
              return contactInfo.phone || '';
            case 'location':
              return contactInfo.location || '';
            case 'linkedin':
              return contactInfo.linkedin || '';
            case 'github':
              return contactInfo.github || '';
            case 'website':
              return contactInfo.website || '';
            default:
              return null;
          }
        }
        case 'experience': {
          const experience = (resumeData.experience || []).find((exp) => exp.id === parsed.itemId);
          if (!experience) return null;
          switch (parsed.field) {
            case 'title':
              return experience.title || '';
            case 'company':
              return experience.company || '';
            case 'location':
              return experience.location || '';
            case 'startDate':
              return experience.startDate || '';
            case 'endDate':
              return experience.endDate || '';
            case 'description':
            case 'bullets': {
              const bullets = parseBulletPoints(experience.description || '');
              if (parsed.lineIndex !== undefined) {
                return bullets[parsed.lineIndex] ?? null;
              }
              return experience.description || '';
            }
            case 'summary':
              return experience.summary || '';
            default:
              return null;
          }
        }
        case 'education': {
          const education = (resumeData.education || []).find((edu) => edu.id === parsed.itemId);
          if (!education) return null;
          switch (parsed.field) {
            case 'school':
              return education.school || '';
            case 'degree':
              return education.degree || '';
            case 'field':
              return education.field || '';
            case 'location':
              return education.location || '';
            case 'startYear':
              return education.startYear || '';
            case 'endYear':
              return education.endYear || '';
            case 'gpa':
              return education.gpa || '';
            case 'honors':
              return education.honors || '';
            default:
              return null;
          }
        }
        case 'projects': {
          const project = (resumeData.projects || []).find((proj) => proj.id === parsed.itemId);
          if (!project) return null;
          switch (parsed.field) {
            case 'name':
              return project.name || '';
            case 'role':
              return project.role || '';
            case 'description':
              return project.description || '';
            case 'technologies':
              return project.technologies || '';
            case 'url':
              return project.url || '';
            default:
              return null;
          }
        }
        default:
          return null;
      }
    },
    [resumeData],
  );

  const applySpanText = useCallback(
    (spanId: string, text: string): boolean => {
      const parsed = parseSpanId(spanId);
      if (!parsed) return false;

      switch (parsed.sectionType) {
        case 'summary':
          if (parsed.field === 'text') {
            onUpdateSummary(text);
            return true;
          }
          return false;
        case 'skills': {
          const skills = text
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          onUpdateSkills(skills);
          return true;
        }
        case 'contact': {
          switch (parsed.field) {
            case 'name':
            case 'email':
            case 'phone':
            case 'location':
            case 'linkedin':
            case 'github':
            case 'website':
              onUpdateContactInfo(parsed.field as keyof ContactInfo, text);
              return true;
            default:
              return false;
          }
        }
        case 'experience': {
          const experiences = resumeData.experience || [];
          const index = experiences.findIndex((exp) => exp.id === parsed.itemId);
          if (index === -1) return false;
          const experience = experiences[index];
          let updated: Experience | null = null;

          switch (parsed.field) {
            case 'title':
              updated = { ...experience, title: text };
              break;
            case 'company':
              updated = { ...experience, company: text };
              break;
            case 'location':
              updated = { ...experience, location: text };
              break;
            case 'startDate':
              updated = { ...experience, startDate: text };
              break;
            case 'endDate':
              updated = { ...experience, endDate: text };
              break;
            case 'summary':
              updated = { ...experience, summary: text };
              break;
            case 'description':
            case 'bullets': {
              if (parsed.lineIndex !== undefined) {
                const bullets = parseBulletPoints(experience.description || '');
                if (parsed.lineIndex < 0 || parsed.lineIndex >= bullets.length) return false;
                const updatedBullets = [...bullets];
                updatedBullets[parsed.lineIndex] = text;
                updated = {
                  ...experience,
                  description: bulletPointsToDescription(updatedBullets),
                };
              } else {
                updated = { ...experience, description: text };
              }
              break;
            }
            default:
              return false;
          }

          const next = experiences.map((exp, i) => (i === index ? updated! : exp));
          onUpdateExperience(next);
          return true;
        }
        case 'education': {
          const educationItems = resumeData.education || [];
          const index = educationItems.findIndex((edu) => edu.id === parsed.itemId);
          if (index === -1) return false;
          const education = educationItems[index];
          let updated: Education | null = null;

          switch (parsed.field) {
            case 'school':
              updated = { ...education, school: text };
              break;
            case 'degree':
              updated = { ...education, degree: text };
              break;
            case 'field':
              updated = { ...education, field: text };
              break;
            case 'location':
              updated = { ...education, location: text };
              break;
            case 'startYear':
              updated = { ...education, startYear: text };
              break;
            case 'endYear':
              updated = { ...education, endYear: text };
              break;
            case 'gpa':
              updated = { ...education, gpa: text };
              break;
            case 'honors':
              updated = { ...education, honors: text };
              break;
            default:
              return false;
          }

          const next = educationItems.map((edu, i) => (i === index ? updated! : edu));
          onUpdateEducation(next);
          return true;
        }
        case 'projects': {
          const projects = resumeData.projects || [];
          const index = projects.findIndex((proj) => proj.id === parsed.itemId);
          if (index === -1) return false;
          const project = projects[index];
          let updated: Project | null = null;

          switch (parsed.field) {
            case 'name':
              updated = { ...project, name: text };
              break;
            case 'role':
              updated = { ...project, role: text };
              break;
            case 'description':
              updated = { ...project, description: text };
              break;
            case 'technologies':
              updated = { ...project, technologies: text };
              break;
            case 'url':
              updated = { ...project, url: text };
              break;
            default:
              return false;
          }

          const next = projects.map((proj, i) => (i === index ? updated! : proj));
          onUpdateProjects(next);
          return true;
        }
        default:
          return false;
      }
    },
    [
      resumeData,
      onUpdateSummary,
      onUpdateSkills,
      onUpdateContactInfo,
      onUpdateExperience,
      onUpdateEducation,
      onUpdateProjects,
    ],
  );

  const applyEditorAction = useCallback(
    (action: EditorAction, direction: 'undo' | 'redo') => {
      const payload = direction === 'undo' ? action.before : action.after;

      switch (action.type) {
        case 'reorder_section':
          if (Array.isArray(payload)) {
            onSetSectionOrder(payload as string[]);
          }
          break;
        case 'toggle_section':
          if (action.sectionId && typeof payload === 'boolean') {
            onToggleSection(action.sectionId, payload);
          }
          break;
        case 'apply_suggestion':
        case 'text_edit':
          if (action.spanId && typeof payload === 'string') {
            applySpanText(action.spanId, payload);
          }
          break;
        default:
          break;
      }
    },
    [onSetSectionOrder, onToggleSection, applySpanText],
  );

  const handleUndo = useCallback(() => {
    const action = undo();
    if (action) {
      applyEditorAction(action, 'undo');
    }
  }, [undo, applyEditorAction]);

  const handleRedo = useCallback(() => {
    const action = redo();
    if (action) {
      applyEditorAction(action, 'redo');
    }
  }, [redo, applyEditorAction]);

  const handleSave = useCallback(() => {
    onSave?.();
  }, [onSave]);

  const handleExitInlineEdit = useCallback(() => {
    setInlineEditingSpanId(null);
    // Blur any focused element
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  useEditorKeyboard({
    onUndo: handleUndo,
    onRedo: handleRedo,
    onSave: handleSave,
    onExitInlineEdit: handleExitInlineEdit,
    inlineEditing: !!inlineEditingSpanId,
  });

  // Section reordering
  const handleReorderSections = useCallback(
    (newOrder: string[]) => {
      const oldOrder = sectionOrder;
      pushAction(createReorderSectionAction(oldOrder, newOrder, 'Reorder sections'));
      onSetSectionOrder(newOrder);
    },
    [sectionOrder, onSetSectionOrder, pushAction],
  );

  // Add section
  const handleAddSection = useCallback(
    (sectionId: string) => {
      onToggleSection(sectionId, true);
    },
    [onToggleSection],
  );

  // Select item within a section
  const handleSelectItem = useCallback((sectionId: string, itemId: string) => {
    setSelectedSectionId(sectionId);
    setSelectedItemId(itemId);
  }, []);

  // Add/Delete Experience
  const handleAddExperience = useCallback(() => {
    const newExperience: Experience = {
      id: `exp-${crypto.randomUUID()}`,
      title: '',
      company: '',
      location: '',
      startDate: '',
      endDate: '',
      current: false,
      description: '',
    };
    onUpdateExperience([...(resumeData.experience || []), newExperience]);
    setSelectedSectionId('experience');
    setSelectedItemId(newExperience.id);
  }, [resumeData.experience, onUpdateExperience]);

  const handleDeleteExperience = useCallback(
    (id: string) => {
      onUpdateExperience((resumeData.experience || []).filter((exp) => exp.id !== id));
      if (selectedItemId === id) {
        setSelectedItemId(null);
      }
    },
    [resumeData.experience, onUpdateExperience, selectedItemId],
  );

  // Add/Delete Education
  const handleAddEducation = useCallback(() => {
    const newEducation: Education = {
      id: `edu-${crypto.randomUUID()}`,
      school: '',
      degree: '',
      field: '',
      location: '',
      startYear: '',
      endYear: '',
    };
    onUpdateEducation([...(resumeData.education || []), newEducation]);
    setSelectedSectionId('education');
    setSelectedItemId(newEducation.id);
  }, [resumeData.education, onUpdateEducation]);

  const handleDeleteEducation = useCallback(
    (id: string) => {
      onUpdateEducation((resumeData.education || []).filter((edu) => edu.id !== id));
      if (selectedItemId === id) {
        setSelectedItemId(null);
      }
    },
    [resumeData.education, onUpdateEducation, selectedItemId],
  );

  // Add/Delete Project
  const handleAddProject = useCallback(() => {
    const newProject: Project = {
      id: `proj-${crypto.randomUUID()}`,
      name: '',
      role: '',
      description: '',
      technologies: '',
    };
    onUpdateProjects([...(resumeData.projects || []), newProject]);
    setSelectedSectionId('projects');
    setSelectedItemId(newProject.id);
  }, [resumeData.projects, onUpdateProjects]);

  const handleDeleteProject = useCallback(
    (id: string) => {
      onUpdateProjects((resumeData.projects || []).filter((proj) => proj.id !== id));
      if (selectedItemId === id) {
        setSelectedItemId(null);
      }
    },
    [resumeData.projects, onUpdateProjects, selectedItemId],
  );

  // Add/Delete Achievement
  const handleAddAchievement = useCallback(() => {
    const newAchievement: Achievement = {
      id: `ach-${crypto.randomUUID()}`,
      title: '',
      description: '',
      date: '',
    };
    onUpdateAchievements?.([...(resumeData.achievements || []), newAchievement]);
    setSelectedSectionId('achievements');
    setSelectedItemId(newAchievement.id);
  }, [resumeData.achievements, onUpdateAchievements]);

  const handleDeleteAchievement = useCallback(
    (id: string) => {
      onUpdateAchievements?.((resumeData.achievements || []).filter((ach) => ach.id !== id));
      if (selectedItemId === id) {
        setSelectedItemId(null);
      }
    },
    [resumeData.achievements, onUpdateAchievements, selectedItemId],
  );

  // Add/Delete Certification
  const handleAddCertification = useCallback(() => {
    const newCertification: Certification = {
      id: `cert-${crypto.randomUUID()}`,
      name: '',
      issuer: '',
      date: '',
    };
    onUpdateCertifications?.([...(resumeData.certifications || []), newCertification]);
    setSelectedSectionId('certifications');
    setSelectedItemId(newCertification.id);
  }, [resumeData.certifications, onUpdateCertifications]);

  const handleDeleteCertification = useCallback(
    (id: string) => {
      onUpdateCertifications?.((resumeData.certifications || []).filter((cert) => cert.id !== id));
      if (selectedItemId === id) {
        setSelectedItemId(null);
      }
    },
    [resumeData.certifications, onUpdateCertifications, selectedItemId],
  );

  // Apply AI suggestion (new format)
  const handleApplyAISuggestion = useCallback(
    (suggestionId: string, afterText: string) => {
      const suggestion = aiSuggestions.find((s) => s.id === suggestionId);
      if (!suggestion) return;

      const before = getSpanValue(suggestion.targetPath);
      if (before === null || before === afterText) {
        applyAISuggestion(suggestionId);
        return;
      }

      const applied = applySpanText(suggestion.targetPath, afterText);
      if (applied) {
        pushAction(
          createApplySuggestionAction(
            suggestion.targetPath,
            suggestion.id,
            before,
            afterText,
            'Apply suggestion',
          ),
        );
        applyAISuggestion(suggestionId);
        // Scroll to and highlight the changed element
        scrollToSpan(suggestion.targetPath);
      }
    },
    [aiSuggestions, applyAISuggestion, getSpanValue, applySpanText, pushAction],
  );

  // Dismiss AI suggestion
  const handleDismissAISuggestion = useCallback(
    (suggestionId: string) => {
      dismissAISuggestion(suggestionId);
    },
    [dismissAISuggestion],
  );

  // Legacy apply suggestion (for backward compatibility)
  const handleApplySuggestion = useCallback(
    (suggestionId: string) => {
      // Map to AI suggestion if it exists
      const aiSuggestion = aiSuggestions.find((s) => s.id === suggestionId);
      if (aiSuggestion) {
        handleApplyAISuggestion(suggestionId, aiSuggestion.afterText);
      }
    },
    [aiSuggestions, handleApplyAISuggestion],
  );

  // Scroll to span
  const handleScrollToSpan = useCallback((spanId: string) => {
    scrollToSpan(spanId);
  }, []);

  // Side rail button configuration
  const sideRailButtons: { id: SideRailPanel; label: string; icon: typeof FileText }[] = [
    { id: 'ai-assist', label: 'AI Assist', icon: Sparkles },
    { id: 'sections', label: 'Sections', icon: LayoutList },
    { id: 'fonts', label: 'Fonts', icon: Type },
    { id: 'templates', label: 'Templates', icon: FileText },
    { id: 'uploads', label: 'Uploads', icon: ImageIcon },
  ];

  // Toggle side panel - if same panel clicked, close it; otherwise open new one
  const handleSidePanelToggle = (panelId: SideRailPanel) => {
    setActiveSidePanel((current) => (current === panelId ? null : panelId));
  };

  // Render expanded panel content based on active side panel
  const renderSidePanelContent = () => {
    switch (activeSidePanel) {
      case 'ai-assist':
        return (
          <AIAssistPanel
            mode={matchScore ? 'strategy' : 'active'}
            isLoading={suggestionsLoading || scoreLoading}
            resumeData={resumeData}
            currentSection={selectedSectionId}
            onSelectSection={(sectionId, focusSpanId) => {
              setSelectedSectionId(sectionId);
              setSelectedItemId(null);

              // If we have a specific field to focus on, scroll to and highlight it
              if (focusSpanId) {
                // Small delay to ensure DOM is ready after state updates
                setTimeout(() => {
                  scrollToSpan(focusSpanId);
                  // Focus the element so user can start typing
                  setTimeout(() => {
                    focusSpan(focusSpanId);
                  }, 300);
                }, 100);
              } else {
                // Just scroll to the section header
                scrollToSpan(`${sectionId}-header`);
              }
            }}
            onGetAIHelp={(sectionId) => {
              const config = SECTION_CONFIGS[sectionId as keyof typeof SECTION_CONFIGS];
              openAIGuidance(sectionId, config?.label || sectionId);
            }}
          />
        );
      case 'sections':
        return (
          <SectionFormPanel
            sectionOrder={sectionOrder}
            enabledSections={enabledSections}
            resumeData={resumeData}
            onReorderSections={handleReorderSections}
            onAddSection={handleAddSection}
            onUpdateContactInfo={onUpdateContactInfo}
            onUpdateSummary={onUpdateSummary}
            onUpdateExperience={onUpdateExperience}
            onUpdateEducation={onUpdateEducation}
            onUpdateProjects={onUpdateProjects}
            onUpdateSkills={onUpdateSkills}
            onUpdateAchievements={onUpdateAchievements}
            onUpdateCertifications={onUpdateCertifications}
            onGenerateAI={(sectionId) => {
              const config = SECTION_CONFIGS[sectionId as keyof typeof SECTION_CONFIGS];
              openAIGuidance(sectionId, config?.label || sectionId);
            }}
          />
        );
      case 'templates':
        return (
          <div className="p-4">
            <TemplateSwitcher
              value={templateId}
              onChange={onTemplateChange}
              styleConfig={styleConfig}
              onStyleChange={onStyleChange}
            />
          </div>
        );
      case 'fonts':
        return (
          <div className="p-4">
            <FontPairingPicker
              value={styleConfig.font_pairing}
              onChange={(font_pairing: FontPairingId) => onStyleChange({ font_pairing })}
            />
          </div>
        );
      case 'uploads':
        return (
          <div className="p-4">
            <h3 className="font-semibold text-slate-900 text-sm mb-3">Uploads</h3>
            <p className="text-xs text-slate-500">
              Upload custom images and assets to personalize your resume.
            </p>
            <div className="mt-4 p-8 border-2 border-dashed border-slate-200 rounded-lg text-center">
              <ImageIcon className="h-8 w-8 mx-auto text-slate-300 mb-2" />
              <p className="text-xs text-slate-400">Drag and drop or click to upload</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // Get panel title
  const getPanelTitle = () => {
    switch (activeSidePanel) {
      case 'ai-assist':
        return 'AI Assist';
      case 'sections':
        return 'Sections';
      case 'templates':
        return 'Templates & Theme';
      case 'fonts':
        return 'Fonts';
      case 'uploads':
        return 'Uploads';
      default:
        return '';
    }
  };

  // Render left panel with icon rail and expandable panel
  const renderLeftPanel = () => {
    return (
      <TooltipProvider delayDuration={300}>
        <div className="flex h-full">
          {/* Icon Rail - always visible */}
          <div className="w-20 bg-slate-50 border-r border-slate-200 flex flex-col items-center py-4 gap-2">
            {sideRailButtons.map((button) => {
              const Icon = button.icon;
              const isActive = activeSidePanel === button.id;
              return (
                <Tooltip key={button.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleSidePanelToggle(button.id)}
                      className={cn(
                        'w-16 h-14 flex flex-col items-center justify-center rounded-xl transition-all',
                        isActive
                          ? 'bg-white shadow-sm text-slate-900'
                          : 'text-slate-500 hover:bg-white/50 hover:text-slate-700',
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-[10px] mt-1.5 font-medium">{button.label}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {button.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* Expandable Panel - shows when a button is active */}
          {activeSidePanel && (
            <div
              className={cn(
                'bg-white border-r border-slate-200 flex flex-col overflow-hidden transition-all duration-200',
                activeSidePanel === 'templates' ? 'w-[45vw] max-w-[600px]' : 'w-[414px]',
              )}
            >
              {/* Panel header */}
              <div className="px-4 py-3 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900 text-sm">{getPanelTitle()}</h2>
              </div>
              {/* Panel content */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar">
                {renderSidePanelContent()}
              </div>
            </div>
          )}
        </div>
      </TooltipProvider>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      {/* Top Bar */}
      <EditorTopBar
        title={title}
        onTitleChange={onTitleChange}
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onExport={onExportPDF}
        onVersionHistory={resumeId ? () => setIsVersionHistoryOpen(true) : undefined}
        onClose={onClose}
        isExporting={isExporting}
        editorMode={editorMode}
        onEditorModeChange={setEditorMode}
      />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Tab specific */}
        {renderLeftPanel()}

        {/* Center Panel - Canvas (always visible) */}
        <CanvasPanel
          resumeData={resumeData}
          templateId={templateId}
          styleConfig={styleConfig}
          zoomLevel={zoomLevel}
          onZoomChange={setZoomLevel}
          sectionOrder={sectionOrder}
          enabledSections={enabledSections}
          suggestions={[]}
          coachEnabled={coachEnabled}
          onUpdateContactInfo={(field, value) =>
            onUpdateContactInfo(field as keyof ContactInfo, value)
          }
          onUpdateSummary={onUpdateSummary}
          onUpdateExperience={onUpdateExperience}
          onUpdateEducation={onUpdateEducation}
          onUpdateProjects={onUpdateProjects}
          onUpdateSkills={onUpdateSkills}
          onUpdateAchievements={onUpdateAchievements}
          onUpdateCertifications={onUpdateCertifications}
          selectedSectionId={selectedSectionId}
          selectedItemId={selectedItemId}
          missingSpanIds={missingSpanIds}
          editorMode={editorMode}
          aiSuggestions={aiSuggestions}
          focusedSuggestionId={focusedSuggestionId}
          onTrackChangeClick={(suggestionId) => setFocusedSuggestionId(suggestionId)}
        />

        {/* Right Panel - Coach (hidden when templates panel is open) */}
        {activeSidePanel !== 'templates' && (
          <CoachPanel
            score={score}
            scoreLoading={scoreLoading}
            groupedSuggestions={groupedSuggestions}
            topFixes={score?.topFixes || []}
            onApplySuggestion={handleApplySuggestion}
            onDismissSuggestion={handleDismissAISuggestion}
            onScrollToSpan={handleScrollToSpan}
            // AI props
            aiScore={aiScore}
            aiSuggestions={aiSuggestions}
            matchScore={matchScore?.matchScore}
            onApplyAISuggestion={handleApplyAISuggestion}
            onDismissAISuggestion={handleDismissAISuggestion}
            onScrollToTarget={(targetPath) => scrollToSpan(targetPath)}
            // JD props
            jobDescription={jobDescription}
            onJobDescriptionChange={setJobDescription}
            onAnalyzeJD={() => analyzeJobDescription(jobDescription)}
            jdLoading={jdLoading}
            // Bidirectional linking
            focusedSuggestionId={focusedSuggestionId}
            onSuggestionSelect={(suggestionId, targetPath) => {
              // Switch to review mode to show track changes
              setEditorMode('review');
              // Set the focused suggestion for highlighting
              setFocusedSuggestionId(suggestionId);
              // Scroll to the target element on the canvas
              scrollToSpan(targetPath);
            }}
            // Rerun AI review
            onRerunAIReview={refreshSuggestions}
            aiReviewLoading={suggestionsLoading}
          />
        )}
      </div>

      {/* Bottom Rail */}
      <div className="h-12 bg-slate-50 border-t border-slate-200 flex items-center justify-between px-4 text-xs text-slate-500">
        {/* Left side: Zoom controls */}
        <ZoomControls value={zoomLevel} onChange={setZoomLevel} />

        {/* Center: Quick design controls */}
        <div className="flex items-center gap-2">
          {/* Template Quick Switcher */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs',
                  'bg-white border border-slate-200 hover:border-slate-300',
                  'text-slate-600 hover:text-slate-900 transition-colors',
                )}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>{TEMPLATE_METADATA[templateId]?.name || 'Template'}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="center">
              <div className="text-xs font-medium text-slate-700 mb-2 px-1">Template</div>
              <div className="grid grid-cols-3 gap-1">
                {(Object.keys(TEMPLATE_METADATA) as (keyof typeof TEMPLATE_METADATA)[]).map(
                  (id) => (
                    <button
                      key={id}
                      onClick={() => onTemplateChange(id)}
                      className={cn(
                        'px-2 py-1.5 rounded text-xs text-center transition-colors',
                        templateId === id
                          ? 'bg-primary-100 text-primary-700'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100',
                      )}
                    >
                      {TEMPLATE_METADATA[id].name}
                    </button>
                  ),
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Color Quick Switcher */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs',
                  'bg-white border border-slate-200 hover:border-slate-300',
                  'text-slate-600 hover:text-slate-900 transition-colors',
                )}
              >
                <div
                  className="h-3.5 w-3.5 rounded-full border border-slate-200"
                  style={{ backgroundColor: styleConfig.accent_color }}
                />
                <span>Color</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="center">
              <div className="text-xs font-medium text-slate-700 mb-2 px-1">Accent Color</div>
              <div className="flex flex-wrap gap-1.5">
                {ACCENT_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => onStyleChange({ accent_color: color.value })}
                    className={cn(
                      'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
                      styleConfig.accent_color === color.value
                        ? 'border-slate-900 ring-2 ring-primary-200'
                        : 'border-transparent',
                    )}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Font Quick Switcher */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs',
                  'bg-white border border-slate-200 hover:border-slate-300',
                  'text-slate-600 hover:text-slate-900 transition-colors',
                )}
              >
                <Type className="h-3.5 w-3.5" />
                <span>{FONT_PAIRINGS[styleConfig.font_pairing]?.label || 'Font'}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2 max-h-80 overflow-y-auto" align="center">
              <div className="text-xs font-medium text-slate-700 mb-2 px-1">Font Style</div>
              <div className="space-y-3">
                {(['professional', 'modern', 'creative', 'classic'] as const).map((category) => {
                  const fonts = getFontPairingsByCategory()[category];
                  return (
                    <div key={category}>
                      <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider px-1 mb-1">
                        {FONT_CATEGORIES[category].label}
                      </div>
                      <div className="space-y-0.5">
                        {fonts.map(({ id, pairing }) => (
                          <button
                            key={id}
                            onClick={() => onStyleChange({ font_pairing: id })}
                            className={cn(
                              'w-full px-2 py-1.5 rounded text-xs text-left transition-colors',
                              styleConfig.font_pairing === id
                                ? 'bg-primary-100 text-primary-700'
                                : 'text-slate-600 hover:bg-slate-100',
                            )}
                          >
                            <div className="font-medium" style={{ fontFamily: pairing.heading }}>
                              {pairing.label}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Right side: Score and suggestions */}
        <div className="flex items-center gap-3">
          {scoreLoading ? (
            <span className="animate-pulse flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary-400" />
              Analyzing...
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  'font-semibold',
                  effectiveScore.overallScore >= 80
                    ? 'text-green-600'
                    : effectiveScore.overallScore >= 60
                      ? 'text-amber-600'
                      : 'text-red-500',
                )}
              >
                {effectiveScore.overallScore}
              </span>
              <span className="text-slate-400">/100</span>
            </span>
          )}

          {aiSuggestions.length > 0 && (
            <span className="flex items-center gap-1 text-amber-600">
              <Lightbulb className="h-3.5 w-3.5" />
              {aiSuggestions.length}
            </span>
          )}

          {matchScore && (
            <span
              className={cn(
                'flex items-center gap-1',
                matchScore.matchScore >= 80
                  ? 'text-green-600'
                  : matchScore.matchScore >= 60
                    ? 'text-amber-600'
                    : 'text-red-500',
              )}
            >
              <span className="font-medium">{matchScore.matchScore}%</span>
              <span className="text-slate-400">match</span>
            </span>
          )}
        </div>
      </div>

      {/* AI Guidance Modal */}
      <AIGuidanceModal
        open={aiGuidanceOpen}
        onClose={() => setAIGuidanceOpen(false)}
        section={aiGuidanceSection}
        sectionLabel={aiGuidanceSectionLabel}
        currentResumeData={resumeData}
        onApplyContent={handleAIApplyContent}
      />

      {/* Version History Panel */}
      {resumeId && (
        <VersionHistoryPanel
          resumeId={resumeId as Id<'resumes'>}
          isOpen={isVersionHistoryOpen}
          onClose={() => setIsVersionHistoryOpen(false)}
          currentVersionNumber={currentVersionNumber}
        />
      )}
    </div>
  );
}

// Main export - wraps inner component with AI provider
export function ThreePanelEditor(props: ThreePanelEditorProps) {
  return (
    <ResumeAIProvider resumeData={props.resumeData} enabled={true}>
      <ThreePanelEditorInner {...props} />
    </ResumeAIProvider>
  );
}
