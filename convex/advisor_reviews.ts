/**
 * Advisor Reviews Management
 *
 * Queries and mutations for resume/cover letter review workflow:
 * - Review queue management
 * - Rubric scoring
 * - Inline comments with visibility controls
 * - Status transitions (waiting → needs_edits → approved)
 */

import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { sanitizeCommentBody } from './lib/sanitizeHtml';
import {
  assertCanAccessStudent,
  canViewPrivateContent,
  createAuditLog,
  getCurrentUser,
  getOwnedStudentIds,
  requireAdvisorRole,
  requireTenant,
} from './advisor_auth';

/**
 * Get review queue for advisor (all pending reviews for their students)
 */
export const getReviewQueue = query({
  args: {
    clerkId: v.string(),
    status: v.optional(
      v.union(
        v.literal('waiting'),
        v.literal('in_review'),
        v.literal('needs_edits'),
        v.literal('approved'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    // Get all owned student IDs
    const studentIds = await getOwnedStudentIds(ctx, sessionCtx);

    if (studentIds.length === 0) {
      return [];
    }

    // Fetch reviews using appropriate index
    let reviews;
    if (args.status) {
      // Use by_status index when status filter is provided
      const status = args.status;
      reviews = await ctx.db
        .query('advisor_reviews')
        .withIndex('by_status', (q) => q.eq('status', status).eq('university_id', universityId))
        .collect();
    } else {
      // Use by_university index when no status filter
      reviews = await ctx.db
        .query('advisor_reviews')
        .withIndex('by_university', (q) => q.eq('university_id', universityId))
        .collect();
    }

    // Filter to owned students only
    const ownedReviews = reviews.filter((r) => studentIds.includes(r.student_id));

    // Enrich with student info
    const uniqueStudentIds = [...new Set(ownedReviews.map((r) => r.student_id))];
    const students = await Promise.all(uniqueStudentIds.map((id) => ctx.db.get(id)));
    const studentMap = new Map(
      students
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .map((s) => [s._id, s] as const),
    );

    const enriched = ownedReviews.map((review) => {
      const student = studentMap.get(review.student_id);
      return {
        ...review,
        student: student
          ? {
              id: student._id,
              name: student.name,
              email: student.email,
              major: student.major,
              graduation_year: student.graduation_year,
            }
          : null,
      };
    });

    // Sort by created_at (oldest first for waiting status, newest first otherwise)
    return enriched.sort((a, b) => {
      if (args.status === 'waiting') {
        return a.created_at - b.created_at; // FIFO for waiting
      }
      return b.created_at - a.created_at; // Latest first
    });
  },
});

/**
 * Get review count badge (number of reviews waiting)
 */
export const getReviewQueueCount = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const studentIds = await getOwnedStudentIds(ctx, sessionCtx);

    if (studentIds.length === 0) {
      return 0;
    }

    const waitingReviews = await ctx.db
      .query('advisor_reviews')
      .withIndex('by_status', (q) => q.eq('status', 'waiting').eq('university_id', universityId))
      .collect();

    // Filter to owned students
    const ownedWaiting = waitingReviews.filter((r) => studentIds.includes(r.student_id));

    return ownedWaiting.length;
  },
});

/**
 * Get specific review by ID
 */
