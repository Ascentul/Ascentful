'use client';

import { useCallback, useMemo, useState } from 'react';

import type {
  ContactInfo,
  Education,
  Experience,
  Project,
  ResumeData,
} from '@/components/resume/ResumeDocument';
import { useEditorKeyboard } from '@/hooks/useEditorKeyboard';
import {
  createApplySuggestionAction,
  createReorderSectionAction,
  useResumeUndo,
} from '@/hooks/useResumeUndo';
import { useSuggestions } from '@/hooks/useSuggestions';
import {
  bulletPointsToDescription,
  parseBulletPoints,
  parseSpanId,
  scrollToSpan,
} from '@/lib/resume-editor/span-utils';
import { calculateEnhancedScore } from '@/lib/resume-score';
import { cn } from '@/lib/utils';
import type { EditorAction, EditorTab, TopFix, ZoomLevel } from '@/types/resume-editor';

import type { StyleConfig, TemplateId } from '../templates/types';
import { CanvasPanel } from './canvas/CanvasPanel';
import { CoachPanel } from './coach/CoachPanel';
import { EditorTopBar } from './EditorTopBar';
import { OutlinePanel } from './outline/OutlinePanel';
import { StyleTab } from './style/StyleTab';

interface ThreePanelEditorProps {
  resumeData: ResumeData;
  templateId: TemplateId;
  styleConfig: StyleConfig;
  sectionOrder: string[];
  enabledSections: string[];
  title: string;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt?: number | null;
  onUpdateContactInfo: (field: keyof ContactInfo, value: string) => void;
  onUpdateSummary: (summary: string) => void;
  onUpdateExperience: (experiences: Experience[]) => void;
  onUpdateEducation: (education: Education[]) => void;
  onUpdateProjects: (projects: Project[]) => void;
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

export function ThreePanelEditor({
  resumeData,
  templateId,
  styleConfig,
  sectionOrder,
  enabledSections,
  title,
  saveStatus,
  lastSavedAt,
  onUpdateContactInfo,
  onUpdateSummary,
  onUpdateExperience,
  onUpdateEducation,
  onUpdateProjects,
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
  const [activeTab, setActiveTab] = useState<EditorTab>('content');
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('fit');

  // Coach is always enabled
  const coachEnabled = true;
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [inlineEditingSpanId, setInlineEditingSpanId] = useState<string | null>(null);

  // Undo/Redo
  const { pushAction, undo, redo, canUndo, canRedo } = useResumeUndo();

  // Suggestions
  const { suggestions, groupedSuggestions, suggestionCounts, dismissSuggestion, applySuggestion } =
    useSuggestions(resumeData, { enabled: coachEnabled });

  // Calculate enhanced score using the full scoring system
  const score = useMemo(() => {
    return calculateEnhancedScore(resumeData, suggestions);
  }, [resumeData, suggestions]);

  // Keyboard shortcuts
  const getSpanValue = useCallback(
    (spanId: string): string | null => {
      const parsed = parseSpanId(spanId);
      if (!parsed) return null;

      switch (parsed.sectionType) {
        case 'summary':
          return parsed.field === 'text' ? resumeData.summary || '' : null;
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

  // Apply suggestion
  const handleApplySuggestion = useCallback(
    (suggestionId: string) => {
      const suggestion = suggestions.find((s) => s.suggestionId === suggestionId);
      if (!suggestion || !suggestion.proposedText) return;

      const before = getSpanValue(suggestion.spanId);
      if (before === null || before === suggestion.proposedText) {
        applySuggestion(suggestionId);
        return;
      }

      const applied = applySpanText(suggestion.spanId, suggestion.proposedText);
      if (applied) {
        pushAction(
          createApplySuggestionAction(
            suggestion.spanId,
            suggestion.suggestionId,
            before,
            suggestion.proposedText,
            'Apply suggestion',
          ),
        );
        applySuggestion(suggestionId);
      }
    },
    [suggestions, applySuggestion, getSpanValue, applySpanText, pushAction],
  );

  // Apply fix
  const handleApplyFix = useCallback(
    (fix: TopFix) => {
      // Apply all suggestions in the fix
      fix.suggestionIds.forEach((id) => {
        handleApplySuggestion(id);
      });
    },
    [handleApplySuggestion],
  );

  // Scroll to span
  const handleScrollToSpan = useCallback((spanId: string) => {
    scrollToSpan(spanId);
  }, []);

  // Tab configuration - Content and Style only (Review is handled by Coach panel)
  const tabs: { id: EditorTab; label: string }[] = [
    { id: 'content', label: 'Content' },
    { id: 'style', label: 'Style' },
  ];

  // Render left panel content based on active tab
  const renderLeftPanelContent = () => {
    switch (activeTab) {
      case 'content':
        return (
          <OutlinePanel
            sectionOrder={sectionOrder}
            enabledSections={enabledSections}
            selectedSectionId={selectedSectionId}
            suggestionCounts={coachEnabled ? suggestionCounts : {}}
            onSelectSection={setSelectedSectionId}
            onReorderSections={handleReorderSections}
            onToggleSection={onToggleSection}
            onAddSection={handleAddSection}
          />
        );
      case 'style':
        return (
          <StyleTab
            templateId={templateId}
            styleConfig={styleConfig}
            onTemplateChange={onTemplateChange}
            onStyleChange={onStyleChange}
          />
        );
      default:
        return null;
    }
  };

  // Render left panel with tabs
  const renderLeftPanel = () => {
    return (
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
        {/* Tab bar */}
        <div className="flex items-center gap-1 p-3 border-b border-slate-100">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 px-3 py-1.5 text-xs font-medium rounded-full transition-colors',
                activeTab === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">{renderLeftPanelContent()}</div>
      </div>
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
        onClose={onClose}
        isExporting={isExporting}
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
          suggestions={coachEnabled ? suggestions : []}
          coachEnabled={coachEnabled}
          onUpdateContactInfo={(field, value) =>
            onUpdateContactInfo(field as keyof ContactInfo, value)
          }
          onUpdateSummary={onUpdateSummary}
          onUpdateExperience={onUpdateExperience}
          onUpdateEducation={onUpdateEducation}
          onUpdateProjects={onUpdateProjects}
        />

        {/* Right Panel - Coach (always visible) */}
        <CoachPanel
          score={score}
          groupedSuggestions={groupedSuggestions}
          topFixes={score.topFixes}
          onApplySuggestion={handleApplySuggestion}
          onDismissSuggestion={dismissSuggestion}
          onApplyFix={handleApplyFix}
          onScrollToSpan={handleScrollToSpan}
        />
      </div>
    </div>
  );
}
