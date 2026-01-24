/**
 * Activity Events Module
 *
 * Tracks granular activity events for engagement signal evaluation.
 * Provides a more detailed view than user_daily_activity.
 *
 * Event Categories:
 * - auth: Login, logout, session events
 * - application: Job application actions
 * - document: Resume, cover letter actions
 * - goal: Goal creation, updates, completion
 * - networking: Contact and interaction events
 * - ai_coach: AI coaching interactions
 * - career_explorer: Career exploration actions
 *
 * Usage:
 * - Call trackEvent from mutations to record user actions
 * - Query getUserActivitySummary for engagement scoring
 * - Events older than 90 days are auto-deleted by retention cron
 */

import { v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { internalMutation, mutation, query } from './_generated/server';
import { getCurrentUser, requireTenant } from './advisor_auth';

// ============================================================================
// VALIDATORS
// ============================================================================

const eventCategoryValidator = v.union(
  v.literal('auth'),
  v.literal('application'),
  v.literal('document'),
  v.literal('goal'),
  v.literal('networking'),
  v.literal('ai_coach'),
  v.literal('career_explorer'),
);

// ============================================================================
// EVENT TRACKING
// ============================================================================

/**
 * Track a user activity event.
 * This is the main entry point for recording activity.
 */
export const trackEvent = mutation({
  args: {
    eventType: v.string(),
    eventCategory: eventCategoryValidator,
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);

    const user = await ctx.db.get(sessionCtx.userId);
    if (!user) {
      throw new Error('User not found');
    }

    const now = Date.now();

    const eventId = await ctx.db.insert('activity_events', {
      user_id: sessionCtx.userId,
      university_id: user.university_id ?? undefined,
      event_type: args.eventType,
      event_category: args.eventCategory,
      entity_type: args.entityType,
      entity_id: args.entityId,
      metadata: args.metadata,
      occurred_at: now,
      created_at: now,
    });

    return eventId;
  },
});

/**
 * Track event without auth context (internal use).
 * Use this from other mutations that already have user context.
 */
export const trackEventInternal = internalMutation({
  args: {
    userId: v.id('users'),
    universityId: v.optional(v.id('universities')),
    eventType: v.string(),
    eventCategory: eventCategoryValidator,
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const eventId = await ctx.db.insert('activity_events', {
      user_id: args.userId,
      university_id: args.universityId,
      event_type: args.eventType,
      event_category: args.eventCategory,
      entity_type: args.entityType,
      entity_id: args.entityId,
      metadata: args.metadata,
      occurred_at: now,
      created_at: now,
    });

    return eventId;
  },
});

// ============================================================================
// ACTIVITY QUERIES
// ============================================================================

/**
 * Get a user's recent activity events.
 */
export const getUserRecentEvents = query({
  args: {
    userId: v.id('users'),
    category: v.optional(eventCategoryValidator),
    limit: v.optional(v.number()),
    daysBack: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);
    const limit = args.limit ?? 50;
    const daysBack = args.daysBack ?? 30;

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Authorization: only university_admin/advisor+ can view other users' events
    if (sessionCtx.userId !== args.userId) {
      if (
        sessionCtx.role !== 'super_admin' &&
        sessionCtx.role !== 'university_admin' &&
        sessionCtx.role !== 'advisor'
      ) {
        throw new Error('Unauthorized: Cannot view events for other users');
      }
      // Additional check for university-scoped roles - must be same university
      if (sessionCtx.role === 'advisor' || sessionCtx.role === 'university_admin') {
        const universityId = requireTenant(sessionCtx);
        if (user.university_id !== universityId) {
          throw new Error('Unauthorized: User is not in your university');
        }
        // Advisors can only access their assigned students
        if (sessionCtx.role === 'advisor') {
          const assignment = await ctx.db
            .query('student_advisors')
            .withIndex('by_advisor', (q) =>
              q.eq('advisor_id', sessionCtx.userId).eq('university_id', universityId),
            )
            .filter((q) => q.eq(q.field('student_id'), args.userId))
            .first();
          if (!assignment) {
            throw new Error('Unauthorized: Student is not assigned to you');
          }
        }
      }
    }

    const cutoffTime = Date.now() - daysBack * 24 * 60 * 60 * 1000;

    // Use composite index when category is specified for accurate pagination
    if (args.category) {
      const category = args.category; // TypeScript narrowing
      return await ctx.db
        .query('activity_events')
        .withIndex('by_user_category_date', (q) =>
          q
            .eq('user_id', args.userId)
            .eq('event_category', category)
            .gte('occurred_at', cutoffTime),
        )
        .order('desc')
        .take(limit);
    }

    // No category filter - use simpler index
    return await ctx.db
      .query('activity_events')
      .withIndex('by_user_date', (q) => q.eq('user_id', args.userId).gte('occurred_at', cutoffTime))
      .order('desc')
      .take(limit);
  },
});

