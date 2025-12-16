import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import {
  assertUniversityAccess,
  assertUserAccess,
  getAuthenticatedUser,
  requireAdvisor,
} from './lib/authorization';

// ============================================
// Quiz Result Queries
// ============================================

export const getLatestQuizResult = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    const result = await ctx.db
      .query('career_quiz_results')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .order('desc')
      .first();

    return result;
  },
});

export const getQuizResultHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const limit = args.limit || 10;

    const results = await ctx.db
      .query('career_quiz_results')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .order('desc')
      .take(limit);

    return results;
  },
});

// ============================================
// Quiz Result Mutations
// ============================================

export const createQuizResult = mutation({
  args: {
    profile_snapshot_id: v.optional(v.string()),
    major_context: v.object({
      major: v.optional(v.string()),
      enabled: v.boolean(),
      closeness: v.number(),
      open_to_unrelated: v.boolean(),
      grad_school_interest: v.optional(
        v.union(v.literal('none'), v.literal('considering'), v.literal('planning')),
      ),
    }),
    answers: v.any(),
    themes: v.array(
      v.object({
        name: v.string(),
        description: v.string(),
        weight: v.number(),
      }),
    ),
    recommended_directions: v.array(
      v.object({
        title: v.string(),
        fit_score: v.number(),
        reasoning: v.string(),
      }),
    ),
    roles_to_explore: v.array(
      v.object({
        role_id: v.string(),
        title: v.string(),
        reason: v.string(),
        fit_score: v.number(),
      }),
    ),
    suggested_bundles: v.array(
      v.object({
        bundle_type: v.union(v.literal('safe'), v.literal('ambitious'), v.literal('alternative')),
        name: v.string(),
        path_graph: v.any(),
        starter_checklist: v.array(v.string()),
      }),
    ),
    confidence_level: v.union(
      v.literal('exploration'),
      v.literal('leaning'),
      v.literal('locked_in'),
    ),
    prompt_version: v.optional(v.string()),
    model_used: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const now = Date.now();

    const resultId = await ctx.db.insert('career_quiz_results', {
      user_id: user._id,
      university_id: user.university_id ?? undefined,
      profile_snapshot_id: args.profile_snapshot_id,
      major_context: args.major_context,
      answers: args.answers,
      themes: args.themes,
      recommended_directions: args.recommended_directions,
      roles_to_explore: args.roles_to_explore,
      suggested_bundles: args.suggested_bundles,
      confidence_level: args.confidence_level,
      prompt_version: args.prompt_version,
      model_used: args.model_used,
      created_at: now,
      updated_at: now,
    });

    return resultId;
  },
});

// ============================================
// Main Path Queries
// ============================================

export const getUserMainPath = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    // Get the most recent non-archived path
    const path = await ctx.db
      .query('career_main_paths')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .order('desc')
      .filter((q) => q.neq(q.field('status'), 'archived'))
      .first();

    if (!path) return null;

    // Get steps for the path
    const steps = await ctx.db
      .query('career_main_path_steps')
      .withIndex('by_path', (q) => q.eq('path_id', path._id))
      .collect();

    return {
      path,
      steps: steps.sort((a, b) => a.index - b.index),
    };
  },
});

export const getMainPathVersions = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    // Get all published paths for this user (most recent first)
    const versions = await ctx.db
      .query('career_main_paths')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .filter((q) => q.eq(q.field('status'), 'published'))
      .order('desc')
      .take(10);

    return versions;
  },
});

// ============================================
// Main Path Mutations
// ============================================

