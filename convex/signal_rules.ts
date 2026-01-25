/**
 * Signal Rules Module
 *
 * Manages signal rules for universities.
 * Signal rules define conditions that trigger advisor action signals.
 *
 * Rule Types:
 * - inactivity: Triggers when student has no activity for X days
 * - application_stall: Triggers when application is stuck at a stage
 * - engagement_drop: Triggers when engagement level drops
 * - no_progress: Triggers based on application outcome patterns
 * - custom: User-defined JSON condition
 *
 * All mutations require university_admin role with tenant isolation.
 */

import { v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { getCurrentUser, requireTenant } from './advisor_auth';
import { assertUniversityAccess, requireUniversityAdmin } from './lib/roles';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum lookback period for rule conditions (in days).
 * This must match the lookbackDays in signals.ts evaluateRulesForUniversity.
 * Rules with day-based conditions cannot exceed this limit.
 */
export const MAX_RULE_LOOKBACK_DAYS = 90;

// ============================================================================
// VALIDATORS
// ============================================================================

const signalTypeValidator = v.union(
  v.literal('needs_outreach'),
  v.literal('application_support'),
  v.literal('document_review'),
  v.literal('milestone_check'),
  v.literal('custom'),
);

const priorityValidator = v.union(
  v.literal('low'),
  v.literal('medium'),
  v.literal('high'),
  v.literal('urgent'),
);

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get all signal rules for a university.
 */
export const getRulesByUniversity = query({
  args: {
    universityId: v.id('universities'),
    activeOnly: v.optional(v.boolean()),
    signalType: v.optional(signalTypeValidator),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);

    // Super admins can access any university
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (universityId !== args.universityId) {
        throw new Error('Unauthorized: Cannot access rules for another university');
      }
    }

    let rules;
    if (args.activeOnly) {
      rules = await ctx.db
        .query('signal_rules')
        .withIndex('by_university_active', (q) =>
          q.eq('university_id', args.universityId).eq('is_active', true),
        )
        .collect();
    } else {
      rules = await ctx.db
        .query('signal_rules')
        .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
        .collect();
    }

    // Filter by signal type if specified
    if (args.signalType) {
      rules = rules.filter((r) => r.signal_type === args.signalType);
    }

    // Sort by priority (urgent first), then name
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    return rules.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.name.localeCompare(b.name);
    });
  },
});

/**
 * Get a single signal rule by ID.
 */
export const getRule = query({
  args: {
    ruleId: v.id('signal_rules'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);

    const rule = await ctx.db.get(args.ruleId);
    if (!rule) {
      throw new Error('Signal rule not found');
    }

    // Super admins can access any rule
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (rule.university_id !== universityId) {
        throw new Error('Unauthorized: Rule is not in your university');
      }
    }

    return rule;
  },
});

/**
 * Get rules by signal type for a university.
 */
export const getRulesByType = query({
  args: {
    universityId: v.id('universities'),
    signalType: signalTypeValidator,
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);

    // Super admins can access any university
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (universityId !== args.universityId) {
        throw new Error('Unauthorized: Cannot access rules for another university');
      }
    }

    const rules = await ctx.db
      .query('signal_rules')
      .withIndex('by_university_signal_type', (q) =>
        q.eq('university_id', args.universityId).eq('signal_type', args.signalType),
      )
      .filter((q) => q.eq(q.field('is_active'), true))
      .collect();

    return rules;
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new signal rule.
 * Requires university_admin role.
 */
export const createRule = mutation({
  args: {
    universityId: v.id('universities'),
    name: v.string(),
    description: v.optional(v.string()),
    condition: v.any(),
    signalType: signalTypeValidator,
    priority: priorityValidator,
    autoCreateFollowup: v.optional(v.boolean()),
    followupTemplate: v.optional(v.string()),
    cooldownDays: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);
    assertUniversityAccess(user, args.universityId);

    // Validate condition structure
    validateRuleCondition(args.condition);

    // Validate cooldown
    if (args.cooldownDays !== undefined && args.cooldownDays < 0) {
      throw new Error('cooldown_days must be non-negative');
    }

    // Validate default-active invariant: default rules must be active
    const willBeActive = args.isActive ?? true; // defaults to true
    if (args.isDefault && !willBeActive) {
      throw new Error('Cannot create an inactive rule as default. Set isActive to true.');
    }

    const now = Date.now();

    const ruleId = await ctx.db.insert('signal_rules', {
      university_id: args.universityId,
      name: args.name,
      description: args.description,
      condition: args.condition,
      signal_type: args.signalType,
      priority: args.priority,
      auto_create_followup: args.autoCreateFollowup ?? false,
      followup_template: args.followupTemplate,
      cooldown_days: args.cooldownDays ?? 7, // Default 7 days cooldown
      is_active: args.isActive ?? true,
      is_default: args.isDefault ?? false,
      created_by: user._id,
      created_at: now,
      updated_at: now,
    });

    return ruleId;
  },
});