/**
 * Get activity summary for a user.
 * Provides aggregated counts useful for engagement scoring.
 */
export const getUserActivitySummary = query({
  args: {
    userId: v.id('users'),
    daysBack: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);
    const daysBack = args.daysBack ?? 14;

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Authorization check
    if (sessionCtx.userId !== args.userId) {
      if (
        sessionCtx.role !== 'super_admin' &&
        sessionCtx.role !== 'university_admin' &&
        sessionCtx.role !== 'advisor'
      ) {
        throw new Error('Unauthorized: Cannot view activity for other users');
      }
      // Additional check for university-scoped roles - must be same university
      if (sessionCtx.role === 'advisor' || sessionCtx.role === 'university_admin') {
        const universityId = requireTenant(sessionCtx);
        if (user.university_id !== universityId) {
          throw new Error('Unauthorized: User is not in your university');
        }
        // Advisors can only access their assigned students
        if (sessionCtx.role === 'advisor') {
          const assignment = await ctx.db
            .query('student_advisors')
            .withIndex('by_advisor', (q) =>
              q.eq('advisor_id', sessionCtx.userId).eq('university_id', universityId),
            )
            .filter((q) => q.eq(q.field('student_id'), args.userId))
            .first();
          if (!assignment) {
            throw new Error('Unauthorized: Student is not assigned to you');
          }
        }
      }
    }

    const cutoffTime = Date.now() - daysBack * 24 * 60 * 60 * 1000;

    const events = await ctx.db
      .query('activity_events')
      .withIndex('by_user_date', (q) => q.eq('user_id', args.userId).gte('occurred_at', cutoffTime))
      .collect();

    // Calculate summary
    const byCategory: Record<string, number> = {
      auth: 0,
      application: 0,
      document: 0,
      goal: 0,
      networking: 0,
      ai_coach: 0,
      career_explorer: 0,
    };

    const byEventType: Record<string, number> = {};
    const uniqueDays = new Set<string>();

    for (const event of events) {
      byCategory[event.event_category]++;
      byEventType[event.event_type] = (byEventType[event.event_type] || 0) + 1;
      uniqueDays.add(new Date(event.occurred_at).toISOString().slice(0, 10));
    }

    // Find most recent event (events are unordered from collect())
    const lastEvent =
      events.length > 0
        ? events.reduce((latest, event) =>
            event.occurred_at > latest.occurred_at ? event : latest,
          )
        : null;
    const lastEventAt = lastEvent?.occurred_at ?? null;
    const daysSinceLastEvent = lastEventAt
      ? Math.floor((Date.now() - lastEventAt) / (1000 * 60 * 60 * 24))
      : null;

    return {
      totalEvents: events.length,
      activeDays: uniqueDays.size,
      byCategory,
      byEventType,
      lastEventAt,
      daysSinceLastEvent,
      daysAnalyzed: daysBack,
    };
  },
});

/**
 * Get activity trends for a university.
 * Useful for admin dashboards.
 */
