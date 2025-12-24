'use client';

import React from 'react';

import { type ResumeData, ResumeDocument } from '@/components/resume/ResumeDocument';

import { PageCounter } from '../PageCounter';
import type { TemplateTheme } from '../templates/types';

interface LivePreviewProps {
  data: ResumeData;
  templateId: string;
  theme: TemplateTheme;
  className?: string;
}

export function LivePreview({
  data,
  templateId: _templateId,
  theme,
  className = '',
}: LivePreviewProps) {
  // TODO: Switch based on _templateId to use different templates
  return (
    <div className={`relative h-full flex flex-col ${className}`}>
      {/* Preview container with dark background */}
      <div className="flex-1 overflow-auto p-6" style={{ backgroundColor: theme.primaryColor }}>
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
            <ResumeDocument data={data} />
          </div>
        </div>
      </div>

      {/* Page counter - fixed at bottom right */}
      {/* TODO: Calculate actual page count based on rendered content height */}
      <div className="absolute bottom-6 right-6">
        <PageCounter currentPage={1} totalPages={1} />
      </div>
    </div>
  );
}
