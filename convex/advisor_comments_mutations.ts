/**
 * Advisor Comments Mutations
 *
 * Create, update, and manage comments on student artifacts.
 * Supports:
 * - Creating comments (advisors create root, students can reply to shared)
 * - Editing comments (author only)
 * - Resolving threads (any advisor)
 * - Archiving/deleting comments (author only)
 * - Reactions (anyone who can view)
 * - Pinning (advisors only)
 *
 * All mutations enforce:
 * - Tenant isolation (university_id)
 * - Role-based permissions
 * - Optimistic concurrency control (version)
 * - Audit logging for FERPA compliance
 */

import { ConvexError, v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { mutation, MutationCtx } from './_generated/server';
import {
  AdvisorSessionContext,
  assertCanAccessStudent,
  canViewPrivateContent,
  createAuditLog,
  getCurrentUser,
  requireAdvisorRole,
  requireTenant,
} from './advisor_auth';
import { targetTypeValidator } from './advisor_comments';

// ============================================================================
// Validators
// ============================================================================

const commentTypeValidator = v.union(
  v.literal('inline'),
  v.literal('section'),
  v.literal('media'),
  v.literal('general'),
);

const visibilityValidator = v.union(v.literal('shared'), v.literal('advisor_only'));

const inlinePositionValidator = v.object({
  selection_start: v.number(),
  selection_end: v.number(),
  selection_text: v.string(),
  section_id: v.optional(v.string()),
  field_path: v.optional(v.string()),
  page_number: v.optional(v.number()),
});

const sectionPositionValidator = v.object({
  target_section: v.string(),
  field_label: v.optional(v.string()),
});

const mediaPositionValidator = v.object({
  timestamp_ms: v.number(),
  duration_ms: v.optional(v.number()),
});

// ============================================================================
// Helpers
// ============================================================================

import { sanitizeCommentBody } from './lib/sanitizeHtml';

/**
 * Check if user can create comments (advisors only for root comments)
 */
function canCreateRootComment(sessionCtx: AdvisorSessionContext): boolean {
  return ['advisor', 'university_admin', 'super_admin'].includes(sessionCtx.role);
}

/**
 * Check if user can create a reply
 * Students can reply to shared comments on their own artifacts
 */
function canCreateReply(
  sessionCtx: AdvisorSessionContext,
  parentVisibility: 'shared' | 'advisor_only',
  studentId: Id<'users'>,
): boolean {
  // Advisors can always reply
  if (canCreateRootComment(sessionCtx)) {
    return true;
  }

  // Students can reply to shared comments on their own artifacts
  if (
    (sessionCtx.role === 'student' || sessionCtx.role === 'user') &&
    parentVisibility === 'shared' &&
    sessionCtx.userId === studentId
  ) {
    return true;
  }

  return false;
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Create a new comment
 *
 * Authorization:
 * - Root comments: advisors, university_admin, super_admin only
 * - Replies: above roles + students can reply to shared comments on their own artifacts
 */
export const createComment = mutation({
  args: {
    clerkId: v.string(),
    studentId: v.id('users'),
    // Target
    targetType: targetTypeValidator,
    resumeId: v.optional(v.id('resumes')),
    coverLetterId: v.optional(v.id('cover_letters')),
    goalId: v.optional(v.id('goals')),
    applicationId: v.optional(v.id('applications')),
    sessionId: v.optional(v.id('advisor_sessions')),
    careerPlanId: v.optional(v.id('career_main_paths')),
    // Comment type and positioning
    commentType: commentTypeValidator,
    inlinePosition: v.optional(inlinePositionValidator),
    sectionPosition: v.optional(sectionPositionValidator),
    mediaPosition: v.optional(mediaPositionValidator),
    // Content
    body: v.string(),
    visibility: visibilityValidator,
    // Threading
    parentId: v.optional(v.id('advisor_comments')),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    const universityId = requireTenant(sessionCtx);

    // Validate body is not empty
    if (!args.body.trim()) {
      throw new ConvexError({ message: 'Comment body cannot be empty', code: 'VALIDATION_ERROR' });
    }

    // Sanitize HTML
    const sanitizedBody = sanitizeCommentBody(args.body);

    // Determine if this is a reply
    let parentComment = null;
    let threadRootId: Id<'advisor_comments'> | undefined;

    if (args.parentId) {
      parentComment = await ctx.db.get(args.parentId);
      if (!parentComment) {
        throw new ConvexError({ message: 'Parent comment not found', code: 'NOT_FOUND' });
      }

      // Check if user can reply
      if (!canCreateReply(sessionCtx, parentComment.visibility, args.studentId)) {
        throw new ConvexError({
          message: 'Unauthorized: Cannot reply to this comment',
          code: 'UNAUTHORIZED',
        });
      }

      // Set thread root (either parent's thread root or parent itself)
      threadRootId = parentComment.thread_root_id || parentComment._id;

      // Students must use 'shared' visibility for replies
      if (
        (sessionCtx.role === 'student' || sessionCtx.role === 'user') &&
        args.visibility === 'advisor_only'
      ) {
        throw new ConvexError({
          message: 'Students cannot create advisor-only comments',
          code: 'VALIDATION_ERROR',
        });
      }
    } else {
      // Root comment - require advisor role
      if (!canCreateRootComment(sessionCtx)) {
        throw new ConvexError({
          message: 'Unauthorized: Only advisors can create root comments',
          code: 'UNAUTHORIZED',
        });
      }

      // Verify advisor can access this student
      await assertCanAccessStudent(ctx, sessionCtx, args.studentId);
    }

    // Create the comment
    const now = Date.now();
    const commentId = await ctx.db.insert('advisor_comments', {
      university_id: universityId,
      author_id: sessionCtx.userId,
      student_id: args.studentId,
      target_type: args.targetType,
      resume_id: args.resumeId,
      cover_letter_id: args.coverLetterId,
      goal_id: args.goalId,
      application_id: args.applicationId,
      session_id: args.sessionId,
      career_plan_id: args.careerPlanId,
      comment_type: args.commentType,
      inline_position: args.inlinePosition,
      section_position: args.sectionPosition,
      media_position: args.mediaPosition,
      body: sanitizedBody,
      visibility: args.visibility,
      parent_id: args.parentId,
      thread_root_id: threadRootId,
      status: 'active',
      version: 1,
      created_at: now,
      updated_at: now,
    });

    // Audit log
    await createAuditLog(ctx, {
      actorId: sessionCtx.userId,
      universityId,
      action: args.parentId ? 'comment.reply_created' : 'comment.created',
      entityType: 'advisor_comment',
      entityId: commentId,
      studentId: args.studentId,
      newValue: {
        targetType: args.targetType,
        commentType: args.commentType,
        visibility: args.visibility,
        isReply: !!args.parentId,
      },
    });

    return { commentId, success: true };
  },
});

/**
 * Update comment body (author only)
 */
export const updateComment = mutation({
  args: {
    clerkId: v.string(),
    commentId: v.id('advisor_comments'),
    body: v.string(),
    version: v.number(),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    const universityId = requireTenant(sessionCtx);

    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new ConvexError({ message: 'Comment not found', code: 'NOT_FOUND' });
    }

    // Verify tenant isolation
    if (comment.university_id !== universityId) {
      throw new ConvexError({ message: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    // Only author can edit
    if (comment.author_id !== sessionCtx.userId) {
      throw new ConvexError({
        message: 'Unauthorized: Only the author can edit this comment',
        code: 'UNAUTHORIZED',
      });
    }

    // Cannot edit archived comments
    if (comment.status === 'archived') {
      throw new ConvexError({
        message: 'Cannot edit archived comment',
        code: 'VALIDATION_ERROR',
      });
    }

    // Version check for optimistic concurrency
    const currentVersion = comment.version ?? 0;
    if (currentVersion !== args.version) {
      throw new ConvexError({
        message: 'Version mismatch: Comment was updated. Please refresh.',
        code: 'VERSION_CONFLICT',
      });
    }

    // Validate and sanitize
    if (!args.body.trim()) {
      throw new ConvexError({ message: 'Comment body cannot be empty', code: 'VALIDATION_ERROR' });
    }
    const sanitizedBody = sanitizeCommentBody(args.body);

    // Update
    const newVersion = currentVersion + 1;
    await ctx.db.patch(args.commentId, {
      body: sanitizedBody,
      version: newVersion,
      updated_at: Date.now(),
    });

    return { success: true, version: newVersion };
  },
});

/**
 * Resolve a comment thread (any advisor can resolve)
 */
export const resolveComment = mutation({
  args: {
    clerkId: v.string(),
    commentId: v.id('advisor_comments'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new ConvexError({ message: 'Comment not found', code: 'NOT_FOUND' });
    }

    // Verify tenant isolation
    if (comment.university_id !== universityId) {
      throw new ConvexError({ message: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    // Only resolve active comments
    if (comment.status !== 'active') {
      throw new ConvexError({
        message: `Comment is already ${comment.status}`,
        code: 'VALIDATION_ERROR',
      });
    }

    const now = Date.now();

    // Resolve the comment
    await ctx.db.patch(args.commentId, {
      status: 'resolved',
      resolved_by: sessionCtx.userId,
      resolved_at: now,
      updated_at: now,
    });

    // If this is a root comment, also resolve all replies in the thread
    if (!comment.parent_id) {
      const replies = await ctx.db
        .query('advisor_comments')
        .withIndex('by_thread_root', (q) => q.eq('thread_root_id', args.commentId))
        .collect();

      for (const reply of replies) {
        if (reply.status === 'active') {
          await ctx.db.patch(reply._id, {
            status: 'resolved',
            resolved_by: sessionCtx.userId,
            resolved_at: now,
            updated_at: now,
          });
        }
      }
    }

    // Audit log
    await createAuditLog(ctx, {
      actorId: sessionCtx.userId,
      universityId,
      action: 'comment.resolved',
      entityType: 'advisor_comment',
      entityId: args.commentId,
      studentId: comment.student_id,
    });

    return { success: true };
  },
});

/**
 * Unresolve a comment (reopen)
 */
export const unresolveComment = mutation({
  args: {
    clerkId: v.string(),
    commentId: v.id('advisor_comments'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new ConvexError({ message: 'Comment not found', code: 'NOT_FOUND' });
    }

    if (comment.university_id !== universityId) {
      throw new ConvexError({ message: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    if (comment.status !== 'resolved') {
      throw new ConvexError({
        message: 'Comment is not resolved',
        code: 'VALIDATION_ERROR',
      });
    }

    await ctx.db.patch(args.commentId, {
      status: 'active',
      resolved_by: undefined,
      resolved_at: undefined,
      updated_at: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Archive (soft delete) a comment (author only)
 */
export const archiveComment = mutation({
  args: {
    clerkId: v.string(),
    commentId: v.id('advisor_comments'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    const universityId = requireTenant(sessionCtx);

    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new ConvexError({ message: 'Comment not found', code: 'NOT_FOUND' });
    }

    if (comment.university_id !== universityId) {
      throw new ConvexError({ message: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    // Only author can archive (or super_admin)
    if (comment.author_id !== sessionCtx.userId && sessionCtx.role !== 'super_admin') {
      throw new ConvexError({
        message: 'Unauthorized: Only the author can delete this comment',
        code: 'UNAUTHORIZED',
      });
    }

    await ctx.db.patch(args.commentId, {
      status: 'archived',
      updated_at: Date.now(),
    });

    // Audit log
    await createAuditLog(ctx, {
      actorId: sessionCtx.userId,
      universityId,
      action: 'comment.archived',
      entityType: 'advisor_comment',
      entityId: args.commentId,
      studentId: comment.student_id,
    });

    return { success: true };
  },
});

/**
 * Toggle a reaction on a comment
 */
export const toggleReaction = mutation({
  args: {
    clerkId: v.string(),
    commentId: v.id('advisor_comments'),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    const universityId = requireTenant(sessionCtx);

    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new ConvexError({ message: 'Comment not found', code: 'NOT_FOUND' });
    }

    if (comment.university_id !== universityId) {
      throw new ConvexError({ message: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    // Check if user can view this comment
    if (!canViewPrivateContent(sessionCtx, comment.visibility, comment.author_id)) {
      throw new ConvexError({ message: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    // Validate emoji (simple check - should be a single emoji)
    if (!args.emoji || args.emoji.length > 10) {
      throw new ConvexError({ message: 'Invalid emoji', code: 'VALIDATION_ERROR' });
    }

    const reactions = comment.reactions || [];
    const existingIndex = reactions.findIndex(
      (r) => r.user_id === sessionCtx.userId && r.emoji === args.emoji,
    );

    if (existingIndex >= 0) {
      // Remove reaction
      reactions.splice(existingIndex, 1);
    } else {
      // Add reaction
      reactions.push({
        user_id: sessionCtx.userId,
        emoji: args.emoji,
        created_at: Date.now(),
      });
    }

    await ctx.db.patch(args.commentId, {
      reactions,
      updated_at: Date.now(),
    });

    return { success: true, added: existingIndex < 0 };
  },
});

/**
 * Toggle pin status on a comment (advisors only)
 */
export const togglePin = mutation({
  args: {
    clerkId: v.string(),
    commentId: v.id('advisor_comments'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new ConvexError({ message: 'Comment not found', code: 'NOT_FOUND' });
    }

    if (comment.university_id !== universityId) {
      throw new ConvexError({ message: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    // Only root comments can be pinned
    if (comment.parent_id) {
      throw new ConvexError({
        message: 'Only root comments can be pinned',
        code: 'VALIDATION_ERROR',
      });
    }

    const newPinStatus = !comment.is_pinned;

    await ctx.db.patch(args.commentId, {
      is_pinned: newPinStatus,
      updated_at: Date.now(),
    });

    return { success: true, isPinned: newPinStatus };
  },
});

/**
 * Update comment visibility (author only, cannot change to advisor_only if there are student replies)
 */
export const updateVisibility = mutation({
  args: {
    clerkId: v.string(),
    commentId: v.id('advisor_comments'),
    visibility: visibilityValidator,
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new ConvexError({ message: 'Comment not found', code: 'NOT_FOUND' });
    }

    if (comment.university_id !== universityId) {
      throw new ConvexError({ message: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    // Only author can change visibility
    if (comment.author_id !== sessionCtx.userId && sessionCtx.role !== 'super_admin') {
      throw new ConvexError({
        message: 'Unauthorized: Only the author can change visibility',
        code: 'UNAUTHORIZED',
      });
    }

    // If changing to advisor_only, check for student replies
    if (args.visibility === 'advisor_only' && comment.visibility === 'shared') {
      // Check if any replies are from students
      const replies = await ctx.db
        .query('advisor_comments')
        .withIndex('by_thread_root', (q) => q.eq('thread_root_id', comment._id))
        .collect();

      for (const reply of replies) {
        const replyAuthor = await ctx.db.get(reply.author_id);
        if (replyAuthor && (replyAuthor.role === 'student' || replyAuthor.role === 'user')) {
          throw new ConvexError({
            message: 'Cannot make comment private: thread has student replies',
            code: 'VALIDATION_ERROR',
          });
        }
      }
    }

    await ctx.db.patch(args.commentId, {
      visibility: args.visibility,
      updated_at: Date.now(),
    });

    // Audit log for visibility changes
    await createAuditLog(ctx, {
      actorId: sessionCtx.userId,
      universityId,
      action: 'comment.visibility_changed',
      entityType: 'advisor_comment',
      entityId: args.commentId,
      studentId: comment.student_id,
      previousValue: { visibility: comment.visibility },
      newValue: { visibility: args.visibility },
    });

    return { success: true };
  },
});
