/**
 * Advisor Calendar Queries
 *
 * Provides session data for calendar views:
 * - Day view (single day's sessions)
 * - Week view (7 days)
 * - Month view (28-31 days)
 */

import { v } from 'convex/values';

import { query } from './_generated/server';
import { getCurrentUser, optionalTenant, requireAdvisorRole } from './advisor_auth';

/**
 * Get sessions for a date range (used by all calendar views)
 */
export const getSessionsInRange = query({
  args: {
    clerkId: v.string(),
    startDate: v.number(), // Unix timestamp
    endDate: v.number(), // Unix timestamp
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);

    // Get university_id - for super_admin without a university, return empty results gracefully
    const universityId = optionalTenant(sessionCtx);
    if (!universityId) {
      return [];
    }

    // Get sessions in the date range
    // Simplified filter: session starts within the visible range
    // This captures all sessions that should appear on the calendar
    // Previous complex filter had edge cases with undefined end_at
    const sessions = await ctx.db
      .query('advisor_sessions')
      .withIndex('by_advisor', (q) =>
        q.eq('advisor_id', sessionCtx.userId).eq('university_id', universityId),
      )
      .filter((q) =>
        q.and(q.gte(q.field('start_at'), args.startDate), q.lte(q.field('start_at'), args.endDate)),
      )
      .collect();

    // Enrich with student data
    // Optimize by fetching each unique student only once (reduces N database reads to 1 per unique student)
    const uniqueStudentIds = Array.from(new Set(sessions.map((s) => s.student_id)));

    // Use allSettled to handle individual fetch failures gracefully (e.g., deleted students)
    const studentFetchResults = await Promise.allSettled(
      uniqueStudentIds.map(async (id) => {
        const student = await ctx.db.get(id);
        // Use String() for consistent Map key type (Id objects may not match as keys)
        return [String(id), student] as const;
      }),
    );

    const studentsMap = new Map<string, any>(
      studentFetchResults
        .filter((result) => result.status === 'fulfilled')
        .map((result) => (result as PromiseFulfilledResult<any>).value),
    );

    const enrichedSessions = sessions.map((session) => {
      // Use String() for consistent lookup (matches key insertion above)
      const student = studentsMap.get(String(session.student_id));
      return {
        _id: session._id,
        student_id: session.student_id,
        student_name: student?.name || 'Unknown',
        student_email: student?.email || '',
        title: session.title,
        session_type: session.session_type,
        start_at: session.start_at,
        end_at: session.end_at,
        duration_minutes: session.duration_minutes,
        notes: session.notes,
        visibility: session.visibility,
      };
    });

    return enrichedSessions.sort((a, b) => a.start_at - b.start_at);
  },
});

/**
 * Get follow-ups for a date range (for calendar overlay)
 */
export const getFollowUpsInRange = query({
  args: {
    clerkId: v.string(),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);

    // Get university_id - for super_admin without a university, return empty results gracefully
    const universityId = optionalTenant(sessionCtx);
    if (!universityId) {
      return [];
    }

    // Migrated to follow_ups table (unified table for all follow-up tasks)
    const followUps = await ctx.db
      .query('follow_ups')
      .withIndex('by_university', (q) => q.eq('university_id', universityId))
      .filter((q) =>
        q.and(
          q.eq(q.field('created_by_id'), sessionCtx.userId),
          q.eq(q.field('created_by_type'), 'advisor'),
          q.gte(q.field('due_at'), args.startDate),
          q.lte(q.field('due_at'), args.endDate),
          q.eq(q.field('status'), 'open'),
        ),
      )
      .collect();

    // Enrich with student names
    // Optimize by fetching each unique student only once (reduces N database reads to 1 per unique student)
    const uniqueStudentIds = Array.from(new Set(followUps.map((f) => f.user_id)));

    // Use allSettled to handle individual fetch failures gracefully (e.g., deleted students)
    const studentFetchResults = await Promise.allSettled(
      uniqueStudentIds.map(async (id) => {
        const student = await ctx.db.get(id);
        // Use String() for consistent Map key type (Id objects may not match as keys)
        return [String(id), student] as const;
      }),
    );

    const studentsMap = new Map<string, any>(
      studentFetchResults
        .filter((result) => result.status === 'fulfilled')
        .map((result) => (result as PromiseFulfilledResult<any>).value),
    );

    const enrichedFollowUps = followUps.map((followUp) => {
      // Use String() for consistent lookup (matches key insertion above)
      const student = studentsMap.get(String(followUp.user_id));
      return {
        _id: followUp._id,
        student_id: followUp.user_id, // Return as student_id for backward compatibility
        student_name: student?.name || 'Unknown',
        title: followUp.title,
        description: followUp.description,
        due_at: followUp.due_at,
        priority: followUp.priority,
        status: followUp.status,
      };
    });

    // Sort by due_at (filter should exclude null values, but defensive check)
    return enrichedFollowUps.sort((a, b) => (a.due_at ?? 0) - (b.due_at ?? 0));
  },
});

/**
 * Get calendar statistics for a date range
 */
export const getCalendarStats = query({
  args: {
    clerkId: v.string(),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);

    // Get university_id - for super_admin without a university, return empty stats gracefully
    const universityId = optionalTenant(sessionCtx);
    if (!universityId) {
      return {
        totalSessions: 0,
        completedSessions: 0,
        upcomingSessions: 0,
        inProgressSessions: 0,
        totalFollowUps: 0,
        overdueFollowUps: 0,
        totalHours: 0,
        uniqueStudents: 0,
      };
    }

    // Simplified filter: session starts within the visible range
    const sessions = await ctx.db
      .query('advisor_sessions')
      .withIndex('by_advisor', (q) =>
        q.eq('advisor_id', sessionCtx.userId).eq('university_id', universityId),
      )
      .filter((q) =>
        q.and(q.gte(q.field('start_at'), args.startDate), q.lte(q.field('start_at'), args.endDate)),
      )
      .collect();

    // Migrated to follow_ups table (unified table for all follow-up tasks)
    const followUps = await ctx.db
      .query('follow_ups')
      .withIndex('by_university', (q) => q.eq('university_id', universityId))
      .filter((q) =>
        q.and(
          q.eq(q.field('created_by_id'), sessionCtx.userId),
          q.eq(q.field('created_by_type'), 'advisor'),
          q.gte(q.field('due_at'), args.startDate),
          q.lte(q.field('due_at'), args.endDate),
          q.eq(q.field('status'), 'open'),
        ),
      )
      .collect();

    const now = Date.now();
    const completedSessions = sessions.filter((s) => s.status === 'completed').length;
    const upcomingSessions = sessions.filter((s) => s.start_at > now).length;
    const inProgressSessions = sessions.filter(
      (s) => s.status !== 'completed' && s.start_at <= now && (!s.end_at || s.end_at >= now),
    ).length;
    const overdueFollowUps = followUps.filter((f) => f.due_at && f.due_at < now).length;

    // Calculate total session hours
    const totalHours = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0) / 60, 0);

    // Get unique students
    const uniqueStudents = new Set(sessions.map((s) => s.student_id));

    return {
      totalSessions: sessions.length,
      completedSessions,
      upcomingSessions,
      inProgressSessions,
      totalFollowUps: followUps.length,
      overdueFollowUps,
      totalHours: Math.round(totalHours * 10) / 10,
      uniqueStudents: uniqueStudents.size,
    };
  },
});
