/**
 * Admin Engagement Analytics
 *
 * Cross-university engagement comparison analytics for super admins.
 * Provides aggregate metrics across all universities for platform-level insights.
 */

import { v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { query, QueryCtx } from './_generated/server';
import { getAuthenticatedUser } from './lib/roles';

async function getUniversityStudentEngagementStats(
  ctx: QueryCtx,
  universityId: Id<'universities'>,
): Promise<{
  totalStudents: number;
  engagedCount: number;
  atRiskCount: number;
  totalScore: number;
}> {
  const students = await ctx.db
    .query('users')
    .withIndex('by_university', (q) => q.eq('university_id', universityId))
    .filter((q) => q.eq(q.field('role'), 'student'))
    .collect();

  const totalStudents = students.length;
  let engagedCount = 0;
  let atRiskCount = 0;
  let totalScore = 0;

  // Use cached engagement data when available.
  for (const student of students) {
    if (student.engagement_status) {
      if (student.engagement_status === 'engaged') {
        engagedCount++;
      } else if (student.engagement_status === 'at_risk') {
        atRiskCount++;
      }
      totalScore += student.engagement_score ?? 0;
    }
  }

  return {
    totalStudents,
    engagedCount,
    atRiskCount,
    totalScore,
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

    const limit = args.limit ?? 50;

    // Get ALL active universities for platform summary (not limited)
    const allUniversities = await ctx.db
      .query('universities')
      .filter((q) => q.or(q.eq(q.field('status'), 'active'), q.eq(q.field('status'), 'trial')))
      .collect();

    // We'll process all universities for accurate platform summary,
    // but only return `limit` in the universities array for display
    const universities = allUniversities;

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

    for (const university of universities) {
      const { totalStudents, engagedCount, atRiskCount, totalScore } =
        await getUniversityStudentEngagementStats(ctx, university._id);

      // Get active signals count
      const activeSignals = await ctx.db
        .query('signals')
        .withIndex('by_university_status', (q) =>
          q.eq('university_id', university._id).eq('status', 'active'),
        )
        .collect();

      // Use total student count for percentage calculations (no sampling needed with cached scores)
      const processedCount = totalStudents;
      universityMetrics.push({
        universityId: university._id,
        universityName: university.name,
        status: university.status,
        totalStudents,
        engagedStudents: engagedCount,
        atRiskStudents: atRiskCount,
        engagedPercent: processedCount > 0 ? Math.round((engagedCount / processedCount) * 100) : 0,
        atRiskPercent: processedCount > 0 ? Math.round((atRiskCount / processedCount) * 100) : 0,
        activeSignals: activeSignals.length,
        avgEngagementScore: processedCount > 0 ? Math.round(totalScore / processedCount) : 0,
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
      const { totalStudents, engagedCount, atRiskCount, totalScore } =
        await getUniversityStudentEngagementStats(ctx, university._id);
      if (totalStudents === 0) continue;

      const processedCount = totalStudents;
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
