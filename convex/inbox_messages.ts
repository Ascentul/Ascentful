/**
 * Inbox Messages - Queries and Mutations
 *
 * Message operations for the advisor inbox system.
 * Supports adding messages, internal notes, and handling student replies.
 */

import { v } from 'convex/values';

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { getCurrentUser, requireAdvisorRole, requireTenant } from './advisor_auth';
import { logUserAction } from './lib/auditLogger';

/**
 * Add a message to a thread (advisor reply)
 */
export const addMessage = mutation({
  args: {
    threadId: v.id('inbox_threads'),
    body: v.string(),
    bodyHtml: v.optional(v.string()),
    isInternal: v.optional(v.boolean()),
    attachments: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          size: v.number(),
          mime_type: v.string(),
          storage_id: v.optional(v.id('_storage')),
          url: v.optional(v.string()),
        }),
      ),
    ),
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

    if (!args.body.trim()) {
      throw new Error('Message body is required');
    }

    const now = Date.now();
    const isInternal = args.isInternal ?? false;

    // Create message
    const messageId = await ctx.db.insert('inbox_messages', {
      thread_id: args.threadId,
      university_id: thread.university_id,
      sender_type: 'advisor',
      sender_user_id: sessionCtx.userId,
      body: args.body,
      body_html: args.bodyHtml,
      channel: thread.channel,
      attachments: args.attachments,
      is_internal: isInternal,
      created_at: now,
    });

    // Create snippet from body (for non-internal messages)
    const snippet = !isInternal
      ? args.body.length > 150
        ? args.body.slice(0, 147) + '...'
        : args.body
      : thread.snippet;

    // Update thread aggregates
    await ctx.db.patch(args.threadId, {
      message_count: thread.message_count + 1,
      last_message_at: now,
      last_message_sender_type: isInternal ? thread.last_message_sender_type : 'advisor',
      snippet: isInternal ? thread.snippet : snippet,
      has_unread: !isInternal, // Internal notes don't trigger unread for students
      updated_at: now,
    });

    // If not internal and thread was waiting on staff, transition to waiting on student
    if (!isInternal && thread.status === 'WAITING_ON_STAFF') {
      await ctx.db.patch(args.threadId, {
        status: 'WAITING_ON_STUDENT',
      });

      await ctx.db.insert('inbox_thread_actions', {
        thread_id: args.threadId,
        actor_id: sessionCtx.userId,
        action_type: 'status_changed',
        previous_value: { status: 'WAITING_ON_STAFF' },
        new_value: { status: 'WAITING_ON_STUDENT' },
        created_at: now,
      });
    }

    // Create action log
    await ctx.db.insert('inbox_thread_actions', {
      thread_id: args.threadId,
      actor_id: sessionCtx.userId,
      action_type: isInternal ? 'note_added' : 'message_added',
      created_at: now,
    });

    // Mark as read for sender
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

    // Audit log
    await logUserAction(ctx, {
      action: isInternal ? 'inbox_message.note_added' : 'inbox_message.sent',
      actorUserId: sessionCtx.userId,
      actorRole: sessionCtx.role,
      targetId: messageId,
      targetType: 'inbox_message',
      studentId: thread.student_id,
      actorUniversityId: thread.university_id,
      metadata: {
        threadId: args.threadId,
        isInternal,
        hasAttachments: !!(args.attachments && args.attachments.length > 0),
      },
    });

    return messageId;
  },
});

/**
 * Add internal note (shortcut for isInternal: true)
 */
export const addInternalNote = mutation({
  args: {
    threadId: v.id('inbox_threads'),
    body: v.string(),
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

    if (!args.body.trim()) {
      throw new Error('Note body is required');
    }

    const now = Date.now();

    // Create message as internal note
    const messageId = await ctx.db.insert('inbox_messages', {
      thread_id: args.threadId,
      university_id: thread.university_id,
      sender_type: 'advisor',
      sender_user_id: sessionCtx.userId,
      body: args.body,
      channel: 'in_app',
      is_internal: true,
      created_at: now,
    });

    // Update thread aggregates (internal notes don't change snippet or last_message_sender_type)
    await ctx.db.patch(args.threadId, {
      message_count: thread.message_count + 1,
      updated_at: now,
    });

    // Create action log
    await ctx.db.insert('inbox_thread_actions', {
      thread_id: args.threadId,
      actor_id: sessionCtx.userId,
      action_type: 'note_added',
      created_at: now,
    });

    // Audit log
    await logUserAction(ctx, {
      action: 'inbox_message.note_added',
      actorUserId: sessionCtx.userId,
      actorRole: sessionCtx.role,
      targetId: messageId,
      targetType: 'inbox_message',
      studentId: thread.student_id,
      actorUniversityId: thread.university_id,
      metadata: {
        threadId: args.threadId,
      },
    });

    return messageId;
  },
});

/**
 * Handle incoming student message (in-app)
 * This is used when students reply to threads
 */