export const getUniversityActivityTrends = query({
  args: {
    universityId: v.id('universities'),
    daysBack: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);
    const daysBack = args.daysBack ?? 30;

    // Authorization check
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (universityId !== args.universityId) {
        throw new Error('Unauthorized: Cannot access activity for another university');
      }
    }

    const cutoffTime = Date.now() - daysBack * 24 * 60 * 60 * 1000;

    // Get events for the university
    const events = await ctx.db
      .query('activity_events')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .filter((q) => q.gte(q.field('occurred_at'), cutoffTime))
      .collect();

    // Group by date
    const byDate: Record<string, number> = {};
    const byCategory: Record<string, number> = {
      auth: 0,
      application: 0,
      document: 0,
      goal: 0,
      networking: 0,
      ai_coach: 0,
      career_explorer: 0,
    };

    const activeUsers = new Set<string>();

    for (const event of events) {
      const date = new Date(event.occurred_at).toISOString().slice(0, 10);
      byDate[date] = (byDate[date] || 0) + 1;
      byCategory[event.event_category]++;
      activeUsers.add(event.user_id);
    }

    // Convert to sorted array
    const dailyTrend = Object.entries(byDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalEvents: events.length,
      uniqueActiveUsers: activeUsers.size,
      byCategory,
      dailyTrend,
      daysAnalyzed: daysBack,
    };
  },
});

// ============================================================================
// MAINTENANCE
// ============================================================================

/**
 * Delete old activity events (retention policy).
 * Called by cron job to keep table size manageable.
 * Returns { deleted, complete } - if complete is false, caller should re-schedule.
 */
export const deleteOldEvents = internalMutation({
  args: {
    retentionDays: v.optional(v.number()),
    maxBatches: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const retentionDays = args.retentionDays ?? 90;
    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const maxBatches = args.maxBatches ?? 10;

    // Get old events in batches
    const batchSize = 500;
    let deleted = 0;
    let batches = 0;

    while (true) {
      // Limit iterations per invocation to avoid mutation timeout
      if (batches >= maxBatches) {
        return { deleted, complete: false };
      }

      const oldEvents = await ctx.db
        .query('activity_events')
        .filter((q) => q.lt(q.field('occurred_at'), cutoffTime))
        .take(batchSize);

      if (oldEvents.length === 0) break;

      for (const event of oldEvents) {
        await ctx.db.delete(event._id);
        deleted++;
      }
      batches++;

      // Safety limit to prevent runaway deletion
      if (deleted >= 5000) {
        return { deleted, complete: false };
      }
    }

    return { deleted, complete: true };
  },
});

// ============================================================================
// COMMON EVENT TYPES
// ============================================================================

/**
 * Standard event type constants for consistency.
 * Use these when calling trackEvent.
 */
export const EVENT_TYPES = {
  // Auth events
  LOGIN: 'login',
  LOGOUT: 'logout',
  SESSION_START: 'session_start',

  // Application events
  APPLICATION_CREATED: 'application_created',
  APPLICATION_UPDATED: 'application_updated',
  APPLICATION_STAGE_CHANGED: 'application_stage_changed',
  APPLICATION_DELETED: 'application_deleted',

  // Document events
  RESUME_CREATED: 'resume_created',
  RESUME_UPDATED: 'resume_updated',
  RESUME_ANALYZED: 'resume_analyzed',
  COVER_LETTER_CREATED: 'cover_letter_created',
  COVER_LETTER_UPDATED: 'cover_letter_updated',

  // Goal events
  GOAL_CREATED: 'goal_created',
  GOAL_UPDATED: 'goal_updated',
  GOAL_COMPLETED: 'goal_completed',
  GOAL_CHECKLIST_ITEM_COMPLETED: 'goal_checklist_item_completed',

  // Networking events
  CONTACT_ADDED: 'contact_added',
  CONTACT_UPDATED: 'contact_updated',
  INTERACTION_LOGGED: 'interaction_logged',

  // AI Coach events
  COACH_CONVERSATION_STARTED: 'coach_conversation_started',
  COACH_MESSAGE_SENT: 'coach_message_sent',

  // Career Explorer events
  CAREER_QUIZ_COMPLETED: 'career_quiz_completed',
  CAREER_PATH_CREATED: 'career_path_created',
  ROLE_SAVED: 'role_saved',
} as const;