export const createMainPath = mutation({
  args: {
    title: v.string(),
    source: v.union(
      v.literal('manual'),
      v.literal('quiz'),
      v.literal('suggested'),
      v.literal('search'),
    ),
    major_context: v.optional(
      v.object({
        major: v.optional(v.string()),
        closeness: v.number(),
      }),
    ),
    graph: v.optional(v.any()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const now = Date.now();

    const pathId = await ctx.db.insert('career_main_paths', {
      user_id: user._id,
      university_id: user.university_id ?? undefined,
      title: args.title,
      source: args.source,
      status: 'draft',
      version: 1,
      major_context: args.major_context,
      graph: args.graph || { nodes: [], edges: [] },
      notes: args.notes,
      created_at: now,
      updated_at: now,
    });

    return pathId;
  },
});

export const updateMainPathGraph = mutation({
  args: {
    pathId: v.id('career_main_paths'),
    graph: v.any(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const path = await ctx.db.get(args.pathId);
    if (!path || path.user_id !== user._id) {
      throw new Error('Path not found');
    }

    await ctx.db.patch(args.pathId, {
      graph: args.graph,
      updated_at: Date.now(),
    });
  },
});

export const addMainPathStep = mutation({
  args: {
    pathId: v.id('career_main_paths'),
    timeframe: v.union(
      v.literal('6m'),
      v.literal('12m'),
      v.literal('24m'),
      v.literal('36m'),
      v.literal('semester_1'),
      v.literal('semester_2'),
      v.literal('summer'),
    ),
    step_type: v.union(
      v.literal('role'),
      v.literal('bridge'),
      v.literal('project'),
      v.literal('internship'),
      v.literal('certification'),
    ),
    role_id: v.optional(v.string()),
    title: v.string(),
    details: v.object({
      skills_to_build: v.optional(v.array(v.string())),
      projects: v.optional(v.array(v.string())),
      certifications: v.optional(v.array(v.string())),
      experience_targets: v.optional(v.array(v.string())),
    }),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const path = await ctx.db.get(args.pathId);
    if (!path || path.user_id !== user._id) {
      throw new Error('Path not found');
    }

    // Get current max index
    const existingSteps = await ctx.db
      .query('career_main_path_steps')
      .withIndex('by_path', (q) => q.eq('path_id', args.pathId))
      .collect();

    const maxIndex = existingSteps.length > 0 ? Math.max(...existingSteps.map((s) => s.index)) : -1;

    const now = Date.now();

    const stepId = await ctx.db.insert('career_main_path_steps', {
      path_id: args.pathId,
      user_id: user._id,
      university_id: user.university_id ?? undefined,
      index: maxIndex + 1,
      timeframe: args.timeframe,
      step_type: args.step_type,
      role_id: args.role_id,
      title: args.title,
      details: args.details,
      notes: args.notes,
      created_at: now,
      updated_at: now,
    });

    // Update path timestamp
    await ctx.db.patch(args.pathId, { updated_at: now });

    return stepId;
  },
});

export const updateMainPathStep = mutation({
  args: {
    stepId: v.id('career_main_path_steps'),
    timeframe: v.optional(
      v.union(
        v.literal('6m'),
        v.literal('12m'),
        v.literal('24m'),
        v.literal('36m'),
        v.literal('semester_1'),
        v.literal('semester_2'),
        v.literal('summer'),
      ),
    ),
    step_type: v.optional(
      v.union(
        v.literal('role'),
        v.literal('bridge'),
        v.literal('project'),
        v.literal('internship'),
        v.literal('certification'),
      ),
    ),
    role_id: v.optional(v.string()),
    title: v.optional(v.string()),
    details: v.optional(
      v.object({
        skills_to_build: v.optional(v.array(v.string())),
        projects: v.optional(v.array(v.string())),
        certifications: v.optional(v.array(v.string())),
        experience_targets: v.optional(v.array(v.string())),
      }),
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const step = await ctx.db.get(args.stepId);
    if (!step || step.user_id !== user._id) {
      throw new Error('Step not found');
    }

    const updates: Record<string, unknown> = {
      updated_at: Date.now(),
    };

    if (args.timeframe !== undefined) updates.timeframe = args.timeframe;
    if (args.step_type !== undefined) updates.step_type = args.step_type;
    if (args.role_id !== undefined) updates.role_id = args.role_id;
    if (args.title !== undefined) updates.title = args.title;
    if (args.details !== undefined) updates.details = args.details;
    if (args.notes !== undefined) updates.notes = args.notes;

    await ctx.db.patch(args.stepId, updates);

    // Update path timestamp
    await ctx.db.patch(step.path_id, { updated_at: Date.now() });
  },
});

export const reorderMainPathSteps = mutation({
  args: {
    pathId: v.id('career_main_paths'),
    orderedStepIds: v.array(v.id('career_main_path_steps')),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const path = await ctx.db.get(args.pathId);
    if (!path || path.user_id !== user._id) {
      throw new Error('Path not found');
    }

    // Verify all steps belong to this path
    for (const stepId of args.orderedStepIds) {
      const step = await ctx.db.get(stepId);
      if (!step || step.path_id !== args.pathId) {
        throw new Error('Invalid step ID for this path');
      }
    }

    const now = Date.now();

    // Update each step's index
    for (let i = 0; i < args.orderedStepIds.length; i++) {
      await ctx.db.patch(args.orderedStepIds[i], {
        index: i,
        updated_at: now,
      });
    }

    // Update path timestamp
    await ctx.db.patch(args.pathId, { updated_at: now });
  },
});

export const deleteMainPathStep = mutation({
  args: {
    stepId: v.id('career_main_path_steps'),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const step = await ctx.db.get(args.stepId);
    if (!step || step.user_id !== user._id) {
      throw new Error('Step not found');
    }

    await ctx.db.delete(args.stepId);

    // Update path timestamp
    await ctx.db.patch(step.path_id, { updated_at: Date.now() });
  },
});

export const publishMainPath = mutation({
  args: {
    pathId: v.id('career_main_paths'),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const path = await ctx.db.get(args.pathId);
    if (!path || path.user_id !== user._id) {
      throw new Error('Path not found');
    }

    const now = Date.now();

    await ctx.db.patch(args.pathId, {
      status: 'published',
      version: path.version + 1,
      published_at: now,
      updated_at: now,
    });
  },
});

// ============================================
// Saved Roles Queries
// ============================================

export const getUserSavedRoles = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    const savedRoles = await ctx.db
      .query('saved_roles')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .order('desc')
      .collect();

    return savedRoles;
  },
});

