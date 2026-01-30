/**
 * Admin Engagement Analytics
 *
 * Cross-university engagement comparison analytics for super admins.
 * Provides aggregate metrics across all universities for platform-level insights.
 */

import type { GenericMutationCtx, GenericQueryCtx } from 'convex/server';
import { v } from 'convex/values';

import type { DataModel, Id } from './_generated/dataModel';
import { internal } from './_generated/api';
import { internalMutation, mutation, query } from './_generated/server';
import { getAuthenticatedUser, isServiceRequest } from './lib/roles';

const UNIVERSITY_BATCH_SIZE = 5;

type Ctx = GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>;

async function computeUniversityEngagementMetrics(
  ctx: Ctx,
  universityId: Id<'universities'>,
): Promise<{
  totalStudents: number;
  engagedStudents: number;
  atRiskStudents: number;
  scoredStudents: number;
  avgEngagementScore: number;
}> {
  let totalStudents = 0;
  let engagedStudents = 0;
  let atRiskStudents = 0;
  let scoredStudents = 0;
  let totalScore = 0;

  const users = await ctx.db
    .query('users')
    .withIndex('by_university', (q) => q.eq('university_id', universityId))
    .collect();

  for (const student of users) {
    if (student.role !== 'student') {
      continue;
    }
    totalStudents++;
    if (student.engagement_status) {
      scoredStudents++;
      if (student.engagement_status === 'engaged') {
        engagedStudents++;
      } else if (student.engagement_status === 'at_risk') {
        atRiskStudents++;
      }
      totalScore += student.engagement_score ?? 0;
    }
  }

  return {
    totalStudents,
    engagedStudents,
    atRiskStudents,
    scoredStudents,
    avgEngagementScore: scoredStudents > 0 ? Math.round(totalScore / scoredStudents) : 0,
  };
}

async function getUniversityStudentEngagementStats(
  ctx: Ctx,
  universityId: Id<'universities'>,
): Promise<{
  totalStudents: number;
  engagedCount: number;
  atRiskCount: number;
  totalScore: number;
  scoredCount: number;
}> {
  const cached = await ctx.db
    .query('university_engagement_metrics')
    .withIndex('by_university', (q) => q.eq('university_id', universityId))
    .unique();

  if (cached) {
    const scoredCount = cached.scored_students ?? 0;
    const avgScore = cached.avg_engagement_score ?? 0;
    return {
      totalStudents: cached.total_students,
      engagedCount: cached.engaged_students,
      atRiskCount: cached.at_risk_students,
      totalScore: avgScore * scoredCount,
      scoredCount,
    };
  }

  const metrics = await computeUniversityEngagementMetrics(ctx, universityId);
  return {
    totalStudents: metrics.totalStudents,
    engagedCount: metrics.engagedStudents,
    atRiskCount: metrics.atRiskStudents,
    totalScore: metrics.avgEngagementScore * metrics.scoredStudents,
    scoredCount: metrics.scoredStudents,
  };
}

// ============================================================================
// CROSS-UNIVERSITY COMPARISON
// ============================================================================

/**
 * Get engagement comparison across all universities.
 * Super admin only.
 */
