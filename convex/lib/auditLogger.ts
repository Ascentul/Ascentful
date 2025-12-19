/**
 * Typed Audit Logger for Enterprise Audit Trail
 *
 * This module provides a centralized, type-safe audit logging helper that
 * supports categorized logging for enterprise compliance (FERPA, SOC2, etc.)
 *
 * ## Categories
 * - `user_action`: User-initiated data changes (create, update, delete)
 * - `permission_change`: Role, membership, and access changes
 * - `sso_event`: SSO login/logout events (for future SSO implementation)
 * - `system`: System-initiated automated actions
 *
 * ## Usage
 *
 * ```typescript
 * import { logAudit } from './lib/auditLogger';
 *
 * // In a mutation, after the main operation:
 * await logAudit(ctx, {
 *   category: 'user_action',
 *   action: 'application.created',
 *   actorUserId: user._id,
 *   actorRole: user.role,
 *   actorUniversityId: user.university_id,
 *   targetType: 'application',
 *   targetId: newApp._id,
 *   metadata: { company: args.company, position: args.position }
 * });
 * ```
 *
 * ## PII Safety
 * - Never include PII (names, emails, phones) directly in metadata
 * - Use IDs for references, the audit log viewer handles PII redaction
 * - previousValue/newValue are automatically redacted on read
 */

import { Id } from '../_generated/dataModel';
import { MutationCtx } from '../_generated/server';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Audit log categories for enterprise filtering */
export type AuditCategory = 'user_action' | 'permission_change' | 'sso_event' | 'system';

/** Actor type - who or what initiated the action */
export type ActorType = 'user' | 'system' | 'integration';

/**
 * User action types - track user-initiated data changes
 * Format: entity.operation
 */
export type UserActionType =
  // Authentication
  | 'auth.login'
  | 'auth.logout'
  | 'auth.login_failed'
  // Applications
  | 'application.created'
  | 'application.updated'
  | 'application.deleted'
  | 'application.status_changed'
  // Resumes
  | 'resume.created'
  | 'resume.updated'
  | 'resume.deleted'
  | 'resume.downloaded'
  // Cover Letters
  | 'cover_letter.created'
  | 'cover_letter.updated'
  | 'cover_letter.deleted'
  // Goals
  | 'goal.created'
  | 'goal.updated'
  | 'goal.completed'
  | 'goal.deleted'
  // AI Coach
  | 'ai_coach.conversation_started'
  | 'ai_coach.conversation_completed'
  // Data Export
  | 'data_export.requested'
  | 'data_export.completed'
  // Account
  | 'account.settings_updated'
  | 'account.deleted';

/**
 * Permission action types - track access and role changes
 * Format: entity.operation
 */
export type PermissionActionType =
  // Roles
  | 'role.assigned'
  | 'role.changed'
  | 'role.revoked'
  // University Membership
  | 'university.joined'
  | 'university.left'
  | 'university.membership_changed'
  // Advisor Relationships
  | 'advisor.assigned'
  | 'advisor.removed'
  // Subscriptions
  | 'subscription.created'
  | 'subscription.changed'
  | 'subscription.cancelled';

/**
 * SSO action types - track SSO events (for future implementation)
 * Format: sso.operation
 */
export type SSOActionType =
  | 'sso.login_success'
  | 'sso.login_failed'
  | 'sso.linked'
  | 'sso.unlinked'
  | 'sso.provider_changed';

/**
 * System action types - track automated system actions
 * Format: system.operation
 */
export type SystemActionType =
  | 'system.migration_completed'
  | 'system.data_cleanup'
  | 'system.retention_applied'
  | 'system.sync_completed';

/** All possible action types */
export type AuditActionType =
  | UserActionType
  | PermissionActionType
  | SSOActionType
  | SystemActionType;

// ============================================================================
// AUDIT LOG PARAMETERS
// ============================================================================

/** Parameters for creating an audit log entry */
export interface AuditLogParams {
  /** Category of the audit event */
  category: AuditCategory;

  /** Specific action being logged (type-safe per category) */
  action: AuditActionType | string;

  /** Type of actor initiating the action */
  actorType?: ActorType;

  /** User ID of the actor (if applicable) */
  actorUserId?: Id<'users'>;

  /** Role of the actor at time of action */
  actorRole?: string;

  /** University ID of the actor (for multi-tenant context) */
  actorUniversityId?: Id<'universities'>;

  /** Type of entity being affected (e.g., 'application', 'resume', 'user') */
  targetType?: string;

  /** ID of the target entity (as string for flexibility across tables) */
  targetId?: string;

  /** University ID of the target entity (for cross-tenant operations) */
  targetUniversityId?: Id<'universities'>;

  /** Student ID if this action affects a student (for FERPA queries) */
  studentId?: Id<'users'>;

  /** Previous state before the change (may contain PII - redacted on read) */
  previousValue?: unknown;

  /** New state after the change (may contain PII - redacted on read) */
  newValue?: unknown;

  /** Additional metadata (avoid PII - use IDs instead) */
  metadata?: Record<string, unknown>;

  /** Request correlation ID for tracing */
  requestId?: string;

  /** Client IP address (if available from API route) */
  ipAddress?: string;

  /** Client user agent (if available from API route) */
  userAgent?: string;
}

// ============================================================================
// MAIN LOGGING FUNCTION
// ============================================================================

