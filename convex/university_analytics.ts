/**
 * University Analytics Module
 *
 * Provides analytics queries for university dashboards:
 * - Usage metrics (logins, active users, feature usage)
 * - Activity trends (weekly engagement data)
 * - Asset completion statistics
 * - Department activity breakdowns
 */

import { v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { query } from './_generated/server';

// ============================================================================
// AUTHENTICATION HELPERS
// ============================================================================

async function getCurrentUser(ctx: any, clerkId: string) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error('Unauthorized');
  }
  if (clerkId && clerkId !== identity.subject) {
    throw new Error('Unauthorized: Clerk identity mismatch');
  }
  const user = await ctx.db
    .query('users')
    .withIndex('by_clerk_id', (q: any) => q.eq('clerkId', identity.subject))
    .unique();
  if (!user) throw new Error('User not found');
  return user;
}

function requireUniversityAccess(user: any) {
  const isAdmin = ['super_admin', 'university_admin', 'advisor'].includes(user.role);
  if (!isAdmin) {
    throw new Error('Unauthorized');
  }
  if (user.role !== 'super_admin' && !user.university_id) {
    throw new Error('Unauthorized: University membership required');
  }
  return user.university_id;
}

// ============================================================================
// USAGE METRICS
// ============================================================================

/**
 * Get usage metrics for a university.
 * Returns: totalLogins, activeUsers7d, activeUsers30d, featureUsage
 */
export const getUsageMetrics = query({
  args: {
    clerkId: v.string(),
    timeFilter: v.optional(v.string()), // 'last_month' | 'last_3_months' | 'last_6_months'
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx, args.clerkId);
    const universityId = requireUniversityAccess(user);

    if (!universityId) {
      return {
        totalLogins: 0,
        activeUsers7d: 0,
        activeUsers30d: 0,
        featureUsageCount: 0,
        loginTrend: 0,
        activeUsersTrend: 0,
      };
    }

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;

    // Determine time range based on filter
    let timeRangeStart = thirtyDaysAgo; // Default: last month
    if (args.timeFilter === 'last_3_months') {
      timeRangeStart = now - 90 * 24 * 60 * 60 * 1000;
    } else if (args.timeFilter === 'last_6_months') {
      timeRangeStart = now - 180 * 24 * 60 * 60 * 1000;
    }

    // Get university students
    const students = await ctx.db
      .query('users')
      .withIndex('by_university', (q: any) => q.eq('university_id', universityId))
      .filter((q: any) => q.or(q.eq(q.field('role'), 'student'), q.eq(q.field('role'), 'user')))
      .take(2000);

    const studentIds = new Set(students.map((s) => s._id));

    // Get login events from activity_events
    const loginEvents = await ctx.db
      .query('activity_events')
      .withIndex('by_university_occurred_at', (q: any) =>
        q.eq('university_id', universityId).gte('occurred_at', timeRangeStart),
      )
      .filter((q: any) => q.eq(q.field('event_type'), 'login'))
      .take(5000);

    // Filter to only student logins
    const studentLoginEvents = loginEvents.filter((e) => studentIds.has(e.user_id));
    const totalLogins = studentLoginEvents.length;

    // Get previous period logins for trend calculation
    const previousPeriodStart = timeRangeStart - (now - timeRangeStart);
    const previousLoginEvents = await ctx.db
      .query('activity_events')
      .withIndex('by_university_occurred_at', (q: any) =>
        q
          .eq('university_id', universityId)
          .gte('occurred_at', previousPeriodStart)
          .lt('occurred_at', timeRangeStart),
      )
      .filter((q: any) => q.eq(q.field('event_type'), 'login'))
      .take(5000);

    const previousLogins = previousLoginEvents.filter((e) => studentIds.has(e.user_id)).length;
    const loginTrend =
      previousLogins > 0 ? Math.round(((totalLogins - previousLogins) / previousLogins) * 100) : 0;

    // Calculate active users in last 7 and 30 days
    const activeUsers7d = students.filter(
      (s) => s.last_login_at && s.last_login_at >= sevenDaysAgo,
    ).length;
    const activeUsers30d = students.filter(
      (s) => s.last_login_at && s.last_login_at >= thirtyDaysAgo,
    ).length;

    // Previous 30-day active users for trend
    const previousActiveUsers30d = students.filter(
      (s) => s.last_login_at && s.last_login_at >= sixtyDaysAgo && s.last_login_at < thirtyDaysAgo,
    ).length;
    const activeUsersTrend =
      previousActiveUsers30d > 0
        ? Math.round(((activeUsers30d - previousActiveUsers30d) / previousActiveUsers30d) * 100)
        : 0;

    // Get all activity events for feature usage count
    const allEvents = await ctx.db
      .query('activity_events')
      .withIndex('by_university_occurred_at', (q: any) =>
        q.eq('university_id', universityId).gte('occurred_at', timeRangeStart),
      )
      .take(10000);

    const featureUsageCount = allEvents.filter((e) => studentIds.has(e.user_id)).length;

    return {
      totalLogins,
      activeUsers7d,
      activeUsers30d,
      featureUsageCount,
      loginTrend,
      activeUsersTrend,
    };
  },
});

