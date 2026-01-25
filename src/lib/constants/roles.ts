/**
 * Centralized Role Constants (Next.js frontend)
 *
 * This is the SINGLE SOURCE OF TRUTH for all role-related constants.
 * All role checks across the codebase should import from here.
 *
 * ⚠️ IMPORTANT: This array is duplicated in convex/lib/roleValidation.ts
 * due to module boundary restrictions (Convex cannot import from Next.js src/).
 * When adding/removing roles, update BOTH files:
 * - src/lib/constants/roles.ts (this file)
 * - convex/lib/roleValidation.ts
 *
 * These are kept in sync via __tests__/role-sync.test.ts
 *
 * @see convex/lib/roleValidation.ts for role transition validation logic
 */

// =============================================================================
// Core Role Types
// =============================================================================

/**
 * All valid user roles in the system.
 * Matches the Convex schema exactly (convex/schema.ts lines 11-18).
 */
export const VALID_USER_ROLES = [
  'super_admin',
  'university_admin',
  'advisor',
  'student',
  'individual',
  'staff',
  'user',
] as const;

export type UserRole = (typeof VALID_USER_ROLES)[number];

/**
 * Type guard to check if a string is a valid user role
 */
export function isValidUserRole(role: string): role is UserRole {
  return VALID_USER_ROLES.includes(role as UserRole);
}

// =============================================================================
// Role Groups by Access Level
// =============================================================================

/**
 * Roles that can access advisor features (advisor dashboard, student management).
 */
export const ADVISOR_ACCESSIBLE_ROLES = ['advisor', 'university_admin', 'super_admin'] as const;

/**
 * Roles that have platform admin access (/admin routes).
 */
export const PLATFORM_ADMIN_ROLES = ['super_admin'] as const;

/**
 * Roles that can manage a university (/university routes, export data).
 */
export const UNIVERSITY_ADMIN_ROLES = ['university_admin', 'super_admin'] as const;

/**
 * Roles that are affiliated with a university (require university_id).
 */
export const UNIVERSITY_AFFILIATED_ROLES = [
  'student',
  'staff',
  'advisor',
  'university_admin',
] as const;

/**
 * Roles that are individual users (NOT affiliated with university).
 */
export const INDIVIDUAL_ROLES = [
  'individual',
  'user', // Legacy
] as const;

/**
 * Roles that count as "students" for analytics purposes.
 * Includes legacy 'user' role for backward compatibility.
 */
export const STUDENT_COUNTABLE_ROLES = [
  'user', // Legacy - users assigned to universities before role migration
  'student', // Current - explicitly assigned student role
] as const;

/**
 * Roles that can be assigned to university students via assign-student API.
 */
export const ASSIGNABLE_STUDENT_ROLES = ['student', 'staff'] as const;

// =============================================================================
// Role Check Helpers
// =============================================================================

/**
 * Check if a role has advisor access.
 */
export function hasAdvisorAccess(role: string | undefined | null): boolean {
  return !!role && (ADVISOR_ACCESSIBLE_ROLES as readonly string[]).includes(role);
}

/**
 * Check if a role has platform admin access.
 */
export function hasPlatformAdminAccess(role: string | undefined | null): boolean {
  return !!role && (PLATFORM_ADMIN_ROLES as readonly string[]).includes(role);
}

/**
 * Check if a role has university admin access.
 */
export function hasUniversityAdminAccess(role: string | undefined | null): boolean {
  return !!role && (UNIVERSITY_ADMIN_ROLES as readonly string[]).includes(role);
}

/**
 * Check if a role requires university affiliation.
 */
export function requiresUniversityAffiliation(role: string | undefined | null): boolean {
  return !!role && (UNIVERSITY_AFFILIATED_ROLES as readonly string[]).includes(role);
}

/**
 * Check if a role counts as a student for analytics.
 */
export function isStudentRole(role: string | undefined | null): boolean {
  return !!role && (STUDENT_COUNTABLE_ROLES as readonly string[]).includes(role);
}

/**
 * Check if a user is a university-affiliated student.
 * This is the hard constraint for Student Advisor Hub access.
 * Requires BOTH: role === 'student' AND valid university_id.
 */
export function isUniversityStudent(
  role: string | undefined | null,
  universityId: string | undefined | null,
): boolean {
  return role === 'student' && !!universityId;
}

// =============================================================================
// Goal Status Constants (for API validation)
// =============================================================================

/**
 * Valid goal status values.
 * Matches convex/schema.ts goal status validator.
 */
export const VALID_GOAL_STATUSES = [
  'not_started',
  'in_progress',
  'active',
  'completed',
  'paused',
  'cancelled',
] as const;

export type GoalStatus = (typeof VALID_GOAL_STATUSES)[number];

export function isValidGoalStatus(status: unknown): status is GoalStatus {
  return typeof status === 'string' && (VALID_GOAL_STATUSES as readonly string[]).includes(status);
}

// =============================================================================
// Support Ticket Priority Constants
// =============================================================================

/**
 * Valid support ticket priority values.
 * Matches convex/support_tickets.ts priority validator.
 */
export const VALID_TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export type TicketPriority = (typeof VALID_TICKET_PRIORITIES)[number];

export function isValidTicketPriority(priority: unknown): priority is TicketPriority {
  return (
    typeof priority === 'string' &&
    (VALID_TICKET_PRIORITIES as readonly string[]).includes(priority)
  );
}
