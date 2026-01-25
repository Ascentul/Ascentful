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

import { Id } from '../_generated/dataModel';
import { internalMutation, internalQuery } from '../_generated/server';
import { calculateStudentEngagement } from '../lib/engagementHelpers';

/**
 * Get stats on backfill progress.
 * Uses pagination to avoid loading entire table into memory.
 */
export const getBackfillStats = internalQuery({
  args: {},
  handler: async (ctx) => {
    let total = 0;
    let withCache = 0;
    let withoutCache = 0;

    let cursor: string | null = null;
    do {
      const page = await ctx.db
        .query('users')
        .filter((q) => q.eq(q.field('role'), 'student'))
        .paginate({ cursor, numItems: 1000 });

      for (const student of page.page) {
        total++;
        if (student.engagement_status !== undefined) {
          withCache++;
        } else {
          withoutCache++;
        }
      }
      cursor = page.isDone ? null : page.continueCursor;
    } while (cursor);

    return {
      total,
      withCache,
      withoutCache,
      percentComplete: total > 0 ? Math.round((withCache / total) * 100) : 100,
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
 * Get list of universities that need backfill.
 * Uses pagination to count students without loading entire tables into memory.
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
      // Quick check: does this university have any students needing backfill?
      const hasStudentsWithoutCache = await ctx.db
        .query('users')
        .withIndex('by_university', (q) => q.eq('university_id', university._id))
        .filter((q) =>
          q.and(q.eq(q.field('role'), 'student'), q.eq(q.field('engagement_status'), undefined)),
        )
        .first();

      if (hasStudentsWithoutCache) {
        // Count using pagination to avoid memory issues for large universities
        let count = 0;
        let cursor: string | null = null;
        do {
          const page = await ctx.db
            .query('users')
            .withIndex('by_university', (q) => q.eq('university_id', university._id))
            .filter((q) =>
              q.and(
                q.eq(q.field('role'), 'student'),
                q.eq(q.field('engagement_status'), undefined),
              ),
            )
            .paginate({ cursor, numItems: 1000 });

          count += page.page.length;
          cursor = page.isDone ? null : page.continueCursor;
        } while (cursor);

        needsBackfill.push({
          id: university._id,
          name: university.name,
          studentsWithoutCache: count,
        });
      }
    }

    return needsBackfill;
  },
});

/**
 * Backfill all students across all universities.
 * Processes one university at a time, 50 students per batch.
 * Supports continuation from a specific university to avoid timeouts at scale.
 */
export const backfillAllStudents = internalMutation({
  args: {
    continueFromUniversityId: v.optional(v.id('universities')),
  },
  handler: async (ctx, args) => {
    // Order by _id to ensure deterministic continuation across calls
    let universities = (
      await ctx.db
        .query('universities')
        .filter((q) => q.or(q.eq(q.field('status'), 'active'), q.eq(q.field('status'), 'trial')))
        .collect()
    ).sort((a, b) => (a._id < b._id ? -1 : a._id > b._id ? 1 : 0));

    // If continuing from a specific university, skip universities we've already processed
    if (args.continueFromUniversityId) {
      const startIndex = universities.findIndex((u) => u._id === args.continueFromUniversityId);
      if (startIndex !== -1) {
        universities = universities.slice(startIndex);
      }
    }

    let totalUpdated = 0;
    const maxUniversitiesPerBatch = 10; // Limit universities per call to avoid timeout
    let universitiesProcessed = 0;

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

      // If there are more students in this university, continue from here next time
      if (hasMore) {
        return {
          updated: totalUpdated,
          status: 'in_progress',
          continueFromUniversityId: university._id,
          message: `Processed batch for ${university.name}, more students remaining`,
        };
      }

      universitiesProcessed++;

      // Check if we've processed enough universities for this batch
      if (universitiesProcessed >= maxUniversitiesPerBatch) {
        const nextUniversityIndex = universities.indexOf(university) + 1;
        if (nextUniversityIndex < universities.length) {
          return {
            updated: totalUpdated,
            status: 'in_progress',
            continueFromUniversityId: universities[nextUniversityIndex]._id,
            message: `Processed ${universitiesProcessed} universities, continuing with next batch`,
          };
        }
      }
    }

    return {
      updated: totalUpdated,
      status: 'complete',
      message: 'All students have cached engagement scores',
    };
  },
});
