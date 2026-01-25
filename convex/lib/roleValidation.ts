/**
 * Role Validation Business Logic
 *
 * This module provides validation rules for role transitions to ensure
 * data integrity and prevent invalid role assignments.
 */

import { Id } from '../_generated/dataModel';
import { MutationCtx, QueryCtx } from '../_generated/server';

/**
 * Valid user roles (Convex backend source of truth)
 * Define roles as a const array, then derive the type from it
 * This prevents divergence between the type definition and runtime validation
 *
 * ⚠️ IMPORTANT: This array is duplicated in src/lib/constants/roles.ts
 * due to module boundary restrictions (Convex cannot import from Next.js src/).
 * When adding/removing roles, update BOTH files:
 * - convex/lib/roleValidation.ts (this file)
 * - src/lib/constants/roles.ts
 *
 * These are kept in sync via src/__tests__/role-sync.test.ts
 */
const ROLE_VALUES = [
  'super_admin',
  'university_admin',
  'advisor',
  'student',
  'individual',
  'staff',
  'user',
] as const;

/**
 * UserRole type derived from ROLE_VALUES array
 * This ensures compile-time and runtime role definitions stay in sync
 */
export type UserRole = (typeof ROLE_VALUES)[number];

/**
 * Valid user roles array for runtime validation
 * Exported for use in validation functions across Convex
 */
export const VALID_ROLES: readonly UserRole[] = ROLE_VALUES;

export interface RoleValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
  requiredActions?: string[];
}

/**
 * Type guard to check if a string is a valid user role
 */
export function isValidUserRole(role: string): role is UserRole {
  return VALID_ROLES.includes(role as UserRole);
}

/**
 * Normalize legacy "user" role to the modern equivalent.
 * - If tied to a university, treat as "student"
 * - Otherwise, treat as "individual"
 */
export function normalizeLegacyUserRole(
  role: UserRole | undefined,
  universityId?: Id<'universities'> | null,
): UserRole | undefined {
  if (!role || role !== 'user') {
    return role;
  }

  return universityId ? 'student' : 'individual';
}

/**
 * Validate a role transition for a user
 *
 * @param ctx Convex context
 * @param userId Clerk user ID (string)
 * @param oldRole Current role
 * @param newRole Desired new role
 * @param universityId User's university affiliation (if any)
 * @returns Validation result with errors/warnings/required actions
 */
