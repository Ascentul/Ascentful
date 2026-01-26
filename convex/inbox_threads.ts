/**
 * Inbox Threads - Queries
 *
 * Thread queries for the advisor inbox system.
 * Follows RBAC patterns from advisor_auth.ts.
 */

import { v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { query } from './_generated/server';
import { getCurrentUser, requireAdvisorRole, requireTenant } from './advisor_auth';

// Re-export types for consumers
export type ThreadStatus =
  | 'NEW'
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_ON_STUDENT'
  | 'WAITING_ON_STAFF'
  | 'RESOLVED'
  | 'ARCHIVED';

export type ThreadChannel = 'in_app' | 'email_gmail' | 'email_outlook' | 'email_other';

export type ThreadPriority = 'P1' | 'P2' | 'P3';

export type IdentityStatus = 'matched' | 'unmatched' | 'external';

/**
 * List threads for inbox view
 * Supports filtering by status, assignment, student, and search
 */
export const listThreads = query({
  args: {
    status: v.optional(
      v.union(
        v.literal('NEW'),
        v.literal('OPEN'),
        v.literal('IN_PROGRESS'),
        v.literal('WAITING_ON_STUDENT'),
        v.literal('WAITING_ON_STAFF'),
        v.literal('RESOLVED'),
        v.literal('ARCHIVED'),
        v.literal('ALL_ACTIVE'),
      ),
    ),
    assignedTo: v.optional(v.union(v.literal('me'), v.literal('unassigned'), v.id('users'))),
    studentId: v.optional(v.id('users')),
    identityStatus: v.optional(
      v.union(v.literal('matched'), v.literal('unmatched'), v.literal('external')),
    ),
    search: v.optional(v.string()),
    sortBy: v.optional(
      v.union(
        v.literal('newest'),
        v.literal('oldest'),
        v.literal('sla_due'),
        v.literal('priority'),
      ),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Auth check
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const limit = args.limit ?? 50;
    const sortBy = args.sortBy ?? 'newest';

    // Build query based on filters
    let threadsQuery;

    // Start with the most selective index
    if (args.status && args.status !== 'ALL_ACTIVE') {
      threadsQuery = ctx.db
        .query('inbox_threads')
        .withIndex('by_university_status', (q) =>
          q.eq('university_id', universityId).eq('status', args.status as ThreadStatus),
        );
    } else if (args.identityStatus) {
      threadsQuery = ctx.db
        .query('inbox_threads')
        .withIndex('by_identity_status', (q) =>
          q.eq('university_id', universityId).eq('identity_status', args.identityStatus!),
        );
    } else if (args.studentId) {
      threadsQuery = ctx.db
        .query('inbox_threads')
        .withIndex('by_student', (q) => q.eq('student_id', args.studentId));
    } else {
      threadsQuery = ctx.db
        .query('inbox_threads')
        .withIndex('by_university', (q) => q.eq('university_id', universityId));
    }

    let threads = await threadsQuery.collect();

    // Filter by university (if using non-university index)
    threads = threads.filter((t) => t.university_id === universityId);

    // Filter by status (ALL_ACTIVE = not RESOLVED or ARCHIVED)
    if (args.status === 'ALL_ACTIVE') {
      threads = threads.filter((t) => t.status !== 'RESOLVED' && t.status !== 'ARCHIVED');
    }

    // Filter by assignment
    if (args.assignedTo === 'me') {
      threads = threads.filter((t) => t.assigned_to === sessionCtx.userId);
    } else if (args.assignedTo === 'unassigned') {
      threads = threads.filter((t) => !t.assigned_to);
    } else if (args.assignedTo) {
      threads = threads.filter((t) => t.assigned_to === args.assignedTo);
    }

    // Filter by student
    if (args.studentId) {
      threads = threads.filter((t) => t.student_id === args.studentId);
    }

    // Filter by identity status
    if (args.identityStatus) {
      threads = threads.filter((t) => t.identity_status === args.identityStatus);
    }

    // Search filter (subject + snippet)
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      threads = threads.filter(
        (t) =>
          t.subject.toLowerCase().includes(searchLower) ||
          (t.snippet && t.snippet.toLowerCase().includes(searchLower)) ||
          (t.external_sender_email &&
            t.external_sender_email.toLowerCase().includes(searchLower)) ||
          (t.external_sender_name && t.external_sender_name.toLowerCase().includes(searchLower)),
      );
    }

    // RBAC: Advisors can only see threads for their assigned students (unless unmatched)
    if (sessionCtx.role === 'advisor') {
      // Get advisor's assigned students
      const advisorStudents = await ctx.db
        .query('student_advisors')
        .withIndex('by_advisor', (q) => q.eq('advisor_id', sessionCtx.userId))
        .filter((q) => q.eq(q.field('is_owner'), true))
        .collect();

      const ownedStudentIds = new Set(advisorStudents.map((as) => as.student_id));

      // Advisors can see:
      // 1. Threads for their owned students
      // 2. Unmatched threads (identity_status = 'unmatched')
      // 3. Threads assigned to them
      threads = threads.filter(
        (t) =>
          (t.student_id && ownedStudentIds.has(t.student_id)) ||
          t.identity_status === 'unmatched' ||
          t.assigned_to === sessionCtx.userId,
      );
    }

    // Sort
    if (sortBy === 'newest') {
      threads.sort((a, b) => b.last_message_at - a.last_message_at);
    } else if (sortBy === 'oldest') {
      threads.sort((a, b) => a.last_message_at - b.last_message_at);
    } else if (sortBy === 'sla_due') {
      threads.sort((a, b) => {
        // Threads without SLA go to the end
        if (!a.sla_due_at && !b.sla_due_at) return 0;
        if (!a.sla_due_at) return 1;
        if (!b.sla_due_at) return -1;
        return a.sla_due_at - b.sla_due_at;
      });
    } else if (sortBy === 'priority') {
      const priorityOrder = { P1: 0, P2: 1, P3: 2 };
      threads.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    }

    // Limit
    threads = threads.slice(0, limit);

    // Enrich with student and assignee info
    const enrichedThreads = await Promise.all(
      threads.map(async (thread) => {
        const student = thread.student_id ? await ctx.db.get(thread.student_id) : null;
        const assignee = thread.assigned_to ? await ctx.db.get(thread.assigned_to) : null;

        // Check if current user has unread messages
        const readState = await ctx.db
          .query('inbox_read_state')
          .withIndex('by_user_thread', (q) =>
            q.eq('user_id', sessionCtx.userId).eq('thread_id', thread._id),
          )
          .unique();

        const hasUnread = readState ? thread.last_message_at > readState.last_read_at : true; // No read state means unread

        return {
          ...thread,
          student: student
            ? {
                _id: student._id,
                name: student.name,
                email: student.email,
                imageUrl: student.profile_image,
              }
            : null,
          assignee: assignee
            ? {
                _id: assignee._id,
                name: assignee.name,
                email: assignee.email,
              }
            : null,
          hasUnread,
        };
      }),
    );

    return enrichedThreads;
  },
});

/**
 * Get thread detail with messages
 */
export const getThreadDetail = query({
  args: {
    threadId: v.id('inbox_threads'),
  },
  handler: async (ctx, args) => {
    // Auth check
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);

    // Get thread
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    // Tenant check (super_admin can access any)
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (thread.university_id !== universityId) {
        throw new Error('Unauthorized: Thread not in your university');
      }
    }

    // RBAC: Advisors can only see threads for their assigned students
    if (sessionCtx.role === 'advisor' && thread.student_id) {
      const ownership = await ctx.db
        .query('student_advisors')
        .withIndex('by_advisor', (q) => q.eq('advisor_id', sessionCtx.userId))
        .filter((q) =>
          q.and(q.eq(q.field('student_id'), thread.student_id), q.eq(q.field('is_owner'), true)),
        )
        .unique();

      // Allow if advisor owns student OR thread is assigned to them
      if (!ownership && thread.assigned_to !== sessionCtx.userId) {
        throw new Error('Unauthorized: You do not have access to this student');
      }
    }

    // Get messages
    const messages = await ctx.db
      .query('inbox_messages')
      .withIndex('by_thread', (q) => q.eq('thread_id', args.threadId))
      .order('asc')
      .collect();

    // Filter internal notes for non-advisors (shouldn't happen, but safety)
    const filteredMessages = messages.filter((m) => {
      if (m.is_internal) {
        // Only advisors/admins see internal notes
        return ['advisor', 'university_admin', 'super_admin'].includes(sessionCtx.role);
      }
      return true;
    });

    // Enrich messages with sender info
    const enrichedMessages = await Promise.all(
      filteredMessages.map(async (message) => {
        let senderUser = null;
        if (message.sender_user_id) {
          const user = await ctx.db.get(message.sender_user_id);
          if (user) {
            senderUser = {
              _id: user._id,
              name: user.name,
              email: user.email,
              imageUrl: user.profile_image,
            };
          }
        }

        return {
          ...message,
          senderUser,
        };
      }),
    );

    // Get action history
    const actions = await ctx.db
      .query('inbox_thread_actions')
      .withIndex('by_thread', (q) => q.eq('thread_id', args.threadId))
      .order('desc')
      .take(50);

    // Enrich actions with actor info
    const enrichedActions = await Promise.all(
      actions.map(async (action) => {
        const actor = await ctx.db.get(action.actor_id);
        return {
          ...action,
          actor: actor
            ? {
                _id: actor._id,
                name: actor.name,
                email: actor.email,
              }
            : null,
        };
      }),
    );

    // Get student info
    const student = thread.student_id ? await ctx.db.get(thread.student_id) : null;

    // Get assignee info
    const assignee = thread.assigned_to ? await ctx.db.get(thread.assigned_to) : null;

    // Get linked queue item
    const linkedQueueItem = thread.linked_queue_item_id
      ? await ctx.db.get(thread.linked_queue_item_id)
      : null;

    // Get read state for current user
    const readState = await ctx.db
      .query('inbox_read_state')
      .withIndex('by_user_thread', (q) =>
        q.eq('user_id', sessionCtx.userId).eq('thread_id', args.threadId),
      )
      .unique();

    return {
      thread: {
        ...thread,
        student: student
          ? {
              _id: student._id,
              name: student.name,
              email: student.email,
              imageUrl: student.profile_image,
              university_id: student.university_id,
            }
          : null,
        assignee: assignee
          ? {
              _id: assignee._id,
              name: assignee.name,
              email: assignee.email,
            }
          : null,
        linkedQueueItem: linkedQueueItem
          ? {
              _id: linkedQueueItem._id,
              title: linkedQueueItem.title,
              status: linkedQueueItem.status,
              priority: linkedQueueItem.priority,
            }
          : null,
      },
      messages: enrichedMessages,
      actions: enrichedActions,
      readState,
    };
  },
});

