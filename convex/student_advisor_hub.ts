/**
 * Student Advisor Hub - Convex Queries
 *
 * Student-facing queries for the Advisor Hub feature.
 * All queries enforce the hard constraint: role === 'student' AND university_id exists.
 *
 * Security:
 * - Every query calls requireUniversityStudent()
 * - All data is filtered by student_user_id === userId
 * - All data is scoped by university_id
 * - Session notes with visibility='advisor_only' are NEVER returned
 */

import { v } from 'convex/values';

import { Doc, Id } from './_generated/dataModel';
import { query } from './_generated/server';
import { getStudentAdvisor, requireUniversityStudent } from './student_advisor_auth';

// ============================================================================
// Types
// ============================================================================

export interface HubOverview {
  advisor: {
    advisorId: Id<'users'>;
    advisorName: string;
    advisorEmail: string;
    advisorTitle?: string;
    hasAvailability: boolean;
  } | null;
  nextSession: {
    sessionId: Id<'advisor_sessions'>;
    title: string;
    startAt: number;
    sessionType?: string;
  } | null;
  pendingReviews: number;
  openActionItems: number;
  unreadMessages: number;
}

export interface StudentSession {
  _id: Id<'advisor_sessions'>;
  title?: string;
  start_at: number;
  end_at?: number;
  session_type?: string;
  status?: string;
  location?: string;
  meeting_url?: string;
  // Only shared notes - never advisor-only notes
  sharedNotes: string[];
}

export interface StudentMessage {
  _id: Id<'advisor_messages'>;
  body: string;
  sender_type: 'student' | 'advisor';
  created_at: number;
  isRead: boolean;
  // Optional context
  session_id?: Id<'advisor_sessions'>;
  review_id?: Id<'advisor_reviews'>;
}

// ============================================================================
// Hub Overview Query
// ============================================================================

/**
 * Get overview data for the Student Advisor Hub dashboard.
 * Returns:
 * - Assigned advisor info (or null if not assigned)
 * - Next upcoming session
 * - Count of pending reviews
 * - Count of open action items
 * - Count of unread messages
 */
export const getHubOverview = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, { clerkId }): Promise<HubOverview> => {
    // Enforce authorization
    const { userId, universityId } = await requireUniversityStudent(ctx, clerkId);

    // Get assigned advisor
    const advisor = await getStudentAdvisor(ctx, userId, universityId);

    // Get next upcoming session
    const now = Date.now();
    let nextSession: HubOverview['nextSession'] = null;

    if (advisor) {
      const upcomingSession = await ctx.db
        .query('advisor_sessions')
        .withIndex('by_student', (q) => q.eq('student_id', userId))
        .filter((q) =>
          q.and(q.gte(q.field('start_at'), now), q.neq(q.field('status'), 'cancelled')),
        )
        .order('asc')
        .first();

      if (upcomingSession) {
        nextSession = {
          sessionId: upcomingSession._id,
          title: upcomingSession.title || 'Advising Session',
          startAt: upcomingSession.start_at,
          sessionType: upcomingSession.session_type,
        };
      }
    }

    // Count pending reviews (student-initiated requests)
    const pendingReviews = await ctx.db
      .query('student_review_requests')
      .withIndex('by_student', (q) => q.eq('student_user_id', userId).eq('status', 'submitted'))
      .collect();
    const pendingReviewsCount = pendingReviews.length;

    // Count open action items (follow-ups assigned to student)
    // Use unified follow_ups table - user_id is the student the task relates to
    const openActionItems = await ctx.db
      .query('follow_ups')
      .withIndex('by_user', (q) => q.eq('user_id', userId))
      .filter((q) =>
        q.and(q.neq(q.field('status'), 'done'), q.eq(q.field('university_id'), universityId)),
      )
      .collect();
    const openActionItemsCount = openActionItems.length;

    // Count unread messages using last-read-pointer pattern
    let unreadMessagesCount = 0;
    if (advisor) {
      // Get the conversation state for this student-advisor pair
      const conversationState = await ctx.db
        .query('advisor_conversation_state')
        .withIndex('by_conversation', (q) =>
          q.eq('student_user_id', userId).eq('advisor_user_id', advisor.advisorId),
        )
        .unique();

      const studentLastReadAt = conversationState?.student_last_read_at ?? 0;

      // Count messages from advisor that are newer than the read pointer
      const unreadMessages = await ctx.db
        .query('advisor_messages')
        .withIndex('by_conversation', (q) =>
          q.eq('student_user_id', userId).eq('advisor_user_id', advisor.advisorId),
        )
        .filter((q) =>
          q.and(
            q.eq(q.field('sender_type'), 'advisor'),
            q.gt(q.field('created_at'), studentLastReadAt),
          ),
        )
        .collect();
      unreadMessagesCount = unreadMessages.length;
    }

    return {
      advisor,
      nextSession,
      pendingReviews: pendingReviewsCount,
      openActionItems: openActionItemsCount,
      unreadMessages: unreadMessagesCount,
    };
  },
});

