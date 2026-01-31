/**
 * Unified Authorization Module
 *
 * Centralized authorization for role-based access control (RBAC).
 * All Convex mutations and queries should use this module for authorization.
 *
 * Architecture:
 * - Authentication: Handled by Clerk (JWT validation)
 * - Authorization: This module (role checks, tenant isolation)
 * - Data Access: Individual query/mutation handlers
 *
 * @see src/lib/constants/roles.ts for frontend role constants
 * @see docs/RBAC.md for complete authorization documentation
 */

import { GenericMutationCtx, GenericQueryCtx } from 'convex/server';
import { ConvexError } from 'convex/values';

import { DataModel, Id } from '../_generated/dataModel';
import { UserRole, VALID_ROLES } from './roleValidation';

// Re-export types for convenience
export { VALID_ROLES };
export type { RoleValidationResult, UserRole } from './roleValidation';

type QueryCtx = GenericQueryCtx<DataModel>;
type MutationCtx = GenericMutationCtx<DataModel>;
type Ctx = QueryCtx | MutationCtx;

// ============================================================================
// ROLE GROUPS
// ============================================================================

/**
 * Roles with platform-level admin access (/admin routes)
 */
export const PLATFORM_ADMIN_ROLES: readonly UserRole[] = ['super_admin'];

/**
 * Roles with university-level admin access (/university routes)
 */
export const UNIVERSITY_ADMIN_ROLES: readonly UserRole[] = ['university_admin', 'super_admin'];

/**
 * Roles that can access advisor features (view students, etc.)
 */
export const ADVISOR_ACCESSIBLE_ROLES: readonly UserRole[] = [
  'advisor',
  'university_admin',
  'super_admin',
];

/**
 * Roles that require university_id
 */
export const UNIVERSITY_AFFILIATED_ROLES: readonly UserRole[] = [
  'student',
  'advisor',
  'university_admin',
  'staff',
];

// ============================================================================
// USER TYPE
// ============================================================================

/**
 * Minimal user type for authorization checks
 */
export interface AuthUser {
  _id: Id<'users'>;
  clerkId: string;
  role: UserRole;
  email: string;
  name?: string;
  university_id?: Id<'universities'> | null;
  account_status?: 'pending_activation' | 'pending_deletion' | 'active' | 'suspended' | 'deleted';
}

/**
 * Membership record type for authorization checks
 */
export interface AuthMembership {
  _id: Id<'memberships'>;
  user_id: Id<'users'>;
  role: string;
  status: string;
  university_id?: Id<'universities'> | null;
}

// ============================================================================
// CORE AUTHENTICATION
// ============================================================================

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  let result = a.length ^ b.length;
  const minLength = Math.min(a.length, b.length);
  for (let i = 0; i < minLength; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Check if request is from internal service (server-to-server)
 */
export function isServiceRequest(token: string | undefined): boolean {
  const expected = process.env.CONVEX_INTERNAL_SERVICE_TOKEN;
  if (!expected || !token) {
    return false;
  }
  return timingSafeEqual(token, expected);
}

/**
 * Get the authenticated user from Convex context
 *
 * @throws Error if not authenticated or account is deleted/suspended
 */
export async function getAuthenticatedUser(ctx: Ctx): Promise<AuthUser> {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new ConvexError({
      code: 'UNAUTHENTICATED',
      message: 'User not authenticated',
    });
  }

  const user = await ctx.db
    .query('users')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
    .unique();

  if (!user) {
    throw new ConvexError({
      code: 'USER_NOT_FOUND',
      message: 'User not found in database',
      clerkId: identity.subject,
    });
  }

  // Check account status
  assertAccountActive(user);

  return user as AuthUser;
}

/**
 * Get user by Clerk ID (for when you have clerkId but no ctx.auth)
 */
export async function getUserByClerkId(ctx: Ctx, clerkId: string): Promise<AuthUser | null> {
  const user = await ctx.db
    .query('users')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
    .unique();

  return user as AuthUser | null;
}

// ============================================================================
// ACCOUNT STATUS CHECKS
// ============================================================================