/**
 * Get unread counts for nav badge
 */
export const getUnreadCounts = query({
  args: {},
  handler: async (ctx) => {
    // Auth check
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    // Get all active threads in university
    let threads = await ctx.db
      .query('inbox_threads')
      .withIndex('by_university', (q) => q.eq('university_id', universityId))
      .filter((q) =>
        q.and(q.neq(q.field('status'), 'RESOLVED'), q.neq(q.field('status'), 'ARCHIVED')),
      )
      .collect();

    // RBAC: Advisors can only see threads for their assigned students
    if (sessionCtx.role === 'advisor') {
      const advisorStudents = await ctx.db
        .query('student_advisors')
        .withIndex('by_advisor', (q) => q.eq('advisor_id', sessionCtx.userId))
        .filter((q) => q.eq(q.field('is_owner'), true))
        .collect();

      const ownedStudentIds = new Set(advisorStudents.map((as) => as.student_id));

      threads = threads.filter(
        (t) =>
          (t.student_id && ownedStudentIds.has(t.student_id)) ||
          t.identity_status === 'unmatched' ||
          t.assigned_to === sessionCtx.userId,
      );
    }

    // Get read states for current user
    const readStates = await ctx.db
      .query('inbox_read_state')
      .withIndex('by_user_thread', (q) => q.eq('user_id', sessionCtx.userId))
      .collect();

    const readStateMap = new Map(readStates.map((rs) => [rs.thread_id, rs.last_read_at]));

    // Count unread threads
    let totalUnread = 0;
    let newThreads = 0;
    let slaBreach = 0;
    let assignedToMe = 0;
    let unassigned = 0;

    const now = Date.now();

    for (const thread of threads) {
      const lastReadAt = readStateMap.get(thread._id);
      const hasUnread = !lastReadAt || thread.last_message_at > lastReadAt;

      if (hasUnread) {
        totalUnread++;
      }

      if (thread.status === 'NEW') {
        newThreads++;
      }

      if (thread.sla_breached || (thread.sla_due_at && thread.sla_due_at < now)) {
        slaBreach++;
      }

      if (thread.assigned_to === sessionCtx.userId) {
        assignedToMe++;
      }

      if (!thread.assigned_to) {
        unassigned++;
      }
    }

    return {
      totalUnread,
      newThreads,
      slaBreach,
      assignedToMe,
      unassigned,
      totalActive: threads.length,
    };
  },
});

