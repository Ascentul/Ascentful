import { v } from 'convex/values';

import { api } from './_generated/api';
import { mutation, query } from './_generated/server';
import { safeLogAudit } from './lib/auditLogger';
import { requireMembership } from './lib/roles';
import { mapStatusToStage } from './migrate_application_status_to_stage';

// Get applications for a user
export const getUserApplications = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    // Note: We don't require membership for read queries - users can always view their own applications
    // Membership is only used for write operations and tenant isolation

    // OPTIMIZED: Add limit to prevent bandwidth issues for power users
    const applications = await ctx.db
      .query('applications')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .order('desc')
      .take(500); // Limit to 500 most recent applications

    return applications;
  },
});

// Create a new application
export const createApplication = mutation({
  args: {
    clerkId: v.string(),
    company: v.string(),
    job_title: v.string(),
    status: v.union(
      v.literal('saved'),
      v.literal('applied'),
      v.literal('interview'),
      v.literal('offer'),
      v.literal('rejected'),
    ),
    source: v.optional(v.string()),
    url: v.optional(v.string()),
    notes: v.optional(v.string()),
    logo_url: v.optional(v.string()),
    applied_at: v.optional(v.number()),
    resume_id: v.optional(v.id('resumes')),
    cover_letter_id: v.optional(v.id('cover_letters')),
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

    // ARCHITECTURE NOTE: Free plan limits are enforced at the FRONTEND layer
    // - Clerk Billing (publicMetadata) is the source of truth for subscriptions
    // - Frontend enforces via useSubscription() hook + Clerk's has() method
    // - Backend subscription_plan is cached display data only (see CLAUDE.md)
    // - Defense-in-depth: Consider adding hasPremium arg from frontend for backend validation

    // if (user.subscription_plan === "free") {
    //   const FREE_PLAN_LIMIT = 1;
    //   const existingApplications = await ctx.db
    //     .query("applications")
    //     .withIndex("by_user", (q) => q.eq("user_id", user._id))
    //     .take(FREE_PLAN_LIMIT + 1);
    //
    //   if (existingApplications.length >= FREE_PLAN_LIMIT) {
    //     throw new Error("Free plan limit reached. Upgrade to Premium for unlimited applications.");
    //   }
    // }

    const now = Date.now();

    const applicationId = await ctx.db.insert('applications', {
      user_id: user._id,
      university_id: membership?.university_id ?? user.university_id,
      company: args.company,
      job_title: args.job_title,
      status: args.status,
      // MIGRATION: Sync stage field from status for data consistency
      // See docs/TECH_DEBT_APPLICATION_STATUS_STAGE.md
      stage: mapStatusToStage(args.status),
      stage_set_at: now,
      source: args.source,
      url: args.url,
      notes: args.notes,
      logo_url: args.logo_url,
      applied_at: args.applied_at,
      resume_id: args.resume_id,
      cover_letter_id: args.cover_letter_id,
      created_at: now,
      updated_at: now,
    });

    // Track activity for streak (fire-and-forget)
    await ctx.scheduler.runAfter(0, api.activity.markActionForToday, {});

    // Audit log: application created
    await safeLogAudit(ctx, {
      category: 'user_action',
      action: 'application.created',
      actorUserId: user._id,
      actorRole: user.role,
      actorUniversityId: user.university_id,
      targetType: 'application',
      targetId: applicationId,
      metadata: {
        company: args.company,
        job_title: args.job_title,
        status: args.status,
      },
    });

    return applicationId;
  },
});