// ============================================================================
// Advisor Queries
// ============================================================================

/**
 * Get the student's assigned advisor.
 */
export const getMyAdvisor = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, { clerkId }) => {
    const { userId, universityId } = await requireUniversityStudent(ctx, clerkId);
    return await getStudentAdvisor(ctx, userId, universityId);
  },
});

// ============================================================================
// Sessions Queries
// ============================================================================

/**
 * Get student's sessions with their advisor.
 * Only returns sessions where the student is a participant.
 * Never returns advisor-only notes.
 */
export const getMySessions = query({
  args: {
    clerkId: v.string(),
    filter: v.optional(v.union(v.literal('upcoming'), v.literal('past'), v.literal('all'))),
  },
  handler: async (ctx, { clerkId, filter = 'all' }) => {
    const { userId } = await requireUniversityStudent(ctx, clerkId);
    const now = Date.now();

    let sessions = await ctx.db
      .query('advisor_sessions')
      .withIndex('by_student', (q) => q.eq('student_id', userId))
      .order('desc')
      .collect();

    // Apply filter
    if (filter === 'upcoming') {
      sessions = sessions.filter((s) => s.start_at >= now && s.status !== 'cancelled');
    } else if (filter === 'past') {
      sessions = sessions.filter((s) => s.start_at < now || s.status === 'completed');
    }

    // Map to student-safe format (no advisor-only notes)
    return sessions.map((session) => ({
      _id: session._id,
      title: session.title,
      start_at: session.start_at,
      end_at: session.end_at,
      session_type: session.session_type,
      status: session.status,
      location: session.location,
      meeting_url: session.meeting_url,
      duration_minutes: session.duration_minutes,
      created_at: session.created_at,
    }));
  },
});

/**
 * Get details for a specific session.
 * Only returns shared notes - never advisor-only notes.
 */
export const getMySessionDetail = query({
  args: {
    clerkId: v.string(),
    sessionId: v.id('advisor_sessions'),
  },
  handler: async (ctx, { clerkId, sessionId }) => {
    const { userId } = await requireUniversityStudent(ctx, clerkId);

    // Get session
    const session = await ctx.db.get(sessionId);
    if (!session || session.student_id !== userId) {
      return null;
    }

    // Check session visibility - only return shared sessions
    // Sessions with visibility='advisor_only' should not be returned to students
    if (session.visibility === 'advisor_only') {
      return null;
    }

    // Get advisor info
    const advisor = session.advisor_id ? await ctx.db.get(session.advisor_id) : null;

    return {
      _id: session._id,
      title: session.title,
      start_at: session.start_at,
      end_at: session.end_at,
      session_type: session.session_type,
      status: session.status,
      location: session.location,
      meeting_url: session.meeting_url,
      duration_minutes: session.duration_minutes,
      created_at: session.created_at,
      // Only include notes if session is shared visibility
      sharedNotes: session.visibility === 'shared' && session.notes ? session.notes : null,
      // Advisor info
      advisor: advisor
        ? {
            name: advisor.name || advisor.email,
            email: advisor.email,
          }
        : null,
    };
  },
});

