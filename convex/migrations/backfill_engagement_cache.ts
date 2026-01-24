/**
 * Backfill Migration: Populate engagement cache for all students
 *
 * This migration calculates and caches engagement scores for all students
 * who don't have cached values yet.
 *
 * Run via: npx convex run migrations/backfill_engagement_cache:backfillAllStudents
 *
 * For large universities, run per-university:
 * npx convex run migrations/backfill_engagement_cache:backfillUniversity --args '{"universityId": "YOUR_ID"}'
 */

import { v } from 'convex/values';

import { Doc, Id } from '../_generated/dataModel';
import { internalMutation, internalQuery, QueryCtx } from '../_generated/server';

// Default qualifying event types for engagement scoring
const DEFAULT_QUALIFYING_EVENT_TYPES = [
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
  'networking_contact_added',
  'project_created',
];

interface EngagementCriteria {
  period_days: number;
  min_events_in_period: number;
  qualifying_event_types?: string[];
}

/**
 * Calculate engagement score for a single student.
 * Duplicated from engagement_cache.ts to avoid circular dependency.
 */
async function calculateStudentEngagement(
  ctx: QueryCtx,
  studentId: Id<'users'>,
  definition: Doc<'engagement_definitions'> | null,
): Promise<{
  status: 'engaged' | 'moderate' | 'at_risk';
  score: number;
}> {
  const engagedThreshold = definition?.engaged_threshold ?? 70;
  const atRiskThreshold = definition?.at_risk_threshold ?? 30;
  const criteria: EngagementCriteria = (definition?.criteria as EngagementCriteria) || {
    period_days: 14,
    min_events_in_period: 3,
  };

  const now = Date.now();
  const periodDays = criteria.period_days || 14;
  const cutoffTime = now - periodDays * 24 * 60 * 60 * 1000;

  const allEvents = await ctx.db
    .query('activity_events')
    .withIndex('by_user_date', (q) => q.eq('user_id', studentId).gte('occurred_at', cutoffTime))
    .collect();

  const qualifyingEventTypes = criteria.qualifying_event_types || DEFAULT_QUALIFYING_EVENT_TYPES;
  const qualifyingEvents = allEvents.filter((event) =>
    qualifyingEventTypes.includes(event.event_type),
  );

  const totalCount = qualifyingEvents.length;

  const uniqueDaysSet = new Set<string>();
  for (const event of qualifyingEvents) {
    const dateStr = new Date(event.occurred_at).toISOString().slice(0, 10);
    uniqueDaysSet.add(dateStr);
  }
  const uniqueDays = uniqueDaysSet.size;

  const lastEventAt =
    qualifyingEvents.length > 0
      ? qualifyingEvents.reduce((max, e) => Math.max(max, e.occurred_at), 0)
      : null;

  const minEvents = criteria.min_events_in_period || 3;
  const idealEvents = minEvents * 2;

  const eventScore = Math.min(50, (totalCount / idealEvents) * 50);
  const idealActiveDays = Math.min(periodDays, 7);
  const activeDaysScore = Math.min(30, (uniqueDays / idealActiveDays) * 30);

  let recencyScore = 0;
  if (lastEventAt) {
    const daysSince = Math.floor((now - lastEventAt) / (1000 * 60 * 60 * 24));
    if (daysSince <= 1) recencyScore = 20;
    else if (daysSince <= 3) recencyScore = 15;
    else if (daysSince <= 7) recencyScore = 10;
    else if (daysSince <= 14) recencyScore = 5;
  }

  const score = Math.round(eventScore + activeDaysScore + recencyScore);

  let status: 'engaged' | 'moderate' | 'at_risk';
  if (score >= engagedThreshold) {
    status = 'engaged';
  } else if (score <= atRiskThreshold) {
    status = 'at_risk';
  } else {
    status = 'moderate';
  }

  return { status, score };
}

/**
 * Get stats on backfill progress
 */
export const getBackfillStats = internalQuery({
  args: {},
  handler: async (ctx) => {
    const students = await ctx.db
      .query('users')
      .filter((q) => q.eq(q.field('role'), 'student'))
      .collect();

    const withCache = students.filter((s) => s.engagement_status !== undefined);
    const withoutCache = students.filter((s) => s.engagement_status === undefined);

    return {
      total: students.length,
      withCache: withCache.length,
      withoutCache: withoutCache.length,
      percentComplete:
        students.length > 0 ? Math.round((withCache.length / students.length) * 100) : 100,
    };
  },
});

