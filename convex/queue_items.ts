/**
 * Advisor Action Queue Module
 *
 * Manages queue items for advisor workflow. Queue items are "owned commitments"
 * that reference signals but have their own lifecycle. Items can be created:
 * - Automatically from signals (signal activation)
 * - Manually by advisors
 * - From inbox (future integration)
 *
 * Security: Follows enterprise audit patterns with tenant isolation and FERPA compliance.
 */

import { v } from 'convex/values';
import { Doc, Id } from './_generated/dataModel';
import { internalMutation, mutation, query } from './_generated/server';
import {
  assertCanAccessStudent,
  canAccessStudent,
  getCurrentUser,
  requireAdvisorRole,
  requireTenant,
} from './advisor_auth';
import { logUserAction } from './lib/auditLogger';

// ============================================================================
// VALIDATION CONSTANTS (Enterprise-grade input validation)
// ============================================================================

const MAX_TITLE_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_NOTES_LENGTH = 2000;
const MAX_CLOSED_REASON_LENGTH = 500;
const MAX_SNOOZE_DAYS = 90;
const MAX_QUEUE_ITEMS_PER_PAGE = 100;

// ============================================================================
// TYPES
// ============================================================================

export type QueueItemStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type QueueItemPriority = 'P1' | 'P2' | 'P3';
export type QueueItemCreatedFrom = 'signal' | 'inbox' | 'manual';
export type QueueItemActionType =
  | 'created'
  | 'assigned'
  | 'reassigned'
  | 'status_changed'
  | 'contacted'
  | 'scheduled_appointment'
  | 'snoozed'
  | 'unsnoozed'
  | 'resolved'
  | 'closed'
  | 'reopened'
  | 'note_added'
  | 'playbook_applied';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert signal priority to queue priority
 */
function signalPriorityToQueuePriority(
  signalPriority: 'urgent' | 'high' | 'medium' | 'low',
): QueueItemPriority {
  switch (signalPriority) {
    case 'urgent':
    case 'high':
      return 'P1';
    case 'medium':
      return 'P2';
    case 'low':
    default:
      return 'P3';
  }
}

/**
 * Validate string length with descriptive error
 */
function validateStringLength(value: string | undefined, maxLength: number, fieldName: string) {
  if (value && value.length > maxLength) {
    throw new Error(`${fieldName} must be ${maxLength} characters or less`);
  }
}

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a queue item manually
 */
export const createQueueItem = mutation({
  args: {
    studentId: v.id('users'),
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.union(v.literal('P1'), v.literal('P2'), v.literal('P3')),
    dueAt: v.optional(v.number()),
    ownerId: v.optional(v.id('users')),
  },
  handler: async (ctx, args) => {
    // Auth
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);
    await assertCanAccessStudent(ctx, sessionCtx, args.studentId);

    // Validation (Enterprise-grade)
    validateStringLength(args.title, MAX_TITLE_LENGTH, 'Title');
    validateStringLength(args.description, MAX_DESCRIPTION_LENGTH, 'Description');

    if (!args.title.trim()) {
      throw new Error('Title is required');
    }

    // Validate ownerId to prevent cross-tenant assignment
    if (args.ownerId) {
      const owner = await ctx.db.get(args.ownerId);
      if (!owner) throw new Error('Owner not found');
      if (owner.university_id !== universityId) {
        throw new Error('Owner must be in the same university');
      }
      const allowedRoles = ['advisor', 'university_admin', 'super_admin'];
      if (!allowedRoles.includes(owner.role)) {
        throw new Error('Owner must be an advisor or admin');
      }
    }

    const now = Date.now();
    const queueItemId = await ctx.db.insert('queue_items', {
      university_id: universityId,
      student_id: args.studentId,
      owner_id: args.ownerId ?? sessionCtx.userId,
      status: 'OPEN',
      priority: args.priority,
      due_at: args.dueAt,
      created_from: 'manual',
      title: args.title.trim(),
      description: args.description?.trim(),
      version: 0,
      created_at: now,
      updated_at: now,
    });

    // Log action
    await ctx.db.insert('queue_item_actions', {
      queue_item_id: queueItemId,
      actor_id: sessionCtx.userId,
      action_type: 'created',
      created_at: now,
    });

    // Audit log (FERPA)
    await logUserAction(ctx, {
      action: 'queue_item.created',
      actorUserId: sessionCtx.userId,
      actorRole: sessionCtx.role,
      actorUniversityId: universityId,
      studentId: args.studentId,
      targetType: 'queue_item',
      targetId: queueItemId,
    });

    return queueItemId;
  },
});