/**
 * Assert user account is active (not deleted/suspended)
 * @throws Error if account is deleted or suspended
 */
export function assertAccountActive(user: Pick<AuthUser, 'account_status'>): void {
  if (user.account_status === 'deleted') {
    throw new ConvexError({
      code: 'ACCOUNT_DELETED',
      message: 'User account has been deleted',
    });
  }
  if (user.account_status === 'suspended') {
    throw new ConvexError({
      code: 'ACCOUNT_SUSPENDED',
      message: 'User account has been suspended',
    });
  }
}

// ============================================================================
// ROLE REQUIREMENT GUARDS (throw on failure)
// ============================================================================

/**
 * Require user to be a super admin
 * @throws Error if not super admin
 */
export async function requireSuperAdmin(ctx: Ctx): Promise<AuthUser> {
  const user = await getAuthenticatedUser(ctx);

  if (user.role !== 'super_admin') {
    throw new Error('Forbidden: Only super admins can perform this action');
  }

  return user;
}

/**
 * Require user to be a university admin (for their university)
 * @throws Error if not university admin or missing university_id
 */
export async function requireUniversityAdmin(ctx: Ctx): Promise<AuthUser> {
  const user = await getAuthenticatedUser(ctx);

  if (user.role !== 'university_admin' && user.role !== 'super_admin') {
    throw new Error('Forbidden: Only university admins can perform this action');
  }

  // University admins must have university_id (super_admins don't need one)
  if (user.role === 'university_admin' && !user.university_id) {
    throw new Error('Forbidden: University admin must be associated with a university');
  }

  return user;
}

/**
 * Require user to be an advisor (or higher)
 * @throws Error if not advisor, university_admin, or super_admin
 */
export async function requireAdvisor(ctx: Ctx): Promise<AuthUser> {
  const user = await getAuthenticatedUser(ctx);

  if (!ADVISOR_ACCESSIBLE_ROLES.includes(user.role)) {
    throw new Error('Forbidden: Only advisors can perform this action');
  }

  // Non-super_admin advisors must have university_id
  if (user.role !== 'super_admin' && !user.university_id) {
    throw new Error('Forbidden: Advisor must be associated with a university');
  }

  return user;
}

/**
 * Require user to have any of the specified roles
 * @throws Error if user doesn't have any of the specified roles
 */
export async function requireRoles(ctx: Ctx, allowedRoles: readonly UserRole[]): Promise<AuthUser> {
  const user = await getAuthenticatedUser(ctx);

  if (!allowedRoles.includes(user.role)) {
    throw new Error(
      `Forbidden: Role "${user.role}" is not authorized. Required: ${allowedRoles.join(', ')}`,
    );
  }

  return user;
}

/**
 * Require user to have an active membership with optional role filter
 * @throws Error if no active membership found
 */
export async function requireMembership(
  ctx: Ctx,
  opts: { role?: 'student' | 'advisor' | 'university_admin' } = {},
): Promise<{ user: AuthUser; membership: AuthMembership }> {
  const user = await getAuthenticatedUser(ctx);

  let membership = null as AuthMembership | null;

  if (opts.role) {
    membership = (await ctx.db
      .query('memberships')
      .withIndex('by_user_role', (q) => q.eq('user_id', user._id).eq('role', opts.role!))
      .first()) as AuthMembership | null;
  } else {
    membership = (await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .first()) as AuthMembership | null;
  }

  if (!membership) {
    throw new Error('Unauthorized: Membership not found');
  }

  if (membership.status !== 'active') {
    throw new Error('Unauthorized: Inactive membership');
  }

  return { user, membership };
}

// ============================================================================
// PERMISSION CHECKS (return boolean)
// ============================================================================

/**
 * Check if user is a super admin
 */
export function isSuperAdmin(user: Pick<AuthUser, 'role'>): boolean {
  return user.role === 'super_admin';
}

/**
 * Check if user has platform admin access
 */
export function hasPlatformAdminAccess(user: Pick<AuthUser, 'role'>): boolean {
  return PLATFORM_ADMIN_ROLES.includes(user.role);
}

/**
 * Check if user has university admin access
 */
