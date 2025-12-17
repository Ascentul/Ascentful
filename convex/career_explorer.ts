import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import {
  assertUniversityAccess,
  assertUserAccess,
  getAuthenticatedUser,
  requireAdvisor,
} from './lib/authorization';

// ============================================
// Quiz Draft Queries & Mutations (Save/Resume)
// ============================================

export const getQuizDraft = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    const draft = await ctx.db
      .query('career_quiz_drafts')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .first();

    return draft;
  },
});

export const saveQuizDraft = mutation({
  args: {
    answers: v.any(),
    current_step: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const now = Date.now();

    // Check for existing draft
    const existing = await ctx.db
      .query('career_quiz_drafts')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .first();

    if (existing) {
      // Update existing draft
      await ctx.db.patch(existing._id, {
        answers: args.answers,
        current_step: args.current_step,
        updated_at: now,
      });
      return existing._id;
    } else {
      // Create new draft
      const draftId = await ctx.db.insert('career_quiz_drafts', {
        user_id: user._id,
        answers: args.answers,
        current_step: args.current_step,
        started_at: now,
        updated_at: now,
      });
      return draftId;
    }
  },
});

export const deleteQuizDraft = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    const draft = await ctx.db
      .query('career_quiz_drafts')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .first();

    if (draft) {
      await ctx.db.delete(draft._id);
    }
  },
});

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
      // New step types for Career Dreamer
      v.literal('foundation_skill'),
      v.literal('portfolio_project'),
      v.literal('stepping_stone'),
      v.literal('target_role'),
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
        // New step types for Career Dreamer
        v.literal('foundation_skill'),
        v.literal('portfolio_project'),
        v.literal('stepping_stone'),
        v.literal('target_role'),
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

// ============================================
// Convert Career Path Step to Goal
// ============================================

const STEP_TYPE_TO_CATEGORY: Record<string, string> = {
  role: 'career',
  bridge: 'career',
  project: 'project',
  internship: 'career',
  certification: 'education',
  foundation_skill: 'skill',
  portfolio_project: 'project',
  stepping_stone: 'career',
  target_role: 'career',
};

export const convertStepToGoal = mutation({
  args: {
    stepId: v.id('career_main_path_steps'),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    // Get the step
    const step = await ctx.db.get(args.stepId);
    if (!step) {
      throw new Error('Step not found');
    }

    // Verify the step belongs to a path the user owns
    const path = await ctx.db.get(step.path_id);
    if (!path || path.user_id !== user._id) {
      throw new Error('Unauthorized - step does not belong to your path');
    }

    // Map step type to goal category
    const category = STEP_TYPE_TO_CATEGORY[step.step_type] || 'career';

    // Calculate target date based on timeframe
    const now = Date.now();
    const timeframeMs: Record<string, number> = {
      '6m': 6 * 30 * 24 * 60 * 60 * 1000,
      '12m': 12 * 30 * 24 * 60 * 60 * 1000,
      '24m': 24 * 30 * 24 * 60 * 60 * 1000,
      '36m': 36 * 30 * 24 * 60 * 60 * 1000,
      semester_1: 4 * 30 * 24 * 60 * 60 * 1000,
      semester_2: 8 * 30 * 24 * 60 * 60 * 1000,
      summer: 3 * 30 * 24 * 60 * 60 * 1000,
    };
    const targetDate = now + (timeframeMs[step.timeframe] || timeframeMs['12m']);

    // Build description from step details
    const descriptionParts: string[] = [];
    if (step.details.skills_to_build && step.details.skills_to_build.length > 0) {
      descriptionParts.push(`Skills to build: ${step.details.skills_to_build.join(', ')}`);
    }
    if (step.details.projects && step.details.projects.length > 0) {
      descriptionParts.push(`Projects: ${step.details.projects.join(', ')}`);
    }
    if (step.details.certifications && step.details.certifications.length > 0) {
      descriptionParts.push(`Certifications: ${step.details.certifications.join(', ')}`);
    }
    if (step.details.experience_targets && step.details.experience_targets.length > 0) {
      descriptionParts.push(`Experience targets: ${step.details.experience_targets.join(', ')}`);
    }
    if (step.notes) {
      descriptionParts.push(`Notes: ${step.notes}`);
    }

    const description = descriptionParts.join('\n\n') || undefined;

    // Build checklist from step details
    const checklist: { id: string; text: string; completed: boolean }[] = [];
    let checklistIndex = 0;

    if (step.details.skills_to_build) {
      for (const skill of step.details.skills_to_build) {
        checklist.push({
          id: `skill-${checklistIndex++}`,
          text: `Learn: ${skill}`,
          completed: false,
        });
      }
    }

    if (step.details.projects) {
      for (const project of step.details.projects) {
        checklist.push({
          id: `project-${checklistIndex++}`,
          text: `Complete: ${project}`,
          completed: false,
        });
      }
    }

    if (step.details.certifications) {
      for (const cert of step.details.certifications) {
        checklist.push({
          id: `cert-${checklistIndex++}`,
          text: `Earn: ${cert}`,
          completed: false,
        });
      }
    }

    if (step.details.experience_targets) {
      for (const target of step.details.experience_targets) {
        checklist.push({
          id: `exp-${checklistIndex++}`,
          text: target,
          completed: false,
        });
      }
    }

    // Create the goal
    const goalId = await ctx.db.insert('goals', {
      user_id: user._id,
      university_id: user.university_id ?? undefined,
      title: step.title,
      description,
      category,
      target_date: targetDate,
      status: 'not_started',
      progress: 0,
      checklist: checklist.length > 0 ? checklist : undefined,
      created_at: now,
      updated_at: now,
    });

    return goalId;
  },
});

