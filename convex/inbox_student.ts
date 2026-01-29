/**
 * Inbox Student - Student-facing inbox queries and mutations
 *
 * Enables students to:
 * - Create new support threads with categories
 * - Send messages to advisors
 * - Mark threads as resolved/reopened
 * - View their thread history
 *
 * Integrates with the existing advisor inbox system (inbox_threads, inbox_messages).
 */

import { v, ConvexError } from 'convex/values';

import { internal } from './_generated/api';
import { mutation, query } from './_generated/server';
import { logUserAction } from './lib/auditLogger';
import { getStudentAdvisor, requireUniversityStudent } from './student_advisor_auth';

// ============================================================================
// CONSTANTS
// ============================================================================

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_MESSAGES = 5;

const CATEGORY_LABELS: Record<string, string> = {
  resume_review: 'Resume Review',
  interview_help: 'Interview Help',
  job_search: 'Job Search',
  appointment: 'Appointment Request',
  general: 'General Question',
  other: 'Other',
};

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get student's inbox threads with enriched data
 */
export const listMyThreads = query({
  args: {
    clerkId: v.string(),
    status: v.optional(
      v.union(
        v.literal('active'), // Non-archived threads
        v.literal('resolved'), // Only resolved
        v.literal('all'), // All including archived
      ),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Auth check
    const student = await requireUniversityStudent(ctx, args.clerkId);
    const limit = Math.max(0, Math.floor(args.limit ?? 50));
    const statusFilter = args.status ?? 'active';

    // Get threads for this student
    let threads = await ctx.db
      .query('inbox_threads')
      .withIndex('by_student', (q) => q.eq('student_id', student.userId))
      .order('desc')
      .collect();

    // Apply status filter
    if (statusFilter === 'active') {
      threads = threads.filter((t) => t.status !== 'ARCHIVED' && t.status !== 'RESOLVED');
    } else if (statusFilter === 'resolved') {
      threads = threads.filter((t) => t.status === 'RESOLVED');
    }
    // 'all' shows everything including archived - no filtering needed

    // Apply limit
    threads = threads.slice(0, limit);

    // Get read states for unread calculation
    const readStates = await ctx.db
      .query('inbox_read_state')
      .withIndex('by_user_thread', (q) => q.eq('user_id', student.userId))
      .collect();

    const readStateMap = new Map(readStates.map((rs) => [rs.thread_id, rs.last_read_at]));

    // Enrich threads
    const enrichedThreads = await Promise.all(
      threads.map(async (thread) => {
        // Get assignee info
        let assignee = null;
        if (thread.assigned_to) {
          const advisor = await ctx.db.get(thread.assigned_to);
          if (advisor) {
            assignee = {
              _id: advisor._id,
              name: advisor.name,
              imageUrl: advisor.profile_image,
            };
          }
        }

        // Calculate unread status (ignore student's own messages)
        const lastReadAt = readStateMap.get(thread._id);
        const hasUnread =
          thread.last_message_sender_type !== 'student' &&
          (!lastReadAt || thread.last_message_at > lastReadAt);

        // Map status to student-friendly label
        let statusLabel = 'Waiting on Career Services';
        if (thread.status === 'WAITING_ON_STUDENT') {
          statusLabel = 'Waiting on you';
        } else if (thread.status === 'RESOLVED') {
          statusLabel = 'Resolved';
        } else if (thread.status === 'ARCHIVED') {
          statusLabel = 'Archived';
        }

        return {
          _id: thread._id,
          subject: thread.subject,
          snippet: thread.snippet,
          status: thread.status,
          statusLabel,
          category: thread.category,
          categoryLabel: thread.category ? CATEGORY_LABELS[thread.category] : undefined,
          assignee,
          message_count: thread.message_count,
          last_message_at: thread.last_message_at,
          last_message_sender_type: thread.last_message_sender_type,
          hasUnread,
          created_at: thread.created_at,
        };
      }),
    );

    return enrichedThreads;
  },
});

/**
 * Get a specific thread with messages (student view)
 */
export const getMyThread = query({
  args: {
    clerkId: v.string(),
    threadId: v.id('inbox_threads'),
  },
  handler: async (ctx, args) => {
    // Auth check
    const student = await requireUniversityStudent(ctx, args.clerkId);

    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Thread not found' });
    }

    // Verify ownership
    if (thread.student_id !== student.userId) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'You do not have access to this thread',
      });
    }

    // Get non-internal messages
    const messages = await ctx.db
      .query('inbox_messages')
      .withIndex('by_thread', (q) => q.eq('thread_id', args.threadId))
      .filter((q) => q.eq(q.field('is_internal'), false))
      .order('asc')
      .collect();

    // Enrich messages with sender info and attachment URLs
    const enrichedMessages = await Promise.all(
      messages.map(async (message) => {
        let senderUser = null;
        if (message.sender_user_id) {
          const sender = await ctx.db.get(message.sender_user_id);
          if (sender) {
            senderUser = {
              _id: sender._id,
              name: sender.name,
              imageUrl: sender.profile_image,
            };
          }
        }

        // Get attachment URLs
        const enrichedAttachments = message.attachments
          ? await Promise.all(
              message.attachments.map(async (att) => {
                let url: string | undefined = att.url;
                if (att.storage_id && !url) {
                  const storageUrl = await ctx.storage.getUrl(att.storage_id);
                  url = storageUrl ?? undefined;
                }
                return {
                  ...att,
                  url,
                };
              }),
            )
          : undefined;

        return {
          _id: message._id,
          body: message.body,
          body_html: message.body_html,
          sender_type: message.sender_type,
          senderUser,
          attachments: enrichedAttachments,
          created_at: message.created_at,
        };
      }),
    );

    // Get assignee info
    let assignee = null;
    if (thread.assigned_to) {
      const advisor = await ctx.db.get(thread.assigned_to);
      if (advisor) {
        assignee = {
          _id: advisor._id,
          name: advisor.name,
          imageUrl: advisor.profile_image,
          title: advisor.job_title,
        };
      }
    }

    // Map status to student-friendly label
    let statusLabel = 'Waiting on Career Services';
    if (thread.status === 'WAITING_ON_STUDENT') {
      statusLabel = 'Waiting on you';
    } else if (thread.status === 'RESOLVED') {
      statusLabel = 'Resolved';
    } else if (thread.status === 'ARCHIVED') {
      statusLabel = 'Archived';
    }

    return {
      thread: {
        _id: thread._id,
        subject: thread.subject,
        status: thread.status,
        statusLabel,
        category: thread.category,
        categoryLabel: thread.category ? CATEGORY_LABELS[thread.category] : undefined,
        assignee,
        message_count: thread.message_count,
        created_at: thread.created_at,
      },
      messages: enrichedMessages,
    };
  },
});

