import { v } from 'convex/values';

import { api } from './_generated/api';
import { mutation, query } from './_generated/server';
import { ACTIVITY_EVENTS, trackActivity } from './lib/activityTracker';
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
    // Optional: Explicit stage to use instead of auto-mapping from status
    // This preserves distinct stages (e.g., Withdrawn vs Rejected) that would be lost
    // when mapping through the limited status enum
    stage: v.optional(
      v.union(
        v.literal('Prospect'),
        v.literal('Applied'),
        v.literal('Interview'),
        v.literal('Offer'),
        v.literal('Accepted'),
        v.literal('Rejected'),
        v.literal('Withdrawn'),
        v.literal('Archived'),
      ),
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
    const applicationUniversityId = membership?.university_id ?? user.university_id;

    const applicationId = await ctx.db.insert('applications', {
      user_id: user._id,
      university_id: applicationUniversityId,
      company: args.company,
      job_title: args.job_title,
      status: args.status,
      // Use explicit stage if provided, otherwise auto-map from status
      // Explicit stage preserves distinct values (Withdrawn, Archived) that would be
      // lost when mapping through the limited status enum
      stage: args.stage ?? mapStatusToStage(args.status),
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

    // Track activity event for engagement scoring
    // Wrapped in try/catch to ensure activity tracking failures don't break the main mutation
    try {
      await trackActivity(ctx, {
        userId: user._id,
        universityId: applicationUniversityId,
        eventType: ACTIVITY_EVENTS.APPLICATION_CREATED,
        eventCategory: 'application',
        entityType: 'application',
        entityId: applicationId,
        metadata: {
          company: args.company,
          job_title: args.job_title,
          status: args.status,
        },
      });
    } catch (error) {
      console.error('Failed to track application activity:', error);
    }

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

    // Track activity event for engagement scoring
    // Use application's university_id to keep activity with the application's context
    // Wrapped in try/catch to ensure activity tracking failures don't break the main mutation
    try {
      const eventType = args.updates.status
        ? ACTIVITY_EVENTS.APPLICATION_STAGE_CHANGED
        : ACTIVITY_EVENTS.APPLICATION_UPDATED;
      await trackActivity(ctx, {
        userId: user._id,
        universityId: application.university_id,
        eventType,
        eventCategory: 'application',
        entityType: 'application',
        entityId: args.applicationId,
        metadata: {
          company: application.company,
          previousStatus: args.updates.status ? application.status : undefined,
          newStatus: args.updates.status,
          updatedFields: Object.keys(args.updates),
        },
      });
    } catch (error) {
      console.error('Failed to track application activity:', error);
    }

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

    // Track activity event for engagement scoring
    // Wrapped in try/catch to ensure activity tracking failures don't break the main mutation
    try {
      await trackActivity(ctx, {
        userId: user._id,
        universityId: application.university_id,
        eventType: ACTIVITY_EVENTS.APPLICATION_DELETED,
        eventCategory: 'application',
        entityType: 'application',
        entityId: args.applicationId,
        metadata: {
          company: application.company,
          job_title: application.job_title,
          status: application.status,
        },
      });
    } catch (error) {
      console.error('Failed to track application activity:', error);
    }

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
 * Interview stage preview for card display
 */
interface InterviewStagePreview {
  id: string;
  title: string;
  scheduled_at: number;
  outcome?: 'scheduled' | 'passed' | 'failed' | null;
}

/**
 * Interview summary for Kanban card display
 */
interface InterviewSummary {
  completedCount: number;
  totalCount: number;
  stages: InterviewStagePreview[];
}

/**
 * Preview of next open follow-up action for card display
 */
interface ActionPreview {
  id: string;
  title: string;
  dueAt: number | null;
  isOverdue: boolean;
}

/**
 * Action/follow-up summary for Kanban card display
 */
interface ActionSummary {
  openCount: number;
  overdueCount: number;
  preview: ActionPreview | null;
  allActions?: ActionPreview[];
}

/**
 * Get applications grouped by status for Kanban board display.
 * Each group is sorted by sort_order (ascending) for drag-and-drop ordering.
 * Includes interview and follow-up summaries computed server-side.
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

    // Query 1: Get applications for this user (limited to 500 most recent for Kanban performance)
    const applications = await ctx.db
      .query('applications')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .order('desc')
      .take(500);

    // Query 2: Batch fetch ALL interview_stages for this user
    // Note: No limit here - we need all interviews to correctly populate the 500 applications above.
    // The data is filtered down to only those matching displayed applications.
    const allInterviews = await ctx.db
      .query('interview_stages')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .collect();

    // Query 3: Batch fetch ALL follow_ups for this user
    // Note: Same rationale as interviews - unlimited to ensure data consistency for displayed apps.
    const allFollowups = await ctx.db
      .query('follow_ups')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .collect();

    // Build Maps for O(1) lookup by application_id
    // Use string keys for consistent lookup (Convex Ids are string-compatible)
    const interviewsByApp = new Map<string, (typeof allInterviews)[number][]>();
    for (const interview of allInterviews) {
      const appId = String(interview.application_id);
      if (!interviewsByApp.has(appId)) {
        interviewsByApp.set(appId, []);
      }
      interviewsByApp.get(appId)!.push(interview);
    }

    const followupsByApp = new Map<string, (typeof allFollowups)[number][]>();
    for (const followup of allFollowups) {
      if (followup.application_id) {
        const appId = String(followup.application_id);
        if (!followupsByApp.has(appId)) {
          followupsByApp.set(appId, []);
        }
        followupsByApp.get(appId)!.push(followup);
      }
    }

    const now = Date.now();

    // Compute summaries and augment applications
    const applicationsWithSummaries = applications.map((app) => {
      const appIdStr = String(app._id);
      const stageInterviews = interviewsByApp.get(appIdStr) || [];
      const appFollowups = followupsByApp.get(appIdStr) || [];

      // Interview summary - check both interview_stages table AND embedded interviews array
      let interviewSummary: InterviewSummary | null = null;

      // First, try interview_stages table (newer normalized data)
      if (stageInterviews.length > 0) {
        const completedCount = stageInterviews.filter(
          (i) => i.outcome === 'passed' || i.outcome === 'failed',
        ).length;

        // Get only non-completed stages (scheduled or null outcome) sorted by date
        const stages = stageInterviews
          .filter((i) => i.outcome !== 'passed' && i.outcome !== 'failed')
          .sort((a, b) => (a.scheduled_at || a._creationTime) - (b.scheduled_at || b._creationTime))
          .map((i) => ({
            id: String(i._id),
            title: i.title,
            scheduled_at: i.scheduled_at || i._creationTime,
            outcome: i.outcome as 'scheduled' | 'passed' | 'failed' | null,
          }));

        interviewSummary = {
          completedCount,
          totalCount: stageInterviews.length,
          stages,
        };
      }
      // Fallback: check embedded interviews array (legacy data)
      else if (app.interviews && app.interviews.length > 0) {
        const embeddedInterviews = app.interviews;
        // Embedded interviews don't have outcome, so count past interviews as "completed"
        const completedCount = embeddedInterviews.filter((i) => i.date < now).length;

        // Get only future interviews (past ones are considered completed)
        const stages = embeddedInterviews
          .filter((i) => i.date >= now)
          .sort((a, b) => a.date - b.date)
          .map((i, idx) => ({
            id: `legacy-${idx}`,
            title: i.interview_type || 'Interview',
            scheduled_at: i.date,
            outcome: 'scheduled' as const,
          }));

        interviewSummary = {
          completedCount,
          totalCount: embeddedInterviews.length,
          stages,
        };
      }

      // Action summary with preview
      let actionSummary: ActionSummary | null = null;
      const openFollowups = appFollowups.filter((f) => f.status === 'open');
      if (openFollowups.length > 0) {
        const overdueCount = openFollowups.filter((f) => f.due_at && f.due_at < now).length;

        // Sort to get next action: prioritize overdue, then by due_at, then by created_at
        const sortedFollowups = [...openFollowups].sort((a, b) => {
          const aOverdue = a.due_at && a.due_at < now;
          const bOverdue = b.due_at && b.due_at < now;
          if (aOverdue && !bOverdue) return -1;
          if (!aOverdue && bOverdue) return 1;
          if (a.due_at && b.due_at) return a.due_at - b.due_at;
          if (a.due_at) return -1;
          if (b.due_at) return 1;
          return a.created_at - b.created_at;
        });

        const nextFollowup = sortedFollowups[0];
        const preview: ActionPreview = {
          id: String(nextFollowup._id),
          title: nextFollowup.description || 'Follow-up',
          dueAt: nextFollowup.due_at || null,
          isOverdue: nextFollowup.due_at ? nextFollowup.due_at < now : false,
        };

        // Build all actions array for expandable list
        const allActions: ActionPreview[] = sortedFollowups.map((f) => ({
          id: String(f._id),
          title: f.description || 'Follow-up',
          dueAt: f.due_at || null,
          isOverdue: f.due_at ? f.due_at < now : false,
        }));

        actionSummary = {
          openCount: openFollowups.length,
          overdueCount,
          preview,
          allActions,
        };
      }

      // Compute lastActivityAt - max of app update, interviews, followups
      const interviewTimestamps = stageInterviews.map((i) =>
        Math.max(i.updated_at || 0, i.scheduled_at || 0),
      );
      const followupTimestamps = appFollowups.map((f) => f.updated_at || f.created_at);
      const allTimestamps = [app.updated_at, ...interviewTimestamps, ...followupTimestamps].filter(
        (t): t is number => typeof t === 'number' && t > 0,
      );
      const lastActivityAt = allTimestamps.length > 0 ? Math.max(...allTimestamps) : app.updated_at;

      return {
        ...app,
        interviewSummary,
        actionSummary,
        lastActivityAt,
      };
    });

    // Group by status
    const grouped: Record<ApplicationStatus, typeof applicationsWithSummaries> = {
      saved: [],
      applied: [],
      interview: [],
      offer: [],
      rejected: [],
    };

    for (const app of applicationsWithSummaries) {
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

    // Track activity and audit log for status changes
    if (statusChanged) {
      // Track activity event for engagement scoring (consistent with updateApplication)
      // Wrapped in try/catch to ensure activity tracking failures don't break the main mutation
      try {
        await trackActivity(ctx, {
          userId: user._id,
          universityId: application.university_id,
          eventType: ACTIVITY_EVENTS.APPLICATION_STAGE_CHANGED,
          eventCategory: 'application',
          entityType: 'application',
          entityId: args.applicationId,
          metadata: {
            company: application.company,
            previousStatus,
            newStatus: args.newStatus,
            source: 'kanban_drag',
          },
        });
      } catch (error) {
        console.error('Failed to track application activity:', error);
      }

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