// ============================================================================
// Messages Queries
// ============================================================================

/**
 * Get messages between student and their advisor.
 * Uses "last read pointer" pattern to compute isRead status efficiently.
 */
export const getMyMessages = query({
  args: {
    clerkId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { clerkId, limit = 50 }) => {
    const { userId, universityId } = await requireUniversityStudent(ctx, clerkId);

    // Get advisor
    const advisor = await getStudentAdvisor(ctx, userId, universityId);
    if (!advisor) {
      return [];
    }

    // Get conversation state for read pointer
    const conversationState = await ctx.db
      .query('advisor_conversation_state')
      .withIndex('by_conversation', (q) =>
        q.eq('student_user_id', userId).eq('advisor_user_id', advisor.advisorId),
      )
      .unique();

    const studentLastReadAt = conversationState?.student_last_read_at ?? 0;

    // Get messages in conversation
    const messages = await ctx.db
      .query('advisor_messages')
      .withIndex('by_conversation', (q) =>
        q.eq('student_user_id', userId).eq('advisor_user_id', advisor.advisorId),
      )
      .order('desc')
      .take(limit);

    return messages.map((msg) => ({
      _id: msg._id,
      body: msg.body,
      sender_type: msg.sender_type,
      created_at: msg.created_at,
      // Message is read if: sent by student OR created before the read pointer
      isRead: msg.sender_type === 'student' || msg.created_at <= studentLastReadAt,
      session_id: msg.session_id,
      review_id: msg.review_id,
    }));
  },
});

/**
 * Get count of unread messages.
 * Uses "last read pointer" pattern for efficient unread detection.
 */
export const getUnreadMessageCount = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, { clerkId }) => {
    const { userId, universityId } = await requireUniversityStudent(ctx, clerkId);

    const advisor = await getStudentAdvisor(ctx, userId, universityId);
    if (!advisor) {
      return 0;
    }

    // Get conversation state for read pointer
    const conversationState = await ctx.db
      .query('advisor_conversation_state')
      .withIndex('by_conversation', (q) =>
        q.eq('student_user_id', userId).eq('advisor_user_id', advisor.advisorId),
      )
      .unique();

    const studentLastReadAt = conversationState?.student_last_read_at ?? 0;

    // Count messages from advisor that are newer than the read pointer
    const unreadMessages = await ctx.db
      .query('advisor_messages')
      .withIndex('by_conversation', (q) =>
        q.eq('student_user_id', userId).eq('advisor_user_id', advisor.advisorId),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field('sender_type'), 'advisor'),
          q.gt(q.field('created_at'), studentLastReadAt),
        ),
      )
      .collect();

    return unreadMessages.length;
  },
});

// ============================================================================
// Review Requests Queries
// ============================================================================

/**
 * Get student's review requests.
 */
export const getMyReviewRequests = query({
  args: {
    clerkId: v.string(),
    filter: v.optional(v.union(v.literal('pending'), v.literal('complete'), v.literal('all'))),
  },
  handler: async (ctx, { clerkId, filter = 'all' }) => {
    const { userId } = await requireUniversityStudent(ctx, clerkId);

    let requests = await ctx.db
      .query('student_review_requests')
      .withIndex('by_student', (q) => q.eq('student_user_id', userId))
      .order('desc')
      .collect();

    // Apply filter
    if (filter === 'pending') {
      requests = requests.filter((r) => ['draft', 'submitted', 'in_review'].includes(r.status));
    } else if (filter === 'complete') {
      requests = requests.filter((r) => ['feedback_ready', 'complete'].includes(r.status));
    }

    // Enrich with asset names
    const enriched = await Promise.all(
      requests.map(async (req) => {
        let assetName = 'Document';

        if (req.resume_id) {
          const resume = await ctx.db.get(req.resume_id);
          assetName = resume?.title || 'Resume';
        } else if (req.cover_letter_id) {
          const coverLetter = await ctx.db.get(req.cover_letter_id);
          assetName = coverLetter?.name || 'Cover Letter';
        }

        return {
          _id: req._id,
          asset_type: req.asset_type,
          assetName,
          status: req.status,
          student_note: req.student_note,
          created_at: req.created_at,
          submitted_at: req.submitted_at,
          updated_at: req.updated_at,
        };
      }),
    );

    return enriched;
  },
});

