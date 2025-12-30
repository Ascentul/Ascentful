/**
 * Advisor Sessions - Queries & Supplementary Mutations
 *
 * This file contains:
 * - Queries for fetching session data (getSessionById, getSessions, getTodaySessions)
 * - Supplementary mutations for session tasks (addSessionTask, updateSessionTask, etc.)
 *
 * For CRUD operations (create/update/delete sessions), see:
 * → convex/advisor_sessions_mutations.ts
 *
 * Note: advisor_sessions_mutations.ts is the canonical source for session CRUD,
 * used by the frontend (SessionEditor.tsx). This file focuses on queries and
 * task management within sessions.
 */

import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import {
  assertCanAccessStudent,
  createAuditLog,
  getCurrentUser,
  requireAdvisorRole,
  requireTenant,
} from './advisor_auth';
import { getAuthenticatedUser } from './lib/roles';

/**
 * Get a single session by ID
 */
export const getSessionById = query({
  args: {
    sessionId: v.id('advisor_sessions'),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const sessionCtx = await getCurrentUser(ctx, user.clerkId);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Verify tenant isolation
    if (session.university_id !== universityId) {
      throw new Error('Unauthorized: Session not in your university');
    }

    // Allow access if advisor created this session OR is primary owner of the student
    const isSessionCreator = session.advisor_id === sessionCtx.userId;
    if (!isSessionCreator) {
      // Fall back to student ownership check
      await assertCanAccessStudent(ctx, sessionCtx, session.student_id);
    }

    // Enrich with student data
    const student = await ctx.db.get(session.student_id);

    return {
      ...session,
      student_name: student?.name || 'Unknown',
      student_email: student?.email || '',
    };
  },
});

/**
 * Get all sessions for advisor (optionally filtered by student and date range)
 *
 * Performance notes:
 * - Uses by_advisor_scheduled index for efficient startDate filtering
 * - LIMITATION: endDate is applied as in-memory filter after database query
 *   - Convex indexes only support range queries on the last field in the index
 *   - Index supports: advisor_id (exact) + scheduled_at (>=)
 *   - Cannot add scheduled_at (<=) to same index query
 *   - If querying large date ranges (e.g., all future sessions), many records
 *     will be fetched and then filtered in memory
 *
 * Optimization recommendations:
 * 1. Keep date ranges narrow (e.g., 1 month) to minimize in-memory filtering
 * 2. For calendar views, query only visible time period (week/month)
 * 3. Consider pagination for large result sets
 * 4. Alternative: Add status-based filtering if typical queries are
 *    "scheduled sessions" or "completed sessions" to reduce dataset size
 */
export const getSessions = query({
  args: {
    studentId: v.optional(v.id('users')),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const sessionCtx = await getCurrentUser(ctx, user.clerkId);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    let sessions;

    if (args.studentId) {
      // Verify access to specific student
      await assertCanAccessStudent(ctx, sessionCtx, args.studentId);

      // Use student-specific index for optimal performance
      const studentId = args.studentId; // Capture for type narrowing
      sessions = await ctx.db
        .query('advisor_sessions')
        .withIndex('by_advisor_student', (q) =>
          q
            .eq('advisor_id', sessionCtx.userId)
            .eq('student_id', studentId)
            .eq('university_id', universityId),
        )
        .collect();
    } else if (args.startDate) {
      // Use scheduled index for efficient >= filtering on startDate
      // NOTE: This fetches ALL sessions >= startDate, then filters by endDate in memory
      sessions = await ctx.db
        .query('advisor_sessions')
        .withIndex('by_advisor_scheduled', (q) =>
          q.eq('advisor_id', sessionCtx.userId).gte('scheduled_at', args.startDate),
        )
        .filter((q) => q.eq(q.field('university_id'), universityId))
        .collect();
    } else {
      // Default: fetch all advisor sessions
      sessions = await ctx.db
        .query('advisor_sessions')
        .withIndex('by_advisor', (q) =>
          q.eq('advisor_id', sessionCtx.userId).eq('university_id', universityId),
        )
        .collect();
    }

    // PERFORMANCE WARNING: In-memory filtering for endDate
    // If many sessions exist between startDate and far future, this could be slow
    // Recommendation: Keep date ranges narrow in client code
    if (args.endDate !== undefined) {
      const endDate = args.endDate; // Capture for type narrowing
      sessions = sessions.filter((s) => {
        // Note: scheduled_at should always be set after migration
        // Fallback to start_at for backward compatibility with old data
        const sessionDate = s.scheduled_at ?? s.start_at;
        return sessionDate <= endDate;
      });
    }

    return sessions;
  },
});

/**
 * Get sessions happening today for advisor
 *
 * @param clientTimezoneOffset - Client's timezone offset in minutes from UTC
 *   (e.g., 300 for EST/UTC-5, -540 for JST/UTC+9). Matches Date.getTimezoneOffset().
 *   If not provided, uses server time (UTC) for boundaries.
 */
