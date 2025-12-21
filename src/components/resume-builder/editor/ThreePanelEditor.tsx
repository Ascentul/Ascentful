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
  createReorderSectionAction,
  createTextEditAction,
  useResumeUndo,
} from '@/hooks/useResumeUndo';
import { useSuggestions } from '@/hooks/useSuggestions';
import { scrollToSpan } from '@/lib/resume-editor/span-utils';
import { calculateEnhancedScore } from '@/lib/resume-score';
import type { EditorTab, TopFix, ZoomLevel } from '@/types/resume-editor';
import { SECTION_CONFIGS } from '@/types/resume-editor';

import type { StyleConfig, TemplateId } from '../templates/types';
import { CanvasPanel } from './canvas/CanvasPanel';
import { CoachPanel } from './coach/CoachPanel';
import { EditorTopBar } from './EditorTopBar';
import { OutlinePanel } from './outline/OutlinePanel';
import { ReviewTab } from './review/ReviewTab';
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
  onUpdateSkills: (skills: string[]) => void;
  onUpdateProjects: (projects: Project[]) => void;
  onReorderSection: (fromIndex: number, toIndex: number) => void;
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
  onUpdateSkills,
  onUpdateProjects,
  onReorderSection,
  onToggleSection,
  onTemplateChange,
  onStyleChange,
  onTitleChange,
  onClose,
  onExportPDF,
  onExportDOCX,
  onSave,
  isExporting,
}: ThreePanelEditorProps) {
  // UI State
  const [activeTab, setActiveTab] = useState<EditorTab>('content');
  const [coachEnabled, setCoachEnabled] = useState(true);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('fit');
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
  const handleUndo = useCallback(() => {
    const action = undo();
    if (action) {
      // Apply the undo - restore previous state
      // This would need to be connected to the appropriate update function
      console.log('Undo:', action);
    }
  }, [undo]);

  const handleRedo = useCallback(() => {
    const action = redo();
    if (action) {
      // Apply the redo - apply the action's 'after' state
      console.log('Redo:', action);
    }
  }, [redo]);

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
      // Find the indices and call the original handler
      // For simplicity, we'll update the order directly
      newOrder.forEach((sectionId, newIndex) => {
        const oldIndex = sectionOrder.indexOf(sectionId);
        if (oldIndex !== newIndex) {
          onReorderSection(oldIndex, newIndex);
        }
      });
    },
    [sectionOrder, onReorderSection, pushAction],
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
      if (suggestion?.proposedText) {
        // For now, just mark as applied
        // In a full implementation, we'd update the actual text
        applySuggestion(suggestionId);
      }
    },
    [suggestions, applySuggestion],
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

  // Render left panel based on active tab
  const renderLeftPanel = () => {
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
          <div className="w-64 bg-white border-r border-slate-200 overflow-y-auto">
            <StyleTab
              templateId={templateId}
              styleConfig={styleConfig}
              onTemplateChange={onTemplateChange}
              onStyleChange={onStyleChange}
            />
          </div>
        );
      case 'review':
        return (
          <div className="w-64 bg-white border-r border-slate-200 overflow-y-auto">
            <ReviewTab
              resumeData={resumeData}
              onExportPDF={onExportPDF}
              onExportDOCX={onExportDOCX}
              isExporting={isExporting}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      {/* Top Bar */}
      <EditorTopBar
        title={title}
        onTitleChange={onTitleChange}
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        coachEnabled={coachEnabled}
        onCoachToggle={() => setCoachEnabled(!coachEnabled)}
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
          onUpdateSkills={onUpdateSkills}
          onUpdateProjects={onUpdateProjects}
        />

        {/* Right Panel - Coach (toggleable) */}
        {coachEnabled && (
          <CoachPanel
            score={score}
            groupedSuggestions={groupedSuggestions}
            topFixes={score.topFixes}
            onApplySuggestion={handleApplySuggestion}
            onDismissSuggestion={dismissSuggestion}
            onApplyFix={handleApplyFix}
            onScrollToSpan={handleScrollToSpan}
          />
        )}
      </div>
    </div>
  );
}
