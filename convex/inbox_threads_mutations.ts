/**
 * Inbox Threads - Mutations
 *
 * Thread mutations for the advisor inbox system.
 * Includes status transitions, assignment, and thread lifecycle.
 */

import { v } from 'convex/values';

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { mutation } from './_generated/server';
import {
  getCurrentUser,
  requireAdvisorRole,
  requireTenant,
  assertCanAccessStudent,
} from './advisor_auth';
import { logUserAction } from './lib/auditLogger';

// SLA configuration (hours) - can be made per-university later
const SLA_CONFIG = {
  P1: 4, // 4 hours
  P2: 24, // 24 hours (1 business day)
  P3: 72, // 72 hours (3 business days)
};

/**
 * Calculate SLA due date based on priority
 */
function calculateSLADueAt(priority: 'P1' | 'P2' | 'P3'): number {
  const hours = SLA_CONFIG[priority];
  return Date.now() + hours * 60 * 60 * 1000;
}

/**
 * Create a new thread
 * Used for starting new conversations with students
 */
export const createThread = mutation({
  args: {
    studentId: v.id('users'), // Required - must be an Ascentul user
    subject: v.string(),
    body: v.string(),
    priority: v.optional(v.union(v.literal('P1'), v.literal('P2'), v.literal('P3'))),
    channel: v.optional(
      v.union(
        v.literal('in_app'),
        v.literal('email_gmail'),
        v.literal('email_outlook'),
        v.literal('email_other'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    // Auth check
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const now = Date.now();
    const priority = args.priority ?? 'P3';
    const channel = args.channel ?? 'in_app';

    // Verify access to student (required - advisor inbox only works with Ascentul users)
    await assertCanAccessStudent(ctx, sessionCtx, args.studentId);
    const identityStatus = 'matched';
    const studentId = args.studentId;

    // Create snippet from body
    const snippet = args.body.length > 150 ? args.body.slice(0, 147) + '...' : args.body;

    // Create thread
    const threadId = await ctx.db.insert('inbox_threads', {
      university_id: universityId,
      thread_type: 'student', // Advisor ↔ student communication (student-visible)
      student_id: studentId,
      identity_status: identityStatus,
      subject: args.subject,
      snippet,
      channel,
      status: 'NEW',
      assigned_to: sessionCtx.userId, // Creator is auto-assigned
      assigned_at: now,
      assigned_by: sessionCtx.userId,
      sla_due_at: calculateSLADueAt(priority),
      sla_breached: false,
      priority,
      message_count: 1,
      last_message_at: now,
      last_message_sender_type: 'advisor',
      has_unread: true,
      created_at: now,
      updated_at: now,
    });

    // Create first message
    await ctx.db.insert('inbox_messages', {
      thread_id: threadId,
      university_id: universityId,
      sender_type: 'advisor',
      sender_user_id: sessionCtx.userId,
      body: args.body,
      channel,
      is_internal: false,
      created_at: now,
    });

    // Create action log
    await ctx.db.insert('inbox_thread_actions', {
      thread_id: threadId,
      actor_id: sessionCtx.userId,
      action_type: 'created',
      new_value: { subject: args.subject, priority },
      created_at: now,
    });

    // Mark as read for creator
    await ctx.db.insert('inbox_read_state', {
      thread_id: threadId,
      user_id: sessionCtx.userId,
      last_read_at: now,
      created_at: now,
      updated_at: now,
    });

    // Audit log
    await logUserAction(ctx, {
      action: 'inbox_thread.created',
      actorUserId: sessionCtx.userId,
      actorRole: sessionCtx.role,
      targetId: threadId,
      targetType: 'inbox_thread',
      studentId: studentId,
      actorUniversityId: universityId,
      metadata: {
        subject: args.subject,
        priority,
        channel,
        identityStatus,
      },
    });

    return threadId;
  },
});

/**
 * Create an internal thread (advisor-to-advisor)
 * These threads are NEVER visible to students.
 * Used for handoffs, case conferences, and supervisor escalations.
 */
export const createInternalThread = mutation({
  args: {
    subject: v.string(),
    body: v.string(),
    referencedStudentId: v.optional(v.id('users')), // Student being discussed (not a participant)
    mentionedUserIds: v.optional(v.array(v.id('users'))), // Advisors to notify
    priority: v.optional(v.union(v.literal('P1'), v.literal('P2'), v.literal('P3'))),
  },
  handler: async (ctx, args) => {
    // Auth check - must be advisor/admin
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const now = Date.now();
    const priority = args.priority ?? 'P3';

    // If referencing a student, verify access
    if (args.referencedStudentId) {
      await assertCanAccessStudent(ctx, sessionCtx, args.referencedStudentId);
    }

    // Validate mentioned users are in the same university and have advisor role
    const mentionedUserIds = args.mentionedUserIds ?? [];
    for (const userId of mentionedUserIds) {
      const user = await ctx.db.get(userId);
      if (!user) {
        throw new Error(`Mentioned user not found: ${userId}`);
      }
      if (user.university_id !== universityId) {
        throw new Error('Can only mention users in the same university');
      }
      const allowedRoles = ['advisor', 'university_admin', 'super_admin'];
      if (!allowedRoles.includes(user.role)) {
        throw new Error('Can only mention advisors or admins in internal threads');
      }
    }

    // Create snippet from body
    const snippet = args.body.length > 150 ? args.body.slice(0, 147) + '...' : args.body;

    // Create internal thread - note thread_type='internal'
    const threadId = await ctx.db.insert('inbox_threads', {
      university_id: universityId,
      thread_type: 'internal', // CRITICAL: marks as internal, never visible to students
      referenced_student_id: args.referencedStudentId,
      identity_status: 'matched', // Internal threads don't need identity resolution
      subject: args.subject,
      snippet,
      channel: 'in_app', // Internal threads are always in-app
      status: 'NEW',
      assigned_to: sessionCtx.userId, // Creator is auto-assigned
      assigned_at: now,
      assigned_by: sessionCtx.userId,
      sla_due_at: calculateSLADueAt(priority),
      sla_breached: false,
      priority,
      message_count: 1,
      last_message_at: now,
      last_message_sender_type: 'advisor',
      has_unread: mentionedUserIds.length > 0, // Unread for mentioned users
      created_at: now,
      updated_at: now,
    });

    // Create first message
    const messageId = await ctx.db.insert('inbox_messages', {
      thread_id: threadId,
      university_id: universityId,
      sender_type: 'advisor',
      sender_user_id: sessionCtx.userId,
      body: args.body,
      channel: 'in_app',
      is_internal: true, // All messages in internal threads are internal
      created_at: now,
    });

    // Create mention records for each mentioned user
    for (const mentionedUserId of mentionedUserIds) {
      await ctx.db.insert('inbox_mentions', {
        thread_id: threadId,
        message_id: messageId,
        university_id: universityId,
        mentioned_user_id: mentionedUserId,
        mentioned_by_id: sessionCtx.userId,
        created_at: now,
      });
    }

    // Create action log
    await ctx.db.insert('inbox_thread_actions', {
      thread_id: threadId,
      actor_id: sessionCtx.userId,
      action_type: 'created',
      new_value: {
        subject: args.subject,
        priority,
        thread_type: 'internal',
        referenced_student_id: args.referencedStudentId,
        mentioned_user_ids: mentionedUserIds,
      },
      created_at: now,
    });

    // Mark as read for creator
    await ctx.db.insert('inbox_read_state', {
      thread_id: threadId,
      user_id: sessionCtx.userId,
      last_read_at: now,
      created_at: now,
      updated_at: now,
    });

    // Audit log
    await logUserAction(ctx, {
      action: 'inbox.internal_thread_created',
      actorUserId: sessionCtx.userId,
      actorRole: sessionCtx.role,
      targetId: threadId,
      targetType: 'inbox_thread',
      studentId: args.referencedStudentId,
      actorUniversityId: universityId,
      metadata: {
        subject: args.subject,
        priority,
        thread_type: 'internal',
        mentioned_count: mentionedUserIds.length,
      },
    });

    // Schedule notifications for mentioned users
    if (mentionedUserIds.length > 0) {
      await ctx.scheduler.runAfter(0, internal.inbox_notifications.notifyMentionedUsers, {
        threadId,
        messageId,
        mentionedUserIds,
        mentionedById: sessionCtx.userId,
      });
    }

    return threadId;
  },
});

/**
 * Assign thread to an advisor
 */
export const assignThread = mutation({
  args: {
    threadId: v.id('inbox_threads'),
    assignTo: v.id('users'),
  },
  handler: async (ctx, args) => {
    // Auth check
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);

    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    // Tenant check
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (thread.university_id !== universityId) {
        throw new Error('Unauthorized: Thread not in your university');
      }
    }

    // Only admins can assign to others
    if (args.assignTo !== sessionCtx.userId) {
      if (!['university_admin', 'super_admin'].includes(sessionCtx.role)) {
        throw new Error('Unauthorized: Only admins can assign threads to others');
      }
    }

    // Verify assignee is in same university and has advisor role
    const assignee = await ctx.db.get(args.assignTo);
    if (!assignee) {
      throw new Error('Assignee not found');
    }

    if (assignee.university_id !== thread.university_id) {
      throw new Error('Assignee must be in the same university');
    }

    if (!['advisor', 'university_admin', 'super_admin'].includes(assignee.role)) {
      throw new Error('Assignee must be an advisor or admin');
    }

    const now = Date.now();
    const previousAssignee = thread.assigned_to;

    // Update thread
    await ctx.db.patch(args.threadId, {
      assigned_to: args.assignTo,
      assigned_at: now,
      assigned_by: sessionCtx.userId,
      updated_at: now,
    });

    // Create action log
    await ctx.db.insert('inbox_thread_actions', {
      thread_id: args.threadId,
      actor_id: sessionCtx.userId,
      action_type: previousAssignee ? 'reassigned' : 'assigned',
      previous_value: previousAssignee ? { assigned_to: previousAssignee } : undefined,
      new_value: { assigned_to: args.assignTo },
      created_at: now,
    });

    // Audit log
    await logUserAction(ctx, {
      action: previousAssignee ? 'inbox_thread.reassigned' : 'inbox_thread.assigned',
      actorUserId: sessionCtx.userId,
      actorRole: sessionCtx.role,
      targetId: args.threadId,
      targetType: 'inbox_thread',
      studentId: thread.student_id,
      actorUniversityId: thread.university_id,
      metadata: {
        previousAssignee,
        newAssignee: args.assignTo,
      },
    });

    return { success: true };
  },
});

/**
 * Update thread status
 */
export const updateStatus = mutation({
  args: {
    threadId: v.id('inbox_threads'),
    status: v.union(
      v.literal('NEW'),
      v.literal('OPEN'),
      v.literal('IN_PROGRESS'),
      v.literal('WAITING_ON_STUDENT'),
      v.literal('WAITING_ON_STAFF'),
      v.literal('RESOLVED'),
      v.literal('ARCHIVED'),
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Auth check
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);

    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    // Tenant check
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (thread.university_id !== universityId) {
        throw new Error('Unauthorized: Thread not in your university');
      }
    }

    // Only admins can archive
    if (args.status === 'ARCHIVED') {
      if (!['university_admin', 'super_admin'].includes(sessionCtx.role)) {
        throw new Error('Unauthorized: Only admins can archive threads');
      }
    }

    const now = Date.now();
    const previousStatus = thread.status;

    // Update thread
    await ctx.db.patch(args.threadId, {
      status: args.status,
      updated_at: now,
    });

    // Create action log
    await ctx.db.insert('inbox_thread_actions', {
      thread_id: args.threadId,
      actor_id: sessionCtx.userId,
      action_type: 'status_changed',
      previous_value: { status: previousStatus },
      new_value: { status: args.status },
      notes: args.notes,
      created_at: now,
    });

    // Audit log
    await logUserAction(ctx, {
      action: 'inbox_thread.status_changed',
      actorUserId: sessionCtx.userId,
      actorRole: sessionCtx.role,
      targetId: args.threadId,
      targetType: 'inbox_thread',
      studentId: thread.student_id,
      actorUniversityId: thread.university_id,
      metadata: {
        previousStatus,
        newStatus: args.status,
        notes: args.notes,
      },
    });

    return { success: true };
  },
});

