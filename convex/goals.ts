import { v } from 'convex/values';

import { api } from './_generated/api';
import { mutation, query } from './_generated/server';
import { ACTIVITY_EVENTS, trackActivity } from './lib/activityTracker';
import { safeLogAudit } from './lib/auditLogger';
import { createLogContext, log, toErrorCode } from './lib/logger';
import { requireMembership } from './lib/roles';

// Get goals for a Clerk user
export const getUserGoals = query({
  args: {
    clerkId: v.string(),
    correlationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const logCtx = createLogContext('goal', args.correlationId);

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      log('warn', 'User not found for goals query', {
        ...logCtx,
        event: 'query.user_not_found',
        clerkId: args.clerkId,
      });
      throw new Error('User not found');
    }

    // Note: We don't require membership for read queries - users can always view their own goals
    // Membership is only used for write operations and tenant isolation

    // OPTIMIZED: Add limit to prevent bandwidth issues for power users
    const goals = await ctx.db
      .query('goals')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .order('desc')
      .take(200); // Limit to 200 most recent goals

    log('debug', 'Goals fetched', {
      ...logCtx,
      event: 'query.success',
      userId: user._id,
      extra: { goalsCount: goals.length },
    });

    return goals;
  },
});

const statusValidator = v.union(
  v.literal('not_started'),
  v.literal('in_progress'),
  v.literal('active'),
  v.literal('completed'),
  v.literal('paused'),
  v.literal('cancelled'),
);

const checklistItem = v.object({
  id: v.string(),
  text: v.string(),
  completed: v.boolean(),
});

// Create goal
export const createGoal = mutation({
  args: {
    clerkId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.optional(statusValidator),
    target_date: v.optional(v.number()),
    progress: v.optional(v.number()),
    checklist: v.optional(v.array(checklistItem)),
    category: v.optional(v.string()),
    correlationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const logCtx = createLogContext('goal', args.correlationId);

    log('info', 'Creating goal', {
      ...logCtx,
      event: 'operation.start',
      clerkId: args.clerkId,
    });

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      log('warn', 'User not found for goal creation', {
        ...logCtx,
        event: 'operation.user_not_found',
        clerkId: args.clerkId,
      });
      throw new Error('User not found');
    }

    // Only require membership for university-affiliated students
    // Individual users can create goals without a membership
    let membership = null;
    if (user.role === 'student' && user.university_id) {
      try {
        membership = (await requireMembership(ctx, { role: 'student' })).membership;
      } catch {
        // If membership check fails but user has university_id, continue without membership
        // This handles edge cases during onboarding or membership transitions
        membership = null;
      }
    }

    // ARCHITECTURE NOTE: Free plan limits are enforced at the FRONTEND layer
    // - Clerk Billing (publicMetadata) is the source of truth for subscriptions
    // - Frontend enforces via useSubscription() hook + Clerk's has() method
    // - Backend subscription_plan is cached display data only (see CLAUDE.md)
    // - Defense-in-depth: Consider adding hasPremium arg from frontend for backend validation

    // if (user.subscription_plan === "free") {
    //   const FREE_PLAN_LIMIT = 1;
    //   const existingGoals = await ctx.db
    //     .query("goals")
    //     .withIndex("by_user", (q) => q.eq("user_id", user._id))
    //     .take(FREE_PLAN_LIMIT + 1);
    //
    //   if (existingGoals.length >= FREE_PLAN_LIMIT) {
    //     throw new Error("Free plan limit reached. Upgrade to Premium for unlimited goals.");
    //   }
    // }

    const now = Date.now();
    // Compute goal's university_id once for consistent attribution
    const goalUniversityId = membership?.university_id ?? user.university_id;
    const id = await ctx.db.insert('goals', {
      user_id: user._id,
      university_id: goalUniversityId,
      title: args.title,
      description: args.description,
      category: args.category,
      target_date: args.target_date,
      status: args.status ?? 'not_started',
      progress: args.progress ?? 0,
      checklist: args.checklist,
      created_at: now,
      updated_at: now,
    });

    // Track activity for streak (fire-and-forget)
    await ctx.scheduler.runAfter(0, api.activity.markActionForToday, {});

    // Track activity event for engagement scoring
    // Use goalUniversityId for accurate attribution to the university where the goal was created
    // Wrapped in try/catch to ensure activity tracking failures don't break the main mutation
    try {
      await trackActivity(ctx, {
        userId: user._id,
        universityId: goalUniversityId,
        eventType: ACTIVITY_EVENTS.GOAL_CREATED,
        eventCategory: 'goal',
        entityType: 'goal',
        entityId: id,
        metadata: {
          title: args.title,
          category: args.category,
          status: args.status ?? 'not_started',
        },
      });
    } catch (error) {
      console.error('Failed to track goal activity:', error);
    }

    log('info', 'Goal created successfully', {
      ...logCtx,
      event: 'operation.success',
      userId: user._id,
      extra: { goalId: id, status: args.status ?? 'not_started' },
    });

    // Audit log: goal created
    await safeLogAudit(ctx, {
      category: 'user_action',
      action: 'goal.created',
      actorUserId: user._id,
      actorRole: user.role,
      actorUniversityId: user.university_id,
      targetType: 'goal',
      targetId: id,
      metadata: {
        title: args.title,
        category: args.category,
        status: args.status ?? 'not_started',
      },
    });

    return id;
  },
});