/**
 * Get unread count for student nav badge
 */
export const getUnreadCount = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    // Auth check
    const student = await requireUniversityStudent(ctx, args.clerkId);

    // Get all non-archived threads
    const threads = await ctx.db
      .query('inbox_threads')
      .withIndex('by_student', (q) => q.eq('student_id', student.userId))
      .filter((q) => q.neq(q.field('status'), 'ARCHIVED'))
      .collect();

    // Get read states
    const readStates = await ctx.db
      .query('inbox_read_state')
      .withIndex('by_user_thread', (q) => q.eq('user_id', student.userId))
      .collect();

    const readStateMap = new Map(readStates.map((rs) => [rs.thread_id, rs.last_read_at]));

    // Count threads with unread messages (ignore student's own messages)
    let unreadCount = 0;
    for (const thread of threads) {
      const lastReadAt = readStateMap.get(thread._id);
      if (
        thread.last_message_sender_type !== 'student' &&
        (!lastReadAt || thread.last_message_at > lastReadAt)
      ) {
        unreadCount++;
      }
    }

    return unreadCount;
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new support thread
 */
export const createThread = mutation({
  args: {
    clerkId: v.string(),
    subject: v.string(),
    body: v.string(),
    bodyHtml: v.optional(v.string()),
    category: v.union(
      v.literal('resume_review'),
      v.literal('interview_help'),
      v.literal('job_search'),
      v.literal('appointment'),
      v.literal('general'),
      v.literal('other'),
    ),
    priority: v.optional(v.union(v.literal('P1'), v.literal('P2'), v.literal('P3'))),
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
    const student = await requireUniversityStudent(ctx, args.clerkId);

    // Validate input
    if (!args.subject.trim()) {
      throw new ConvexError({ code: 'VALIDATION_ERROR', message: 'Subject is required' });
    }
    if (!args.body.trim()) {
      throw new ConvexError({ code: 'VALIDATION_ERROR', message: 'Message body is required' });
    }

    // Rate limiting check
    const recentMessages = await ctx.db
      .query('inbox_messages')
      .withIndex('by_university', (q) => q.eq('university_id', student.universityId))
      .filter((q) =>
        q.and(
          q.eq(q.field('sender_user_id'), student.userId),
          q.gt(q.field('created_at'), Date.now() - RATE_LIMIT_WINDOW_MS),
        ),
      )
      .collect();

    if (recentMessages.length >= RATE_LIMIT_MAX_MESSAGES) {
      throw new ConvexError({
        code: 'RATE_LIMITED',
        message: 'You are sending messages too quickly. Please wait a moment.',
      });
    }

    const now = Date.now();
    const priority = args.priority ?? 'P3';

    // Find primary advisor for auto-assignment
    const advisorInfo = await getStudentAdvisor(ctx, student.userId, student.universityId);
    const assignedTo = advisorInfo?.advisorId ?? undefined;

    // Create snippet
    const snippet = args.body.length > 150 ? args.body.slice(0, 147) + '...' : args.body;

    // Create thread
    const threadId = await ctx.db.insert('inbox_threads', {
      university_id: student.universityId,
      student_id: student.userId,
      identity_status: 'matched',
      subject: args.subject.trim(),
      snippet,
      channel: 'in_app',
      category: args.category,
      status: 'NEW',
      assigned_to: assignedTo,
      assigned_at: assignedTo ? now : undefined,
      priority,
      message_count: 1,
      last_message_at: now,
      last_message_sender_type: 'student',
      has_unread: true,
      created_at: now,
      updated_at: now,
    });

    // Create first message
    const messageId = await ctx.db.insert('inbox_messages', {
      thread_id: threadId,
      university_id: student.universityId,
      sender_type: 'student',
      sender_user_id: student.userId,
      body: args.body,
      body_html: args.bodyHtml,
      channel: 'in_app',
      attachments: args.attachments,
      is_internal: false,
      created_at: now,
    });

    // Create thread action log
    await ctx.db.insert('inbox_thread_actions', {
      thread_id: threadId,
      actor_id: student.userId,
      action_type: 'created',
      new_value: {
        category: args.category,
        priority,
        assigned_to: assignedTo,
      },
      created_at: now,
    });

    // Trigger advisor notification
    await ctx.scheduler.runAfter(0, internal.inbox_notifications.notifyNewStudentMessage, {
      threadId,
      messageId,
      studentId: student.userId,
      universityId: student.universityId,
      isNewThread: true,
    });

    // Audit log
    await logUserAction(ctx, {
      action: 'inbox_thread.student_created',
      actorUserId: student.userId,
      actorRole: 'student',
      targetId: threadId,
      targetType: 'inbox_thread',
      studentId: student.userId,
      actorUniversityId: student.universityId,
      metadata: {
        category: args.category,
        hasAttachments: !!(args.attachments && args.attachments.length > 0),
      },
    });

    return { threadId, messageId };
  },
});