export async function validateRoleTransition(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  oldRole: UserRole,
  newRole: UserRole,
  universityId?: Id<'universities'>,
): Promise<RoleValidationResult> {
  const warnings: string[] = [];
  const requiredActions: string[] = [];

  // Rule 1: Student role requires university_id
  if (newRole === 'student' && !universityId) {
    return {
      valid: false,
      error: 'Student role requires a university affiliation. Please assign a university first.',
    };
  }

  // Rule 2: University admin role requires university_id
  if (newRole === 'university_admin' && !universityId) {
    return {
      valid: false,
      error:
        'University admin role requires a university affiliation. Please assign a university first.',
    };
  }

  // Rule 3: Advisor role requires university_id
  if (newRole === 'advisor' && !universityId) {
    return {
      valid: false,
      error: 'Advisor role requires a university affiliation. Please assign a university first.',
    };
  }

  // Rule 4: Individual role must NOT have university_id
  if (newRole === 'individual' && universityId) {
    return {
      valid: false,
      error:
        'Individual users cannot be assigned to a university. Clear university_id before setting role to individual.',
    };
  }

  // Rule 5: Cannot change super_admin role
  // BUSINESS RULE: There is only ONE super_admin (the founder).
  // The super_admin role cannot be changed through the admin UI.
  // This prevents accidental lockout from the platform.
  if (oldRole === 'super_admin' && newRole !== 'super_admin') {
    return {
      valid: false,
      error:
        'Cannot change super_admin role. This role is reserved for the platform founder and cannot be modified through the admin interface. Use Clerk Dashboard for emergency role changes.',
    };
  }

  // Rule 6: Transitioning from student requires handling student profile
  if (oldRole === 'student' && newRole !== 'student') {
    requiredActions.push('Student profile data will be preserved but user loses university access');
  }

  // Rule 7: Transitioning to student may require creating student profile
  if (oldRole !== 'student' && newRole === 'student') {
    requiredActions.push("Student profile will be created if it doesn't exist");
  }

  // Rule 8: Changing university roles may affect memberships
  if (
    (oldRole === 'university_admin' || oldRole === 'advisor') &&
    newRole !== 'university_admin' &&
    newRole !== 'advisor'
  ) {
    warnings.push('University admin privileges will be revoked');
    requiredActions.push('Remove from university admin/advisor groups');
  }

  // Rule 9: Verify university exists if assigning university role
  if (
    universityId &&
    (newRole === 'student' || newRole === 'university_admin' || newRole === 'advisor')
  ) {
    try {
      const university = await ctx.db.get(universityId);
      if (!university) {
        return {
          valid: false,
          error: 'The specified university does not exist.',
        };
      }

      // Check if university is active (only if this is a university record)
      if ('status' in university) {
        if (university.status !== 'active' && university.status !== 'trial') {
          warnings.push(
            `Warning: This university has status "${university.status}". User may have limited access.`,
          );
        }
      }
    } catch (e) {
      return {
        valid: false,
        error: `Failed to verify university: ${e instanceof Error ? e.message : 'Unknown error'}`,
      };
    }
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
    requiredActions: requiredActions.length > 0 ? requiredActions : undefined,
  };
}

/**
 * Get a human-readable description of what a role can access
 */
export function getRoleDescription(role: UserRole): string {
  const descriptions: Record<UserRole, string> = {
    super_admin:
      'Full platform access: Manage all users, universities, system settings, and view all analytics and audit logs.',
    university_admin:
      'University administrator: Manage students, advisors, and settings for assigned university only.',
    advisor: 'University advisor: View and assist students within assigned university.',
    student: 'University student: Access career tools with university subscription and support.',
    individual: 'Individual user: Access career tools with free or premium subscription.',
    user: "Legacy individual user: Access career tools (being migrated to 'individual' role).",
    staff: 'Platform staff: Limited internal access to support and operational tools.',
  };

  return descriptions[role] || 'Unknown role';
}

/**
 * Get all permissions for a specific role
 * Returns a structured object of feature areas and their access levels
 */
