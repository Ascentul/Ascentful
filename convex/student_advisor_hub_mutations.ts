/**
 * Student Advisor Hub - Convex Mutations
 *
 * Student-facing mutations for the Advisor Hub feature.
 * All mutations enforce the hard constraint: role === 'student' AND university_id exists.
 *
 * Security:
 * - Every mutation calls requireUniversityStudent()
 * - All writes are scoped to the authenticated student
 * - All writes include university_id for tenant isolation
 */

import { ConvexError, v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { mutation } from './_generated/server';
import {
  getStudentAdvisor,
  requireStudentHasAdvisor,
  requireUniversityStudent,
} from './student_advisor_auth';

// ============================================================================
// Messages Mutations
// ============================================================================

/**
 * Send a message to the assigned advisor.
 */
export const sendMessage = mutation({
  args: {
    clerkId: v.string(),
    body: v.string(),
    sessionId: v.optional(v.id('advisor_sessions')),
    reviewId: v.optional(v.id('advisor_reviews')),
  },
  handler: async (ctx, { clerkId, body, sessionId, reviewId }) => {
    const { userId, universityId } = await requireUniversityStudent(ctx, clerkId);

    // Require advisor to be assigned
    const advisor = await requireStudentHasAdvisor(ctx, userId, universityId);

    // Validate body
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Message body cannot be empty',
      });
    }

    if (trimmedBody.length > 5000) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Message body cannot exceed 5000 characters',
      });
    }

    // Validate session ownership if provided
    if (sessionId) {
      const session = await ctx.db.get(sessionId);
      if (!session || session.student_id !== userId) {
        throw new ConvexError({
          code: 'NOT_FOUND',
          message: 'Session not found',
        });
      }
    }

    // Validate review ownership if provided
    if (reviewId) {
      const review = await ctx.db.get(reviewId);
      if (!review || review.student_id !== userId) {
        throw new ConvexError({
          code: 'NOT_FOUND',
          message: 'Review not found',
        });
      }
    }

    const now = Date.now();

    const messageId = await ctx.db.insert('advisor_messages', {
      university_id: universityId,
      student_user_id: userId,
      advisor_user_id: advisor.advisorId,
      body: trimmedBody,
      sender_type: 'student',
      session_id: sessionId,
      review_id: reviewId,
      read_by_student_at: now, // Mark as read by sender
      created_at: now,
    });

    return { messageId };
  },
});

/**
 * Mark all messages from advisor as read.
 */
export const markMessagesAsRead = mutation({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, { clerkId }) => {
    const { userId, universityId } = await requireUniversityStudent(ctx, clerkId);

    const advisor = await getStudentAdvisor(ctx, userId, universityId);
    if (!advisor) {
      return { updated: 0 };
    }

    // Get unread messages from advisor
    const unreadMessages = await ctx.db
      .query('advisor_messages')
      .withIndex('by_student', (q) => q.eq('student_user_id', userId))
      .filter((q) =>
        q.and(
          q.eq(q.field('sender_type'), 'advisor'),
          q.eq(q.field('read_by_student_at'), undefined),
        ),
      )
      .collect();

    const now = Date.now();

    // Mark each as read
    for (const msg of unreadMessages) {
      await ctx.db.patch(msg._id, {
        read_by_student_at: now,
      });
    }

    return { updated: unreadMessages.length };
  },
});

// ============================================================================
// Review Request Mutations
// ============================================================================

/**
 * Create a new review request.
 */
