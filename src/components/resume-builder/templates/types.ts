import type { ResumeData } from '@/components/resume/ResumeDocument';

// ============================================================================
// Resume Builder 2.0: Enhanced Template System
// ============================================================================

export type TemplateId = 'clean' | 'modern' | 'bold' | 'minimal' | 'classic' | 'ats';

// ============================================================================
// Layout System Types
// ============================================================================

export type LayoutType = 'single-column' | 'two-column-sidebar';

export type HeaderStyle = 'left' | 'center' | 'dark-bg';

export type SectionDivider = 'line' | 'double-line' | 'accent-line' | 'none';

export interface TemplateLayoutConfig {
  id: TemplateId;
  name: string;
  description: string;
  layoutType: LayoutType;
  headerStyle: HeaderStyle;
  sidebarPosition?: 'left' | 'right';
  accentColor: string;
  fontPairing: FontPairingId;
  sectionDivider: SectionDivider;
  density: DensityOption;
  fontWeight?: 'normal' | 'light';
}

// Font pairing IDs - expanded to 12 professional options
export type FontPairingId =
  | 'classic'
  | 'modern'
  | 'elegant'
  | 'minimal'
  | 'executive'
  | 'creative'
  | 'technical'
  | 'swiss'
  | 'editorial'
  | 'geometric'
  | 'humanist'
  | 'traditional';

// Font category for grouping in the picker UI
export type FontCategory = 'professional' | 'modern' | 'creative' | 'classic';

export type DensityOption = 'comfortable' | 'compact';

export type HeadingStyle = 'caps' | 'title_case';

export interface StyleConfig {
  font_pairing: FontPairingId;
  accent_color: string;
  sidebar_bg_color?: string; // Background color for two-column sidebar layouts
  density: DensityOption;
  heading_style: HeadingStyle;
}

export interface TemplateTheme extends StyleConfig {
  primaryColor: string; // Legacy support - maps to accent_color
}

export interface TemplateProps {
  data: ResumeData;
  // Prefer theme for template rendering; styleConfig is legacy/migration support.
  theme: TemplateTheme;
  className?: string;
  styleConfig?: StyleConfig;
}

export interface TemplateConfig {
  id: TemplateId;
  name: string;
  description: string;
  categories: ('all' | 'two-column' | 'ats' | 'free')[];
  component: React.ComponentType<TemplateProps>;
}

// Font Pairing Configuration
export interface FontPairing {
  heading: string;
  body: string;
  label: string;
  description: string;
  category: FontCategory;
  googleFonts?: string[]; // Google Font family names to load
}

// Font category metadata for UI grouping
export const FONT_CATEGORIES: Record<FontCategory, { label: string; description: string }> = {
  professional: {
    label: 'Professional',
    description: 'Clean and business-appropriate',
  },
  modern: {
    label: 'Modern',
    description: 'Contemporary and fresh',
  },
  creative: {
    label: 'Creative',
    description: 'Distinctive and expressive',
  },
  classic: {
    label: 'Classic',
    description: 'Timeless and traditional',
  },
};

