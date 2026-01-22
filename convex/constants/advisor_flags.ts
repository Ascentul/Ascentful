/**
 * Centralized advisor feature flags
 *
 * Used by:
 * - convex/enable_advisor_features.ts (enable/disable all flags)
 * - convex/feature_flags.ts (initialize default flags)
 */

export const ADVISOR_FLAGS = [
  'advisor.dashboard',
  'advisor.students',
  'advisor.advising',
  'advisor.reviews',
  'advisor.applications',
  'advisor.analytics',
  'advisor.support',
  // Engagement Signals System (Phase 2)
  'advisor.signals', // Enables signal queue and rules for advisors
  'advisor.signals.auto_evaluate', // Enables automatic signal rule evaluation
  'advisor.signals.auto_followup', // Enables auto-creation of follow-ups from signals
] as const;

export type AdvisorFlag = (typeof ADVISOR_FLAGS)[number];