export const getReview = query({
  args: {
    clerkId: v.string(),
    reviewId: v.id('advisor_reviews'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const review = await ctx.db.get(args.reviewId);
    if (!review) {
      throw new Error('Review not found');
    }

    // Tenant isolation
    if (review.university_id !== universityId) {
      throw new Error('Unauthorized: Review not in your university');
    }

    // Verify access to student
    await assertCanAccessStudent(ctx, sessionCtx, review.student_id);

    // Get student info
    const student = await ctx.db.get(review.student_id);

    // Get asset (resume or cover letter) using typed IDs
    let asset = null;
    if (review.asset_type === 'resume' && review.resume_id) {
      asset = await ctx.db.get(review.resume_id);
      if (asset && asset.user_id !== review.student_id) {
        throw new Error('Asset ownership mismatch');
      }
    } else if (review.asset_type === 'cover_letter' && review.cover_letter_id) {
      asset = await ctx.db.get(review.cover_letter_id);
      if (asset && asset.user_id !== review.student_id) {
        throw new Error('Asset ownership mismatch');
      }
    }
    return {
      ...review,
      student,
      asset,
    };
  },
});

/**
 * Get review status for a specific asset (resume or cover letter)
 * Returns the most recent non-archived review for the asset
 */
export const getReviewForAsset = query({
  args: {
    clerkId: v.string(),
    resumeId: v.optional(v.id('resumes')),
    coverLetterId: v.optional(v.id('cover_letters')),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    // Find review by asset ID
    let review = null;

    if (args.resumeId) {
      const reviews = await ctx.db
        .query('advisor_reviews')
        .withIndex('by_resume', (q) => q.eq('resume_id', args.resumeId))
        .collect();
      // Filter by university and get most recent review
      review = reviews
        .filter((r) => r.university_id === universityId)
        .sort((a, b) => b.created_at - a.created_at)[0];
    } else if (args.coverLetterId) {
      const reviews = await ctx.db
        .query('advisor_reviews')
        .withIndex('by_cover_letter', (q) => q.eq('cover_letter_id', args.coverLetterId))
        .collect();
      // Filter by university and get most recent review
      review = reviews
        .filter((r) => r.university_id === universityId)
        .sort((a, b) => b.created_at - a.created_at)[0];
    }

    if (!review) {
      return null;
    }

    // Return basic status info
    return {
      _id: review._id,
      status: review.status,
      created_at: review.created_at,
      updated_at: review.updated_at,
    };
  },
});

/**
 * Create new review request
 */
export const createReview = mutation({
  args: {
    clerkId: v.string(),
    studentId: v.id('users'),
    assetType: v.union(v.literal('resume'), v.literal('cover_letter')),
    resumeId: v.optional(v.id('resumes')),
    coverLetterId: v.optional(v.id('cover_letters')),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    // Validate mutual exclusivity of asset IDs
    if (args.resumeId && args.coverLetterId) {
      throw new Error('Cannot specify both resumeId and coverLetterId');
    }

    // Validate that exactly one ID is provided based on asset type
    if (args.assetType === 'resume') {
      if (!args.resumeId) {
        throw new Error('resumeId is required when assetType is resume');
      }
      if (args.coverLetterId) {
        throw new Error('coverLetterId cannot be specified when assetType is resume');
      }
      const resume = await ctx.db.get(args.resumeId);
      if (!resume) {
        throw new Error('Resume not found');
      }
      if (resume.user_id !== args.studentId) {
        throw new Error('Resume does not belong to this student');
      }
    }

    if (args.assetType === 'cover_letter') {
      if (!args.coverLetterId) {
        throw new Error('coverLetterId is required when assetType is cover_letter');
      }
      if (args.resumeId) {
        throw new Error('resumeId cannot be specified when assetType is cover_letter');
      }
      const coverLetter = await ctx.db.get(args.coverLetterId);
      if (!coverLetter) {
        throw new Error('Cover letter not found');
      }
      if (coverLetter.user_id !== args.studentId) {
        throw new Error('Cover letter does not belong to this student');
      }
    }

    // Verify advisor can access this student
    await assertCanAccessStudent(ctx, sessionCtx, args.studentId);

    const now = Date.now();

    const reviewId = await ctx.db.insert('advisor_reviews', {
      student_id: args.studentId,
      university_id: universityId,
      asset_type: args.assetType,
      resume_id: args.resumeId,
      cover_letter_id: args.coverLetterId,
      status: 'waiting',
      comments: [],
      version: 1, // Initialize version for optimistic concurrency control
      created_at: now,
      updated_at: now,
    });

    // Audit log
    await createAuditLog(ctx, {
      actorId: sessionCtx.userId,
      universityId,
      action: 'review.created',
      entityType: 'advisor_review',
      entityId: reviewId,
      studentId: args.studentId,
      newValue: {
        asset_type: args.assetType,
        resume_id: args.resumeId,
        cover_letter_id: args.coverLetterId,
      },
    });

    return reviewId;
  },
});

/**
 * Update review status
 */
export const updateReviewStatus = mutation({
  args: {
    clerkId: v.string(),
    reviewId: v.id('advisor_reviews'),
    status: v.union(
      v.literal('waiting'),
      v.literal('in_review'),
      v.literal('needs_edits'),
      v.literal('approved'),
    ),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);

    const review = await ctx.db.get(args.reviewId);
    if (!review) {
      throw new Error('Review not found');
    }

    // Verify tenant isolation
    const universityId = requireTenant(sessionCtx);
    if (review.university_id !== universityId) {
      throw new Error('Unauthorized: Review not in your university');
    }

    // Verify access to student
    await assertCanAccessStudent(ctx, sessionCtx, review.student_id);

    const now = Date.now();
    const previousStatus = review.status;

    // Define valid state transitions for manual status changes.
    // Note: approveReview() allows direct waiting → approved as a convenience shortcut
    // for simple cases where advisors want to quickly approve without explicit "in_review" step.
    // This function enforces the formal workflow: waiting → in_review → approved.
    const validTransitions: Record<string, string[]> = {
      waiting: ['in_review'],
      in_review: ['needs_edits', 'approved', 'waiting'],
      needs_edits: ['in_review', 'waiting'],
      approved: ['needs_edits'], // allow re-review if needed
    };

    if (previousStatus && !validTransitions[previousStatus]?.includes(args.status)) {
      throw new Error(`Invalid transition from ${previousStatus} to ${args.status}`);
    }

    const isWaiting = args.status === 'waiting';

    const patchData: Record<string, any> = {
      status: args.status,
      updated_at: now,
      version: (review.version ?? 0) + 1,
    };
    if (isWaiting) {
      // Note: To clear fields, schema must allow null or use a different approach
      patchData.reviewed_by = null;
      patchData.reviewed_at = null;
    } else {
      patchData.reviewed_by = sessionCtx.userId;
      patchData.reviewed_at = now;
    }
    await ctx.db.patch(args.reviewId, patchData);

    // Audit log
    await createAuditLog(ctx, {
      actorId: sessionCtx.userId,
      universityId: review.university_id,
      action: 'review.status_changed',
      entityType: 'advisor_review',
      entityId: args.reviewId,
      studentId: review.student_id,
      previousValue: previousStatus,
      newValue: args.status,
    });

    return { success: true };
  },
});

