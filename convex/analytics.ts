import { v } from 'convex/values';

import { internal } from './_generated/api';
import { internalMutation, mutation, query } from './_generated/server';
import { assertUniversityAccess, getAuthenticatedUser, isServiceRequest } from './lib/roles';

// ============================================================================
// Helper Functions for Optimized Analytics
// ============================================================================

function calculateMonthlyGrowth(users: any[], currentMonth: number, currentYear: number): number {
  const thisMonth = users.filter((u) => {
    const userDate = new Date(u.created_at);
    return userDate.getMonth() === currentMonth && userDate.getFullYear() === currentYear;
  }).length;

  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const prevMonth = users.filter((u) => {
    const userDate = new Date(u.created_at);
    return userDate.getMonth() === lastMonth && userDate.getFullYear() === lastMonthYear;
  }).length;

  if (prevMonth === 0) return 0;
  return Math.round(((thisMonth - prevMonth) / prevMonth) * 100);
}

function calculateUserGrowth(
  users: any[],
  monthsBack: number,
): Array<{ month: string; users: number; universities?: number }> {
  const monthBoundaries: Array<{ start: number; end: number; label: string }> = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).getTime();
    const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    monthBoundaries.push({ start: monthStart, end: monthEnd, label });
  }

  const monthCounts: Record<string, number> = {};
  monthBoundaries.forEach((m) => (monthCounts[m.label] = 0));

  for (const user of users) {
    for (const boundary of monthBoundaries) {
      if (user.created_at >= boundary.start && user.created_at <= boundary.end) {
        monthCounts[boundary.label]++;
        break;
      }
    }
  }

  return monthBoundaries.map((m) => ({
    month: m.label,
    users: monthCounts[m.label],
  }));
}

function calculateActivityData(
  users: any[],
  recentApplications: any[],
  daysBack: number,
): Array<{ day: string; logins: number; registrations: number }> {
  const dayBoundaries: Array<{ start: number; end: number; label: string }> = [];

  for (let i = daysBack - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;
    dayBoundaries.push({
      start: dayStart,
      end: dayEnd,
      label: date.toLocaleDateString('en-US', { weekday: 'short' }),
    });
  }

  return dayBoundaries.map((day) => {
    const dayRegistrations = users.filter(
      (user) => user.created_at >= day.start && user.created_at <= day.end,
    ).length;

    const dayApplicationsCount = recentApplications.filter(
      (app) => app.created_at >= day.start && app.created_at <= day.end,
    ).length;

    return {
      day: day.label,
      logins: Math.max(dayApplicationsCount * 3, dayRegistrations * 5),
      registrations: dayRegistrations,
    };
  });
}

async function requireSuperAdminUser(ctx: any, providedClerkId?: string) {
  const user = await getAuthenticatedUser(ctx);
  if (providedClerkId && user.clerkId !== providedClerkId) {
    throw new Error('Unauthorized: Clerk identity mismatch');
  }
  if (user.role !== 'super_admin') {
    throw new Error('Unauthorized: Super admin required');
  }
  return user;
}

async function getLatestAdminAnalyticsCache(ctx: any) {
  const latest = await ctx.db
    .query('admin_analytics_cache')
    .withIndex('by_snapshot_at')
    .order('desc')
    .take(1);
  return latest[0] ?? null;
}

type PaginatedPage<T> = { page: T[]; continueCursor: string; isDone: boolean };

async function collectAll<T>(
  makeQuery: () => { paginate: (opts: any) => Promise<PaginatedPage<T>> },
) {
  let cursor: string | null = null;
  let isDone = false;
  const results: T[] = [];

  while (!isDone) {
    const page = await makeQuery().paginate({ cursor, numItems: 500 });
    results.push(...page.page);
    cursor = page.continueCursor;
    isDone = page.isDone;
  }

  return results;
}

async function countFeatureUsage(
  ctx: any,
  tableName:
    | 'applications'
    | 'resumes'
    | 'goals'
    | 'cover_letters'
    | 'ai_coach_conversations'
    | 'interview_practice_sessions'
    | 'career_paths'
    | 'networking_contacts',
  eligibleUserIds: Set<string>,
) {
  let total = 0;
  const uniqueUsers = new Set<string>();
  const items = await ctx.db.query(tableName).collect();

  for (const item of items) {
    if (item.user_id && eligibleUserIds.has(item.user_id)) {
      total++;
      uniqueUsers.add(item.user_id);
    }
  }

  return { users: uniqueUsers.size, total };
}

// MIGRATION: Using stage with status fallback for consistency
// See docs/TECH_DEBT_APPLICATION_STATUS_STAGE.md
function stageFromStatus(status?: string) {
  switch (status) {
    case 'offer':
      return 'Offer';
    case 'applied':
      return 'Applied';
    case 'interview':
      return 'Interview';
    case 'rejected':
      return 'Rejected';
    case 'saved':
      return 'Prospect';
    case 'accepted':
      return 'Accepted';
    case 'withdrawn':
      return 'Withdrawn';
    case 'archived':
      return 'Archived';
    default:
      return undefined;
  }
}

// ============================================================================
// Queries
// ============================================================================

// ============================================================================
// OPTIMIZED QUERIES - Split into smaller, faster queries
// ============================================================================

// Get system stats with minimal data transfer (just counts)
// Now uses centralized metrics module for accurate investor-facing metrics
export const getSystemStatsOptimized = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdminUser(ctx, args.clerkId);
    const cache = await getLatestAdminAnalyticsCache(ctx);
    if (!cache) {
      throw new Error('Admin analytics cache not available');
    }

    return {
      totalUsers: cache.total_users_all_time,
      totalUniversities: cache.total_universities_all_time,
      activeUsers: cache.active_users_30d,
      activeUniversities: cache.active_universities_current,
      systemHealth: cache.system_health,
      monthlyGrowth: cache.monthly_growth,
      supportTickets: cache.open_support_tickets,
      systemUptime: cache.system_uptime,
    };
  },
});

// Get user growth data (pre-calculated, 6 data points only)
export const getUserGrowthOptimized = query({
  args: {
    clerkId: v.string(),
    monthsBack: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdminUser(ctx, args.clerkId);

    const monthsBack = args.monthsBack || 6;
    const cache = await getLatestAdminAnalyticsCache(ctx);
    if (!cache) {
      throw new Error('Admin analytics cache not available');
    }
    const start = Math.max(0, cache.user_growth.length - monthsBack);
    return cache.user_growth.slice(start);
  },
});

// Get activity data (pre-calculated, 7 data points only)
export const getActivityDataOptimized = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdminUser(ctx, args.clerkId);
    const cache = await getLatestAdminAnalyticsCache(ctx);
    if (!cache) {
      throw new Error('Admin analytics cache not available');
    }
    return cache.activity_data;
  },
});

// Get support metrics (just counts, no arrays)
export const getSupportMetricsOptimized = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdminUser(ctx, args.clerkId);
    const cache = await getLatestAdminAnalyticsCache(ctx);
    if (!cache) {
      throw new Error('Admin analytics cache not available');
    }
    return {
      openTickets: cache.support_metrics.open_tickets,
      resolvedToday: cache.support_metrics.resolved_today,
      avgResponseTime: cache.support_metrics.avg_response_time_hours,
      totalTickets: cache.support_metrics.total_tickets,
      resolvedTickets: cache.support_metrics.resolved_tickets,
      inProgressTickets: cache.support_metrics.in_progress_tickets,
    };
  },
});

// Get recent users (minimal data, limit 10)
export const getRecentUsersOptimized = query({
  args: {
    clerkId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdminUser(ctx, args.clerkId);

    const limit = args.limit || 10;
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const recentUsers = await ctx.db
      .query('users')
      .filter((q) => q.gte(q.field('created_at'), thirtyDaysAgo))
      .order('desc')
      .take(limit);

    return recentUsers.map((user) => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      created_at: user.created_at,
      university_id: user.university_id,
      subscription_plan: user.subscription_plan,
    }));
  },
});

// Get subscription distribution (3 data points only)
export const getSubscriptionDistributionOptimized = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdminUser(ctx, args.clerkId);
    const cache = await getLatestAdminAnalyticsCache(ctx);
    if (!cache) {
      throw new Error('Admin analytics cache not available');
    }
    return cache.subscription_distribution;
  },
});

// Get top universities (simplified, 5 universities only)
export const getTopUniversitiesOptimized = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdminUser(ctx, args.clerkId);

    const universities = await ctx.db.query('universities').take(5);

    return universities.map((uni) => ({
      name: uni.name,
      users: 0, // Placeholder - will be calculated on-demand if needed
      status: uni.status === 'active' ? 'Active' : 'Inactive',
    }));
  },
});

// ============================================================================
// LEGACY QUERIES (kept for backwards compatibility)
// ============================================================================

// Lightweight analytics for Overview tab only - OPTIMIZED for bandwidth
export const getOverviewAnalytics = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdminUser(ctx, args.clerkId);

    // Fetch only essential data for Overview tab with strict limits
    const [users, universities, supportTickets] = await Promise.all([
      ctx.db.query('users').take(500), // Reduced from 2000
      ctx.db.query('universities').take(50),
      ctx.db.query('support_tickets').take(200), // Reduced from 2000
    ]);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    // System stats - lightweight calculations
    const systemStats = {
      totalUsers: users.length,
      totalUniversities: universities.length,
      activeUsers: users.filter((u) => u.subscription_status === 'active').length,
      systemHealth: 98.5,
      monthlyGrowth: calculateMonthlyGrowth(users, currentMonth, currentYear),
      supportTickets: supportTickets.filter(
        (t) => t.status === 'open' || t.status === 'in_progress',
      ).length,
      systemUptime: 99.9,
    };

    // User growth data (last 6 months only) - single pass
    const userGrowth = calculateUserGrowth(users, 6);

    // Subscription distribution
    const planSegmentation = users.reduce(
      (acc, user) => {
        const plan = user.subscription_plan || 'free';
        acc[plan] = (acc[plan] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const subscriptionData = [
      { name: 'University', value: planSegmentation.university || 0, color: '#4F46E5' },
      { name: 'Premium', value: planSegmentation.premium || 0, color: '#10B981' },
      { name: 'Free', value: planSegmentation.free || 0, color: '#F59E0B' },
    ];

    // Recent users (last 30 days, limit 20)
    const recentUsers = users
      .filter((u) => u.created_at >= thirtyDaysAgo)
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, 20);

    // Support metrics
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTimestamp = todayStart.getTime();

    const openTickets = supportTickets.filter(
      (t) => t.status === 'open' || t.status === 'in_progress',
    );
    const resolvedToday = supportTickets.filter(
      (t) => t.status === 'resolved' && t.resolved_at && t.resolved_at >= todayTimestamp,
    );
    const resolvedTickets = supportTickets.filter((t) => t.status === 'resolved' && t.resolved_at);
    const avgResponseTimeMs =
      resolvedTickets.length > 0
        ? resolvedTickets.reduce((sum, t) => sum + (t.resolved_at! - t.created_at), 0) /
          resolvedTickets.length
        : 0;
    const avgResponseTimeHours = (avgResponseTimeMs / (1000 * 60 * 60)).toFixed(1);

    const supportMetrics = {
      openTickets: openTickets.length,
      resolvedToday: resolvedToday.length,
      avgResponseTime: avgResponseTimeHours,
      totalTickets: supportTickets.length,
      resolvedTickets: resolvedTickets.length,
      inProgressTickets: supportTickets.filter((t) => t.status === 'in_progress').length,
    };

    // Activity data (last 7 days only) - lightweight
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentApplications = await ctx.db
      .query('applications')
      .filter((q) => q.gte(q.field('created_at'), sevenDaysAgo))
      .take(200);

    const activityData = calculateActivityData(users, recentApplications, 7);

    // Simple university data for Overview (no nested queries)
    const universityData = universities.slice(0, 5).map((uni) => ({
      name: uni.name,
      users: 0, // Placeholder - calculated on-demand in University tab
      status: uni.status === 'active' ? 'Active' : 'Inactive',
    }));

    return {
      systemStats,
      supportMetrics,
      userGrowth,
      subscriptionData,
      recentUsers,
      activityData,
      universityData, // Simplified for Overview
    };
  },
});

