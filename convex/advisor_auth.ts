/**
 * Advisor Authorization Guards
 *
 * Centralized permission checking for advisor features with FERPA-style compliance.
 * All advisor queries/mutations must use these guards to enforce:
 * - Tenant isolation (university_id)
 * - Role-based access (advisor, university_admin, super_admin)
 * - Student ownership (via student_advisors.is_owner)
 */

import type { Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';

/**
 * Session context extracted from Clerk JWT and Convex user record
 */
export interface AdvisorSessionContext {
  userId: Id<'users'>;
  clerkId: string;
  role:
    | 'advisor'
    | 'university_admin'
    | 'super_admin'
    | 'student'
    | 'individual'
    | 'user'
    | 'staff';
  universityId: Id<'universities'> | undefined;
  email: string;
}

/**
 * Get current user from Clerk ID with all necessary context
 */
export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx,
  clerkId?: string,
): Promise<AdvisorSessionContext> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error('Not authenticated');
  }

  if (clerkId && identity.subject !== clerkId) {
    throw new Error('Unauthorized: clerk session mismatch');
  }

  const user = await ctx.db
    .query('users')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
    .unique();

  if (!user) {
    throw new Error('User not found');
  }

  return {
    userId: user._id,
    clerkId: user.clerkId,
    role: user.role,
    universityId: user.university_id,
    email: user.email,
  };
}

/**
 * Require user to have a university_id (tenant scope)
 * Throws if user is not associated with a university
 */
export function requireTenant(sessionCtx: AdvisorSessionContext): Id<'universities'> {
  if (!sessionCtx.universityId) {
    throw new Error('Missing tenant: User must be associated with a university');
  }
  return sessionCtx.universityId;
}

/**
 * Get user's university_id if available (doesn't throw)
 * Returns undefined if user is not associated with a university
 *
 * Use this for queries where super_admin without university should see empty results
 * rather than an error.
 */
export function optionalTenant(sessionCtx: AdvisorSessionContext): Id<'universities'> | undefined {
  return sessionCtx.universityId;
}

/**
 * Require user to be an advisor
 * Throws if user role is not advisor, university_admin, or super_admin
 */
export function requireAdvisorRole(sessionCtx: AdvisorSessionContext): void {
  const allowedRoles: (typeof sessionCtx.role)[] = ['advisor', 'university_admin', 'super_admin'];

  if (!allowedRoles.includes(sessionCtx.role)) {
    throw new Error(
      `Unauthorized: Role "${sessionCtx.role}" is not authorized for advisor features`,
    );
  }
}

/**
 * Check if advisor can access a specific student
 *
 * Rules:
 * - super_admin: can access any student
 * - university_admin: can access students in their university
 * - advisor: can ONLY access students they own (student_advisors.is_owner = true)
 *
 * @returns The student record if authorized
 * @throws Error if unauthorized
 */
export async function assertCanAccessStudent(
  ctx: QueryCtx | MutationCtx,
  sessionCtx: AdvisorSessionContext,
  studentId: Id<'users'>,
) {
  // super_admin can access any student (no tenant requirement)
  if (sessionCtx.role === 'super_admin') {
    const student = await ctx.db.get(studentId);
    if (!student) throw new Error('Student not found');
    return student;
  }

  // Require tenant first for other roles
  const universityId = requireTenant(sessionCtx);

  // Get student record
  const student = await ctx.db.get(studentId);

  if (!student) {
    throw new Error('Student not found');
  }

  // Check tenant isolation - student must be in same university
  // SECURITY: Reject if student has no university_id OR belongs to different university
  if (!student.university_id || student.university_id !== universityId) {
    throw new Error('Unauthorized: Student is not in your university (tenant isolation)');
  }

  // University admin can access all students in their university
  if (sessionCtx.role === 'university_admin') {
    return student;
  }

  // Advisors must have ownership relationship
  if (sessionCtx.role === 'advisor') {
    const ownership = await ctx.db
      .query('student_advisors')
      .withIndex('by_advisor', (q) =>
        q.eq('advisor_id', sessionCtx.userId).eq('university_id', universityId),
      )
      .filter((q) => q.and(q.eq(q.field('student_id'), studentId), q.eq(q.field('is_owner'), true)))
      .first();

    if (!ownership) {
      throw new Error('Unauthorized: Advisor is not the primary owner for this student');
    }

    return student;
  }

  throw new Error(`Unauthorized: Role "${sessionCtx.role}" cannot access student data`);
}