/**
 * Update a signal rule.
 * Requires university_admin role.
 */
export const updateRule = mutation({
  args: {
    ruleId: v.id('signal_rules'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    condition: v.optional(v.any()),
    signalType: v.optional(signalTypeValidator),
    priority: v.optional(priorityValidator),
    autoCreateFollowup: v.optional(v.boolean()),
    followupTemplate: v.optional(v.string()),
    cooldownDays: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    const rule = await ctx.db.get(args.ruleId);
    if (!rule) {
      throw new Error('Signal rule not found');
    }

    assertUniversityAccess(user, rule.university_id);

    // Validate condition if provided
    if (args.condition !== undefined) {
      validateRuleCondition(args.condition);
    }

    // Validate cooldown
    if (args.cooldownDays !== undefined && args.cooldownDays < 0) {
      throw new Error('cooldown_days must be non-negative');
    }

    // Validate default-active invariant: default rules must be active
    const nextIsActive = args.isActive ?? rule.is_active;
    const nextIsDefault = args.isDefault ?? rule.is_default;
    if (nextIsDefault && !nextIsActive) {
      throw new Error(
        'Cannot deactivate a default rule. Remove default status first, or keep it active.',
      );
    }

    const now = Date.now();
    const updates: Record<string, unknown> = { updated_at: now };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.condition !== undefined) updates.condition = args.condition;
    if (args.signalType !== undefined) updates.signal_type = args.signalType;
    if (args.priority !== undefined) updates.priority = args.priority;
    if (args.autoCreateFollowup !== undefined)
      updates.auto_create_followup = args.autoCreateFollowup;
    if (args.followupTemplate !== undefined) updates.followup_template = args.followupTemplate;
    if (args.cooldownDays !== undefined) updates.cooldown_days = args.cooldownDays;
    if (args.isActive !== undefined) updates.is_active = args.isActive;
    if (args.isDefault !== undefined) updates.is_default = args.isDefault;

    await ctx.db.patch(args.ruleId, updates);
    return args.ruleId;
  },
});

/**
 * Delete a signal rule.
 * Requires university_admin role.
 */
export const deleteRule = mutation({
  args: {
    ruleId: v.id('signal_rules'),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    const rule = await ctx.db.get(args.ruleId);
    if (!rule) {
      throw new Error('Signal rule not found');
    }

    assertUniversityAccess(user, rule.university_id);

    // Prevent deleting default rules - must clear is_default first
    if (rule.is_default) {
      throw new Error('Cannot delete a default rule. Remove default status first.');
    }

    // Check if there are any active or snoozed signals from this rule
    // Snoozed signals will become active when snooze expires, so they also block deletion
    const pendingSignals = await ctx.db
      .query('signals')
      .withIndex('by_rule', (q) => q.eq('rule_id', args.ruleId))
      .filter((q) => q.or(q.eq(q.field('status'), 'active'), q.eq(q.field('status'), 'snoozed')))
      .take(1);

    if (pendingSignals.length > 0) {
      throw new Error(
        'Cannot delete: This rule has active or snoozed signals. ' +
          'Please resolve or dismiss those signals first, or deactivate the rule instead.',
      );
    }

    await ctx.db.delete(args.ruleId);
    return args.ruleId;
  },
});

/**
 * Duplicate a signal rule.
 * Creates a copy with "(Copy)" appended to the name.
 */
export const duplicateRule = mutation({
  args: {
    ruleId: v.id('signal_rules'),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    const rule = await ctx.db.get(args.ruleId);
    if (!rule) {
      throw new Error('Signal rule not found');
    }

    assertUniversityAccess(user, rule.university_id);

    const now = Date.now();

    const newRuleId = await ctx.db.insert('signal_rules', {
      university_id: rule.university_id,
      name: `${rule.name} (Copy)`,
      description: rule.description,
      condition: rule.condition,
      signal_type: rule.signal_type,
      priority: rule.priority,
      auto_create_followup: rule.auto_create_followup,
      followup_template: rule.followup_template,
      cooldown_days: rule.cooldown_days,
      is_active: false, // Start as inactive
      is_default: false, // Never copy as default
      created_by: user._id,
      created_at: now,
      updated_at: now,
    });

    return newRuleId;
  },
});

