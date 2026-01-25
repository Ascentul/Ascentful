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

import { Id } from './_generated/dataModel';
import { internalMutation, internalQuery } from './_generated/server';
import { calculateStudentEngagement } from './lib/engagementHelpers';

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
    // Sort by created_at for deterministic fallback when no default is set
    const sorted = definitions.sort((a, b) => a.created_at - b.created_at);
    const definition = sorted.find((d) => d.is_default) || sorted[0] || null;

    // Early return if no active definition exists
    if (!definition) {
      return { updated: false, reason: 'no_active_engagement_definition' as const };
    }

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
    cursor: v.optional(v.id('users')), // Last processed _id for pagination (unique, unlike _creationTime)
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
    // Sort by created_at for deterministic fallback when no default is set
    const sorted = definitions.sort((a, b) => a.created_at - b.created_at);
    const definition = sorted.find((d) => d.is_default) || sorted[0] || null;

    // Early return if no active definition exists for this university
    if (!definition) {
      return {
        updated: 0,
        hasMore: false,
        nextCursor: undefined,
        reason: 'no_active_engagement_definition' as const,
      };
    }

    // Get students to process
    let query = ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .filter((q) => q.eq(q.field('role'), 'student'));

    // Apply cursor-based pagination using _id (guaranteed unique per document)
    // Note: _creationTime can have duplicates within same millisecond, causing skipped records
    if (args.cursor !== undefined) {
      const cursorValue = args.cursor;
      query = query.filter((q) => q.gt(q.field('_id'), cursorValue));
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
      nextCursor: studentsToProcess[studentsToProcess.length - 1]?._id,
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

        // Skip universities without an active engagement definition
        // They'll be processed once an admin creates a definition
        if (!definition) {
          continue;
        }

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
