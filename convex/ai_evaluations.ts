/**
 * AI Evaluations Convex Functions
 *
 * Database operations for the AI evaluation framework.
 * Stores evaluation results, configurations, and metrics.
 *
 * @see docs/AI_EVALUATOR_STRATEGY.md for governance
 */

import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { getAuthenticatedUser, isServiceRequest, requireSuperAdmin } from './lib/authorization';

// ============================================================================
// EVALUATION STORAGE
// ============================================================================

/**
 * Store an evaluation result
 */
export const createEvaluation = mutation({
  args: {
    tool_id: v.string(),
    tool_version: v.optional(v.string()),
    evaluator_model: v.string(),
    rubric_version: v.string(),
    overall_score: v.number(),
    dimension_scores: v.any(),
    risk_flags: v.array(v.string()),
    explanation: v.string(),
    passed: v.boolean(),
    user_id: v.optional(v.string()),
    input_hash: v.string(),
    output_hash: v.string(),
    environment: v.union(v.literal('dev'), v.literal('staging'), v.literal('production')),
    evaluation_duration_ms: v.number(),
    serviceToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!isServiceRequest(args.serviceToken)) {
      await requireSuperAdmin(ctx);
    }
    const { serviceToken, ...data } = args;
    const id = await ctx.db.insert('ai_evaluations', {
      ...data,
      created_at: Date.now(),
    });
    return id;
  },
});

/**
 * Get evaluations for a specific tool with pagination
 */
export const getEvaluationsByTool = query({
  args: {
    tool_id: v.string(),
    limit: v.optional(v.number()),
    passed_only: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const limit = args.limit ?? 100;

    if (args.passed_only !== undefined) {
      return await ctx.db
        .query('ai_evaluations')
        .withIndex('by_tool_and_passed', (q) =>
          q.eq('tool_id', args.tool_id).eq('passed', args.passed_only!),
        )
        .order('desc')
        .take(limit);
    }

    return await ctx.db
      .query('ai_evaluations')
      .withIndex('by_tool', (q) => q.eq('tool_id', args.tool_id))
      .order('desc')
      .take(limit);
  },
});

/**
 * Get evaluations for a specific user
 */
export const getEvaluationsByUser = query({
  args: {
    user_id: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const limit = args.limit ?? 50;

    return await ctx.db
      .query('ai_evaluations')
      .withIndex('by_user', (q) => q.eq('user_id', args.user_id))
      .order('desc')
      .take(limit);
  },
});

/**
 * Get recent evaluations across all tools
 */
export const getRecentEvaluations = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const limit = args.limit ?? 100;

    return await ctx.db.query('ai_evaluations').withIndex('by_created').order('desc').take(limit);
  },
});

// ============================================================================
// METRICS & ANALYTICS
// ============================================================================

/**
 * Get aggregated metrics for a tool
 */
export const getToolMetrics = query({
  args: {
    tool_id: v.string(),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const days = args.days ?? 30;
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    const evaluations = await ctx.db
      .query('ai_evaluations')
      .withIndex('by_tool_and_created', (q) => q.eq('tool_id', args.tool_id))
      .filter((q) => q.gte(q.field('created_at'), since))
      .collect();

    if (evaluations.length === 0) {
      return {
        tool_id: args.tool_id,
        total_evaluations: 0,
        pass_rate: 0,
        average_score: 0,
        risk_flag_counts: {},
        score_distribution: { excellent: 0, acceptable: 0, needs_improvement: 0, unacceptable: 0 },
      };
    }

    const passed = evaluations.filter((e) => e.passed).length;
    const avgScore = evaluations.reduce((sum, e) => sum + e.overall_score, 0) / evaluations.length;

    // Count risk flags
    const flagCounts: Record<string, number> = {};
    for (const evaluation of evaluations) {
      for (const flag of evaluation.risk_flags) {
        flagCounts[flag] = (flagCounts[flag] || 0) + 1;
      }
    }

    // Score distribution
    const distribution = { excellent: 0, acceptable: 0, needs_improvement: 0, unacceptable: 0 };
    for (const evaluation of evaluations) {
      if (evaluation.overall_score >= 90) distribution.excellent++;
      else if (evaluation.overall_score >= 70) distribution.acceptable++;
      else if (evaluation.overall_score >= 50) distribution.needs_improvement++;
      else distribution.unacceptable++;
    }

    return {
      tool_id: args.tool_id,
      total_evaluations: evaluations.length,
      pass_rate: Math.round((passed / evaluations.length) * 100),
      average_score: Math.round(avgScore),
      risk_flag_counts: flagCounts,
      score_distribution: distribution,
    };
  },
});