// DEPRECATED - Use getOverviewAnalytics instead
// Kept for backwards compatibility during migration
export const getAdminAnalytics = query({
  args: {
    clerkId: v.string(),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
    userType: v.optional(
      v.union(
        v.literal('all'),
        v.literal('user'),
        v.literal('super_admin'),
        v.literal('university_admin'),
      ),
    ),
    subscriptionFilter: v.optional(
      v.union(v.literal('all'), v.literal('free'), v.literal('premium'), v.literal('university')),
    ),
  },
  handler: async (ctx, args) => {
    await requireSuperAdminUser(ctx, args.clerkId);

    // Build query with filters
    let usersQuery = ctx.db.query('users');

    // Apply date filters
    if (args.dateFrom && args.dateTo) {
      usersQuery = usersQuery.filter((q) =>
        q.and(
          q.gte(q.field('created_at'), args.dateFrom!),
          q.lte(q.field('created_at'), args.dateTo!),
        ),
      );
    }

    // Apply user type filter
    if (args.userType && args.userType !== 'all') {
      usersQuery = usersQuery.filter((q) => q.eq(q.field('role'), args.userType));
    }

    // Apply subscription filter
    if (args.subscriptionFilter && args.subscriptionFilter !== 'all') {
      usersQuery = usersQuery.filter((q) =>
        q.eq(q.field('subscription_plan'), args.subscriptionFilter),
      );
    }

    // Paginate user collection (limit to 2k users for bandwidth optimization)
    const users = await usersQuery.take(2000);

    // Calculate metrics
    const totalUsers = users.length;
    const activeUsers = users.filter((u) => u.subscription_status === 'active').length;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const newUsersThisMonth = users.filter((u) => {
      const userDate = new Date(u.created_at);
      return userDate.getMonth() === currentMonth && userDate.getFullYear() === currentYear;
    }).length;

    // User growth data (last 12 months) - optimized with single pass
    const userGrowth: Array<{ month: string; users: number; monthStart: number }> = [];
    const monthCounts: Record<string, number> = {};

    // Pre-calculate month boundaries
    const monthBoundaries: Array<{ start: number; end: number; label: string }> = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).getTime();
      const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthBoundaries.push({ start: monthStart, end: monthEnd, label });
      monthCounts[label] = 0;
    }

    // Single pass through users for growth calculation
    for (const user of users) {
      for (const boundary of monthBoundaries) {
        if (user.created_at >= boundary.start && user.created_at <= boundary.end) {
          monthCounts[boundary.label]++;
          break;
        }
      }
    }

    // Build userGrowth array
    for (const boundary of monthBoundaries) {
      userGrowth.push({
        month: boundary.label,
        users: monthCounts[boundary.label],
        monthStart: boundary.start,
      });
    }

    // User segmentation by role
    const roleSegmentation = users.reduce(
      (acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // User segmentation by plan (use 'free' as default for deprecated field)
    const planSegmentation = users.reduce(
      (acc, user) => {
        const plan = user.subscription_plan || 'free'; // Handle optional/deprecated field
        acc[plan] = (acc[plan] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Feature usage (based on created content)
    const featureUsage = await getFeatureUsage(ctx, users);

    // University growth metrics
    const universityGrowth = await getUniversityGrowth(ctx);

    // Recent users (last 30 days)
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentUsers = users
      .filter((u) => u.created_at >= thirtyDaysAgo)
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, 20);

    // Get universities for university data
    const universities = await collectAll(() => ctx.db.query('universities'));

    // Get all support tickets for detailed metrics (limited for bandwidth)
    const allSupportTickets = await ctx.db.query('support_tickets').take(2000);

    const openTickets = allSupportTickets.filter(
      (t) => t.status === 'open' || t.status === 'in_progress',
    );
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTimestamp = todayStart.getTime();

    const resolvedToday = allSupportTickets.filter(
      (t) => t.status === 'resolved' && t.resolved_at && t.resolved_at >= todayTimestamp,
    );

    // Calculate average response time for resolved tickets
    const resolvedTickets = allSupportTickets.filter(
      (t) => t.status === 'resolved' && t.resolved_at,
    );
    const avgResponseTimeMs =
      resolvedTickets.length > 0
        ? resolvedTickets.reduce((sum, t) => sum + (t.resolved_at! - t.created_at), 0) /
          resolvedTickets.length
        : 0;
    const avgResponseTimeHours = (avgResponseTimeMs / (1000 * 60 * 60)).toFixed(1);

    // Calculate system stats
    const systemStats = {
      totalUsers: users.length,
      totalUniversities: universities.length,
      activeUsers: users.filter((u) => u.subscription_status === 'active').length,
      systemHealth: 98.5, // Would be calculated from actual monitoring
      monthlyGrowth:
        userGrowth.length > 1
          ? Math.floor(
              (userGrowth[userGrowth.length - 1].users / userGrowth[userGrowth.length - 2].users -
                1) *
                100,
            )
          : 0,
      supportTickets: openTickets.length,
      systemUptime: 99.9, // Would come from monitoring system
    };

    // Support metrics
    const supportMetrics = {
      openTickets: openTickets.length,
      resolvedToday: resolvedToday.length,
      avgResponseTime: avgResponseTimeHours,
      totalTickets: allSupportTickets.length,
      resolvedTickets: resolvedTickets.length,
      inProgressTickets: allSupportTickets.filter((t) => t.status === 'in_progress').length,
    };

    // Transform plan segmentation into subscription data format
    const subscriptionData = [
      { name: 'University', value: planSegmentation.university || 0, color: '#4F46E5' },
      { name: 'Premium', value: planSegmentation.premium || 0, color: '#10B981' },
      { name: 'Free', value: planSegmentation.free || 0, color: '#F59E0B' },
    ];

    // Create real university data from actual universities with detailed metrics
    // Limit to top 10 universities to prevent excessive data fetching and stay under 16MB limit
    const universityData = await Promise.all(
      universities.slice(0, 10).map(async (uni) => {
        const uniUsers = await collectAll(() =>
          ctx.db.query('users').withIndex('by_university', (q) => q.eq('university_id', uni._id)),
        );

        // Calculate license utilization
        const licenseUtilization =
          uni.license_seats > 0 ? Math.round((uniUsers.length / uni.license_seats) * 100) : 0;

        // Get students (non-admin users)
        const students = uniUsers.filter((u) => u.role === 'user');
        const advisors = uniUsers.filter((u) => u.role === 'university_admin');

        // Calculate MAU (users with activity in last 30 days)
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

        // Get recent activity from various features (reduced limits for bandwidth)
        const userIds = uniUsers.map((u) => u._id);
        const [recentApps, recentResumes, recentGoals, recentProjects] = await Promise.all([
          ctx.db
            .query('applications')
            .filter((q) => q.gte(q.field('created_at'), thirtyDaysAgo))
            .take(1000),
          ctx.db
            .query('resumes')
            .filter((q) => q.gte(q.field('created_at'), thirtyDaysAgo))
            .take(1000),
          ctx.db
            .query('goals')
            .filter((q) => q.gte(q.field('created_at'), thirtyDaysAgo))
            .take(1000),
          ctx.db
            .query('projects')
            .filter((q) => q.gte(q.field('created_at'), thirtyDaysAgo))
            .take(1000),
        ]);

        // Get unique users with activity
        const activeUserIds = new Set([
          ...recentApps.filter((a) => userIds.includes(a.user_id)).map((a) => a.user_id),
          ...recentResumes.filter((r) => userIds.includes(r.user_id)).map((r) => r.user_id),
          ...recentGoals.filter((g) => userIds.includes(g.user_id)).map((g) => g.user_id),
          ...recentProjects.filter((p) => userIds.includes(p.user_id)).map((p) => p.user_id),
        ]);

        const mau = activeUserIds.size;

        // Calculate feature usage for this university using indexed queries with by_user filter
        // This significantly reduces data transfer by only fetching records for users in this university
        const [uniApps, uniResumes, uniGoals, uniProjects, uniCoverLetters] = await Promise.all([
          // For each query, we'll fetch a limited set and filter by userIds
          // Using take() with a reasonable limit to prevent excessive data fetching
          Promise.all(
            userIds.slice(0, 50).map((userId) =>
              ctx.db
                .query('applications')
                .withIndex('by_user', (q) => q.eq('user_id', userId))
                .take(20),
            ),
          ).then((results) => results.flat()),
          Promise.all(
            userIds.slice(0, 50).map((userId) =>
              ctx.db
                .query('resumes')
                .withIndex('by_user', (q) => q.eq('user_id', userId))
                .take(10),
            ),
          ).then((results) => results.flat()),
          Promise.all(
            userIds.slice(0, 50).map((userId) =>
              ctx.db
                .query('goals')
                .withIndex('by_user', (q) => q.eq('user_id', userId))
                .take(10),
            ),
          ).then((results) => results.flat()),
          Promise.all(
            userIds.slice(0, 50).map((userId) =>
              ctx.db
                .query('projects')
                .withIndex('by_user', (q) => q.eq('user_id', userId))
                .take(10),
            ),
          ).then((results) => results.flat()),
          Promise.all(
            userIds.slice(0, 50).map((userId) =>
              ctx.db
                .query('cover_letters')
                .withIndex('by_user', (q) => q.eq('user_id', userId))
                .take(10),
            ),
          ).then((results) => results.flat()),
        ]);

        const featureUsage = {
          applications: uniApps.length,
          resumes: uniResumes.length,
          goals: uniGoals.length,
          projects: uniProjects.length,
          coverLetters: uniCoverLetters.length,
        };

        return {
          name: uni.name,
          users: uniUsers.length,
          students: students.length,
          advisors: advisors.length,
          licenseSeats: uni.license_seats,
          licenseUtilization,
          mau,
          mauPercentage: students.length > 0 ? Math.round((mau / students.length) * 100) : 0,
          status: uni.status === 'active' ? 'Active' : 'Inactive',
          featureUsage,
        };
      }),
    );

    // Calculate MAU trends for universities (last 6 months)
    const mauTrends: Array<{ month: string; [key: string]: string | number }> = [];
    const monthBoundariesForMAU: Array<{ start: number; end: number; label: string }> = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).getTime();
      const label = date.toLocaleDateString('en-US', { month: 'short' });
      monthBoundariesForMAU.push({ start: monthStart, end: monthEnd, label });
    }

    // Get all activity for the last 6 months (reduced limits)
    const sixMonthsAgo = monthBoundariesForMAU[0].start;
    const [allApps, allResumes, allGoals, allProjects] = await Promise.all([
      ctx.db
        .query('applications')
        .filter((q) => q.gte(q.field('created_at'), sixMonthsAgo))
        .take(1000),
      ctx.db
        .query('resumes')
        .filter((q) => q.gte(q.field('created_at'), sixMonthsAgo))
        .take(1000),
      ctx.db
        .query('goals')
        .filter((q) => q.gte(q.field('created_at'), sixMonthsAgo))
        .take(1000),
      ctx.db
        .query('projects')
        .filter((q) => q.gte(q.field('created_at'), sixMonthsAgo))
        .take(1000),
    ]);

    // Pre-fetch all university users ONCE (not inside the loop)
    // This prevents N database queries where N = universities.length
    const universityUsersMap = new Map();
    for (const uni of universities.slice(0, 10)) {
      // Limit to top 10 universities to prevent excessive data
      const uniUsers = await collectAll(() =>
        ctx.db.query('users').withIndex('by_university', (q) => q.eq('university_id', uni._id)),
      );
      universityUsersMap.set(
        uni._id,
        uniUsers.map((u) => u._id),
      );
    }

    // Calculate MAU for each month for each university
    for (const boundary of monthBoundariesForMAU) {
      const monthData: { month: string; [key: string]: string | number } = {
        month: boundary.label,
      };

      for (const uni of universities.slice(0, 10)) {
        // Match the limit above
        const userIds = universityUsersMap.get(uni._id) || [];

        // Get activity for this month
        const monthApps = allApps.filter(
          (a) =>
            userIds.includes(a.user_id) &&
            a.created_at >= boundary.start &&
            a.created_at <= boundary.end,
        );
        const monthResumes = allResumes.filter(
          (r) =>
            userIds.includes(r.user_id) &&
            r.created_at >= boundary.start &&
            r.created_at <= boundary.end,
        );
        const monthGoals = allGoals.filter(
          (g) =>
            userIds.includes(g.user_id) &&
            g.created_at >= boundary.start &&
            g.created_at <= boundary.end,
        );
        const monthProjects = allProjects.filter(
          (p) =>
            userIds.includes(p.user_id) &&
            p.created_at >= boundary.start &&
            p.created_at <= boundary.end,
        );

        const activeUsersThisMonth = new Set([
          ...monthApps.map((a) => a.user_id),
          ...monthResumes.map((r) => r.user_id),
          ...monthGoals.map((g) => g.user_id),
          ...monthProjects.map((p) => p.user_id),
        ]);

        monthData[uni.name] = activeUsersThisMonth.size;
      }

      mauTrends.push(monthData);
    }

    // Calculate activity data (last 7 days) - optimized
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Fetch all applications from last 7 days in one query
    const recentApplications = await ctx.db
      .query('applications')
      .filter((q) => q.gte(q.field('created_at'), sevenDaysAgo))
      .take(1000);

    // Pre-calculate day boundaries
    const dayBoundaries: Array<{ start: number; end: number; label: string }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;
      dayBoundaries.push({
        start: dayStart,
        end: dayEnd,
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
      });
    }

    // Single pass through users and applications to build activity data
    const activityData = dayBoundaries.map((day) => {
      const dayRegistrations = users.filter(
        (user) => user.created_at >= day.start && user.created_at <= day.end,
      ).length;

      const dayApplicationsCount = recentApplications.filter(
        (app) => app.created_at >= day.start && app.created_at <= day.end,
      ).length;

      return {
        day: day.label,
        logins: Math.max(dayApplicationsCount * 3, dayRegistrations * 5),
        registrations: dayRegistrations,
      };
    });

    return {
      overview: {
        totalUsers,
        activeUsers,
        newUsersThisMonth,
      },
      systemStats,
      supportMetrics,
      userGrowth,
      roleSegmentation,
      planSegmentation,
      subscriptionData,
      featureUsage,
      universityGrowth,
      universityData,
      mauTrends,
      activityData,
      recentUsers,
      filters: {
        dateFrom: args.dateFrom,
        dateTo: args.dateTo,
        userType: args.userType,
        subscriptionFilter: args.subscriptionFilter,
      },
    };
  },
});