/**
 * Check if advisor can access a specific student (returns boolean instead of throwing)
 * Useful for filtering lists
 */
export async function canAccessStudent(
  ctx: QueryCtx | MutationCtx,
  sessionCtx: AdvisorSessionContext,
  studentId: Id<'users'>,
): Promise<boolean> {
  try {
    await assertCanAccessStudent(ctx, sessionCtx, studentId);
    return true;
  } catch (error) {
    // Expected authorization errors - return false
    if (
      error instanceof Error &&
      (error.message.startsWith('Unauthorized') || error.message === 'Student not found')
    ) {
      return false;
    }
    // Unexpected errors - log and rethrow for visibility
    console.error('Unexpected error in canAccessStudent:', error);
    throw error;
  }
}

/**
 * Default page size for student queries
 * Balances between reducing round trips and avoiding timeout issues
 */
const DEFAULT_STUDENT_PAGE_SIZE = 100;

/**
 * Maximum page size to prevent abuse
 */
const MAX_STUDENT_PAGE_SIZE = 500;

/**
 * Paginated result type for student ID queries
 */
export interface PaginatedStudentIds {
  studentIds: Id<'users'>[];
  cursor: string | null; // null means no more results
  hasMore: boolean;
  totalEstimate?: number; // Approximate total count (when available)
}

/**
 * Get paginated list of student IDs that the advisor owns
 *
 * Use this function for large-scale deployments where unbounded queries
 * may cause performance issues. Supports cursor-based pagination.
 *
 * @param limit - Number of students to fetch (default: 100, max: 500)
 * @param cursor - Cursor from previous page (undefined for first page)
 */
export async function getOwnedStudentIdsPaginated(
  ctx: QueryCtx | MutationCtx,
  sessionCtx: AdvisorSessionContext,
  options?: {
    limit?: number;
    cursor?: string;
  },
): Promise<PaginatedStudentIds> {
  const limit = Math.min(options?.limit ?? DEFAULT_STUDENT_PAGE_SIZE, MAX_STUDENT_PAGE_SIZE);

  // Super admin can access all students (no tenant restriction)
  if (sessionCtx.role === 'super_admin') {
    const query = ctx.db.query('users').withIndex('by_role', (q) => q.eq('role', 'student'));

    const result = await query.paginate({
      numItems: limit,
      cursor: options?.cursor ?? null,
    });

    return {
      studentIds: result.page.map((s) => s._id),
      cursor: result.continueCursor,
      hasMore: !result.isDone,
    };
  }

  const universityId = requireTenant(sessionCtx);

  // University admin can access all students in their university
  if (sessionCtx.role === 'university_admin') {
    // Note: We can't directly paginate with a filter, so we use a workaround
    // by fetching more items and filtering client-side
    const query = ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', universityId));

    const result = await query.paginate({
      numItems: limit * 2, // Fetch extra to account for non-students
      cursor: options?.cursor ?? null,
    });

    // Filter to students only
    const students = result.page.filter((u) => u.role === 'student');

    // Note: This pagination approach has a known limitation - if the ratio of
    // students to non-students is low, pages may return fewer than `limit` items.
    // A composite index (by_university_and_role) would solve this but adds schema complexity.
    return {
      studentIds: students.slice(0, limit).map((s) => s._id),
      cursor: result.continueCursor,
      hasMore: !result.isDone,
    };
  }

  // Advisors only get students they own
  if (sessionCtx.role === 'advisor') {
    const query = ctx.db
      .query('student_advisors')
      .withIndex('by_advisor_owner', (q) =>
        q
          .eq('advisor_id', sessionCtx.userId)
          .eq('is_owner', true)
          .eq('university_id', universityId),
      );

    const result = await query.paginate({
      numItems: limit,
      cursor: options?.cursor ?? null,
    });

    return {
      studentIds: result.page.map((a) => a.student_id),
      cursor: result.continueCursor,
      hasMore: !result.isDone,
    };
  }

  return {
    studentIds: [],
    cursor: null,
    hasMore: false,
  };
}

/**
 * Get list of all student IDs that the advisor owns
 * Used for bulk filtering in list queries
 *
 * NOTE: This function now uses pagination internally with a sensible limit.
 * For very large datasets, use `getOwnedStudentIdsPaginated` directly.
 *
 * Default behavior:
 * - Advisors: Returns all owned students (typically small caseloads)
 * - University admins: Returns up to 1000 students
 * - Super admins: Returns up to 1000 students
 *
 * If you need ALL students for super_admin/university_admin, use
 * `getOwnedStudentIdsPaginated` with cursor iteration.
 */
