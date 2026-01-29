/**
 * Feature Flags System
 *
 * Manages feature flags stored in platform_settings table
 * Flags control rollout of advisor features
 */

import { v } from 'convex/values';

import { internalMutation, mutation, query } from './_generated/server';
import { ADVISOR_FLAGS } from './constants/advisor_flags';
import { getAuthenticatedUser } from './lib/authorization';

/**
 * Get feature flag value
 * Returns boolean - defaults to false if not set
 */
export const getFeatureFlag = query({
  args: {
    flag: v.string(),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);
    const setting = await ctx.db
      .query('platform_settings')
      .withIndex('by_setting_key', (q) => q.eq('setting_key', args.flag))
      .unique();

    if (!setting) {
      return false; // Default to disabled
    }

    return setting.setting_value === true;
  },
});

/**
 * Get multiple feature flags at once
 * Returns map of flag -> boolean
 *
 * Optimized: Fetches all settings in one query to avoid N+1 pattern
 */
export const getFeatureFlags = query({
  args: {
    flags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);
    // Fetch all settings in a single query
    const allSettings = await ctx.db.query('platform_settings').collect();

    // Create map for O(1) lookups
    const settingsMap = new Map(allSettings.map((s) => [s.setting_key, s.setting_value === true]));

    // Build results with requested flags only
    const results: Record<string, boolean> = {};
    for (const flag of args.flags) {
      results[flag] = settingsMap.get(flag) ?? false; // Default to false if not found
    }

    return results;
  },
});

/**
 * Set feature flag value (admin only)
 */
export const setFeatureFlag = mutation({
  args: {
    flag: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // Get current user
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    // Only super_admin can change feature flags
    if (user.role !== 'super_admin') {
      throw new Error('Unauthorized: Only super admins can modify feature flags');
    }

    const now = Date.now();

    // Check if setting exists
    const existing = await ctx.db
      .query('platform_settings')
      .withIndex('by_setting_key', (q) => q.eq('setting_key', args.flag))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        setting_value: args.enabled,
        updated_at: now,
      });
    } else {
      await ctx.db.insert('platform_settings', {
        setting_key: args.flag,
        setting_value: args.enabled,
        created_at: now,
        updated_at: now,
      });
    }

    return { success: true, flag: args.flag, enabled: args.enabled };
  },
});

/**
 * Initialize default advisor feature flags (internal use only)
 */
export const initializeAdvisorFlags = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let newlyInitialized = 0;

    // Batch fetch all existing settings to avoid N+1 queries
    const existingSettings = await ctx.db.query('platform_settings').collect();

    const existingMap = new Map(existingSettings.map((s) => [s.setting_key, s.setting_value]));

    for (const flagKey of ADVISOR_FLAGS) {
      if (!existingMap.has(flagKey)) {
        await ctx.db.insert('platform_settings', {
          setting_key: flagKey,
          setting_value: false,
          created_at: now,
          updated_at: now,
        });
        newlyInitialized++;
        console.log(`✓ Initialized flag: ${flagKey} = false`);
      } else {
        const existingValue = existingMap.get(flagKey);
        console.log(`✓ Flag already exists: ${flagKey} = ${existingValue}`);
      }
    }

    return { success: true, flagsInitialized: newlyInitialized };
  },
});

/**
 * List all advisor feature flags (admin only)
 */
export const listAdvisorFeatureFlags = query({
  args: {},
  handler: async (ctx) => {
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

    if (user.role !== 'super_admin') {
      throw new Error('Unauthorized: Only super admins can view all feature flags');
    }

    const allFlags = await ctx.db.query('platform_settings').collect();

    return allFlags
      .filter((f) => f.setting_key.startsWith('advisor.'))
      .map((f) => ({
        flag: f.setting_key,
        enabled: f.setting_value === true,
        updatedAt: f.updated_at,
      }))
      .sort((a, b) => a.flag.localeCompare(b.flag));
  },
});
