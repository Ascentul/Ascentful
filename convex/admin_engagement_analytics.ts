/**
 * Admin Engagement Analytics
 *
 * Cross-university engagement comparison analytics for super admins.
 * Provides aggregate metrics across all universities for platform-level insights.
 */

import { v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { query } from './_generated/server';
import { getAuthenticatedUser } from './lib/roles';

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

    // Get all active universities
    const universities = await ctx.db
      .query('universities')
      .filter((q) => q.or(q.eq(q.field('status'), 'active'), q.eq(q.field('status'), 'trial')))
      .take(limit);

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
      isSampled?: boolean;
    }> = [];

    for (const university of universities) {
      // Get students
      const students = await ctx.db
        .query('users')
        .withIndex('by_university', (q) => q.eq('university_id', university._id))
        .filter((q) => q.eq(q.field('role'), 'student'))
        .collect();

      const totalStudents = students.length;

      // Get engagement definition
      const definitions = await ctx.db
        .query('engagement_definitions')
        .withIndex('by_university_active', (q) =>
          q.eq('university_id', university._id).eq('is_active', true),
        )
        .collect();
      const definition = definitions.find((d) => d.is_default) || definitions[0];

      // Default thresholds
      const engagedThreshold = definition?.engaged_threshold ?? 70;
      const atRiskThreshold = definition?.at_risk_threshold ?? 30;

      // Calculate engagement for each student (simplified - based on activity events)
      // NOTE: This has O(n) queries where n = number of students. For universities with
      // many students (500+), consider pre-computing engagement scores via scheduled job
      // or adding a compound index. Acceptable for admin analytics with moderate student counts.
      let engagedCount = 0;
      let atRiskCount = 0;
      let totalScore = 0;

      const now = Date.now();
      const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;

      // Limit to first 500 students for performance (sample-based for very large universities)
      const studentsToProcess = students.slice(0, 500);
      const isSampled = students.length > 500;

      for (const student of studentsToProcess) {
        // Get recent activity events
        const events = await ctx.db
          .query('activity_events')
          .withIndex('by_user_date', (q) =>
            q.eq('user_id', student._id).gte('occurred_at', fourteenDaysAgo),
          )
          .take(50);

        // Simple scoring based on event count
        const score = Math.min(100, events.length * 10);
        totalScore += score;

        if (score >= engagedThreshold) {
          engagedCount++;
        } else if (score <= atRiskThreshold) {
          atRiskCount++;
        }
      }

      // Get active signals count
      const activeSignals = await ctx.db
        .query('signals')
        .withIndex('by_university_status', (q) =>
          q.eq('university_id', university._id).eq('status', 'active'),
        )
        .collect();

      // Use sampled count for percentage calculations when sampling is applied
      const processedCount = studentsToProcess.length;
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
        ...(isSampled && { isSampled: true }),
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
      universities: universityMetrics,
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
      .filter((q) => q.gte(q.field('created_at'), cutoff))
      .collect();

    // Build daily trend data
    const dailyTrend: Array<{
      date: string;
      signalsCreated: number;
      signalsResolved: number;
      activeUsers: number;
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

      // Count unique active users (simplified - would need separate aggregation in production)
      dailyTrend.push({
        date,
        signalsCreated,
        signalsResolved,
        activeUsers: 0, // Placeholder - would need activity_events aggregation
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

    const now = Date.now();
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;

    for (const university of universities) {
      const students = await ctx.db
        .query('users')
        .withIndex('by_university', (q) => q.eq('university_id', university._id))
        .filter((q) => q.eq(q.field('role'), 'student'))
        .collect();

      const totalStudents = students.length;
      if (totalStudents === 0) continue;

      let engagedCount = 0;
      let atRiskCount = 0;
      let totalScore = 0;

      for (const student of students) {
        const events = await ctx.db
          .query('activity_events')
          .withIndex('by_user_date', (q) =>
            q.eq('user_id', student._id).gte('occurred_at', fourteenDaysAgo),
          )
          .take(50);

        const score = Math.min(100, events.length * 10);
        totalScore += score;

        if (score >= 70) engagedCount++;
        else if (score <= 30) atRiskCount++;
      }

      rankings.push({
        rank: 0, // Will be set after sorting
        universityId: university._id,
        universityName: university.name,
        totalStudents,
        engagedPercent: Math.round((engagedCount / totalStudents) * 100),
        atRiskPercent: Math.round((atRiskCount / totalStudents) * 100),
        avgScore: Math.round(totalScore / totalStudents),
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
      .filter((q) => q.gte(q.field('created_at'), cutoff))
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
