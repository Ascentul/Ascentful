'use client';

import type {
  DensityOption,
  FontPairingId,
  HeadingStyle,
  StyleConfig,
  TemplateId,
} from '../../templates/types';
import { TEMPLATE_LAYOUTS } from '../../templates/types';
import { AccentColorPicker } from './AccentColorPicker';
import { DensityToggle } from './DensityToggle';
import { FontPairingPicker } from './FontPairingPicker';
import { HeadingStyleToggle } from './HeadingStyleToggle';
import { SidebarColorPicker } from './SidebarColorPicker';
import { TemplateSwitcher } from './TemplateSwitcher';

interface StyleTabProps {
  templateId: TemplateId;
  styleConfig: StyleConfig;
  onTemplateChange: (templateId: TemplateId) => void;
  onStyleChange: (config: Partial<StyleConfig>) => void;
}

export function StyleTab({
  templateId,
  styleConfig,
  onTemplateChange,
  onStyleChange,
}: StyleTabProps) {
  // Check if current template is a two-column layout
  const templateConfig = (() => {
    switch (templateId) {
      case 'clean':
        return TEMPLATE_LAYOUTS.clean;
      case 'bold':
        return TEMPLATE_LAYOUTS.bold;
      case 'minimal':
        return TEMPLATE_LAYOUTS.minimal;
      case 'classic':
        return TEMPLATE_LAYOUTS.classic;
      case 'ats':
        return TEMPLATE_LAYOUTS.ats;
      case 'modern':
      default:
        return TEMPLATE_LAYOUTS.modern;
    }
  })();
  const isTwoColumnLayout = templateConfig?.layoutType === 'two-column-sidebar';

  const handleFontChange = (font_pairing: FontPairingId) => {
    onStyleChange({ font_pairing });
  };

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
    <div className="p-6 space-y-8 overflow-y-auto h-full">
      {/* Template */}
      <TemplateSwitcher value={templateId} onChange={onTemplateChange} />

      <div className="border-t border-slate-100" />

      {/* Font Pairing */}
      <FontPairingPicker value={styleConfig.font_pairing} onChange={handleFontChange} />

      <div className="border-t border-slate-100" />

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