/**
 * Toggle rule active status.
 */
export const toggleRuleActive = mutation({
  args: {
    ruleId: v.id('signal_rules'),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    const rule = await ctx.db.get(args.ruleId);
    if (!rule) {
      throw new Error('Signal rule not found');
    }

    assertUniversityAccess(user, rule.university_id);

    // Prevent deactivating default rules
    if (rule.is_active && rule.is_default) {
      throw new Error('Cannot deactivate a default rule. Remove default status first.');
    }

    await ctx.db.patch(args.ruleId, {
      is_active: !rule.is_active,
      updated_at: Date.now(),
    });

    return { isActive: !rule.is_active };
  },
});

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate rule condition structure.
 * Throws an error if the condition is invalid.
 */
function validateRuleCondition(condition: unknown): void {
  if (!condition || typeof condition !== 'object') {
    throw new Error('Condition must be a non-null object');
  }

  const cond = condition as Record<string, unknown>;

  if (!cond.type || typeof cond.type !== 'string') {
    throw new Error('Condition must have a "type" string field');
  }

  const validTypes = [
    'inactivity',
    'application_stall',
    'engagement_drop',
    'no_progress',
    'custom',
    // New engagement-to-momentum engine types
    'stalled',
    'high_intent_low_conversion',
    'stage_stuck',
  ];
  if (!validTypes.includes(cond.type)) {
    throw new Error(
      `Invalid condition type: ${cond.type}. Must be one of: ${validTypes.join(', ')}`,
    );
  }

  // Type-specific validation
  switch (cond.type) {
    case 'inactivity':
      if (typeof cond.days !== 'number' || cond.days <= 0) {
        throw new Error('Inactivity condition must have a positive "days" number');
      }
      if (cond.days > MAX_RULE_LOOKBACK_DAYS) {
        throw new Error(
          `Inactivity days cannot exceed ${MAX_RULE_LOOKBACK_DAYS} (got ${cond.days})`,
        );
      }
      break;

    case 'application_stall':
      if (typeof cond.days !== 'number' || cond.days <= 0) {
        throw new Error('Application stall condition must have a positive "days" number');
      }
      if (cond.days > MAX_RULE_LOOKBACK_DAYS) {
        throw new Error(
          `Application stall days cannot exceed ${MAX_RULE_LOOKBACK_DAYS} (got ${cond.days})`,
        );
      }
      if (cond.stage && typeof cond.stage !== 'string') {
        throw new Error('Application stall "stage" must be a string if provided');
      }
      break;

    case 'engagement_drop': {
      if (typeof cond.from !== 'string' || typeof cond.to !== 'string') {
        throw new Error('Engagement drop condition must have "from" and "to" level strings');
      }
      const allowedLevels = ['engaged', 'moderate', 'at_risk'];
      if (!allowedLevels.includes(cond.from) || !allowedLevels.includes(cond.to)) {
        throw new Error(`Engagement drop levels must be one of: ${allowedLevels.join(', ')}`);
      }
      break;
    }

    case 'no_progress':
      // Flexible validation for no_progress
      if (cond.applications && typeof cond.applications !== 'number') {
        throw new Error('No progress "applications" must be a number if provided');
      }
      if (
        cond.rejections_min !== undefined &&
        (typeof cond.rejections_min !== 'number' || cond.rejections_min < 0)
      ) {
        throw new Error('No progress "rejections_min" must be a non-negative number if provided');
      }
      if (cond.offers !== undefined && typeof cond.offers !== 'number') {
        throw new Error('No progress "offers" must be a number if provided');
      }
      break;

    case 'custom':
      // Custom conditions are flexible, just ensure it's a valid object
      break;

    case 'stalled':
      // Stalled uses days (optional, defaults to 14 in signals.ts)
      if (cond.days !== undefined && (typeof cond.days !== 'number' || cond.days <= 0)) {
        throw new Error('Stalled condition "days" must be a positive number if provided');
      }
      if (cond.days !== undefined && cond.days > MAX_RULE_LOOKBACK_DAYS) {
        throw new Error(
          `Stalled condition "days" cannot exceed ${MAX_RULE_LOOKBACK_DAYS} (got ${cond.days})`,
        );
      }
      break;

    case 'high_intent_low_conversion':
      // High intent low conversion uses thresholds (all optional with defaults)
      if (
        cond.applications_threshold !== undefined &&
        (typeof cond.applications_threshold !== 'number' || cond.applications_threshold <= 0)
      ) {
        throw new Error(
          'High intent condition "applications_threshold" must be a positive number if provided',
        );
      }
      if (
        cond.application_period_days !== undefined &&
        (typeof cond.application_period_days !== 'number' || cond.application_period_days <= 0)
      ) {
        throw new Error(
          'High intent condition "application_period_days" must be a positive number if provided',
        );
      }
      if (
        cond.application_period_days !== undefined &&
        cond.application_period_days > MAX_RULE_LOOKBACK_DAYS
      ) {
        throw new Error(
          `High intent condition "application_period_days" cannot exceed ${MAX_RULE_LOOKBACK_DAYS} (got ${cond.application_period_days})`,
        );
      }
      if (
        cond.appointment_days !== undefined &&
        (typeof cond.appointment_days !== 'number' || cond.appointment_days <= 0)
      ) {
        throw new Error(
          'High intent condition "appointment_days" must be a positive number if provided',
        );
      }
      if (cond.appointment_days !== undefined && cond.appointment_days > MAX_RULE_LOOKBACK_DAYS) {
        throw new Error(
          `High intent condition "appointment_days" cannot exceed ${MAX_RULE_LOOKBACK_DAYS} (got ${cond.appointment_days})`,
        );
      }
      break;

    case 'stage_stuck':
      // Stage stuck requires a stage and optional days
      if (!cond.stage || typeof cond.stage !== 'string') {
        throw new Error('Stage stuck condition must have a "stage" string field');
      }
      if (cond.days !== undefined && (typeof cond.days !== 'number' || cond.days <= 0)) {
        throw new Error('Stage stuck condition "days" must be a positive number if provided');
      }
      if (cond.days !== undefined && cond.days > MAX_RULE_LOOKBACK_DAYS) {
        throw new Error(
          `Stage stuck condition "days" cannot exceed ${MAX_RULE_LOOKBACK_DAYS} (got ${cond.days})`,
        );
      }
      break;
  }
}