/**
 * Get threads for a specific student
 * Used in student detail view
 */
export const getThreadsForStudent = query({
  args: {
    studentId: v.id('users'),
  },
  handler: async (ctx, args) => {
    // Auth check
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);

    // Verify access to student
    if (sessionCtx.role === 'advisor') {
      const ownership = await ctx.db
        .query('student_advisors')
        .withIndex('by_advisor', (q) => q.eq('advisor_id', sessionCtx.userId))
        .filter((q) =>
          q.and(q.eq(q.field('student_id'), args.studentId), q.eq(q.field('is_owner'), true)),
        )
        .unique();

      if (!ownership) {
        throw new Error('Unauthorized: You do not have access to this student');
      }
    }

    // Get student
    const student = await ctx.db.get(args.studentId);
    if (!student) {
      throw new Error('Student not found');
    }

    // Tenant check
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (student.university_id !== universityId) {
        throw new Error('Unauthorized: Student not in your university');
      }
    }

    // Get threads for student
    const threads = await ctx.db
      .query('inbox_threads')
      .withIndex('by_student', (q) => q.eq('student_id', args.studentId))
      .order('desc')
      .collect();

    // Enrich with assignee info
    const enrichedThreads = await Promise.all(
      threads.map(async (thread) => {
        const assignee = thread.assigned_to ? await ctx.db.get(thread.assigned_to) : null;

        return {
          ...thread,
          assignee: assignee
            ? {
                _id: assignee._id,
                name: assignee.name,
                email: assignee.email,
              }
            : null,
        };
      }),
    );

    return enrichedThreads;
  },
});