// ============================================
// Career Galaxy Data Query
// ============================================

/**
 * Get all data needed to generate career galaxy roles
 * Returns user profile, quiz results, and any saved roles
 */
export const getCareerGalaxyData = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) {
      return null;
    }

    // Get the latest quiz result
    const quizResult = await ctx.db
      .query('career_quiz_results')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .order('desc')
      .first();

    // Get saved roles
    const savedRoles = await ctx.db
      .query('saved_roles')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .collect();

    // Return user profile data along with quiz results
    return {
      profile: {
        name: user.name,
        email: user.email,
        job_title: user.job_title,
        company: user.company,
        current_position: user.current_position,
        current_company: user.current_company,
        location: user.location,
        skills: user.skills,
        education: user.education,
        education_history: user.education_history,
        work_history: user.work_history,
        achievements_history: user.achievements_history,
        university_name: user.university_name,
        major: user.major,
        graduation_year: user.graduation_year,
        dream_job: user.dream_job,
        career_goals: user.career_goals,
        experience_level: user.experience_level,
        industry: user.industry,
        bio: user.bio,
      },
      quizResult: quizResult
        ? {
            themes: quizResult.themes,
            recommended_directions: quizResult.recommended_directions,
            roles_to_explore: quizResult.roles_to_explore,
            confidence_level: quizResult.confidence_level,
            major_context: quizResult.major_context,
          }
        : null,
      savedRoleIds: savedRoles.map((r) => r.role_id),
    };
  },
});

// ============================================
// Career Explorer State (V4 - 3-Step Wizard)
// ============================================

/**
 * Get user's current explorer state for resumability
 */
export const getExplorerState = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    const state = await ctx.db
      .query('career_explorer_state')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .first();

    return state;
  },
});

/**
 * Save/update explorer state (auto-save on each step)
 */
export const saveExplorerState = mutation({
  args: {
    starting_role: v.optional(
      v.object({
        id: v.string(),
        title: v.string(),
        category: v.optional(v.string()),
      }),
    ),
    skills_have: v.optional(v.array(v.string())),
    skills_want: v.optional(v.array(v.string())),
    placed_steps: v.optional(
      v.array(
        v.object({
          id: v.string(),
          title: v.string(),
          role_id: v.optional(v.string()),
          fit_score: v.optional(v.number()),
          index: v.number(),
        }),
      ),
    ),
    current_step: v.number(),
    completed_steps: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const now = Date.now();

    // Check for existing state
    const existing = await ctx.db
      .query('career_explorer_state')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .first();

    if (existing) {
      // Update existing state
      await ctx.db.patch(existing._id, {
        starting_role: args.starting_role,
        skills_have: args.skills_have,
        skills_want: args.skills_want,
        placed_steps: args.placed_steps,
        current_step: args.current_step,
        completed_steps: args.completed_steps,
        updated_at: now,
      });
      return existing._id;
    } else {
      // Create new state
      const stateId = await ctx.db.insert('career_explorer_state', {
        user_id: user._id,
        university_id: user.university_id ?? undefined,
        starting_role: args.starting_role,
        skills_have: args.skills_have,
        skills_want: args.skills_want,
        placed_steps: args.placed_steps,
        current_step: args.current_step,
        completed_steps: args.completed_steps,
        created_at: now,
        updated_at: now,
      });
      return stateId;
    }
  },
});

/**
 * Clear explorer state (restart wizard)
 */
export const clearExplorerState = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    const state = await ctx.db
      .query('career_explorer_state')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .first();

    if (state) {
      await ctx.db.delete(state._id);
    }
  },
});
