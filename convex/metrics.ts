/**
 * Investor-Facing Metrics Module
 *
 * This module provides accurate, consistent metrics for business reporting.
 * All metrics automatically exclude test entities (universities and users).
 *
 * Design principles:
 * - Test data is never included in investor metrics
 * - Archived universities count toward "total all time" but not "active"
 * - Only real user activity counts (excludes internal/test users)
 * - Metrics are computed server-side for consistency
 */

import { v } from 'convex/values';

import { internalMutation, query } from './_generated/server';
import { requireSuperAdmin } from './lib/roles';

async function getLatestMetricsCache(ctx: any) {
  const latest = await ctx.db
    .query('platform_metrics_cache')
    .withIndex('by_snapshot_at')
    .order('desc')
    .take(1);
  return latest[0] ?? null;
}

/**
 * Total universities that have ever been created (excluding test universities)
 *
 * Counts universities with:
 * - is_test = false (real universities only)
 * - status IN ("trial", "active", "archived")
 *
 * This is an all-time metric - once a university is created and used,
 * it counts toward this total even if later archived.
 */
export const getTotalUniversitiesAllTime = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const cache = await getLatestMetricsCache(ctx);
    if (!cache) {
      throw new Error('Metrics cache not available');
    }
    return cache.total_universities_all_time;
  },
});

/**
 * Currently active universities (excluding test universities)
 *
 * Counts universities with:
 * - is_test = false (real universities only)
 * - status IN ("trial", "active")
 *
 * This represents universities currently using the platform.
 * Archived universities are excluded.
 */
export const getActiveUniversitiesCurrent = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const cache = await getLatestMetricsCache(ctx);
    if (!cache) {
      throw new Error('Metrics cache not available');
    }
    return cache.active_universities_current;
  },
});

/**
 * Archived universities (excluding test universities)
 *
 * Counts universities with:
 * - is_test = false (real universities only)
 * - status = "archived"
 *
 * This represents universities that were active but have been
 * non-destructively disabled. Their data is preserved.
 */
export const getArchivedUniversities = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const cache = await getLatestMetricsCache(ctx);
    if (!cache) {
      throw new Error('Metrics cache not available');
    }
    return cache.archived_universities;
  },
});

/**
 * Total users that have ever been created (excluding test and internal users)
 *
 * Counts users with:
 * - is_test_user = false (real users only)
 * - NOT internal roles (super_admin)
 *
 * This is an all-time metric. Users are counted even if:
 * - Their university was archived or deleted
 * - They are no longer active
 * - They have been soft-deleted
 *
 * Rationale: These users were served by the product and represent
 * real engagement, even if temporary.
 */
export const getTotalUsersAllTime = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const cache = await getLatestMetricsCache(ctx);
    if (!cache) {
      throw new Error('Metrics cache not available');
    }
    return cache.total_users_all_time;
  },
});

/**
 * Active users in the last 30 days (excluding test and internal users)
 *
 * Counts DISTINCT users with:
 * - is_test_user = false (real users only)
 * - NOT internal roles (super_admin)
 * - last_login_at >= (now - 30 days)
 * - university.is_test = false (if linked to university)
 * - university.status IN ("trial", "active") (if linked to university)
 *
 * This represents genuine active users on active universities.
 * Users on archived or test universities are excluded.
 *
 * Note: Users without a university (individual users) are included
 * if they meet the activity criteria.
 */
export const getActiveUsers30d = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const cache = await getLatestMetricsCache(ctx);
    if (!cache) {
      throw new Error('Metrics cache not available');
    }
    return cache.active_users_30d;
  },
});

/**
 * Get all investor metrics in a single call
 *
 * Returns:
 * - totalUniversitiesAllTime: Real universities ever created
 * - activeUniversitiesCurrent: Currently active real universities
 * - archivedUniversities: Archived real universities
 * - totalUsersAllTime: Real users ever created
 * - activeUsers30d: Real users active in last 30 days
 */
export const getAllMetrics = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const cache = await getLatestMetricsCache(ctx);
    if (!cache) {
      throw new Error('Metrics cache not available');
    }
    return {
      totalUniversitiesAllTime: cache.total_universities_all_time,
      activeUniversitiesCurrent: cache.active_universities_current,
      archivedUniversities: cache.archived_universities,
      totalUsersAllTime: cache.total_users_all_time,
      activeUsers30d: cache.active_users_30d,
    };
  },
});

/**
 * Internal: recompute platform metrics cache
 * Scheduled via cron to avoid expensive on-demand scans.
 */
export const recomputePlatformMetricsCache = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query('users').collect();
    const universities = await ctx.db.query('universities').collect();

    const now = Date.now();

    const realUniversities = universities.filter((u) => u.is_test !== true);
    const totalUniversitiesAllTime = realUniversities.filter(
      (u) => u.status === 'trial' || u.status === 'active' || u.status === 'archived',
    ).length;
    const activeUniversitiesCurrent = realUniversities.filter(
      (u) => u.status === 'trial' || u.status === 'active',
    ).length;
    const archivedUniversities = realUniversities.filter((u) => u.status === 'archived').length;

    const totalUsersAllTime = users.filter(
      (u) => u.is_test_user !== true && u.role !== 'super_admin',
    ).length;

    const universityMap = new Map(universities.map((u) => [u._id, u]));
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const activeUsers30d = users.filter((u) => {
      if (u.is_test_user === true) return false;
      if (u.role === 'super_admin') return false;
      if (!u.last_login_at || u.last_login_at < thirtyDaysAgo) return false;

      if (u.university_id) {
        const university = universityMap.get(u.university_id);
        if (!university) return false;
        if (university.is_test === true) return false;
        if (university.status !== 'trial' && university.status !== 'active') {
          return false;
        }
      }
      return true;
    }).length;

    await ctx.db.insert('platform_metrics_cache', {
      snapshot_at: now,
      total_universities_all_time: totalUniversitiesAllTime,
      active_universities_current: activeUniversitiesCurrent,
      archived_universities: archivedUniversities,
      total_users_all_time: totalUsersAllTime,
      active_users_30d: activeUsers30d,
      created_at: now,
      updated_at: now,
    });

    return {
      snapshot_at: now,
      totalUniversitiesAllTime,
      activeUniversitiesCurrent,
      archivedUniversities,
      totalUsersAllTime,
      activeUsers30d,
    };
  },
});