/**
 * Resolve thread
 */
export const resolveThread = mutation({
  args: {
    threadId: v.id('inbox_threads'),
    resolutionNote: v.string(),
    resolveLinkedQueueItems: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Auth check
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);

    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    // Tenant check
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (thread.university_id !== universityId) {
        throw new Error('Unauthorized: Thread not in your university');
      }
    }

    if (!args.resolutionNote.trim()) {
      throw new Error('Resolution note is required');
    }

    const now = Date.now();
    const previousStatus = thread.status;

    // Update thread
    await ctx.db.patch(args.threadId, {
      status: 'RESOLVED',
      updated_at: now,
    });

    // Add resolution as internal note
    await ctx.db.insert('inbox_messages', {
      thread_id: args.threadId,
      university_id: thread.university_id,
      sender_type: 'system',
      sender_user_id: sessionCtx.userId,
      body: `Thread resolved: ${args.resolutionNote}`,
      channel: 'in_app',
      is_internal: true,
      created_at: now,
    });

    // Update message count
    await ctx.db.patch(args.threadId, {
      message_count: thread.message_count + 1,
    });

    // Create action log
    await ctx.db.insert('inbox_thread_actions', {
      thread_id: args.threadId,
      actor_id: sessionCtx.userId,
      action_type: 'status_changed',
      previous_value: { status: previousStatus },
      new_value: { status: 'RESOLVED' },
      notes: args.resolutionNote,
      created_at: now,
    });

    // Optionally resolve linked queue items
    if (args.resolveLinkedQueueItems && thread.linked_queue_item_id) {
      const queueItem = await ctx.db.get(thread.linked_queue_item_id);
      if (queueItem && (queueItem.status === 'OPEN' || queueItem.status === 'IN_PROGRESS')) {
        await ctx.db.patch(thread.linked_queue_item_id, {
          status: 'RESOLVED',
          closed_reason: 'resolved_via_inbox',
          closed_by: sessionCtx.userId,
          closed_at: now,
          updated_at: now,
          version: (queueItem.version ?? 0) + 1,
        });

        // Log queue item action
        await ctx.db.insert('queue_item_actions', {
          queue_item_id: thread.linked_queue_item_id,
          actor_id: sessionCtx.userId,
          action_type: 'resolved',
          notes: `Resolved via inbox thread: ${args.resolutionNote}`,
          created_at: now,
        });
      }
    }

    // Audit log
    await logUserAction(ctx, {
      action: 'inbox_thread.resolved',
      actorUserId: sessionCtx.userId,
      actorRole: sessionCtx.role,
      targetId: args.threadId,
      targetType: 'inbox_thread',
      studentId: thread.student_id,
      actorUniversityId: thread.university_id,
      metadata: {
        resolutionNote: args.resolutionNote,
        resolvedLinkedQueueItems: args.resolveLinkedQueueItems,
      },
    });

    return { success: true };
  },
});