/**
 * Send a message to an existing thread
 */
export const sendMessage = mutation({
  args: {
    clerkId: v.string(),
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
    // Auth check
    const student = await requireUniversityStudent(ctx, args.clerkId);

    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Thread not found' });
    }

    // Verify ownership
    if (thread.student_id !== student.userId) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'You do not have access to this thread',
      });
    }

    // Validate input
    if (!args.body.trim()) {
      throw new ConvexError({ code: 'VALIDATION_ERROR', message: 'Message body is required' });
    }

    // Check if thread is archived
    if (thread.status === 'ARCHIVED') {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: 'Cannot send messages to archived threads. Please create a new thread.',
      });
    }

    // Check if thread is resolved - require explicit reopen
    if (thread.status === 'RESOLVED') {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: 'Thread is resolved. Please reopen it before sending a new message.',
      });
    }

    // Rate limiting
    const recentMessages = await ctx.db
      .query('inbox_messages')
      .withIndex('by_university', (q) => q.eq('university_id', student.universityId))
      .filter((q) =>
        q.and(
          q.eq(q.field('sender_user_id'), student.userId),
          q.gt(q.field('created_at'), Date.now() - RATE_LIMIT_WINDOW_MS),
        ),
      )
      .collect();

    if (recentMessages.length >= RATE_LIMIT_MAX_MESSAGES) {
      throw new ConvexError({
        code: 'RATE_LIMITED',
        message: 'You are sending messages too quickly. Please wait a moment.',
      });
    }

    const now = Date.now();

    // Create message
    const messageId = await ctx.db.insert('inbox_messages', {
      thread_id: args.threadId,
      university_id: thread.university_id,
      sender_type: 'student',
      sender_user_id: student.userId,
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

    // Status transition: if waiting on student, move to in progress
    if (thread.status === 'WAITING_ON_STUDENT') {
      await ctx.db.patch(args.threadId, {
        status: 'IN_PROGRESS',
      });

      await ctx.db.insert('inbox_thread_actions', {
        thread_id: args.threadId,
        actor_id: student.userId,
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
      actor_id: student.userId,
      action_type: 'message_added',
      created_at: now,
    });

    // Trigger advisor notification
    await ctx.scheduler.runAfter(0, internal.inbox_notifications.notifyNewStudentMessage, {
      threadId: args.threadId,
      messageId,
      studentId: student.userId,
      universityId: thread.university_id,
      isNewThread: false,
    });

    // Audit log
    await logUserAction(ctx, {
      action: 'inbox_message.student_sent',
      actorUserId: student.userId,
      actorRole: 'student',
      targetId: messageId,
      targetType: 'inbox_message',
      studentId: student.userId,
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
 * Mark thread as read
 */
export const markAsRead = mutation({
  args: {
    clerkId: v.string(),
    threadId: v.id('inbox_threads'),
  },
  handler: async (ctx, args) => {
    // Auth check
    const student = await requireUniversityStudent(ctx, args.clerkId);

    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Thread not found' });
    }

    // Verify ownership
    if (thread.student_id !== student.userId) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'You do not have access to this thread',
      });
    }

    const now = Date.now();

    // Upsert read state
    const existingReadState = await ctx.db
      .query('inbox_read_state')
      .withIndex('by_user_thread', (q) =>
        q.eq('user_id', student.userId).eq('thread_id', args.threadId),
      )
      .first();

    if (existingReadState) {
      await ctx.db.patch(existingReadState._id, {
        last_read_at: now,
        updated_at: now,
      });
    } else {
      await ctx.db.insert('inbox_read_state', {
        thread_id: args.threadId,
        user_id: student.userId,
        last_read_at: now,
        created_at: now,
        updated_at: now,
      });
    }

    return { success: true };
  },
});

/**
 * Mark thread as resolved (student closes the thread)
 */
export const markResolved = mutation({
  args: {
    clerkId: v.string(),
    threadId: v.id('inbox_threads'),
    resolutionNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Auth check
    const student = await requireUniversityStudent(ctx, args.clerkId);

    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Thread not found' });
    }

    // Verify ownership
    if (thread.student_id !== student.userId) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'You do not have access to this thread',
      });
    }

    // Check if already resolved/archived
    if (thread.status === 'RESOLVED' || thread.status === 'ARCHIVED') {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: 'Thread is already resolved',
      });
    }

    const now = Date.now();
    const previousStatus = thread.status;

    // Update thread status
    await ctx.db.patch(args.threadId, {
      status: 'RESOLVED',
      updated_at: now,
      resolved_at: now,
    });

    // Create action log
    await ctx.db.insert('inbox_thread_actions', {
      thread_id: args.threadId,
      actor_id: student.userId,
      action_type: 'status_changed',
      previous_value: { status: previousStatus },
      new_value: { status: 'RESOLVED' },
      notes: args.resolutionNote || 'Resolved by student',
      created_at: now,
    });

    // Audit log
    await logUserAction(ctx, {
      action: 'inbox_thread.student_resolved',
      actorUserId: student.userId,
      actorRole: 'student',
      targetId: args.threadId,
      targetType: 'inbox_thread',
      studentId: student.userId,
      actorUniversityId: thread.university_id,
      metadata: {
        previousStatus,
        resolutionNote: args.resolutionNote,
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
    clerkId: v.string(),
    threadId: v.id('inbox_threads'),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Auth check
    const student = await requireUniversityStudent(ctx, args.clerkId);

    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Thread not found' });
    }

    // Verify ownership
    if (thread.student_id !== student.userId) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'You do not have access to this thread',
      });
    }

    // Check if resolved (can only reopen resolved threads, not archived)
    if (thread.status !== 'RESOLVED') {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: 'Only resolved threads can be reopened',
      });
    }

    // Check if within 30 days of resolution
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const resolutionTime = thread.resolved_at ?? thread.updated_at; // Fallback for existing threads
    if (resolutionTime < thirtyDaysAgo) {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: 'This thread can no longer be reopened. Please create a new thread.',
      });
    }

    const now = Date.now();

    // Update thread status, clear resolved_at
    await ctx.db.patch(args.threadId, {
      status: 'OPEN',
      updated_at: now,
      resolved_at: undefined,
    });

    // Create action log
    await ctx.db.insert('inbox_thread_actions', {
      thread_id: args.threadId,
      actor_id: student.userId,
      action_type: 'reopened',
      previous_value: { status: 'RESOLVED' },
      new_value: { status: 'OPEN' },
      notes: args.reason || 'Reopened by student',
      created_at: now,
    });

    // Audit log
    await logUserAction(ctx, {
      action: 'inbox_thread.student_reopened',
      actorUserId: student.userId,
      actorRole: 'student',
      targetId: args.threadId,
      targetType: 'inbox_thread',
      studentId: student.userId,
      actorUniversityId: thread.university_id,
      metadata: {
        reason: args.reason,
      },
    });

    return { success: true };
  },
});

// ============================================================================
// FILE UPLOAD HELPERS
// ============================================================================

/**
 * Generate upload URL for student file attachments
 */
export const generateUploadUrl = mutation({
  args: {
    clerkId: v.string(),
    mimeType: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    // Auth check
    await requireUniversityStudent(ctx, args.clerkId);

    // Allowed types for student uploads
    const ALLOWED_MIME_TYPES = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png',
      'image/jpeg',
    ];

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(args.mimeType)) {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: 'Invalid file type. Allowed: PDF, Word documents, PNG, and JPEG images.',
      });
    }

    // Validate file size
    if (args.size > MAX_FILE_SIZE) {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: 'File is too large. Maximum size is 10MB.',
      });
    }

    // Generate upload URL
    const uploadUrl = await ctx.storage.generateUploadUrl();
    return uploadUrl;
  },
});