/**
 * Get metrics for all tools
 */
export const getAllToolMetrics = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const days = args.days ?? 30;
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    const evaluations = await ctx.db
      .query('ai_evaluations')
      .withIndex('by_created')
      .filter((q) => q.gte(q.field('created_at'), since))
      .collect();

    // Group by tool
    const byTool: Record<string, typeof evaluations> = {};
    for (const evaluation of evaluations) {
      if (!byTool[evaluation.tool_id]) {
        byTool[evaluation.tool_id] = [];
      }
      byTool[evaluation.tool_id].push(evaluation);
    }

    // Calculate metrics per tool
    const metrics = Object.entries(byTool).map(([tool_id, toolEvals]) => {
      const passed = toolEvals.filter((e) => e.passed).length;
      const avgScore = toolEvals.reduce((sum, e) => sum + e.overall_score, 0) / toolEvals.length;

      return {
        tool_id,
        total_evaluations: toolEvals.length,
        pass_rate: Math.round((passed / toolEvals.length) * 100),
        average_score: Math.round(avgScore),
      };
    });

    // Sort by total evaluations descending
    metrics.sort((a, b) => b.total_evaluations - a.total_evaluations);

    return {
      period_days: days,
      total_evaluations: evaluations.length,
      tools: metrics,
    };
  },
});

// ============================================================================
// CONFIGURATION MANAGEMENT
// ============================================================================

/**
 * Get evaluation config for a tool
 */
export const getToolConfig = query({
  args: {
    tool_id: v.string(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const config = await ctx.db
      .query('ai_evaluation_config')
      .withIndex('by_tool', (q) => q.eq('tool_id', args.tool_id))
      .first();

    // Return default config if none exists
    if (!config) {
      return {
        tool_id: args.tool_id,
        enabled: true,
        block_on_fail: false,
        pass_threshold: null,
        rubric: null,
      };
    }

    return config;
  },
});

/**
 * Update evaluation config for a tool (admin only)
 */
export const updateToolConfig = mutation({
  args: {
    tool_id: v.string(),
    enabled: v.optional(v.boolean()),
    block_on_fail: v.optional(v.boolean()),
    pass_threshold: v.optional(v.number()),
    rubric: v.optional(v.any()),
    updated_by: v.string(),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedUser(ctx);
    if (actor.clerkId !== args.clerkId) {
      throw new Error('Unauthorized: Clerk identity mismatch');
    }
    if (actor.role !== 'super_admin') {
      throw new Error('Unauthorized: Super admin required');
    }

    const existing = await ctx.db
      .query('ai_evaluation_config')
      .withIndex('by_tool', (q) => q.eq('tool_id', args.tool_id))
      .first();

    const updates = {
      tool_id: args.tool_id,
      enabled: args.enabled ?? existing?.enabled ?? true,
      block_on_fail: args.block_on_fail ?? existing?.block_on_fail ?? false,
      pass_threshold: args.pass_threshold ?? existing?.pass_threshold,
      rubric: args.rubric ?? existing?.rubric,
      updated_at: Date.now(),
      updated_by: args.updated_by,
    };

    if (existing) {
      await ctx.db.patch(existing._id, updates);
      return existing._id;
    } else {
      return await ctx.db.insert('ai_evaluation_config', updates);
    }
  },
});

/**
 * Get all tool configs
 */
export const getAllToolConfigs = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    return await ctx.db.query('ai_evaluation_config').collect();
  },
});

// ============================================================================
// CLEANUP & MAINTENANCE
// ============================================================================

/**
 * Delete old evaluations (for data retention)
 * Should be called by a scheduled job or admin
 */
export const deleteOldEvaluations = mutation({
  args: {
    days_to_keep: v.number(),
    limit: v.optional(v.number()),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedUser(ctx);
    if (actor.clerkId !== args.clerkId) {
      throw new Error('Unauthorized: Clerk identity mismatch');
    }
    if (actor.role !== 'super_admin') {
      throw new Error('Unauthorized: Super admin required');
    }

    const cutoff = Date.now() - args.days_to_keep * 24 * 60 * 60 * 1000;
    const limit = args.limit ?? 1000;

    const oldEvaluations = await ctx.db
      .query('ai_evaluations')
      .withIndex('by_created')
      .filter((q) => q.lt(q.field('created_at'), cutoff))
      .take(limit);

    let deleted = 0;
    for (const evaluation of oldEvaluations) {
      await ctx.db.delete(evaluation._id);
      deleted++;
    }

    return { deleted, remaining: oldEvaluations.length === limit };
  },
});
