/**
 * Engagement Helpers
 *
 * Database-dependent engagement calculation functions.
 * These functions require Convex QueryCtx and are extracted here
 * to avoid code duplication between:
 * - convex/engagement_cache.ts
 * - convex/migrations/backfill_engagement_cache.ts
 *
 * For pure scoring functions, see engagementScoring.ts
 */

import { Doc, Id } from '../_generated/dataModel';
import { QueryCtx } from '../_generated/server';
import {
  calculateEngagementScore,
  DEFAULT_QUALIFYING_EVENT_TYPES,
  determineEngagementStatus,
} from './engagementScoring';

export interface EngagementCriteria {
  period_days: number;
  min_events_in_period: number;
  qualifying_event_types?: string[];
}

/**
 * Calculate engagement score for a single student.
 * Returns the status and score based on the student's activity events.
 *
 * Uses centralized scoring functions from engagementScoring.ts
 * to ensure consistent scoring across the application.
 *
 * @param ctx - Convex query context
 * @param studentId - ID of the student user
 * @param definition - Engagement definition for the university (or null for defaults)
 * @returns Object with engagement status ('engaged' | 'moderate' | 'at_risk') and score (0-100)
 */
export async function calculateStudentEngagement(
  ctx: QueryCtx,
  studentId: Id<'users'>,
  definition: Doc<'engagement_definitions'> | null,
): Promise<{
  status: 'engaged' | 'moderate' | 'at_risk';
  score: number;
}> {
  // Default thresholds if no definition
  const engagedThreshold = definition?.engaged_threshold ?? 70;
  const atRiskThreshold = definition?.at_risk_threshold ?? 30;
  const criteria: EngagementCriteria = (definition?.criteria as EngagementCriteria) || {
    period_days: 14,
    min_events_in_period: 3,
  };

  const now = Date.now();
  const periodDays = criteria.period_days ?? 14;
  const cutoffTime = now - periodDays * 24 * 60 * 60 * 1000;

  // Get qualifying events for the student
  const allEvents = await ctx.db
    .query('activity_events')
    .withIndex('by_user_date', (q) => q.eq('user_id', studentId).gte('occurred_at', cutoffTime))
    .collect();

  const qualifyingEventTypes: readonly string[] =
    criteria.qualifying_event_types || DEFAULT_QUALIFYING_EVENT_TYPES;
  const qualifyingEvents = allEvents.filter((event) =>
    qualifyingEventTypes.includes(event.event_type),
  );

  const totalCount = qualifyingEvents.length;

  // Calculate unique days with activity
  const uniqueDaysSet = new Set<string>();
  for (const event of qualifyingEvents) {
    const dateStr = new Date(event.occurred_at).toISOString().slice(0, 10);
    uniqueDaysSet.add(dateStr);
  }
  const uniqueDays = uniqueDaysSet.size;

  // Find last qualifying event
  const lastEventAt =
    qualifyingEvents.length > 0
      ? qualifyingEvents.reduce((max, e) => Math.max(max, e.occurred_at), 0)
      : null;

  // Calculate days since last activity for recency scoring
  const daysSinceLastActivity =
    lastEventAt !== null ? Math.floor((now - lastEventAt) / (1000 * 60 * 60 * 24)) : null;

  // Use centralized scoring functions (source of truth in engagementScoring.ts)
  const score = calculateEngagementScore(
    {
      totalEventCount: totalCount,
      uniqueActiveDays: uniqueDays,
      daysSinceLastActivity,
    },
    {
      minEventsInPeriod: criteria.min_events_in_period ?? 3,
      periodDays,
    },
  );

  const status = determineEngagementStatus(score, engagedThreshold, atRiskThreshold);

  return { status, score };
}
