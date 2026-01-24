/**
 * Engagement Definitions Module
 *
 * Manages engagement definitions for universities.
 * Engagement definitions specify what constitutes "engaged" vs "at-risk" for students.
 *
 * SCORING APPROACH: Current State Evaluation
 * Uses a score-based approach (0-100) with three components:
 * - Event count score (50% weight) - qualifying events in period
 * - Active days score (30% weight) - unique days with activity
 * - Recency score (20% weight) - how recently student was active
 *
 * This differs from engagement_prediction.ts which uses a risk-based prediction
 * algorithm with trend analysis for forecasting future engagement drops.
 *
 * Use this module for: Current engagement status based on university-defined thresholds
 * Use engagement_prediction.ts for: Predictive analytics and at-risk forecasting
 *
 * All mutations require university_admin role with tenant isolation.
 */

import { v } from 'convex/values';

import { Doc, Id } from './_generated/dataModel';
import { mutation, query, QueryCtx } from './_generated/server';
import { getCurrentUser, requireTenant } from './advisor_auth';
import {
  calculateEngagementScore as calculateEngagementScoreLib,
  DEFAULT_QUALIFYING_EVENT_TYPES,
  determineEngagementStatus,
} from './lib/engagementScoring';
import { assertUniversityAccess, requireUniversityAdmin } from './lib/roles';

// Re-export for backward compatibility
export { DEFAULT_QUALIFYING_EVENT_TYPES };

// ============================================================================
// VALIDATORS
// ============================================================================

const appliesToValidator = v.union(
  v.literal('all_students'),
  v.literal('undergrad'),
  v.literal('grad'),
  v.literal('by_major'),
  v.literal('by_year'),
);

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get all engagement definitions for a university.
 */
export const getDefinitionsByUniversity = query({
  args: {
    universityId: v.id('universities'),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);

    // Super admins can access any university
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (universityId !== args.universityId) {
        throw new Error('Unauthorized: Cannot access definitions for another university');
      }
    }

    let definitions;
    if (args.activeOnly) {
      definitions = await ctx.db
        .query('engagement_definitions')
        .withIndex('by_university_active', (q) =>
          q.eq('university_id', args.universityId).eq('is_active', true),
        )
        .collect();
    } else {
      definitions = await ctx.db
        .query('engagement_definitions')
        .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
        .collect();
    }

    // Sort by name
    return definitions.sort((a, b) => a.name.localeCompare(b.name));
  },
});

/**
 * Get a single engagement definition by ID.
 */
export const getDefinition = query({
  args: {
    definitionId: v.id('engagement_definitions'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);

    const definition = await ctx.db.get(args.definitionId);
    if (!definition) {
      throw new Error('Engagement definition not found');
    }

    // Super admins can access any definition
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (definition.university_id !== universityId) {
        throw new Error('Unauthorized: Definition is not in your university');
      }
    }

    return definition;
  },
});

/**
 * Get the default engagement definition for a university.
 */
