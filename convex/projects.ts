import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { requireMembership } from './lib/roles';

// Get projects for a user
export const getUserProjects = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    // Note: We don't require membership for read queries - users can always view their own projects
    // Membership is only used for write operations and tenant isolation

    // OPTIMIZED: Add limit to prevent bandwidth issues
    const projects = await ctx.db
      .query('projects')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .order('desc')
      .take(100); // Limit to 100 most recent projects

    // Resolve storage IDs to URLs for image display
    const projectsWithImageUrls = await Promise.all(
      projects.map(async (project) => {
        if (project.image_storage_id) {
          const imageUrl = await ctx.storage.getUrl(project.image_storage_id);
          return {
            ...project,
            // Prefer storage URL, fallback to legacy base64
            image_url: imageUrl || project.image_url,
          };
        }
        return project;
      }),
    );

    return projectsWithImageUrls;
  },
});

// Generate upload URL for project images
export const generateProjectImageUploadUrl = mutation({
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

// Update project image with storage ID after upload
export const updateProjectImage = mutation({
  args: {
    clerkId: v.string(),
    projectId: v.id('projects'),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    const project = await ctx.db.get(args.projectId);
    if (!project || project.user_id !== user._id) {
      throw new Error('Project not found or unauthorized');
    }

    // Verify the storage ID is valid
    const imageUrl = await ctx.storage.getUrl(args.storageId);
    if (!imageUrl) {
      throw new Error('Invalid storage ID');
    }

    // Clean up old storage file if a previous upload exists
    if (project.image_storage_id) {
      await ctx.storage.delete(project.image_storage_id);
    }

    // Update with storage ID and clear legacy image_url
    await ctx.db.patch(args.projectId, {
      image_storage_id: args.storageId,
      image_url: undefined, // Clear legacy base64 data
      updated_at: Date.now(),
    });

    return {
      success: true,
      storageId: args.storageId,
      imageUrl, // Return URL for immediate display
    };
  },
});

// Create a new project
export const createProject = mutation({
  args: {
    clerkId: v.string(),
    title: v.string(),
    role: v.optional(v.string()),
    start_date: v.optional(v.number()),
    end_date: v.optional(v.number()),
    company: v.optional(v.string()),
    url: v.optional(v.string()),
    github_url: v.optional(v.string()),
    description: v.optional(v.string()),
    type: v.string(),
    image_url: v.optional(v.string()), // Legacy: base64 data URL
    image_storage_id: v.optional(v.id('_storage')), // Preferred: Convex storage ID
    technologies: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    const membership =
      user.role === 'student'
        ? (await requireMembership(ctx, { role: 'student' })).membership
        : null;

    // Validate storage ID if provided
    if (args.image_storage_id) {
      const imageUrl = await ctx.storage.getUrl(args.image_storage_id);
      if (!imageUrl) {
        throw new Error('Invalid storage ID');
      }
    }

    // ARCHITECTURE NOTE: Free plan limits are enforced at the FRONTEND layer
    // - Clerk Billing (publicMetadata) is the source of truth for subscriptions
    // - Frontend enforces via useSubscription() hook + Clerk's has() method
    // - Backend subscription_plan is cached display data only (see CLAUDE.md)
    // - Defense-in-depth: Consider adding hasPremium arg from frontend for backend validation

    // if (user.subscription_plan === "free") {
    //   const existingProjects = await ctx.db
    //     .query("projects")
    //     .withIndex("by_user", (q) => q.eq("user_id", user._id))
    //     .collect();
    //
    //   if (existingProjects.length >= 1) {
    //     throw new Error("Free plan limit reached. Upgrade to Premium for unlimited projects.");
    //   }
    // }

    const projectId = await ctx.db.insert('projects', {
      user_id: user._id,
      university_id: membership?.university_id ?? user.university_id,
      title: args.title,
      role: args.role,
      start_date: args.start_date,
      end_date: args.end_date,
      company: args.company,
      url: args.url,
      github_url: args.github_url,
      description: args.description,
      type: args.type,
      image_url: args.image_url,
      image_storage_id: args.image_storage_id,
      technologies: args.technologies,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    return projectId;
  },
});

// Update a project
export const updateProject = mutation({
  args: {
    clerkId: v.string(),
    projectId: v.id('projects'),
    updates: v.object({
      title: v.optional(v.string()),
      role: v.optional(v.string()),
      start_date: v.optional(v.number()),
      end_date: v.optional(v.number()),
      company: v.optional(v.string()),
      url: v.optional(v.string()),
      github_url: v.optional(v.string()),
      description: v.optional(v.string()),
      type: v.optional(v.string()),
      image_url: v.optional(v.string()), // Legacy: base64 data URL
      image_storage_id: v.optional(v.id('_storage')), // Preferred: Convex storage ID
      technologies: v.optional(v.array(v.string())),
    }),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    const membership =
      user.role === 'student'
        ? (await requireMembership(ctx, { role: 'student' })).membership
        : null;

    const project = await ctx.db.get(args.projectId);
    if (!project || project.user_id !== user._id) {
      throw new Error('Project not found or unauthorized');
    }

    if (project.university_id && membership && project.university_id !== membership.university_id) {
      throw new Error('Unauthorized: Project belongs to another university');
    }

    // Validate storage ID if provided
    if (args.updates.image_storage_id) {
      const imageUrl = await ctx.storage.getUrl(args.updates.image_storage_id);
      if (!imageUrl) {
        throw new Error('Invalid storage ID');
      }
    }

    // Clean up old storage file if image reference is changing or being cleared
    // Only delete if image_storage_id is explicitly in the update payload
    if (
      project.image_storage_id &&
      'image_storage_id' in args.updates &&
      args.updates.image_storage_id !== project.image_storage_id
    ) {
      await ctx.storage.delete(project.image_storage_id);
    }

    await ctx.db.patch(args.projectId, {
      ...args.updates,
      updated_at: Date.now(),
    });

    return args.projectId;
  },
});

// Delete a project
export const deleteProject = mutation({
  args: {
    clerkId: v.string(),
    projectId: v.id('projects'),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    const membership =
      user.role === 'student'
        ? (await requireMembership(ctx, { role: 'student' })).membership
        : null;

    const project = await ctx.db.get(args.projectId);
    if (!project || project.user_id !== user._id) {
      throw new Error('Project not found or unauthorized');
    }

    if (project.university_id && membership && project.university_id !== membership.university_id) {
      throw new Error('Unauthorized: Project belongs to another university');
    }

    // Clean up storage file if exists
    if (project.image_storage_id) {
      await ctx.storage.delete(project.image_storage_id);
    }

    await ctx.db.delete(args.projectId);
    return args.projectId;
  },
});
