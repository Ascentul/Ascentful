'use client';

import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

import { TemplateThumbnail } from '../../templates/TemplateThumbnail';
import type { DensityOption, HeadingStyle, StyleConfig, TemplateId } from '../../templates/types';
import {
  DEFAULT_SIDEBAR_BG_COLOR,
  TEMPLATE_LAYOUTS,
  TEMPLATE_METADATA,
} from '../../templates/types';
import { AccentColorPicker } from './AccentColorPicker';
import { DensityToggle } from './DensityToggle';
import { HeadingStyleToggle } from './HeadingStyleToggle';
import { SidebarColorPicker } from './SidebarColorPicker';

interface TemplateSwitcherProps {
  value: TemplateId;
  onChange: (templateId: TemplateId) => void;
  styleConfig?: StyleConfig;
  onStyleChange?: (config: Partial<StyleConfig>) => void;
}

const TEMPLATES = Object.keys(TEMPLATE_METADATA) as TemplateId[];

export function TemplateSwitcher({
  value,
  onChange,
  styleConfig,
  onStyleChange,
}: TemplateSwitcherProps) {
  // Check if current template is a two-column layout
  const templateConfig = TEMPLATE_LAYOUTS[value] ?? TEMPLATE_LAYOUTS.modern;
  const isTwoColumnLayout = templateConfig?.layoutType === 'two-column-sidebar';

  return (
    <div className="space-y-6">
      {/* Template Selection */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-700">Template</h3>
        <div className="grid grid-cols-3 gap-3">
          {TEMPLATES.map((templateId) => {
            const meta = TEMPLATE_METADATA[templateId];
            if (!meta) return null;
            const isSelected = value === templateId;

            return (
              <button
                key={templateId}
                type="button"
                onClick={() => onChange(templateId)}
                className={cn(
                  'relative flex flex-col rounded-lg border-2 transition-all overflow-hidden',
                  'hover:border-primary-300 hover:shadow-sm',
                  isSelected ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-slate-200',
                )}
              >
                {/* Preview */}
                <div className="aspect-[3/4] bg-slate-50 relative">
                  <TemplateThumbnail templateId={templateId} styleConfig={styleConfig} />
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                </div>

                {/* Label */}
                <div className="p-2 bg-white text-center">
                  <span className="text-xs font-medium text-slate-700">{meta.name}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Theme Options - only show when styleConfig and onStyleChange are provided */}
      {styleConfig && onStyleChange && (
        <>
          <div className="border-t border-slate-200" />

          {/* Accent Color */}
          <AccentColorPicker
            value={styleConfig.accent_color}
            onChange={(accent_color) => onStyleChange({ accent_color })}
          />

          {/* Sidebar Background Color - only for two-column layouts */}
          {isTwoColumnLayout && (
            <>
              <div className="border-t border-slate-100" />
              <SidebarColorPicker
                value={styleConfig.sidebar_bg_color || DEFAULT_SIDEBAR_BG_COLOR}
                onChange={(sidebar_bg_color) => onStyleChange({ sidebar_bg_color })}
              />
            </>
          )}

          <div className="border-t border-slate-100" />

          {/* Density */}
          <DensityToggle
            value={styleConfig.density}
            onChange={(density: DensityOption) => onStyleChange({ density })}
          />

          <div className="border-t border-slate-100" />

          {/* Heading Style */}
          <HeadingStyleToggle
            value={styleConfig.heading_style}
            onChange={(heading_style: HeadingStyle) => onStyleChange({ heading_style })}
          />
        </>
      )}
    </div>
  );
}