/**
 * Update queue item status
 */
export const updateQueueItemStatus = mutation({
  args: {
    queueItemId: v.id('queue_items'),
    status: v.union(
      v.literal('OPEN'),
      v.literal('IN_PROGRESS'),
      v.literal('RESOLVED'),
      v.literal('CLOSED'),
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const queueItem = await ctx.db.get(args.queueItemId);
    if (!queueItem) throw new Error('Queue item not found');
    if (queueItem.university_id !== universityId) {
      throw new Error('Unauthorized: Queue item not in your university');
    }
    await assertCanAccessStudent(ctx, sessionCtx, queueItem.student_id);

    // Block reopening resolved/closed items via status update
    if (queueItem.status === 'RESOLVED' || queueItem.status === 'CLOSED') {
      throw new Error('Use reopenQueueItem to reopen resolved/closed items');
    }

    validateStringLength(args.notes, MAX_NOTES_LENGTH, 'Notes');

    // Require closed_reason when resolving/closing (use resolveQueueItem instead)
    if (args.status === 'RESOLVED' || args.status === 'CLOSED') {
      throw new Error('Use resolveQueueItem mutation to resolve/close items with a reason');
    }

    const now = Date.now();
    const previousStatus = queueItem.status;

    await ctx.db.patch(args.queueItemId, {
      status: args.status,
      version: (queueItem.version ?? 0) + 1,
      updated_at: now,
    });

    // Log action
    await ctx.db.insert('queue_item_actions', {
      queue_item_id: args.queueItemId,
      actor_id: sessionCtx.userId,
      action_type: 'status_changed',
      notes: args.notes?.trim(),
      previous_value: { status: previousStatus },
      new_value: { status: args.status },
      created_at: now,
    });

    // Audit log
    await logUserAction(ctx, {
      action: 'queue_item.status_changed',
      actorUserId: sessionCtx.userId,
      actorRole: sessionCtx.role,
      actorUniversityId: universityId,
      studentId: queueItem.student_id,
      targetType: 'queue_item',
      targetId: args.queueItemId,
      previousValue: { status: previousStatus },
      newValue: { status: args.status },
    });

    return { success: true };
  },
});

/**
 * Resolve a queue item - REQUIRES closure reason
 */
export const resolveQueueItem = mutation({
  args: {
    queueItemId: v.id('queue_items'),
    closedReason: v.string(),
    notes: v.optional(v.string()),
    status: v.optional(v.union(v.literal('RESOLVED'), v.literal('CLOSED'))),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const queueItem = await ctx.db.get(args.queueItemId);
    if (!queueItem) throw new Error('Queue item not found');
    if (queueItem.university_id !== universityId) {
      throw new Error('Unauthorized: Queue item not in your university');
    }
    await assertCanAccessStudent(ctx, sessionCtx, queueItem.student_id);

    // Validation
    if (!args.closedReason || args.closedReason.trim().length === 0) {
      throw new Error('Closure reason is required');
    }
    validateStringLength(args.closedReason, MAX_CLOSED_REASON_LENGTH, 'Closure reason');
    validateStringLength(args.notes, MAX_NOTES_LENGTH, 'Notes');

    // Idempotency check
    if (queueItem.status === 'RESOLVED' || queueItem.status === 'CLOSED') {
      return { success: true, alreadyResolved: true };
    }

    const now = Date.now();
    const previousStatus = queueItem.status;
    const newStatus = args.status ?? 'RESOLVED';
    const actionType = newStatus === 'CLOSED' ? 'closed' : 'resolved';

    await ctx.db.patch(args.queueItemId, {
      status: newStatus,
      closed_reason: args.closedReason.trim(),
      closed_at: now,
      closed_by: sessionCtx.userId,
      version: (queueItem.version ?? 0) + 1,
      updated_at: now,
    });

    // Log action
    await ctx.db.insert('queue_item_actions', {
      queue_item_id: args.queueItemId,
      actor_id: sessionCtx.userId,
      action_type: actionType,
      notes: args.notes?.trim(),
      previous_value: { status: previousStatus },
      new_value: { status: newStatus, closedReason: args.closedReason.trim() },
      created_at: now,
    });

    // Audit log (FERPA)
    await logUserAction(ctx, {
      action: newStatus === 'CLOSED' ? 'queue_item.closed' : 'queue_item.resolved',
      actorUserId: sessionCtx.userId,
      actorRole: sessionCtx.role,
      actorUniversityId: universityId,
      studentId: queueItem.student_id,
      targetType: 'queue_item',
      targetId: args.queueItemId,
      previousValue: { status: previousStatus },
      newValue: { status: newStatus },
    });

    return { success: true };
  },
});

/**
 * Reopen a resolved/closed queue item
 */
export const reopenQueueItem = mutation({
  args: {
    queueItemId: v.id('queue_items'),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const queueItem = await ctx.db.get(args.queueItemId);
    if (!queueItem) throw new Error('Queue item not found');
    if (queueItem.university_id !== universityId) {
      throw new Error('Unauthorized: Queue item not in your university');
    }
    await assertCanAccessStudent(ctx, sessionCtx, queueItem.student_id);

    validateStringLength(args.notes, MAX_NOTES_LENGTH, 'Notes');

    // Can only reopen resolved/closed items
    if (queueItem.status !== 'RESOLVED' && queueItem.status !== 'CLOSED') {
      throw new Error('Can only reopen resolved or closed items');
    }

    const now = Date.now();
    const previousStatus = queueItem.status;

    await ctx.db.patch(args.queueItemId, {
      status: 'OPEN',
      closed_reason: undefined,
      closed_at: undefined,
      closed_by: undefined,
      version: (queueItem.version ?? 0) + 1,
      updated_at: now,
    });

    // Log action
    await ctx.db.insert('queue_item_actions', {
      queue_item_id: args.queueItemId,
      actor_id: sessionCtx.userId,
      action_type: 'reopened',
      notes: args.notes?.trim(),
      previous_value: { status: previousStatus },
      new_value: { status: 'OPEN' },
      created_at: now,
    });

    // Audit log
    await logUserAction(ctx, {
      action: 'queue_item.reopened',
      actorUserId: sessionCtx.userId,
      actorRole: sessionCtx.role,
      actorUniversityId: universityId,
      studentId: queueItem.student_id,
      targetType: 'queue_item',
      targetId: args.queueItemId,
      previousValue: { status: previousStatus },
      newValue: { status: 'OPEN' },
    });

    return { success: true };
  },
});

/**
 * Snooze a queue item for later
 */
export const snoozeQueueItem = mutation({
  args: {
    queueItemId: v.id('queue_items'),
    snoozeUntil: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const queueItem = await ctx.db.get(args.queueItemId);
    if (!queueItem) throw new Error('Queue item not found');
    if (queueItem.university_id !== universityId) {
      throw new Error('Unauthorized: Queue item not in your university');
    }
    await assertCanAccessStudent(ctx, sessionCtx, queueItem.student_id);

    validateStringLength(args.notes, MAX_NOTES_LENGTH, 'Notes');

    // Validate snooze duration
    const now = Date.now();
    const maxSnoozeTime = now + MAX_SNOOZE_DAYS * 24 * 60 * 60 * 1000;
    if (args.snoozeUntil > maxSnoozeTime) {
      throw new Error(`Cannot snooze for more than ${MAX_SNOOZE_DAYS} days`);
    }
    if (args.snoozeUntil <= now) {
      throw new Error('Snooze time must be in the future');
    }

    // Can't snooze resolved/closed items
    if (queueItem.status === 'RESOLVED' || queueItem.status === 'CLOSED') {
      throw new Error('Cannot snooze resolved or closed items');
    }

    await ctx.db.patch(args.queueItemId, {
      snoozed_until: args.snoozeUntil,
      version: (queueItem.version ?? 0) + 1,
      updated_at: now,
    });

    // Log action
    await ctx.db.insert('queue_item_actions', {
      queue_item_id: args.queueItemId,
      actor_id: sessionCtx.userId,
      action_type: 'snoozed',
      notes: args.notes?.trim(),
      new_value: { snoozedUntil: args.snoozeUntil },
      created_at: now,
    });

    // Audit log
    await logUserAction(ctx, {
      action: 'queue_item.snoozed',
      actorUserId: sessionCtx.userId,
      actorRole: sessionCtx.role,
      actorUniversityId: universityId,
      studentId: queueItem.student_id,
      targetType: 'queue_item',
      targetId: args.queueItemId,
    });

    return { success: true };
  },
});

/**
 * Unsnooze a queue item
 */
export const unsnoozeQueueItem = mutation({
  args: {
    queueItemId: v.id('queue_items'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const queueItem = await ctx.db.get(args.queueItemId);
    if (!queueItem) throw new Error('Queue item not found');
    if (queueItem.university_id !== universityId) {
      throw new Error('Unauthorized: Queue item not in your university');
    }
    await assertCanAccessStudent(ctx, sessionCtx, queueItem.student_id);

    if (!queueItem.snoozed_until) {
      return { success: true, alreadyUnsnoozed: true };
    }

    const now = Date.now();

    await ctx.db.patch(args.queueItemId, {
      snoozed_until: undefined,
      version: (queueItem.version ?? 0) + 1,
      updated_at: now,
    });

    // Log action
    await ctx.db.insert('queue_item_actions', {
      queue_item_id: args.queueItemId,
      actor_id: sessionCtx.userId,
      action_type: 'unsnoozed',
      previous_value: { snoozedUntil: queueItem.snoozed_until },
      created_at: now,
    });

    // Audit log
    await logUserAction(ctx, {
      action: 'queue_item.unsnoozed',
      actorUserId: sessionCtx.userId,
      actorRole: sessionCtx.role,
      actorUniversityId: universityId,
      studentId: queueItem.student_id,
      targetType: 'queue_item',
      targetId: args.queueItemId,
    });

    return { success: true };
  },
});

/**
 * Reassign a queue item to another advisor
 */
export const reassignQueueItem = mutation({
  args: {
    queueItemId: v.id('queue_items'),
    newOwnerId: v.id('users'),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const queueItem = await ctx.db.get(args.queueItemId);
    if (!queueItem) throw new Error('Queue item not found');
    if (queueItem.university_id !== universityId) {
      throw new Error('Unauthorized: Queue item not in your university');
    }
    await assertCanAccessStudent(ctx, sessionCtx, queueItem.student_id);

    validateStringLength(args.notes, MAX_NOTES_LENGTH, 'Notes');

    // Verify new owner is in same university and is an advisor/admin
    const newOwner = await ctx.db.get(args.newOwnerId);
    if (!newOwner) throw new Error('New owner not found');
    if (newOwner.university_id !== universityId) {
      throw new Error('New owner must be in the same university');
    }
    const allowedRoles = ['advisor', 'university_admin', 'super_admin'];
    if (!allowedRoles.includes(newOwner.role)) {
      throw new Error('New owner must be an advisor or admin');
    }

    const now = Date.now();
    const previousOwnerId = queueItem.owner_id;

    await ctx.db.patch(args.queueItemId, {
      owner_id: args.newOwnerId,
      version: (queueItem.version ?? 0) + 1,
      updated_at: now,
    });

    // Log action
    await ctx.db.insert('queue_item_actions', {
      queue_item_id: args.queueItemId,
      actor_id: sessionCtx.userId,
      action_type: 'reassigned',
      notes: args.notes?.trim(),
      previous_value: { ownerId: previousOwnerId },
      new_value: { ownerId: args.newOwnerId },
      created_at: now,
    });

    // Audit log
    await logUserAction(ctx, {
      action: 'queue_item.reassigned',
      actorUserId: sessionCtx.userId,
      actorRole: sessionCtx.role,
      actorUniversityId: universityId,
      studentId: queueItem.student_id,
      targetType: 'queue_item',
      targetId: args.queueItemId,
      previousValue: { ownerId: previousOwnerId },
      newValue: { ownerId: args.newOwnerId },
    });

    return { success: true };
  },
});

/**
 * Log a quick action on a queue item (contacted, scheduled, note)
 */
export const logQuickAction = mutation({
  args: {
    queueItemId: v.id('queue_items'),
    actionType: v.union(
      v.literal('contacted'),
      v.literal('scheduled_appointment'),
      v.literal('note_added'),
      v.literal('playbook_applied'),
    ),
    notes: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const queueItem = await ctx.db.get(args.queueItemId);
    if (!queueItem) throw new Error('Queue item not found');
    if (queueItem.university_id !== universityId) {
      throw new Error('Unauthorized: Queue item not in your university');
    }
    await assertCanAccessStudent(ctx, sessionCtx, queueItem.student_id);

    validateStringLength(args.notes, MAX_NOTES_LENGTH, 'Notes');

    const now = Date.now();

    // Update queue item timestamp
    await ctx.db.patch(args.queueItemId, {
      version: (queueItem.version ?? 0) + 1,
      updated_at: now,
    });

    // Log action
    const actionId = await ctx.db.insert('queue_item_actions', {
      queue_item_id: args.queueItemId,
      actor_id: sessionCtx.userId,
      action_type: args.actionType,
      notes: args.notes?.trim(),
      new_value: args.metadata,
      created_at: now,
    });

    // Audit log
    await logUserAction(ctx, {
      action: `queue_item.${args.actionType}`,
      actorUserId: sessionCtx.userId,
      actorRole: sessionCtx.role,
      actorUniversityId: universityId,
      studentId: queueItem.student_id,
      targetType: 'queue_item',
      targetId: args.queueItemId,
      metadata: args.metadata,
    });

    return { success: true, actionId };
  },
});

// ============================================================================
// INTERNAL MUTATIONS (Signal Integration)
// ============================================================================

/**
 * Create or update queue item from signal activation
 * Called internally when a signal becomes active
 */
export const upsertQueueItemFromSignal = internalMutation({
  args: {
    signalId: v.id('signals'),
  },
  handler: async (ctx, args) => {
    const signal = await ctx.db.get(args.signalId);
    if (!signal || signal.status !== 'active') return null;

    // Check for existing queue item for this signal
    const existing = await ctx.db
      .query('queue_items')
      .withIndex('by_signal', (q) => q.eq('signal_id', args.signalId))
      .first();

    // If exists and not closed, just update priority if needed
    if (existing && existing.status !== 'CLOSED') {
      const newPriority = signalPriorityToQueuePriority(signal.priority);
      if (existing.priority !== newPriority) {
        await ctx.db.patch(existing._id, {
          priority: newPriority,
          version: (existing.version ?? 0) + 1,
          updated_at: Date.now(),
        });
      }
      return existing._id;
    }

    // Find primary advisor for student
    const assignment = await ctx.db
      .query('student_advisors')
      .withIndex('by_student', (q) => q.eq('student_id', signal.student_id))
      .filter((q) => q.eq(q.field('is_owner'), true))
      .first();

    const now = Date.now();
    const queueItemId = await ctx.db.insert('queue_items', {
      university_id: signal.university_id,
      student_id: signal.student_id,
      signal_id: signal._id,
      owner_id: assignment?.advisor_id,
      status: 'OPEN',
      priority: signalPriorityToQueuePriority(signal.priority),
      created_from: 'signal',
      title: signal.title,
      description: signal.description,
      version: 0,
      created_at: now,
      updated_at: now,
    });

    // Log creation (system action)
    await ctx.db.insert('queue_item_actions', {
      queue_item_id: queueItemId,
      actor_id: signal.student_id, // System action on behalf of student
      action_type: 'created',
      notes: `Auto-created from signal: ${signal.signal_type}`,
      created_at: now,
    });

    return queueItemId;
  },
});

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get queue items for the current advisor
 * - Advisors see only their owned items
 * - Admins see all items in university
 */
export const getMyQueue = query({
  args: {
    status: v.optional(
      v.union(
        v.literal('OPEN'),
        v.literal('IN_PROGRESS'),
        v.literal('RESOLVED'),
        v.literal('CLOSED'),
        v.literal('ALL'),
      ),
    ),
    priority: v.optional(v.union(v.literal('P1'), v.literal('P2'), v.literal('P3'))),
    includeSnoozed: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const limit = Math.min(args.limit ?? MAX_QUEUE_ITEMS_PER_PAGE, MAX_QUEUE_ITEMS_PER_PAGE);
    const now = Date.now();

    let queueItems: Doc<'queue_items'>[] = [];

    // Collect all matching items first, then filter/sort/limit
    // This ensures we don't miss higher-priority items that appear later in the index
    if (sessionCtx.role === 'advisor') {
      if (args.status && args.status !== 'ALL') {
        queueItems = await ctx.db
          .query('queue_items')
          .withIndex('by_owner_status', (q) =>
            q.eq('owner_id', sessionCtx.userId).eq('status', args.status as QueueItemStatus),
          )
          .collect();
      } else {
        queueItems = await ctx.db
          .query('queue_items')
          .withIndex('by_owner_status', (q) => q.eq('owner_id', sessionCtx.userId))
          .collect();
      }
    } else {
      // university_admin and super_admin see all in university
      if (args.status && args.status !== 'ALL') {
        queueItems = await ctx.db
          .query('queue_items')
          .withIndex('by_university_status', (q) =>
            q.eq('university_id', universityId).eq('status', args.status as QueueItemStatus),
          )
          .collect();
      } else {
        queueItems = await ctx.db
          .query('queue_items')
          .withIndex('by_university', (q) => q.eq('university_id', universityId))
          .collect();
      }
    }

    // Apply filters
    let filtered = queueItems;

    // Filter by priority
    if (args.priority) {
      filtered = filtered.filter((item) => item.priority === args.priority);
    }

    // Filter out snoozed unless requested
    if (!args.includeSnoozed) {
      filtered = filtered.filter((item) => !item.snoozed_until || item.snoozed_until <= now);
    }

    // Sort by priority (P1 > P2 > P3) then by created_at
    filtered.sort((a, b) => {
      const priorityOrder = { P1: 0, P2: 1, P3: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.created_at - a.created_at; // Newer first within same priority
    });

    // Apply limit after filtering and sorting
    filtered = filtered.slice(0, limit);

    // Enrich with student data
    const enrichedItems = await Promise.all(
      filtered.map(async (item) => {
        const student = await ctx.db.get(item.student_id);
        const owner = item.owner_id ? await ctx.db.get(item.owner_id) : null;
        return {
          ...item,
          student: student
            ? {
                _id: student._id,
                name: student.name,
                email: student.email,
                imageUrl: student.profile_image,
              }
            : null,
          owner: owner
            ? {
                _id: owner._id,
                name: owner.name,
                email: owner.email,
              }
            : null,
        };
      }),
    );

    return enrichedItems;
  },
});

/**
 * Get team queue (all items in university, for admins)
 */
export const getTeamQueue = query({
  args: {
    status: v.optional(
      v.union(
        v.literal('OPEN'),
        v.literal('IN_PROGRESS'),
        v.literal('RESOLVED'),
        v.literal('CLOSED'),
        v.literal('ALL'),
      ),
    ),
    unassignedOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    // Only admins can see team queue
    if (sessionCtx.role !== 'university_admin' && sessionCtx.role !== 'super_admin') {
      throw new Error('Only admins can view team queue');
    }

    const limit = Math.min(args.limit ?? MAX_QUEUE_ITEMS_PER_PAGE, MAX_QUEUE_ITEMS_PER_PAGE);

    let queueItems: Doc<'queue_items'>[];

    // Collect all matching items first, then filter/sort/limit
    // This ensures we don't miss higher-priority items that appear later in the index
    if (args.status && args.status !== 'ALL') {
      queueItems = await ctx.db
        .query('queue_items')
        .withIndex('by_university_status', (q) =>
          q.eq('university_id', universityId).eq('status', args.status as QueueItemStatus),
        )
        .collect();
    } else {
      queueItems = await ctx.db
        .query('queue_items')
        .withIndex('by_university', (q) => q.eq('university_id', universityId))
        .collect();
    }

    // Filter to unassigned if requested
    if (args.unassignedOnly) {
      queueItems = queueItems.filter((item) => !item.owner_id);
    }

    // Sort by priority then created_at
    queueItems.sort((a, b) => {
      const priorityOrder = { P1: 0, P2: 1, P3: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.created_at - a.created_at;
    });

    // Apply limit after filtering and sorting
    queueItems = queueItems.slice(0, limit);

    // Enrich with student and owner data
    const enrichedItems = await Promise.all(
      queueItems.map(async (item) => {
        const student = await ctx.db.get(item.student_id);
        const owner = item.owner_id ? await ctx.db.get(item.owner_id) : null;
        return {
          ...item,
          student: student
            ? {
                _id: student._id,
                name: student.name,
                email: student.email,
                imageUrl: student.profile_image,
              }
            : null,
          owner: owner
            ? {
                _id: owner._id,
                name: owner.name,
                email: owner.email,
              }
            : null,
        };
      }),
    );

    return enrichedItems;
  },
});

/**
 * Get queue item detail with full context
 */
export const getQueueItemDetail = query({
  args: {
    queueItemId: v.id('queue_items'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const queueItem = await ctx.db.get(args.queueItemId);
    if (!queueItem) return null;

    if (queueItem.university_id !== universityId) {
      return null; // Tenant isolation
    }

    // Check student access (soft check for detail view)
    const canAccess = await canAccessStudent(ctx, sessionCtx, queueItem.student_id);
    if (!canAccess && sessionCtx.role === 'advisor') {
      return null; // Advisors can only see their students' items
    }

    // Get student details
    const student = await ctx.db.get(queueItem.student_id);

    // Get owner details
    const owner = queueItem.owner_id ? await ctx.db.get(queueItem.owner_id) : null;

    // Get closed by user details
    const closedBy = queueItem.closed_by ? await ctx.db.get(queueItem.closed_by) : null;

    // Get related signal if exists
    const signal = queueItem.signal_id ? await ctx.db.get(queueItem.signal_id) : null;

    // Get recent student activity (last 5 signals)
    const recentSignals = await ctx.db
      .query('signals')
      .withIndex('by_student', (q) => q.eq('student_id', queueItem.student_id))
      .order('desc')
      .take(5);

    // Get recent actions on this queue item
    const recentActions = await ctx.db
      .query('queue_item_actions')
      .withIndex('by_queue_item', (q) => q.eq('queue_item_id', args.queueItemId))
      .order('desc')
      .take(10);

    // Enrich actions with actor names
    const enrichedActions = await Promise.all(
      recentActions.map(async (action) => {
        const actor = await ctx.db.get(action.actor_id);
        return {
          ...action,
          actor: actor
            ? {
                _id: actor._id,
                name: actor.name,
              }
            : null,
        };
      }),
    );

    // Get linked thread if exists
    const linkedThread = queueItem.linked_thread_id
      ? await ctx.db.get(queueItem.linked_thread_id)
      : null;

    return {
      ...queueItem,
      student: student
        ? {
            _id: student._id,
            name: student.name,
            email: student.email,
            imageUrl: student.profile_image,
            role: student.role,
            university_id: student.university_id,
            last_login_at: student.last_login_at,
          }
        : null,
      owner: owner
        ? {
            _id: owner._id,
            name: owner.name,
            email: owner.email,
          }
        : null,
      closedByUser: closedBy
        ? {
            _id: closedBy._id,
            name: closedBy.name,
          }
        : null,
      signal: signal
        ? {
            _id: signal._id,
            signal_type: signal.signal_type,
            title: signal.title,
            priority: signal.priority,
            status: signal.status,
          }
        : null,
      recentSignals: recentSignals.map((s) => ({
        _id: s._id,
        signal_type: s.signal_type,
        title: s.title,
        priority: s.priority,
        status: s.status,
        created_at: s.created_at,
      })),
      recentActions: enrichedActions,
      linkedThread: linkedThread
        ? {
            _id: linkedThread._id,
            subject: linkedThread.subject,
            status: linkedThread.status,
            priority: linkedThread.priority,
            message_count: linkedThread.message_count,
            last_message_at: linkedThread.last_message_at,
            has_unread: linkedThread.has_unread,
          }
        : null,
    };
  },
});

/**
 * Get action history for a queue item
 */
export const getQueueItemActions = query({
  args: {
    queueItemId: v.id('queue_items'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const queueItem = await ctx.db.get(args.queueItemId);
    if (!queueItem) return [];

    if (queueItem.university_id !== universityId) {
      return []; // Tenant isolation
    }

    const limit = Math.min(args.limit ?? 50, 100);

    const actions = await ctx.db
      .query('queue_item_actions')
      .withIndex('by_queue_item', (q) => q.eq('queue_item_id', args.queueItemId))
      .order('desc')
      .take(limit);

    // Enrich with actor names
    const enrichedActions = await Promise.all(
      actions.map(async (action) => {
        const actor = await ctx.db.get(action.actor_id);
        return {
          ...action,
          actor: actor
            ? {
                _id: actor._id,
                name: actor.name,
                email: actor.email,
              }
            : null,
        };
      }),
    );

    return enrichedActions;
  },
});

/**
 * Get queue statistics for dashboard
 */
export const getQueueStats = query({
  args: {},
  handler: async (ctx) => {
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const now = Date.now();

    // Get counts based on role
    let openCount = 0;
    let inProgressCount = 0;
    let snoozedCount = 0;
    let resolvedTodayCount = 0;

    const todayStart = new Date().setHours(0, 0, 0, 0);

    if (sessionCtx.role === 'advisor') {
      // Advisor: only their items
      const items = await ctx.db
        .query('queue_items')
        .withIndex('by_owner_status', (q) => q.eq('owner_id', sessionCtx.userId))
        .collect();

      openCount = items.filter((i) => i.status === 'OPEN' && !i.snoozed_until).length;
      inProgressCount = items.filter((i) => i.status === 'IN_PROGRESS').length;
      snoozedCount = items.filter((i) => i.snoozed_until && i.snoozed_until > now).length;
      resolvedTodayCount = items.filter(
        (i) => i.status === 'RESOLVED' && i.closed_at && i.closed_at >= todayStart,
      ).length;
    } else {
      // Admin: all university items
      const items = await ctx.db
        .query('queue_items')
        .withIndex('by_university', (q) => q.eq('university_id', universityId))
        .collect();

      openCount = items.filter((i) => i.status === 'OPEN' && !i.snoozed_until).length;
      inProgressCount = items.filter((i) => i.status === 'IN_PROGRESS').length;
      snoozedCount = items.filter((i) => i.snoozed_until && i.snoozed_until > now).length;
      resolvedTodayCount = items.filter(
        (i) => i.status === 'RESOLVED' && i.closed_at && i.closed_at >= todayStart,
      ).length;
    }

    return {
      open: openCount,
      inProgress: inProgressCount,
      snoozed: snoozedCount,
      resolvedToday: resolvedTodayCount,
      total: openCount + inProgressCount,
    };
  },
});

/**
 * Get advisors in university for reassignment dropdown
 */
export const getUniversityAdvisors = query({
  args: {},
  handler: async (ctx) => {
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    // Get all advisors and admins in university
    const advisors = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', universityId))
      .filter((q) =>
        q.or(
          q.eq(q.field('role'), 'advisor'),
          q.eq(q.field('role'), 'university_admin'),
          q.eq(q.field('role'), 'super_admin'),
        ),
      )
      .collect();

    return advisors.map((a) => ({
      _id: a._id,
      name: a.name,
      email: a.email,
      role: a.role,
    }));
  },
});
