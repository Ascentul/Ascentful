'use client';

import { useCallback, useState } from 'react';

import type {
  ContactInfo,
  Education,
  Experience,
  Project,
  ResumeData,
} from '@/components/resume/ResumeDocument';

import { LivePreview } from '../preview/LivePreview';
import type { StyleConfig, TemplateId } from '../templates/types';
import { DEFAULT_STYLE_CONFIG, styleConfigToTheme } from '../templates/types';
import { ContentTab } from './content/ContentTab';
import { EditorHeader } from './EditorHeader';
import { type EditorTab, EditorTabBar } from './EditorTabBar';
import { ReviewTab } from './review/ReviewTab';
import { StyleTab } from './style/StyleTab';

interface ResumeEditorProps {
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
  onGenerateSummary?: () => void;
  onGenerateBullets?: (experienceIndex: number) => void;
  onSuggestSkills?: () => void;
  isGenerating?: boolean;
  isExporting?: boolean;
}

export function ResumeEditor({
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
  onGenerateSummary,
  onGenerateBullets,
  onSuggestSkills,
  isGenerating,
  isExporting,
}: ResumeEditorProps) {
  const [activeTab, setActiveTab] = useState<EditorTab>('content');

  const theme = styleConfigToTheme(styleConfig);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'content':
        return (
          <ContentTab
            resumeData={resumeData}
            sectionOrder={sectionOrder}
            enabledSections={enabledSections}
            onUpdateContactInfo={onUpdateContactInfo}
            onUpdateSummary={onUpdateSummary}
            onUpdateExperience={onUpdateExperience}
            onUpdateEducation={onUpdateEducation}
            onUpdateSkills={onUpdateSkills}
            onUpdateProjects={onUpdateProjects}
            onReorderSection={onReorderSection}
            onToggleSection={onToggleSection}
            onGenerateSummary={onGenerateSummary}
            onGenerateBullets={onGenerateBullets}
            onSuggestSkills={onSuggestSkills}
            isGenerating={isGenerating}
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
      case 'review':
        return (
          <ReviewTab
            resumeData={resumeData}
            onExportPDF={onExportPDF}
            onExportDOCX={onExportDOCX}
            isExporting={isExporting}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-neutral-100">
      {/* Left Panel - Editor */}
      <div className="w-1/2 flex flex-col bg-white border-r border-slate-200">
        {/* Header */}
        <EditorHeader
          title={title}
          onTitleChange={onTitleChange}
          saveStatus={saveStatus}
          lastSavedAt={lastSavedAt}
          onClose={onClose}
        />

        {/* Tab bar */}
        <EditorTabBar activeTab={activeTab} onChange={setActiveTab} />

        {/* Tab content */}
        <div className="flex-1 overflow-hidden">{renderTabContent()}</div>
      </div>

      {/* Right Panel - Live Preview */}
      <div className="w-1/2">
        <LivePreview data={resumeData} templateId={templateId} theme={theme} />
      </div>
    </div>
  );
}
