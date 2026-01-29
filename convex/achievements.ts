import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { requireSuperAdmin } from './lib/roles';

// Public list of all achievements
export const getAllAchievements = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query('achievements').order('asc').collect();
    return items;
  },
});

// Seed default achievements if none exist
export const seedDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const existing = await ctx.db.query('achievements').order('asc').collect();
    if (existing.length > 0) {
      return { seeded: false, count: existing.length };
    }

    const now = Date.now();
    const defaults = [
      {
        name: 'Welcome Aboard',
        description: 'Log in to Ascentful for the first time.',
        icon: '👋',
        category: 'general',
        points: 10,
        created_at: now,
      },
      {
        name: 'Profile Starter',
        description: 'Complete your basic profile information.',
        icon: '🧑',
        category: 'profile',
        points: 20,
        created_at: now,
      },
      {
        name: 'First Application',
        description: 'Create your first job application entry.',
        icon: '💼',
        category: 'applications',
        points: 25,
        created_at: now,
      },
      {
        name: 'Resume Uploaded',
        description: 'Upload a resume to your library.',
        icon: '📄',
        category: 'resumes',
        points: 25,
        created_at: now,
      },
      {
        name: 'Goal Setter',
        description: 'Create your first goal.',
        icon: '🎯',
        category: 'goals',
        points: 15,
        created_at: now,
      },
    ];

    for (const a of defaults) {
      await ctx.db.insert('achievements', a as any);
    }

    const after = await ctx.db.query('achievements').order('asc').collect();
    return { seeded: true, count: after.length };
  },
});

// Achievements earned by current user
export const getUserAchievements = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }
    if (identity.subject !== args.clerkId) {
      throw new Error('Unauthorized: clerkId mismatch');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();
    if (!user) throw new Error('User not found');

    // No join support, fetch by index then hydrate
    const earned = await ctx.db
      .query('user_achievements')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .order('desc')
      .collect();

    const achievements = await Promise.all(
      earned.map(async (ua: any) => {
        const ach = await ctx.db.get(ua.achievement_id);
        return { ...ua, achievement: ach };
      }),
    );

    return achievements;
  },
});

// Award an achievement to the current user (idempotent)
export const awardAchievement = mutation({
  args: { clerkId: v.string(), achievement_id: v.id('achievements') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }
    if (identity.subject !== args.clerkId) {
      throw new Error('Unauthorized: clerkId mismatch');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();
    if (!user) throw new Error('User not found');

    const ach = await ctx.db.get(args.achievement_id);
    if (!ach) throw new Error('Achievement not found');

    // Enforce uniqueness via composite index
    const existing = await ctx.db
      .query('user_achievements')
      .withIndex('by_user_achievement', (q) =>
        q.eq('user_id', user._id).eq('achievement_id', args.achievement_id),
      )
      .unique();
    if (existing) return existing._id;

    const id = await ctx.db.insert('user_achievements', {
      user_id: user._id,
      achievement_id: args.achievement_id,
      earned_at: Date.now(),
      progress: 100,
    });
    return id;
  },
});