/**
 * Get details for a specific review request.
 */
export const getReviewRequestDetail = query({
  args: {
    clerkId: v.string(),
    requestId: v.id('student_review_requests'),
  },
  handler: async (ctx, { clerkId, requestId }) => {
    const { userId } = await requireUniversityStudent(ctx, clerkId);

    const request = await ctx.db.get(requestId);
    if (!request || request.student_user_id !== userId) {
      return null;
    }

    // Get asset details
    let assetName = 'Document';
    let assetUrl: string | undefined;

    if (request.resume_id) {
      const resume = await ctx.db.get(request.resume_id);
      assetName = resume?.title || 'Resume';
    } else if (request.cover_letter_id) {
      const coverLetter = await ctx.db.get(request.cover_letter_id);
      assetName = coverLetter?.name || 'Cover Letter';
    } else if (request.document_url) {
      assetUrl = request.document_url;
      assetName = 'External Document';
    }

    // Get advisor info if assigned
    let advisorInfo = null;
    if (request.advisor_user_id) {
      const advisor = await ctx.db.get(request.advisor_user_id);
      if (advisor) {
        advisorInfo = {
          name: advisor.name || advisor.email,
          email: advisor.email,
        };
      }
    }

    // Get any feedback from advisor_reviews table if linked
    // For now, we'll include the basic request info
    // Feedback would come from a separate advisor_reviews or comments system

    return {
      _id: request._id,
      asset_type: request.asset_type,
      assetName,
      assetUrl,
      resume_id: request.resume_id,
      cover_letter_id: request.cover_letter_id,
      status: request.status,
      student_note: request.student_note,
      advisor: advisorInfo,
      created_at: request.created_at,
      submitted_at: request.submitted_at,
      updated_at: request.updated_at,
    };
  },
});

// ============================================================================
// Action Items Queries
// ============================================================================

/**
 * Get student's action items (follow-ups assigned by advisor).
 */
export const getMyActionItems = query({
  args: {
    clerkId: v.string(),
    filter: v.optional(v.union(v.literal('open'), v.literal('done'), v.literal('all'))),
  },
  handler: async (ctx, { clerkId, filter = 'all' }) => {
    const { userId, universityId } = await requireUniversityStudent(ctx, clerkId);

    // Use unified follow_ups table - user_id is the student the task relates to
    let items = await ctx.db
      .query('follow_ups')
      .withIndex('by_user', (q) => q.eq('user_id', userId))
      .filter((q) => q.eq(q.field('university_id'), universityId))
      .collect();

    // Apply filter
    if (filter === 'open') {
      items = items.filter((i) => i.status !== 'done');
    } else if (filter === 'done') {
      items = items.filter((i) => i.status === 'done');
    }

    // Check for overdue items
    const now = Date.now();

    // Sort by due date (soonest first), then by creation date
    items.sort((a, b) => {
      if (a.due_at && b.due_at) return a.due_at - b.due_at;
      if (a.due_at) return -1;
      if (b.due_at) return 1;
      return b.created_at - a.created_at;
    });

    return items.map((item) => ({
      _id: item._id,
      title: item.title,
      description: item.description,
      status: item.status,
      due_at: item.due_at,
      priority: item.priority,
      isOverdue: item.due_at ? item.due_at < now && item.status !== 'done' : false,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));
  },
});

// ============================================================================
// Resources Queries
// ============================================================================

/**
 * Get shared resources from advisor.
 */
export const getSharedResources = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, { clerkId }) => {
    const { userId, universityId } = await requireUniversityStudent(ctx, clerkId);

    // Get advisor
    const advisor = await getStudentAdvisor(ctx, userId, universityId);

    // Get resources visible to this student
    // If advisor is assigned, get their resources + university-wide resources
    const resources = await ctx.db
      .query('advisor_resources')
      .withIndex('by_university', (q) => q.eq('university_id', universityId))
      .collect();

    // Filter to resources student can see
    const visibleResources = resources.filter((r) => {
      // All visibility resources are always visible
      if (!r.visibility || r.visibility === 'all') {
        return true;
      }
      // assigned_students visibility requires advisor match
      if (r.visibility === 'assigned_students' && advisor) {
        return r.advisor_user_id === advisor.advisorId;
      }
      return false;
    });

    // Get student's pinned resources
    const pinnedIds = new Set(
      (
        await ctx.db
          .query('student_pinned_resources')
          .withIndex('by_student', (q) => q.eq('student_user_id', userId))
          .collect()
      ).map((p) => p.resource_id),
    );

    return visibleResources.map((r) => ({
      _id: r._id,
      title: r.title,
      description: r.description,
      url: r.url,
      tags: r.tags || [],
      isPinned: pinnedIds.has(r._id),
      created_at: r.created_at,
    }));
  },
});