export function getRolePermissions(role: UserRole): {
  platformSettings: boolean;
  userManagement: 'all' | 'university' | 'none';
  universityManagement: 'all' | 'own' | 'none';
  studentManagement: 'all' | 'university' | 'assigned' | 'none';
  platformAnalytics: boolean;
  universityAnalytics: 'all' | 'own' | 'none';
  auditLogs: boolean;
  supportTickets: 'all' | 'university' | 'own' | 'none';
  careerTools: boolean;
} {
  const permissions = {
    super_admin: {
      platformSettings: true,
      userManagement: 'all' as const,
      universityManagement: 'all' as const,
      studentManagement: 'all' as const,
      platformAnalytics: true,
      universityAnalytics: 'all' as const,
      auditLogs: true,
      supportTickets: 'all' as const,
      careerTools: true,
    },
    university_admin: {
      platformSettings: false,
      userManagement: 'university' as const,
      universityManagement: 'own' as const,
      studentManagement: 'university' as const,
      platformAnalytics: false,
      universityAnalytics: 'own' as const,
      auditLogs: false,
      supportTickets: 'university' as const,
      careerTools: true,
    },
    advisor: {
      platformSettings: false,
      userManagement: 'none' as const,
      universityManagement: 'none' as const,
      studentManagement: 'assigned' as const,
      platformAnalytics: false,
      universityAnalytics: 'own' as const,
      auditLogs: false,
      supportTickets: 'university' as const,
      careerTools: true,
    },
    student: {
      platformSettings: false,
      userManagement: 'none' as const,
      universityManagement: 'none' as const,
      studentManagement: 'none' as const,
      platformAnalytics: false,
      universityAnalytics: 'none' as const,
      auditLogs: false,
      supportTickets: 'own' as const,
      careerTools: true,
    },
    individual: {
      platformSettings: false,
      userManagement: 'none' as const,
      universityManagement: 'none' as const,
      studentManagement: 'none' as const,
      platformAnalytics: false,
      universityAnalytics: 'none' as const,
      auditLogs: false,
      supportTickets: 'own' as const,
      careerTools: true,
    },
    user: {
      // Legacy role - same as individual
      platformSettings: false,
      userManagement: 'none' as const,
      universityManagement: 'none' as const,
      studentManagement: 'none' as const,
      platformAnalytics: false,
      universityAnalytics: 'none' as const,
      auditLogs: false,
      supportTickets: 'own' as const,
      careerTools: true,
    },
    // STAFF ROLE ACCESS SCOPE:
    // Staff members are internal Ascentul employees who provide support.
    // They have access to ALL support tickets across all universities.
    // This is intentional - staff need to help any user regardless of institution.
    //
    // SECURITY NOTE: Staff cannot:
    // - Access platform settings or audit logs
    // - Manage users, universities, or students
    // - View analytics (platform or university-level)
    //
    // Staff CAN:
    // - View and respond to all support tickets (supportTickets: "all")
    // - Use career tools (for testing/understanding the product)
    //
    // If university-scoped support is needed in the future, add a
    // "university_support" role with supportTickets: "university".
    staff: {
      platformSettings: false,
      userManagement: 'none' as const,
      universityManagement: 'none' as const,
      studentManagement: 'none' as const,
      platformAnalytics: false,
      universityAnalytics: 'none' as const,
      auditLogs: false,
      supportTickets: 'all' as const, // Cross-university access for internal support team
      careerTools: true,
    },
  };

  return permissions[role];
}

/**
 * Get route access for a role
 * Returns list of route patterns the role can access
 */
export function getRoleRouteAccess(role: UserRole): string[] {
  const routes: Record<UserRole, string[]> = {
    super_admin: [
      '/admin/*',
      '/university/*',
      '/dashboard/*',
      '/applications/*',
      '/resumes/*',
      '/career-coach/*',
      '/goals/*',
      '/projects/*',
      '/contacts/*',
      '/account/*',
    ],
    university_admin: [
      '/university/*',
      '/dashboard/*',
      '/applications/*',
      '/resumes/*',
      '/career-coach/*',
      '/goals/*',
      '/projects/*',
      '/contacts/*',
      '/account/*',
    ],
    advisor: [
      '/university/*',
      '/dashboard/*',
      '/applications/*',
      '/resumes/*',
      '/career-coach/*',
      '/goals/*',
      '/projects/*',
      '/contacts/*',
      '/account/*',
    ],
    student: [
      '/dashboard/*',
      '/applications/*',
      '/resumes/*',
      '/career-coach/*',
      '/goals/*',
      '/projects/*',
      '/contacts/*',
      '/account/*',
    ],
    individual: [
      '/dashboard/*',
      '/applications/*',
      '/resumes/*',
      '/career-coach/*',
      '/goals/*',
      '/projects/*',
      '/contacts/*',
      '/account/*',
    ],
    user: [
      '/dashboard/*',
      '/applications/*',
      '/resumes/*',
      '/career-coach/*',
      '/goals/*',
      '/projects/*',
      '/contacts/*',
      '/account/*',
    ],
    staff: [
      '/dashboard/*',
      '/applications/*',
      '/resumes/*',
      '/career-coach/*',
      '/goals/*',
      '/projects/*',
      '/contacts/*',
      '/account/*',
    ],
  };

  return routes[role] || [];
}
