/**
 * Activity Event Tracking Helper
 *
 * Provides a fire-and-forget helper for tracking user activity events.
 * Used by mutations to record user actions for engagement scoring.
 *
 * Usage:
 *   await trackActivity(ctx, {
 *     userId: user._id,
 *     universityId: user.university_id,
 *     eventType: 'application_created',
 *     eventCategory: 'application',
 *     entityType: 'application',
 *     entityId: applicationId,
 *     metadata: { company: args.company },
 *   });
 */

import { Id } from '../_generated/dataModel';
import { internal } from '../_generated/api';

// Event categories
export type EventCategory =
  | 'auth'
  | 'application'
  | 'document'
  | 'goal'
  | 'networking'
  | 'ai_coach'
  | 'career_explorer';

// Common event types (matches EVENT_TYPES in activity_events.ts)
export const ACTIVITY_EVENTS = {
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

export interface TrackActivityArgs {
  userId: Id<'users'>;
  universityId?: Id<'universities'> | null;
  eventType: string;
  eventCategory: EventCategory;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Track a user activity event (fire-and-forget).
 *
 * Uses scheduler to run the internal mutation asynchronously,
 * so it won't block the calling mutation or cause errors to propagate.
 *
 * @param ctx - Convex mutation context with scheduler
 * @param args - Activity event details
 */
export async function trackActivity(
  ctx: { scheduler: { runAfter: (delay: number, fn: any, args: any) => Promise<any> } },
  args: TrackActivityArgs,
): Promise<void> {
  try {
    await ctx.scheduler.runAfter(0, internal.activity_events.trackEventInternal, {
      userId: args.userId,
      universityId: args.universityId ?? undefined,
      eventType: args.eventType,
      eventCategory: args.eventCategory,
      entityType: args.entityType,
      entityId: args.entityId,
      metadata: args.metadata,
    });
  } catch (error) {
    // Silently fail - activity tracking should never break the main operation
    console.error('[Activity Tracker] Failed to schedule activity event:', error);
  }
}

/**
 * Track activity with safe fallback.
 *
 * Use this when you want to ensure tracking never throws,
 * even if the context is not available.
 */
export async function safeTrackActivity(
  ctx:
    | { scheduler?: { runAfter: (delay: number, fn: any, args: any) => Promise<any> } }
    | null
    | undefined,
  args: TrackActivityArgs,
): Promise<void> {
  if (!ctx?.scheduler) {
    console.warn('[Activity Tracker] No scheduler available, skipping activity tracking');
    return;
  }

  await trackActivity(
    ctx as { scheduler: { runAfter: (delay: number, fn: any, args: any) => Promise<any> } },
    args,
  );
}