/**
 * Get threads linked to a queue item
 * Used in queue item detail view
 */
export const getThreadsForQueueItem = query({
  args: {
    queueItemId: v.id('queue_items'),
  },
  handler: async (ctx, args) => {
    // Auth check
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);

    // Get queue item
    const queueItem = await ctx.db.get(args.queueItemId);
    if (!queueItem) {
      throw new Error('Queue item not found');
    }

    // Tenant check
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (queueItem.university_id !== universityId) {
        throw new Error('Unauthorized: Queue item not in your university');
      }
    }

    // Get threads linked to this queue item
    const threads = await ctx.db
      .query('inbox_threads')
      .withIndex('by_queue_item', (q) => q.eq('linked_queue_item_id', args.queueItemId))
      .collect();

    // Also get threads that might be linked via the reverse relationship
    const reverseLinkedThread = queueItem.linked_thread_id
      ? await ctx.db.get(queueItem.linked_thread_id)
      : null;

    // Combine and deduplicate
    const allThreads = [...threads];
    if (reverseLinkedThread && !threads.some((t) => t._id === reverseLinkedThread._id)) {
      allThreads.push(reverseLinkedThread);
    }

    // Enrich with student info
    const enrichedThreads = await Promise.all(
      allThreads.map(async (thread) => {
        const student = thread.student_id ? await ctx.db.get(thread.student_id) : null;

        return {
          ...thread,
          student: student
            ? {
                _id: student._id,
                name: student.name,
                email: student.email,
              }
            : null,
        };
      }),
    );

    return enrichedThreads;
  },
});
