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
    // Get conversations without university_id
    const conversations = await ctx.db
      .query('ai_coach_conversations')
      .filter((q) => q.eq(q.field('university_id'), undefined))
      .take(500); // Process in batches

    if (conversations.length === 0) {
      return { updated: 0, hasMore: false, done: true };
    }

    let updated = 0;
    for (const conversation of conversations) {
      const user = await ctx.db.get(conversation.user_id);
      // If user doesn't exist or has no university_id, explicitly set to null
      // to prevent endless backfill (undefined records would be re-processed)
      if (!user || !user.university_id) {
        await ctx.db.patch(conversation._id, {
          university_id: null,
        });
        continue;
      }
      await ctx.db.patch(conversation._id, {
        university_id: user.university_id,
      });
      updated++;
    }

    // Check if there are more to process
    const remaining = await ctx.db
      .query('ai_coach_conversations')
      .filter((q) => q.eq(q.field('university_id'), undefined))
      .take(1);

    return {
      updated,
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
    let withoutUniversityId = 0;

    let cursor: string | null = null;
    do {
      const page = await ctx.db
        .query('ai_coach_conversations')
        .paginate({ cursor, numItems: 1000 });

      total += page.page.length;
      withoutUniversityId += page.page.filter((c) => c.university_id === undefined).length;
      cursor = page.isDone ? null : page.continueCursor;
    } while (cursor);

    const withUniversityId = total - withoutUniversityId;

    return {
      total,
      withUniversityId,
      withoutUniversityId,
      percentComplete: total > 0 ? Math.round((withUniversityId / total) * 100) : 100,
    };
  },
});