// ============================================================================
// RULE TEMPLATES
// ============================================================================

/**
 * Get predefined rule templates for quick setup.
 */
export const getRuleTemplates = query({
  args: {},
  handler: async () => {
    return [
      {
        name: 'Inactive for 2 Weeks',
        description: 'Triggers when a student has no activity for 14 days',
        condition: { type: 'inactivity', days: 14 },
        signalType: 'needs_outreach' as const,
        priority: 'medium' as const,
        cooldownDays: 14,
      },
      {
        name: 'Inactive for 1 Month',
        description: 'Triggers when a student has no activity for 30 days',
        condition: { type: 'inactivity', days: 30 },
        signalType: 'needs_outreach' as const,
        priority: 'high' as const,
        cooldownDays: 21,
      },
      {
        name: 'Interview Stall',
        description: 'Triggers when an application is stuck at Interview stage for 14 days',
        condition: { type: 'application_stall', stage: 'Interview', days: 14 },
        signalType: 'application_support' as const,
        priority: 'high' as const,
        cooldownDays: 7,
      },
      {
        name: 'Offer Pending Too Long',
        description: 'Triggers when an application is stuck at Offer stage for 7 days',
        condition: { type: 'application_stall', stage: 'Offer', days: 7 },
        signalType: 'milestone_check' as const,
        priority: 'urgent' as const,
        cooldownDays: 3,
      },
      {
        name: 'Many Rejections, No Offers',
        description: 'Triggers when student has 5+ rejections but no offers',
        condition: { type: 'no_progress', rejections_min: 5, offers: 0 },
        signalType: 'application_support' as const,
        priority: 'high' as const,
        cooldownDays: 14,
      },
      {
        name: 'Engagement Dropped to At-Risk',
        description: 'Triggers when student drops from engaged to at-risk level',
        condition: { type: 'engagement_drop', from: 'engaged', to: 'at_risk' },
        signalType: 'needs_outreach' as const,
        priority: 'medium' as const,
        cooldownDays: 7,
      },
    ];
  },
});