// Update an application
export const updateApplication = mutation({
  args: {
    clerkId: v.string(),
    applicationId: v.id('applications'),
    updates: v.object({
      company: v.optional(v.string()),
      job_title: v.optional(v.string()),
      status: v.optional(
        v.union(
          v.literal('saved'),
          v.literal('applied'),
          v.literal('interview'),
          v.literal('offer'),
          v.literal('rejected'),
        ),
      ),
      source: v.optional(v.union(v.string(), v.null())),
      url: v.optional(v.union(v.string(), v.null())),
      notes: v.optional(v.union(v.string(), v.null())),
      applied_at: v.optional(v.union(v.number(), v.null())),
      resume_id: v.optional(v.union(v.id('resumes'), v.null())),
      cover_letter_id: v.optional(v.union(v.id('cover_letters'), v.null())),
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

    const application = await ctx.db.get(args.applicationId);
    if (!application || application.user_id !== user._id) {
      throw new Error('Application not found or unauthorized');
    }

    // University isolation check
    if (
      application.university_id &&
      membership &&
      application.university_id !== membership.university_id
    ) {
      throw new Error('Unauthorized: Application belongs to another university');
    }

    const now = Date.now();

    // Convert null values to undefined for Convex patch
    const cleanedUpdates = Object.fromEntries(
      Object.entries(args.updates).map(([key, value]) => [key, value === null ? undefined : value]),
    );

    // MIGRATION: Sync stage field when status changes
    // See docs/TECH_DEBT_APPLICATION_STATUS_STAGE.md
    const patchData: any = {
      ...cleanedUpdates,
      updated_at: now,
    };

    if (args.updates.status) {
      patchData.stage = mapStatusToStage(args.updates.status);
      patchData.stage_set_at = now;
    }

    await ctx.db.patch(args.applicationId, patchData);

    // Audit log: application updated (track status changes specifically)
    const action = args.updates.status ? 'application.status_changed' : 'application.updated';
    await safeLogAudit(ctx, {
      category: 'user_action',
      action,
      actorUserId: user._id,
      actorRole: user.role,
      actorUniversityId: user.university_id,
      targetType: 'application',
      targetId: args.applicationId,
      previousValue: args.updates.status ? { status: application.status } : undefined,
      newValue: args.updates.status ? { status: args.updates.status } : undefined,
      metadata: {
        company: application.company,
        updatedFields: Object.keys(args.updates),
      },
    });

    return args.applicationId;
  },
});

// Delete an application
export const deleteApplication = mutation({
  args: {
    clerkId: v.string(),
    applicationId: v.id('applications'),
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

    const application = await ctx.db.get(args.applicationId);
    if (!application || application.user_id !== user._id) {
      throw new Error('Application not found or unauthorized');
    }

    if (
      application.university_id &&
      membership &&
      application.university_id !== membership.university_id
    ) {
      throw new Error('Unauthorized: Application belongs to another university');
    }

    await ctx.db.delete(args.applicationId);

    // Audit log: application deleted
    await safeLogAudit(ctx, {
      category: 'user_action',
      action: 'application.deleted',
      actorUserId: user._id,
      actorRole: user.role,
      actorUniversityId: user.university_id,
      targetType: 'application',
      targetId: args.applicationId,
      previousValue: {
        company: application.company,
        job_title: application.job_title,
        status: application.status,
      },
    });

    return args.applicationId;
  },
});

// Get applications by status
export const getApplicationsByStatus = query({
  args: {
    clerkId: v.string(),
    status: v.union(
      v.literal('saved'),
      v.literal('applied'),
      v.literal('interview'),
      v.literal('offer'),
      v.literal('rejected'),
    ),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    // OPTIMIZED: Add limit to prevent bandwidth issues
    const applications = await ctx.db
      .query('applications')
      .withIndex('by_status', (q) => q.eq('status', args.status))
      .filter((q) => q.eq(q.field('user_id'), user._id))
      .take(500); // Limit to 500 applications per status

    return applications;
  },
});

// ============================================================================
// KANBAN BOARD QUERIES AND MUTATIONS
// ============================================================================

type ApplicationStatus = 'saved' | 'applied' | 'interview' | 'offer' | 'rejected';

/**
 * Get applications grouped by status for Kanban board display.
 * Each group is sorted by sort_order (ascending) for drag-and-drop ordering.
 */
export const getApplicationsForKanban = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    // Get all applications for this user
    const applications = await ctx.db
      .query('applications')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .collect();

    // Group by status
    const grouped: Record<ApplicationStatus, typeof applications> = {
      saved: [],
      applied: [],
      interview: [],
      offer: [],
      rejected: [],
    };

    for (const app of applications) {
      const status = app.status as ApplicationStatus;
      if (grouped[status]) {
        grouped[status].push(app);
      }
    }

    // Sort each group by sort_order (nulls at end, then by updated_at desc)
    for (const status of Object.keys(grouped) as ApplicationStatus[]) {
      grouped[status].sort((a, b) => {
        // Both have sort_order: compare them
        if (a.sort_order != null && b.sort_order != null) {
          return a.sort_order - b.sort_order;
        }
        // Only a has sort_order: a comes first
        if (a.sort_order != null) return -1;
        // Only b has sort_order: b comes first
        if (b.sort_order != null) return 1;
        // Neither has sort_order: sort by updated_at desc (most recent first)
        return (b.updated_at || 0) - (a.updated_at || 0);
      });
    }

    return grouped;
  },
});