export const getDefaultDefinition = query({
  args: {
    universityId: v.id('universities'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);

    // Super admins can access any university
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (universityId !== args.universityId) {
        throw new Error('Unauthorized: Cannot access definitions for another university');
      }
    }

    // Find active definition marked as default
    const definitions = await ctx.db
      .query('engagement_definitions')
      .withIndex('by_university_active', (q) =>
        q.eq('university_id', args.universityId).eq('is_active', true),
      )
      .collect();

    return definitions.find((d) => d.is_default) || definitions[0] || null;
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new engagement definition.
 * Requires university_admin role.
 */
export const createDefinition = mutation({
  args: {
    universityId: v.id('universities'),
    name: v.string(),
    description: v.optional(v.string()),
    criteria: v.any(),
    engagedThreshold: v.number(),
    atRiskThreshold: v.number(),
    appliesTo: appliesToValidator,
    scopeFilter: v.optional(v.any()),
    isActive: v.optional(v.boolean()),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);
    assertUniversityAccess(user, args.universityId);

    const isActive = args.isActive ?? true;

    // Prevent inconsistent state: default definitions must be active
    if (args.isDefault && !isActive) {
      throw new Error('Default definition must be active');
    }

    // Validate thresholds
    if (args.atRiskThreshold >= args.engagedThreshold) {
      throw new Error('at_risk_threshold must be less than engaged_threshold');
    }

    const now = Date.now();

    // If this is marked as default, unset any existing default
    if (args.isDefault) {
      const existingDefault = await ctx.db
        .query('engagement_definitions')
        .withIndex('by_university_active', (q) =>
          q.eq('university_id', args.universityId).eq('is_active', true),
        )
        .filter((q) => q.eq(q.field('is_default'), true))
        .first();

      if (existingDefault) {
        await ctx.db.patch(existingDefault._id, { is_default: false, updated_at: now });
      }
    }

    const definitionId = await ctx.db.insert('engagement_definitions', {
      university_id: args.universityId,
      name: args.name,
      description: args.description,
      criteria: args.criteria,
      engaged_threshold: args.engagedThreshold,
      at_risk_threshold: args.atRiskThreshold,
      applies_to: args.appliesTo,
      scope_filter: args.scopeFilter,
      is_active: isActive,
      is_default: args.isDefault ?? false,
      created_by: user._id,
      created_at: now,
      updated_at: now,
    });

    return definitionId;
  },
});

/**
 * Update an engagement definition.
 * Requires university_admin role.
 */
export const updateDefinition = mutation({
  args: {
    definitionId: v.id('engagement_definitions'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    criteria: v.optional(v.any()),
    engagedThreshold: v.optional(v.number()),
    atRiskThreshold: v.optional(v.number()),
    appliesTo: v.optional(appliesToValidator),
    scopeFilter: v.optional(v.any()),
    isActive: v.optional(v.boolean()),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    const definition = await ctx.db.get(args.definitionId);
    if (!definition) {
      throw new Error('Engagement definition not found');
    }

    assertUniversityAccess(user, definition.university_id);

    // Validate thresholds if both are being updated or one changes
    const newEngagedThreshold = args.engagedThreshold ?? definition.engaged_threshold;
    const newAtRiskThreshold = args.atRiskThreshold ?? definition.at_risk_threshold;
    if (newAtRiskThreshold >= newEngagedThreshold) {
      throw new Error('at_risk_threshold must be less than engaged_threshold');
    }

    // Validate default-active invariant: default definitions must be active
    const nextIsActive = args.isActive ?? definition.is_active;
    if (args.isDefault && !nextIsActive) {
      throw new Error('Cannot set an inactive definition as default. Activate it first.');
    }
    if (args.isActive === false && definition.is_default) {
      throw new Error(
        'Cannot deactivate the default definition. Set another definition as default first.',
      );
    }

    const now = Date.now();
    const updates: Record<string, unknown> = { updated_at: now };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.criteria !== undefined) updates.criteria = args.criteria;
    if (args.engagedThreshold !== undefined) updates.engaged_threshold = args.engagedThreshold;
    if (args.atRiskThreshold !== undefined) updates.at_risk_threshold = args.atRiskThreshold;
    if (args.appliesTo !== undefined) updates.applies_to = args.appliesTo;
    if (args.scopeFilter !== undefined) updates.scope_filter = args.scopeFilter;
    if (args.isActive !== undefined) updates.is_active = args.isActive;

    // Handle default flag
    if (args.isDefault !== undefined) {
      if (args.isDefault) {
        // Unset any existing default
        const existingDefault = await ctx.db
          .query('engagement_definitions')
          .withIndex('by_university_active', (q) =>
            q.eq('university_id', definition.university_id).eq('is_active', true),
          )
          .filter((q) =>
            q.and(q.eq(q.field('is_default'), true), q.neq(q.field('_id'), args.definitionId)),
          )
          .first();

        if (existingDefault) {
          await ctx.db.patch(existingDefault._id, { is_default: false, updated_at: now });
        }
      }
      updates.is_default = args.isDefault;
    }

    await ctx.db.patch(args.definitionId, updates);
    return args.definitionId;
  },
});

/**
 * Delete an engagement definition.
 * Requires university_admin role.
 */
export const deleteDefinition = mutation({
  args: {
    definitionId: v.id('engagement_definitions'),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    const definition = await ctx.db.get(args.definitionId);
    if (!definition) {
      throw new Error('Engagement definition not found');
    }

    assertUniversityAccess(user, definition.university_id);

    // Check if any signal rules reference this definition
    const referencingRules = await ctx.db
      .query('signal_rules')
      .withIndex('by_university', (q) => q.eq('university_id', definition.university_id))
      .collect();

    const hasReferences = referencingRules.some((rule) => {
      const condition = rule.condition as Record<string, unknown> | undefined;
      return condition?.definition_id === args.definitionId;
    });

    if (hasReferences) {
      throw new Error(
        'Cannot delete: This definition is referenced by one or more signal rules. ' +
          'Please update or delete those rules first.',
      );
    }

    await ctx.db.delete(args.definitionId);
    return args.definitionId;
  },
});

/**
 * Duplicate an engagement definition.
 * Creates a copy with "(Copy)" appended to the name.
 */
export const duplicateDefinition = mutation({
  args: {
    definitionId: v.id('engagement_definitions'),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    const definition = await ctx.db.get(args.definitionId);
    if (!definition) {
      throw new Error('Engagement definition not found');
    }

    assertUniversityAccess(user, definition.university_id);

    const now = Date.now();

    const newDefinitionId = await ctx.db.insert('engagement_definitions', {
      university_id: definition.university_id,
      name: `${definition.name} (Copy)`,
      description: definition.description,
      criteria: definition.criteria,
      engaged_threshold: definition.engaged_threshold,
      at_risk_threshold: definition.at_risk_threshold,
      applies_to: definition.applies_to,
      scope_filter: definition.scope_filter,
      is_active: false, // Start as inactive
      is_default: false, // Never copy as default
      created_by: user._id,
      created_at: now,
      updated_at: now,
    });

    return newDefinitionId;
  },
});

// ============================================================================
// ENGAGEMENT SCORING
// ============================================================================

/**
 * Criteria structure for engagement definitions.
 * Used to determine what qualifies as "engagement".
 */
export interface EngagementCriteria {
  qualifying_event_types?: string[]; // Specific event types that count
  qualifying_event_categories?: string[]; // Categories that count (e.g., 'application', 'document')
  period_days: number; // Look-back period in days (default: 14)
  min_events_in_period?: number; // Minimum events to be "engaged" (default: 3)
  min_logins_per_week?: number; // Optional: minimum logins per week
  min_applications_active?: number; // Optional: minimum active applications
}

/**
 * Calculate engagement score from activity metrics.
 * Thin wrapper around lib/engagementScoring.ts for local signature compatibility.
 *
 * This function converts the local signature (with lastEventAt timestamp) to the
 * lib function signature (with daysSinceLastActivity). The actual scoring logic
 * is centralized in lib/engagementScoring.ts as the single source of truth.
 */
function calculateEngagementScore(
  totalCount: number,
  uniqueDays: number,
  lastEventAt: number | null,
  criteria: EngagementCriteria,
): number {
  // Calculate days since last activity from timestamp
  const daysSinceLastActivity =
    lastEventAt !== null ? Math.floor((Date.now() - lastEventAt) / (1000 * 60 * 60 * 24)) : null;

  // Delegate to centralized scoring function
  return calculateEngagementScoreLib(
    {
      totalEventCount: totalCount,
      uniqueActiveDays: uniqueDays,
      daysSinceLastActivity,
    },
    {
      minEventsInPeriod: criteria.min_events_in_period || 3,
      periodDays: criteria.period_days || 14,
    },
  );
}

/**
 * Helper to get qualifying events for a student within a period.
 */
async function getQualifyingEvents(
  ctx: QueryCtx,
  studentId: Id<'users'>,
  criteria: EngagementCriteria,
): Promise<{
  events: Doc<'activity_events'>[];
  totalCount: number;
  uniqueDays: number;
  lastEventAt: number | null;
}> {
  const now = Date.now();
  const periodDays = criteria.period_days || 14;
  const cutoffTime = now - periodDays * 24 * 60 * 60 * 1000;

  // Get all events for the student in the period
  const allEvents = await ctx.db
    .query('activity_events')
    .withIndex('by_user_date', (q) => q.eq('user_id', studentId).gte('occurred_at', cutoffTime))
    .collect();

  // Filter to qualifying events
  const qualifyingEventTypes = criteria.qualifying_event_types || DEFAULT_QUALIFYING_EVENT_TYPES;
  const qualifyingCategories = criteria.qualifying_event_categories || [];

  const qualifyingEvents = allEvents.filter((event) => {
    // Check if event type matches
    if (qualifyingEventTypes.includes(event.event_type)) {
      return true;
    }
    // Check if category matches
    if (qualifyingCategories.includes(event.event_category)) {
      return true;
    }
    return false;
  });

  // Calculate unique days with activity
  const uniqueDaysSet = new Set<string>();
  for (const event of qualifyingEvents) {
    const dateStr = new Date(event.occurred_at).toISOString().slice(0, 10);
    uniqueDaysSet.add(dateStr);
  }

  // Find last qualifying event
  const lastEvent =
    qualifyingEvents.length > 0
      ? qualifyingEvents.reduce((latest, event) =>
          event.occurred_at > latest.occurred_at ? event : latest,
        )
      : null;

  return {
    events: qualifyingEvents,
    totalCount: qualifyingEvents.length,
    uniqueDays: uniqueDaysSet.size,
    lastEventAt: lastEvent?.occurred_at ?? null,
  };
}

/**
 * Evaluate a student's engagement score based on a definition.
 * Uses activity_events to calculate real engagement metrics.
 */
export const evaluateStudentEngagement = query({
  args: {
    studentId: v.id('users'),
    definitionId: v.optional(v.id('engagement_definitions')),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);

    const student = await ctx.db.get(args.studentId);
    if (!student) {
      throw new Error('Student not found');
    }

    if (!student.university_id) {
      throw new Error('Student is not affiliated with a university');
    }

    // Explicit role gate: only these roles can access engagement data
    const allowedRoles = ['super_admin', 'university_admin', 'advisor', 'student'];
    if (!allowedRoles.includes(sessionCtx.role)) {
      throw new Error('Unauthorized: Role cannot access engagement data');
    }

    // Super admins can access any student; advisors must be in same university
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (student.university_id !== universityId) {
        throw new Error('Unauthorized: Cannot access student from another university');
      }
      // Advisors can only access their assigned students
      if (sessionCtx.role === 'advisor') {
        const assignment = await ctx.db
          .query('student_advisors')
          .withIndex('by_advisor', (q) =>
            q.eq('advisor_id', sessionCtx.userId).eq('university_id', universityId),
          )
          .filter((q) => q.eq(q.field('student_id'), args.studentId))
          .first();
        if (!assignment) {
          throw new Error('Unauthorized: Student is not assigned to you');
        }
      }
    }
    // Students can only view their own engagement
    if (sessionCtx.role === 'student' && sessionCtx.userId !== args.studentId) {
      throw new Error('Unauthorized: Students can only view their own engagement');
    }

    // Get the definition to use
    let definition;
    if (args.definitionId) {
      definition = await ctx.db.get(args.definitionId);
      if (!definition) {
        throw new Error('Engagement definition not found');
      }
      // Validate definition belongs to the student's university
      if (definition.university_id !== student.university_id) {
        throw new Error('Unauthorized: Definition is not in your university');
      }
    } else {
      // Use default definition
      const definitions = await ctx.db
        .query('engagement_definitions')
        .withIndex('by_university_active', (q) =>
          q.eq('university_id', student.university_id!).eq('is_active', true),
        )
        .collect();
      definition = definitions.find((d) => d.is_default) || definitions[0];
    }

    if (!definition) {
      return {
        score: null,
        status: 'unknown' as const,
        message: 'No engagement definition configured for this university',
        qualifying_events_count: 0,
        last_qualifying_event: null,
        days_since_activity: null,
      };
    }

    // Get criteria from definition
    const criteria: EngagementCriteria = definition.criteria || {
      period_days: 14,
      min_events_in_period: 3,
    };

    // Get qualifying events
    const { totalCount, uniqueDays, lastEventAt } = await getQualifyingEvents(
      ctx,
      args.studentId,
      criteria,
    );

    // Calculate days since last activity
    const daysSinceActivity = lastEventAt
      ? Math.floor((Date.now() - lastEventAt) / (1000 * 60 * 60 * 24))
      : null;

    // Calculate engagement score and status using shared helpers
    const score = calculateEngagementScore(totalCount, uniqueDays, lastEventAt, criteria);
    const status = determineEngagementStatus(
      score,
      definition.engaged_threshold,
      definition.at_risk_threshold,
    );

    return {
      score,
      status,
      qualifying_events_count: totalCount,
      last_qualifying_event: lastEventAt,
      days_since_activity: daysSinceActivity,
      unique_active_days: uniqueDays,
      period_days: criteria.period_days || 14,
      definition_id: definition._id,
      definition_name: definition.name,
    };
  },
});

