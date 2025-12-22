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
import { createReorderSectionAction, useResumeUndo } from '@/hooks/useResumeUndo';
import { useSuggestions } from '@/hooks/useSuggestions';
import { scrollToSpan } from '@/lib/resume-editor/span-utils';
import { calculateEnhancedScore } from '@/lib/resume-score';
import { cn } from '@/lib/utils';
import type { EditorTab, TopFix, ZoomLevel } from '@/types/resume-editor';

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
  onUpdateSkills: (skills: string[]) => void;
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
  onUpdateSkills,
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
  const handleUndo = useCallback(() => {
    const action = undo();
    if (action) {
      // TODO: Apply the undo - restore previous state.
    }
  }, [undo]);

  const handleRedo = useCallback(() => {
    const action = redo();
    if (action) {
      // TODO: Apply the redo - apply the action's 'after' state.
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
          onUpdateSkills={onUpdateSkills}
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
