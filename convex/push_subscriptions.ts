import { v } from 'convex/values';

import { internalMutation, mutation, query } from './_generated/server';
import {
  getAuthenticatedUser,
  assertUserAccess,
  assertUniversityAccess,
} from './lib/authorization';

/**
 * Push Notification Subscriptions Management
 *
 * Manages Web Push subscriptions for users to receive mobile/browser
 * notifications for signals and other important events.
 */

// Subscription validator
const pushSubscriptionValidator = v.object({
  endpoint: v.string(),
  expirationTime: v.optional(v.union(v.number(), v.null())),
  keys: v.object({
    p256dh: v.string(),
    auth: v.string(),
  }),
});

/**
 * Subscribe a user to push notifications
 */
export const subscribe = mutation({
  args: {
    userId: v.id('users'),
    subscription: pushSubscriptionValidator,
    deviceInfo: v.optional(
      v.object({
        userAgent: v.optional(v.string()),
        platform: v.optional(v.string()),
        deviceName: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    // Authorization: Verify caller can manage this user's subscriptions
    const actingUser = await getAuthenticatedUser(ctx);
    await assertUserAccess(ctx, actingUser, args.userId);

    const { userId, subscription, deviceInfo } = args;

    // Get user to extract university_id for efficient bulk queries
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const universityId = user.university_id;

    // Check if this endpoint already exists
    const existing = await ctx.db
      .query('push_subscriptions')
      .withIndex('by_endpoint', (q) => q.eq('endpoint', subscription.endpoint))
      .first();

    if (existing) {
      // Verify the acting user owns this subscription
      if (existing.user_id !== userId) {
        throw new Error('Subscription endpoint already registered to another user');
      }

      // Update existing subscription (including university_id in case it changed)
      // Reset failure_count to avoid immediate re-deactivation after previous failures
      await ctx.db.patch(existing._id, {
        subscription,
        device_info: deviceInfo,
        university_id: universityId,
        updated_at: Date.now(),
        is_active: true,
        failure_count: 0,
      });
      return existing._id;
    }

    // Create new subscription
    const subscriptionId = await ctx.db.insert('push_subscriptions', {
      user_id: userId,
      endpoint: subscription.endpoint,
      subscription,
      device_info: deviceInfo,
      university_id: universityId,
      is_active: true,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    return subscriptionId;
  },
});

/**
 * Unsubscribe from push notifications
 *
 * Returns:
 * - { success: true } - Subscription was successfully deactivated
 * - { success: false, reason: 'not_found' } - No subscription with this endpoint exists
 * - { success: false, reason: 'not_owned' } - Subscription belongs to another user
 * - { success: false, reason: 'already_inactive' } - Subscription was already inactive
 */
export const unsubscribe = mutation({
  args: {
    endpoint: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify the caller is authenticated
    const actingUser = await getAuthenticatedUser(ctx);

    const existing = await ctx.db
      .query('push_subscriptions')
      .withIndex('by_endpoint', (q) => q.eq('endpoint', args.endpoint))
      .first();

    if (!existing) {
      return { success: false, reason: 'not_found' as const };
    }

    if (existing.user_id !== actingUser._id) {
      return { success: false, reason: 'not_owned' as const };
    }

    if (!existing.is_active) {
      return { success: false, reason: 'already_inactive' as const };
    }

    await ctx.db.patch(existing._id, {
      is_active: false,
      updated_at: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Get all active subscriptions for a user
 */
export const getUserSubscriptions = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    // Authorization: Verify caller can access this user's data
    const actingUser = await getAuthenticatedUser(ctx);
    await assertUserAccess(ctx, actingUser, args.userId);

    return await ctx.db
      .query('push_subscriptions')
      .withIndex('by_user_id', (q) => q.eq('user_id', args.userId))
      .filter((q) => q.eq(q.field('is_active'), true))
      .collect();
  },
});

/**
 * Check if a user has any active push subscriptions
 */
export const hasActiveSubscription = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    // Authorization: Verify caller can access this user's data
    const actingUser = await getAuthenticatedUser(ctx);
    await assertUserAccess(ctx, actingUser, args.userId);

    const subscription = await ctx.db
      .query('push_subscriptions')
      .withIndex('by_user_id', (q) => q.eq('user_id', args.userId))
      .filter((q) => q.eq(q.field('is_active'), true))
      .first();

    return !!subscription;
  },
});

/**
 * Get subscriptions for advisors of a university (for signal notifications)
 */
export const getUniversityAdvisorSubscriptions = query({
  args: {
    universityId: v.id('universities'),
  },
  handler: async (ctx, args) => {
    // Authorization: Verify caller can access this university's data
    const actingUser = await getAuthenticatedUser(ctx);
    assertUniversityAccess(actingUser, args.universityId);

    // Get all advisors and university_admins for this university
    // Get advisor/admin user IDs for filtering
    const advisors = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .filter((q) =>
        q.or(q.eq(q.field('role'), 'advisor'), q.eq(q.field('role'), 'university_admin')),
      )
      .collect();

    const advisorIds = new Set(advisors.map((a) => a._id));

    // Batch query: Get all active subscriptions for this university in O(1)
    const allUniversitySubs = await ctx.db
      .query('push_subscriptions')
      .withIndex('by_university_active', (q) =>
        q.eq('university_id', args.universityId).eq('is_active', true),
      )
      .collect();

    // Filter to only advisor/admin subscriptions
    const subscriptions = allUniversitySubs
      .filter((sub) => advisorIds.has(sub.user_id))
      .map((sub) => ({
        user_id: sub.user_id,
        subscription: sub.subscription,
      }));

    return subscriptions;
  },
});

/**
 * Mark a subscription as failed (after delivery failure)
 */
export const markSubscriptionFailed = internalMutation({
  args: {
    endpoint: v.string(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query('push_subscriptions')
      .withIndex('by_endpoint', (q) => q.eq('endpoint', args.endpoint))
      .first();

    if (subscription) {
      const failureCount = (subscription.failure_count || 0) + 1;

      // Deactivate after 3 failures
      if (failureCount >= 3) {
        await ctx.db.patch(subscription._id, {
          is_active: false,
          failure_count: failureCount,
          last_failure_at: Date.now(),
          last_failure_reason: args.error,
          updated_at: Date.now(),
        });
      } else {
        await ctx.db.patch(subscription._id, {
          failure_count: failureCount,
          last_failure_at: Date.now(),
          last_failure_reason: args.error,
          updated_at: Date.now(),
        });
      }
    }
  },
});

/**
 * Update notification preferences for push
 */
export const updatePushPreferences = mutation({
  args: {
    userId: v.id('users'),
    preferences: v.object({
      signals_urgent: v.optional(v.boolean()),
      signals_high: v.optional(v.boolean()),
      signals_medium: v.optional(v.boolean()),
      signals_low: v.optional(v.boolean()),
      daily_digest: v.optional(v.boolean()),
      application_updates: v.optional(v.boolean()),
      goal_reminders: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    // Authorization: Verify caller can manage this user's preferences
    const actingUser = await getAuthenticatedUser(ctx);
    await assertUserAccess(ctx, actingUser, args.userId);

    const { userId, preferences } = args;

    // Get or create user preferences
    const existing = await ctx.db
      .query('user_notification_preferences')
      .withIndex('by_user_id', (q) => q.eq('user_id', userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        push_preferences: {
          ...existing.push_preferences,
          ...preferences,
        },
        updated_at: Date.now(),
      });
    } else {
      await ctx.db.insert('user_notification_preferences', {
        user_id: userId,
        email_preferences: {
          signals_urgent: true,
          signals_high: true,
          daily_digest: true,
        },
        push_preferences: {
          signals_urgent: true,
          signals_high: true,
          signals_medium: true,
          signals_low: false,
          daily_digest: false,
          application_updates: true,
          goal_reminders: true,
          ...preferences,
        },
        created_at: Date.now(),
        updated_at: Date.now(),
      });
    }

    return { success: true };
  },
});

/**
 * Get user's push notification preferences
 */
export const getPushPreferences = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    // Authorization: Verify caller can access this user's preferences
    const actingUser = await getAuthenticatedUser(ctx);
    await assertUserAccess(ctx, actingUser, args.userId);

    const prefs = await ctx.db
      .query('user_notification_preferences')
      .withIndex('by_user_id', (q) => q.eq('user_id', args.userId))
      .first();

    if (!prefs) {
      return {
        signals_urgent: true,
        signals_high: true,
        signals_medium: true,
        signals_low: false,
        daily_digest: false,
        application_updates: true,
        goal_reminders: true,
      };
    }

    return (
      prefs.push_preferences || {
        signals_urgent: true,
        signals_high: true,
        signals_medium: true,
        signals_low: false,
        daily_digest: false,
        application_updates: true,
        goal_reminders: true,
      }
    );
  },
});
