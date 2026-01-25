/**
 * Advisor Dashboard Queries
 *
 * Provides aggregated data for advisor dashboard:
 * - Caseload stats (total students, active applications, at-risk)
 * - Recent activity (sessions, reviews, follow-ups in last 7 days)
 * - Upcoming items (sessions and follow-ups in next 7 days)
 * - Review queue snapshot
 */

import { v } from 'convex/values';

import { query } from './_generated/server';
import {
  getCurrentUser,
  getOwnedStudentIds,
  optionalTenant,
  requireAdvisorRole,
} from './advisor_auth';
import { ACTIVE_STAGES } from './advisor_constants';

/**
 * Get dashboard overview stats
 * Returns: caseload size, active applications count, sessions this week, pending reviews
 */
export const getDashboardStats = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);

    // Get university_id - for super_admin without a university, return empty stats gracefully
    const universityId = optionalTenant(sessionCtx);
    if (!universityId) {
      return {
        totalStudents: 0,
        activeApplications: 0,
        sessionsThisWeek: 0,
        pendingReviews: 0,
        atRiskStudents: 0,
        averageApplicationsPerStudent: 0,
      };
    }

    // Get owned student IDs
    const studentIds = await getOwnedStudentIds(ctx, sessionCtx);
    const studentIdSet = new Set(studentIds);

    // Load all advisor-assigned applications once for aggregation
    const advisorApplications = await ctx.db
      .query('applications')
      .withIndex('by_advisor', (q) => q.eq('assigned_advisor_id', sessionCtx.userId))
      .collect();

    const activeStages = new Set(ACTIVE_STAGES);
    let activeApplicationsCount = 0;
    const perStudentAppStats = new Map<string, { total: number; hasOffer: boolean }>();

    for (const application of advisorApplications) {
      if (!studentIdSet.has(application.user_id)) continue;
      const key = application.user_id;
      const stats = perStudentAppStats.get(key) ?? { total: 0, hasOffer: false };
      stats.total += 1;
      if (application.stage && activeStages.has(application.stage)) {
        activeApplicationsCount += 1;
      }
      // Check for offers using stage with status fallback during migration
      // See docs/TECH_DEBT_APPLICATION_STATUS_STAGE.md
      if (
        application.stage === 'Offer' ||
        application.stage === 'Accepted' ||
        (!application.stage && application.status === 'offer')
      ) {
        stats.hasOffer = true;
      }
      perStudentAppStats.set(key, stats);
    }

    // Count sessions this week
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const sessionsThisWeek = await ctx.db
      .query('advisor_sessions')
      .withIndex('by_advisor', (q) =>
        q.eq('advisor_id', sessionCtx.userId).eq('university_id', universityId),
      )
      .filter((q) => q.gte(q.field('start_at'), oneWeekAgo))
      .collect();

    // Count pending reviews (status = "waiting") scoped to caseload students
    // OPTIMIZED: Single query using by_status index instead of N+1 pattern
    const allPendingReviews = await ctx.db
      .query('advisor_reviews')
      .withIndex('by_status', (q) => q.eq('status', 'waiting').eq('university_id', universityId))
      .collect();

    // Filter to only reviews for students in this advisor's caseload
    const pendingReviews = allPendingReviews.filter((review) =>
      studentIdSet.has(review.student_id),
    );

    // At-risk students (outcome-based): >5 applications but no offers yet
    // NOTE: This differs from engagement-based at-risk in advisor_students.ts (60+ days inactive)
    // Dashboard shows outcome risk, student list shows engagement risk
    const atRiskNoOfferCount = Array.from(perStudentAppStats.values()).reduce(
      (total, stats) => (stats.total > 5 && !stats.hasOffer ? total + 1 : total),
      0,
    );

    // Calculate total applications count across all stages
    const totalApplicationsCount = Array.from(perStudentAppStats.values()).reduce(
      (sum, stats) => sum + stats.total,
      0,
    );

    return {
      totalStudents: studentIds.length,
      activeApplications: activeApplicationsCount,
      sessionsThisWeek: sessionsThisWeek.length,
      pendingReviews: pendingReviews.length,
      atRiskStudents: atRiskNoOfferCount, // Outcome-based: >5 apps, no offers
      averageApplicationsPerStudent:
        studentIds.length > 0
          ? Math.round((totalApplicationsCount / studentIds.length) * 10) / 10
          : 0,
    };
  },
});

/**
 * Get upcoming sessions and follow-ups (next 7 days)
 */