/**
 * Update rubric scores
 */
export const updateRubric = mutation({
  args: {
    clerkId: v.string(),
    reviewId: v.id('advisor_reviews'),
    rubric: v.object({
      content_quality: v.optional(v.number()),
      formatting: v.optional(v.number()),
      relevance: v.optional(v.number()),
      grammar: v.optional(v.number()),
      overall: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const review = await ctx.db.get(args.reviewId);
    if (!review) {
      throw new Error('Review not found');
    }

    // Tenant isolation: ensure review belongs to same university
    if (review.university_id !== universityId) {
      throw new Error('Unauthorized: Review not in your university');
    }

    await assertCanAccessStudent(ctx, sessionCtx, review.student_id);

    // Validate rubric scores (must be numbers between 0-100 and finite)
    const scores = Object.values(args.rubric).filter((s) => s !== undefined) as number[];
    if (scores.some((s) => typeof s !== 'number' || s < 0 || s > 100 || !isFinite(s))) {
      throw new Error('Rubric scores must be numbers between 0 and 100');
    }

    const previousRubric = review.rubric;

    await ctx.db.patch(args.reviewId, {
      rubric: args.rubric,
      updated_at: Date.now(),
      version: (review.version ?? 0) + 1,
    });

    // Audit log for rubric updates (affects student outcomes)
    await createAuditLog(ctx, {
      actorId: sessionCtx.userId,
      universityId: review.university_id,
      action: 'review.rubric_updated',
      entityType: 'advisor_review',
      entityId: args.reviewId,
      studentId: review.student_id,
      previousValue: previousRubric,
      newValue: args.rubric,
    });

    return { success: true };
  },
});

/**
 * Add comment to review
 */
export const addComment = mutation({
  args: {
    clerkId: v.string(),
    reviewId: v.id('advisor_reviews'),
    body: v.string(),
    visibility: v.union(v.literal('shared'), v.literal('advisor_only')),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const review = await ctx.db.get(args.reviewId);
    if (!review) {
      throw new Error('Review not found');
    }

    // Tenant isolation: ensure review belongs to same university
    if (review.university_id !== universityId) {
      throw new Error('Unauthorized: Review not in your university');
    }

    await assertCanAccessStudent(ctx, sessionCtx, review.student_id);

    // Server-side validation and sanitization
    if (!args.body || args.body.trim().length === 0) {
      throw new Error('Comment body cannot be empty');
    }
    if (args.body.length > 10000) {
      throw new Error('Comment body too long (max 10000 characters)');
    }

    /// Sanitize HTML to prevent XSS
    const sanitizedBody = sanitizeCommentBody(args.body);

    const now = Date.now();
    const currentComments = review.comments || [];
    // Generate deterministic ID using timestamp + index + user for better uniqueness
    const commentId = `${now}-${currentComments.length}-${sessionCtx.userId}-${Math.random().toString(36).slice(2, 8)}`;

    const newComment = {
      id: commentId,
      author_id: sessionCtx.userId,
      body: sanitizedBody,
      visibility: args.visibility,
      created_at: now,
      updated_at: now,
    };

    const updatedComments = [...currentComments, newComment];

    // Check version hasn't changed since we read the review
    const currentReview = await ctx.db.get(args.reviewId);
    if (!currentReview) {
      throw new Error('Review was deleted. Please refresh and try again.');
    }
    // Use currentReview.version for the actual patch to ensure atomicity
    if (currentReview.version !== review.version) {
      throw new Error('Review was modified by another user. Please refresh and try again.');
    }

    await ctx.db.patch(args.reviewId, {
      comments: updatedComments,
      updated_at: now,
      version: (currentReview.version ?? 0) + 1,
    });

    // Audit log for all comments (FERPA compliance)
    await createAuditLog(ctx, {
      actorId: sessionCtx.userId,
      universityId: review.university_id,
      action: 'review.comment_added',
      entityType: 'advisor_review',
      entityId: args.reviewId,
      studentId: review.student_id,
      newValue: { visibility: args.visibility, comment_id: commentId },
    });

    return commentId;
  },
});

/**
 * Update comment
 */
export const updateComment = mutation({
  args: {
    clerkId: v.string(),
    reviewId: v.id('advisor_reviews'),
    commentId: v.string(),
    body: v.string(),
    visibility: v.optional(v.union(v.literal('shared'), v.literal('advisor_only'))),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const review = await ctx.db.get(args.reviewId);
    if (!review) {
      throw new Error('Review not found');
    }

    // Tenant isolation: ensure review belongs to same university
    if (review.university_id !== universityId) {
      throw new Error('Unauthorized: Review not in your university');
    }

    await assertCanAccessStudent(ctx, sessionCtx, review.student_id);

    // Server-side validation and sanitization
    if (!args.body || args.body.trim().length === 0) {
      throw new Error('Comment body cannot be empty');
    }
    if (args.body.length > 10000) {
      throw new Error('Comment body too long (max 10000 characters)');
    }

    /// Sanitize HTML to prevent XSS
    const sanitizedBody = sanitizeCommentBody(args.body);

    const comments = review.comments || [];
    const commentIndex = comments.findIndex((c) => c.id === args.commentId);

    if (commentIndex === -1) {
      throw new Error('Comment not found');
    }

    const comment = comments[commentIndex];

    // Only comment author can edit
    if (comment.author_id !== sessionCtx.userId) {
      throw new Error('Unauthorized: Only the comment author can edit it');
    }

    const previousVisibility = comment.visibility;
    const previousBody = comment.body;
    const now = Date.now();

    comments[commentIndex] = {
      ...comment,
      body: sanitizedBody,
      visibility: args.visibility || comment.visibility,
      updated_at: now,
    };

    // Check version hasn't changed since we read the review (optimistic concurrency control)
    const currentReview = await ctx.db.get(args.reviewId);
    if (!currentReview) {
      throw new Error('Review was deleted. Please refresh and try again.');
    }
    if (currentReview.version !== review.version) {
      throw new Error('Review was modified by another user. Please refresh and try again.');
    }

    await ctx.db.patch(args.reviewId, {
      comments,
      updated_at: now,
      version: (currentReview.version ?? 0) + 1,
    });

    // Audit log for body changes (FERPA compliance)
    if (sanitizedBody !== previousBody) {
      // NOTE: Store structural metadata only, not full comment content (PII/FERPA compliance)
      await createAuditLog(ctx, {
        actorId: sessionCtx.userId,
        universityId: review.university_id,
        action: 'review.comment_edited',
        entityType: 'advisor_review',
        entityId: args.reviewId,
        studentId: review.student_id,
        previousValue: { bodyLength: previousBody?.length ?? 0 },
        newValue: { bodyLength: sanitizedBody.length, edited: true },
      });
    }

    // Audit log for visibility changes
    if (args.visibility && args.visibility !== previousVisibility) {
      await createAuditLog(ctx, {
        actorId: sessionCtx.userId,
        universityId: review.university_id,
        action: 'review.comment_visibility_changed',
        entityType: 'advisor_review',
        entityId: args.reviewId,
        studentId: review.student_id,
        previousValue: previousVisibility,
        newValue: args.visibility,
      });
    }

    return { success: true };
  },
});

/**
 * Delete comment
 */
export const deleteComment = mutation({
  args: {
    clerkId: v.string(),
    reviewId: v.id('advisor_reviews'),
    commentId: v.string(),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const review = await ctx.db.get(args.reviewId);
    if (!review) {
      throw new Error('Review not found');
    }

    // Verify tenant isolation
    if (review.university_id !== universityId) {
      throw new Error('Unauthorized: Review not in your university');
    }

    await assertCanAccessStudent(ctx, sessionCtx, review.student_id);

    const comments = review.comments || [];
    const comment = comments.find((c) => c.id === args.commentId);

    if (!comment) {
      throw new Error('Comment not found');
    }

    // Only comment author or admin can delete
    // Note: requireAdvisorRole() above allows advisor, university_admin, super_admin
    // - Advisors can only delete their own comments
    // - Admins (university_admin, super_admin) can delete any comment
    const isAuthor = comment.author_id === sessionCtx.userId;
    const isAdmin = sessionCtx.role === 'super_admin' || sessionCtx.role === 'university_admin';

    if (!isAuthor && !isAdmin) {
      throw new Error('Unauthorized: Only the comment author or admin can delete it');
    }

    const updatedComments = comments.filter((c) => c.id !== args.commentId);

    // Check version hasn't changed since we read the review (optimistic concurrency control)
    const currentReview = await ctx.db.get(args.reviewId);
    if (!currentReview) {
      throw new Error('Review was deleted. Please refresh and try again.');
    }
    if (currentReview.version !== review.version) {
      throw new Error('Review was modified by another user. Please refresh and try again.');
    }

    await ctx.db.patch(args.reviewId, {
      comments: updatedComments,
      updated_at: Date.now(),
      version: (currentReview.version ?? 0) + 1,
    });

    // Audit log for comment deletion
    await createAuditLog(ctx, {
      actorId: sessionCtx.userId,
      universityId: review.university_id,
      action: 'review.comment_deleted',
      entityType: 'advisor_review',
      entityId: args.reviewId,
      studentId: review.student_id,
      previousValue: {
        comment_id: args.commentId,
        bodyLength: comment.body?.length ?? 0,
        visibility: comment.visibility,
        author_id: comment.author_id,
      },
    });

    return { success: true };
  },
});

/**
 * Approve review (shortcut for status + comment)
 */
export const approveReview = mutation({
  args: {
    clerkId: v.string(),
    reviewId: v.id('advisor_reviews'),
    comment: v.optional(v.string()),
    commentVisibility: v.optional(v.union(v.literal('shared'), v.literal('advisor_only'))),
    rubric: v.optional(
      v.object({
        content_quality: v.optional(v.number()),
        formatting: v.optional(v.number()),
        relevance: v.optional(v.number()),
        grammar: v.optional(v.number()),
        overall: v.optional(v.number()),
      }),
    ),
    expectedVersion: v.optional(v.number()), // For optimistic concurrency control
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const review = await ctx.db.get(args.reviewId);
    if (!review) {
      throw new Error('Review not found');
    }

    // Verify tenant isolation
    if (review.university_id !== universityId) {
      throw new Error('Unauthorized: Review not in your university');
    }

    await assertCanAccessStudent(ctx, sessionCtx, review.student_id);

    // Validate current status - can only approve waiting or in_review items.
    // Note: This is a convenience shortcut that allows direct waiting → approved,
    // bypassing the formal workflow in updateReviewStatus() which requires
    // waiting → in_review → approved. This is intentional for quick approvals.
    const approvableStatuses = ['waiting', 'in_review'];
    if (!approvableStatuses.includes(review.status)) {
      throw new Error(
        `Cannot approve review with status '${review.status}'. ` +
          `Only reviews with status 'waiting' or 'in_review' can be approved.`,
      );
    }

    // Optimistic concurrency check
    if (args.expectedVersion !== undefined) {
      const currentVersion = review.version ?? 0;
      if (currentVersion !== args.expectedVersion) {
        throw new Error(
          `Optimistic lock failed: expected version ${args.expectedVersion}, but current version is ${currentVersion}. ` +
            `The review was modified by another user. Please refresh and try again.`,
        );
      }
    }

    // Validate and sanitize approval comment if provided
    let sanitizedComment: string | undefined;
    if (args.comment) {
      if (args.comment.trim().length === 0) {
        throw new Error('Comment body cannot be empty');
      }
      if (args.comment.length > 10000) {
        throw new Error('Comment body too long (max 10000 characters)');
      }
      // Sanitize HTML to prevent XSS
      sanitizedComment = sanitizeCommentBody(args.comment);
    }

    const now = Date.now();

    // Add approval comment if provided
    let updatedComments = review.comments || [];
    let approvalCommentId: string | undefined;
    if (sanitizedComment) {
      // Generate deterministic ID using timestamp + index + user for better uniqueness
      const commentId = `${now}-${updatedComments.length}-${sessionCtx.userId}-${Math.random().toString(36).slice(2, 8)}`;
      approvalCommentId = commentId;
      updatedComments = [
        ...updatedComments,
        {
          id: commentId,
          author_id: sessionCtx.userId,
          body: sanitizedComment,
          visibility: args.commentVisibility || 'shared',
          created_at: now,
          updated_at: now,
        },
      ];
    }

    // Update review with version increment for optimistic concurrency
    await ctx.db.patch(args.reviewId, {
      status: 'approved',
      rubric: args.rubric !== undefined ? args.rubric : review.rubric,
      comments: updatedComments,
      reviewed_by: sessionCtx.userId,
      reviewed_at: now,
      updated_at: now,
      version: (review.version ?? 0) + 1,
    });

    // Audit log for approval
    await createAuditLog(ctx, {
      actorId: sessionCtx.userId,
      universityId: review.university_id,
      action: 'review.approved',
      entityType: 'advisor_review',
      entityId: args.reviewId,
      studentId: review.student_id,
      newValue: { status: 'approved', approved_at: now },
    });

    // Audit log for approval comment if provided (FERPA compliance)
    if (sanitizedComment && approvalCommentId) {
      await createAuditLog(ctx, {
        actorId: sessionCtx.userId,
        universityId: review.university_id,
        action: 'review.comment_added',
        entityType: 'advisor_review',
        entityId: args.reviewId,
        studentId: review.student_id,
        newValue: {
          visibility: args.commentVisibility || 'shared',
          comment_id: approvalCommentId,
          context: 'approval',
        },
      });
    }

    return { success: true };
  },
});