export const FONT_PAIRINGS: Record<FontPairingId, FontPairing> = {
  // Professional Category
  minimal: {
    heading: 'Inter, system-ui, sans-serif',
    body: 'Inter, system-ui, sans-serif',
    label: 'Minimal',
    description: 'Clean and versatile',
    category: 'professional',
    googleFonts: ['Inter:wght@400;500;600;700'],
  },
  swiss: {
    heading: 'Helvetica Neue, Arial, sans-serif',
    body: 'Helvetica Neue, Arial, sans-serif',
    label: 'Swiss',
    description: 'Neutral and precise',
    category: 'professional',
  },
  executive: {
    heading: 'Roboto, sans-serif',
    body: 'Roboto, sans-serif',
    label: 'Executive',
    description: 'Corporate and polished',
    category: 'professional',
    googleFonts: ['Roboto:wght@300;400;500;700'],
  },

  // Modern Category
  modern: {
    heading: 'Montserrat, sans-serif',
    body: 'Open Sans, sans-serif',
    label: 'Modern',
    description: 'Contemporary and clean',
    category: 'modern',
    googleFonts: ['Montserrat:wght@400;500;600;700', 'Open+Sans:wght@400;500;600'],
  },
  geometric: {
    heading: 'Poppins, sans-serif',
    body: 'Nunito Sans, sans-serif',
    label: 'Geometric',
    description: 'Bold and structured',
    category: 'modern',
    googleFonts: ['Poppins:wght@400;500;600;700', 'Nunito+Sans:wght@400;600'],
  },
  humanist: {
    heading: 'Source Sans 3, sans-serif',
    body: 'Source Sans 3, sans-serif',
    label: 'Humanist',
    description: 'Warm and readable',
    category: 'modern',
    googleFonts: ['Source+Sans+3:wght@400;500;600;700'],
  },

  // Creative Category
  creative: {
    heading: 'Raleway, sans-serif',
    body: 'Lato, sans-serif',
    label: 'Creative',
    description: 'Stylish and distinctive',
    category: 'creative',
    googleFonts: ['Raleway:wght@400;500;600;700', 'Lato:wght@400;700'],
  },
  editorial: {
    heading: 'DM Sans, sans-serif',
    body: 'IBM Plex Sans, sans-serif',
    label: 'Editorial',
    description: 'Modern editorial style',
    category: 'creative',
    googleFonts: ['DM+Sans:wght@400;500;600;700', 'IBM+Plex+Sans:wght@400;500'],
  },
  technical: {
    heading: 'JetBrains Mono, monospace',
    body: 'Inter, sans-serif',
    label: 'Technical',
    description: 'Perfect for tech roles',
    category: 'creative',
    googleFonts: ['JetBrains+Mono:wght@400;500;600', 'Inter:wght@400;500;600'],
  },

  // Classic Category
  classic: {
    heading: 'Georgia, serif',
    body: 'Arial, sans-serif',
    label: 'Classic',
    description: 'Traditional and professional',
    category: 'classic',
  },
  elegant: {
    heading: 'Playfair Display, serif',
    body: 'Source Sans 3, sans-serif',
    label: 'Elegant',
    description: 'Sophisticated and refined',
    category: 'classic',
    googleFonts: ['Playfair+Display:wght@400;500;600;700', 'Source+Sans+3:wght@400;500;600'],
  },
  traditional: {
    heading: 'Merriweather, serif',
    body: 'Open Sans, sans-serif',
    label: 'Traditional',
    description: 'Scholarly and established',
    category: 'classic',
    googleFonts: ['Merriweather:wght@400;700', 'Open+Sans:wght@400;500;600'],
  },
};

// Get all Google Fonts URLs needed for a font pairing
export function getGoogleFontsUrl(fontPairingId: FontPairingId): string | null {
  const pairing = FONT_PAIRINGS[fontPairingId];
  if (!pairing.googleFonts || pairing.googleFonts.length === 0) return null;

  const families = pairing.googleFonts.join('&family=');
  return `https://fonts.googleapis.com/css2?family=${families}&display=swap`;
}

// Get all unique Google Fonts URLs for all pairings (for preloading)
export function getAllGoogleFontsUrl(): string {
  const allFonts = new Set<string>();
  Object.values(FONT_PAIRINGS).forEach((pairing) => {
    pairing.googleFonts?.forEach((font) => allFonts.add(font));
  });

  const families = Array.from(allFonts).join('&family=');
  return `https://fonts.googleapis.com/css2?family=${families}&display=swap`;
}

// Get font pairings grouped by category
export function getFontPairingsByCategory(): Record<
  FontCategory,
  { id: FontPairingId; pairing: FontPairing }[]
> {
  const grouped: Record<FontCategory, { id: FontPairingId; pairing: FontPairing }[]> = {
    professional: [],
    modern: [],
    creative: [],
    classic: [],
  };

  (Object.entries(FONT_PAIRINGS) as [FontPairingId, FontPairing][]).forEach(([id, pairing]) => {
    grouped[pairing.category].push({ id, pairing });
  });

  return grouped;
}

// Accent Color Configuration
export interface AccentColor {
  value: string;
  label: string;
}

export const ACCENT_COLORS: AccentColor[] = [
  { value: '#5371FF', label: 'Blue' }, // Brand default
  { value: '#115e59', label: 'Teal' },
  { value: '#7c3aed', label: 'Purple' },
  { value: '#dc2626', label: 'Red' },
  { value: '#ea580c', label: 'Orange' },
  { value: '#16a34a', label: 'Green' },
  { value: '#374151', label: 'Slate' },
  { value: '#000000', label: 'Black' },
];

// Sidebar Background Color Configuration (for two-column layouts)
export interface SidebarBgColor {
  value: string;
  label: string;
}

export const SIDEBAR_BG_COLORS: SidebarBgColor[] = [
  { value: '#f8fafc', label: 'Light Gray' }, // Default slate-50
  { value: '#f1f5f9', label: 'Gray' }, // slate-100
  { value: '#e2e8f0', label: 'Medium Gray' }, // slate-200
  { value: '#1e293b', label: 'Dark Slate' }, // slate-800
  { value: '#111827', label: 'Charcoal' }, // gray-900
  { value: '#eff6ff', label: 'Light Blue' }, // blue-50
  { value: '#ecfdf5', label: 'Light Green' }, // emerald-50
  { value: '#fef3c7', label: 'Light Amber' }, // amber-100
];

