/**
 * Engagement Scoring Utilities
 *
 * Pure functions for calculating engagement scores and status.
 * These are extracted from the engagement definitions to enable:
 * - Direct unit testing without database mocking
 * - Reuse across different Convex functions
 *
 * IMPORTANT: These functions contain the source-of-truth scoring logic.
 * Tests should import these functions directly rather than re-implementing the logic.
 */

/**
 * Default event types that count toward engagement scoring.
 * This is the single source of truth - import this constant in all modules.
 */
export const DEFAULT_QUALIFYING_EVENT_TYPES = [
  'login',
  'application_created',
  'application_updated',
  'application_stage_changed',
  'resume_created',
  'resume_updated',
  'cover_letter_created',
  'cover_letter_updated',
  'goal_created',
  'goal_updated',
  'goal_completed',
  'coach_conversation_started',
  'coach_message_sent',
  'contact_added',
  'project_created',
] as const;

/**
 * Scoring weights configuration
 */
export const SCORING_WEIGHTS = {
  /** Maximum points from event count (50%) */
  EVENT_SCORE_MAX: 50,
  /** Maximum points from active days (30%) */
  ACTIVE_DAYS_SCORE_MAX: 30,
  /** Maximum points from recency (20%) */
  RECENCY_SCORE_MAX: 20,
} as const;

/**
 * Recency thresholds in days and their corresponding scores
 */
export const RECENCY_THRESHOLDS = [
  { maxDays: 1, score: 20 },
  { maxDays: 3, score: 15 },
  { maxDays: 7, score: 10 },
  { maxDays: 14, score: 5 },
] as const;

/**
 * Calculate the event count component of the engagement score.
 *
 * @param totalCount - Number of qualifying events in the period
 * @param idealEvents - Target number of events for full score
 * @returns Score from 0 to SCORING_WEIGHTS.EVENT_SCORE_MAX
 */
export function calculateEventScore(totalCount: number, idealEvents: number): number {
  if (idealEvents <= 0) return 0;
  return Math.min(
    SCORING_WEIGHTS.EVENT_SCORE_MAX,
    (totalCount / idealEvents) * SCORING_WEIGHTS.EVENT_SCORE_MAX,
  );
}

/**
 * Calculate the active days component of the engagement score.
 *
 * @param uniqueDays - Number of unique days with activity
 * @param idealActiveDays - Target number of active days for full score
 * @returns Score from 0 to SCORING_WEIGHTS.ACTIVE_DAYS_SCORE_MAX
 */
export function calculateActiveDaysScore(uniqueDays: number, idealActiveDays: number): number {
  if (idealActiveDays <= 0) return 0;
  return Math.min(
    SCORING_WEIGHTS.ACTIVE_DAYS_SCORE_MAX,
    (uniqueDays / idealActiveDays) * SCORING_WEIGHTS.ACTIVE_DAYS_SCORE_MAX,
  );
}

/**
 * Calculate the recency component of the engagement score.
 * More recent activity yields higher scores.
 *
 * @param daysSinceActivity - Days since last qualifying activity (null if no activity)
 * @returns Score from 0 to SCORING_WEIGHTS.RECENCY_SCORE_MAX
 */
export function calculateRecencyScore(daysSinceActivity: number | null): number {
  if (daysSinceActivity === null) return 0;

  for (const threshold of RECENCY_THRESHOLDS) {
    if (daysSinceActivity <= threshold.maxDays) {
      return threshold.score;
    }
  }
  return 0;
}

/**
 * Calculate the total engagement score from individual components.
 *
 * @param eventScore - Score from event count (0-50)
 * @param activeDaysScore - Score from active days (0-30)
 * @param recencyScore - Score from recency (0-20)
 * @returns Total score from 0 to 100, rounded to nearest integer
 */
export function calculateTotalEngagementScore(
  eventScore: number,
  activeDaysScore: number,
  recencyScore: number,
): number {
  return Math.round(eventScore + activeDaysScore + recencyScore);
}

/**
 * Calculate engagement score with all components from raw metrics.
 * Convenience function that combines all scoring components.
 *
 * @param metrics - Raw activity metrics
 * @param config - Scoring configuration
 * @returns Total engagement score (0-100)
 */
export function calculateEngagementScore(
  metrics: {
    totalEventCount: number;
    uniqueActiveDays: number;
    daysSinceLastActivity: number | null;
  },
  config: {
    minEventsInPeriod: number;
    periodDays: number;
  },
): number {
  const idealEvents = config.minEventsInPeriod * 2;
  const idealActiveDays = Math.min(config.periodDays, 7);

  const eventScore = calculateEventScore(metrics.totalEventCount, idealEvents);
  const activeDaysScore = calculateActiveDaysScore(metrics.uniqueActiveDays, idealActiveDays);
  const recencyScore = calculateRecencyScore(metrics.daysSinceLastActivity);

  return calculateTotalEngagementScore(eventScore, activeDaysScore, recencyScore);
}

/**
 * Determine engagement status based on score and thresholds.
 *
 * @param score - Engagement score (0-100)
 * @param engagedThreshold - Score at or above which status is "engaged"
 * @param atRiskThreshold - Score at or below which status is "at_risk"
 * @returns Engagement status: 'engaged', 'moderate', or 'at_risk'
 */
export function determineEngagementStatus(
  score: number,
  engagedThreshold: number,
  atRiskThreshold: number,
): 'engaged' | 'moderate' | 'at_risk' {
  if (score >= engagedThreshold) return 'engaged';
  if (score <= atRiskThreshold) return 'at_risk';
  return 'moderate';
}

/**
 * Calculate percentage with safe division.
 *
 * @param part - The numerator
 * @param total - The denominator
 * @returns Rounded percentage (0-100), or 0 if total is 0
 */
export function calculatePercentage(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}
