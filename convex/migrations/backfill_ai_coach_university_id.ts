/**
 * Backfill Migration: Add university_id to ai_coach_conversations
 *
 * This migration populates the university_id field on existing ai_coach_conversations
 * by looking up the user's university_id.
 *
 * Run via: npx convex run migrations/backfill_ai_coach_university_id:backfillUniversityId
 *
 * This enables bulk queries for analytics instead of per-student loops.
 */

import { internalMutation } from '../_generated/server';

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
      if (user?.university_id) {
        await ctx.db.patch(conversation._id, {
          university_id: user.university_id,
        });
        updated++;
      }
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
 * Get stats on backfill progress
 */
export const getBackfillStats = internalMutation({
  args: {},
  handler: async (ctx) => {
    const total = await ctx.db.query('ai_coach_conversations').collect();
    const withUniversityId = total.filter((c) => c.university_id !== undefined);
    const withoutUniversityId = total.filter((c) => c.university_id === undefined);

    return {
      total: total.length,
      withUniversityId: withUniversityId.length,
      withoutUniversityId: withoutUniversityId.length,
      percentComplete:
        total.length > 0 ? Math.round((withUniversityId.length / total.length) * 100) : 100,
    };
  },
});
