'use client';

import { ChevronDown, ChevronUp, Copy, Eye, EyeOff, Files, Share2, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';

import type {
  Education,
  Experience,
  Project,
  ResumeData,
} from '@/components/resume/ResumeDocument';
import type { StyleConfig, TemplateId } from '@/components/resume-builder/templates/types';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  // Page toolbar actions (optional)
  onCopyPage?: () => void;
  onDuplicatePage?: () => void;
  onDeletePage?: () => void;
  onSharePage?: () => void;
  currentPage?: number;
  totalPages?: number;
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
  onCopyPage,
  onDuplicatePage,
  onDeletePage,
  onSharePage,
  currentPage = 1,
  totalPages = 1,
}: CanvasPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scale = (() => {
    switch (zoomLevel) {
      case '50':
        return ZOOM_SCALES['50'];
      case '75':
        return ZOOM_SCALES['75'];
      case '100':
        return ZOOM_SCALES['100'];
      case 'fit':
      default:
        return ZOOM_SCALES.fit;
    }
  })();
  const [isPageVisible, setIsPageVisible] = useState(true);

  return (
    <TooltipProvider>
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
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Page toolbar - above the resume */}
          <div
            className="flex items-center justify-between mb-3"
            style={{
              width: `calc(8.5in * ${scale})`,
              minWidth: '300px',
              maxWidth: '100%',
            }}
          >
            {/* Left side: Page number */}
            <span className="text-sm text-slate-500">Page {currentPage}</span>

            {/* Right side: Action buttons */}
            <div className="flex items-center gap-0.5">
              {/* Page navigation */}
              {totalPages > 1 && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
                        disabled={currentPage <= 1}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Move page up</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
                        disabled={currentPage >= totalPages}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Move page down</TooltipContent>
                  </Tooltip>
                </>
              )}

              {/* Visibility toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
                    onClick={() => setIsPageVisible(!isPageVisible)}
                  >
                    {isPageVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isPageVisible ? 'Hide page from export' : 'Show page in export'}
                </TooltipContent>
              </Tooltip>

              {/* Copy */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
                    onClick={onCopyPage}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy page</TooltipContent>
              </Tooltip>

              {/* Duplicate */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
                    onClick={onDuplicatePage}
                  >
                    <Files className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Duplicate page</TooltipContent>
              </Tooltip>

              {/* Delete */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-slate-200/50"
                    onClick={onDeletePage}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete page</TooltipContent>
              </Tooltip>

              {/* Share */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
                    onClick={onSharePage}
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Share page</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Resume page */}
          <div
            className={`bg-white shadow-2xl rounded-sm origin-top transition-all duration-200 ${
              !isPageVisible ? 'opacity-50' : ''
            }`}
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
          <span className="text-xs text-slate-500">
            Page {currentPage} of {totalPages}
          </span>
        </div>
      </div>
    </TooltipProvider>
  );
}
