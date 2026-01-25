/**
 * Signal Notifications Module
 *
 * Handles creating in-app notifications and triggering email alerts
 * when signals are created or need advisor attention.
 */

import { v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import {
  getAuthenticatedUser,
  assertUserAccess,
  assertUniversityAccess,
} from './lib/authorization';

// ============================================================================
// NOTIFICATION CREATION
// ============================================================================

/**
 * Create an in-app notification for a signal.
 * Called when a new signal is created.
 */
export const createSignalNotification = internalMutation({
  args: {
    signalId: v.id('signals'),
    userId: v.id('users'),
    priority: v.union(
      v.literal('low'),
      v.literal('medium'),
      v.literal('high'),
      v.literal('urgent'),
    ),
    studentName: v.string(),
    signalTitle: v.string(),
    signalDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const notificationType = args.priority === 'urgent' ? 'signal_urgent' : 'signal';

    const notificationId = await ctx.db.insert('notifications', {
      user_id: args.userId,
      type: notificationType,
      title: `${args.priority === 'urgent' ? '🚨 ' : ''}Signal: ${args.studentName}`,
      message: args.signalTitle + (args.signalDescription ? ` - ${args.signalDescription}` : ''),
      link: `/advisor/queue`,
      related_id: args.signalId,
      read: false,
      created_at: now,
    });

    return notificationId;
  },
});

/**
 * Create notifications for multiple advisors when a signal is created.
 */
export const notifyAdvisorsForSignal = internalMutation({
  args: {
    signalId: v.id('signals'),
    studentId: v.id('users'),
    universityId: v.id('universities'),
    priority: v.union(
      v.literal('low'),
      v.literal('medium'),
      v.literal('high'),
      v.literal('urgent'),
    ),
    signalTitle: v.string(),
    signalDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get student info with tenant isolation check
    const student = await ctx.db.get(args.studentId);
    if (!student || student.role !== 'student' || student.university_id !== args.universityId) {
      throw new Error('Student not found in university');
    }

    const studentName = student.name || student.email || 'Unknown Student';

    // Check university settings for in-app notification preference
    const university = await ctx.db.get(args.universityId);
    const settings = university?.settings as Record<string, unknown> | undefined;
    const signalNotificationSettings = settings?.signal_notifications as
      | Record<string, unknown>
      | undefined;
    const inAppEnabled = signalNotificationSettings?.in_app_enabled ?? true;

    // Get advisors assigned to this student (scoped to university for tenant isolation)
    const advisorAssignments = await ctx.db
      .query('student_advisors')
      .withIndex('by_student', (q) =>
        q.eq('student_id', args.studentId).eq('university_id', args.universityId),
      )
      .collect();

    // Get university admins as fallback
    const universityAdmins = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .filter((q) =>
        q.or(q.eq(q.field('role'), 'university_admin'), q.eq(q.field('role'), 'advisor')),
      )
      .collect();

    // Combine and dedupe recipients
    const recipientIds = new Set<string>();

    // Add assigned advisors
    for (const assignment of advisorAssignments) {
      recipientIds.add(assignment.advisor_id);
    }

    // If no advisors assigned, notify all university admins/advisors
    if (recipientIds.size === 0) {
      for (const admin of universityAdmins) {
        recipientIds.add(admin._id);
      }
    }

    // Create notifications for each recipient (if in-app notifications enabled)
    let notified = 0;
    const now = Date.now();
    const notificationType = args.priority === 'urgent' ? 'signal_urgent' : 'signal';

    if (inAppEnabled) {
      for (const recipientId of recipientIds) {
        await ctx.db.insert('notifications', {
          user_id: recipientId as Id<'users'>,
          type: notificationType,
          title: `${args.priority === 'urgent' ? '🚨 ' : args.priority === 'high' ? '⚠️ ' : ''}Signal: ${studentName}`,
          message:
            args.signalTitle + (args.signalDescription ? ` - ${args.signalDescription}` : ''),
          link: `/advisor/queue`,
          related_id: args.signalId,
          read: false,
          created_at: now,
        });
        notified++;
      }
    }

    // Return info for email notification (handled by Next.js API)
    const recipientUsers = await Promise.all(
      Array.from(recipientIds).map((id) => ctx.db.get(id as Id<'users'>)),
    );

    return {
      notified,
      recipients: recipientUsers
        .filter((u) => u !== null && u.email)
        .map((u) => ({
          id: u!._id,
          email: u!.email,
          name: u!.name,
        })),
      studentName,
    };
  },
});

// ============================================================================
// NOTIFICATION PREFERENCES
// ============================================================================

/**
 * Get signal notification preferences for a university.
 */
export const getNotificationPreferences = query({
  args: {
    universityId: v.id('universities'),
  },
  handler: async (ctx, args) => {
    // Authorization: Verify caller can access this university's data
    const actingUser = await getAuthenticatedUser(ctx);
    assertUniversityAccess(actingUser, args.universityId);

    const university = await ctx.db.get(args.universityId);
    if (!university) {
      return null;
    }

    const settings = university.settings as Record<string, unknown> | undefined;
    const signalNotifications = settings?.signal_notifications as
      | Record<string, unknown>
      | undefined;

    // Default preferences
    return {
      emailEnabled: signalNotifications?.email_enabled ?? true,
      emailForPriorities: signalNotifications?.email_for_priorities ?? ['urgent', 'high'],
      digestEnabled: signalNotifications?.digest_enabled ?? true,
      digestFrequency: signalNotifications?.digest_frequency ?? 'daily',
      inAppEnabled: signalNotifications?.in_app_enabled ?? true,
    };
  },
});

/**
 * Update signal notification preferences for a university.
 */
export const updateNotificationPreferences = mutation({
  args: {
    universityId: v.id('universities'),
    preferences: v.object({
      emailEnabled: v.boolean(),
      emailForPriorities: v.array(
        v.union(v.literal('low'), v.literal('medium'), v.literal('high'), v.literal('urgent')),
      ),
      digestEnabled: v.boolean(),
      digestFrequency: v.union(v.literal('daily'), v.literal('weekly'), v.literal('never')),
      inAppEnabled: v.boolean(),
    }),
  },
  handler: async (ctx, args) => {
    // Authorization: Verify caller can manage this university's settings
    const actingUser = await getAuthenticatedUser(ctx);
    assertUniversityAccess(actingUser, args.universityId);

    // Only admins can update university-wide notification preferences
    if (actingUser.role !== 'super_admin' && actingUser.role !== 'university_admin') {
      throw new Error('Unauthorized: Admin access required');
    }

    const university = await ctx.db.get(args.universityId);
    if (!university) {
      throw new Error('University not found');
    }

    const existingSettings = (university.settings || {}) as Record<string, unknown>;

    await ctx.db.patch(args.universityId, {
      settings: {
        ...existingSettings,
        signal_notifications: {
          email_enabled: args.preferences.emailEnabled,
          email_for_priorities: args.preferences.emailForPriorities,
          digest_enabled: args.preferences.digestEnabled,
          digest_frequency: args.preferences.digestFrequency,
          in_app_enabled: args.preferences.inAppEnabled,
        },
      },
      updated_at: Date.now(),
    });

    return { success: true };
  },
});

// ============================================================================
// DIGEST GENERATION
// ============================================================================

/**
 * Get signal digest data for email.
 * Called by cron job to generate daily/weekly digests.
 * Internal query - no auth required since cron jobs run in system context.
 */
export const getSignalDigestData = internalQuery({
  args: {
    universityId: v.id('universities'),
  },
  handler: async (ctx, args) => {
    // Get all active signals
    const activeSignals = await ctx.db
      .query('signals')
      .withIndex('by_university_status', (q) =>
        q.eq('university_id', args.universityId).eq('status', 'active'),
      )
      .collect();

    // Count by priority
    const summary = {
      urgent: activeSignals.filter((s) => s.priority === 'urgent').length,
      high: activeSignals.filter((s) => s.priority === 'high').length,
      medium: activeSignals.filter((s) => s.priority === 'medium').length,
      low: activeSignals.filter((s) => s.priority === 'low').length,
      total: activeSignals.length,
    };

    // Get top signals (sorted by priority and recency)
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    const sortedSignals = activeSignals.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.triggered_at - a.triggered_at;
    });

    // Batch fetch all students for top signals (avoids N+1 queries)
    const top10Signals = sortedSignals.slice(0, 10);
    const students = await Promise.all(top10Signals.map((signal) => ctx.db.get(signal.student_id)));
    const studentMap = new Map(
      students.filter((s): s is NonNullable<typeof s> => s !== null).map((s) => [s._id, s]),
    );

    const topSignals = top10Signals.map((signal) => {
      const student = studentMap.get(signal.student_id);
      return {
        studentName: student?.name || student?.email || 'Unknown',
        title: signal.title,
        priority: signal.priority,
      };
    });

    // Get advisors to send digest to
    const advisors = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .filter((q) =>
        q.or(q.eq(q.field('role'), 'university_admin'), q.eq(q.field('role'), 'advisor')),
      )
      .collect();

    return {
      summary,
      topSignals,
      advisors: advisors.map((a) => ({
        id: a._id,
        email: a.email,
        name: a.name,
      })),
    };
  },
});