// Update goal
export const updateGoal = mutation({
  args: {
    clerkId: v.string(),
    goalId: v.id('goals'),
    updates: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      category: v.optional(v.string()),
      target_date: v.optional(v.number()),
      status: v.optional(statusValidator),
      progress: v.optional(v.number()),
      checklist: v.optional(v.array(checklistItem)),
      completed: v.optional(v.boolean()), // accepted but not stored directly
      completed_at: v.optional(v.union(v.number(), v.null())),
    }),
    correlationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const logCtx = createLogContext('goal', args.correlationId);

    log('info', 'Updating goal', {
      ...logCtx,
      event: 'operation.start',
      extra: { goalId: args.goalId },
    });

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();
    if (!user) {
      log('warn', 'User not found for goal update', {
        ...logCtx,
        event: 'operation.user_not_found',
        clerkId: args.clerkId,
      });
      throw new Error('User not found');
    }

    // Only require membership for university-affiliated students
    let membership = null;
    if (user.role === 'student' && user.university_id) {
      try {
        membership = (await requireMembership(ctx, { role: 'student' })).membership;
      } catch {
        membership = null;
      }
    }

    const goal = await ctx.db.get(args.goalId);
    if (!goal || goal.user_id !== user._id) {
      log('warn', 'Goal not found or unauthorized', {
        ...logCtx,
        event: 'operation.unauthorized',
        userId: user._id,
        extra: { goalId: args.goalId },
      });
      throw new Error('Goal not found or unauthorized');
    }

    if (goal.university_id && membership && goal.university_id !== membership.university_id) {
      log('warn', 'Unauthorized: Goal belongs to another university', {
        ...logCtx,
        event: 'operation.unauthorized',
        userId: user._id,
        tenantId: goal.university_id,
      });
      throw new Error('Unauthorized: Goal belongs to another university');
    }

    // Remove 'completed' field as it's not in the schema
    const { completed, ...restUpdates } = args.updates;
    const updates: any = { ...restUpdates, updated_at: Date.now() };

    // Set completed_at timestamp when status is changed to completed (if not already set)
    if (
      args.updates.status === 'completed' &&
      goal.status !== 'completed' &&
      !args.updates.completed_at
    ) {
      updates.completed_at = Date.now();
    }

    // Clear completed_at if status is changed from completed to something else (if not explicitly set)
    if (
      goal.status === 'completed' &&
      args.updates.status &&
      args.updates.status !== 'completed' &&
      args.updates.completed_at === undefined
    ) {
      updates.completed_at = undefined;
    }

    await ctx.db.patch(args.goalId, updates);

    // Track activity event for engagement scoring
    // Use goal.university_id for accurate attribution to the university where the goal was created
    // Wrapped in try/catch to ensure activity tracking failures don't break the main mutation
    const wasCompleted = goal.status !== 'completed' && args.updates.status === 'completed';
    try {
      await trackActivity(ctx, {
        userId: user._id,
        universityId: goal.university_id,
        eventType: wasCompleted ? ACTIVITY_EVENTS.GOAL_COMPLETED : ACTIVITY_EVENTS.GOAL_UPDATED,
        eventCategory: 'goal',
        entityType: 'goal',
        entityId: args.goalId,
        metadata: {
          title: goal.title,
          previousStatus: goal.status,
          newStatus: args.updates.status,
          updatedFields: Object.keys(restUpdates),
        },
      });
    } catch (error) {
      console.error('Failed to track goal activity:', error);
    }

    log('info', 'Goal updated successfully', {
      ...logCtx,
      event: 'operation.success',
      userId: user._id,
      extra: {
        goalId: args.goalId,
        updatedFields: Object.keys(restUpdates),
        newStatus: args.updates.status,
      },
    });

    // Audit log: goal updated (track completion specifically)
    await safeLogAudit(ctx, {
      category: 'user_action',
      action: wasCompleted ? 'goal.completed' : 'goal.updated',
      actorUserId: user._id,
      actorRole: user.role,
      actorUniversityId: user.university_id,
      targetType: 'goal',
      targetId: args.goalId,
      previousValue: args.updates.status ? { status: goal.status } : undefined,
      newValue: args.updates.status ? { status: args.updates.status } : undefined,
      metadata: {
        title: goal.title,
        updatedFields: Object.keys(restUpdates),
      },
    });

    return args.goalId;
  },
});