export const createReviewRequest = mutation({
  args: {
    clerkId: v.string(),
    assetType: v.union(v.literal('resume'), v.literal('cover_letter'), v.literal('other')),
    resumeId: v.optional(v.id('resumes')),
    coverLetterId: v.optional(v.id('cover_letters')),
    documentUrl: v.optional(v.string()),
    studentNote: v.optional(v.string()),
    submitNow: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { clerkId, assetType, resumeId, coverLetterId, documentUrl, studentNote, submitNow },
  ) => {
    const { userId, universityId } = await requireUniversityStudent(ctx, clerkId);

    // Validate asset reference
    if (assetType === 'resume') {
      if (!resumeId) {
        throw new ConvexError({
          code: 'INVALID_INPUT',
          message: 'Resume ID is required for resume review requests',
        });
      }
      // Verify ownership
      const resume = await ctx.db.get(resumeId);
      if (!resume || resume.user_id !== userId) {
        throw new ConvexError({
          code: 'NOT_FOUND',
          message: 'Resume not found',
        });
      }
    } else if (assetType === 'cover_letter') {
      if (!coverLetterId) {
        throw new ConvexError({
          code: 'INVALID_INPUT',
          message: 'Cover letter ID is required for cover letter review requests',
        });
      }
      // Verify ownership
      const coverLetter = await ctx.db.get(coverLetterId);
      if (!coverLetter || coverLetter.user_id !== userId) {
        throw new ConvexError({
          code: 'NOT_FOUND',
          message: 'Cover letter not found',
        });
      }
    } else if (assetType === 'other') {
      if (!documentUrl) {
        throw new ConvexError({
          code: 'INVALID_INPUT',
          message: 'Document URL is required for other document types',
        });
      }
    }

    // Get advisor if assigned
    const advisor = await getStudentAdvisor(ctx, userId, universityId);

    const now = Date.now();
    const status = submitNow ? 'submitted' : 'draft';

    const requestId = await ctx.db.insert('student_review_requests', {
      university_id: universityId,
      student_user_id: userId,
      advisor_user_id: advisor?.advisorId,
      asset_type: assetType,
      resume_id: resumeId,
      cover_letter_id: coverLetterId,
      document_url: documentUrl,
      student_note: studentNote,
      status,
      created_at: now,
      submitted_at: submitNow ? now : undefined,
      updated_at: now,
    });

    return { requestId, status };
  },
});

/**
 * Submit a draft review request.
 */
export const submitReviewRequest = mutation({
  args: {
    clerkId: v.string(),
    requestId: v.id('student_review_requests'),
  },
  handler: async (ctx, { clerkId, requestId }) => {
    const { userId } = await requireUniversityStudent(ctx, clerkId);

    const request = await ctx.db.get(requestId);
    if (!request || request.student_user_id !== userId) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Review request not found',
      });
    }

    if (request.status !== 'draft') {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: 'Only draft requests can be submitted',
      });
    }

    const now = Date.now();

    await ctx.db.patch(requestId, {
      status: 'submitted',
      submitted_at: now,
      updated_at: now,
    });

    return { success: true };
  },
});

/**
 * Cancel a pending review request.
 */
export const cancelReviewRequest = mutation({
  args: {
    clerkId: v.string(),
    requestId: v.id('student_review_requests'),
  },
  handler: async (ctx, { clerkId, requestId }) => {
    const { userId } = await requireUniversityStudent(ctx, clerkId);

    const request = await ctx.db.get(requestId);
    if (!request || request.student_user_id !== userId) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Review request not found',
      });
    }

    // Can only cancel draft or submitted requests
    if (!['draft', 'submitted'].includes(request.status)) {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: 'Can only cancel draft or submitted requests',
      });
    }

    // Soft delete - mark as cancelled for audit trail
    await ctx.db.patch(requestId, {
      status: 'cancelled',
      updated_at: Date.now(),
    });

    return { success: true };
  },
});

// ============================================================================
// Action Items Mutations
// ============================================================================

/**
 * Mark an action item as complete.
 */
export const completeActionItem = mutation({
  args: {
    clerkId: v.string(),
    itemId: v.id('follow_ups'),
  },
  handler: async (ctx, { clerkId, itemId }) => {
    const { userId, universityId } = await requireUniversityStudent(ctx, clerkId);

    const item = await ctx.db.get(itemId);
    if (!item || item.user_id !== userId || item.university_id !== universityId) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Action item not found',
      });
    }

    if (item.status === 'done') {
      return { success: true, alreadyComplete: true };
    }

    const now = Date.now();

    await ctx.db.patch(itemId, {
      status: 'done',
      completed_at: now,
      updated_at: now,
    });

    return { success: true, alreadyComplete: false };
  },
});

