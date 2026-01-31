import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { getAuthenticatedUser } from './lib/authorization';

export const getStagesForApplication = query({
  args: { clerkId: v.string(), applicationId: v.id('applications') },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) throw new Error('User not found');

    const stages = await ctx.db
      .query('interview_stages')
      .withIndex('by_application', (q) => q.eq('application_id', args.applicationId))
      .order('desc')
      .collect();

    // Safety: ensure only stages for this user's application are returned
    return stages.filter((s) => s.user_id === user._id);
  },
});

export const getUserInterviewStages = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) throw new Error('User not found');

    const stages = await ctx.db
      .query('interview_stages')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .order('desc')
      .collect();

    return stages;
  },
});

export const createStage = mutation({
  args: {
    applicationId: v.id('applications'),
    title: v.string(),
    scheduled_at: v.optional(v.number()),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // SECURITY: Get user from JWT token instead of client-supplied clerkId
    const user = await getAuthenticatedUser(ctx);

    // SECURITY: Verify the application belongs to the user
    // This ownership check provides implicit tenant isolation since users can only
    // create interview stages for their own applications.
    // See CLAUDE.md "Tenant Isolation & Data Access" for design rationale.
    const application = await ctx.db.get(args.applicationId);
    if (!application || application.user_id !== user._id) {
      throw new Error('Application not found or unauthorized');
    }

    // Check existing stages BEFORE inserting to accurately count for status update
    const existingStages = await ctx.db
      .query('interview_stages')
      .withIndex('by_application', (q) => q.eq('application_id', args.applicationId))
      .collect();

    const id = await ctx.db.insert('interview_stages', {
      user_id: user._id,
      application_id: args.applicationId,
      title: args.title,
      scheduled_at: args.scheduled_at,
      location: args.location,
      notes: args.notes,
      outcome: 'pending',
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    // Set application status/stage to 'interview' when adding the FIRST stage
    // existingStages.length === 0 means this is the first stage being added
    // NOTE: Both status and stage are updated for backward compatibility during migration
    // See docs/TECH_DEBT_APPLICATION_STATUS_STAGE.md
    if (existingStages.length === 0) {
      const now = Date.now();
      await ctx.db.patch(args.applicationId, {
        status: 'interview',
        stage: 'Interview',
        stage_set_at: now,
        updated_at: now,
      });
    }

    return id;
  },
});

export const updateStage = mutation({
  args: {
    stageId: v.id('interview_stages'),
    updates: v.object({
      title: v.optional(v.string()),
      scheduled_at: v.optional(v.number()),
      location: v.optional(v.string()),
      notes: v.optional(v.string()),
      outcome: v.optional(
        v.union(
          v.literal('pending'),
          v.literal('scheduled'),
          v.literal('passed'),
          v.literal('failed'),
        ),
      ),
    }),
  },
  handler: async (ctx, args) => {
    // SECURITY: Get user from JWT token instead of client-supplied clerkId
    const user = await getAuthenticatedUser(ctx);

    // SECURITY: Ownership check - users can only modify their own interview stages
    const stage = await ctx.db.get(args.stageId);
    if (!stage || stage.user_id !== user._id) throw new Error('Stage not found or unauthorized');

    await ctx.db.patch(args.stageId, { ...args.updates, updated_at: Date.now() });
    return args.stageId;
  },
});

export const deleteStage = mutation({
  args: { stageId: v.id('interview_stages') },
  handler: async (ctx, args) => {
    // SECURITY: Get user from JWT token instead of client-supplied clerkId
    const user = await getAuthenticatedUser(ctx);

    // SECURITY: Ownership check - users can only delete their own interview stages
    const stage = await ctx.db.get(args.stageId);
    if (!stage || stage.user_id !== user._id) throw new Error('Stage not found or unauthorized');

    await ctx.db.delete(args.stageId);
    return args.stageId;
  },
});
