/**
 * Inbox Notifications Module
 *
 * Handles creating in-app notifications for inbox messages.
 * Called via scheduler when students send messages.
 */

import { v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { internalMutation } from './_generated/server';

/**
 * Notify advisors about a new student message.
 * Called via ctx.scheduler.runAfter() from student message mutations.
 */
export const notifyNewStudentMessage = internalMutation({
  args: {
    threadId: v.id('inbox_threads'),
    messageId: v.id('inbox_messages'),
    studentId: v.id('users'),
    universityId: v.id('universities'),
    isNewThread: v.boolean(),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      console.warn('[inbox_notifications] Thread not found:', args.threadId);
      return { notified: 0 };
    }

    const student = await ctx.db.get(args.studentId);
    if (!student) {
      console.warn('[inbox_notifications] Student not found:', args.studentId);
      return { notified: 0 };
    }

    const studentName = student.name || student.email || 'Student';
    const now = Date.now();

    // Determine recipients
    const recipientIds: Id<'users'>[] = [];

    if (thread.assigned_to) {
      // Notify assigned advisor
      recipientIds.push(thread.assigned_to);
    } else {
      // No assigned advisor - notify all advisors/admins in university
      const advisors = await ctx.db
        .query('users')
        .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
        .filter((q) =>
          q.or(q.eq(q.field('role'), 'advisor'), q.eq(q.field('role'), 'university_admin')),
        )
        .collect();

      for (const advisor of advisors) {
        recipientIds.push(advisor._id);
      }
    }

    if (recipientIds.length === 0) {
      console.warn('[inbox_notifications] No recipients found for university:', args.universityId);
      return { notified: 0 };
    }

    // Create notifications
    const title = args.isNewThread
      ? `New message from ${studentName}`
      : `Reply from ${studentName}`;

    const message = thread.subject || 'New support request';

    for (const userId of recipientIds) {
      await ctx.db.insert('notifications', {
        user_id: userId,
        type: 'inbox_message',
        title,
        message,
        link: `/u/inbox?thread=${args.threadId}`,
        related_id: args.threadId.toString(),
        read: false,
        created_at: now,
      });
    }

    return { notified: recipientIds.length };
  },
});

/**
 * Notify student when advisor replies.
 * Can be used if we want to add email notifications for students.
 */
export const notifyStudentOfReply = internalMutation({
  args: {
    threadId: v.id('inbox_threads'),
    messageId: v.id('inbox_messages'),
    advisorId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread || !thread.student_id) {
      console.warn('[inbox_notifications] Thread or student not found:', args.threadId);
      return { notified: false };
    }

    const advisor = await ctx.db.get(args.advisorId);
    const advisorName = advisor?.name || 'Career Services';
    const now = Date.now();

    // Create notification for student
    await ctx.db.insert('notifications', {
      user_id: thread.student_id,
      type: 'inbox_message',
      title: `Reply from ${advisorName}`,
      message: thread.subject || 'New message in your support thread',
      link: `/student/messages/${args.threadId}`,
      related_id: args.threadId.toString(),
      read: false,
      created_at: now,
    });

    return { notified: true };
  },
});