/**
 * Reopen a completed action item.
 */
export const reopenActionItem = mutation({
  args: {
    clerkId: v.string(),
    itemId: v.id('follow_ups'),
  },
  handler: async (ctx, { clerkId, itemId }) => {
    const { userId, universityId } = await requireUniversityStudent(ctx, clerkId);

    const item = await ctx.db.get(itemId);
    if (!item || item.user_id !== userId || item.university_id !== universityId) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Action item not found',
      });
    }

    if (item.status !== 'done') {
      return { success: true, wasOpen: true };
    }

    const now = Date.now();

    await ctx.db.patch(itemId, {
      status: 'open',
      completed_at: null,
      updated_at: now,
    });

    return { success: true, wasOpen: false };
  },
});

// ============================================================================
// Resources Mutations
// ============================================================================

/**
 * Pin a resource for quick access.
 */
export const pinResource = mutation({
  args: {
    clerkId: v.string(),
    resourceId: v.id('advisor_resources'),
  },
  handler: async (ctx, { clerkId, resourceId }) => {
    const { userId, universityId } = await requireUniversityStudent(ctx, clerkId);

    // Verify resource exists and is visible to student
    const resource = await ctx.db.get(resourceId);
    if (!resource || resource.university_id !== universityId) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Resource not found',
      });
    }

    // Check if already pinned
    const existing = await ctx.db
      .query('student_pinned_resources')
      .withIndex('by_student', (q) => q.eq('student_user_id', userId))
      .filter((q) => q.eq(q.field('resource_id'), resourceId))
      .first();

    if (existing) {
      return { pinId: existing._id, alreadyPinned: true };
    }

    const now = Date.now();

    const pinId = await ctx.db.insert('student_pinned_resources', {
      university_id: universityId,
      student_user_id: userId,
      resource_id: resourceId,
      pinned_at: now,
    });

    return { pinId, alreadyPinned: false };
  },
});

/**
 * Unpin a resource.
 */
export const unpinResource = mutation({
  args: {
    clerkId: v.string(),
    resourceId: v.id('advisor_resources'),
  },
  handler: async (ctx, { clerkId, resourceId }) => {
    const { userId } = await requireUniversityStudent(ctx, clerkId);

    // Find the pin
    const pin = await ctx.db
      .query('student_pinned_resources')
      .withIndex('by_student', (q) => q.eq('student_user_id', userId))
      .filter((q) => q.eq(q.field('resource_id'), resourceId))
      .first();

    if (!pin) {
      return { success: true, wasNotPinned: true };
    }

    await ctx.db.delete(pin._id);

    return { success: true, wasNotPinned: false };
  },
});

// ============================================================================
// Settings Mutations
// ============================================================================

/**
 * Update advisor sharing settings.
 */
