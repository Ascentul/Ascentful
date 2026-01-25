import { ConvexError, v } from 'convex/values';

import { internalMutation, mutation, query } from './_generated/server';
import { buildApplicationRelationship } from './lib/followUpValidation';
import { getAuthenticatedUser } from './lib/roles';

// Get all follow-ups for a user
// SECURITY: Uses authenticated user from JWT, not client-supplied clerkId
export const getUserFollowups = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    const followups = await ctx.db
      .query('follow_ups')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .order('desc')
      .collect();

    // Get associated applications and contacts for each follow-up
    const followupsWithDetails = await Promise.all(
      followups.map(async (followup) => {
        const application = followup.application_id
          ? await ctx.db.get(followup.application_id)
          : null;
        const contact = followup.contact_id ? await ctx.db.get(followup.contact_id) : null;

        return {
          ...followup,
          application,
          contact,
        };
      }),
    );

    return followupsWithDetails;
  },
});

export const getFollowupsForApplication = query({
  args: { applicationId: v.id('applications') },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const items = await ctx.db
      .query('follow_ups')
      .withIndex('by_application', (q) => q.eq('application_id', args.applicationId))
      .order('desc')
      .collect();

    return items.filter((f) => f.user_id === user._id);
  },
});

export const createFollowup = mutation({
  args: {
    applicationId: v.id('applications'),
    description: v.string(),
    due_at: v.optional(v.number()),
    notes: v.optional(v.string()),
    type: v.optional(v.string()),
    priority: v.optional(
      v.union(v.literal('low'), v.literal('medium'), v.literal('high'), v.literal('urgent')),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const now = Date.now();
    const title = args.description?.trim().substring(0, 100) || `${args.type || 'Follow-up'} task`;

    // Determine created_by_type based on user role
    const userRole = user.role;
    const createdByType =
      userRole === 'student'
        ? 'student'
        : userRole === 'advisor'
          ? 'advisor'
          : userRole === 'individual'
            ? 'individual'
            : 'student'; // Treat other roles as student for follow-up ownership

    const id = await ctx.db.insert('follow_ups', {
      // Core fields
      title,
      description: args.description,
      type: args.type ?? 'follow_up',
      notes: args.notes,

      // Ownership - student-created
      user_id: user._id,
      owner_id: user._id,
      created_by_id: user._id,
      created_by_type: createdByType,

      // Multi-tenancy (optional for non-university users)
      university_id: user.university_id,

      // Relationships (dual-field pattern: populate both generic and typed fields)
      // Using helper to ensure consistency between generic and typed fields
      ...buildApplicationRelationship(args.applicationId),

      // Task management
      due_at: args.due_at,
      priority: args.priority,
      status: 'open',
      version: 0, // Initialize for optimistic locking on status changes

      // Timestamps
      created_at: now,
      updated_at: now,
    });

    return id;
  },
});

export const updateFollowup = mutation({
  args: {
    followupId: v.id('follow_ups'),
    updates: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      due_at: v.optional(v.number()),
      notes: v.optional(v.string()),
      type: v.optional(v.string()),
      status: v.optional(v.union(v.literal('open'), v.literal('done'))),
      priority: v.optional(
        v.union(v.literal('low'), v.literal('medium'), v.literal('high'), v.literal('urgent')),
      ),
    }),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const item = await ctx.db.get(args.followupId);
    if (!item) {
      throw new ConvexError({ message: 'Followup not found', code: 'NOT_FOUND' });
    }
    if (item.user_id !== user._id) {
      throw new ConvexError({ message: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    const now = Date.now();

    // RACE CONDITION MITIGATION: Idempotent handling for status changes
    const statusChangingToDone = args.updates.status === 'done' && item.status !== 'done';
    const statusChangingToOpen = args.updates.status === 'open' && item.status === 'done';

    // If status is already in desired state, return success (idempotent)
    if (args.updates.status === 'done' && item.status === 'done') {
      return {
        success: true,
        followupId: args.followupId,
        alreadyCompleted: true,
        completed_at: item.completed_at,
        completed_by: item.completed_by,
        verified: true,
      };
    }

    if (args.updates.status === 'open' && item.status !== 'done') {
      return {
        success: true,
        followupId: args.followupId,
        alreadyOpen: true,
        verified: true,
      };
    }

    // Build patch data with explicit typing for completion fields
    type PatchData = Partial<typeof item> & {
      updated_at: number;
      completed_at?: number | null | undefined;
      completed_by?: typeof user._id | null | undefined;
      version?: number;
    };

    const patchData: PatchData = {
      ...args.updates,
      updated_at: now,
    };

    // FERPA COMPLIANCE: Version tracking for status changes
    // Status changes affect audit trail - version increments provide audit history
    // Note: Convex mutations are serialized at document level, so concurrent
    // modifications to the same document are handled sequentially by the runtime
    if (statusChangingToDone || statusChangingToOpen) {
      const currentVersion = item.version ?? 0;
      patchData.version = currentVersion + 1;

      // Set/clear completion fields based on status change
      if (statusChangingToDone) {
        patchData.completed_at = now;
        patchData.completed_by = user._id;
      } else if (statusChangingToOpen) {
        // Clear completion fields when reopening
        // Use null (not undefined) to actually clear the fields in Convex patch()
        patchData.completed_at = null;
        patchData.completed_by = null;
      }

      await ctx.db.patch(args.followupId, patchData);

      // Return consistent shape with idempotent paths
      return {
        success: true,
        followupId: args.followupId,
        alreadyCompleted: false,
        alreadyOpen: false,
        completed_at: statusChangingToDone ? now : undefined,
        completed_by: statusChangingToDone ? user._id : undefined,
        version: currentVersion + 1,
      };
    } else {
      // Non-status updates don't need optimistic locking
      await ctx.db.patch(args.followupId, patchData);
      return {
        success: true,
        followupId: args.followupId,
      };
    }
  },
});

export const deleteFollowup = mutation({
  args: { followupId: v.id('follow_ups') },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const item = await ctx.db.get(args.followupId);
    if (!item) {
      throw new ConvexError({ message: 'Followup not found', code: 'NOT_FOUND' });
    }
    if (item.user_id !== user._id) {
      throw new ConvexError({ message: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    await ctx.db.delete(args.followupId);
    return args.followupId;
  },
});

// ============================================================================
// INTERNAL MUTATIONS (System/Cron Use)
// ============================================================================

/**
 * Create a follow-up from an engagement signal.
 * Called by the signal evaluation system when a rule with auto_create_followup is triggered.
 *
 * @param signalId - The signal that triggered this follow-up
 * @param studentId - The student who needs follow-up
 * @param universityId - The university for tenant isolation
 * @param title - Title of the follow-up task
 * @param description - Description of what needs to be done
 * @param priority - Priority level
 * @param dueInDays - Number of days until due (optional)
 */
export const createFollowupFromSignal = internalMutation({
  args: {
    signalId: v.id('signals'),
    studentId: v.id('users'),
    universityId: v.optional(v.id('universities')),
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.optional(
      v.union(v.literal('low'), v.literal('medium'), v.literal('high'), v.literal('urgent')),
    ),
    dueInDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Defensive: verify signal exists before creating follow-up
    const signal = await ctx.db.get(args.signalId);
    if (!signal) {
      throw new ConvexError({ message: 'Signal not found', code: 'NOT_FOUND' });
    }

    // Defensive: verify student exists
    const student = await ctx.db.get(args.studentId);
    if (!student) {
      throw new ConvexError({ message: 'Student not found', code: 'NOT_FOUND' });
    }

    // Idempotency check: prevent duplicate follow-ups for the same signal
    const existing = await ctx.db
      .query('follow_ups')
      .withIndex('by_engagement_signal', (q) => q.eq('engagement_signal_id', args.signalId))
      .first();
    if (existing) {
      return existing._id;
    }

    const now = Date.now();

    // Calculate due date if specified
    const dueAt = args.dueInDays ? now + args.dueInDays * 24 * 60 * 60 * 1000 : undefined;

    const followupId = await ctx.db.insert('follow_ups', {
      // Core fields
      title: args.title,
      description: args.description,
      type: 'signal_followup',

      // Ownership - system-created for student
      user_id: args.studentId,
      owner_id: args.studentId, // Student is responsible for follow-up
      created_by_type: 'system', // No created_by_id for system-generated follow-ups

      // Multi-tenancy
      university_id: args.universityId,

      // Signal reference
      engagement_signal_id: args.signalId,

      // Related entity (using generic pattern for signals)
      related_type: 'general',

      // Task management
      due_at: dueAt,
      priority: args.priority ?? 'medium',
      status: 'open',
      version: 0,

      // Timestamps
      created_at: now,
      updated_at: now,
    });

    return followupId;
  },
});