const SORT_ORDER_GAP = 1000;
const MIN_SORT_ORDER_GAP = 0.0001;

/**
 * Calculate new sort_order for an application being moved.
 * Uses fractional indexing to avoid rewriting neighbors.
 */
function calculateNewSortOrder(
  beforeOrder: number | null | undefined,
  afterOrder: number | null | undefined,
): number {
  // Inserting at the start of an empty column
  if (beforeOrder == null && afterOrder == null) {
    return SORT_ORDER_GAP;
  }
  // Inserting at the start (before first item)
  if (beforeOrder == null) {
    return afterOrder! - SORT_ORDER_GAP;
  }
  // Inserting at the end (after last item)
  if (afterOrder == null) {
    return beforeOrder + SORT_ORDER_GAP;
  }
  // Inserting between two items
  return (beforeOrder + afterOrder) / 2;
}

/**
 * Move an application to a new status column and/or position.
 * Handles both cross-column moves and within-column reordering.
 */
export const moveApplication = mutation({
  args: {
    clerkId: v.string(),
    applicationId: v.id('applications'),
    newStatus: v.union(
      v.literal('saved'),
      v.literal('applied'),
      v.literal('interview'),
      v.literal('offer'),
      v.literal('rejected'),
    ),
    // IDs of applications that will be neighbors after the move
    beforeId: v.optional(v.id('applications')), // Application that will be ABOVE (lower sort_order)
    afterId: v.optional(v.id('applications')), // Application that will be BELOW (higher sort_order)
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

    // Get the application being moved
    const application = await ctx.db.get(args.applicationId);
    if (!application || application.user_id !== user._id) {
      throw new Error('Application not found or unauthorized');
    }

    // University isolation check
    if (
      application.university_id &&
      membership &&
      application.university_id !== membership.university_id
    ) {
      throw new Error('Unauthorized: Application belongs to another university');
    }

    // Get neighbor sort_orders if provided
    let beforeOrder: number | null = null;
    let afterOrder: number | null = null;

    if (args.beforeId) {
      const beforeApp = await ctx.db.get(args.beforeId);
      if (beforeApp && beforeApp.user_id === user._id) {
        beforeOrder = beforeApp.sort_order ?? null;
      }
    }

    if (args.afterId) {
      const afterApp = await ctx.db.get(args.afterId);
      if (afterApp && afterApp.user_id === user._id) {
        afterOrder = afterApp.sort_order ?? null;
      }
    }

    // Calculate new sort_order
    const newSortOrder = calculateNewSortOrder(beforeOrder, afterOrder);

    // Check if rebalancing is needed (gap too small)
    const needsRebalance =
      (beforeOrder != null &&
        afterOrder != null &&
        Math.abs(afterOrder - beforeOrder) < MIN_SORT_ORDER_GAP) ||
      // Start-of-column inserts can also degrade when afterOrder becomes very small
      (beforeOrder == null && afterOrder != null && Math.abs(afterOrder) < MIN_SORT_ORDER_GAP);

    const now = Date.now();
    const previousStatus = application.status;
    const statusChanged = previousStatus !== args.newStatus;

    // Prepare update
    const updates: Record<string, unknown> = {
      sort_order: newSortOrder,
      updated_at: now,
    };

    // If status is changing, update status and stage
    if (statusChanged) {
      updates.status = args.newStatus;
      updates.stage = mapStatusToStage(args.newStatus);
      updates.stage_set_at = now;
    }

    // Update the application
    await ctx.db.patch(args.applicationId, updates);

    // Audit log for status changes
    if (statusChanged) {
      await safeLogAudit(ctx, {
        category: 'user_action',
        action: 'application.status_changed',
        actorUserId: user._id,
        actorRole: user.role,
        actorUniversityId: user.university_id,
        targetType: 'application',
        targetId: args.applicationId,
        previousValue: { status: previousStatus },
        newValue: { status: args.newStatus },
        metadata: {
          company: application.company,
          source: 'kanban_drag',
        },
      });
    }

    return {
      success: true,
      applicationId: args.applicationId,
      newStatus: args.newStatus,
      newSortOrder,
      needsRebalance,
    };
  },
});
