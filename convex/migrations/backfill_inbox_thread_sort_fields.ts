/**
 * Migration: Backfill inbox_threads priority_rank and last_message_at_desc
 *
 * Run via:
 *   npx convex run migrations/backfill_inbox_thread_sort_fields:backfill
 */

import { mutation, query } from '../_generated/server';
import { priorityRank, toDescTimestamp } from '../lib/inboxThreadUtils';

const BATCH_SIZE = 500;

export const backfill = mutation({
  args: {},
  handler: async (ctx) => {
    let cursor: string | null = null;
    let updated = 0;

    while (true) {
      const page = await ctx.db.query('inbox_threads').paginate({ cursor, numItems: BATCH_SIZE });
      for (const thread of page.page) {
        const updates: Record<string, unknown> = {};

        if (thread.priority_rank === undefined) {
          updates.priority_rank = priorityRank(thread.priority);
        }

        if (thread.last_message_at_desc === undefined) {
          updates.last_message_at_desc = toDescTimestamp(thread.last_message_at);
        }

        if (Object.keys(updates).length > 0) {
          await ctx.db.patch(thread._id, updates);
          updated += 1;
        }
      }

      if (page.isDone) break;
      cursor = page.continueCursor;
    }

    return { updated };
  },
});

export const getBackfillStats = query({
  args: {},
  handler: async (ctx) => {
    let cursor: string | null = null;
    let total = 0;
    let missingPriorityRank = 0;
    let missingLastMessageDesc = 0;

    while (true) {
      const page = await ctx.db.query('inbox_threads').paginate({ cursor, numItems: BATCH_SIZE });
      for (const thread of page.page) {
        total += 1;
        if (thread.priority_rank === undefined) missingPriorityRank += 1;
        if (thread.last_message_at_desc === undefined) missingLastMessageDesc += 1;
      }
      if (page.isDone) break;
      cursor = page.continueCursor;
    }

    return { total, missingPriorityRank, missingLastMessageDesc };
  },
});
