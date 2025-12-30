'use client';

import { memo } from 'react';

/**
 * AuroraBackground - Windows 11-style animated aurora gradient
 * Positioned fixed behind all content with brand purple hues
 */
export const AuroraBackground = memo(function AuroraBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {/* Base layer */}
      <div className="absolute inset-0 bg-[#F1F3F9]" />

      {/* Aurora mesh gradients - smooth, textureless effect */}
      <div className="aurora-mesh" />
      <div className="aurora-glow-1" />
      <div className="aurora-glow-2" />
    </div>
  );
});
