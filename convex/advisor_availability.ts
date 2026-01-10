/**
 * Advisor Availability - Queries and Mutations
 *
 * Allows advisors to manage their weekly availability schedule
 * and handle session booking requests from students.
 */

import { ConvexError, v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { getCurrentUser } from './advisor_auth';

// ============================================================================
// Types
// ============================================================================

const DAY_OF_WEEK = v.number(); // 0-6 (Sunday-Saturday)
const TIME_STRING = v.string(); // "HH:MM" 24-hour format

// ============================================================================
// Availability Queries
// ============================================================================

/**
 * Get the current advisor's availability schedule.
 */
export const getMyAvailability = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    const availability = await ctx.db
      .query('advisor_availability')
      .withIndex('by_advisor', (q) => q.eq('advisor_user_id', user.userId))
      .collect();

    return availability.map((slot) => ({
      _id: slot._id,
      day_of_week: slot.day_of_week,
      start_time: slot.start_time,
      end_time: slot.end_time,
      slot_duration_minutes: slot.slot_duration_minutes,
      timezone: slot.timezone,
      is_active: slot.is_active,
    }));
  },
});

/**
 * Get pending booking requests for the advisor.
 */
export const getPendingBookings = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    const bookings = await ctx.db
      .query('session_bookings')
      .withIndex('by_advisor', (q) => q.eq('advisor_user_id', user.userId).eq('status', 'pending'))
      .order('asc')
      .collect();

    // Enrich with student info
    const enriched = await Promise.all(
      bookings.map(async (booking) => {
        const student = await ctx.db.get(booking.student_user_id);
        return {
          _id: booking._id,
          student: student
            ? {
                id: student._id,
                name: student.name || student.email,
                email: student.email,
              }
            : null,
          requested_start: booking.requested_start,
          requested_end: booking.requested_end,
          session_type: booking.session_type,
          student_note: booking.student_note,
          status: booking.status,
          created_at: booking.created_at,
        };
      }),
    );

    return enriched;
  },
});

/**
 * Get all booking requests for the advisor (all statuses).
 */
export const getAllBookings = query({
  args: {
    filter: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('confirmed'),
        v.literal('declined'),
        v.literal('cancelled'),
        v.literal('all'),
      ),
    ),
  },
  handler: async (ctx, { filter = 'all' }) => {
    const user = await getCurrentUser(ctx);

    // Use compound index to filter by status at database level for better performance
    const bookings = await ctx.db
      .query('session_bookings')
      .withIndex('by_advisor', (q) =>
        filter === 'all'
          ? q.eq('advisor_user_id', user.userId)
          : q.eq('advisor_user_id', user.userId).eq('status', filter),
      )
      .order('desc')
      .collect();

    // Enrich with student info
    const enriched = await Promise.all(
      bookings.map(async (booking) => {
        const student = await ctx.db.get(booking.student_user_id);
        return {
          _id: booking._id,
          student: student
            ? {
                id: student._id,
                name: student.name || student.email,
                email: student.email,
              }
            : null,
          requested_start: booking.requested_start,
          requested_end: booking.requested_end,
          session_type: booking.session_type,
          student_note: booking.student_note,
          status: booking.status,
          decline_reason: booking.decline_reason,
          session_id: booking.session_id,
          created_at: booking.created_at,
        };
      }),
    );

    return enriched;
  },
});

// ============================================================================
// Availability Mutations
// ============================================================================

/**
 * Add a new availability slot.
 */