// Helper function to calculate feature usage
async function getFeatureUsage(ctx: any, users: any[]) {
  const userCount = users.length || 1; // Prevent division by zero
  const userIds = users.map((u) => u._id);

  // Limit to first 100 users to prevent excessive queries
  const limitedUserIds = userIds.slice(0, 100);

  // Fetch feature data only for the filtered users using indexed queries
  // This significantly reduces data transfer compared to fetching all records
  const [resumes, applications, coverLetters, goals, projects] = await Promise.all([
    Promise.all(
      limitedUserIds.map((userId) =>
        ctx.db
          .query('resumes')
          .withIndex('by_user', (q: any) => q.eq('user_id', userId))
          .take(10),
      ),
    ).then((results) => results.flat()),
    Promise.all(
      limitedUserIds.map((userId) =>
        ctx.db
          .query('applications')
          .withIndex('by_user', (q: any) => q.eq('user_id', userId))
          .take(20),
      ),
    ).then((results) => results.flat()),
    Promise.all(
      limitedUserIds.map((userId) =>
        ctx.db
          .query('cover_letters')
          .withIndex('by_user', (q: any) => q.eq('user_id', userId))
          .take(10),
      ),
    ).then((results) => results.flat()),
    Promise.all(
      limitedUserIds.map((userId) =>
        ctx.db
          .query('goals')
          .withIndex('by_user', (q: any) => q.eq('user_id', userId))
          .take(10),
      ),
    ).then((results) => results.flat()),
    Promise.all(
      limitedUserIds.map((userId) =>
        ctx.db
          .query('projects')
          .withIndex('by_user', (q: any) => q.eq('user_id', userId))
          .take(10),
      ),
    ).then((results) => results.flat()),
  ]);

  return [
    {
      feature: 'Resume Builder',
      count: resumes.length,
      percentage: Math.round((resumes.length / userCount) * 100),
    },
    {
      feature: 'Job Applications',
      count: applications.length,
      percentage: Math.round((applications.length / userCount) * 100),
    },
    {
      feature: 'Cover Letters',
      count: coverLetters.length,
      percentage: Math.round((coverLetters.length / userCount) * 100),
    },
    {
      feature: 'Career Goals',
      count: goals.length,
      percentage: Math.round((goals.length / userCount) * 100),
    },
    {
      feature: 'Projects',
      count: projects.length,
      percentage: Math.round((projects.length / userCount) * 100),
    },
  ].sort((a, b) => b.count - a.count);
}

// Helper function to get university growth metrics
async function getUniversityGrowth(ctx: any) {
  const universities = await ctx.db.query('universities').take(1000);

  // Pre-calculate month boundaries
  const monthBoundaries: Array<{ start: number; end: number; label: string }> = [];
  for (let i = 11; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).getTime();
    monthBoundaries.push({
      start: monthStart,
      end: monthEnd,
      label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    });
  }

  // Single pass to build all metrics
  let activeCount = 0;
  const monthCounts: Record<string, number> = {};
  const licenseDistribution: Record<string, number> = {};

  monthBoundaries.forEach((m) => (monthCounts[m.label] = 0));

  for (const uni of universities) {
    if (uni.status === 'active') activeCount++;

    for (const boundary of monthBoundaries) {
      if (uni.created_at >= boundary.start && uni.created_at <= boundary.end) {
        monthCounts[boundary.label]++;
        break;
      }
    }

    licenseDistribution[uni.license_plan] = (licenseDistribution[uni.license_plan] || 0) + 1;
  }

  const universityGrowth = monthBoundaries.map((m) => ({
    month: m.label,
    universities: monthCounts[m.label],
  }));

  return {
    totalUniversities: universities.length,
    activeUniversities: activeCount,
    universityGrowth,
    licenseDistribution,
  };
}