/**
 * Log an audit event with full context.
 *
 * This is the primary function for audit logging. It:
 * - Writes directly to the audit_logs table
 * - Sets all new fields (category, actor_type, actor_role, etc.)
 * - Maintains backward compatibility with existing queries
 *
 * @param ctx - Convex mutation context
 * @param params - Audit log parameters
 * @returns The ID of the created audit log entry
 *
 * @example
 * ```typescript
 * // User action: Creating an application
 * await logAudit(ctx, {
 *   category: 'user_action',
 *   action: 'application.created',
 *   actorUserId: user._id,
 *   actorRole: user.role,
 *   actorUniversityId: user.university_id,
 *   targetType: 'application',
 *   targetId: newApp._id,
 *   metadata: { company: 'Acme Corp', position: 'Engineer' }
 * });
 *
 * // Permission change: Role update
 * await logAudit(ctx, {
 *   category: 'permission_change',
 *   action: 'role.changed',
 *   actorUserId: adminUser._id,
 *   actorRole: 'super_admin',
 *   targetType: 'user',
 *   targetId: targetUser._id,
 *   previousValue: { role: 'student' },
 *   newValue: { role: 'advisor' }
 * });
 * ```
 */
export async function logAudit(
  ctx: MutationCtx,
  params: AuditLogParams,
): Promise<Id<'audit_logs'>> {
  const now = Date.now();

  return await ctx.db.insert('audit_logs', {
    // Category and action
    category: params.category,
    action: params.action,

    // Actor context
    actor_type: params.actorType ?? 'user',
    actor_id: params.actorUserId,
    actor_role: params.actorRole,
    university_id: params.actorUniversityId,

    // Target context
    entity_type: params.targetType,
    entity_id: params.targetId,
    target_university_id: params.targetUniversityId,

    // FERPA: Student affected by this action
    student_id: params.studentId,

    // Change tracking
    previous_value: params.previousValue,
    new_value: params.newValue,
    metadata: params.metadata,

    // Request context
    request_id: params.requestId,
    ip_address: params.ipAddress,
    user_agent: params.userAgent,

    // Timestamp
    created_at: now,

    // Legacy fields for backward compatibility (set timestamp for old queries)
    timestamp: now,
  });
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Log a user action (create, update, delete operations on user data)
 *
 * @example
 * ```typescript
 * await logUserAction(ctx, {
 *   action: 'resume.created',
 *   actorUserId: user._id,
 *   actorRole: user.role,
 *   targetType: 'resume',
 *   targetId: resume._id,
 * });
 * ```
 */
export async function logUserAction(
  ctx: MutationCtx,
  params: Omit<AuditLogParams, 'category'> & { action: UserActionType | string },
): Promise<Id<'audit_logs'>> {
  return logAudit(ctx, {
    ...params,
    category: 'user_action',
    actorType: params.actorType ?? 'user',
  });
}

/**
 * Log a permission change (role, membership, access changes)
 *
 * @example
 * ```typescript
 * await logPermissionChange(ctx, {
 *   action: 'role.changed',
 *   actorUserId: admin._id,
 *   actorRole: 'super_admin',
 *   targetType: 'user',
 *   targetId: user._id,
 *   previousValue: { role: 'student' },
 *   newValue: { role: 'advisor' },
 * });
 * ```
 */
export async function logPermissionChange(
  ctx: MutationCtx,
  params: Omit<AuditLogParams, 'category'> & { action: PermissionActionType | string },
): Promise<Id<'audit_logs'>> {
  return logAudit(ctx, {
    ...params,
    category: 'permission_change',
    actorType: params.actorType ?? 'user',
  });
}

/**
 * Log an SSO event (for future SSO implementation)
 *
 * @example
 * ```typescript
 * await logSSOEvent(ctx, {
 *   action: 'sso.login_success',
 *   actorUserId: user._id,
 *   metadata: { provider: 'azure_ad', externalId: 'abc123' },
 * });
 * ```
 */
export async function logSSOEvent(
  ctx: MutationCtx,
  params: Omit<AuditLogParams, 'category'> & { action: SSOActionType | string },
): Promise<Id<'audit_logs'>> {
  return logAudit(ctx, {
    ...params,
    category: 'sso_event',
    actorType: params.actorType ?? 'user',
  });
}

/**
 * Log a system action (automated/background operations)
 *
 * @example
 * ```typescript
 * await logSystemAction(ctx, {
 *   action: 'system.data_cleanup',
 *   actorType: 'system',
 *   metadata: { recordsCleaned: 150, reason: 'retention_policy' },
 * });
 * ```
 */
export async function logSystemAction(
  ctx: MutationCtx,
  params: Omit<AuditLogParams, 'category'> & { action: SystemActionType | string },
): Promise<Id<'audit_logs'>> {
  return logAudit(ctx, {
    ...params,
    category: 'system',
    actorType: params.actorType ?? 'system',
  });
}

// ============================================================================
// SAFE LOGGING WRAPPER (Graceful Error Handling)
// ============================================================================

/**
 * Safely log an audit event without throwing errors.
 *
 * Use this when audit logging should not fail the parent operation.
 * Errors are logged to console but do not propagate.
 *
 * @example
 * ```typescript
 * // In a mutation where audit failure shouldn't break the operation
 * await safeLogAudit(ctx, {
 *   category: 'user_action',
 *   action: 'application.created',
 *   // ...params
 * });
 * ```
 */
export async function safeLogAudit(
  ctx: MutationCtx,
  params: AuditLogParams,
): Promise<Id<'audit_logs'> | null> {
  try {
    return await logAudit(ctx, params);
  } catch (error) {
    console.error('[AuditLogger] Failed to create audit log:', {
      category: params.category,
      action: params.action,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}