// Delete goal
export const deleteGoal = mutation({
  args: {
    clerkId: v.string(),
    goalId: v.id('goals'),
    correlationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const logCtx = createLogContext('goal', args.correlationId);

    log('info', 'Deleting goal', {
      ...logCtx,
      event: 'operation.start',
      extra: { goalId: args.goalId },
    });

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();
    if (!user) {
      log('warn', 'User not found for goal deletion', {
        ...logCtx,
        event: 'operation.user_not_found',
        clerkId: args.clerkId,
      });
      throw new Error('User not found');
    }

    // Only require membership for university-affiliated students
    let membership = null;
    if (user.role === 'student' && user.university_id) {
      try {
        membership = (await requireMembership(ctx, { role: 'student' })).membership;
      } catch {
        membership = null;
      }
    }

    const goal = await ctx.db.get(args.goalId);
    if (!goal || goal.user_id !== user._id) {
      log('warn', 'Goal not found or unauthorized for deletion', {
        ...logCtx,
        event: 'operation.unauthorized',
        userId: user._id,
        extra: { goalId: args.goalId },
      });
      throw new Error('Goal not found or unauthorized');
    }

    if (goal.university_id && membership && goal.university_id !== membership.university_id) {
      log('warn', 'Unauthorized: Goal belongs to another university', {
        ...logCtx,
        event: 'operation.unauthorized',
        userId: user._id,
        tenantId: goal.university_id,
      });
      throw new Error('Unauthorized: Goal belongs to another university');
    }

    await ctx.db.delete(args.goalId);

    log('info', 'Goal deleted successfully', {
      ...logCtx,
      event: 'operation.success',
      userId: user._id,
      extra: { goalId: args.goalId },
    });

    // Audit log: goal deleted
    await safeLogAudit(ctx, {
      category: 'user_action',
      action: 'goal.deleted',
      actorUserId: user._id,
      actorRole: user.role,
      actorUniversityId: user.university_id,
      targetType: 'goal',
      targetId: args.goalId,
      previousValue: {
        title: goal.title,
        status: goal.status,
        category: goal.category,
      },
    });

    return args.goalId;
  },
});