// ============================================================================
// NOTIFICATION QUERIES
// ============================================================================

/**
 * Get unread signal notifications for a user.
 */
export const getUnreadSignalNotifications = query({
  args: {
    userId: v.id('users'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Authorization: Verify caller can access this user's notifications
    const actingUser = await getAuthenticatedUser(ctx);
    await assertUserAccess(ctx, actingUser, args.userId);

    const limit = args.limit ?? 20;

    // Fetch all unread notifications, then filter by type and apply limit
    // This ensures we return up to `limit` signal notifications even if
    // there are many non-signal notifications mixed in
    const notifications = await ctx.db
      .query('notifications')
      .withIndex('by_user_read', (q) => q.eq('user_id', args.userId).eq('read', false))
      .order('desc')
      .collect();

    // Filter to only signal notifications and apply limit
    return notifications
      .filter((n) => n.type === 'signal' || n.type === 'signal_urgent')
      .slice(0, limit);
  },
});

/**
 * Mark signal notifications as read.
 */
export const markSignalNotificationsRead = mutation({
  args: {
    userId: v.id('users'),
    notificationIds: v.optional(v.array(v.id('notifications'))),
  },
  handler: async (ctx, args) => {
    // Authorization: Verify caller can manage this user's notifications
    const actingUser = await getAuthenticatedUser(ctx);
    await assertUserAccess(ctx, actingUser, args.userId);

    const now = Date.now();

    if (args.notificationIds && args.notificationIds.length > 0) {
      // Mark specific signal notifications as read
      for (const id of args.notificationIds) {
        const notification = await ctx.db.get(id);
        if (
          notification &&
          notification.user_id === args.userId &&
          (notification.type === 'signal' || notification.type === 'signal_urgent')
        ) {
          await ctx.db.patch(id, { read: true, read_at: now });
        }
      }
    } else {
      // Mark all signal notifications as read
      const unreadSignals = await ctx.db
        .query('notifications')
        .withIndex('by_user_read', (q) => q.eq('user_id', args.userId).eq('read', false))
        .collect();

      for (const notification of unreadSignals) {
        if (notification.type === 'signal' || notification.type === 'signal_urgent') {
          await ctx.db.patch(notification._id, { read: true, read_at: now });
        }
      }
    }

    return { success: true };
  },
});