export const getUpcomingItems = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);

    // Get university_id - for super_admin without a university, return empty results gracefully
    const universityId = optionalTenant(sessionCtx);
    if (!universityId) {
      return [];
    }

    // Get owned student IDs for filtering
    const studentIds = await getOwnedStudentIds(ctx, sessionCtx);
    const studentIdSet = new Set(studentIds);

    const now = Date.now();
    const oneWeekFromNow = now + 7 * 24 * 60 * 60 * 1000;

    // Get upcoming sessions
    const sessions = await ctx.db
      .query('advisor_sessions')
      .withIndex('by_advisor', (q) =>
        q.eq('advisor_id', sessionCtx.userId).eq('university_id', universityId),
      )
      .filter((q) =>
        q.and(q.gte(q.field('start_at'), now), q.lte(q.field('start_at'), oneWeekFromNow)),
      )
      .collect();

    // Get upcoming follow-ups (using unified follow_ups table)
    // Query by university and filter for advisor-created tasks
    const allFollowUps = await ctx.db
      .query('follow_ups')
      .withIndex('by_university', (q) => q.eq('university_id', universityId))
      .filter((q) =>
        q.and(
          // Only advisor-created follow-ups for this advisor
          q.eq(q.field('created_by_id'), sessionCtx.userId),
          q.eq(q.field('created_by_type'), 'advisor'),
          // Due within next week
          q.gte(q.field('due_at'), now),
          q.lte(q.field('due_at'), oneWeekFromNow),
          // Open status only
          q.eq(q.field('status'), 'open'),
        ),
      )
      .collect();

    // Filter to only students in this advisor's caseload
    const followUps = allFollowUps.filter((followUp) => studentIdSet.has(followUp.user_id));

    // Enrich with student names
    const enrichedSessions = await Promise.all(
      sessions.map(async (session) => {
        const student = await ctx.db.get(session.student_id);
        return {
          _id: session._id,
          type: 'session' as const,
          student_id: session.student_id,
          student_name: student?.name || 'Unknown',
          title: session.title || session.session_type || 'Advising Session',
          date: session.start_at,
        };
      }),
    );

    const enrichedFollowUps = await Promise.all(
      followUps.map(async (followUp) => {
        // Skip follow-ups without a due date; they shouldn't appear in "upcoming"
        if (!followUp.due_at) return null;
        const student = await ctx.db.get(followUp.user_id);
        return {
          _id: followUp._id,
          type: 'followup' as const,
          student_id: followUp.user_id,
          student_name: student?.name || 'Unknown',
          title: followUp.title,
          date: followUp.due_at,
          priority: followUp.priority,
          status: followUp.status,
        };
      }),
    );

    // Combine and sort by date
    const allItems = [
      ...enrichedSessions,
      ...enrichedFollowUps.filter((f): f is NonNullable<typeof f> => f !== null),
    ].sort((a, b) => a.date - b.date);

    return allItems;
  },
});

/**
 * Returns sessions count per week
 *
 * @param timezoneOffset - Client's timezone offset in minutes from UTC, matching JavaScript's getTimezoneOffset() (e.g., 480 for PST/UTC-8, 0 for UTC)
 * @param weekStartDay - Day of week to start (0 = Sunday, 1 = Monday). Defaults to 1 (Monday)
 */
export const getActivityChart = query({
  args: {
    clerkId: v.string(),
    timezoneOffset: v.optional(v.number()),
    weekStartDay: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);

    // Get university_id - for super_admin without a university, return empty results gracefully
    const universityId = optionalTenant(sessionCtx);
    if (!universityId) {
      return [];
    }

    const now = Date.now();
    const fourWeeksAgo = now - 28 * 24 * 60 * 60 * 1000;

    const sessions = await ctx.db
      .query('advisor_sessions')
      .withIndex('by_advisor', (q) =>
        q.eq('advisor_id', sessionCtx.userId).eq('university_id', universityId),
      )
      .filter((q) => q.gte(q.field('start_at'), fourWeeksAgo))
      .collect();

    // Default to Monday (1) as week start, or use provided value
    const weekStart = args.weekStartDay ?? 1;
    // Timezone offset in milliseconds (default to UTC)
    const tzOffsetMs = (args.timezoneOffset ?? 0) * 60 * 1000;

    // Group by week in client's timezone
    const weeks: Record<string, number> = {};
    for (const session of sessions) {
      // Convert UTC to client's local timezone
      // getTimezoneOffset() returns positive for west of UTC (e.g., 480 for PST/UTC-8)
      // So we subtract: UTC - 8 hours = PST local time
      const clientTime = new Date(session.start_at - tzOffsetMs);
      clientTime.setUTCHours(0, 0, 0, 0);

      // Calculate week start based on configured day
      const dayOfWeek = clientTime.getUTCDay();
      const daysToSubtract = (dayOfWeek - weekStart + 7) % 7;
      clientTime.setUTCDate(clientTime.getUTCDate() - daysToSubtract);

      const weekKey = clientTime.toISOString().split('T')[0];
      weeks[weekKey] = (weeks[weekKey] || 0) + 1;
    }

    // Convert to array sorted by date
    const chartData = Object.entries(weeks)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return chartData;
  },
});

/**
 * Get review queue snapshot (pending reviews)
 * Returns most recent pending reviews for dashboard preview
 *
 * @param limit - Number of reviews to return (defaults to 10 for dashboard snapshot)
 */
export const getReviewQueueSnapshot = query({
  args: {
    clerkId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);

    // Get university_id - for super_admin without a university, return empty results gracefully
    const universityId = optionalTenant(sessionCtx);
    if (!universityId) {
      return [];
    }

    // SECURITY: Filter by advisor's caseload to prevent data leaks
    const studentIds = await getOwnedStudentIds(ctx, sessionCtx);
    const studentIdSet = new Set(studentIds);

    const limit = args.limit ?? 10; // Default to 10 for dashboard preview

    // OPTIMIZED: Single query using by_status index instead of N+1 pattern
    const allPendingReviews = await ctx.db
      .query('advisor_reviews')
      .withIndex('by_status', (q) => q.eq('status', 'waiting').eq('university_id', universityId))
      .collect();

    // Filter to only reviews for students in this advisor's caseload
    const caseloadReviews = allPendingReviews
      .filter((review) => studentIdSet.has(review.student_id))
      // Sort by creation time (newest first) and limit
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, limit);

    // Enrich with student names
    const enrichedReviews = await Promise.all(
      caseloadReviews.map(async (review) => {
        const student = await ctx.db.get(review.student_id);
        // Determine the asset_id based on asset_type
        const asset_id =
          review.asset_type === 'resume'
            ? review.resume_id
            : review.asset_type === 'cover_letter'
              ? review.cover_letter_id
              : undefined;

        return {
          _id: review._id,
          student_id: review.student_id,
          student_name: student?.name || 'Unknown',
          asset_type: review.asset_type,
          asset_id,
          status: review.status,
          submitted_at: review.created_at,
        };
      }),
    );

    return enrichedReviews;
  },
});