/**
 * Reopen a resolved thread
 */
export const reopenThread = mutation({
  args: {
    threadId: v.id('inbox_threads'),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Auth check
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);

    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    // Tenant check
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (thread.university_id !== universityId) {
        throw new Error('Unauthorized: Thread not in your university');
      }
    }

    if (thread.status !== 'RESOLVED' && thread.status !== 'ARCHIVED') {
      throw new Error('Can only reopen resolved or archived threads');
    }

    const now = Date.now();
    const previousStatus = thread.status;

    // Update thread - recalculate SLA
    await ctx.db.patch(args.threadId, {
      status: 'OPEN',
      sla_due_at: calculateSLADueAt(thread.priority),
      sla_breached: false,
      updated_at: now,
    });

    // Create action log
    await ctx.db.insert('inbox_thread_actions', {
      thread_id: args.threadId,
      actor_id: sessionCtx.userId,
      action_type: 'reopened',
      previous_value: { status: previousStatus },
      new_value: { status: 'OPEN' },
      notes: args.reason,
      created_at: now,
    });

    // Audit log
    await logUserAction(ctx, {
      action: 'inbox_thread.reopened',
      actorUserId: sessionCtx.userId,
      actorRole: sessionCtx.role,
      targetId: args.threadId,
      targetType: 'inbox_thread',
      studentId: thread.student_id,
      actorUniversityId: thread.university_id,
      metadata: {
        previousStatus,
        reason: args.reason,
      },
    });

    return { success: true };
  },
});

