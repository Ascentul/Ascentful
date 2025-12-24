'use client';

import type { DensityOption, HeadingStyle, StyleConfig, TemplateId } from '../../templates/types';
import { TEMPLATE_LAYOUTS } from '../../templates/types';
import { AccentColorPicker } from './AccentColorPicker';
import { DensityToggle } from './DensityToggle';
import { HeadingStyleToggle } from './HeadingStyleToggle';
import { SidebarColorPicker } from './SidebarColorPicker';

interface StyleTabProps {
  templateId: TemplateId;
  styleConfig: StyleConfig;
  onStyleChange: (config: Partial<StyleConfig>) => void;
}

export function StyleTab({ templateId, styleConfig, onStyleChange }: StyleTabProps) {
  // Check if current template is a two-column layout
  const templateConfig = TEMPLATE_LAYOUTS[templateId] ?? TEMPLATE_LAYOUTS.modern;
  const isTwoColumnLayout = templateConfig?.layoutType === 'two-column-sidebar';

  const handleColorChange = (accent_color: string) => {
    onStyleChange({ accent_color });
  };

  const handleSidebarColorChange = (sidebar_bg_color: string) => {
    onStyleChange({ sidebar_bg_color });
  };

  const handleDensityChange = (density: DensityOption) => {
    onStyleChange({ density });
  };

  const handleHeadingStyleChange = (heading_style: HeadingStyle) => {
    onStyleChange({ heading_style });
  };

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full">
      {/* Accent Color */}
      <AccentColorPicker value={styleConfig.accent_color} onChange={handleColorChange} />

      {/* Sidebar Background Color - only for two-column layouts */}
      {isTwoColumnLayout && (
        <>
          <div className="border-t border-slate-100" />
          <SidebarColorPicker
            value={styleConfig.sidebar_bg_color || '#f8fafc'}
            onChange={handleSidebarColorChange}
          />
        </>
      )}

      <div className="border-t border-slate-100" />

      {/* Density */}
      <DensityToggle value={styleConfig.density} onChange={handleDensityChange} />

      <div className="border-t border-slate-100" />

      {/* Heading Style */}
      <HeadingStyleToggle value={styleConfig.heading_style} onChange={handleHeadingStyleChange} />
    </div>
  );
}
