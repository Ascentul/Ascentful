/**
 * Engagement Cache System
 *
 * Caches engagement scores on user records for O(1) analytics queries.
 * Scores are recalculated:
 * - Periodically via scheduled job (every 6 hours)
 * - On-demand when viewing a student's profile
 *
 * This avoids O(N) queries in getEngagementAnalytics by pre-computing scores.
 */

import { v } from 'convex/values';

import { Doc, Id } from './_generated/dataModel';
import { internalMutation, internalQuery, QueryCtx } from './_generated/server';
import {
  calculateEngagementScore,
  DEFAULT_QUALIFYING_EVENT_TYPES,
  determineEngagementStatus,
} from './lib/engagementScoring';

interface EngagementCriteria {
  period_days: number;
  min_events_in_period: number;
  qualifying_event_types?: string[];
}

/**
 * Calculate engagement score for a single student.
 * Returns the status, score, and qualifying event data.
 *
 * Uses centralized scoring functions from lib/engagementScoring.ts
 * to ensure consistent scoring across the application.
 */
async function calculateStudentEngagement(
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

  const qualifyingEventTypes: string[] = criteria.qualifying_event_types || [
    ...DEFAULT_QUALIFYING_EVENT_TYPES,
  ];
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

  // Use centralized scoring functions (source of truth in lib/engagementScoring.ts)
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

/**
 * Recalculate and cache engagement for a single student.
 */
export const recalculateStudentEngagement = internalMutation({
  args: {
    studentId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const student = await ctx.db.get(args.studentId);
    if (!student || student.role !== 'student' || !student.university_id) {
      return { updated: false, reason: 'not_a_university_student' };
    }

    // Get the engagement definition for this university
    const definitions = await ctx.db
      .query('engagement_definitions')
      .withIndex('by_university_active', (q) =>
        q.eq('university_id', student.university_id!).eq('is_active', true),
      )
      .collect();
    const definition = definitions.find((d) => d.is_default) || definitions[0] || null;

    const { status, score } = await calculateStudentEngagement(ctx, args.studentId, definition);

    await ctx.db.patch(args.studentId, {
      engagement_status: status,
      engagement_score: score,
      engagement_calculated_at: Date.now(),
    });

    return { updated: true, status, score };
  },
});

/**
 * Batch recalculate engagement for all students in a university.
 * Processes in batches to avoid timeout.
 */
export const recalculateUniversityEngagement = internalMutation({
  args: {
    universityId: v.id('universities'),
    batchSize: v.optional(v.number()),
    cursor: v.optional(v.number()), // Last processed _creationTime for pagination
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 100;

    // Get engagement definition for this university
    const definitions = await ctx.db
      .query('engagement_definitions')
      .withIndex('by_university_active', (q) =>
        q.eq('university_id', args.universityId).eq('is_active', true),
      )
      .collect();
    const definition = definitions.find((d) => d.is_default) || definitions[0] || null;

    // Get students to process
    let query = ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .filter((q) => q.eq(q.field('role'), 'student'));

    // Apply cursor-based pagination using _creationTime (guaranteed chronological)
    if (args.cursor !== undefined) {
      const cursorValue = args.cursor;
      query = query.filter((q) => q.gt(q.field('_creationTime'), cursorValue));
    }

    const students = await query.take(batchSize + 1); // Take one extra to check if there's more

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

    return {
      updated,
      hasMore,
      nextCursor: studentsToProcess[studentsToProcess.length - 1]?._creationTime,
    };
  },
});

/**
 * Get universities that need engagement recalculation.
 * Returns universities with students who haven't been calculated in the last 6 hours.
 */
export const getUniversitiesNeedingRecalculation = internalQuery({
  args: {},
  handler: async (ctx) => {
    const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;

    // Get all active universities
    const universities = await ctx.db
      .query('universities')
      .filter((q) => q.or(q.eq(q.field('status'), 'active'), q.eq(q.field('status'), 'trial')))
      .collect();

    const needsRecalculation: Id<'universities'>[] = [];

    for (const university of universities) {
      // Check if any student needs recalculation
      const staleStudent = await ctx.db
        .query('users')
        .withIndex('by_university', (q) => q.eq('university_id', university._id))
        .filter((q) =>
          q.and(
            q.eq(q.field('role'), 'student'),
            q.or(
              q.eq(q.field('engagement_calculated_at'), undefined),
              q.lt(q.field('engagement_calculated_at'), sixHoursAgo),
            ),
          ),
        )
        .first();

      if (staleStudent) {
        needsRecalculation.push(university._id);
      }
    }

    return needsRecalculation;
  },
});

/**
 * Scheduled job: Refresh engagement cache for all universities.
 *
 * Called by cron every 6 hours. Processes one university per run to stay within
 * time limits. Remaining universities will be processed in subsequent cron runs.
 */
export const refreshEngagementCacheJob = internalMutation({
  args: {},
  handler: async (ctx) => {
    const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;

    // Get universities needing recalculation
    const universities = await ctx.db
      .query('universities')
      .filter((q) => q.or(q.eq(q.field('status'), 'active'), q.eq(q.field('status'), 'trial')))
      .collect();

    // Randomize order to prevent starvation - ensures all universities get processed
    // even if one has perpetually stale students
    const shuffledUniversities = [...universities].sort(() => Math.random() - 0.5);

    let processedUniversity: string | null = null;
    let studentsUpdated = 0;

    for (const university of shuffledUniversities) {
      // Check if this university has stale students
      const staleStudent = await ctx.db
        .query('users')
        .withIndex('by_university', (q) => q.eq('university_id', university._id))
        .filter((q) =>
          q.and(
            q.eq(q.field('role'), 'student'),
            q.or(
              q.eq(q.field('engagement_calculated_at'), undefined),
              q.lt(q.field('engagement_calculated_at'), sixHoursAgo),
            ),
          ),
        )
        .first();

      if (staleStudent) {
        // Get engagement definition for this university
        const definitions = await ctx.db
          .query('engagement_definitions')
          .withIndex('by_university_active', (q) =>
            q.eq('university_id', university._id).eq('is_active', true),
          )
          .collect();
        const definition = definitions.find((d) => d.is_default) || definitions[0] || null;

        // Get all stale students for this university (limit batch size)
        const staleStudents = await ctx.db
          .query('users')
          .withIndex('by_university', (q) => q.eq('university_id', university._id))
          .filter((q) =>
            q.and(
              q.eq(q.field('role'), 'student'),
              q.or(
                q.eq(q.field('engagement_calculated_at'), undefined),
                q.lt(q.field('engagement_calculated_at'), sixHoursAgo),
              ),
            ),
          )
          .take(50); // Process 50 students per run

        for (const student of staleStudents) {
          const { status, score } = await calculateStudentEngagement(ctx, student._id, definition);
          await ctx.db.patch(student._id, {
            engagement_status: status,
            engagement_score: score,
            engagement_calculated_at: Date.now(),
          });
          studentsUpdated++;
        }

        processedUniversity = university.name;
        break; // Process one university at a time
      }
    }

    return {
      processed: processedUniversity !== null,
      university: processedUniversity,
      studentsUpdated,
    };
  },
});