// Get user dashboard analytics
export const getUserDashboardAnalytics = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const actingUser = await getAuthenticatedUser(ctx);

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    const isSelf = actingUser.clerkId === user.clerkId;
    if (!isSelf) {
      if (actingUser.role === 'super_admin') {
        // allow
      } else if (actingUser.role === 'university_admin' || actingUser.role === 'advisor') {
        assertUniversityAccess(actingUser, user.university_id as any);
      } else {
        throw new Error('Unauthorized');
      }
    }

    // Calculate week boundaries for "this week" metrics
    const now = Date.now();
    const startOfWeek = new Date();
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Start of Sunday
    const weekStart = startOfWeek.getTime();

    // Parallelize all user data queries with safety limits to prevent over-fetching for power users
    // Note: We still fetch all records for stats calculation, but limit activity feed processing
    const [
      applications,
      goals,
      interviewStages,
      followupActions,
      resumes,
      coverLetters,
      projects,
      contacts,
      careerPaths,
      advisorSessions,
      interviewPracticeSessions,
      interviewPracticeTurns,
      aiCoachConversations,
    ] = await Promise.all([
      ctx.db
        .query('applications')
        .withIndex('by_user', (q) => q.eq('user_id', user._id))
        .take(200),
      ctx.db
        .query('goals')
        .withIndex('by_user', (q) => q.eq('user_id', user._id))
        .take(200),
      ctx.db
        .query('interview_stages')
        .withIndex('by_user', (q) => q.eq('user_id', user._id))
        .take(200),
      ctx.db
        .query('follow_ups')
        .withIndex('by_user', (q) => q.eq('user_id', user._id))
        .take(200),
      ctx.db
        .query('resumes')
        .withIndex('by_user', (q) => q.eq('user_id', user._id))
        .take(100),
      ctx.db
        .query('cover_letters')
        .withIndex('by_user', (q) => q.eq('user_id', user._id))
        .take(100),
      ctx.db
        .query('projects')
        .withIndex('by_user', (q) => q.eq('user_id', user._id))
        .take(100),
      ctx.db
        .query('networking_contacts')
        .withIndex('by_user', (q) => q.eq('user_id', user._id))
        .take(200),
      ctx.db
        .query('career_paths')
        .withIndex('by_user', (q) => q.eq('user_id', user._id))
        .take(100),
      ctx.db
        .query('advisor_sessions')
        .filter((q) => q.eq(q.field('student_id'), user._id))
        .take(50),
      // Interview practice sessions for mock interview metrics
      ctx.db
        .query('interview_practice_sessions')
        .withIndex('by_user', (q) => q.eq('user_id', user._id))
        .take(100),
      // Interview practice turns for questions answered
      ctx.db
        .query('interview_practice_turns')
        .withIndex('by_user', (q) => q.eq('user_id', user._id))
        .take(500),
      // AI coach conversations for reflections
      ctx.db
        .query('ai_coach_conversations')
        .withIndex('by_user', (q) => q.eq('user_id', user._id))
        .take(100),
    ]);

    // Calculate "this week" metrics
    const applicationsThisWeek = applications.filter((app) => app.created_at >= weekStart).length;
    const goalsThisWeek = goals.filter((goal) => goal.created_at >= weekStart).length;
    const followupsCompletedThisWeek = followupActions.filter(
      (f) => f.status === 'done' && f.completed_at && f.completed_at >= weekStart,
    ).length;
    const totalActionsThisWeek = applicationsThisWeek + goalsThisWeek + followupsCompletedThisWeek;

    // Calculate stats using stage with status fallback during migration
    // See docs/TECH_DEBT_APPLICATION_STATUS_STAGE.md
    const applicationStats = {
      total: applications.length,
      applied: applications.filter(
        (app) => app.stage === 'Applied' || (!app.stage && app.status === 'applied'),
      ).length,
      interview: applications.filter(
        (app) => app.stage === 'Interview' || (!app.stage && app.status === 'interview'),
      ).length,
      offer: applications.filter(
        (app) =>
          app.stage === 'Offer' ||
          app.stage === 'Accepted' ||
          (!app.stage && app.status === 'offer'),
      ).length,
      rejected: applications.filter(
        (app) =>
          app.stage === 'Rejected' ||
          app.stage === 'Withdrawn' ||
          (!app.stage && app.status === 'rejected'),
      ).length,
    };

    const activeGoals = goals.filter(
      (goal) => goal.status === 'active' || goal.status === 'in_progress',
    ).length;

    // Count all incomplete follow-up actions (not just overdue ones)
    const pendingTasks = followupActions.filter((followup) => followup.status === 'open').length;

    // Dashboard header metrics (wiring up the 7 zeros)
    const dashboardMetrics = {
      // Target companies: applications in Prospect stage (researching/considering)
      targetCompanies: applications.filter((app) => {
        const effectiveStage = app.stage ?? stageFromStatus(app.status as any);
        return effectiveStage === 'Prospect';
      }).length,
      // Follow-ups completed: all done follow-ups
      followUpsCompleted: followupActions.filter((f) => f.status === 'done').length,
      // Questions answered: interview practice turns where user provided a transcript response
      questionsAnswered: interviewPracticeTurns.filter((turn) => turn.transcript_text).length,
      // Stories prepared: turns with good STAR structure score (3+ out of 5)
      storiesPrepared: interviewPracticeTurns.filter(
        (turn) =>
          turn.content_signals?.star_structure_score &&
          turn.content_signals.star_structure_score >= 3,
      ).length,
      // Mock interviews completed
      mockInterviewsCompleted: interviewPracticeSessions.filter(
        (session) => session.status === 'completed',
      ).length,
      // Modules completed: goals marked as completed (no dedicated learning modules)
      modulesCompleted: goals.filter((goal) => goal.status === 'completed').length,
      // Reflections logged: AI coach conversation count
      reflectionsLogged: aiCoachConversations.length,
    };

    // Find next upcoming interview
    const upcomingInterviews = interviewStages
      .filter((stage) => stage.scheduled_at && stage.scheduled_at > Date.now())
      .sort((a, b) => (a.scheduled_at || 0) - (b.scheduled_at || 0));

    const nextInterview =
      upcomingInterviews.length > 0
        ? formatNextInterview(upcomingInterviews[0].scheduled_at)
        : 'No Interviews';

    // Recent activity (last 30 days)
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    type ActivityItem = {
      id: string;
      type:
        | 'application'
        | 'application_update'
        | 'interview'
        | 'followup'
        | 'followup_completed'
        | 'goal'
        | 'goal_completed'
        | 'resume'
        | 'cover_letter'
        | 'project'
        | 'contact';
      description: string;
      timestamp: number;
    };

    const activity: ActivityItem[] = [];
    const addActivity = (item: ActivityItem) => {
      if (!item.timestamp || item.timestamp < thirtyDaysAgo) return;
      activity.push(item);
    };

    for (const app of applications) {
      if (app.created_at) {
        addActivity({
          id: `application-created-${app._id}`,
          type: 'application',
          description: `Started tracking ${app.job_title} at ${app.company}`,
          timestamp: app.created_at,
        });
      }

      // MIGRATION: Using stage instead of status
      if (
        (app.stage || app.status) &&
        (app.stage ? app.stage !== 'Prospect' : app.status !== 'saved') &&
        app.updated_at &&
        app.updated_at !== app.created_at
      ) {
        const effectiveStage = app.stage || stageFromStatus(app.status as any);
        const stageText =
          effectiveStage === 'Applied'
            ? 'Applied to'
            : effectiveStage === 'Interview'
              ? 'Moved to interviews for'
              : effectiveStage === 'Offer' || effectiveStage === 'Accepted'
                ? 'Received an offer from'
                : effectiveStage === 'Rejected' || effectiveStage === 'Withdrawn'
                  ? 'Closed application for'
                  : 'Updated application for';

        addActivity({
          id: `application-update-${app._id}`,
          type: 'application_update',
          description: `${stageText} ${app.company}`,
          timestamp: app.updated_at,
        });
      }
    }

    for (const stage of interviewStages) {
      addActivity({
        id: `interview-${stage._id}`,
        type: 'interview',
        description: `Interview scheduled: ${stage.title}`,
        timestamp: stage.created_at,
      });
    }

    for (const followup of followupActions) {
      const label = followup.description || followup.notes || 'Follow-up action';
      addActivity({
        id: `followup-${followup._id}`,
        type: 'followup',
        description: `Scheduled follow-up: ${label}`,
        timestamp: followup.created_at ?? followup.updated_at ?? Date.now(),
      });

      if (followup.status === 'done' && followup.completed_at) {
        addActivity({
          id: `followup-completed-${followup._id}`,
          type: 'followup_completed',
          description: `Completed follow-up: ${label}`,
          timestamp: followup.completed_at,
        });
      }
    }

    for (const goal of goals) {
      addActivity({
        id: `goal-${goal._id}`,
        type: 'goal',
        description: `Created goal: ${goal.title}`,
        timestamp: goal.created_at,
      });

      if (goal.completed_at) {
        addActivity({
          id: `goal-completed-${goal._id}`,
          type: 'goal_completed',
          description: `Completed goal: ${goal.title}`,
          timestamp: goal.completed_at,
        });
      }
    }

    for (const resume of resumes) {
      if (resume.created_at) {
        addActivity({
          id: `resume-created-${resume._id}`,
          type: 'resume',
          description: `Created resume: ${resume.title ?? 'Untitled resume'}`,
          timestamp: resume.created_at,
        });
      }

      if (resume.updated_at && resume.updated_at !== resume.created_at) {
        addActivity({
          id: `resume-updated-${resume._id}`,
          type: 'resume',
          description: `Updated resume: ${resume.title ?? 'Untitled resume'}`,
          timestamp: resume.updated_at,
        });
      }
    }

    for (const coverLetter of coverLetters) {
      const coverLetterLabel =
        coverLetter.job_title ?? coverLetter.company_name ?? coverLetter.name ?? 'Cover letter';

      if (coverLetter.created_at) {
        addActivity({
          id: `cover-letter-created-${coverLetter._id}`,
          type: 'cover_letter',
          description: `Created cover letter for ${coverLetterLabel}`,
          timestamp: coverLetter.created_at,
        });
      }

      if (coverLetter.updated_at && coverLetter.updated_at !== coverLetter.created_at) {
        addActivity({
          id: `cover-letter-updated-${coverLetter._id}`,
          type: 'cover_letter',
          description: `Updated cover letter for ${coverLetterLabel}`,
          timestamp: coverLetter.updated_at,
        });
      }
    }

    for (const project of projects) {
      if (project.created_at) {
        addActivity({
          id: `project-created-${project._id}`,
          type: 'project',
          description: `Added project: ${project.title ?? 'Untitled project'}`,
          timestamp: project.created_at,
        });
      }

      if (project.updated_at && project.updated_at !== project.created_at) {
        addActivity({
          id: `project-updated-${project._id}`,
          type: 'project',
          description: `Updated project: ${project.title ?? 'Untitled project'}`,
          timestamp: project.updated_at,
        });
      }
    }

    for (const contact of contacts) {
      const contactLabel = contact.name ?? contact.email ?? 'Contact';

      if (contact.created_at) {
        addActivity({
          id: `contact-created-${contact._id}`,
          type: 'contact',
          description: `Added contact: ${contactLabel}${contact.company ? ` (${contact.company})` : ''}`,
          timestamp: contact.created_at,
        });
      }

      if (contact.updated_at && contact.updated_at !== contact.created_at) {
        addActivity({
          id: `contact-updated-${contact._id}`,
          type: 'contact',
          description: `Updated contact: ${contactLabel}`,
          timestamp: contact.updated_at,
        });
      }
    }

    const recentActivity = activity.sort((a, b) => b.timestamp - a.timestamp).slice(0, 12);

    // Calculate interview rate
    const interviewRate =
      applicationStats.total > 0
        ? Math.round((applicationStats.interview / applicationStats.total) * 100)
        : 0;

    // Calculate usage data for UsageProgressCard (avoiding separate query)
    const FREE_PLAN_LIMITS = {
      applications: 1,
      goals: 1,
      contacts: 1,
      career_paths: 1,
      projects: 1,
    };

    const usageData = {
      applications: {
        count: applications.length,
        limit: FREE_PLAN_LIMITS.applications,
        used: applications.length >= FREE_PLAN_LIMITS.applications,
      },
      goals: {
        count: goals.length,
        limit: FREE_PLAN_LIMITS.goals,
        used: goals.length >= FREE_PLAN_LIMITS.goals,
      },
      contacts: {
        count: contacts.length,
        limit: FREE_PLAN_LIMITS.contacts,
        used: contacts.length >= FREE_PLAN_LIMITS.contacts,
      },
      career_paths: {
        count: careerPaths.length,
        limit: FREE_PLAN_LIMITS.career_paths,
        used: careerPaths.length >= FREE_PLAN_LIMITS.career_paths,
      },
      projects: {
        count: projects.length,
        limit: FREE_PLAN_LIMITS.projects,
        used: projects.length >= FREE_PLAN_LIMITS.projects,
      },
      resumes: {
        count: resumes.length,
        unlimited: true,
        hasAny: resumes.length > 0,
        hasAiTailored: resumes.some(
          (r) => r.source === 'ai_optimized' || (r.source === 'ai_generated' && r.job_description),
        ),
        firstResumeId: resumes.length > 0 ? resumes[0]._id : null,
      },
      cover_letters: {
        count: coverLetters.length,
        unlimited: true,
        hasAny: coverLetters.length > 0,
      },
    };

    const stepsCompleted = [
      usageData.applications.used,
      usageData.goals.used,
      usageData.contacts.used,
      usageData.career_paths.used,
      usageData.projects.used,
    ].filter(Boolean).length;

    // Calculate overdue follow-ups
    const overdueFollowups = followupActions.filter(
      (f) => f.status === 'open' && f.due_at && f.due_at < now,
    ).length;

    // Get the next upcoming interview with details for hero card
    const nextInterviewDetails =
      upcomingInterviews.length > 0
        ? (() => {
            const interview = upcomingInterviews[0];
            // Find associated application for company name
            const app = applications.find((a) => a._id === interview.application_id);
            return {
              date: interview.scheduled_at,
              company: app?.company || 'Unknown Company',
              title: interview.title,
            };
          })()
        : null;

    return {
      applicationStats,
      activeGoals,
      pendingTasks,
      nextInterview,
      upcomingInterviews: upcomingInterviews.length,
      interviewRate,
      recentActivity,
      // This week metrics for dashboard header
      thisWeek: {
        totalActions: totalActionsThisWeek,
        applicationsAdded: applicationsThisWeek,
        goalsCreated: goalsThisWeek,
        followupsCompleted: followupsCompletedThisWeek,
      },
      // Dashboard header stage metrics
      dashboardMetrics,
      // Enhanced metrics for V2 dashboard
      overdueFollowups,
      nextInterviewDetails,
      // Data for child components to avoid separate queries
      onboardingProgress: {
        completed_tasks: user.completed_tasks || [],
        resumesCount: resumes.length,
        goalsCount: goals.length,
        applicationsCount: applications.length,
        contactsCount: contacts.length,
        userProfile: {
          bio: user.bio,
          linkedin_url: user.linkedin_url,
          work_history: user.work_history,
          education: user.education,
          skills: user.skills,
        },
      },
      usageData: {
        usage: usageData,
        stepsCompleted,
        totalSteps: 5,
        subscriptionPlan: user.subscription_plan || 'free',
      },
      interviewsData: {
        applications: applications,
        interviewStages: interviewStages,
      },
      followupsData: followupActions,
      // Journey progress tracking for student dashboard card
      journeyProgress: {
        careerExploration: {
          isComplete: careerPaths.length > 0,
          count: careerPaths.length,
        },
        resumeBuilding: {
          isComplete: resumes.length > 0,
          count: resumes.length,
        },
        jobSearch: {
          isComplete: applications.length > 0,
          count: applications.length,
        },
        advising: {
          isComplete: advisorSessions.length > 0,
          count: advisorSessions.length,
          completedCount: advisorSessions.filter((s) => s.status === 'completed').length,
        },
        completedSteps: [
          careerPaths.length > 0,
          resumes.length > 0,
          applications.length > 0,
          advisorSessions.length > 0,
        ].filter(Boolean).length,
        totalSteps: 4,
      },
    };
  },
});

// Helper function to format next interview date
function formatNextInterview(timestamp: number | undefined): string {
  if (!timestamp) return 'No Interviews';

  const date = new Date(timestamp);
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    return `Tomorrow ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  } else if (diffDays === 0) {
    return `Today ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  } else {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
}

// Get session analytics (placeholder - would need actual session tracking)
export const getSessionAnalytics = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    await requireSuperAdminUser(ctx, args.clerkId);

    // This would need actual session tracking implementation
    // For now, return placeholder data
    return {
      averageSessionTime: '5m 49s', // Would calculate from actual session data
      totalSessions: 0, // Would count from session tracking
      sessionsToday: 0, // Would count sessions from today
    };
  },
});

// OPTIMIZED University Analytics - loaded on-demand for Universities tab
export const getUniversityAnalytics = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdminUser(ctx, args.clerkId);

    // Fetch top 5 universities only (not 10)
    const universities = await ctx.db.query('universities').take(5);

    if (universities.length === 0) {
      return {
        universityData: [],
        mauTrends: [],
      };
    }

    // OPTIMIZED: Batch query all users for these universities at once
    const allUniversityUserIds = new Set<string>();
    const universityUserMap = new Map<string, any[]>();

    for (const uni of universities) {
      const uniUsers = await ctx.db
        .query('users')
        .withIndex('by_university', (q) => q.eq('university_id', uni._id))
        .take(100); // Limit per university

      universityUserMap.set(uni._id, uniUsers);
      uniUsers.forEach((u) => allUniversityUserIds.add(u._id));
    }

    const userIdArray = Array.from(allUniversityUserIds);

    // OPTIMIZED: Single batched query for all feature data (not per-user!)
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const [allApps, allResumes, allGoals, allProjects, allCoverLetters] = await Promise.all([
      ctx.db
        .query('applications')
        .filter((q) => q.gte(q.field('created_at'), thirtyDaysAgo))
        .take(500),
      ctx.db
        .query('resumes')
        .filter((q) => q.gte(q.field('created_at'), thirtyDaysAgo))
        .take(200),
      ctx.db
        .query('goals')
        .filter((q) => q.gte(q.field('created_at'), thirtyDaysAgo))
        .take(200),
      ctx.db
        .query('projects')
        .filter((q) => q.gte(q.field('created_at'), thirtyDaysAgo))
        .take(200),
      ctx.db
        .query('cover_letters')
        .filter((q) => q.gte(q.field('created_at'), thirtyDaysAgo))
        .take(200),
    ]);

    // Build university data by filtering batched results
    const universityData = universities.map((uni) => {
      const uniUsers = universityUserMap.get(uni._id) || [];
      const uniUserIds = uniUsers.map((u) => u._id);

      // Filter batched data for this university
      const uniApps = allApps.filter((a) => uniUserIds.includes(a.user_id));
      const uniResumes = allResumes.filter((r) => uniUserIds.includes(r.user_id));
      const uniGoals = allGoals.filter((g) => uniUserIds.includes(g.user_id));
      const uniProjects = allProjects.filter((p) => uniUserIds.includes(p.user_id));
      const uniCoverLetters = allCoverLetters.filter((c) => uniUserIds.includes(c.user_id));

      // Calculate MAU from batched data
      const activeUserIds = new Set([
        ...uniApps.map((a) => a.user_id),
        ...uniResumes.map((r) => r.user_id),
        ...uniGoals.map((g) => g.user_id),
        ...uniProjects.map((p) => p.user_id),
      ]);
      const mau = activeUserIds.size;

      const students = uniUsers.filter((u) => u.role === 'user');
      const advisors = uniUsers.filter((u) => u.role === 'university_admin');
      const licenseUtilization =
        uni.license_seats > 0 ? Math.round((uniUsers.length / uni.license_seats) * 100) : 0;

      return {
        name: uni.name,
        users: uniUsers.length,
        students: students.length,
        advisors: advisors.length,
        licenseSeats: uni.license_seats,
        licenseUtilization,
        mau,
        mauPercentage: students.length > 0 ? Math.round((mau / students.length) * 100) : 0,
        status: uni.status === 'active' ? 'Active' : 'Inactive',
        featureUsage: {
          applications: uniApps.length,
          resumes: uniResumes.length,
          goals: uniGoals.length,
          projects: uniProjects.length,
          coverLetters: uniCoverLetters.length,
        },
      };
    });

    // Simplified MAU trends (3 months instead of 6) using batched data
    const mauTrends: Array<{ month: string; [key: string]: string | number }> = [];
    const monthBoundaries: Array<{ start: number; end: number; label: string }> = [];

    for (let i = 2; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).getTime();
      const label = date.toLocaleDateString('en-US', { month: 'short' });
      monthBoundaries.push({ start: monthStart, end: monthEnd, label });
    }

    for (const boundary of monthBoundaries) {
      const monthData: { month: string; [key: string]: string | number } = {
        month: boundary.label,
      };

      for (const uni of universities) {
        const uniUserIds = (universityUserMap.get(uni._id) || []).map((u) => u._id);

        const monthActivity = [
          ...allApps.filter(
            (a) =>
              uniUserIds.includes(a.user_id) &&
              a.created_at >= boundary.start &&
              a.created_at <= boundary.end,
          ),
          ...allResumes.filter(
            (r) =>
              uniUserIds.includes(r.user_id) &&
              r.created_at >= boundary.start &&
              r.created_at <= boundary.end,
          ),
          ...allGoals.filter(
            (g) =>
              uniUserIds.includes(g.user_id) &&
              g.created_at >= boundary.start &&
              g.created_at <= boundary.end,
          ),
          ...allProjects.filter(
            (p) =>
              uniUserIds.includes(p.user_id) &&
              p.created_at >= boundary.start &&
              p.created_at <= boundary.end,
          ),
        ];

        const activeUsersThisMonth = new Set(monthActivity.map((a: any) => a.user_id));
        monthData[uni.name] = activeUsersThisMonth.size;
      }

      mauTrends.push(monthData);
    }

    return {
      universityData,
      mauTrends,
    };
  },
});