export function hasUniversityAdminAccess(user: Pick<AuthUser, 'role'>): boolean {
  return UNIVERSITY_ADMIN_ROLES.includes(user.role);
}

/**
 * Check if user has advisor access
 */
export function hasAdvisorAccess(user: Pick<AuthUser, 'role'>): boolean {
  return ADVISOR_ACCESSIBLE_ROLES.includes(user.role);
}

/**
 * Check if user role requires university affiliation
 */
export function requiresUniversityAffiliation(user: Pick<AuthUser, 'role'>): boolean {
  return UNIVERSITY_AFFILIATED_ROLES.includes(user.role);
}

// ============================================================================
// TENANT ISOLATION
// ============================================================================

/**
 * Assert user can access resources in a specific university
 *
 * Rules:
 * - super_admin: can access any university
 * - university_admin/advisor: can only access their own university
 *
 * @throws Error if access denied
 */
export function assertUniversityAccess(
  user: Pick<AuthUser, 'role' | 'university_id'>,
  targetUniversityId: Id<'universities'> | string | null | undefined,
): void {
  // Super admins can access any university
  if (user.role === 'super_admin') {
    return;
  }

  // Other roles must match university_id
  if (!user.university_id || !targetUniversityId) {
    throw new ConvexError({
      code: 'TENANT_ACCESS_DENIED',
      message: 'Tenant access denied - missing university ID',
      hasUserUniversityId: !!user.university_id,
      hasTargetUniversityId: !!targetUniversityId,
      role: user.role,
    });
  }

  if (user.university_id !== targetUniversityId) {
    throw new ConvexError({
      code: 'TENANT_ACCESS_DENIED',
      message: 'Tenant access denied - university mismatch',
      role: user.role,
    });
  }
}

/**
 * Get the user's university_id or throw if not affiliated
 * @throws Error if user has no university affiliation
 */
export function requireUniversityId(user: Pick<AuthUser, 'university_id'>): Id<'universities'> {
  if (!user.university_id) {
    throw new ConvexError({
      code: 'NO_UNIVERSITY_AFFILIATION',
      message: 'User must be associated with a university',
    });
  }
  return user.university_id;
}

// ============================================================================
// RESOURCE ACCESS CONTROL
// ============================================================================

/**
 * Assert user can access another user's data
 *
 * Rules:
 * - super_admin: can access anyone
 * - university_admin: can access users in their university
 * - advisor: can access assigned students only
 * - others: can only access their own data
 *
 * @throws Error if access denied
 */
export async function assertUserAccess(
  ctx: Ctx,
  actingUser: AuthUser,
  targetUserId: Id<'users'> | string,
): Promise<void> {
  // Super admins can access anyone
  if (actingUser.role === 'super_admin') {
    return;
  }

  // Users can always access their own data
  if (actingUser._id === targetUserId) {
    return;
  }

  // Get target user
  const targetUser = await ctx.db.get(targetUserId as Id<'users'>);
  if (!targetUser) {
    throw new Error('Not found: Target user does not exist');
  }

  // University admins can access users in their university
  if (actingUser.role === 'university_admin') {
    assertUniversityAccess(actingUser, targetUser.university_id);
    return;
  }

  // Advisors can access assigned students
  if (actingUser.role === 'advisor') {
    assertUniversityAccess(actingUser, targetUser.university_id);

    // Check advisor assignment
    const assignment = await ctx.db
      .query('student_advisors')
      .withIndex('by_advisor', (q) =>
        q.eq('advisor_id', actingUser._id).eq('university_id', actingUser.university_id!),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field('student_id'), targetUserId as Id<'users'>),
          q.eq(q.field('is_owner'), true),
        ),
      )
      .first();

    if (!assignment) {
      throw new Error('Forbidden: Advisor is not assigned to this student');
    }
    return;
  }

  // All other cases: access denied
  throw new Error("Forbidden: You cannot access this user's data");
}

/**
 * Assert user can access a student's data (shorthand for student-specific checks)
 */
export async function assertStudentAccess(
  ctx: Ctx,
  actingUser: AuthUser,
  studentId: Id<'users'>,
): Promise<void> {
  return assertUserAccess(ctx, actingUser, studentId);
}