// ============================================
// Saved Roles Mutations
// ============================================

export const saveRole = mutation({
  args: {
    role_id: v.string(),
    role_data: v.any(),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    // Check if already saved
    const existing = await ctx.db
      .query('saved_roles')
      .withIndex('by_user_role', (q) => q.eq('user_id', user._id).eq('role_id', args.role_id))
      .first();

    if (existing) {
      throw new Error('Role already saved');
    }

    const savedRoleId = await ctx.db.insert('saved_roles', {
      user_id: user._id,
      role_id: args.role_id,
      role_data: args.role_data,
      tags: args.tags,
      created_at: Date.now(),
    });

    return savedRoleId;
  },
});

export const unsaveRole = mutation({
  args: {
    role_id: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const savedRole = await ctx.db
      .query('saved_roles')
      .withIndex('by_user_role', (q) => q.eq('user_id', user._id).eq('role_id', args.role_id))
      .first();

    if (savedRole) {
      await ctx.db.delete(savedRole._id);
    }
  },
});

// ============================================
// Advisor Access Queries
// ============================================

export const getStudentMainPath = query({
  args: {
    studentId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const advisor = await requireAdvisor(ctx);

    const student = await ctx.db.get(args.studentId);
    if (!student) {
      throw new Error('Student not found');
    }

    assertUniversityAccess(advisor, student.university_id);
    await assertUserAccess(ctx, advisor, args.studentId);

    // Get published path only
    const path = await ctx.db
      .query('career_main_paths')
      .withIndex('by_user_status', (q) => q.eq('user_id', args.studentId).eq('status', 'published'))
      .order('desc')
      .first();

    if (!path) return null;

    const steps = await ctx.db
      .query('career_main_path_steps')
      .withIndex('by_path', (q) => q.eq('path_id', path._id))
      .collect();

    return {
      path,
      steps: steps.sort((a, b) => a.index - b.index),
    };
  },
});

export const getStudentQuizResult = query({
  args: {
    studentId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const advisor = await requireAdvisor(ctx);

    const student = await ctx.db.get(args.studentId);
    if (!student) {
      throw new Error('Student not found');
    }

    assertUniversityAccess(advisor, student.university_id);
    await assertUserAccess(ctx, advisor, args.studentId);

    // Get latest quiz result
    const result = await ctx.db
      .query('career_quiz_results')
      .withIndex('by_user', (q) => q.eq('user_id', args.studentId))
      .order('desc')
      .first();

    return result;
  },
});

// ============================================
// Advisor Audit Logging Mutations
// ============================================

export const logAdvisorPathView = mutation({
  args: {
    studentId: v.id('users'),
    resourceType: v.string(),
  },
  handler: async (ctx, args) => {
    const advisor = await requireAdvisor(ctx);

    await ctx.db.insert('audit_logs', {
      actor_id: advisor._id,
      university_id: advisor.university_id ?? undefined,
      action: 'resource_accessed',
      entity_type: args.resourceType,
      entity_id: args.studentId,
      student_id: args.studentId,
      created_at: Date.now(),
    });
  },
});
