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

export default crons;