export const updateAdvisorSettings = mutation({
  args: {
    clerkId: v.string(),
    shareCareerProfile: v.optional(v.boolean()),
    shareApplications: v.optional(v.boolean()),
    shareGoals: v.optional(v.boolean()),
    shareDocuments: v.optional(v.boolean()),
    notificationPreference: v.optional(
      v.union(v.literal('instant'), v.literal('daily'), v.literal('off')),
    ),
  },
  handler: async (
    ctx,
    {
      clerkId,
      shareCareerProfile,
      shareApplications,
      shareGoals,
      shareDocuments,
      notificationPreference,
    },
  ) => {
    const { userId, universityId } = await requireUniversityStudent(ctx, clerkId);

    // Find existing settings
    const existing = await ctx.db
      .query('student_advisor_settings')
      .withIndex('by_student', (q) => q.eq('student_user_id', userId))
      .unique();

    const now = Date.now();

    if (existing) {
      // Update existing
      const updates: Record<string, unknown> = { updated_at: now };

      if (shareCareerProfile !== undefined) {
        updates.share_career_profile = shareCareerProfile;
      }
      if (shareApplications !== undefined) {
        updates.share_applications = shareApplications;
      }
      if (shareGoals !== undefined) {
        updates.share_goals = shareGoals;
      }
      if (shareDocuments !== undefined) {
        updates.share_documents = shareDocuments;
      }
      if (notificationPreference !== undefined) {
        updates.notification_preference = notificationPreference;
      }

      await ctx.db.patch(existing._id, updates);

      return { settingsId: existing._id, created: false };
    } else {
      // Create new settings
      const settingsId = await ctx.db.insert('student_advisor_settings', {
        university_id: universityId,
        student_user_id: userId,
        share_career_profile: shareCareerProfile ?? true,
        share_applications: shareApplications ?? true,
        share_goals: shareGoals ?? true,
        share_documents: shareDocuments ?? true,
        notification_preference: notificationPreference ?? 'instant',
        created_at: now,
        updated_at: now,
      });

      return { settingsId, created: true };
    }
  },
});

// ============================================================================
// Session Booking Mutations
// ============================================================================

/**
 * Create a session booking request.
 */
export const createBooking = mutation({
  args: {
    clerkId: v.string(),
    requestedStart: v.number(),
    requestedEnd: v.number(),
    sessionType: v.union(
      v.literal('career_planning'),
      v.literal('resume_review'),
      v.literal('mock_interview'),
      v.literal('application_strategy'),
      v.literal('general_advising'),
      v.literal('other'),
    ),
    studentNote: v.optional(v.string()),
  },
  handler: async (ctx, { clerkId, requestedStart, requestedEnd, sessionType, studentNote }) => {
    const { userId, universityId } = await requireUniversityStudent(ctx, clerkId);

    // Require advisor
    const advisor = await requireStudentHasAdvisor(ctx, userId, universityId);

    // Validate times
    const now = Date.now();
    if (requestedStart <= now) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Session must be scheduled in the future',
      });
    }

    if (requestedEnd <= requestedStart) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Session end time must be after start time',
      });
    }

    // Check for overlapping bookings
    const overlapping = await ctx.db
      .query('session_bookings')
      .withIndex('by_time', (q) => q.eq('advisor_user_id', advisor.advisorId))
      .filter((q) =>
        q.and(
          q.or(q.eq(q.field('status'), 'pending'), q.eq(q.field('status'), 'confirmed')),
          q.lt(q.field('requested_start'), requestedEnd),
          q.gt(q.field('requested_end'), requestedStart),
        ),
      )
      .first();

    if (overlapping) {
      throw new ConvexError({
        code: 'CONFLICT',
        message: 'This time slot is no longer available',
      });
    }

    const bookingId = await ctx.db.insert('session_bookings', {
      university_id: universityId,
      student_user_id: userId,
      advisor_user_id: advisor.advisorId,
      requested_start: requestedStart,
      requested_end: requestedEnd,
      session_type: sessionType,
      student_note: studentNote,
      status: 'pending',
      created_at: now,
      updated_at: now,
    });

    return { bookingId };
  },
});

/**
 * Cancel a pending booking request.
 */
export const cancelBooking = mutation({
  args: {
    clerkId: v.string(),
    bookingId: v.id('session_bookings'),
  },
  handler: async (ctx, { clerkId, bookingId }) => {
    const { userId } = await requireUniversityStudent(ctx, clerkId);

    const booking = await ctx.db.get(bookingId);
    if (!booking || booking.student_user_id !== userId) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Booking not found',
      });
    }

    // Can only cancel pending or confirmed bookings
    if (!['pending', 'confirmed'].includes(booking.status)) {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: 'This booking cannot be cancelled',
      });
    }

    const now = Date.now();

    await ctx.db.patch(bookingId, {
      status: 'cancelled',
      updated_at: now,
    });

    return { success: true };
  },
});