// ============================================================================
// ACTIVITY TRENDS
// ============================================================================

/**
 * Get weekly activity trends for charts.
 * Returns engagement data for the last 4 weeks.
 */
export const getActivityTrends = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx, args.clerkId);
    const universityId = requireUniversityAccess(user);

    if (!universityId) {
      return { weeklyTrends: [], categoryBreakdown: [] };
    }

    const now = Date.now();
    const fourWeeksAgo = now - 28 * 24 * 60 * 60 * 1000;

    // Get university students
    const students = await ctx.db
      .query('users')
      .withIndex('by_university', (q: any) => q.eq('university_id', universityId))
      .filter((q: any) => q.or(q.eq(q.field('role'), 'student'), q.eq(q.field('role'), 'user')))
      .take(2000);

    const studentIds = new Set(students.map((s) => s._id));

    // Get all events in last 4 weeks
    const events = await ctx.db
      .query('activity_events')
      .withIndex('by_university_occurred_at', (q: any) =>
        q.eq('university_id', universityId).gte('occurred_at', fourWeeksAgo),
      )
      .take(10000);

    // Filter to student events only
    const studentEvents = events.filter((e) => studentIds.has(e.user_id));

    // Group by week
    const weeklyTrends: { week: string; events: number; uniqueUsers: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = now - (i + 1) * 7 * 24 * 60 * 60 * 1000;
      const weekEnd = now - i * 7 * 24 * 60 * 60 * 1000;

      const weekEvents = studentEvents.filter(
        (e) => e.occurred_at >= weekStart && e.occurred_at < weekEnd,
      );

      const uniqueUserIds = new Set(weekEvents.map((e) => e.user_id));

      const weekLabel = new Date(weekStart).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });

      weeklyTrends.push({
        week: weekLabel,
        events: weekEvents.length,
        uniqueUsers: uniqueUserIds.size,
      });
    }

    // Category breakdown
    const categoryBreakdown = [
      {
        category: 'Applications',
        count: studentEvents.filter((e) => e.event_category === 'application').length,
      },
      {
        category: 'Documents',
        count: studentEvents.filter((e) => e.event_category === 'document').length,
      },
      {
        category: 'Goals',
        count: studentEvents.filter((e) => e.event_category === 'goal').length,
      },
      {
        category: 'AI Coach',
        count: studentEvents.filter((e) => e.event_category === 'ai_coach').length,
      },
      {
        category: 'Career Explorer',
        count: studentEvents.filter((e) => e.event_category === 'career_explorer').length,
      },
    ].sort((a, b) => b.count - a.count);

    return {
      weeklyTrends,
      categoryBreakdown,
    };
  },
});

// ============================================================================
// ASSET COMPLETION STATS
// ============================================================================

/**
 * Get asset completion statistics.
 * Returns average counts and completion rates for resumes, cover letters, goals, applications.
 */
export const getAssetCompletionStats = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx, args.clerkId);
    const universityId = requireUniversityAccess(user);

    if (!universityId) {
      return {
        avgResumes: 0,
        avgCoverLetters: 0,
        avgGoals: 0,
        avgApplications: 0,
        studentsWithResume: 0,
        studentsWithCoverLetter: 0,
        studentsWithGoals: 0,
        studentsWithApplications: 0,
        totalStudents: 0,
      };
    }

    // Get university students
    const students = await ctx.db
      .query('users')
      .withIndex('by_university', (q: any) => q.eq('university_id', universityId))
      .filter((q: any) => q.or(q.eq(q.field('role'), 'student'), q.eq(q.field('role'), 'user')))
      .take(2000);

    const studentIds = students.map((s) => s._id);
    const totalStudents = students.length;

    if (totalStudents === 0) {
      return {
        avgResumes: 0,
        avgCoverLetters: 0,
        avgGoals: 0,
        avgApplications: 0,
        studentsWithResume: 0,
        studentsWithCoverLetter: 0,
        studentsWithGoals: 0,
        studentsWithApplications: 0,
        totalStudents: 0,
      };
    }

    // Get assets for all students
    const [resumes, coverLetters, goals, applications] = await Promise.all([
      ctx.db
        .query('resumes')
        .withIndex('by_university_created_at', (q: any) => q.eq('university_id', universityId))
        .take(5000),
      ctx.db
        .query('cover_letters')
        .withIndex('by_university_created_at', (q: any) => q.eq('university_id', universityId))
        .take(5000),
      ctx.db
        .query('goals')
        .withIndex('by_university_created_at', (q: any) => q.eq('university_id', universityId))
        .take(5000),
      ctx.db
        .query('applications')
        .withIndex('by_university_created_at', (q: any) => q.eq('university_id', universityId))
        .take(10000),
    ]);

    // Filter to only include student assets
    const studentIdSet = new Set(studentIds);
    const studentResumes = resumes.filter((r) => studentIdSet.has(r.user_id));
    const studentCoverLetters = coverLetters.filter((c) => studentIdSet.has(c.user_id));
    const studentGoals = goals.filter((g) => studentIdSet.has(g.user_id));
    const studentApplications = applications.filter((a) => studentIdSet.has(a.user_id));

    // Calculate per-student counts
    const resumeCountByStudent = new Map<Id<'users'>, number>();
    const coverLetterCountByStudent = new Map<Id<'users'>, number>();
    const goalCountByStudent = new Map<Id<'users'>, number>();
    const applicationCountByStudent = new Map<Id<'users'>, number>();

    studentResumes.forEach((r) => {
      resumeCountByStudent.set(r.user_id, (resumeCountByStudent.get(r.user_id) || 0) + 1);
    });
    studentCoverLetters.forEach((c) => {
      coverLetterCountByStudent.set(c.user_id, (coverLetterCountByStudent.get(c.user_id) || 0) + 1);
    });
    studentGoals.forEach((g) => {
      goalCountByStudent.set(g.user_id, (goalCountByStudent.get(g.user_id) || 0) + 1);
    });
    studentApplications.forEach((a) => {
      applicationCountByStudent.set(a.user_id, (applicationCountByStudent.get(a.user_id) || 0) + 1);
    });

    return {
      avgResumes: +(studentResumes.length / totalStudents).toFixed(1),
      avgCoverLetters: +(studentCoverLetters.length / totalStudents).toFixed(1),
      avgGoals: +(studentGoals.length / totalStudents).toFixed(1),
      avgApplications: +(studentApplications.length / totalStudents).toFixed(1),
      studentsWithResume: resumeCountByStudent.size,
      studentsWithCoverLetter: coverLetterCountByStudent.size,
      studentsWithGoals: goalCountByStudent.size,
      studentsWithApplications: applicationCountByStudent.size,
      totalStudents,
    };
  },
});

