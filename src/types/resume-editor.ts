/**
 * Resume Editor Types
 * Types for the 3-panel Canva + Notion + Grammarly style editor
 */

// ============================================================================
// Span ID System - For Grammarly-style suggestion targeting
// ============================================================================

export type SectionType =
  | 'summary'
  | 'experience'
  | 'education'
  | 'projects'
  | 'skills'
  | 'achievements'
  | 'contact';

export interface TextSpan {
  spanId: string; // Format: "{sectionType}-{itemId}-{field}-{lineIndex}"
  sectionType: SectionType;
  itemId?: string; // For array items (experience, education, etc.)
  field: string; // e.g., 'description', 'title', 'summary', 'name'
  lineIndex?: number; // For bullet points within description
  startOffset?: number; // Character offset within field (optional)
  endOffset?: number;
  text: string;
}

// ============================================================================
// Suggestions
// ============================================================================

export type SuggestionSeverity = 'critical' | 'improve' | 'optional';

export type SuggestionType =
  | 'metric' // Missing quantifiable results
  | 'verb' // Weak action verb
  | 'clarity' // Unclear or wordy text
  | 'ats' // ATS keyword optimization
  | 'consistency' // Formatting/style inconsistency
  | 'keyword' // Missing relevant keyword
  | 'length' // Too long/short
  | 'impact'; // Could be more impactful

export interface Suggestion {
  suggestionId: string;
  spanId: string;
  severity: SuggestionSeverity;
  type: SuggestionType;
  category: string; // Display category: "Impact", "ATS", "Clarity"
  message: string;
  proposedText: string | null; // null if no specific replacement
  explainText?: string;
  dismissed: boolean;
  appliedAt?: number;
}

// ============================================================================
// Scoring
// ============================================================================

export interface ResumeScore {
  overallScore: number; // 0-100
  subscores: ResumeSubscores;
  topFixes: TopFix[];
}

export interface ResumeSubscores {
  impact: number; // Action verbs, quantified achievements (0-100)
  clarity: number; // Readability, conciseness (0-100)
  relevance: number; // Job fit (0-100)
  ats: number; // Format compliance, keywords (0-100)
  consistency: number; // Style consistency (0-100)
}

export interface TopFix {
  fixId: string;
  suggestionIds: string[]; // May group multiple related suggestions
  message: string;
  impact: 'high' | 'medium' | 'low';
  sectionType?: SectionType;
}

// ============================================================================
// UI State
// ============================================================================

export type EditorTab = 'content' | 'style' | 'review';

export type CoachMode = 'score' | 'suggestions' | 'ats';

export type ZoomLevel = 'fit' | '50' | '75' | '100';

export const ZOOM_SCALES: Record<ZoomLevel, number> = {
  fit: 0.65,
  '50': 0.5,
  '75': 0.75,
  '100': 1.0,
};

// ============================================================================
// Undo/Redo
// ============================================================================

export type EditorActionType =
  | 'text_edit'
  | 'reorder_section'
  | 'reorder_item'
  | 'toggle_section'
  | 'apply_suggestion'
  | 'dismiss_suggestion'
  | 'style_change';

export interface EditorAction {
  id: string;
  type: EditorActionType;
  timestamp: number;
  before: unknown;
  after: unknown;
  spanId?: string;
  sectionId?: string;
  description: string;
}

// ============================================================================
// Editor State
// ============================================================================

export interface ThreePanelEditorState {
  // Active tab
  activeTab: EditorTab;

  // Coach panel
  coachEnabled: boolean;
  coachMode: CoachMode;

  // Zoom
  zoomLevel: ZoomLevel;

  // Selection
  selectedSectionId: string | null;
  selectedItemId: string | null;

  // Inline editing
  inlineEditingSpanId: string | null;

  // Suggestions
  suggestions: Suggestion[];
  dismissedSuggestionIds: Set<string>;

  // Score
  score: ResumeScore | null;
  scoreLoading: boolean;

  // History
  undoStack: EditorAction[];
  redoStack: EditorAction[];
}

// ============================================================================
// Section Configuration
// ============================================================================

export interface SectionConfig {
  id: string;
  label: string;
  icon?: string;
  required?: boolean;
  maxItems?: number;
}

export const SECTION_CONFIGS: Record<string, SectionConfig> = {
  contact: { id: 'contact', label: 'Contact Information', required: true },
  summary: { id: 'summary', label: 'Professional Summary' },
  experience: { id: 'experience', label: 'Work Experience' },
  education: { id: 'education', label: 'Education' },
  skills: { id: 'skills', label: 'Skills' },
  projects: { id: 'projects', label: 'Projects' },
  achievements: { id: 'achievements', label: 'Achievements' },
  certifications: { id: 'certifications', label: 'Certifications' },
};

// ============================================================================
// Suggestion Action Chips (Grammarly-style)
// ============================================================================

export type ActionChipType =
  | 'stronger'
  | 'shorter'
  | 'add_metric'
  | 'tailor'
  | 'accept'
  | 'dismiss';

export interface ActionChip {
  type: ActionChipType;
  label: string;
  icon?: string;
}

export const ACTION_CHIPS: ActionChip[] = [
  { type: 'stronger', label: 'Stronger' },
  { type: 'shorter', label: 'Shorter' },
  { type: 'add_metric', label: 'Add metric' },
  { type: 'tailor', label: 'Tailor' },
];

// ============================================================================
// Helper Types
// ============================================================================

export interface SuggestionCounts {
  [sectionId: string]: number;
}

export interface GroupedSuggestions {
  critical: Suggestion[];
  improve: Suggestion[];
  optional: Suggestion[];
}

export function groupSuggestionsBySeverity(suggestions: Suggestion[]): GroupedSuggestions {
  return {
    critical: suggestions.filter((s) => s.severity === 'critical'),
    improve: suggestions.filter((s) => s.severity === 'improve'),
    optional: suggestions.filter((s) => s.severity === 'optional'),
  };
}

export function getSuggestionCountsBySection(suggestions: Suggestion[]): SuggestionCounts {
  const counts: SuggestionCounts = {};
  for (const suggestion of suggestions) {
    const sectionType = suggestion.spanId.split('-')[0];
    counts[sectionType] = (counts[sectionType] || 0) + 1;
  }
  return counts;
}