/**
 * Update thread priority
 */
export const updatePriority = mutation({
  args: {
    threadId: v.id('inbox_threads'),
    priority: v.union(v.literal('P1'), v.literal('P2'), v.literal('P3')),
  },
  handler: async (ctx, args) => {
    // Auth check
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);

    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    // Tenant check
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (thread.university_id !== universityId) {
        throw new Error('Unauthorized: Thread not in your university');
      }
    }

    const now = Date.now();
    const previousPriority = thread.priority;

    // Recalculate SLA if priority increased
    const priorityOrder = { P1: 0, P2: 1, P3: 2 };
    const isEscalation = priorityOrder[args.priority] < priorityOrder[previousPriority];

    // Update thread
    await ctx.db.patch(args.threadId, {
      priority: args.priority,
      sla_due_at: isEscalation ? calculateSLADueAt(args.priority) : thread.sla_due_at,
      updated_at: now,
    });

    // Create action log (only if changed)
    if (previousPriority !== args.priority) {
      await ctx.db.insert('inbox_thread_actions', {
        thread_id: args.threadId,
        actor_id: sessionCtx.userId,
        action_type: 'priority_changed',
        previous_value: { priority: previousPriority },
        new_value: { priority: args.priority },
        created_at: now,
      });
    }

    // Audit log
    await logUserAction(ctx, {
      action: 'inbox_thread.priority_changed',
      actorUserId: sessionCtx.userId,
      actorRole: sessionCtx.role,
      targetId: args.threadId,
      targetType: 'inbox_thread',
      studentId: thread.student_id,
      actorUniversityId: thread.university_id,
      metadata: {
        previousPriority,
        newPriority: args.priority,
        isEscalation,
      },
    });

    return { success: true };
  },
});