// Get analytics for a single university
export const getSingleUniversityAnalytics = query({
  args: {
    clerkId: v.string(),
    universityId: v.id('universities'),
  },
  handler: async (ctx, args) => {
    await requireSuperAdminUser(ctx, args.clerkId);

    // Get the university
    const university = await ctx.db.get(args.universityId);
    if (!university) {
      throw new Error('University not found');
    }

    // Get all users in this university
    const universityUsers = await collectAll(() =>
      ctx.db
        .query('users')
        .withIndex('by_university', (q) => q.eq('university_id', args.universityId)),
    );

    const userIds = universityUsers.map((u) => u._id);
    const students = universityUsers.filter((u) => u.role === 'user');

    // Get real analytics data from the last 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    // Fetch activity data using index-based filtering for better performance
    // This approach filters by user first (using indexes), then by date,
    // avoiding the need to scan all records and then filter by university
    const batchSize = 50; // Process users in batches to avoid hitting Convex limits
    const batchErrors: Array<{ batchIndex: number; error: string }> = [];
    const allResults = {
      apps: [] as any[],
      interviews: [] as any[],
      goals: [] as any[],
      resumes: [] as any[],
      projects: [] as any[],
    };

    // Process users in batches
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batchUserIds = userIds.slice(i, i + batchSize);
      const batchIndex = Math.floor(i / batchSize);

      try {
        const batchResults = await Promise.all([
          // Applications
          Promise.all(
            batchUserIds.map(
              (userId) =>
                ctx.db
                  .query('applications')
                  .withIndex('by_user', (q) => q.eq('user_id', userId))
                  .filter((q) => q.gte(q.field('created_at'), thirtyDaysAgo))
                  .take(100), // Limit per user to prevent unbounded queries
            ),
          ),
          // Interview stages
          Promise.all(
            batchUserIds.map((userId) =>
              ctx.db
                .query('interview_stages')
                .withIndex('by_user', (q) => q.eq('user_id', userId))
                .filter((q) => q.gte(q.field('created_at'), thirtyDaysAgo))
                .take(50),
            ),
          ),
          // Goals
          Promise.all(
            batchUserIds.map((userId) =>
              ctx.db
                .query('goals')
                .withIndex('by_user', (q) => q.eq('user_id', userId))
                .filter((q) => q.gte(q.field('created_at'), thirtyDaysAgo))
                .take(50),
            ),
          ),
          // Resumes
          Promise.all(
            batchUserIds.map((userId) =>
              ctx.db
                .query('resumes')
                .withIndex('by_user', (q) => q.eq('user_id', userId))
                .filter((q) => q.gte(q.field('created_at'), thirtyDaysAgo))
                .take(20),
            ),
          ),
          // Projects
          Promise.all(
            batchUserIds.map((userId) =>
              ctx.db
                .query('projects')
                .withIndex('by_user', (q) => q.eq('user_id', userId))
                .filter((q) => q.gte(q.field('created_at'), thirtyDaysAgo))
                .take(20),
            ),
          ),
        ]);

        allResults.apps.push(...batchResults[0].flat());
        allResults.interviews.push(...batchResults[1].flat());
        allResults.goals.push(...batchResults[2].flat());
        allResults.resumes.push(...batchResults[3].flat());
        allResults.projects.push(...batchResults[4].flat());
      } catch (error) {
        batchErrors.push({ batchIndex, error: String(error) });
        // Continue processing remaining batches
      }
    }

    // Log batch errors if any occurred (analytics should be best-effort)
    if (batchErrors.length > 0) {
      console.warn(`University analytics batch errors for ${university.name}:`, batchErrors);
    }

    const uniApps = allResults.apps;
    const uniInterviews = allResults.interviews;
    const uniGoals = allResults.goals;
    const uniResumes = allResults.resumes;
    const uniProjects = allResults.projects;

    // Calculate DAU, WAU, MAU
    const dauUserIds = new Set([
      ...uniApps.filter((a) => a.created_at >= oneDayAgo).map((a) => a.user_id),
      ...uniResumes.filter((r) => r.created_at >= oneDayAgo).map((r) => r.user_id),
      ...uniGoals.filter((g) => g.created_at >= oneDayAgo).map((g) => g.user_id),
      ...uniProjects.filter((p) => p.created_at >= oneDayAgo).map((p) => p.user_id),
    ]);

    const wauUserIds = new Set([
      ...uniApps.filter((a) => a.created_at >= sevenDaysAgo).map((a) => a.user_id),
      ...uniResumes.filter((r) => r.created_at >= sevenDaysAgo).map((r) => r.user_id),
      ...uniGoals.filter((g) => g.created_at >= sevenDaysAgo).map((g) => g.user_id),
      ...uniProjects.filter((p) => p.created_at >= sevenDaysAgo).map((p) => p.user_id),
    ]);

    const mauUserIds = new Set([
      ...uniApps.map((a) => a.user_id),
      ...uniResumes.map((r) => r.user_id),
      ...uniGoals.map((g) => g.user_id),
      ...uniProjects.map((p) => p.user_id),
    ]);

    const totalApplications = uniApps.length;
    const interviewsScheduled = uniInterviews.filter(
      (i) => i.status === 'scheduled' || i.status === 'completed',
    ).length;
    const offersReceived = uniApps.filter((a) => {
      const stage = a.stage || stageFromStatus(a.status as any);
      return stage === 'Offer' || stage === 'Accepted';
    }).length;
    const placementRate =
      students.length > 0 ? Math.round((offersReceived / students.length) * 100) : 0;

    return {
      engagement: {
        dau: dauUserIds.size,
        wau: wauUserIds.size,
        mau: mauUserIds.size,
        avgSessionDuration: null, // Not tracked yet
      },
      success: {
        applicationsSubmitted: totalApplications,
        interviewsScheduled,
        offersReceived,
        placementRate,
      },
    };
  },
});

// Get revenue analytics from Stripe payments
export const getRevenueAnalytics = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    await requireSuperAdminUser(ctx, args.clerkId);

    // Get all successful payments (reduced limit for bandwidth)
    const payments = await ctx.db
      .query('stripe_payments')
      .withIndex('by_status', (q) => q.eq('status', 'succeeded'))
      .take(2000);

    // Calculate total revenue
    const totalRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0) / 100; // Convert cents to dollars

    // Calculate current month revenue
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const currentMonthPayments = payments.filter((p) => p.payment_date >= currentMonthStart);
    const monthlyRevenue =
      currentMonthPayments.reduce((sum, payment) => sum + payment.amount, 0) / 100;

    // Calculate last month revenue for comparison
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const lastMonthEnd = currentMonthStart - 1;
    const lastMonthPayments = payments.filter(
      (p) => p.payment_date >= lastMonthStart && p.payment_date <= lastMonthEnd,
    );
    const lastMonthRevenue =
      lastMonthPayments.reduce((sum, payment) => sum + payment.amount, 0) / 100;

    // Calculate month-over-month growth
    const monthlyGrowthPercent =
      lastMonthRevenue > 0
        ? Math.round(((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
        : 0;

    // Get active paying users (reduced limit for bandwidth)
    const activeUsers = await ctx.db
      .query('users')
      .filter((q) =>
        q.and(
          q.eq(q.field('subscription_status'), 'active'),
          q.or(
            q.eq(q.field('subscription_plan'), 'premium'),
            q.eq(q.field('subscription_plan'), 'university'),
          ),
        ),
      )
      .take(2000);

    const payingUsersCount = activeUsers.length;

    // Calculate ARPU (Average Revenue Per User)
    const arpu = payingUsersCount > 0 ? monthlyRevenue / payingUsersCount : 0;

    // Calculate revenue growth over last 6 months
    const revenueGrowth: Array<{ month: string; revenue: number; users: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).getTime();
      const label = date.toLocaleDateString('en-US', { month: 'short' });

      const monthPayments = payments.filter(
        (p) => p.payment_date >= monthStart && p.payment_date <= monthEnd,
      );
      const monthRevenue = monthPayments.reduce((sum, payment) => sum + payment.amount, 0) / 100;

      // Get unique customers for this month
      const uniqueCustomers = new Set(monthPayments.map((p) => p.stripe_customer_id)).size;

      revenueGrowth.push({
        month: label,
        revenue: Math.round(monthRevenue),
        users: uniqueCustomers,
      });
    }

    // Get subscription lifecycle data (reduced limit for bandwidth)
    const subscriptionEvents = await ctx.db.query('stripe_subscription_events').take(2000);

    // Calculate churn rate from last month
    const lastMonthCancellations = subscriptionEvents.filter(
      (e) =>
        e.event_type === 'cancelled' &&
        e.event_date >= lastMonthStart &&
        e.event_date <= lastMonthEnd,
    ).length;

    const lastMonthActiveSubscriptions = subscriptionEvents.filter(
      (e) => e.event_date <= lastMonthStart && e.subscription_status === 'active',
    ).length;

    const churnRate =
      lastMonthActiveSubscriptions > 0
        ? ((lastMonthCancellations / lastMonthActiveSubscriptions) * 100).toFixed(1)
        : '0.0';

    // Calculate subscription lifecycle for last 6 months
    const subscriptionLifecycle: Array<{
      month: string;
      new: number;
      renewals: number;
      cancellations: number;
    }> = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).getTime();
      const label = date.toLocaleDateString('en-US', { month: 'short' });

      const monthEvents = subscriptionEvents.filter(
        (e) => e.event_date >= monthStart && e.event_date <= monthEnd,
      );

      subscriptionLifecycle.push({
        month: label,
        new: monthEvents.filter((e) => e.event_type === 'created').length,
        renewals: monthEvents.filter(
          (e) => e.event_type === 'renewed' || e.event_type === 'updated',
        ).length,
        cancellations: monthEvents.filter((e) => e.event_type === 'cancelled').length,
      });
    }

    // Estimate LTV (simplified calculation: ARPU * average subscription length)
    // For now, use a 12-month assumption for active subscriptions
    const estimatedLTV = Math.round(arpu * 12);

    return {
      totalRevenue: Math.round(totalRevenue),
      monthlyRevenue: Math.round(monthlyRevenue),
      monthlyGrowthPercent,
      lastMonthRevenue: Math.round(lastMonthRevenue),
      payingUsersCount,
      arpu: arpu.toFixed(2),
      churnRate,
      estimatedLTV,
      revenueGrowth,
      subscriptionLifecycle,
      totalPayments: payments.length,
      monthlyPayments: currentMonthPayments.length,
    };
  },
});