/**
 * Backfill engagement cache for a single university.
 * Call this repeatedly until hasMore is false.
 */
export const backfillUniversity = internalMutation({
  args: {
    universityId: v.id('universities'),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 50;

    // Get engagement definition for this university
    const definitions = await ctx.db
      .query('engagement_definitions')
      .withIndex('by_university_active', (q) =>
        q.eq('university_id', args.universityId).eq('is_active', true),
      )
      .collect();
    const definition = definitions.find((d) => d.is_default) || definitions[0] || null;

    // Get students without cached engagement
    const students = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .filter((q) =>
        q.and(q.eq(q.field('role'), 'student'), q.eq(q.field('engagement_status'), undefined)),
      )
      .take(batchSize + 1);

    const hasMore = students.length > batchSize;
    const studentsToProcess = hasMore ? students.slice(0, batchSize) : students;

    let updated = 0;
    for (const student of studentsToProcess) {
      const { status, score } = await calculateStudentEngagement(ctx, student._id, definition);

      await ctx.db.patch(student._id, {
        engagement_status: status,
        engagement_score: score,
        engagement_calculated_at: Date.now(),
      });
      updated++;
    }

    return { updated, hasMore };
  },
});

/**
 * Get list of universities that need backfill
 */
export const getUniversitiesNeedingBackfill = internalQuery({
  args: {},
  handler: async (ctx) => {
    const universities = await ctx.db
      .query('universities')
      .filter((q) => q.or(q.eq(q.field('status'), 'active'), q.eq(q.field('status'), 'trial')))
      .collect();

    const needsBackfill: Array<{ id: string; name: string; studentsWithoutCache: number }> = [];

    for (const university of universities) {
      const studentsWithoutCache = await ctx.db
        .query('users')
        .withIndex('by_university', (q) => q.eq('university_id', university._id))
        .filter((q) =>
          q.and(q.eq(q.field('role'), 'student'), q.eq(q.field('engagement_status'), undefined)),
        )
        .take(1);

      if (studentsWithoutCache.length > 0) {
        // Count total students needing backfill
        const allStudentsWithoutCache = await ctx.db
          .query('users')
          .withIndex('by_university', (q) => q.eq('university_id', university._id))
          .filter((q) =>
            q.and(q.eq(q.field('role'), 'student'), q.eq(q.field('engagement_status'), undefined)),
          )
          .collect();

        needsBackfill.push({
          id: university._id,
          name: university.name,
          studentsWithoutCache: allStudentsWithoutCache.length,
        });
      }
    }

    return needsBackfill;
  },
});

/**
 * Backfill all students across all universities.
 * Processes one university at a time, 50 students per batch.
 */
export const backfillAllStudents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const universities = await ctx.db
      .query('universities')
      .filter((q) => q.or(q.eq(q.field('status'), 'active'), q.eq(q.field('status'), 'trial')))
      .collect();

    let totalUpdated = 0;

    for (const university of universities) {
      // Get engagement definition for this university
      const definitions = await ctx.db
        .query('engagement_definitions')
        .withIndex('by_university_active', (q) =>
          q.eq('university_id', university._id).eq('is_active', true),
        )
        .collect();
      const definition = definitions.find((d) => d.is_default) || definitions[0] || null;

      // Get students without cached engagement (up to 50)
      const students = await ctx.db
        .query('users')
        .withIndex('by_university', (q) => q.eq('university_id', university._id))
        .filter((q) =>
          q.and(q.eq(q.field('role'), 'student'), q.eq(q.field('engagement_status'), undefined)),
        )
        .take(51);

      const hasMore = students.length > 50;
      const studentsToProcess = hasMore ? students.slice(0, 50) : students;

      for (const student of studentsToProcess) {
        const { status, score } = await calculateStudentEngagement(ctx, student._id, definition);

        await ctx.db.patch(student._id, {
          engagement_status: status,
          engagement_score: score,
          engagement_calculated_at: Date.now(),
        });
        totalUpdated++;
      }

      // If there are more students in this university, stop here
      if (hasMore) {
        return {
          updated: totalUpdated,
          status: 'in_progress',
          message: `Processed batch for ${university.name}, more students remaining`,
        };
      }
    }

    return {
      updated: totalUpdated,
      status: 'complete',
      message: 'All students have cached engagement scores',
    };
  },
});