export const getCrossUniversityEngagement = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    // Only super admins can access cross-university data
    if (user.role !== 'super_admin') {
      throw new Error('Unauthorized: Super admin access required');
    }

    const limit = Math.max(0, Math.floor(args.limit ?? 50));

    // Read from cached metrics table (computed by scheduled job)
    const cached = await ctx.db
      .query('university_engagement_metrics')
      .filter((q) =>
        q.or(
          q.eq(q.field('university_status'), 'active'),
          q.eq(q.field('university_status'), 'trial'),
        ),
      )
      .collect();

    // Calculate engagement metrics for each university
    const universityMetrics: Array<{
      universityId: string;
      universityName: string;
      status: string;
      totalStudents: number;
      engagedStudents: number;
      atRiskStudents: number;
      engagedPercent: number;
      atRiskPercent: number;
      activeSignals: number;
      avgEngagementScore: number;
    }> = [];

    for (const entry of cached) {
      const processedCount =
        entry.scored_students > 0 ? entry.scored_students : entry.total_students;
      universityMetrics.push({
        universityId: entry.university_id,
        universityName: entry.university_name,
        status: entry.university_status,
        totalStudents: entry.total_students,
        engagedStudents: entry.engaged_students,
        atRiskStudents: entry.at_risk_students,
        engagedPercent:
          processedCount > 0 ? Math.round((entry.engaged_students / processedCount) * 100) : 0,
        atRiskPercent:
          processedCount > 0 ? Math.round((entry.at_risk_students / processedCount) * 100) : 0,
        activeSignals: entry.active_signals,
        avgEngagementScore: entry.avg_engagement_score,
      });
    }

    // Sort by engaged percent descending
    universityMetrics.sort((a, b) => b.engagedPercent - a.engagedPercent);

    // Calculate platform-wide summary
    const platformSummary = {
      totalUniversities: universityMetrics.length,
      totalStudents: universityMetrics.reduce((sum, u) => sum + u.totalStudents, 0),
      totalEngaged: universityMetrics.reduce((sum, u) => sum + u.engagedStudents, 0),
      totalAtRisk: universityMetrics.reduce((sum, u) => sum + u.atRiskStudents, 0),
      totalActiveSignals: universityMetrics.reduce((sum, u) => sum + u.activeSignals, 0),
      // NOTE: These averages are intentionally unweighted - each university contributes
      // equally regardless of student count. This measures "typical university performance"
      // rather than platform-wide student health. For weighted metrics, use
      // totalEngaged/totalStudents and totalAtRisk/totalStudents above.
      avgEngagedPercent:
        universityMetrics.length > 0
          ? Math.round(
              universityMetrics.reduce((sum, u) => sum + u.engagedPercent, 0) /
                universityMetrics.length,
            )
          : 0,
      avgAtRiskPercent:
        universityMetrics.length > 0
          ? Math.round(
              universityMetrics.reduce((sum, u) => sum + u.atRiskPercent, 0) /
                universityMetrics.length,
            )
          : 0,
    };

    return {
      // Return limited universities for display, but summary reflects all
      universities: universityMetrics.slice(0, limit),
      summary: platformSummary,
    };
  },
});

/**
 * Get engagement trends across all universities over time.
 * Super admin only.
 */
export const getCrossUniversityTrends = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    if (user.role !== 'super_admin') {
      throw new Error('Unauthorized: Super admin access required');
    }

    const days = args.days ?? 30;
    const now = Date.now();
    const cutoff = now - days * 24 * 60 * 60 * 1000;

    // Get signals within the analysis period (avoid unbounded query)
    // Note: Signals created before cutoff but resolved during period won't be counted in resolved trend
    const allSignals = await ctx.db
      .query('signals')
      .withIndex('by_created_at', (q) => q.gte('created_at', cutoff))
      .collect();

    // Build daily trend data
    const dailyTrend: Array<{
      date: string;
      signalsCreated: number;
      signalsResolved: number;
    }> = [];

    for (let i = days - 1; i >= 0; i--) {
      const dayStart = now - (i + 1) * 24 * 60 * 60 * 1000;
      const dayEnd = now - i * 24 * 60 * 60 * 1000;
      const date = new Date(dayEnd).toISOString().split('T')[0];

      const signalsCreated = allSignals.filter(
        (s) => s.created_at >= dayStart && s.created_at < dayEnd,
      ).length;

      const signalsResolved = allSignals.filter(
        (s) =>
          s.status === 'resolved' &&
          s.resolved_at &&
          s.resolved_at >= dayStart &&
          s.resolved_at < dayEnd,
      ).length;

      dailyTrend.push({
        date,
        signalsCreated,
        signalsResolved,
      });
    }

    return {
      dailyTrend,
      totalSignalsInPeriod: allSignals.filter((s) => s.created_at >= cutoff).length,
      totalResolvedInPeriod: allSignals.filter(
        (s) => s.status === 'resolved' && s.resolved_at && s.resolved_at >= cutoff,
      ).length,
    };
  },
});

/**
 * Get university ranking by engagement.
 * Super admin only.
 */