/**
 * Get active users over time for a university (real data from activity_events)
 */
export const getUniversityActiveUsersOverTime = query({
  args: {
    universityId: v.id('universities'),
    timeRange: v.union(v.literal('daily'), v.literal('weekly'), v.literal('monthly')),
  },
  handler: async (ctx, args) => {
    // Authorization: Verify user can access this university's data
    const actingUser = await getAuthenticatedUser(ctx);
    assertUniversityAccess(actingUser, args.universityId);

    const { universityId, timeRange } = args;
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;

    // Get all students in this university (include legacy 'user' role)
    const students = await collectAll(() =>
      ctx.db
        .query('users')
        .withIndex('by_university', (q) => q.eq('university_id', universityId))
        .filter((q) => q.or(q.eq(q.field('role'), 'student'), q.eq(q.field('role'), 'user'))),
    );

    const studentIds = new Set(students.map((s) => s._id));

    // Get advisors
    const advisors = await collectAll(() =>
      ctx.db
        .query('users')
        .withIndex('by_university', (q) => q.eq('university_id', universityId))
        .filter((q) => q.eq(q.field('role'), 'advisor')),
    );

    const advisorIds = new Set(advisors.map((a) => a._id));

    // Determine lookback period and bucket size
    let lookbackDays: number;
    let bucketMs: number;
    let bucketCount: number;

    if (timeRange === 'daily') {
      lookbackDays = 30;
      bucketMs = msPerDay;
      bucketCount = 30;
    } else if (timeRange === 'weekly') {
      lookbackDays = 84; // 12 weeks
      bucketMs = 7 * msPerDay;
      bucketCount = 12;
    } else {
      lookbackDays = 365; // 12 months
      bucketMs = 30 * msPerDay; // Approximate month
      bucketCount = 12;
    }

    const startTime = now - lookbackDays * msPerDay;

    // Get activity events for the university
    // Use occurred_at (canonical timestamp) for filtering, not created_at
    // Limit to 50k events to prevent unbounded queries for high-activity universities
    const events = await ctx.db
      .query('activity_events')
      .withIndex('by_university', (q) => q.eq('university_id', universityId))
      .filter((q) => q.gte(q.field('occurred_at'), startTime))
      .take(50000);

    // Group events by bucket and count unique users
    const data: Array<{ date: string; students: number; advisors: number }> = [];

    for (let i = bucketCount - 1; i >= 0; i--) {
      const bucketStart = now - (i + 1) * bucketMs;
      const bucketEnd = now - i * bucketMs;

      const bucketEvents = events.filter(
        (e) => e.occurred_at >= bucketStart && e.occurred_at < bucketEnd,
      );

      const activeStudentIds = new Set(
        bucketEvents.filter((e) => studentIds.has(e.user_id)).map((e) => e.user_id),
      );
      const activeAdvisorIds = new Set(
        bucketEvents.filter((e) => advisorIds.has(e.user_id)).map((e) => e.user_id),
      );

      // Format date label
      let dateLabel: string;
      const bucketDate = new Date(bucketEnd);

      if (timeRange === 'daily') {
        dateLabel = bucketDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else if (timeRange === 'weekly') {
        dateLabel = `Week ${bucketCount - i}`;
      } else {
        dateLabel = bucketDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      }

      data.push({
        date: dateLabel,
        students: activeStudentIds.size,
        advisors: activeAdvisorIds.size,
      });
    }

    return {
      data,
      totalStudents: students.length,
      totalAdvisors: advisors.length,
    };
  },
});

/**
 * Get feature usage stats for a university (networking contacts, AI coach)
 */
export const getUniversityFeatureUsage = query({
  args: {
    universityId: v.id('universities'),
  },
  handler: async (ctx, args) => {
    const { universityId } = args;

    // Authorization: Verify user can access this university's data
    const actingUser = await getAuthenticatedUser(ctx);
    assertUniversityAccess(actingUser, universityId);

    // Get all students in this university (include legacy 'user' role)
    const students = await collectAll(() =>
      ctx.db
        .query('users')
        .withIndex('by_university', (q) => q.eq('university_id', universityId))
        .filter((q) => q.or(q.eq(q.field('role'), 'student'), q.eq(q.field('role'), 'user'))),
    );

    const studentIdSet = new Set(students.map((s) => s._id.toString()));

    // Bulk fetch networking contacts for the university, filter to students
    const allContacts = await collectAll(() =>
      ctx.db
        .query('networking_contacts')
        .withIndex('by_university', (q) => q.eq('university_id', universityId)),
    );
    const networkingContactsCount = allContacts.filter((c) =>
      studentIdSet.has(c.user_id.toString()),
    ).length;

    // Bulk fetch AI coach conversations for the university
    const allConversations = await collectAll(() =>
      ctx.db
        .query('ai_coach_conversations')
        .withIndex('by_university', (q) => q.eq('university_id', universityId)),
    );
    const aiCoachConversationsCount = allConversations.filter((c) =>
      studentIdSet.has(c.user_id.toString()),
    ).length;

    return {
      networkingContacts: networkingContactsCount,
      aiCoachConversations: aiCoachConversationsCount,
    };
  },
});

/**
 * Get monthly activity trends for applications, goals, and documents.
 * Shows feature usage over the past 6 months.
 */
export const getUniversityMonthlyTrends = query({
  args: {
    universityId: v.id('universities'),
    monthsBack: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { universityId } = args;
    const monthsBack = Math.min(Math.max(args.monthsBack ?? 6, 1), 12);

    // Authorization: Verify user can access this university's data
    const actingUser = await getAuthenticatedUser(ctx);
    assertUniversityAccess(actingUser, universityId);

    // Get all students in the university (role-filtered)
    const students = await collectAll(() =>
      ctx.db
        .query('users')
        .withIndex('by_university', (q) => q.eq('university_id', universityId))
        .filter((q) => q.or(q.eq(q.field('role'), 'student'), q.eq(q.field('role'), 'user'))),
    );
    const studentIds = new Set(students.map((s) => s._id));

    // Build month boundaries
    const monthBoundaries: Array<{ start: number; end: number; label: string }> = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
      const monthEnd = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      ).getTime();
      const label = date.toLocaleDateString('en-US', { month: 'short' });
      monthBoundaries.push({ start: monthStart, end: monthEnd, label });
    }

    // Use university-scoped queries instead of per-student N+1 queries
    // This keeps query counts bounded regardless of student count
    const applications = await collectAll(() =>
      ctx.db
        .query('applications')
        .withIndex('by_university', (q) => q.eq('university_id', universityId)),
    );

    const goals = await collectAll(() =>
      ctx.db.query('goals').withIndex('by_university', (q) => q.eq('university_id', universityId)),
    );

    const resumes = await collectAll(() =>
      ctx.db
        .query('resumes')
        .withIndex('by_university', (q) => q.eq('university_id', universityId)),
    );

    // Aggregate by month (filtered to students only)
    const trends = monthBoundaries.map((month) => {
      const monthApplications = applications.filter((a) => {
        const created = a.applied_at || a._creationTime;
        return studentIds.has(a.user_id) && created >= month.start && created <= month.end;
      }).length;

      const monthGoals = goals.filter((g) => {
        const created = g.created_at || g._creationTime;
        return studentIds.has(g.user_id) && created >= month.start && created <= month.end;
      }).length;

      const monthResumes = resumes.filter((r) => {
        const created = r.created_at || r._creationTime;
        return studentIds.has(r.user_id) && created >= month.start && created <= month.end;
      }).length;

      return {
        month: month.label,
        applications: monthApplications,
        goals: monthGoals,
        resumes: monthResumes,
      };
    });

    return trends;
  },
});

/**
 * Get department-level analytics (real goals and applications by department)
 */
export const getUniversityDepartmentAnalytics = query({
  args: {
    universityId: v.id('universities'),
  },
  handler: async (ctx, args) => {
    const { universityId } = args;

    // Authorization: Verify user can access this university's data
    const actingUser = await getAuthenticatedUser(ctx);
    assertUniversityAccess(actingUser, universityId);

    // Get all departments
    const departments = await collectAll(() =>
      ctx.db
        .query('departments')
        .withIndex('by_university', (q) => q.eq('university_id', universityId)),
    );

    // Get all students (include legacy 'user' role)
    const students = await collectAll(() =>
      ctx.db
        .query('users')
        .withIndex('by_university', (q) => q.eq('university_id', universityId))
        .filter((q) => q.or(q.eq(q.field('role'), 'student'), q.eq(q.field('role'), 'user'))),
    );

    // Collect all student IDs for bulk queries
    const allStudentIds = students.map((s) => s._id);
    const studentIdSet = new Set(allStudentIds.map((id) => id.toString()));

    // Bulk fetch all goals for the university and filter to students
    const allGoals = await collectAll(() =>
      ctx.db.query('goals').withIndex('by_university', (q) => q.eq('university_id', universityId)),
    );
    const studentGoals = allGoals.filter((g) => studentIdSet.has(g.user_id.toString()));

    // Bulk fetch all applications for the university and filter to students
    const allApplications = await collectAll(() =>
      ctx.db
        .query('applications')
        .withIndex('by_university', (q) => q.eq('university_id', universityId)),
    );
    const studentApplications = allApplications.filter((a) =>
      studentIdSet.has(a.user_id.toString()),
    );

    // Pre-compute counts by user_id for O(1) lookups
    const goalsCountByUser = new Map<string, number>();
    for (const goal of studentGoals) {
      const key = goal.user_id.toString();
      goalsCountByUser.set(key, (goalsCountByUser.get(key) || 0) + 1);
    }

    const applicationsCountByUser = new Map<string, number>();
    for (const app of studentApplications) {
      const key = app.user_id.toString();
      applicationsCountByUser.set(key, (applicationsCountByUser.get(key) || 0) + 1);
    }

    // Build department stats using pre-computed maps
    const departmentStats: Array<{
      departmentId: string;
      departmentName: string;
      departmentCode?: string;
      studentCount: number;
      goalsCount: number;
      applicationsCount: number;
    }> = [];

    for (const dept of departments) {
      const deptStudents = students.filter((s) => s.department_id === dept._id);

      // Aggregate counts from pre-computed maps
      let goalsCount = 0;
      let applicationsCount = 0;
      for (const student of deptStudents) {
        const key = student._id.toString();
        goalsCount += goalsCountByUser.get(key) || 0;
        applicationsCount += applicationsCountByUser.get(key) || 0;
      }

      departmentStats.push({
        departmentId: dept._id,
        departmentName: dept.name,
        departmentCode: dept.code,
        studentCount: deptStudents.length,
        goalsCount,
        applicationsCount,
      });
    }

    return departmentStats;
  },
});

/**
 * Get student funnel/pipeline stages (real data from applications)
 */
