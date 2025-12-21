'use client';

import { useRef } from 'react';

import type {
  Education,
  Experience,
  Project,
  ResumeData,
} from '@/components/resume/ResumeDocument';
import type { StyleConfig, TemplateId } from '@/components/resume-builder/templates/types';
import type { Suggestion, ZoomLevel } from '@/types/resume-editor';
import { ZOOM_SCALES } from '@/types/resume-editor';

import { ResumeCanvas } from './ResumeCanvas';
import { ZoomControls } from './ZoomControls';

interface CanvasPanelProps {
  resumeData: ResumeData;
  templateId: TemplateId;
  styleConfig: StyleConfig;
  zoomLevel: ZoomLevel;
  onZoomChange: (level: ZoomLevel) => void;
  sectionOrder: string[];
  enabledSections: string[];
  suggestions: Suggestion[];
  coachEnabled: boolean;
  onUpdateContactInfo: (field: string, value: string) => void;
  onUpdateSummary: (value: string) => void;
  onUpdateExperience: (experiences: Experience[]) => void;
  onUpdateEducation: (education: Education[]) => void;
  onUpdateSkills: (skills: string[]) => void;
  onUpdateProjects: (projects: Project[]) => void;
}

export function CanvasPanel({
  resumeData,
  templateId,
  styleConfig,
  zoomLevel,
  onZoomChange,
  sectionOrder,
  enabledSections,
  suggestions,
  coachEnabled,
  onUpdateContactInfo,
  onUpdateSummary,
  onUpdateExperience,
  onUpdateEducation,
  onUpdateSkills,
  onUpdateProjects,
}: CanvasPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scale = ZOOM_SCALES[zoomLevel];

  return (
    <div className="flex-1 flex flex-col bg-slate-100 min-w-0">
      {/* Zoom controls */}
      <div className="flex items-center justify-center py-3 bg-slate-50 border-b border-slate-200">
        <ZoomControls value={zoomLevel} onChange={onZoomChange} />
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-8"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
        }}
      >
        <div
          className="bg-white shadow-2xl rounded-sm origin-top transition-transform duration-200"
          style={{
            width: '8.5in',
            minHeight: '11in',
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
          }}
        >
          <ResumeCanvas
            data={resumeData}
            templateId={templateId}
            styleConfig={styleConfig}
            sectionOrder={sectionOrder}
            enabledSections={enabledSections}
            suggestions={suggestions}
            coachEnabled={coachEnabled}
            onUpdateContactInfo={onUpdateContactInfo}
            onUpdateSummary={onUpdateSummary}
            onUpdateExperience={onUpdateExperience}
            onUpdateEducation={onUpdateEducation}
            onUpdateSkills={onUpdateSkills}
            onUpdateProjects={onUpdateProjects}
          />
        </div>
      </div>

      {/* Page indicator */}
      <div className="flex justify-center py-2 bg-slate-50 border-t border-slate-200">
        <span className="text-xs text-slate-500">Page 1 of 1</span>
      </div>
    </div>
  );
}