export const addAvailabilitySlot = mutation({
  args: {
    dayOfWeek: DAY_OF_WEEK,
    startTime: TIME_STRING,
    endTime: TIME_STRING,
    slotDurationMinutes: v.number(),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, { dayOfWeek, startTime, endTime, slotDurationMinutes, timezone }) => {
    const user = await getCurrentUser(ctx);

    // Validate day of week
    if (dayOfWeek < 0 || dayOfWeek > 6) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Day of week must be between 0 (Sunday) and 6 (Saturday)',
      });
    }

    // Validate time format
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Time must be in HH:MM format (24-hour)',
      });
    }

    // Validate end time is after start time
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (endMinutes <= startMinutes) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'End time must be after start time',
      });
    }

    // Validate slot duration
    if (![15, 30, 45, 60, 90, 120].includes(slotDurationMinutes)) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Slot duration must be 15, 30, 45, 60, 90, or 120 minutes',
      });
    }

    // Get user's university
    const universityId = user.universityId;
    if (!universityId) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'User must be associated with a university',
      });
    }

    const now = Date.now();

    const slotId = await ctx.db.insert('advisor_availability', {
      university_id: universityId,
      advisor_user_id: user.userId,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      slot_duration_minutes: slotDurationMinutes,
      timezone: timezone,
      is_active: true,
      created_at: now,
      updated_at: now,
    });

    return { slotId };
  },
});

/**
 * Update an existing availability slot.
 */
export const updateAvailabilitySlot = mutation({
  args: {
    slotId: v.id('advisor_availability'),
    startTime: v.optional(TIME_STRING),
    endTime: v.optional(TIME_STRING),
    slotDurationMinutes: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { slotId, startTime, endTime, slotDurationMinutes, isActive }) => {
    const user = await getCurrentUser(ctx);

    const slot = await ctx.db.get(slotId);
    if (!slot || slot.advisor_user_id !== user.userId) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Availability slot not found',
      });
    }

    const updates: Record<string, unknown> = { updated_at: Date.now() };

    if (startTime !== undefined) {
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(startTime)) {
        throw new ConvexError({
          code: 'INVALID_INPUT',
          message: 'Time must be in HH:MM format (24-hour)',
        });
      }
      updates.start_time = startTime;
    }

    if (endTime !== undefined) {
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(endTime)) {
        throw new ConvexError({
          code: 'INVALID_INPUT',
          message: 'Time must be in HH:MM format (24-hour)',
        });
      }
      updates.end_time = endTime;
    }

    // Validate end time is after start time (using new values or existing)
    const finalStartTime = (updates.start_time as string) ?? slot.start_time;
    const finalEndTime = (updates.end_time as string) ?? slot.end_time;
    const [startHour, startMin] = finalStartTime.split(':').map(Number);
    const [endHour, endMin] = finalEndTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (endMinutes <= startMinutes) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'End time must be after start time',
      });
    }

    if (slotDurationMinutes !== undefined) {
      if (![15, 30, 45, 60, 90, 120].includes(slotDurationMinutes)) {
        throw new ConvexError({
          code: 'INVALID_INPUT',
          message: 'Slot duration must be 15, 30, 45, 60, 90, or 120 minutes',
        });
      }
      updates.slot_duration_minutes = slotDurationMinutes;
    }

    if (isActive !== undefined) {
      updates.is_active = isActive;
    }

    await ctx.db.patch(slotId, updates);

    return { success: true };
  },
});

/**
 * Delete an availability slot.
 */
export const deleteAvailabilitySlot = mutation({
  args: {
    slotId: v.id('advisor_availability'),
  },
  handler: async (ctx, { slotId }) => {
    const user = await getCurrentUser(ctx);

    const slot = await ctx.db.get(slotId);
    if (!slot || slot.advisor_user_id !== user.userId) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Availability slot not found',
      });
    }

    await ctx.db.delete(slotId);

    return { success: true };
  },
});

/**
 * Toggle availability slot active status.
 */
export const toggleAvailabilitySlot = mutation({
  args: {
    slotId: v.id('advisor_availability'),
  },
  handler: async (ctx, { slotId }) => {
    const user = await getCurrentUser(ctx);

    const slot = await ctx.db.get(slotId);
    if (!slot || slot.advisor_user_id !== user.userId) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Availability slot not found',
      });
    }

    await ctx.db.patch(slotId, {
      is_active: !slot.is_active,
      updated_at: Date.now(),
    });

    return { success: true, isActive: !slot.is_active };
  },
});

// ============================================================================
// Booking Management Mutations
// ============================================================================

/**
 * Confirm a booking request (creates a session).
 */