export const addStudentMessage = mutation({
  args: {
    threadId: v.id('inbox_threads'),
    body: v.string(),
    bodyHtml: v.optional(v.string()),
    attachments: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          size: v.number(),
          mime_type: v.string(),
          storage_id: v.optional(v.id('_storage')),
          url: v.optional(v.string()),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    // Auth check - students can reply to their threads
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    // Verify student is the thread's student
    if (thread.student_id !== user._id) {
      throw new Error('Unauthorized: You are not part of this conversation');
    }

    if (!args.body.trim()) {
      throw new Error('Message body is required');
    }

    const now = Date.now();

    // Create message
    const messageId = await ctx.db.insert('inbox_messages', {
      thread_id: args.threadId,
      university_id: thread.university_id,
      sender_type: 'student',
      sender_user_id: user._id,
      body: args.body,
      body_html: args.bodyHtml,
      channel: 'in_app',
      attachments: args.attachments,
      is_internal: false,
      created_at: now,
    });

    // Create snippet
    const snippet = args.body.length > 150 ? args.body.slice(0, 147) + '...' : args.body;

    // Update thread aggregates
    await ctx.db.patch(args.threadId, {
      message_count: thread.message_count + 1,
      last_message_at: now,
      last_message_sender_type: 'student',
      snippet,
      has_unread: true,
      updated_at: now,
    });

    // If thread was waiting on student, transition to in progress
    if (thread.status === 'WAITING_ON_STUDENT') {
      await ctx.db.patch(args.threadId, {
        status: 'IN_PROGRESS',
      });

      await ctx.db.insert('inbox_thread_actions', {
        thread_id: args.threadId,
        actor_id: user._id,
        action_type: 'status_changed',
        previous_value: { status: 'WAITING_ON_STUDENT' },
        new_value: { status: 'IN_PROGRESS' },
        notes: 'Student replied',
        created_at: now,
      });
    }

    // Create action log
    await ctx.db.insert('inbox_thread_actions', {
      thread_id: args.threadId,
      actor_id: user._id,
      action_type: 'message_added',
      created_at: now,
    });

    // Notify advisor(s) of new student message
    await ctx.scheduler.runAfter(0, internal.inbox_notifications.notifyNewStudentMessage, {
      threadId: args.threadId,
      messageId,
      studentId: user._id,
      universityId: thread.university_id,
      isNewThread: false,
    });

    // Audit log
    await logUserAction(ctx, {
      action: 'inbox_message.student_reply',
      actorUserId: user._id,
      actorRole: user.role,
      targetId: messageId,
      targetType: 'inbox_message',
      studentId: user._id,
      actorUniversityId: thread.university_id,
      metadata: {
        threadId: args.threadId,
        hasAttachments: !!(args.attachments && args.attachments.length > 0),
      },
    });

    return messageId;
  },
});

/**
 * Get messages for a thread (student view)
 * Students can only see non-internal messages
 */
export const getStudentThreadMessages = query({
  args: {
    threadId: v.id('inbox_threads'),
  },
  handler: async (ctx, args) => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    // Verify student is the thread's student
    if (thread.student_id !== user._id) {
      throw new Error('Unauthorized: You are not part of this conversation');
    }

    // Get non-internal messages only
    const messages = await ctx.db
      .query('inbox_messages')
      .withIndex('by_thread', (q) => q.eq('thread_id', args.threadId))
      .filter((q) => q.eq(q.field('is_internal'), false))
      .order('asc')
      .collect();

    // Batch-fetch sender data to avoid N+1 queries
    const senderIds = [
      ...new Set(
        messages.map((m) => m.sender_user_id).filter((id): id is Id<'users'> => id !== undefined),
      ),
    ];
    const senders = await Promise.all(senderIds.map((id) => ctx.db.get(id)));
    const senderMap = new Map(
      senders
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .map((s) => [
          s._id,
          {
            _id: s._id,
            name: s.name,
            imageUrl: s.profile_image,
          },
        ]),
    );

    // Enrich messages using the pre-fetched sender map
    const enrichedMessages = messages.map((message) => {
      const senderUser = message.sender_user_id
        ? (senderMap.get(message.sender_user_id) ?? null)
        : null;

      return {
        _id: message._id,
        body: message.body,
        body_html: message.body_html,
        sender_type: message.sender_type,
        senderUser,
        attachments: message.attachments,
        created_at: message.created_at,
      };
    });

    return {
      thread: {
        _id: thread._id,
        subject: thread.subject,
        status: thread.status,
        created_at: thread.created_at,
      },
      messages: enrichedMessages,
    };
  },
});

/**
 * Get student's threads
 * Shows all threads where student is a participant
 */
export const getStudentThreads = query({
  args: {},
  handler: async (ctx) => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    // Get threads for this student
    const threads = await ctx.db
      .query('inbox_threads')
      .withIndex('by_student', (q) => q.eq('student_id', user._id))
      .filter((q) => q.neq(q.field('status'), 'ARCHIVED'))
      .order('desc')
      .collect();

    // Batch-fetch assignee data to avoid N+1 queries
    const assigneeIds = [
      ...new Set(
        threads.map((t) => t.assigned_to).filter((id): id is Id<'users'> => id !== undefined),
      ),
    ];
    const assignees = await Promise.all(assigneeIds.map((id) => ctx.db.get(id)));
    const assigneeMap = new Map(
      assignees
        .filter((a): a is NonNullable<typeof a> => a !== null)
        .map((a) => [
          a._id,
          {
            _id: a._id,
            name: a.name,
            imageUrl: a.profile_image,
          },
        ]),
    );

    // Enrich threads using the pre-fetched assignee map
    const enrichedThreads = threads.map((thread) => {
      const assignee = thread.assigned_to ? (assigneeMap.get(thread.assigned_to) ?? null) : null;

      return {
        _id: thread._id,
        subject: thread.subject,
        snippet: thread.snippet,
        status: thread.status,
        assignee,
        message_count: thread.message_count,
        last_message_at: thread.last_message_at,
        last_message_sender_type: thread.last_message_sender_type,
        created_at: thread.created_at,
      };
    });

    return enrichedThreads;
  },
});
