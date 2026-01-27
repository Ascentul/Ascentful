/**
 * Avatar upload and management functions
 */

import { v } from 'convex/values';

import { mutation, query } from './_generated/server';

/**
 * Generate an upload URL for avatar image
 * This allows the client to upload directly to Convex storage
 */
export const generateAvatarUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Update user's profile image after successful upload
 * Stores the permanent storageId instead of temporary URL
 */
export const updateUserAvatar = mutation({
  args: {
    clerkId: v.string(),
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }

    const actor = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!actor) {
      throw new Error('Unauthorized');
    }

    if (actor.clerkId !== args.clerkId && actor.role !== 'super_admin') {
      throw new Error('Unauthorized');
    }

    // Find user by Clerk ID
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    // Verify the storage ID is valid
    const imageUrl = await ctx.storage.getUrl(args.storageId);
    if (!imageUrl) {
      throw new Error('Invalid storage ID');
    }

    // Store the permanent storageId (not the temporary URL)
    // This ensures the image persists indefinitely
    await ctx.db.patch(user._id, {
      profile_image: args.storageId,
      updated_at: Date.now(),
    });

    return {
      success: true,
      storageId: args.storageId,
      imageUrl, // Return URL for immediate display
    };
  },
});

/**
 * Get user's profile image URL from storage ID
 * This converts the permanent storage ID to a temporary URL for display
 */
export const getUserProfileImageUrl = query({
  args: {
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId);
    return url;
  },
});

/**
 * Update user's cover image after successful upload
 * Stores the permanent storageId instead of temporary URL
 */
export const updateUserCoverImage = mutation({
  args: {
    clerkId: v.string(),
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }

    const actor = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!actor) {
      throw new Error('Unauthorized');
    }

    if (actor.clerkId !== args.clerkId && actor.role !== 'super_admin') {
      throw new Error('Unauthorized');
    }

    // Find user by Clerk ID
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    // Verify the storage ID is valid
    const imageUrl = await ctx.storage.getUrl(args.storageId);
    if (!imageUrl) {
      throw new Error('Invalid storage ID');
    }

    // Store the permanent storageId
    await ctx.db.patch(user._id, {
      cover_image: args.storageId,
      updated_at: Date.now(),
    });

    return {
      success: true,
      storageId: args.storageId,
      imageUrl,
    };
  },
});

/**
 * Delete user's avatar and revert to default
 */
export const deleteUserAvatar = mutation({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }

    const actor = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!actor) {
      throw new Error('Unauthorized');
    }

    if (actor.clerkId !== args.clerkId && actor.role !== 'super_admin') {
      throw new Error('Unauthorized');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    // Clear profile image
    await ctx.db.patch(user._id, {
      profile_image: undefined,
      updated_at: Date.now(),
    });

    return { success: true };
  },
});