export const getUniversityStudentFunnel = query({
  args: {
    universityId: v.id('universities'),
  },
  handler: async (ctx, args) => {
    const { universityId } = args;

    // Authorization: Verify user can access this university's data
    const actingUser = await getAuthenticatedUser(ctx);
    assertUniversityAccess(actingUser, universityId);

    // Get all students (include legacy 'user' role)
    const students = await collectAll(() =>
      ctx.db
        .query('users')
        .withIndex('by_university', (q) => q.eq('university_id', universityId))
        .filter((q) => q.or(q.eq(q.field('role'), 'student'), q.eq(q.field('role'), 'user'))),
    );

    const studentIdSet = new Set(students.map((s) => s._id.toString()));
    const totalStudents = students.length;

    // Bulk fetch all applications for this university
    const allApplications = await collectAll(() =>
      ctx.db
        .query('applications')
        .withIndex('by_university', (q) => q.eq('university_id', universityId)),
    );

    // Group applications by student for O(1) lookups
    const applicationsByStudent = new Map<string, typeof allApplications>();
    for (const app of allApplications) {
      const key = app.user_id.toString();
      if (studentIdSet.has(key)) {
        const existing = applicationsByStudent.get(key) || [];
        existing.push(app);
        applicationsByStudent.set(key, existing);
      }
    }

    // Count students at each stage
    let withProfileComplete = 0;
    let withApplications = 0;
    let withInterviews = 0;
    let withOffers = 0;
    let withAccepted = 0;

    for (const student of students) {
      // Check if profile is complete (has key fields)
      const hasProfile =
        student.name && student.email && (student.bio || student.skills || student.education);
      if (hasProfile) withProfileComplete++;

      // Get applications for this student from pre-fetched map
      const applications = applicationsByStudent.get(student._id.toString()) || [];

      if (applications.length > 0) {
        withApplications++;

        // Check for interview stage
        const hasInterview = applications.some(
          (app) => app.stage === 'Interview' || app.status === 'interview',
        );
        if (hasInterview) withInterviews++;

        // Check for offer
        const hasOffer = applications.some(
          (app) => app.stage === 'Offer' || app.status === 'offer',
        );
        if (hasOffer) withOffers++;

        // Check for accepted (no status fallback needed - 'accepted' was never a valid status value per schema)
        const hasAccepted = applications.some((app) => app.stage === 'Accepted');
        if (hasAccepted) withAccepted++;
      }
    }

    return {
      totalStudents,
      funnel: [
        {
          stage: 'Active Students',
          count: totalStudents,
          percent: 100,
        },
        {
          stage: 'Profile Complete',
          count: withProfileComplete,
          percent: totalStudents > 0 ? Math.round((withProfileComplete / totalStudents) * 100) : 0,
        },
        {
          stage: 'Applied',
          count: withApplications,
          percent: totalStudents > 0 ? Math.round((withApplications / totalStudents) * 100) : 0,
        },
        {
          stage: 'Interviewing',
          count: withInterviews,
          percent: totalStudents > 0 ? Math.round((withInterviews / totalStudents) * 100) : 0,
        },
        {
          stage: 'Offers Received',
          count: withOffers,
          percent: totalStudents > 0 ? Math.round((withOffers / totalStudents) * 100) : 0,
        },
        {
          stage: 'Accepted',
          count: withAccepted,
          percent: totalStudents > 0 ? Math.round((withAccepted / totalStudents) * 100) : 0,
        },
      ],
    };
  },
});

// ============================================================================
// ADVISOR CASELOAD METRICS (Phase 2 - Career Services ICP)
// ============================================================================

/**
 * Get advisor caseload metrics for a university.
 * Provides key metrics for Career Services leadership:
 * - Students per Advisor ratio (NACADA benchmark: 250-300)
 * - Average appointments per month per advisor
 * - Advisor response time (avg time to resolve signals)
 */
export const getAdvisorCaseloadMetrics = query({
  args: {
    universityId: v.id('universities'),
  },
  handler: async (ctx, args) => {
    const { universityId } = args;

    // Authorization: Verify user can access this university's data
    const actingUser = await getAuthenticatedUser(ctx);
    assertUniversityAccess(actingUser, universityId);

    // Get all users for this university
    const allUsers = await collectAll(() =>
      ctx.db.query('users').withIndex('by_university', (q) => q.eq('university_id', universityId)),
    );

    // Separate students and advisors
    const students = allUsers.filter((u) => u.role === 'student' || u.role === 'user');
    const advisors = allUsers.filter((u) => u.role === 'advisor');

    const totalStudents = students.length;
    const totalAdvisors = advisors.length;

    // Calculate Students per Advisor ratio
    const studentsPerAdvisor =
      totalAdvisors > 0 ? Math.round((totalStudents / totalAdvisors) * 10) / 10 : 0;

    // Get advisor assignments to calculate caseload distribution
    const advisorAssignments = await collectAll(() =>
      ctx.db
        .query('student_advisors')
        .withIndex('by_university', (q) => q.eq('university_id', universityId)),
    );

    // Count students per advisor (initialize all advisors with 0)
    const studentCountByAdvisor = new Map<string, number>();
    for (const advisor of advisors) {
      studentCountByAdvisor.set(advisor._id.toString(), 0);
    }
    for (const assignment of advisorAssignments) {
      const advisorId = assignment.advisor_id.toString();
      studentCountByAdvisor.set(advisorId, (studentCountByAdvisor.get(advisorId) || 0) + 1);
    }

    // Calculate caseload distribution (includes zero-caseload advisors)
    const caseloadValues = advisors.map(
      (advisor) => studentCountByAdvisor.get(advisor._id.toString()) || 0,
    );
    const minCaseload = caseloadValues.length > 0 ? Math.min(...caseloadValues) : 0;
    const maxCaseload = caseloadValues.length > 0 ? Math.max(...caseloadValues) : 0;
    const avgCaseload =
      caseloadValues.length > 0
        ? Math.round((caseloadValues.reduce((a, b) => a + b, 0) / caseloadValues.length) * 10) / 10
        : 0;

    // Get sessions from the last 30 days for appointment metrics
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentSessions = await collectAll(() =>
      ctx.db
        .query('advisor_sessions')
        .withIndex('by_university', (q) => q.eq('university_id', universityId))
        .filter((q) => q.gte(q.field('created_at'), thirtyDaysAgo)),
    );

    // Calculate sessions per advisor (include zero-session advisors)
    const sessionCountByAdvisor = new Map<string, number>();
    for (const advisor of advisors) {
      sessionCountByAdvisor.set(advisor._id.toString(), 0);
    }
    for (const session of recentSessions) {
      const advisorId = session.advisor_id.toString();
      sessionCountByAdvisor.set(advisorId, (sessionCountByAdvisor.get(advisorId) || 0) + 1);
    }

    // Calculate average appointments per month per advisor
    const sessionValues = advisors.map(
      (advisor) => sessionCountByAdvisor.get(advisor._id.toString()) || 0,
    );
    const avgAppointmentsPerMonth =
      sessionValues.length > 0
        ? Math.round((sessionValues.reduce((a, b) => a + b, 0) / sessionValues.length) * 10) / 10
        : 0;

    // Build per-advisor breakdown (top 10 by caseload)
    const advisorBreakdown = advisors
      .map((advisor) => {
        const advisorIdStr = advisor._id.toString();
        const caseload = studentCountByAdvisor.get(advisorIdStr) || 0;
        const sessions = sessionCountByAdvisor.get(advisorIdStr) || 0;
        return {
          advisorId: advisor._id,
          advisorName: advisor.name || advisor.email,
          caseload,
          sessionsLast30Days: sessions,
        };
      })
      .sort((a, b) => b.caseload - a.caseload)
      .slice(0, 10);

    return {
      summary: {
        totalStudents,
        totalAdvisors,
        studentsPerAdvisor,
        avgAppointmentsPerMonth,
        totalSessionsLast30Days: recentSessions.length,
      },
      caseloadDistribution: {
        min: minCaseload,
        max: maxCaseload,
        avg: avgCaseload,
      },
      // NACADA benchmark reference
      benchmark: {
        recommended: 250,
        max: 300,
        status:
          studentsPerAdvisor <= 250
            ? 'optimal'
            : studentsPerAdvisor <= 300
              ? 'acceptable'
              : 'overloaded',
      },
      advisorBreakdown,
    };
  },
});

// ============================================================================
// INTERVENTION CORRELATION (Phase 2 - Career Services ICP)
// ============================================================================

/**
 * Get correlation between advisor interventions and student outcomes.
 * Answers the key Career Services question:
 * "Do our interventions actually improve outcomes?"
 *
 * Groups students by session count and compares employment rates.
 * Example output: "Students with 3+ sessions: 78% employed vs 52% for 0 sessions"
 */
export const getInterventionCorrelation = query({
  args: {
    universityId: v.id('universities'),
  },
  handler: async (ctx, args) => {
    const { universityId } = args;

    // Authorization: Verify user can access this university's data
    const actingUser = await getAuthenticatedUser(ctx);
    assertUniversityAccess(actingUser, universityId);

    // Get all students for this university
    const allUsers = await collectAll(() =>
      ctx.db
        .query('users')
        .withIndex('by_university', (q) => q.eq('university_id', universityId))
        .filter((q) => q.or(q.eq(q.field('role'), 'student'), q.eq(q.field('role'), 'user'))),
    );

    const studentIds = allUsers.map((u) => u._id);
    const studentIdSet = new Set(studentIds.map((id) => id.toString()));

    // Get all sessions for students in this university
    const allSessions = await collectAll(() =>
      ctx.db
        .query('advisor_sessions')
        .withIndex('by_university', (q) => q.eq('university_id', universityId)),
    );

    // Count sessions per student
    const sessionCountByStudent = new Map<string, number>();
    for (const session of allSessions) {
      const studentIdStr = session.student_id.toString();
      if (studentIdSet.has(studentIdStr)) {
        sessionCountByStudent.set(studentIdStr, (sessionCountByStudent.get(studentIdStr) || 0) + 1);
      }
    }

    // Get graduate outcomes for this university
    const outcomes = await collectAll(() =>
      ctx.db
        .query('graduate_outcomes')
        .withIndex('by_institution', (q) => q.eq('institution_id', universityId)),
    );

    // Build reverse lookup: external_student_id → user_id via studentProfiles
    // This allows matching outcomes imported with only external_student_id
    const studentProfiles = await collectAll(() =>
      ctx.db
        .query('studentProfiles')
        .withIndex('by_university', (q) => q.eq('university_id', universityId)),
    );

    const externalIdToUserId = new Map<string, string>();
    for (const profile of studentProfiles) {
      if (profile.student_id) {
        externalIdToUserId.set(profile.student_id, profile.user_id.toString());
      }
    }

    // Build outcome map by student (using student_id field if available, or external_student_id)
    const outcomeByStudent = new Map<string, (typeof outcomes)[0]>();
    for (const outcome of outcomes) {
      if (outcome.student_id) {
        // Direct match via platform user ID
        outcomeByStudent.set(outcome.student_id.toString(), outcome);
      } else if (outcome.external_student_id) {
        // Fallback: resolve external_student_id via studentProfiles
        const userId = externalIdToUserId.get(outcome.external_student_id);
        if (userId) {
          outcomeByStudent.set(userId, outcome);
        }
      }
    }

    // Define session brackets
    const brackets = [
      { label: '0 sessions', min: 0, max: 0 },
      { label: '1-2 sessions', min: 1, max: 2 },
      { label: '3-5 sessions', min: 3, max: 5 },
      { label: '6+ sessions', min: 6, max: Infinity },
    ];

    // Calculate employment rate by session bracket
    const correlationData = brackets.map((bracket) => {
      let totalInBracket = 0;
      let employedInBracket = 0;
      let knownOutcomeInBracket = 0;

      for (const student of allUsers) {
        const studentIdStr = student._id.toString();
        const sessionCount = sessionCountByStudent.get(studentIdStr) || 0;

        // Check if student falls in this bracket
        if (sessionCount >= bracket.min && sessionCount <= bracket.max) {
          totalInBracket++;

          // Check outcome for this student
          const outcome = outcomeByStudent.get(studentIdStr);
          if (outcome && outcome.outcome_status === 'known') {
            knownOutcomeInBracket++;
            // Check if employed (includes full-time, part-time employment)
            if (
              outcome.outcome_type === 'employed_fulltime' ||
              outcome.outcome_type === 'employed_parttime'
            ) {
              employedInBracket++;
            }
          }
        }
      }

      const employmentRate =
        knownOutcomeInBracket > 0
          ? Math.round((employedInBracket / knownOutcomeInBracket) * 100)
          : 0;

      return {
        bracket: bracket.label,
        totalStudents: totalInBracket,
        studentsWithOutcome: knownOutcomeInBracket,
        employedCount: employedInBracket,
        employmentRate,
      };
    });

    // Calculate overall stats
    const totalWithSessions = Array.from(sessionCountByStudent.values()).filter(
      (count) => count > 0,
    ).length;
    const totalWithoutSessions = allUsers.length - totalWithSessions;

    // Calculate the "headline" comparison
    const zeroSessionsData = correlationData.find((d) => d.bracket === '0 sessions');
    const threeOrMoreData = correlationData.find(
      (d) => d.bracket === '3-5 sessions' || d.bracket === '6+ sessions',
    );

    // Combine 3+ sessions for headline stat
    const threeOrMoreTotal = correlationData
      .filter((d) => d.bracket === '3-5 sessions' || d.bracket === '6+ sessions')
      .reduce(
        (acc, d) => ({
          employed: acc.employed + d.employedCount,
          total: acc.total + d.studentsWithOutcome,
        }),
        { employed: 0, total: 0 },
      );

    const threeOrMoreRate =
      threeOrMoreTotal.total > 0
        ? Math.round((threeOrMoreTotal.employed / threeOrMoreTotal.total) * 100)
        : 0;

    return {
      summary: {
        totalStudents: allUsers.length,
        studentsWithSessions: totalWithSessions,
        studentsWithoutSessions: totalWithoutSessions,
        totalSessions: allSessions.length,
        avgSessionsPerStudent:
          allUsers.length > 0 ? Math.round((allSessions.length / allUsers.length) * 10) / 10 : 0,
      },
      headline: {
        // "Students with 3+ sessions: 78% employed vs 52% for 0 sessions"
        withInterventions: {
          label: '3+ sessions',
          employmentRate: threeOrMoreRate,
        },
        withoutInterventions: {
          label: '0 sessions',
          employmentRate: zeroSessionsData?.employmentRate || 0,
        },
        difference: threeOrMoreRate - (zeroSessionsData?.employmentRate || 0),
      },
      correlationByBracket: correlationData,
      insight:
        threeOrMoreRate > (zeroSessionsData?.employmentRate || 0)
          ? `Students with 3+ advising sessions have ${threeOrMoreRate - (zeroSessionsData?.employmentRate || 0)}% higher employment rate`
          : 'Insufficient data to determine correlation',
    };
  },
});

