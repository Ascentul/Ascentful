import { v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { internalMutation, mutation, query } from './_generated/server';
import { getAuthenticatedUser } from './lib/roles';

// Get notifications for a user
export const getNotifications = query({
  args: {
    unreadOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Use authenticated user to prevent clerkId spoofing
    const user = await getAuthenticatedUser(ctx);

    // Use database-level sorting and filtering for better performance
    let query = ctx.db
      .query('notifications')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .order('desc');

    if (args.unreadOnly) {
      query = ctx.db
        .query('notifications')
        .withIndex('by_user_read', (q) => q.eq('user_id', user._id).eq('read', false))
        .order('desc');
    }

    const notifications = await query.take(50);

    return notifications;
  },
});

// Get unread notification count
export const getUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    // Use authenticated user to prevent clerkId spoofing
    const user = await getAuthenticatedUser(ctx);

    const unreadNotifications = await ctx.db
      .query('notifications')
      .withIndex('by_user_read', (q) => q.eq('user_id', user._id).eq('read', false))
      .collect();

    return unreadNotifications.length;
  },
});

// Mark notification as read
export const markAsRead = mutation({
  args: {
    notificationId: v.id('notifications'),
  },
  handler: async (ctx, args) => {
    // Use authenticated user to prevent clerkId spoofing
    const user = await getAuthenticatedUser(ctx);

    const notification = await ctx.db.get(args.notificationId);
    if (!notification) throw new Error('Notification not found');

    // Verify notification belongs to user
    if (notification.user_id !== user._id) {
      throw new Error('Unauthorized');
    }

    await ctx.db.patch(args.notificationId, {
      read: true,
      read_at: Date.now(),
    });

    return await ctx.db.get(args.notificationId);
  },
});

// Mark all notifications as read
export const markAllAsRead = mutation({
  args: {},
  handler: async (ctx) => {
    // Use authenticated user to prevent clerkId spoofing
    const user = await getAuthenticatedUser(ctx);

    const unreadNotifications = await ctx.db
      .query('notifications')
      .withIndex('by_user_read', (q) => q.eq('user_id', user._id).eq('read', false))
      .collect();

    const now = Date.now();
    await Promise.all(
      unreadNotifications.map((notification) =>
        ctx.db.patch(notification._id, {
          read: true,
          read_at: now,
        }),
      ),
    );

    return { count: unreadNotifications.length };
  },
});

// Create a notification (internal use only - server-side code only)
export const createNotification = internalMutation({
  args: {
    user_id: v.id('users'),
    type: v.union(
      v.literal('support_ticket'),
      v.literal('ticket_update'),
      v.literal('application_update'),
      v.literal('goal_reminder'),
      v.literal('system'),
      v.literal('signal'),
      v.literal('signal_urgent'),
    ),
    title: v.string(),
    message: v.string(),
    link: v.optional(v.string()),
    related_id: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify user exists
    const user = await ctx.db.get(args.user_id);
    if (!user) {
      throw new Error('User not found');
    }

    const notificationId = await ctx.db.insert('notifications', {
      user_id: args.user_id,
      type: args.type,
      title: args.title,
      message: args.message,
      link: args.link,
      related_id: args.related_id,
      read: false,
      read_at: undefined,
      created_at: Date.now(),
    });

    return await ctx.db.get(notificationId);
  },
});

// Delete a notification
export const deleteNotification = mutation({
  args: {
    notificationId: v.id('notifications'),
  },
  handler: async (ctx, args) => {
    // Use authenticated user to prevent clerkId spoofing
    const user = await getAuthenticatedUser(ctx);

    const notification = await ctx.db.get(args.notificationId);
    if (!notification) throw new Error('Notification not found');

    // Verify notification belongs to user
    if (notification.user_id !== user._id) {
      throw new Error('Unauthorized');
    }

    await ctx.db.delete(args.notificationId);
    return { success: true };
  },
});

// Clear all read notifications
export const clearReadNotifications = mutation({
  args: {},
  handler: async (ctx) => {
    // Use authenticated user to ensure the caller can only clear their own notifications
    const user = await getAuthenticatedUser(ctx);

    const readNotifications = await ctx.db
      .query('notifications')
      .withIndex('by_user_read', (q) => q.eq('user_id', user._id).eq('read', true))
      .collect();

    await Promise.all(readNotifications.map((notification) => ctx.db.delete(notification._id)));

    return { count: readNotifications.length };
  },
});