export async function getOwnedStudentIds(
  ctx: QueryCtx | MutationCtx,
  sessionCtx: AdvisorSessionContext,
  options?: {
    limit?: number; // Max students to return (default: 1000)
  },
): Promise<Id<'users'>[]> {
  const maxLimit = options?.limit ?? 1000;

  // For advisors, typically small caseloads - collect all
  if (sessionCtx.role === 'advisor') {
    const universityId = requireTenant(sessionCtx);
    const assignments = await ctx.db
      .query('student_advisors')
      .withIndex('by_advisor_owner', (q) =>
        q
          .eq('advisor_id', sessionCtx.userId)
          .eq('is_owner', true)
          .eq('university_id', universityId),
      )
      .take(maxLimit);

    return assignments.map((a) => a.student_id);
  }

  // For super_admin and university_admin, use paginated approach with limit
  const allStudentIds: Id<'users'>[] = [];
  let cursor: string | null = null;

  do {
    const result = await getOwnedStudentIdsPaginated(ctx, sessionCtx, {
      limit: Math.min(DEFAULT_STUDENT_PAGE_SIZE, maxLimit - allStudentIds.length),
      cursor: cursor ?? undefined,
    });

    allStudentIds.push(...result.studentIds);
    cursor = result.cursor;

    // Stop if we've reached the limit
    if (allStudentIds.length >= maxLimit) {
      break;
    }
  } while (cursor !== null);

  return allStudentIds.slice(0, maxLimit);
}

/**
 * Check if a note/session/comment should be visible based on visibility setting
 *
 * Rules:
 * - "shared": visible to student and all advisors
 * - "advisor_only": visible only to advisors (not students)
 * - Supervisors (university_admin, super_admin) can always see private notes
 */
export function canViewPrivateContent(
  sessionCtx: AdvisorSessionContext,
  visibility: 'shared' | 'advisor_only',
  authorId?: Id<'users'>,
): boolean {
  // Shared content is visible to everyone
  if (visibility === 'shared') {
    return true;
  }

  // Private content rules
  if (visibility === 'advisor_only') {
    // Students cannot see advisor-only content
    if (sessionCtx.role === 'student' || sessionCtx.role === 'user') {
      return false;
    }

    // Supervisors can see all private content
    if (sessionCtx.role === 'super_admin' || sessionCtx.role === 'university_admin') {
      return true;
    }

    // Advisors can see their own private content
    if (sessionCtx.role === 'advisor') {
      // Require authorId to be specified; default to hiding if unknown
      return authorId !== undefined && authorId === sessionCtx.userId;
    }
  }

  return false;
}

/**
 * Audit log helper - create audit entry for sensitive actions
 * Must be called for: stage changes, review status changes, visibility changes, student assignments
 *
 * Note: This is the legacy advisor audit log helper. For new code, prefer using
 * the typed audit logger from './lib/auditLogger' which supports categories.
 *
 * This function auto-categorizes based on action prefix:
 * - 'student.' or 'advisor.' actions → permission_change (assignment-related)
 * - Other actions → user_action (general advisor operations)
 */
export async function createAuditLog(
  ctx: MutationCtx,
  params: {
    actorId: Id<'users'>;
    universityId: Id<'universities'> | undefined;
    action: string;
    entityType: string;
    entityId: string;
    studentId?: Id<'users'>;
    previousValue?: unknown;
    newValue?: unknown;
    ipAddress?: string; // Optional - Convex backend doesn't have access to client IP
    userAgent?: string;
  },
): Promise<Id<'audit_logs'>> {
  // Auto-categorize based on action type
  // Assignment-related actions are permission changes, others are user actions
  const isPermissionAction =
    params.action.startsWith('student.advisor') ||
    params.action.startsWith('student.owner') ||
    params.action.includes('assignment') ||
    params.action.includes('assigned') ||
    params.action.includes('removed');

  const category = isPermissionAction ? 'permission_change' : 'user_action';

  return await ctx.db.insert('audit_logs', {
    actor_id: params.actorId,
    university_id: params.universityId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    student_id: params.studentId,
    previous_value: params.previousValue,
    new_value: params.newValue,
    ip_address: params.ipAddress,
    user_agent: params.userAgent,
    created_at: Date.now(),
    // New fields for enterprise audit
    category,
    actor_type: 'user',
  });
}