// ============================================================================
// DEPARTMENT ACTIVITY
// ============================================================================

/**
 * Get activity metrics grouped by department.
 */
export const getDepartmentActivity = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx, args.clerkId);
    const universityId = requireUniversityAccess(user);

    if (!universityId) {
      return { departments: [] };
    }

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    // Get departments
    const departments = await ctx.db
      .query('departments')
      .withIndex('by_university', (q: any) => q.eq('university_id', universityId))
      .take(100);

    // Get university students
    const students = await ctx.db
      .query('users')
      .withIndex('by_university', (q: any) => q.eq('university_id', universityId))
      .filter((q: any) => q.or(q.eq(q.field('role'), 'student'), q.eq(q.field('role'), 'user')))
      .take(2000);

    // Get activity events
    const events = await ctx.db
      .query('activity_events')
      .withIndex('by_university_occurred_at', (q: any) =>
        q.eq('university_id', universityId).gte('occurred_at', thirtyDaysAgo),
      )
      .take(10000);

    // Build student to department map
    const studentDepartmentMap = new Map<Id<'users'>, Id<'departments'> | undefined>();
    students.forEach((s) => {
      studentDepartmentMap.set(s._id, s.department_id);
    });

    // Calculate metrics per department
    type DepartmentMetric = {
      departmentId: Id<'departments'> | null;
      departmentName: string;
      totalStudents: number;
      activeStudents: number;
      totalEvents: number;
      avgEventsPerStudent: number;
    };

    const departmentMetrics: DepartmentMetric[] = departments.map((dept) => {
      const deptStudents = students.filter((s) => s.department_id === dept._id);
      const deptStudentIds = new Set(deptStudents.map((s) => s._id));

      const deptEvents = events.filter((e) => deptStudentIds.has(e.user_id));
      const activeStudents = deptStudents.filter(
        (s) => s.last_login_at && s.last_login_at >= thirtyDaysAgo,
      ).length;

      return {
        departmentId: dept._id,
        departmentName: dept.name,
        totalStudents: deptStudents.length,
        activeStudents,
        totalEvents: deptEvents.length,
        avgEventsPerStudent:
          deptStudents.length > 0 ? +(deptEvents.length / deptStudents.length).toFixed(1) : 0,
      };
    });

    // Add "Unassigned" category for students without a department
    const unassignedStudents = students.filter((s) => !s.department_id);
    const unassignedStudentIds = new Set(unassignedStudents.map((s) => s._id));
    const unassignedEvents = events.filter((e) => unassignedStudentIds.has(e.user_id));
    const unassignedActive = unassignedStudents.filter(
      (s) => s.last_login_at && s.last_login_at >= thirtyDaysAgo,
    ).length;

    if (unassignedStudents.length > 0) {
      departmentMetrics.push({
        departmentId: null,
        departmentName: 'Unassigned',
        totalStudents: unassignedStudents.length,
        activeStudents: unassignedActive,
        totalEvents: unassignedEvents.length,
        avgEventsPerStudent: +(unassignedEvents.length / unassignedStudents.length).toFixed(1),
      });
    }

    // Sort by total students descending
    departmentMetrics.sort((a, b) => b.totalStudents - a.totalStudents);

    return {
      departments: departmentMetrics,
    };
  },
});
