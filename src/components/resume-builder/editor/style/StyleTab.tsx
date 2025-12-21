'use client';

import type {
  DensityOption,
  FontPairingId,
  HeadingStyle,
  StyleConfig,
  TemplateId,
} from '../../templates/types';
import { AccentColorPicker } from './AccentColorPicker';
import { DensityToggle } from './DensityToggle';
import { FontPairingPicker } from './FontPairingPicker';
import { HeadingStyleToggle } from './HeadingStyleToggle';
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
  const handleFontChange = (font_pairing: FontPairingId) => {
    onStyleChange({ font_pairing });
  };

  const handleColorChange = (accent_color: string) => {
    onStyleChange({ accent_color });
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

      <div className="border-t border-slate-100" />

      {/* Density */}
      <DensityToggle value={styleConfig.density} onChange={handleDensityChange} />

      <div className="border-t border-slate-100" />

      {/* Heading Style */}
      <HeadingStyleToggle value={styleConfig.heading_style} onChange={handleHeadingStyleChange} />
    </div>
  );
}