// ============================================================================
// Settings Queries
// ============================================================================

/**
 * Get student's advisor sharing settings.
 */
export const getMyAdvisorSettings = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, { clerkId }) => {
    const { userId } = await requireUniversityStudent(ctx, clerkId);

    const settings = await ctx.db
      .query('student_advisor_settings')
      .withIndex('by_student', (q) => q.eq('student_user_id', userId))
      .unique();

    // Return settings or defaults
    return (
      settings || {
        share_career_profile: true,
        share_applications: true,
        share_goals: true,
        share_documents: true,
        notification_preference: 'instant' as const,
      }
    );
  },
});

// ============================================================================
// Booking & Availability Queries
// ============================================================================

/**
 * Get advisor's availability schedule.
 */
export const getAdvisorAvailability = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, { clerkId }) => {
    const { userId, universityId } = await requireUniversityStudent(ctx, clerkId);

    const advisor = await getStudentAdvisor(ctx, userId, universityId);
    if (!advisor) {
      return [];
    }

    const availability = await ctx.db
      .query('advisor_availability')
      .withIndex('by_advisor', (q) =>
        q.eq('advisor_user_id', advisor.advisorId).eq('is_active', true),
      )
      .collect();

    return availability.map((slot) => ({
      day_of_week: slot.day_of_week,
      start_time: slot.start_time,
      end_time: slot.end_time,
      slot_duration_minutes: slot.slot_duration_minutes,
      timezone: slot.timezone,
    }));
  },
});

/**
 * Get student's booking requests.
 */
export const getMyBookings = query({
  args: {
    clerkId: v.string(),
    filter: v.optional(v.union(v.literal('pending'), v.literal('confirmed'), v.literal('all'))),
  },
  handler: async (ctx, { clerkId, filter = 'all' }) => {
    const { userId } = await requireUniversityStudent(ctx, clerkId);

    let bookings = await ctx.db
      .query('session_bookings')
      .withIndex('by_student', (q) => q.eq('student_user_id', userId))
      .order('desc')
      .collect();

    // Apply filter
    if (filter === 'pending') {
      bookings = bookings.filter((b) => b.status === 'pending');
    } else if (filter === 'confirmed') {
      bookings = bookings.filter((b) => b.status === 'confirmed');
    }

    return bookings.map((b) => ({
      _id: b._id,
      requested_start: b.requested_start,
      requested_end: b.requested_end,
      session_type: b.session_type,
      student_note: b.student_note,
      status: b.status,
      decline_reason: b.decline_reason,
      session_id: b.session_id,
      created_at: b.created_at,
    }));
  },
});