// ============================================================================
// OWNERSHIP CHECKS
// ============================================================================

/**
 * Assert user owns a resource (by user_id field)
 *
 * Rules:
 * - super_admin: can access any resource
 * - others: must own the resource
 *
 * @throws Error if not owner (unless super_admin)
 */
export function assertResourceOwnership(
  actingUser: Pick<AuthUser, 'role' | '_id'>,
  resourceOwnerId: Id<'users'> | string | null | undefined,
): void {
  // Super admins bypass ownership check
  if (actingUser.role === 'super_admin') {
    return;
  }

  if (!resourceOwnerId || actingUser._id !== resourceOwnerId) {
    throw new Error('Forbidden: You do not own this resource');
  }
}

/**
 * Check if user owns a resource (returns boolean instead of throwing)
 */
export function isResourceOwner(
  actingUser: Pick<AuthUser, 'role' | '_id'>,
  resourceOwnerId: Id<'users'> | string | null | undefined,
): boolean {
  if (actingUser.role === 'super_admin') {
    return true;
  }
  return !!resourceOwnerId && actingUser._id === resourceOwnerId;
}

// ============================================================================
// COMBINED CHECKS
// ============================================================================

/**
 * Assert user can manage a resource (owner OR admin of their university)
 */
export async function assertCanManageResource(
  ctx: Ctx,
  actingUser: AuthUser,
  resource: { user_id?: Id<'users'> | null; university_id?: Id<'universities'> | null },
): Promise<void> {
  // Super admins can manage anything
  if (actingUser.role === 'super_admin') {
    return;
  }

  // Check ownership first
  if (resource.user_id && actingUser._id === resource.user_id) {
    return;
  }

  // University admins can manage resources in their university
  if (actingUser.role === 'university_admin' && resource.university_id) {
    assertUniversityAccess(actingUser, resource.university_id);
    return;
  }

  throw new Error('Forbidden: You cannot manage this resource');
}

// ============================================================================
// AUDIT LOGGING HELPER
// ============================================================================

/**
 * Create an audit log entry for authorization-relevant actions
 */
export async function logAuthAction(
  ctx: MutationCtx,
  params: {
    actorId: Id<'users'>;
    universityId?: Id<'universities'>;
    action:
      | 'role_changed'
      | 'permission_denied'
      | 'resource_accessed'
      | 'admin_action'
      | 'user_created'
      | 'user_deleted'
      | 'user_suspended';
    entityType: string;
    entityId: string;
    previousValue?: unknown;
    newValue?: unknown;
    metadata?: Record<string, unknown>;
  },
): Promise<Id<'audit_logs'>> {
  return await ctx.db.insert('audit_logs', {
    actor_id: params.actorId,
    university_id: params.universityId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    previous_value: params.previousValue,
    new_value: params.newValue,
    metadata: params.metadata,
    created_at: Date.now(),
  });
}

// ============================================================================
// UNIFIED AUTH OBJECT (convenience export)
// ============================================================================

/**
 * Unified authorization API
 *
 * Usage:
 * ```typescript
 * import { auth } from './lib/authorization';
 *
 * // In a mutation/query:
 * const user = await auth.requireSuperAdmin(ctx);
 * auth.assertUniversityAccess(user, targetUniversityId);
 * ```
 */
export const auth = {
  // Core authentication
  getAuthenticatedUser,
  getUserByClerkId,
  isServiceRequest,

  // Account status
  assertAccountActive,

  // Role guards (throw on failure)
  requireSuperAdmin,
  requireUniversityAdmin,
  requireAdvisor,
  requireRoles,
  requireMembership,

  // Permission checks (return boolean)
  isSuperAdmin,
  hasPlatformAdminAccess,
  hasUniversityAdminAccess,
  hasAdvisorAccess,
  requiresUniversityAffiliation,

  // Tenant isolation
  assertUniversityAccess,
  requireUniversityId,

  // Resource access
  assertUserAccess,
  assertStudentAccess,
  assertResourceOwnership,
  assertCanManageResource,
  isResourceOwner,

  // Audit logging
  logAuthAction,
} as const;