export const getUniversityEngagementRanking = query({
  args: {
    sortBy: v.optional(
      v.union(
        v.literal('engaged_percent'),
        v.literal('at_risk_percent'),
        v.literal('total_students'),
        v.literal('avg_score'),
      ),
    ),
    order: v.optional(v.union(v.literal('asc'), v.literal('desc'))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    if (user.role !== 'super_admin') {
      throw new Error('Unauthorized: Super admin access required');
    }

    const sortBy = args.sortBy ?? 'engaged_percent';
    const order = args.order ?? 'desc';
    const limit = args.limit ?? 20;

    // Get cross-university data (reusing the other query logic)
    const universities = await ctx.db
      .query('universities')
      .filter((q) => q.or(q.eq(q.field('status'), 'active'), q.eq(q.field('status'), 'trial')))
      .collect();

    const rankings: Array<{
      rank: number;
      universityId: string;
      universityName: string;
      totalStudents: number;
      engagedPercent: number;
      atRiskPercent: number;
      avgScore: number;
      trend: 'up' | 'down' | 'stable';
    }> = [];

    for (const university of universities) {
      const { totalStudents, engagedCount, atRiskCount, totalScore, scoredCount } =
        await getUniversityStudentEngagementStats(ctx, university._id);
      if (totalStudents === 0) continue;

      // Use scoredCount for averages to avoid bias from students without cached engagement data
      const processedCount = scoredCount > 0 ? scoredCount : totalStudents;
      rankings.push({
        rank: 0, // Will be set after sorting
        universityId: university._id,
        universityName: university.name,
        totalStudents,
        engagedPercent: Math.round((engagedCount / processedCount) * 100),
        atRiskPercent: Math.round((atRiskCount / processedCount) * 100),
        avgScore: Math.round(totalScore / processedCount),
        trend: 'stable', // Would need historical data to calculate
      });
    }

    // Sort
    rankings.sort((a, b) => {
      let valueA, valueB;
      switch (sortBy) {
        case 'engaged_percent':
          valueA = a.engagedPercent;
          valueB = b.engagedPercent;
          break;
        case 'at_risk_percent':
          valueA = a.atRiskPercent;
          valueB = b.atRiskPercent;
          break;
        case 'total_students':
          valueA = a.totalStudents;
          valueB = b.totalStudents;
          break;
        case 'avg_score':
          valueA = a.avgScore;
          valueB = b.avgScore;
          break;
        default:
          valueA = a.engagedPercent;
          valueB = b.engagedPercent;
      }
      return order === 'asc' ? valueA - valueB : valueB - valueA;
    });

    // Assign ranks
    rankings.forEach((r, i) => {
      r.rank = i + 1;
    });

    return rankings.slice(0, limit);
  },
});

/**
 * Get signal analytics across all universities.
 * Super admin only.
 */
export const getCrossUniversitySignalAnalytics = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    if (user.role !== 'super_admin') {
      throw new Error('Unauthorized: Super admin access required');
    }

    // Apply time-based filter to avoid unbounded query
    // Defaults to 90 days for broader analytics view
    const days = args.days ?? 90;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    // Get signals within the analysis period
    const allSignals = await ctx.db
      .query('signals')
      .withIndex('by_created_at', (q) => q.gte('created_at', cutoff))
      .collect();

    // Status breakdown
    const statusCounts = {
      active: allSignals.filter((s) => s.status === 'active').length,
      snoozed: allSignals.filter((s) => s.status === 'snoozed').length,
      resolved: allSignals.filter((s) => s.status === 'resolved').length,
      dismissed: allSignals.filter((s) => s.status === 'dismissed').length,
    };

    // Priority breakdown (active signals only)
    const activeSignals = allSignals.filter((s) => s.status === 'active');
    const priorityCounts = {
      urgent: activeSignals.filter((s) => s.priority === 'urgent').length,
      high: activeSignals.filter((s) => s.priority === 'high').length,
      medium: activeSignals.filter((s) => s.priority === 'medium').length,
      low: activeSignals.filter((s) => s.priority === 'low').length,
    };

    // Type breakdown
    const typeCounts = {
      needs_outreach: allSignals.filter((s) => s.signal_type === 'needs_outreach').length,
      application_support: allSignals.filter((s) => s.signal_type === 'application_support').length,
      document_review: allSignals.filter((s) => s.signal_type === 'document_review').length,
      milestone_check: allSignals.filter((s) => s.signal_type === 'milestone_check').length,
      custom: allSignals.filter((s) => s.signal_type === 'custom').length,
    };

    // Source breakdown
    const sourceCounts = {
      rule: allSignals.filter((s) => s.source === 'rule').length,
      manual: allSignals.filter((s) => s.source === 'manual').length,
      system: allSignals.filter((s) => s.source === 'system').length,
    };

    // Resolution breakdown
    const resolvedSignals = allSignals.filter((s) => s.status === 'resolved');
    const resolutionCounts = {
      action_taken: resolvedSignals.filter((s) => s.resolution_type === 'action_taken').length,
      no_action_needed: resolvedSignals.filter((s) => s.resolution_type === 'no_action_needed')
        .length,
      dismissed: resolvedSignals.filter((s) => s.resolution_type === 'dismissed').length,
      auto_resolved: resolvedSignals.filter((s) => s.resolution_type === 'auto_resolved').length,
    };

    // Average resolution time
    const resolvedWithTimes = resolvedSignals.filter((s) => s.resolved_at && s.triggered_at);
    let avgResolutionHours = null;
    if (resolvedWithTimes.length > 0) {
      const totalMs = resolvedWithTimes.reduce(
        (sum, s) => sum + ((s.resolved_at || 0) - s.triggered_at),
        0,
      );
      avgResolutionHours = Math.round(totalMs / resolvedWithTimes.length / (1000 * 60 * 60));
    }

    return {
      total: allSignals.length,
      statusCounts,
      priorityCounts,
      typeCounts,
      sourceCounts,
      resolutionCounts,
      avgResolutionHours,
      resolutionRate:
        allSignals.length > 0 ? Math.round((resolvedSignals.length / allSignals.length) * 100) : 0,
    };
  },
});

