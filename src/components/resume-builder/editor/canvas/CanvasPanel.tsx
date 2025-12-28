'use client';

import { Eye, EyeOff, Files, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  Achievement,
  Certification,
  Education,
  Experience,
  Project,
  ResumeData,
} from '@/components/resume/ResumeDocument';
import type { StyleConfig, TemplateId } from '@/components/resume-builder/templates/types';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Suggestion as AISuggestion } from '@/lib/ai/schemas';
import type { Suggestion, ZoomLevel } from '@/types/resume-editor';
import { getZoomScale } from '@/types/resume-editor';

import type { EditorMode } from '../EditorTopBar';
import { ResumeCanvas } from './ResumeCanvas';

// Page dimensions in pixels (at 96 DPI)
const PAGE_HEIGHT_INCHES = 11;
const PAGE_MARGIN_INCHES = 0.7; // Standard resume margin (matches ResumeCanvas padding)
const DPI = 96;
const PAGE_HEIGHT_PX = PAGE_HEIGHT_INCHES * DPI; // 1056px
// Content area height excludes top and bottom margins
const PAGE_CONTENT_HEIGHT_PX = (PAGE_HEIGHT_INCHES - PAGE_MARGIN_INCHES * 2) * DPI; // ~921px usable
const TOP_MARGIN_PX = PAGE_MARGIN_INCHES * DPI; // ~67px

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
  onUpdateAchievements?: (achievements: Achievement[]) => void;
  onUpdateCertifications?: (certifications: Certification[]) => void;
  // Page toolbar actions (optional)
  onDuplicatePage?: (pageIndex: number) => void;
  onDeletePage?: (pageIndex: number) => void;
  totalPages?: number;
  // Selection state from outline panel
  selectedSectionId?: string | null;
  selectedItemId?: string | null;
  // Missing field spanIds for form validation-style highlighting
  missingSpanIds?: Set<string>;
  // Editor/Review mode toggle
  editorMode?: EditorMode;
  aiSuggestions?: AISuggestion[];
  // Bidirectional linking - highlight track changes for focused suggestion
  focusedSuggestionId?: string | null;
  onTrackChangeClick?: (suggestionId: string) => void;
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
  onUpdateAchievements,
  onUpdateCertifications,
  onDuplicatePage,
  onDeletePage,
  totalPages: externalTotalPages,
  selectedSectionId,
  selectedItemId,
  missingSpanIds,
  editorMode = 'editor',
  aiSuggestions,
  focusedSuggestionId,
  onTrackChangeClick,
}: CanvasPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentMeasureRef = useRef<HTMLDivElement>(null);
  const prevZoomRef = useRef<number>(zoomLevel);
  const scale = getZoomScale(zoomLevel);
  const [hiddenPages, setHiddenPages] = useState<Set<number>>(new Set());

  // Multi-page state - detect content overflow
  const [calculatedPageCount, setCalculatedPageCount] = useState(1);
  // Store calculated page break positions (y-offsets where each page starts)
  const [pageBreaks, setPageBreaks] = useState<number[]>([0]);

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

  // Measure content and calculate intelligent page breaks that don't cut through sections
  const measureContent = useCallback(() => {
    if (!contentMeasureRef.current) return;

    const container = contentMeasureRef.current;
    const contentHeight = container.scrollHeight;

    // Find all section and entry elements that should not be broken
    const breakableElements = container.querySelectorAll('section, [class*="group/entry"]');

    // Build array of element boundaries (top and bottom positions)
    const elementBoundaries: Array<{ top: number; bottom: number }> = [];
    breakableElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      // Get position relative to the container
      const top = rect.top - containerRect.top;
      const bottom = rect.bottom - containerRect.top;
      elementBoundaries.push({ top, bottom });
    });

    // Sort by top position
    elementBoundaries.sort((a, b) => a.top - b.top);

    // Calculate page breaks intelligently
    const breaks: number[] = [0]; // First page always starts at 0
    let currentPageEnd = PAGE_HEIGHT_PX - TOP_MARGIN_PX; // First page ends here (accounting for bottom margin)

    // If content fits on one page, no need for complex calculations
    if (contentHeight <= PAGE_HEIGHT_PX) {
      setPageBreaks([0]);
      setCalculatedPageCount(1);
      return;
    }

    // Find optimal break points
    while (currentPageEnd < contentHeight) {
      // Find the best break point - look for an element boundary near currentPageEnd
      let bestBreakPoint = currentPageEnd;

      // Look for elements that would be cut by currentPageEnd
      for (const boundary of elementBoundaries) {
        // If an element spans across the page break
        if (boundary.top < currentPageEnd && boundary.bottom > currentPageEnd) {
          // Move the break point up to before this element starts
          // But only if it doesn't leave too much empty space (max 200px)
          if (currentPageEnd - boundary.top < 200) {
            bestBreakPoint = boundary.top;
          }
          break; // Found a conflicting element, use this break point
        }
      }

      // Ensure we're making progress (avoid infinite loops)
      if (bestBreakPoint <= breaks[breaks.length - 1]) {
        bestBreakPoint = currentPageEnd;
      }

      breaks.push(bestBreakPoint);
      // Next page ends PAGE_CONTENT_HEIGHT_PX after this break
      currentPageEnd = bestBreakPoint + PAGE_CONTENT_HEIGHT_PX;
    }

    setPageBreaks(breaks);
    setCalculatedPageCount(breaks.length);
  }, []);

  // Measure on mount and when data changes
  useEffect(() => {
    // Small delay to allow content to render
    const timer = setTimeout(measureContent, 100);
    return () => clearTimeout(timer);
  }, [measureContent, resumeData, sectionOrder, enabledSections, styleConfig]);

  // Also measure on window resize
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const debouncedMeasure = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(measureContent, 150);
    };
    window.addEventListener('resize', debouncedMeasure);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', debouncedMeasure);
    };
  }, [measureContent]);

  // Helper to calculate clip height for each page based on intelligent page breaks
  const getClipHeight = (pageIndex: number): string => {
    const pageStart = pageBreaks[pageIndex] ?? 0;
    const pageEnd = pageBreaks[pageIndex + 1] ?? pageStart + PAGE_CONTENT_HEIGHT_PX;
    const clipHeight = pageEnd - pageStart;
    // Cap at content area height and account for margins
    return pageIndex === 0
      ? `${Math.min(clipHeight, PAGE_HEIGHT_PX - TOP_MARGIN_PX)}px`
      : `${Math.min(clipHeight, PAGE_CONTENT_HEIGHT_PX)}px`;
  };

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
              onUpdateAchievements={() => {}}
              onUpdateCertifications={() => {}}
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
                          aria-label={
                            !hiddenPages.has(pageIndex)
                              ? 'Hide page from export'
                              : 'Show page in export'
                          }
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
                          aria-label="Duplicate page"
                          onClick={() => onDuplicatePage?.(pageIndex)}
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
                            aria-label="Delete page"
                            onClick={() => onDeletePage?.(pageIndex)}
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
                        // Use intelligent page breaks to determine clip height
                        // First page: from top to first break point (or full page minus margin)
                        // Subsequent pages: from break point to next break point (or content height)
                        height: getClipHeight(pageIndex),
                        overflow: 'hidden',
                        // Use absolute positioning to place clip area with top margin for subsequent pages
                        position: 'absolute',
                        top: pageIndex === 0 ? 0 : `${TOP_MARGIN_PX}px`,
                        left: 0,
                        right: 0,
                      }}
                    >
                      {/* Content wrapper that shifts up based on intelligent page breaks */}
                      <div
                        style={{
                          // Use the calculated page break position to shift content
                          marginTop: pageIndex === 0 ? 0 : `-${pageBreaks[pageIndex] ?? 0}px`,
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
                          onUpdateAchievements={onUpdateAchievements}
                          onUpdateCertifications={onUpdateCertifications}
                          selectedSectionId={selectedSectionId}
                          selectedItemId={selectedItemId}
                          missingSpanIds={missingSpanIds}
                          editorMode={editorMode}
                          aiSuggestions={aiSuggestions}
                          focusedSuggestionId={focusedSuggestionId}
                          onTrackChangeClick={onTrackChangeClick}
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