export const confirmBooking = mutation({
  args: {
    bookingId: v.id('session_bookings'),
    meetingUrl: v.optional(v.string()),
    location: v.optional(v.string()),
  },
  handler: async (ctx, { bookingId, meetingUrl, location }) => {
    const user = await getCurrentUser(ctx);

    const booking = await ctx.db.get(bookingId);
    if (!booking || booking.advisor_user_id !== user.userId) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Booking not found',
      });
    }

    if (booking.status !== 'pending') {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: 'Only pending bookings can be confirmed',
      });
    }

    // Check for overlapping confirmed bookings
    const existingBookings = await ctx.db
      .query('session_bookings')
      .withIndex('by_advisor', (q) =>
        q.eq('advisor_user_id', user.userId).eq('status', 'confirmed'),
      )
      .collect();

    const hasBookingOverlap = existingBookings.some((existing) => {
      // Skip the current booking being confirmed
      if (existing._id === bookingId) return false;
      // Check if time ranges overlap
      return (
        (booking.requested_start >= existing.requested_start &&
          booking.requested_start < existing.requested_end) ||
        (booking.requested_end > existing.requested_start &&
          booking.requested_end <= existing.requested_end) ||
        (booking.requested_start <= existing.requested_start &&
          booking.requested_end >= existing.requested_end)
      );
    });

    if (hasBookingOverlap) {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: 'This time slot conflicts with an existing booking',
      });
    }

    // Also check for existing scheduled sessions
    const existingSessions = await ctx.db
      .query('advisor_sessions')
      .withIndex('by_advisor', (q) => q.eq('advisor_id', user.userId))
      .filter((q) =>
        q.and(q.neq(q.field('status'), 'cancelled'), q.neq(q.field('status'), 'no_show')),
      )
      .collect();

    const hasSessionOverlap = existingSessions.some((session) => {
      const sessionEnd =
        session.end_at ?? session.start_at + (session.duration_minutes ?? 60) * 60 * 1000;
      // Check if time ranges overlap
      return (
        (booking.requested_start >= session.start_at && booking.requested_start < sessionEnd) ||
        (booking.requested_end > session.start_at && booking.requested_end <= sessionEnd) ||
        (booking.requested_start <= session.start_at && booking.requested_end >= sessionEnd)
      );
    });

    if (hasSessionOverlap) {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: 'This time slot conflicts with an existing session',
      });
    }

    const now = Date.now();

    // Create the session
    const sessionId = await ctx.db.insert('advisor_sessions', {
      university_id: booking.university_id,
      advisor_id: user.userId,
      student_id: booking.student_user_id,
      title: getSessionTypeLabel(booking.session_type),
      session_type: booking.session_type,
      start_at: booking.requested_start,
      end_at: booking.requested_end,
      duration_minutes: Math.round((booking.requested_end - booking.requested_start) / (1000 * 60)),
      status: 'scheduled',
      meeting_url: meetingUrl,
      location: location,
      visibility: 'shared',
      created_at: now,
      updated_at: now,
    });

    // Update booking status
    await ctx.db.patch(bookingId, {
      status: 'confirmed',
      session_id: sessionId,
      updated_at: now,
    });

    return { sessionId };
  },
});

/**
 * Decline a booking request.
 */
export const declineBooking = mutation({
  args: {
    bookingId: v.id('session_bookings'),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { bookingId, reason }) => {
    const user = await getCurrentUser(ctx);

    const booking = await ctx.db.get(bookingId);
    if (!booking || booking.advisor_user_id !== user.userId) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Booking not found',
      });
    }

    if (booking.status !== 'pending') {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: 'Only pending bookings can be declined',
      });
    }

    await ctx.db.patch(bookingId, {
      status: 'declined',
      decline_reason: reason,
      updated_at: Date.now(),
    });

    return { success: true };
  },
});

// ============================================================================
// Helpers
// ============================================================================

function getSessionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    career_planning: 'Career Planning Session',
    resume_review: 'Resume Review Session',
    mock_interview: 'Mock Interview',
    application_strategy: 'Application Strategy Session',
    general_advising: 'General Advising Session',
    other: 'Advising Session',
  };
  return labels[type] || 'Advising Session';
}
