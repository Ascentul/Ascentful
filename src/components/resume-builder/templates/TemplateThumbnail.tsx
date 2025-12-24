'use client';

import React from 'react';

import { getTemplateComponent } from './registry';
import { SAMPLE_RESUME_DATA_SHORT } from './sample-data';
import type { StyleConfig, TemplateId } from './types';
import { DEFAULT_SIDEBAR_BG_COLOR } from './types';

// ============================================================================
// Template Thumbnail
// Renders a miniature version of a template with sample data
// Uses pure CSS transform for reliable scaling without JS calculations
// ============================================================================

interface TemplateThumbnailProps {
  templateId: TemplateId;
  styleConfig?: StyleConfig;
  className?: string;
}

export function TemplateThumbnail({
  templateId,
  styleConfig,
  className = '',
}: TemplateThumbnailProps) {
  const TemplateComponent = getTemplateComponent(templateId);

  // Template dimensions: 8.5in x 11in at 96dpi = 816px x 1056px
  // Using a fixed scale that works well with typical card sizes
  const templateWidth = 816;
  const templateHeight = 1056;
  const scale = 0.165; // Results in ~135px x 174px scaled size

  const scaledWidth = templateWidth * scale;
  const scaledHeight = templateHeight * scale;

  return (
    <div
      className={`template-thumbnail ${className}`}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: DEFAULT_SIDEBAR_BG_COLOR,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px',
      }}
    >
      {/* Wrapper that defines the visual size after scaling */}
      <div
        style={{
          width: scaledWidth,
          height: scaledHeight,
          position: 'relative',
          flexShrink: 0,
          boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
          borderRadius: '2px',
          overflow: 'hidden',
          backgroundColor: 'white',
        }}
      >
        {/* The actual template, scaled down */}
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            width: templateWidth,
            height: templateHeight,
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <TemplateComponent data={SAMPLE_RESUME_DATA_SHORT} styleConfig={styleConfig} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Template Thumbnail with Label
// Full card component for template selection
// ============================================================================

interface TemplateThumbnailCardProps {
  templateId: TemplateId;
  name: string;
  description?: string;
  selected?: boolean;
  onClick?: () => void;
  styleConfig?: StyleConfig;
}

export function TemplateThumbnailCard({
  templateId,
  name,
  description,
  selected = false,
  onClick,
  styleConfig,
}: TemplateThumbnailCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`
        relative flex flex-col rounded-xl border-2 transition-all overflow-hidden
        hover:border-primary-300 hover:shadow-md
        disabled:cursor-default disabled:hover:border-slate-200 disabled:hover:shadow-none
        ${selected ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-slate-200'}
      `}
    >
      {/* Preview */}
      <div className="aspect-[3/4] relative">
        <TemplateThumbnail templateId={templateId} styleConfig={styleConfig} />
        {selected && (
          <div className="absolute top-2 right-2 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
            <svg
              className="h-4 w-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Label */}
      <div className="p-3 bg-white">
        <h3 className="font-medium text-slate-900 text-sm">{name}</h3>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </div>
    </button>
  );
}
