/**
 * Inbox Queue Integration
 *
 * Handles bidirectional linking between inbox threads and queue items.
 * Supports creating queue items from threads and linking existing items.
 */

import { v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import {
  getCurrentUser,
  requireAdvisorRole,
  requireTenant,
  assertCanAccessStudent,
} from './advisor_auth';
import { logUserAction } from './lib/auditLogger';

/**
 * Create queue item from thread
 * Creates a new queue item linked to the thread
 */
export const createQueueItemFromThread = mutation({
  args: {
    threadId: v.id('inbox_threads'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    priority: v.optional(v.union(v.literal('P1'), v.literal('P2'), v.literal('P3'))),
    dueAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Auth check
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    // Tenant check
    if (thread.university_id !== universityId) {
      throw new Error('Unauthorized: Thread not in your university');
    }

    // Thread must have a matched student to create queue item
    if (!thread.student_id) {
      throw new Error('Cannot create queue item: Thread must be matched to a student first');
    }

    // Verify access to student
    await assertCanAccessStudent(ctx, sessionCtx, thread.student_id);

    // Check if thread already has a linked queue item
    if (thread.linked_queue_item_id) {
      const existingItem = await ctx.db.get(thread.linked_queue_item_id);
      if (
        existingItem &&
        (existingItem.status === 'OPEN' || existingItem.status === 'IN_PROGRESS')
      ) {
        throw new Error('Thread already has an active linked queue item');
      }
      // Existing item is resolved/closed/deleted - clear the stale link
      await ctx.db.patch(args.threadId, {
        linked_queue_item_id: undefined,
        updated_at: Date.now(),
      });
    }

    const now = Date.now();
    const priority = args.priority ?? thread.priority ?? 'P2';
    const title = args.title ?? `Follow up: ${thread.subject}`;
    const description = args.description ?? thread.snippet ?? undefined;

    // Find primary advisor for the student
    const primaryAdvisor = await ctx.db
      .query('student_advisors')
      .withIndex('by_student', (q) => q.eq('student_id', thread.student_id!))
      .filter((q) => q.eq(q.field('is_owner'), true))
      .first();

    const ownerId = thread.assigned_to ?? primaryAdvisor?.advisor_id ?? sessionCtx.userId;

    // Create queue item
    const queueItemId = await ctx.db.insert('queue_items', {
      university_id: universityId,
      student_id: thread.student_id,
      owner_id: ownerId,
      title,
      description,
      priority,
      status: 'OPEN',
      due_at: args.dueAt,
      created_from: 'inbox',
      linked_thread_id: args.threadId,
      version: 0,
      created_at: now,
      updated_at: now,
    });

    // Update thread with linked queue item
    await ctx.db.patch(args.threadId, {
      linked_queue_item_id: queueItemId,
      updated_at: now,
    });

    // Create queue item action log
    await ctx.db.insert('queue_item_actions', {
      queue_item_id: queueItemId,
      actor_id: sessionCtx.userId,
      action_type: 'created',
      notes: `Created from inbox thread: ${thread.subject}`,
      created_at: now,
    });

    // Create thread action log
    await ctx.db.insert('inbox_thread_actions', {
      thread_id: args.threadId,
      actor_id: sessionCtx.userId,
      action_type: 'queue_item_created',
      new_value: { queue_item_id: queueItemId },
      created_at: now,
    });

    // Audit log
    await logUserAction(ctx, {
      action: 'queue_item.created_from_inbox',
      actorUserId: sessionCtx.userId,
      actorRole: sessionCtx.role,
      targetId: queueItemId,
      targetType: 'queue_item',
      studentId: thread.student_id,
      actorUniversityId: universityId,
      metadata: {
        threadId: args.threadId,
        threadSubject: thread.subject,
        priority,
      },
    });

    return queueItemId;
  },
});

/**
 * Link thread to existing queue item
 */
export const linkToQueueItem = mutation({
  args: {
    threadId: v.id('inbox_threads'),
    queueItemId: v.id('queue_items'),
  },
  handler: async (ctx, args) => {
    // Auth check
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    const queueItem = await ctx.db.get(args.queueItemId);
    if (!queueItem) {
      throw new Error('Queue item not found');
    }

    // Tenant check
    if (thread.university_id !== universityId) {
      throw new Error('Unauthorized: Thread not in your university');
    }

    if (queueItem.university_id !== universityId) {
      throw new Error('Unauthorized: Queue item not in your university');
    }

    // Require a matched student before linking
    if (!thread.student_id) {
      throw new Error('Thread must be matched to a student before linking');
    }

    // Verify they're for the same student
    if (queueItem.student_id !== thread.student_id) {
      throw new Error('Thread and queue item must be for the same student');
    }

    // Verify advisor has access to the student
    await assertCanAccessStudent(ctx, sessionCtx, thread.student_id);

    // Guard against overwriting existing links (one-to-one integrity)
    if (thread.linked_queue_item_id && thread.linked_queue_item_id !== args.queueItemId) {
      throw new Error('Thread is already linked to a different queue item');
    }
    if (queueItem.linked_thread_id && queueItem.linked_thread_id !== args.threadId) {
      throw new Error('Queue item is already linked to a different thread');
    }

    const now = Date.now();

    // Update thread
    await ctx.db.patch(args.threadId, {
      linked_queue_item_id: args.queueItemId,
      updated_at: now,
    });

    // Update queue item
    await ctx.db.patch(args.queueItemId, {
      linked_thread_id: args.threadId,
      updated_at: now,
    });

    // Create thread action log
    await ctx.db.insert('inbox_thread_actions', {
      thread_id: args.threadId,
      actor_id: sessionCtx.userId,
      action_type: 'queue_item_linked',
      new_value: { queue_item_id: args.queueItemId },
      created_at: now,
    });

    // Create queue item action log
    await ctx.db.insert('queue_item_actions', {
      queue_item_id: args.queueItemId,
      actor_id: sessionCtx.userId,
      action_type: 'thread_linked',
      notes: `Linked to inbox thread: ${thread.subject}`,
      created_at: now,
    });

    // Audit log
    await logUserAction(ctx, {
      action: 'inbox_thread.linked_to_queue_item',
      actorUserId: sessionCtx.userId,
      actorRole: sessionCtx.role,
      targetId: args.threadId,
      targetType: 'inbox_thread',
      studentId: thread.student_id ?? queueItem.student_id,
      actorUniversityId: universityId,
      metadata: {
        queueItemId: args.queueItemId,
        queueItemTitle: queueItem.title,
      },
    });

    return { success: true };
  },
});

/**
 * Unlink thread from queue item
 */
export const unlinkFromQueueItem = mutation({
  args: {
    threadId: v.id('inbox_threads'),
  },
  handler: async (ctx, args) => {
    // Auth check
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    // Tenant check
    if (thread.university_id !== universityId) {
      throw new Error('Unauthorized: Thread not in your university');
    }

    if (!thread.linked_queue_item_id) {
      throw new Error('Thread is not linked to a queue item');
    }

    // Verify advisor has access to the student
    if (thread.student_id) {
      await assertCanAccessStudent(ctx, sessionCtx, thread.student_id);
    }

    const queueItemId = thread.linked_queue_item_id;
    const queueItem = await ctx.db.get(queueItemId);

    const now = Date.now();

    // Update thread
    await ctx.db.patch(args.threadId, {
      linked_queue_item_id: undefined,
      updated_at: now,
    });

    // Update queue item if it exists and has reverse link
    if (queueItem && queueItem.linked_thread_id === args.threadId) {
      await ctx.db.patch(queueItemId, {
        linked_thread_id: undefined,
        updated_at: now,
      });
    }

    // Create thread action log
    await ctx.db.insert('inbox_thread_actions', {
      thread_id: args.threadId,
      actor_id: sessionCtx.userId,
      action_type: 'queue_item_unlinked',
      previous_value: { linked_queue_item_id: queueItemId },
      new_value: { linked_queue_item_id: null },
      notes: 'Unlinked from queue item',
      created_at: now,
    });

    // Create queue item action log for audit parity
    if (queueItem) {
      await ctx.db.insert('queue_item_actions', {
        queue_item_id: queueItemId,
        actor_id: sessionCtx.userId,
        action_type: 'thread_unlinked',
        notes: 'Unlinked from inbox thread',
        created_at: now,
      });
    }

    // Audit log
    await logUserAction(ctx, {
      action: 'inbox_thread.unlinked_from_queue_item',
      actorUserId: sessionCtx.userId,
      actorRole: sessionCtx.role,
      targetId: args.threadId,
      targetType: 'inbox_thread',
      studentId: thread.student_id,
      actorUniversityId: universityId,
      metadata: {
        previousQueueItemId: queueItemId,
      },
    });

    return { success: true };
  },
});

/**
 * Get queue items that can be linked to a thread
 * Returns open/in-progress queue items for the thread's student
 */
export const getLinkableQueueItems = query({
  args: {
    threadId: v.id('inbox_threads'),
  },
  handler: async (ctx, args) => {
    // Auth check
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    // Tenant check
    if (thread.university_id !== universityId) {
      throw new Error('Unauthorized: Thread not in your university');
    }

    // If thread has no student, return empty (can't link)
    if (!thread.student_id) {
      return [];
    }

    // Get open/in-progress queue items for this student
    const queueItems = await ctx.db
      .query('queue_items')
      .withIndex('by_student', (q) => q.eq('student_id', thread.student_id!))
      .filter((q) => q.or(q.eq(q.field('status'), 'OPEN'), q.eq(q.field('status'), 'IN_PROGRESS')))
      .collect();

    // Filter to same university, exclude items already linked to other threads,
    // and exclude the item already linked to this thread
    const filteredItems = queueItems.filter(
      (item) =>
        item.university_id === universityId &&
        !item.linked_thread_id &&
        item._id !== thread.linked_queue_item_id,
    );

    // Enrich with owner info
    const enrichedItems = await Promise.all(
      filteredItems.map(async (item) => {
        const owner = item.owner_id ? await ctx.db.get(item.owner_id) : null;

        return {
          _id: item._id,
          title: item.title,
          description: item.description,
          status: item.status,
          priority: item.priority,
          created_at: item.created_at,
          owner: owner
            ? {
                _id: owner._id,
                name: owner.name,
              }
            : null,
        };
      }),
    );

    return enrichedItems;
  },
});

/**
 * Get thread link status for a queue item
 * Used in queue item detail view
 */
export const getQueueItemThreadLink = query({
  args: {
    queueItemId: v.id('queue_items'),
  },
  handler: async (ctx, args) => {
    // Auth check
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);

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

    // Get linked thread
    if (!queueItem.linked_thread_id) {
      return null;
    }

    const thread = await ctx.db.get(queueItem.linked_thread_id);
    if (!thread) {
      return null;
    }

    return {
      _id: thread._id,
      subject: thread.subject,
      status: thread.status,
      priority: thread.priority,
      message_count: thread.message_count,
      last_message_at: thread.last_message_at,
      has_unread: thread.has_unread,
    };
  },
});
