'use client';

import { Eye, EyeOff, Files, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

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
import { getZoomScale } from '@/types/resume-editor';

import { ResumeCanvas } from './ResumeCanvas';

// Page dimensions in pixels (at 96 DPI)
const PAGE_HEIGHT_INCHES = 11;
const PAGE_MARGIN_INCHES = 0.7; // Standard resume margin (matches ResumeCanvas padding)
const DPI = 96;
const PAGE_HEIGHT_PX = PAGE_HEIGHT_INCHES * DPI; // 1056px
// Content area height excludes top and bottom margins
const PAGE_CONTENT_HEIGHT_PX = (PAGE_HEIGHT_INCHES - PAGE_MARGIN_INCHES * 2) * DPI; // ~921px usable

// Zoom constraints (must match ZoomControls)
const MIN_ZOOM = 40;
const MAX_ZOOM = 120;
const ZOOM_SENSITIVITY = 0.5; // How sensitive pinch-to-zoom is

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
  onUpdateProjects: (projects: Project[]) => void;
  onUpdateSkills: (skills: string[]) => void;
  // Page toolbar actions (optional)
  onDuplicatePage?: () => void;
  onDeletePage?: () => void;
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
  onUpdateProjects,
  onUpdateSkills,
  onDuplicatePage,
  onDeletePage,
  totalPages: externalTotalPages,
}: CanvasPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentMeasureRef = useRef<HTMLDivElement>(null);
  const prevZoomRef = useRef<number>(zoomLevel);
  const scale = getZoomScale(zoomLevel);
  const [hiddenPages, setHiddenPages] = useState<Set<number>>(new Set());

  // Multi-page state - detect content overflow
  const [calculatedPageCount, setCalculatedPageCount] = useState(1);

  // Focal-point zoom: keep the vertical position stable when zooming
  // Horizontal scroll is not adjusted since the page is always centered via flexbox
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prevScale = prevZoomRef.current / 100;
    const newScale = zoomLevel / 100;

    // Skip if zoom hasn't actually changed
    if (prevScale === newScale) return;

    // Get current scroll position and viewport dimensions
    const scrollTop = container.scrollTop;
    const viewportHeight = container.clientHeight;

    // Calculate the center point of the visible area in content coordinates (vertical only)
    const centerY = scrollTop + viewportHeight / 2;

    // Convert to document-space coordinates (before zoom)
    const docY = centerY / prevScale;

    // Calculate new scroll position to keep same document point centered
    const newCenterY = docY * newScale;
    const newScrollTop = newCenterY - viewportHeight / 2;

    // Apply new scroll position (prevent negative scroll)
    // Don't touch horizontal scroll - the page stays centered via CSS flexbox
    container.scrollTop = Math.max(0, newScrollTop);

    // Update ref for next change
    prevZoomRef.current = zoomLevel;
  }, [zoomLevel]);

  // Trackpad pinch-to-zoom support
  // Browsers report pinch gestures as wheel events with ctrlKey=true
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Only handle pinch-to-zoom (ctrlKey is set for pinch gestures)
      if (!e.ctrlKey) return;

      // Prevent default browser zoom
      e.preventDefault();

      // Calculate new zoom level based on scroll delta
      // deltaY is negative when pinching out (zoom in), positive when pinching in (zoom out)
      const delta = -e.deltaY * ZOOM_SENSITIVITY;
      const newZoom = Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomLevel + delta)));

      if (newZoom !== zoomLevel) {
        onZoomChange(newZoom);
      }
    };

    // Use passive: false to allow preventDefault
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [zoomLevel, onZoomChange]);

  // Use external page count if provided, otherwise use calculated
  const totalPages = externalTotalPages ?? calculatedPageCount;

  // Measure content and calculate page count
  const measureContent = useCallback(() => {
    if (!contentMeasureRef.current) return;

    const contentHeight = contentMeasureRef.current.scrollHeight;
    // Calculate pages: first page is full height, subsequent pages use content area only
    // This accounts for the top margin on the first page and ensures bottom margins
    let pages = 1;
    let remainingHeight = contentHeight - PAGE_HEIGHT_PX;

    while (remainingHeight > 0) {
      pages++;
      remainingHeight -= PAGE_CONTENT_HEIGHT_PX;
    }

    if (pages !== calculatedPageCount) {
      setCalculatedPageCount(pages);
    }
  }, [calculatedPageCount]);

  // Measure on mount and when data changes
  useEffect(() => {
    // Small delay to allow content to render
    const timer = setTimeout(measureContent, 100);
    return () => clearTimeout(timer);
  }, [measureContent, resumeData, sectionOrder, enabledSections, styleConfig]);

  // Also measure on window resize
  useEffect(() => {
    window.addEventListener('resize', measureContent);
    return () => window.removeEventListener('resize', measureContent);
  }, [measureContent]);

  return (
    <TooltipProvider>
      <div className="flex-1 flex flex-col bg-slate-100 min-w-0">
        {/* Canvas area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto no-scrollbar p-8"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Hidden measurement container - renders full content to calculate height */}
          <div
            ref={contentMeasureRef}
            aria-hidden="true"
            className="absolute opacity-0 pointer-events-none"
            style={{
              width: '8.5in',
              left: '-9999px',
              top: 0,
            }}
          >
            <ResumeCanvas
              data={resumeData}
              templateId={templateId}
              styleConfig={styleConfig}
              sectionOrder={sectionOrder}
              enabledSections={enabledSections}
              suggestions={[]}
              coachEnabled={false}
              onUpdateContactInfo={() => {}}
              onUpdateSummary={() => {}}
              onUpdateExperience={() => {}}
              onUpdateEducation={() => {}}
              onUpdateProjects={() => {}}
              onUpdateSkills={() => {}}
            />
          </div>

          {/* Resume pages - render all pages vertically */}
          <div className="flex flex-col" style={{ gap: '32px' }}>
            {Array.from({ length: totalPages }, (_, pageIndex) => (
              <div key={pageIndex} className="flex flex-col">
                {/* Page toolbar - above each page */}
                <div
                  className="flex items-center justify-between mb-3"
                  style={{
                    width: `calc(8.5in * ${scale})`,
                    minWidth: '300px',
                    maxWidth: '100%',
                  }}
                >
                  {/* Left side: Page info */}
                  <span className="text-sm text-slate-500">
                    Page {pageIndex + 1} {totalPages > 1 && `of ${totalPages}`}
                  </span>

                  {/* Right side: Action buttons */}
                  <div className="flex items-center gap-0.5">
                    {/* Visibility toggle */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
                          onClick={() => {
                            setHiddenPages((prev) => {
                              const next = new Set(prev);
                              if (next.has(pageIndex)) {
                                next.delete(pageIndex);
                              } else {
                                next.add(pageIndex);
                              }
                              return next;
                            });
                          }}
                        >
                          {!hiddenPages.has(pageIndex) ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {!hiddenPages.has(pageIndex)
                          ? 'Hide page from export'
                          : 'Show page in export'}
                      </TooltipContent>
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

                    {/* Delete - only show if more than one page */}
                    {totalPages > 1 && (
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
                    )}
                  </div>
                </div>

                {/* Page container wrapper */}
                <div
                  className="relative"
                  style={{
                    // Set the wrapper height to match the scaled page height
                    // This ensures proper layout spacing between pages
                    height: `calc(11in * ${scale})`,
                    width: `calc(8.5in * ${scale})`,
                  }}
                >
                  {/* Page container - the full 11in page with white background */}
                  <div
                    className={`bg-white shadow-2xl rounded-sm origin-top ${
                      hiddenPages.has(pageIndex) ? 'opacity-50' : ''
                    }`}
                    style={{
                      width: '8.5in',
                      height: '11in',
                      transform: `scale(${scale})`,
                      transformOrigin: 'top left',
                      position: 'relative',
                    }}
                  >
                    {/* Inner clip container - clips content to respect margins */}
                    <div
                      style={{
                        // First page: clip from top, leaving space only for bottom margin
                        // Subsequent pages: clip to content area only (with top & bottom margins)
                        height:
                          pageIndex === 0
                            ? `${PAGE_HEIGHT_PX - PAGE_MARGIN_INCHES * DPI}px`
                            : `${PAGE_CONTENT_HEIGHT_PX}px`,
                        overflow: 'hidden',
                        // Use absolute positioning to place clip area with top margin for subsequent pages
                        position: 'absolute',
                        top: pageIndex === 0 ? 0 : `${PAGE_MARGIN_INCHES * DPI}px`,
                        left: 0,
                        right: 0,
                      }}
                    >
                      {/* Content wrapper that shifts up based on page number */}
                      <div
                        style={{
                          // First page shows from top (already has top padding from ResumeCanvas)
                          // Subsequent pages shift up to show next portion of content
                          // We need to shift by: content shown on previous pages
                          // Page 1 shows PAGE_HEIGHT_PX - margin worth of content
                          // Each subsequent page shows PAGE_CONTENT_HEIGHT_PX worth
                          marginTop:
                            pageIndex === 0
                              ? 0
                              : `-${PAGE_HEIGHT_PX - PAGE_MARGIN_INCHES * DPI + PAGE_CONTENT_HEIGHT_PX * (pageIndex - 1)}px`,
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
                          onUpdateProjects={onUpdateProjects}
                          onUpdateSkills={onUpdateSkills}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