export const DEFAULT_SIDEBAR_BG_COLOR = SIDEBAR_BG_COLORS[0]?.value ?? '#f8fafc';

// Template metadata (derived from TEMPLATE_LAYOUTS for consistency)
export const TEMPLATE_METADATA: Record<TemplateId, { name: string; description: string }> = {
  clean: { name: 'Clean', description: 'Simple and elegant' },
  modern: { name: 'Modern', description: 'Contemporary design' },
  bold: { name: 'Bold', description: 'Strong typography' },
  minimal: { name: 'Minimal', description: 'Whitespace-focused' },
  classic: { name: 'Classic', description: 'Traditional format' },
  ats: { name: 'ATS Executive', description: 'ATS-friendly two-column' },
};

// Template layout configurations
export const TEMPLATE_LAYOUTS: Record<TemplateId, TemplateLayoutConfig> = {
  clean: {
    id: 'clean',
    name: 'Clean',
    description: 'Simple and elegant',
    layoutType: 'single-column',
    headerStyle: 'left',
    accentColor: '#4B5563', // slate-600
    fontPairing: 'minimal',
    sectionDivider: 'line',
    density: 'comfortable',
  },
  modern: {
    id: 'modern',
    name: 'Modern',
    description: 'Contemporary design',
    layoutType: 'single-column',
    headerStyle: 'left',
    accentColor: '#5371FF', // brand blue
    fontPairing: 'modern',
    sectionDivider: 'accent-line',
    density: 'comfortable',
  },
  bold: {
    id: 'bold',
    name: 'Bold',
    description: 'Strong typography',
    layoutType: 'single-column',
    headerStyle: 'dark-bg',
    accentColor: '#111827', // gray-900
    fontPairing: 'modern',
    sectionDivider: 'line',
    density: 'compact',
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Whitespace-focused',
    layoutType: 'single-column',
    headerStyle: 'left',
    accentColor: '#9CA3AF', // gray-400
    fontPairing: 'minimal',
    sectionDivider: 'none',
    density: 'comfortable',
    fontWeight: 'light',
  },
  classic: {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional format',
    layoutType: 'single-column',
    headerStyle: 'center',
    accentColor: '#374151', // gray-700
    fontPairing: 'classic',
    sectionDivider: 'double-line',
    density: 'comfortable',
  },
  ats: {
    id: 'ats',
    name: 'ATS Executive',
    description: 'ATS-friendly two-column',
    layoutType: 'two-column-sidebar',
    headerStyle: 'left',
    sidebarPosition: 'left',
    accentColor: '#1f2937', // gray-800
    fontPairing: 'minimal',
    sectionDivider: 'line',
    density: 'compact',
  },
};

// Template options for selection UI
export const TEMPLATE_OPTIONS = Object.values(TEMPLATE_LAYOUTS);

// Legacy support
export const PRESET_COLORS = ACCENT_COLORS.map((c) => c.value);

// Default configurations
export const DEFAULT_STYLE_CONFIG: StyleConfig = {
  font_pairing: 'modern',
  accent_color: '#5371FF',
  density: 'comfortable',
  heading_style: 'title_case',
};

export const DEFAULT_THEME: TemplateTheme = {
  ...DEFAULT_STYLE_CONFIG,
  primaryColor: DEFAULT_STYLE_CONFIG.accent_color,
};

// Helper to convert StyleConfig to TemplateTheme
export function styleConfigToTheme(config: StyleConfig): TemplateTheme {
  return {
    ...config,
    primaryColor: config.accent_color,
  };
}

// Helper to get CSS variables for a style config
export function getStyleVariables(config: StyleConfig): Record<string, string> {
  const fontPairing = Object.prototype.hasOwnProperty.call(FONT_PAIRINGS, config.font_pairing)
    ? FONT_PAIRINGS[config.font_pairing]
    : FONT_PAIRINGS.classic;

  return {
    '--font-heading': fontPairing.heading,
    '--font-body': fontPairing.body,
    '--color-accent': config.accent_color,
    // Density scale: 1 = comfortable, 0.85 = compact (~15% tighter spacing).
    '--density': config.density === 'comfortable' ? '1' : '0.85',
    '--heading-transform': config.heading_style === 'caps' ? 'uppercase' : 'none',
    '--heading-letter-spacing': config.heading_style === 'caps' ? '0.05em' : 'normal',
  };
}
