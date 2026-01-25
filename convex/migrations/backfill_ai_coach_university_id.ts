/**
 * Backfill Migration: Add university_id to ai_coach_conversations
 *
 * This migration populates the university_id field on existing ai_coach_conversations
 * by looking up the user's university_id.
 *
 * Run via Convex Dashboard or schedule from another internal function.
 * Internal mutations cannot be invoked directly via `npx convex run`.
 *
 * This enables bulk queries for analytics instead of per-student loops.
 */

import { internalMutation, internalQuery } from '../_generated/server';

/**
 * Backfill university_id on ai_coach_conversations from the user's university_id.
 * Processes in batches to avoid timeout.
 */
export const backfillUniversityId = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get conversations without university_id that haven't been checked yet
    // This prevents infinite loops on conversations where user has no university
    const conversations = await ctx.db
      .query('ai_coach_conversations')
      .filter((q) =>
        q.and(
          q.eq(q.field('university_id'), undefined),
          q.eq(q.field('university_id_backfill_checked'), undefined),
        ),
      )
      .take(500); // Process in batches

    if (conversations.length === 0) {
      return { updated: 0, skipped: 0, hasMore: false, done: true };
    }

    let updated = 0;
    let skipped = 0;
    for (const conversation of conversations) {
      const user = await ctx.db.get(conversation.user_id);
      // If user doesn't exist or has no university_id, mark as checked to prevent re-processing
      if (!user || !user.university_id) {
        await ctx.db.patch(conversation._id, {
          university_id_backfill_checked: true,
        });
        skipped++;
        continue;
      }
      await ctx.db.patch(conversation._id, {
        university_id: user.university_id,
      });
      updated++;
    }

    // Check if there are more unchecked records to process
    const remaining = await ctx.db
      .query('ai_coach_conversations')
      .filter((q) =>
        q.and(
          q.eq(q.field('university_id'), undefined),
          q.eq(q.field('university_id_backfill_checked'), undefined),
        ),
      )
      .take(1);

    return {
      updated,
      skipped,
      hasMore: remaining.length > 0,
      done: remaining.length === 0,
    };
  },
});

/**
 * Get stats on backfill progress.
 * Uses pagination to avoid loading entire table into memory.
 */
export const getBackfillStats = internalQuery({
  args: {},
  handler: async (ctx) => {
    let total = 0;
    let withUniversityId = 0;
    let checkedNoUniversity = 0; // Marked as checked but user has no university (individual users)
    let pending = 0; // Not yet processed

    let cursor: string | null = null;
    do {
      const page = await ctx.db
        .query('ai_coach_conversations')
        .paginate({ cursor, numItems: 1000 });

      for (const c of page.page) {
        total++;
        if (c.university_id !== undefined) {
          withUniversityId++;
        } else if (c.university_id_backfill_checked === true) {
          checkedNoUniversity++;
        } else {
          pending++;
        }
      }
      cursor = page.isDone ? null : page.continueCursor;
    } while (cursor);

    const processed = withUniversityId + checkedNoUniversity;

    return {
      total,
      withUniversityId,
      checkedNoUniversity,
      pending,
      percentComplete: total > 0 ? Math.round((processed / total) * 100) : 100,
    };
  },
});
