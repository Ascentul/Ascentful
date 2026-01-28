'use client';

import React, { useEffect, useRef, useState } from 'react';

import type { ResumeData } from '@/components/resume/ResumeDocument';

import { PageCounter } from '../PageCounter';
import { getTemplateComponent } from '../templates/registry';
import type { TemplateId, TemplateTheme } from '../templates/types';

interface LivePreviewProps {
  data: ResumeData;
  templateId: string;
  theme: TemplateTheme;
  className?: string;
}

// Standard US Letter page height in pixels at 96 DPI
const PAGE_HEIGHT_PX = 11 * 96; // 11 inches * 96 DPI = 1056px

export function LivePreview({ data, templateId, theme, className = '' }: LivePreviewProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(1);

  // Calculate page count based on rendered content height
  useEffect(() => {
    if (!contentRef.current) return;

    const calculatePages = () => {
      const contentHeight = contentRef.current?.scrollHeight || 0;
      // Account for margins and padding (approx 0.5in top/bottom = 96px total)
      const usableHeight = PAGE_HEIGHT_PX - 96;
      const pages = Math.max(1, Math.ceil(contentHeight / usableHeight));
      setPageCount(pages);
    };

    // Calculate initially
    calculatePages();

    // Recalculate on resize
    const resizeObserver = new ResizeObserver(calculatePages);
    resizeObserver.observe(contentRef.current);

    return () => resizeObserver.disconnect();
  }, [data]);

  // Get the template component based on templateId
  const TemplateComponent = getTemplateComponent(templateId as TemplateId);

  return (
    <div className={`relative h-full flex flex-col ${className}`}>
      {/* Preview container with dark background */}
      <div className="flex-1 overflow-auto p-6 bg-slate-700">
        <div className="flex items-start justify-center min-h-full">
          {/* Scaled resume preview */}
          <div
            className="bg-white shadow-2xl origin-top"
            style={{
              transform: 'scale(0.7)',
              transformOrigin: 'top center',
              width: '8.5in',
              minHeight: '11in',
            }}
          >
            <div ref={contentRef}>
              <TemplateComponent
                data={data}
                styleConfig={{
                  font_pairing: theme.font_pairing,
                  accent_color: theme.accent_color,
                  density: theme.density,
                  heading_style: theme.heading_style,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Page counter - fixed at bottom right */}
      <div className="absolute bottom-6 right-6">
        <PageCounter currentPage={1} totalPages={pageCount} />
      </div>
    </div>
  );
}
