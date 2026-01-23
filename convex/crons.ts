/**
 * Scheduled background jobs (cron jobs)
 *
 * Convex cron jobs run on a schedule to perform maintenance tasks.
 * Configure schedules in convex.json or via the Convex dashboard.
 *
 * Documentation: https://docs.convex.dev/scheduling/cron-jobs
 */

import { cronJobs } from 'convex/server';

import { internal } from './_generated/api';

const crons = cronJobs();

// Daily audit log retention (7-year window)
// TODO: Adjust schedule as needed via Convex dashboard
crons.daily(
  'audit log retention',
  { hourUTC: 3, minuteUTC: 0 },
  internal.audit_logs.deleteExpiredAuditLogs,
);

/**
 * Monitor for duplicate student profiles
 *
 * Runs daily to detect race condition duplicates and alert administrators.
 * This is a defensive measure given Convex's lack of unique constraints.
 *
 * Schedule: Daily at 2 AM UTC (low traffic time)
 *
 * Actions taken:
 * - Queries for duplicate profiles
 * - Logs errors if duplicates found
 * - Provides cleanup instructions in logs
 *
 * Next steps if duplicates detected:
 * 1. Check Convex logs for duplicate report
 * 2. Run: npx convex run students:cleanupDuplicateProfiles --userId "affected-user-id"
 * 3. Consider investigating root cause (unusual traffic spike, bug, etc.)
 */
crons.daily(
  'monitor duplicate profiles',
  { hourUTC: 2, minuteUTC: 0 },
  internal.students.monitorDuplicateProfiles,
);

/**
 * Auto-expire old student invites
 *
 * Runs hourly to mark expired invites as "expired" status.
 * Uses the by_expires_at index for efficient queries.
 *
 * Schedule: Every hour at :00
 *
 * Actions taken:
 * - Queries for invites with status="pending" and expires_at < now
 * - Updates status to "expired"
 * - Logs count of expired invites
 *
 * This prevents students from accepting stale invites and keeps the
 * invite table clean for admin views.
 */
crons.hourly('expire old invites', { minuteUTC: 0 }, internal.students.expireOldInvites);

// Email auto updates: polling fallback (every 5 minutes)
crons.interval(
  'email auto updates polling',
  { minutes: 5 },
  internal.email_auto_updates.pollEnabledIntegrations,
);

// Email auto updates: retention for ignored/dismissed signals (180 days)
crons.daily(
  'email auto updates retention',
  { hourUTC: 4, minuteUTC: 0 },
  internal.email_auto_updates.pruneOldEmailSignals,
  { olderThanMs: 180 * 24 * 60 * 60 * 1000 },
);

// ============================================================================
// ENGAGEMENT SIGNALS SYSTEM
// ============================================================================

/**
 * Evaluate signal rules and create signals for matching students
 *
 * Runs every 30 minutes to detect:
 * - Inactive students (no activity for X days)
 * - Application stalls (stuck at a stage for X days)
 * - Engagement drops (score fell below threshold)
 * - No progress patterns (many rejections, no offers)
 *
 * Schedule: Every 30 minutes
 *
 * Actions taken:
 * - Evaluates all active rules for active/trial universities
 * - Creates signals for students matching rule conditions
 * - Respects cooldown periods to prevent signal spam
 *
 * Signals created will appear in advisor action queues.
 */
crons.interval('evaluate signal rules', { minutes: 30 }, internal.signals.evaluateSignalRules, {});

/**
 * Reactivate snoozed signals whose snooze period has expired
 *
 * Runs hourly to check for snoozed signals that should be reactivated.
 * When an advisor snoozes a signal, it's hidden until the snooze period ends.
 *
 * Schedule: Every hour at :15
 *
 * Actions taken:
 * - Finds all snoozed signals where snoozed_until < now
 * - Sets status back to 'active'
 * - Clears snoozed_until field
 */
crons.hourly('unsnooze due signals', { minuteUTC: 15 }, internal.signals.unsnoozeDueSignals);

/**
 * Clean up old resolved/dismissed signals
 *
 * Runs daily to remove signals that have been resolved or dismissed
 * for longer than the retention period (default 90 days).
 *
 * Schedule: Daily at 5 AM UTC
 *
 * Actions taken:
 * - Deletes resolved/dismissed signals older than retention period
 * - Keeps active and snoozed signals indefinitely
 * - Logs count of deleted signals
 */
crons.daily(
  'cleanup old signals',
  { hourUTC: 5, minuteUTC: 0 },
  internal.signals.cleanupOldSignals,
  {},
);

/**
 * Delete old activity events (data retention)
 *
 * Runs daily to remove activity events older than retention period.
 * Keeps 90 days of history by default for engagement scoring.
 *
 * Schedule: Daily at 5:30 AM UTC
 */
crons.daily(
  'activity events retention',
  { hourUTC: 5, minuteUTC: 30 },
  internal.activity_events.deleteOldEvents,
  {},
);

// ============================================================================
// ENGAGEMENT CACHE
// ============================================================================

/**
 * Refresh engagement score cache for university students
 *
 * Runs every 6 hours to pre-compute engagement scores on user records.
 * This enables O(1) analytics queries instead of O(N) per-student calculations.
 *
 * Schedule: Every 6 hours
 *
 * Actions taken:
 * - Finds universities with stale engagement data (>6 hours old)
 * - Recalculates engagement scores for up to 50 students per run
 * - Caches status/score on user records for fast analytics queries
 *
 * See: convex/engagement_cache.ts for scoring algorithm
 */
crons.interval(
  'refresh engagement cache',
  { hours: 6 },
  internal.engagement_cache.refreshEngagementCacheJob,
  {},
);

export default crons;