/**
 * Mark thread as read
 */
export const markAsRead = mutation({
  args: {
    threadId: v.id('inbox_threads'),
  },
  handler: async (ctx, args) => {
    // Auth check
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);

    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    // Tenant check (allow reading if you can see the thread)
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (thread.university_id !== universityId) {
        throw new Error('Unauthorized: Thread not in your university');
      }
    }

    // RBAC: Advisors can only access threads they have permission for
    if (sessionCtx.role === 'advisor') {
      let hasAccess = false;

      // Check if assigned to this thread
      if (thread.assigned_to === sessionCtx.userId) {
        hasAccess = true;
      }

      // For student threads: check if owns the student
      if (!hasAccess && thread.student_id && thread.thread_type !== 'internal') {
        const ownership = await ctx.db
          .query('student_advisors')
          .withIndex('by_advisor', (q) => q.eq('advisor_id', sessionCtx.userId))
          .filter((q) =>
            q.and(q.eq(q.field('student_id'), thread.student_id), q.eq(q.field('is_owner'), true)),
          )
          .unique();

        if (ownership) {
          hasAccess = true;
        }
      }

      // For internal threads: check if mentioned or if owns the referenced student
      if (!hasAccess && thread.thread_type === 'internal') {
        // Check if mentioned in this thread
        const mention = await ctx.db
          .query('inbox_mentions')
          .withIndex('by_thread', (q) => q.eq('thread_id', args.threadId))
          .filter((q) => q.eq(q.field('mentioned_user_id'), sessionCtx.userId))
          .first();

        if (mention) {
          hasAccess = true;
        }

        // Check if owns the referenced student
        if (!hasAccess && thread.referenced_student_id) {
          const ownership = await ctx.db
            .query('student_advisors')
            .withIndex('by_advisor', (q) => q.eq('advisor_id', sessionCtx.userId))
            .filter((q) =>
              q.and(
                q.eq(q.field('student_id'), thread.referenced_student_id),
                q.eq(q.field('is_owner'), true),
              ),
            )
            .unique();

          if (ownership) {
            hasAccess = true;
          }
        }
      }

      if (!hasAccess) {
        throw new Error('Unauthorized: You do not have access to this thread');
      }
    }

    const now = Date.now();

    // Upsert read state
    const existingReadState = await ctx.db
      .query('inbox_read_state')
      .withIndex('by_user_thread', (q) =>
        q.eq('user_id', sessionCtx.userId).eq('thread_id', args.threadId),
      )
      .unique();

    if (existingReadState) {
      await ctx.db.patch(existingReadState._id, {
        last_read_at: now,
        updated_at: now,
      });
    } else {
      await ctx.db.insert('inbox_read_state', {
        thread_id: args.threadId,
        user_id: sessionCtx.userId,
        last_read_at: now,
        created_at: now,
        updated_at: now,
      });
    }

    // If NEW, transition to OPEN
    if (thread.status === 'NEW') {
      await ctx.db.patch(args.threadId, {
        status: 'OPEN',
        updated_at: now,
      });

      await ctx.db.insert('inbox_thread_actions', {
        thread_id: args.threadId,
        actor_id: sessionCtx.userId,
        action_type: 'status_changed',
        previous_value: { status: 'NEW' },
        new_value: { status: 'OPEN' },
        created_at: now,
      });
    }

    return { success: true };
  },
});
