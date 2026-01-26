import { paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';

import { Doc, Id } from './_generated/dataModel';
import { internalMutation, internalQuery, mutation, MutationCtx, query } from './_generated/server';
import { getCurrentUser } from './advisor_auth';

// ============================================================================
// Audit Log PII Redaction & Retention Helpers
// ============================================================================

// Helper to redact PII from legacy fields
function redactLegacyFields(log: Doc<'audit_logs'>) {
  return {
    performed_by_name: log.performed_by_name != null ? '[REDACTED]' : log.performed_by_name,
    performed_by_email: log.performed_by_email != null ? '[REDACTED]' : log.performed_by_email,
    target_name: log.target_name != null ? '[REDACTED]' : log.target_name,
    target_email: log.target_email != null ? '[REDACTED]' : log.target_email,
  };
}

// Field name patterns that indicate PII content
// Only redact strings in fields matching these patterns
const PII_FIELD_PATTERNS = [
  'name',
  'email',
  'phone',
  'address',
  'notes',
  'bio',
  'description',
  'comment',
  'message',
  'ssn',
  'social_security',
  'date_of_birth',
  'dob',
];

// Helper to check if a field name likely contains PII
function isPiiField(fieldName: string): boolean {
  const lowerName = fieldName.toLowerCase();
  return PII_FIELD_PATTERNS.some((pattern) => lowerName.includes(pattern));
}

// Helper to redact PII from new JSON fields
// Only redacts string values in fields that match PII patterns
function redactJsonField(value: any): any {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;

  // Recursively process objects, only redacting strings in PII-named fields
  const clone: any = Array.isArray(value) ? [] : {};
  for (const key of Object.keys(value)) {
    const val = (value as any)[key];
    if (val === null || val === undefined) {
      clone[key] = val;
    } else if (typeof val === 'string' && isPiiField(key)) {
      // Only redact strings in fields that look like PII
      clone[key] = '[REDACTED]';
    } else if (typeof val === 'object') {
      clone[key] = redactJsonField(val);
    } else {
      // Preserve non-PII strings (action types, IDs, statuses, etc.)
      clone[key] = val;
    }
  }
  return clone;
}

/**
 * Apply full PII redaction to an audit log before returning to the client.
 * This ensures PII is never exposed when reading audit logs, even to super_admins.
 *
 * FERPA/GDPR Compliance: Audit logs maintain record of actions but PII is
 * redacted on read to minimize exposure risk. Original data preserved in DB
 * for compliance investigations with proper access controls.
 */
function redactAuditLogForRead(log: Doc<'audit_logs'>) {
  // Apply legacy field redaction
  const legacyRedactions = redactLegacyFields(log);

  // Apply JSON field redaction to new format fields
  const redactedPreviousValue = log.previous_value
    ? redactJsonField(log.previous_value)
    : log.previous_value;
  const redactedNewValue = log.new_value ? redactJsonField(log.new_value) : log.new_value;
  const redactedMetadata = log.metadata ? redactJsonField(log.metadata) : log.metadata;

  // Also redact the reason field which may contain PII explanations
  const redactedReason = log.reason ? '[REDACTED]' : log.reason;

  return {
    ...log,
    ...legacyRedactions,
    previous_value: redactedPreviousValue,
    new_value: redactedNewValue,
    metadata: redactedMetadata,
    reason: redactedReason,
  };
}

// ============================================================================
// Internal Mutation for Creating Audit Logs from Actions
// ============================================================================

/**
 * Internal mutation to create an audit log entry.
 * Used by actions that cannot directly access ctx.db.
 * This uses the legacy format compatible with admin_users_actions.ts
 */
export const _createAuditLogInternal = internalMutation({
  args: {
    action: v.string(),
    target_type: v.string(),
    target_id: v.optional(v.string()),
    target_email: v.optional(v.string()),
    target_name: v.optional(v.string()),
    performed_by_id: v.optional(v.string()),
    performed_by_email: v.optional(v.string()),
    performed_by_name: v.optional(v.string()),
    reason: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('audit_logs', {
      action: args.action,
      target_type: args.target_type,
      target_id: args.target_id,
      target_email: args.target_email,
      target_name: args.target_name,
      performed_by_id: args.performed_by_id,
      performed_by_email: args.performed_by_email,
      performed_by_name: args.performed_by_name,
      reason: args.reason,
      metadata: args.metadata,
      timestamp: Date.now(),
      created_at: Date.now(),
    });
  },
});

// ============================================================================
// PII Redaction for a Student
// ============================================================================

/**
 * Redact PII from all audit logs involving a specific student.
 *
 * PERFORMANCE LIMITATION (Known Issue):
 * This function performs a full table scan of all audit_logs to find entries
 * involving the student. This is acceptable for:
 * - Low volume usage (< 10,000 audit logs)
 * - Infrequent calls (GDPR deletion requests, account cleanup)
 * - Running as a background job during off-peak hours
 *
 * RECOMMENDED OPTIMIZATION (before 50,000 audit logs):
 * Add indexes to schema.ts for efficient querying:
 *
 *   audit_logs: defineTable({...})
 *     .index("by_student_id", ["student_id"])
 *     .index("by_target_id", ["target_id"])
 *
 * Then update this function to use index-based queries:
 *
 *   // Query by student_id index
 *   const byStudentId = await ctx.db
 *     .query("audit_logs")
 *     .withIndex("by_student_id", q => q.eq("student_id", studentId))
 *     .collect();
 *
 *   // Query by target_id index
 *   const byTargetId = await ctx.db
 *     .query("audit_logs")
 *     .withIndex("by_target_id", q => q.eq("target_id", studentId))
 *     .collect();
 *
 * Note: Logs with student_id only in metadata.student_id cannot be indexed
 * directly. Consider promoting this to a top-level field during log creation
 * or accepting the trade-off that metadata-only references require full scan.
 *
 * USAGE RECOMMENDATION:
 * - Schedule during off-peak hours (e.g., 2-4 AM UTC)
 * - Consider batching multiple student redactions together
 * - Monitor execution time and add indexes before it exceeds 30 seconds
 */
export const redactStudentPII = internalMutation({
  args: {
    studentId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const studentId = args.studentId as Id<'users'>;

    // PERFORMANCE: Full table scan - see function docs for optimization path
    // Query audit logs by student (new format uses student_id in metadata) if such an index exists
    // Fallback: scan by student_id field if present; otherwise paginate all logs
    let cursor: string | null = null;
    let isDone = false;
    let redactedCount = 0;

    while (!isDone) {
      const page = await ctx.db
        .query('audit_logs')
        .order('asc')
        .paginate({ cursor, numItems: 200 });

      for (const log of page.page) {
        // Check if this log involves the student
        const involvesStudent =
          log.student_id === studentId ||
          log.target_id === studentId ||
          (log.metadata && (log.metadata as any).student_id === studentId);

        if (!involvesStudent) continue;

        const updates: Record<string, any> = {};

        // Legacy fields
        Object.assign(updates, redactLegacyFields(log));

        // New JSON fields
        if (log.previous_value !== undefined) {
          updates.previous_value = redactJsonField(log.previous_value);
        }
        if (log.new_value !== undefined) {
          updates.new_value = redactJsonField(log.new_value);
        }

        // Check if any field actually changed (not just present)
        const hasChanges = Object.entries(updates).some(
          ([key, value]) => value !== (log as any)[key],
        );
        if (hasChanges) {
          await ctx.db.patch(log._id, updates);
          redactedCount += 1;
        }
      }

      cursor = page.continueCursor;
      isDone = page.isDone;
    }

    return { redactedCount };
  },
});

// ============================================================================
// Retention Job: delete audit logs older than 7 years
// ============================================================================

/**
 * Archive audit logs to the audit_logs_archive table.
 *
 * Logs are stored as compressed JSON batches for long-term retention.
 * This allows the original audit_logs to be cleaned up while preserving
 * data for compliance requirements.
 *
 * @param ctx - Mutation context for database access
 * @param logs - Logs to archive
 * @returns The archive batch ID
 */
async function exportAuditLogsForArchive(
  ctx: MutationCtx,
  logs: Doc<'audit_logs'>[],
): Promise<string> {
  if (logs.length === 0) {
    throw new Error('No logs to archive');
  }

  // Generate batch ID: YYYY-MM-DD-{timestamp}
  const now = Date.now();
  const date = new Date(now);
  const batchId = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${now}`;

  // Find date range of logs
  const timestamps = logs.map((log) => log.created_at ?? log.timestamp ?? 0).filter((t) => t > 0);
  const startDate = Math.min(...timestamps);
  const endDate = Math.max(...timestamps);

  // Compress logs by removing null/undefined values
  const compressedLogs = logs.map((log) => {
    const compressed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(log)) {
      if (value !== null && value !== undefined) {
        compressed[key] = value;
      }
    }
    return compressed;
  });

  // Store as JSON string
  const logsJson = JSON.stringify(compressedLogs);

  // Insert archive batch
  await ctx.db.insert('audit_logs_archive', {
    batch_id: batchId,
    start_date: startDate,
    end_date: endDate,
    log_count: logs.length,
    logs_json: logsJson,
    created_at: now,
  });

  return batchId;
}

export const deleteExpiredAuditLogs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const sevenYearsMs = 7 * 365 * 24 * 60 * 60 * 1000;
    const cutoff = now - sevenYearsMs;

    let cursor: string | null = null;
    let isDone = false;
    let deletedCount = 0;
    let archivedCount = 0;
    const archiveBatches: string[] = [];

    while (!isDone) {
      const page = await ctx.db
        .query('audit_logs')
        .order('asc')
        .paginate({ cursor, numItems: 200 });

      const expired = page.page.filter((log) => {
        const ts = log.created_at ?? log.timestamp;
        // Exclude logs with no timestamp rather than treating them as ancient
        return ts !== undefined && ts < cutoff;
      });

      if (expired.length > 0) {
        // Archive logs before deletion
        const batchId = await exportAuditLogsForArchive(ctx, expired);
        archiveBatches.push(batchId);
        archivedCount += expired.length;

        // Delete archived logs
        for (const log of expired) {
          await ctx.db.delete(log._id);
          deletedCount += 1;
        }
      }

      cursor = page.continueCursor;
      isDone = page.isDone;
    }

    return {
      deletedCount,
      archivedCount,
      archiveBatches,
      cutoff,
      cutoffDate: new Date(cutoff).toISOString(),
    };
  },
});

// ============================================================================
// Public API for Audit Logs
// ============================================================================

/**
 * Create an audit log entry (requires admin authentication)
 * Used by API routes that need to log admin actions
 */
export const createAuditLog = mutation({
  args: {
    action: v.string(),
    target_type: v.string(),
    target_id: v.optional(v.string()),
    target_email: v.optional(v.string()),
    target_name: v.optional(v.string()),
    performed_by_id: v.optional(v.string()),
    performed_by_email: v.optional(v.string()),
    performed_by_name: v.optional(v.string()),
    reason: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Authorization: Only authenticated admin users can create audit logs
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error('Unauthorized: Authentication required');
    }
    if (!['super_admin', 'university_admin', 'advisor'].includes(currentUser.role)) {
      throw new Error('Unauthorized: Admin role required to create audit logs');
    }

    return await ctx.db.insert('audit_logs', {
      action: args.action,
      target_type: args.target_type,
      target_id: args.target_id,
      target_email: args.target_email,
      target_name: args.target_name,
      performed_by_id: args.performed_by_id,
      performed_by_email: args.performed_by_email,
      performed_by_name: args.performed_by_name,
      reason: args.reason,
      metadata: args.metadata,
      timestamp: Date.now(),
      created_at: Date.now(),
    });
  },
});

/**
 * Create a system audit log entry (for automated/system actions)
 * Requires admin authentication
 */
export const createSystemAuditLog = mutation({
  args: {
    action: v.string(),
    target_type: v.string(),
    target_id: v.optional(v.string()),
    reason: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Authorization: Only authenticated admin users can create system audit logs
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error('Unauthorized: Authentication required');
    }
    if (!['super_admin', 'university_admin'].includes(currentUser.role)) {
      throw new Error('Unauthorized: Admin role required to create system audit logs');
    }

    return await ctx.db.insert('audit_logs', {
      action: args.action,
      target_type: args.target_type,
      target_id: args.target_id,
      reason: args.reason,
      metadata: args.metadata,
      performed_by_name: 'System',
      timestamp: Date.now(),
      created_at: Date.now(),
    });
  },
});

/**
 * Internal version of createAuditLog for use by other Convex functions
 * No auth check - caller is responsible for authorization
 */
export const createAuditLogInternal = internalMutation({
  args: {
    action: v.string(),
    target_type: v.string(),
    target_id: v.optional(v.string()),
    target_email: v.optional(v.string()),
    target_name: v.optional(v.string()),
    performed_by_id: v.optional(v.string()),
    performed_by_email: v.optional(v.string()),
    performed_by_name: v.optional(v.string()),
    reason: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('audit_logs', {
      action: args.action,
      target_type: args.target_type,
      target_id: args.target_id,
      target_email: args.target_email,
      target_name: args.target_name,
      performed_by_id: args.performed_by_id,
      performed_by_email: args.performed_by_email,
      performed_by_name: args.performed_by_name,
      reason: args.reason,
      metadata: args.metadata,
      timestamp: Date.now(),
      created_at: Date.now(),
    });
  },
});

/**
 * Get audit logs with pagination and filtering (for admin UI)
 * Requires super_admin role
 *
 * Supports filtering by:
 * - category: user_action, permission_change, sso_event, system
 * - action: specific action type (e.g., "application.created")
 * - actorId: filter by who performed the action
 * - entityType: filter by target entity type
 * - dateFrom/dateTo: date range filtering
 */
export const getAuditLogsPaginated = query({
  args: {
    clerkId: v.string(),
    category: v.optional(v.string()),
    action: v.optional(v.string()),
    actorId: v.optional(v.id('users')),
    entityType: v.optional(v.string()),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);

    // Only super_admin can view audit logs
    if (sessionCtx.role !== 'super_admin') {
      return { page: [], isDone: true, continueCursor: '' };
    }

    // Determine which index to use based on filters
    // Priority: category > action > actor > default (by_created_at)
    let logsQuery;

    if (args.category) {
      // Use category index for category filtering
      logsQuery = ctx.db
        .query('audit_logs')
        .withIndex('by_category', (q) => q.eq('category', args.category as any));
    } else if (args.action) {
      // Use action index for action filtering
      logsQuery = ctx.db
        .query('audit_logs')
        .withIndex('by_action', (q) => q.eq('action', args.action!));
    } else if (args.actorId) {
      // Use actor index for actor filtering
      logsQuery = ctx.db
        .query('audit_logs')
        .withIndex('by_actor', (q) => q.eq('actor_id', args.actorId!));
    } else {
      // Default: use created_at index for efficient ordering
      logsQuery = ctx.db.query('audit_logs').withIndex('by_created_at');
    }

    const result = await logsQuery.order('desc').paginate(args.paginationOpts);

    // Apply additional filters that aren't covered by index
    let filteredPage = result.page;

    // Filter by entity type if specified and not already filtered
    if (args.entityType) {
      filteredPage = filteredPage.filter((log) => log.entity_type === args.entityType);
    }

    // Filter by date range
    if (args.dateFrom) {
      filteredPage = filteredPage.filter((log) => {
        const ts = log.created_at ?? log.timestamp;
        return ts !== undefined && ts >= args.dateFrom!;
      });
    }
    if (args.dateTo) {
      filteredPage = filteredPage.filter((log) => {
        const ts = log.created_at ?? log.timestamp;
        return ts !== undefined && ts <= args.dateTo!;
      });
    }

    // If we had secondary filters (action when category is primary, etc.)
    if (args.category && args.action) {
      filteredPage = filteredPage.filter((log) => log.action === args.action);
    }
    if ((args.category || args.action) && args.actorId) {
      filteredPage = filteredPage.filter((log) => log.actor_id === args.actorId);
    }

    // Apply PII redaction before returning to client
    // FERPA/GDPR: Audit logs maintain action records but PII is redacted on read
    const redactedPage = filteredPage.map(redactAuditLogForRead);

    return {
      ...result,
      page: redactedPage,
    };
  },
});

/**
 * Log an authentication event from webhook
 * Called by Clerk webhook when users are created or updated
 *
 * Protected by service token - only webhook handlers with valid service token can call this
 */
export const logAuthEvent = mutation({
  args: {
    action: v.union(
      v.literal('auth.login'),
      v.literal('auth.user_created'),
      v.literal('auth.user_updated'),
      v.literal('auth.user_deleted'),
      v.literal('subscription.changed'),
    ),
    clerkId: v.string(),
    userId: v.optional(v.id('users')),
    universityId: v.optional(v.id('universities')),
    role: v.optional(v.string()),
    previousValue: v.optional(v.any()),
    newValue: v.optional(v.any()),
    metadata: v.optional(v.any()),
    serviceToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify service token for webhook calls, or require admin auth
    const expectedToken = process.env.CONVEX_INTERNAL_SERVICE_TOKEN;
    const hasValidServiceToken = expectedToken && args.serviceToken === expectedToken;

    if (!hasValidServiceToken) {
      // If no valid service token, require admin authentication
      const currentUser = await getCurrentUser(ctx);
      if (!currentUser || currentUser.role !== 'super_admin') {
        throw new Error('Unauthorized: Service token or super_admin role required');
      }
    }

    // Determine category based on action
    const isPermissionAction = args.action === 'subscription.changed';
    const category = isPermissionAction ? 'permission_change' : 'user_action';

    return await ctx.db.insert('audit_logs', {
      category,
      action: args.action,
      actor_type: 'integration', // Webhook/integration initiated
      actor_id: args.userId,
      actor_role: args.role,
      university_id: args.universityId,
      entity_type: 'user',
      entity_id: args.clerkId, // Store clerkId as entity reference
      previous_value: args.previousValue,
      new_value: args.newValue,
      metadata: args.metadata,
      created_at: Date.now(),
      timestamp: Date.now(),
    });
  },
});

/**
 * Get audit logs (non-paginated, for simpler views)
 * Requires super_admin role
 */
export const getAuditLogs = query({
  args: {
    clerkId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);

    // Only super_admin can view audit logs
    if (sessionCtx.role !== 'super_admin') {
      return [];
    }

    const limit = args.limit ?? 100;
    const logs = await ctx.db.query('audit_logs').order('desc').take(limit);

    // Apply PII redaction before returning to client
    // FERPA/GDPR: Audit logs maintain action records but PII is redacted on read
    return logs.map(redactAuditLogForRead);
  },
});
