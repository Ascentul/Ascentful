'use client';

import { FileText, ImageIcon, LayoutList, Palette, Type } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import type {
  ContactInfo,
  Education,
  Experience,
  Project,
  ResumeData,
} from '@/components/resume/ResumeDocument';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import type { EditorAction, TopFix, ZoomLevel } from '@/types/resume-editor';

import type { FontPairingId, StyleConfig, TemplateId } from '../templates/types';
import { CanvasPanel } from './canvas/CanvasPanel';
import { ZoomControls } from './canvas/ZoomControls';
import { CoachPanel } from './coach/CoachPanel';
import { EditorTopBar } from './EditorTopBar';
import { OutlinePanel } from './outline/OutlinePanel';
import { FontPairingPicker } from './style/FontPairingPicker';
import { StyleTab } from './style/StyleTab';
import { TemplateSwitcher } from './style/TemplateSwitcher';

// Side rail panel types
type SideRailPanel = 'sections' | 'templates' | 'theme' | 'fonts' | 'uploads' | null;

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
  onUpdateSkills: (skills: string[]) => void;
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
  onUpdateSkills,
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

  // Coach is always enabled
  const coachEnabled = true;
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
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

  // Select item within a section
  const handleSelectItem = useCallback((sectionId: string, itemId: string) => {
    setSelectedSectionId(sectionId);
    setSelectedItemId(itemId);
  }, []);

  // Add/Delete Experience
  const handleAddExperience = useCallback(() => {
    const newExperience: Experience = {
      id: `exp-${Date.now()}`,
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
      id: `edu-${Date.now()}`,
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
      id: `proj-${Date.now()}`,
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

  // Side rail button configuration
  const sideRailButtons: { id: SideRailPanel; label: string; icon: typeof FileText }[] = [
    { id: 'sections', label: 'Sections', icon: LayoutList },
    { id: 'theme', label: 'Theme', icon: Palette },
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
      case 'sections':
        return (
          <OutlinePanel
            sectionOrder={sectionOrder}
            enabledSections={enabledSections}
            selectedSectionId={selectedSectionId}
            selectedItemId={selectedItemId}
            resumeData={resumeData}
            onSelectSection={(sectionId) => {
              setSelectedSectionId(sectionId);
              setSelectedItemId(null);
            }}
            onSelectItem={handleSelectItem}
            onReorderSections={handleReorderSections}
            onAddSection={handleAddSection}
            onAddExperience={handleAddExperience}
            onDeleteExperience={handleDeleteExperience}
            onAddEducation={handleAddEducation}
            onDeleteEducation={handleDeleteEducation}
            onAddProject={handleAddProject}
            onDeleteProject={handleDeleteProject}
          />
        );
      case 'templates':
        return (
          <div className="p-4">
            <TemplateSwitcher value={templateId} onChange={onTemplateChange} />
          </div>
        );
      case 'theme':
        return (
          <StyleTab
            templateId={templateId}
            styleConfig={styleConfig}
            onTemplateChange={onTemplateChange}
            onStyleChange={onStyleChange}
          />
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
      case 'sections':
        return 'Sections';
      case 'templates':
        return 'Templates';
      case 'theme':
        return 'Theme & Style';
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
            <div className="w-64 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
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
          onUpdateSkills={onUpdateSkills}
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

      {/* Bottom Rail */}
      <div className="h-10 bg-slate-50 border-t border-slate-200 flex items-center justify-between px-4 text-xs text-slate-500">
        {/* Left side: Zoom controls */}
        <ZoomControls value={zoomLevel} onChange={setZoomLevel} />

        {/* Right side: Score and status */}
        <div className="flex items-center gap-4">
          <span>
            Score: <strong className="text-slate-700">{score.overallScore}</strong>/100
          </span>
          <span>
            {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