/**
 * Get engagement analytics for a university.
 * Provides aggregated engagement metrics with optional filtering.
 *
 * Performance note: This query executes one DB query per student (N+1 pattern).
 * For large universities (1000+ students), consider caching engagement scores
 * on user records via scheduled job to avoid timeout issues.
 */
export const getEngagementAnalytics = query({
  args: {
    universityId: v.id('universities'),
    cohortIds: v.optional(v.array(v.string())),
    programIds: v.optional(v.array(v.string())),
    groupBy: v.optional(v.union(v.literal('cohort'), v.literal('program'))),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);

    // Authorization: Only university_admin, advisor, or super_admin can access analytics
    const allowedRoles = ['super_admin', 'university_admin', 'advisor'];
    if (!allowedRoles.includes(sessionCtx.role)) {
      throw new Error(
        'Unauthorized: Only administrators and advisors can access engagement analytics',
      );
    }

    // University scope check for non-super_admin
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (universityId !== args.universityId) {
        throw new Error('Unauthorized: Cannot access analytics for another university');
      }
    }

    // Get the default engagement definition
    const definitions = await ctx.db
      .query('engagement_definitions')
      .withIndex('by_university_active', (q) =>
        q.eq('university_id', args.universityId).eq('is_active', true),
      )
      .collect();
    const definition = definitions.find((d) => d.is_default) || definitions[0];

    if (!definition) {
      return {
        total_students: 0,
        engaged_students: 0,
        moderate_students: 0,
        at_risk_students: 0,
        engaged_percent: 0,
        moderate_percent: 0,
        at_risk_percent: 0,
        breakdown: {},
        definition_name: null,
      };
    }

    const criteria: EngagementCriteria = definition.criteria || {
      period_days: 14,
      min_events_in_period: 3,
    };

    // Get all students for the university
    let students = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .filter((q) => q.eq(q.field('role'), 'student'))
      .collect();

    // Apply cohort filter if specified (students may not have cohort_id directly)
    // Note: cohort filtering would require joining with student_outcomes table
    // For now, we skip cohort filtering if students don't have direct cohort_id
    if (args.cohortIds && args.cohortIds.length > 0) {
      // TODO: Implement cohort filtering via student_outcomes join
    }

    // Apply program/department filter if specified
    if (args.programIds && args.programIds.length > 0) {
      students = students.filter(
        (s) => s.department_id && args.programIds!.includes(s.department_id.toString()),
      );
    }

    // Use cached engagement scores for O(1) analytics (vs O(N) per-student queries)
    // Scores are recalculated periodically via scheduled job in engagement_cache.ts
    const engagementResults: Array<{
      studentId: Id<'users'>;
      status: 'engaged' | 'moderate' | 'at_risk';
      score: number;
      cohortId?: string;
      programId?: string;
    }> = [];

    for (const student of students) {
      // Use cached engagement status/score if available and fresh (< 24 hours old)
      const cacheAge = student.engagement_calculated_at
        ? Date.now() - student.engagement_calculated_at
        : Infinity;
      const isCacheFresh = cacheAge < 24 * 60 * 60 * 1000; // 24 hours

      const cachedStatus = student.engagement_status;
      const isValidStatus =
        cachedStatus === 'engaged' || cachedStatus === 'moderate' || cachedStatus === 'at_risk';

      if (isValidStatus && student.engagement_score != null && isCacheFresh) {
        engagementResults.push({
          studentId: student._id,
          status: cachedStatus,
          score: student.engagement_score,
          cohortId: undefined,
          programId: student.department_id?.toString(),
        });
      } else {
        // Fallback to real-time calculation for students without cached data
        const { totalCount, uniqueDays, lastEventAt } = await getQualifyingEvents(
          ctx,
          student._id,
          criteria,
        );

        const score = calculateEngagementScore(totalCount, uniqueDays, lastEventAt, criteria);
        const status = determineEngagementStatus(
          score,
          definition.engaged_threshold,
          definition.at_risk_threshold,
        );

        engagementResults.push({
          studentId: student._id,
          status,
          score,
          cohortId: undefined,
          programId: student.department_id?.toString(),
        });
      }
    }

    // Calculate summary metrics
    const totalStudents = engagementResults.length;
    const engagedCount = engagementResults.filter((r) => r.status === 'engaged').length;
    const moderateCount = engagementResults.filter((r) => r.status === 'moderate').length;
    const atRiskCount = engagementResults.filter((r) => r.status === 'at_risk').length;

    // Calculate breakdown by group if requested
    const breakdown: Record<
      string,
      { engaged: number; moderate: number; at_risk: number; total: number; engaged_percent: number }
    > = {};

    if (args.groupBy) {
      const groupKey = args.groupBy === 'cohort' ? 'cohortId' : 'programId';

      for (const result of engagementResults) {
        const groupValue = result[groupKey] || 'unknown';
        if (!breakdown[groupValue]) {
          breakdown[groupValue] = {
            engaged: 0,
            moderate: 0,
            at_risk: 0,
            total: 0,
            engaged_percent: 0,
          };
        }
        breakdown[groupValue].total++;
        breakdown[groupValue][result.status]++;
      }

      // Calculate percentages for each group
      for (const key of Object.keys(breakdown)) {
        const group = breakdown[key];
        group.engaged_percent =
          group.total > 0 ? Math.round((group.engaged / group.total) * 100) : 0;
      }
    }

    return {
      total_students: totalStudents,
      engaged_students: engagedCount,
      moderate_students: moderateCount,
      at_risk_students: atRiskCount,
      engaged_percent: totalStudents > 0 ? Math.round((engagedCount / totalStudents) * 100) : 0,
      moderate_percent: totalStudents > 0 ? Math.round((moderateCount / totalStudents) * 100) : 0,
      at_risk_percent: totalStudents > 0 ? Math.round((atRiskCount / totalStudents) * 100) : 0,
      breakdown,
      definition_name: definition.name,
      period_days: criteria.period_days,
    };
  },
});

