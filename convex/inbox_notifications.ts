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

    // Tenant consistency checks - prevent data leaks from bad scheduler payloads
    if (
      thread.university_id !== args.universityId ||
      (thread.student_id && thread.student_id !== args.studentId)
    ) {
      console.warn('[inbox_notifications] Thread/student university mismatch:', args.threadId);
      return { notified: 0 };
    }
    if (student.university_id !== args.universityId) {
      console.warn('[inbox_notifications] Student university mismatch:', args.studentId);
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

/**
 * Notify users who are @mentioned in an internal thread.
 * Called via ctx.scheduler.runAfter() when mentions are created.
 */
export const notifyMentionedUsers = internalMutation({
  args: {
    threadId: v.id('inbox_threads'),
    messageId: v.id('inbox_messages'),
    mentionedUserIds: v.array(v.id('users')),
    mentionedById: v.id('users'),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      console.warn('[inbox_notifications] Thread not found:', args.threadId);
      return { notified: 0 };
    }

    const mentioner = await ctx.db.get(args.mentionedById);
    const mentionerName = mentioner?.name || mentioner?.email || 'An advisor';
    const now = Date.now();

    // Get student info if thread references a student
    let studentContext = '';
    if (thread.referenced_student_id) {
      const student = await ctx.db.get(thread.referenced_student_id);
      if (student) {
        studentContext = ` about ${student.name || student.email || 'a student'}`;
      }
    }

    const mentionedUsers = await Promise.all(args.mentionedUserIds.map((id) => ctx.db.get(id)));

    let notifiedCount = 0;
    // Create notifications for each mentioned user (tenant-scoped)
    for (const user of mentionedUsers) {
      if (!user) continue;
      // Validate user belongs to the same university as the thread
      if (user.university_id !== thread.university_id) continue;
      // Only notify staff roles who can access internal threads
      if (!['advisor', 'university_admin', 'super_admin'].includes(user.role)) continue;
      // Don't notify the person who made the mention
      if (user._id === args.mentionedById) continue;

      await ctx.db.insert('notifications', {
        user_id: user._id,
        type: 'inbox_mention',
        title: `${mentionerName} mentioned you`,
        message: `You were mentioned in an internal thread${studentContext}: "${thread.subject}"`,
        link: `/u/inbox?thread=${args.threadId}`,
        related_id: args.threadId.toString(),
        read: false,
        created_at: now,
      });
      notifiedCount++;
    }

    return { notified: notifiedCount };
  },
});