export const getTodaySessions = query({
  args: {
    clientTimezoneOffset: v.optional(v.number()), // Minutes offset from UTC
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const sessionCtx = await getCurrentUser(ctx, user.clerkId);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    // Calculate today's boundaries in client's timezone
    // If no offset provided, fall back to server time (legacy behavior)
    const now = Date.now();
    const offsetMs = (args.clientTimezoneOffset ?? 0) * 60 * 1000;
    // Adjust current time to client's local time for day boundary calculation
    // clientTimezoneOffset matches Date.getTimezoneOffset(): positive west of UTC (e.g., 300 for EST/UTC-5)
    // To get local time: UTC - offset
    const clientLocalTime = new Date(now - offsetMs);
    const startOfDayLocal = new Date(
      clientLocalTime.getFullYear(),
      clientLocalTime.getMonth(),
      clientLocalTime.getDate(),
    ).getTime();
    // Convert back to UTC for database comparison
    const startOfDay = startOfDayLocal + offsetMs;
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

    // Use collect() to return all sessions for the day (typically < 20 for most advisors)
    const sessions = await ctx.db
      .query('advisor_sessions')
      .withIndex('by_advisor_scheduled', (q) =>
        q.eq('advisor_id', sessionCtx.userId).gte('scheduled_at', startOfDay),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field('university_id'), universityId),
          q.lt(q.field('scheduled_at'), endOfDay),
        ),
      )
      .collect();

    return sessions;
  },
});

// ============================================================================
// CRUD Mutations - See advisor_sessions_mutations.ts
// ============================================================================
//
// Session CRUD operations are in advisor_sessions_mutations.ts:
// - createSession → api.advisor_sessions_mutations.createSession
// - updateSession → api.advisor_sessions_mutations.updateSession
// - deleteSession → api.advisor_sessions_mutations.deleteSession
// - cancelSession → api.advisor_sessions_mutations.cancelSession
//
// That file is the canonical source used by the frontend (SessionEditor.tsx).
// This file contains queries and supplementary task mutations.
// ============================================================================

/**
 * Add task to session
 */
export const addSessionTask = mutation({
  args: {
    sessionId: v.id('advisor_sessions'),
    task: v.object({
      id: v.string(),
      title: v.string(),
      due_at: v.optional(v.number()),
      owner: v.union(v.literal('student'), v.literal('advisor')),
      status: v.union(v.literal('open'), v.literal('done')),
    }),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const sessionCtx = await getCurrentUser(ctx, user.clerkId);
    requireAdvisorRole(sessionCtx);

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Verify tenant isolation
    const universityId = requireTenant(sessionCtx);
    if (session.university_id !== universityId) {
      throw new Error('Unauthorized: Session not in your university');
    }

    await assertCanAccessStudent(ctx, sessionCtx, session.student_id);

    // Note: Unlike completeSession, this intentionally allows any advisor with
    // student access to add tasks, enabling collaborative advising workflows.
    // If strict ownership is needed, add: if (session.advisor_id !== sessionCtx.userId)

    const currentTasks = session.tasks || [];

    // Ensure task ID is unique within session
    if (currentTasks.some((t) => t.id === args.task.id)) {
      throw new Error('Task ID already exists in this session');
    }

    const updatedTasks = [...currentTasks, args.task];

    await ctx.db.patch(args.sessionId, {
      tasks: updatedTasks,
      version: (session.version ?? 0) + 1,
      updated_at: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Complete session (mark as done, finalize notes)
 */
export const completeSession = mutation({
  args: {
    sessionId: v.id('advisor_sessions'),
    finalNotes: v.optional(v.string()),
    outcomes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const sessionCtx = await getCurrentUser(ctx, user.clerkId);
    requireAdvisorRole(sessionCtx);

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Verify tenant isolation
    const universityId = requireTenant(sessionCtx);
    if (session.university_id !== universityId) {
      throw new Error('Unauthorized: Session not in your university');
    }

    // Strict ownership check: Only the original advisor can complete their own session.
    // This differs from updateSession/addSessionTask which allow collaborative editing.
    if (session.advisor_id !== sessionCtx.userId) {
      throw new Error('Unauthorized: Only the session creator can complete it');
    }

    const now = Date.now();

    await ctx.db.patch(args.sessionId, {
      status: 'completed',
      end_at: now,
      notes: args.finalNotes !== undefined ? args.finalNotes : session.notes,
      outcomes: args.outcomes !== undefined ? args.outcomes : session.outcomes,
      version: (session.version ?? 0) + 1,
      updated_at: now,
    });

    // Audit log
    await createAuditLog(ctx, {
      actorId: sessionCtx.userId,
      universityId: session.university_id,
      action: 'session.completed',
      entityType: 'advisor_session',
      entityId: args.sessionId,
      studentId: session.student_id,
      newValue: { completed_at: now },
    });

    return { success: true };
  },
});
