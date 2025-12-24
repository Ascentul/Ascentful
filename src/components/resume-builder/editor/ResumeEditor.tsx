'use client';

import { Eye, PenLine } from 'lucide-react';
import { useState } from 'react';

import type {
  ContactInfo,
  Education,
  Experience,
  Project,
  ResumeData,
} from '@/components/resume/ResumeDocument';
import { cn } from '@/lib/utils';

import { LivePreview } from '../preview/LivePreview';
import type { StyleConfig, TemplateId } from '../templates/types';
import { styleConfigToTheme } from '../templates/types';
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
  const [mobileView, setMobileView] = useState<'editor' | 'preview'>('editor');

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
      <div
        className={cn(
          'flex flex-col bg-white border-r border-slate-200',
          // On small screens: full width, hidden when preview is active
          'w-full lg:w-1/2',
          mobileView === 'preview' && 'hidden lg:flex',
        )}
      >
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
      <div
        className={cn(
          'lg:w-1/2',
          // On small screens: full width, hidden when editor is active
          'w-full',
          mobileView === 'editor' && 'hidden lg:block',
        )}
      >
        <LivePreview data={resumeData} templateId={templateId} theme={theme} />
      </div>

      {/* Mobile view toggle - only visible on small screens */}
      <div className="fixed bottom-6 right-6 lg:hidden z-50">
        <button
          type="button"
          onClick={() => setMobileView(mobileView === 'editor' ? 'preview' : 'editor')}
          className="flex items-center gap-2 px-4 py-3 bg-primary-500 text-white rounded-full shadow-lg hover:bg-primary-600 transition-colors"
          aria-label={mobileView === 'editor' ? 'Show preview' : 'Show editor'}
        >
          {mobileView === 'editor' ? (
            <>
              <Eye className="h-5 w-5" />
              <span className="font-medium">Preview</span>
            </>
          ) : (
            <>
              <PenLine className="h-5 w-5" />
              <span className="font-medium">Edit</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