/**
 * Recompute engagement metrics for a batch of universities.
 * Scheduled job uses cursor pagination to avoid timeouts.
 */
export const recomputeEngagementMetricsBatch = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const pageSize = Math.max(1, Math.min(args.batchSize ?? UNIVERSITY_BATCH_SIZE, 20));

    const page = await ctx.db
      .query('universities')
      .filter((q) => q.or(q.eq(q.field('status'), 'active'), q.eq(q.field('status'), 'trial')))
      .paginate({ cursor: args.cursor ?? null, numItems: pageSize });

    for (const university of page.page) {
      const metrics = await computeUniversityEngagementMetrics(ctx, university._id);

      const activeSignals = await ctx.db
        .query('signals')
        .withIndex('by_university_status', (q) =>
          q.eq('university_id', university._id).eq('status', 'active'),
        )
        .collect();

      const existing = await ctx.db
        .query('university_engagement_metrics')
        .withIndex('by_university', (q) => q.eq('university_id', university._id))
        .unique();

      const payload = {
        university_id: university._id,
        university_name: university.name,
        university_status: university.status,
        total_students: metrics.totalStudents,
        engaged_students: metrics.engagedStudents,
        at_risk_students: metrics.atRiskStudents,
        scored_students: metrics.scoredStudents,
        avg_engagement_score: metrics.avgEngagementScore,
        active_signals: activeSignals.length,
        updated_at: Date.now(),
      };

      if (existing) {
        await ctx.db.patch(existing._id, payload);
      } else {
        await ctx.db.insert('university_engagement_metrics', payload);
      }
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.admin_engagement_analytics.recomputeEngagementMetricsBatch,
        {
          cursor: page.continueCursor,
          batchSize: pageSize,
        },
      );
    }

    return {
      processed: page.page.length,
      hasMore: !page.isDone,
      nextCursor: page.continueCursor,
    };
  },
});

/**
 * Trigger a manual recompute of the university engagement metrics cache.
 * Super admin only.
 */
export const triggerEngagementMetricsRecompute = mutation({
  args: {
    serviceToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!isServiceRequest(args.serviceToken)) {
      const user = await getAuthenticatedUser(ctx);
      if (user.role !== 'super_admin') {
        throw new Error('Unauthorized: Super admin access required');
      }
    }
    await ctx.scheduler.runAfter(
      0,
      internal.admin_engagement_analytics.recomputeEngagementMetricsBatch,
      {},
    );
    return { scheduled: true };
  },
});
