/**
 * Migration: Application sort_order field
 *
 * Backfills sort_order for existing applications to enable Kanban drag-and-drop ordering.
 * Uses negative integer values with gaps (-1000, -2000, -3000...) where lower = top of list.
 *
 * Run via: npx convex run migrate_application_sort_order:backfillSortOrder
 */

import { v } from 'convex/values';

import { internalMutation, internalQuery } from './_generated/server';

const SORT_ORDER_GAP = 1000; // Initial gap between sort_order values

/**
 * Backfill sort_order for all applications without one
 *
 * Assigns sort_order based on _creationTime ascending within each user/status group.
 * Newer applications processed later receive lower sort_order values so they stay on top.
 *
 * Run via: npx convex run migrate_application_sort_order:backfillSortOrder
 */
export const backfillSortOrder = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;
    const now = Date.now();

    console.log(`🚀 Starting sort_order backfill (dryRun: ${dryRun})...`);

    let totalProcessed = 0;
    let updated = 0;
    let alreadyHasSortOrder = 0;
    const errors: string[] = [];

    // Group applications by user_id and status, then assign sort_order
    // We'll process by user to ensure proper ordering within each user's applications
    let cursor: string | null = null;
    let isDone = false;

    // Track sort_order assignments per user+status combination
    const sortOrderByUserStatus: Map<string, number> = new Map();

    while (!isDone) {
      const page = await ctx.db
        .query('applications')
        .order('asc') // Oldest first (by _creationTime)
        .paginate({ cursor, numItems: 100 });

      for (const app of page.page) {
        totalProcessed++;
        const appLabel = `app:${app._id}`;

        try {
          // Skip if sort_order is already set
          if (app.sort_order !== undefined && app.sort_order !== null) {
            alreadyHasSortOrder++;
            if (totalProcessed % 100 === 0) {
              console.log(`  ✓ ${appLabel} already has sort_order: ${app.sort_order}`);
            }
            continue;
          }

          // Create key for this user+status combination
          const key = `${app.user_id}:${app.status}`;

          // Get next sort_order for this group (decrement so newer apps get lower values)
          const currentOrder = sortOrderByUserStatus.get(key) ?? 0;
          const newSortOrder = currentOrder - SORT_ORDER_GAP;
          sortOrderByUserStatus.set(key, newSortOrder);

          console.log(`📝 ${appLabel}: assigning sort_order ${newSortOrder} (${app.status})`);

          if (!dryRun) {
            await ctx.db.patch(app._id, {
              sort_order: newSortOrder,
              updated_at: now,
            });
          }

          updated++;

          if (totalProcessed % 50 === 0) {
            console.log(`Progress: ${totalProcessed} processed, ${updated} updated`);
          }
        } catch (error) {
          const errorMsg = `Error updating ${appLabel}: ${error}`;
          console.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      cursor = page.continueCursor;
      isDone = page.isDone;
    }

    const summary = {
      success: errors.length === 0,
      dryRun,
      totalProcessed,
      updated,
      alreadyHasSortOrder,
      errors,
      message: dryRun
        ? `DRY RUN: Would update ${updated} applications with sort_order`
        : `Successfully updated ${updated} applications (${alreadyHasSortOrder} already had sort_order)`,
    };

    console.log('\n✅ Backfill complete!');
    console.log(JSON.stringify(summary, null, 2));

    return summary;
  },
});

/**
 * Verify sort_order migration completeness
 *
 * Run via: npx convex run migrate_application_sort_order:verifySortOrder
 */
export const verifySortOrder = internalQuery({
  args: {},
  handler: async (ctx) => {
    console.log('🔍 Verifying sort_order backfill...');

    let total = 0;
    let withSortOrder = 0;
    let withoutSortOrder = 0;

    let cursor: string | null = null;
    let isDone = false;

    while (!isDone) {
      const result = await ctx.db.query('applications').paginate({ cursor, numItems: 1000 });

      for (const app of result.page) {
        total++;

        if (app.sort_order !== undefined && app.sort_order !== null) {
          withSortOrder++;
        } else {
          withoutSortOrder++;
        }
      }

      cursor = result.continueCursor;
      isDone = result.isDone;
    }

    const verifyResult = {
      total,
      withSortOrder,
      withoutSortOrder,
      complete: withoutSortOrder === 0,
    };

    if (verifyResult.complete) {
      console.log('✅ Sort order backfill complete and verified!');
    } else {
      console.error(`❌ ${withoutSortOrder} applications missing sort_order`);
    }

    console.log(JSON.stringify(verifyResult, null, 2));
    return verifyResult;
  },
});

/**
 * Rebalance sort_order for a specific user's applications in a status column
 *
 * Use when fractional indexes become too small (gap < 0.0001).
 * Reassigns negative integers (-N*1000, ..., -2000, -1000) while preserving current order.
 * Lower values = top of list (consistent with backfill convention).
 */
export const rebalanceSortOrder = internalMutation({
  args: {
    userId: v.id('users'),
    status: v.union(
      v.literal('saved'),
      v.literal('applied'),
      v.literal('interview'),
      v.literal('offer'),
      v.literal('rejected'),
    ),
  },
  handler: async (ctx, args) => {
    console.log(`🔄 Rebalancing sort_order for user ${args.userId}, status ${args.status}...`);

    // Get all applications for this user+status, ordered by current sort_order
    const applications = await ctx.db
      .query('applications')
      .withIndex('by_user_status_order', (q) =>
        q.eq('user_id', args.userId).eq('status', args.status),
      )
      .collect();

    // Sort by current sort_order (nulls at end)
    applications.sort((a, b) => {
      if (a.sort_order == null) return 1;
      if (b.sort_order == null) return -1;
      return a.sort_order - b.sort_order;
    });

    const now = Date.now();
    let rebalanced = 0;

    // Reassign with clean integer gaps using negative values
    // Lower values = top of list (consistent with backfill convention)
    for (let i = 0; i < applications.length; i++) {
      const newSortOrder = -(applications.length - i) * SORT_ORDER_GAP;
      await ctx.db.patch(applications[i]._id, {
        sort_order: newSortOrder,
        updated_at: now,
      });
      rebalanced++;
    }

    console.log(`✅ Rebalanced ${rebalanced} applications`);
    return { rebalanced };
  },
});