/**
 * Get platform-wide feature usage analytics.
 * Shows how many users have used each feature across the entire platform.
 *
 * SCALABILITY NOTE: This query does full-table scans on 8+ tables.
 * At scale (50k+ records per table), consider:
 * - Pre-aggregating via scheduled job into a platform_metrics table
 * - Using rolling counters updated on record creation/deletion
 * Current approach is acceptable for admin-only analytics at early stage.
 */
export const getPlatformFeatureUsage = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    // Authorization: Require super admin
    await requireSuperAdminUser(ctx, args.clerkId);

    const cache = await getLatestAdminAnalyticsCache(ctx);
    if (!cache) {
      throw new Error('Admin analytics cache not available');
    }

    return {
      totalUsers: cache.total_users_all_time,
      features: cache.platform_feature_usage,
    };
  },
});

/**
 * Get latest cache timestamps for admin analytics + engagement metrics.
 * Super admin only.
 */
export const getAnalyticsCacheStatus = query({
  args: {
    serviceToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!isServiceRequest(args.serviceToken)) {
      await requireSuperAdminUser(ctx);
    }

    const adminCache = await getLatestAdminAnalyticsCache(ctx);
    const latestEngagement = await ctx.db
      .query('university_engagement_metrics')
      .withIndex('by_updated_at')
      .order('desc')
      .take(1);
    const engagementCache = latestEngagement[0] ?? null;

    return {
      adminAnalyticsCache: adminCache
        ? {
            snapshot_at: adminCache.snapshot_at,
            created_at: adminCache.created_at,
            updated_at: adminCache.updated_at,
          }
        : null,
      engagementMetricsCache: engagementCache
        ? {
            updated_at: engagementCache.updated_at,
            university_id: engagementCache.university_id,
          }
        : null,
    };
  },
});

/**
 * Trigger a manual recompute of the admin analytics cache.
 * Super admin only.
 */
export const triggerAdminAnalyticsRecompute = mutation({
  args: {
    serviceToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!isServiceRequest(args.serviceToken)) {
      await requireSuperAdminUser(ctx);
    }
    await ctx.scheduler.runAfter(0, internal.analytics.recomputeAdminAnalyticsCache, {});
    return { scheduled: true };
  },
});

/**
 * Internal: recompute admin analytics cache
 * Scheduled via cron to avoid expensive on-demand scans.
 */
export const recomputeAdminAnalyticsCache = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Build university map and counts
    const universityMap = new Map<string, { is_test?: boolean; status?: string }>();
    let totalUniversitiesAllTime = 0;
    let activeUniversitiesCurrent = 0;

    const universities = await ctx.db.query('universities').collect();
    for (const uni of universities) {
      universityMap.set(uni._id, { is_test: uni.is_test, status: uni.status });
      if (uni.is_test !== true) {
        if (uni.status === 'trial' || uni.status === 'active' || uni.status === 'archived') {
          totalUniversitiesAllTime++;
        }
        if (uni.status === 'trial' || uni.status === 'active') {
          activeUniversitiesCurrent++;
        }
      }
    }

    // Month boundaries for user growth (12 months)
    const monthBoundaries: Array<{ start: number; end: number; label: string }> = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).getTime();
      const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthBoundaries.push({ start: monthStart, end: monthEnd, label });
    }
    const userGrowthCounts = monthBoundaries.map(() => 0);

    // Day boundaries for activity data (last 7 days)
    const dayBoundaries: Array<{ start: number; end: number; label: string }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;
      dayBoundaries.push({
        start: dayStart,
        end: dayEnd,
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
      });
    }
    const dailyRegistrations = dayBoundaries.map(() => 0);
    const dailyApplications = dayBoundaries.map(() => 0);

    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    let totalUsersAllTime = 0;
    let activeUsers30d = 0;
    let thisMonthUsers = 0;
    let prevMonthUsers = 0;
    const planSegmentation: Record<string, number> = {};
    const eligibleUserIds = new Set<string>();

    const users = await ctx.db.query('users').collect();
    for (const user of users) {
      // Exclude test/super_admin users from all investor-facing metrics
      if (user.is_test_user === true || user.role === 'super_admin') {
        continue;
      }

      // Subscription distribution
      const plan = user.subscription_plan || 'free';
      planSegmentation[plan] = (planSegmentation[plan] || 0) + 1;

      // User growth
      for (let i = 0; i < monthBoundaries.length; i++) {
        const boundary = monthBoundaries[i];
        if (user.created_at >= boundary.start && user.created_at <= boundary.end) {
          userGrowthCounts[i]++;
          break;
        }
      }

      // Registrations last 7 days
      for (let i = 0; i < dayBoundaries.length; i++) {
        const day = dayBoundaries[i];
        if (user.created_at >= day.start && user.created_at <= day.end) {
          dailyRegistrations[i]++;
          break;
        }
      }

      totalUsersAllTime++;
      eligibleUserIds.add(user._id);

      const userDate = new Date(user.created_at);
      if (userDate.getMonth() === currentMonth && userDate.getFullYear() === currentYear) {
        thisMonthUsers++;
      }
      if (userDate.getMonth() === lastMonth && userDate.getFullYear() === lastMonthYear) {
        prevMonthUsers++;
      }

      if (user.last_login_at && user.last_login_at >= thirtyDaysAgo) {
        if (user.university_id) {
          const uni = universityMap.get(user.university_id);
          if (!uni || uni.is_test === true) {
            continue;
          }
          if (uni.status !== 'trial' && uni.status !== 'active') {
            continue;
          }
        }
        activeUsers30d++;
      }
    }

    // Applications last 7 days for activity data
    const applications = await ctx.db.query('applications').collect();
    for (const app of applications) {
      for (let i = 0; i < dayBoundaries.length; i++) {
        const day = dayBoundaries[i];
        if (app.created_at >= day.start && app.created_at <= day.end) {
          dailyApplications[i]++;
          break;
        }
      }
    }

    // Support ticket metrics
    let openTickets = 0;
    let resolvedToday = 0;
    let resolvedTickets = 0;
    let inProgressTickets = 0;
    let totalTickets = 0;
    let totalResolutionMs = 0;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTimestamp = todayStart.getTime();

    const tickets = await ctx.db.query('support_tickets').collect();
    for (const ticket of tickets) {
      totalTickets++;
      if (ticket.status === 'open' || ticket.status === 'in_progress') {
        openTickets++;
      }
      if (ticket.status === 'in_progress') {
        inProgressTickets++;
      }
      if (ticket.status === 'resolved' && ticket.resolved_at) {
        resolvedTickets++;
        totalResolutionMs += ticket.resolved_at - ticket.created_at;
        if (ticket.resolved_at >= todayTimestamp) {
          resolvedToday++;
        }
      }
    }

    const avgResponseTimeMs = resolvedTickets > 0 ? totalResolutionMs / resolvedTickets : 0;
    const avgResponseTimeHours = (avgResponseTimeMs / (1000 * 60 * 60)).toFixed(1);

    const monthlyGrowth =
      prevMonthUsers === 0
        ? 0
        : Math.round(((thisMonthUsers - prevMonthUsers) / prevMonthUsers) * 100);

    const activityData = dayBoundaries.map((day, i) => ({
      day: day.label,
      logins: Math.max(dailyApplications[i] * 3, dailyRegistrations[i] * 5),
      registrations: dailyRegistrations[i],
    }));

    const userGrowth = monthBoundaries.map((m, i) => ({
      month: m.label,
      users: userGrowthCounts[i],
    }));

    const subscriptionDistribution = [
      { name: 'University', value: planSegmentation.university || 0, color: '#4F46E5' },
      { name: 'Premium', value: planSegmentation.premium || 0, color: '#10B981' },
      { name: 'Free', value: planSegmentation.free || 0, color: '#F59E0B' },
    ];

    const [
      applicationsCount,
      resumesCount,
      goalsCount,
      coverLettersCount,
      aiCoachCount,
      interviewPracticeCount,
      careerPathsCount,
      networkingContactsCount,
    ] = await Promise.all([
      countFeatureUsage(ctx, 'applications', eligibleUserIds),
      countFeatureUsage(ctx, 'resumes', eligibleUserIds),
      countFeatureUsage(ctx, 'goals', eligibleUserIds),
      countFeatureUsage(ctx, 'cover_letters', eligibleUserIds),
      countFeatureUsage(ctx, 'ai_coach_conversations', eligibleUserIds),
      countFeatureUsage(ctx, 'interview_practice_sessions', eligibleUserIds),
      countFeatureUsage(ctx, 'career_paths', eligibleUserIds),
      countFeatureUsage(ctx, 'networking_contacts', eligibleUserIds),
    ]);

    const platformFeatureUsage = [
      {
        name: 'Applications',
        users: applicationsCount.users,
        total: applicationsCount.total,
        percentage:
          totalUsersAllTime > 0
            ? Math.round((applicationsCount.users / totalUsersAllTime) * 100)
            : 0,
      },
      {
        name: 'Resumes',
        users: resumesCount.users,
        total: resumesCount.total,
        percentage:
          totalUsersAllTime > 0 ? Math.round((resumesCount.users / totalUsersAllTime) * 100) : 0,
      },
      {
        name: 'Goals',
        users: goalsCount.users,
        total: goalsCount.total,
        percentage:
          totalUsersAllTime > 0 ? Math.round((goalsCount.users / totalUsersAllTime) * 100) : 0,
      },
      {
        name: 'Cover Letters',
        users: coverLettersCount.users,
        total: coverLettersCount.total,
        percentage:
          totalUsersAllTime > 0
            ? Math.round((coverLettersCount.users / totalUsersAllTime) * 100)
            : 0,
      },
      {
        name: 'AI Coach',
        users: aiCoachCount.users,
        total: aiCoachCount.total,
        percentage:
          totalUsersAllTime > 0 ? Math.round((aiCoachCount.users / totalUsersAllTime) * 100) : 0,
      },
      {
        name: 'Interview Practice',
        users: interviewPracticeCount.users,
        total: interviewPracticeCount.total,
        percentage:
          totalUsersAllTime > 0
            ? Math.round((interviewPracticeCount.users / totalUsersAllTime) * 100)
            : 0,
      },
      {
        name: 'Career Paths',
        users: careerPathsCount.users,
        total: careerPathsCount.total,
        percentage:
          totalUsersAllTime > 0
            ? Math.round((careerPathsCount.users / totalUsersAllTime) * 100)
            : 0,
      },
      {
        name: 'Networking',
        users: networkingContactsCount.users,
        total: networkingContactsCount.total,
        percentage:
          totalUsersAllTime > 0
            ? Math.round((networkingContactsCount.users / totalUsersAllTime) * 100)
            : 0,
      },
    ].sort((a, b) => b.percentage - a.percentage);

    await ctx.db.insert('admin_analytics_cache', {
      snapshot_at: now,
      total_users_all_time: totalUsersAllTime,
      total_universities_all_time: totalUniversitiesAllTime,
      active_users_30d: activeUsers30d,
      active_universities_current: activeUniversitiesCurrent,
      monthly_growth: monthlyGrowth,
      open_support_tickets: openTickets,
      system_health: 98.5,
      system_uptime: 99.9,
      user_growth: userGrowth,
      activity_data: activityData,
      support_metrics: {
        open_tickets: openTickets,
        resolved_today: resolvedToday,
        avg_response_time_hours: avgResponseTimeHours,
        total_tickets: totalTickets,
        resolved_tickets: resolvedTickets,
        in_progress_tickets: inProgressTickets,
      },
      subscription_distribution: subscriptionDistribution,
      platform_feature_usage: platformFeatureUsage,
      created_at: now,
      updated_at: now,
    });

    return {
      snapshot_at: now,
      totalUsersAllTime,
      totalUniversitiesAllTime,
      activeUsers30d,
      activeUniversitiesCurrent,
      monthlyGrowth,
      openTickets,
    };
  },
});