/**
 * Get unique engaged student statistics for leadership dashboard.
 * Returns unduplicated count of students with qualifying activity.
 *
 * Performance note: This query executes one DB query per student (N+1 pattern).
 * For large universities (1000+ students), consider caching engagement scores
 * on user records via scheduled job to avoid timeout issues.
 */
export const getUniqueEngagedStats = query({
  args: {
    universityId: v.id('universities'),
    cohortIds: v.optional(v.array(v.string())),
    programIds: v.optional(v.array(v.string())),
    definitionId: v.optional(v.id('engagement_definitions')),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);

    // Authorization: Only university_admin, advisor, or super_admin can access stats
    const allowedRoles = ['super_admin', 'university_admin', 'advisor'];
    if (!allowedRoles.includes(sessionCtx.role)) {
      throw new Error('Unauthorized: Only administrators and advisors can access engagement stats');
    }

    // University scope check for non-super_admin
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (universityId !== args.universityId) {
        throw new Error('Unauthorized: Cannot access stats for another university');
      }
    }

    // Get engagement definition
    let definition;
    if (args.definitionId) {
      definition = await ctx.db.get(args.definitionId);
    } else {
      const definitions = await ctx.db
        .query('engagement_definitions')
        .withIndex('by_university_active', (q) =>
          q.eq('university_id', args.universityId).eq('is_active', true),
        )
        .collect();
      definition = definitions.find((d) => d.is_default) || definitions[0];
    }

    if (!definition) {
      return {
        total_students: 0,
        engaged_students: 0,
        engaged_percent: 0,
        at_risk_students: 0,
        at_risk_percent: 0,
        breakdown_by_status: { engaged: 0, moderate: 0, at_risk: 0 },
        by_cohort: {},
        by_program: {},
      };
    }

    const criteria: EngagementCriteria = definition.criteria || {
      period_days: 14,
      min_events_in_period: 3,
    };

    // Get all students
    let students = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .filter((q) => q.eq(q.field('role'), 'student'))
      .collect();

    // Apply filters
    // Note: cohort filtering not directly available on users table
    if (args.cohortIds && args.cohortIds.length > 0) {
      // TODO: Implement cohort filtering via student_outcomes join
    }
    if (args.programIds && args.programIds.length > 0) {
      students = students.filter(
        (s) => s.department_id && args.programIds!.includes(s.department_id.toString()),
      );
    }

    // Calculate engagement for each student and track by group
    const byProgram: Record<string, { engaged: number; total: number; percent: number }> = {};
    let engaged = 0;
    let moderate = 0;
    let atRisk = 0;

    for (const student of students) {
      // Use cached engagement status/score if available and fresh (< 24 hours old)
      const cacheAge = student.engagement_calculated_at
        ? Date.now() - student.engagement_calculated_at
        : Infinity;
      const isCacheFresh = cacheAge < 24 * 60 * 60 * 1000;

      let status: 'engaged' | 'moderate' | 'at_risk';

      // Validate cached status is a known value before using it
      const cachedStatus = student.engagement_status;
      const isValidCachedStatus =
        cachedStatus === 'engaged' || cachedStatus === 'moderate' || cachedStatus === 'at_risk';

      if (isValidCachedStatus && student.engagement_score != null && isCacheFresh) {
        // Use cached values (score not needed here, only status is used for counting)
        status = cachedStatus;
      } else {
        // Fallback to real-time calculation
        const { totalCount, uniqueDays, lastEventAt } = await getQualifyingEvents(
          ctx,
          student._id,
          criteria,
        );

        const score = calculateEngagementScore(totalCount, uniqueDays, lastEventAt, criteria);
        status = determineEngagementStatus(
          score,
          definition.engaged_threshold,
          definition.at_risk_threshold,
        );
      }

      // Count by status
      if (status === 'engaged') {
        engaged++;
      } else if (status === 'at_risk') {
        atRisk++;
      } else {
        moderate++;
      }

      // Track by cohort (users don't have cohort_id directly, skipping)
      // Would need to join with student_outcomes for cohort tracking

      // Track by program/department
      const programKey = student.department_id?.toString() || 'unknown';
      if (!byProgram[programKey]) {
        byProgram[programKey] = { engaged: 0, total: 0, percent: 0 };
      }
      byProgram[programKey].total++;
      if (status === 'engaged') byProgram[programKey].engaged++;
    }

    // Calculate percentages
    for (const key of Object.keys(byProgram)) {
      byProgram[key].percent =
        byProgram[key].total > 0
          ? Math.round((byProgram[key].engaged / byProgram[key].total) * 100)
          : 0;
    }

    const totalStudents = students.length;

    return {
      total_students: totalStudents,
      engaged_students: engaged,
      engaged_percent: totalStudents > 0 ? Math.round((engaged / totalStudents) * 100) : 0,
      at_risk_students: atRisk,
      at_risk_percent: totalStudents > 0 ? Math.round((atRisk / totalStudents) * 100) : 0,
      breakdown_by_status: { engaged, moderate, at_risk: atRisk },
      // TODO: Implement when student-cohort relationships are available
      by_cohort: {},
      by_program: byProgram,
    };
  },
});
