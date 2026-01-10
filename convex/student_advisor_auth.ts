/**
 * Student Advisor Hub - Authorization Helper
 *
 * Backend authorization for student-facing advisor features.
 * Enforces the hard constraint: role === 'student' AND university_id exists.
 *
 * Every student_advisor_hub query/mutation MUST call requireUniversityStudent first.
 */

import { ConvexError } from 'convex/values';

import { Id } from './_generated/dataModel';
import { QueryCtx, MutationCtx } from './_generated/server';

// Type for context that works for both queries and mutations
type Ctx = QueryCtx | MutationCtx;

/**
 * Result type for requireUniversityStudent
 */
export interface UniversityStudentAuth {
  userId: Id<'users'>;
  universityId: Id<'universities'>;
  clerkId: string;
  email: string;
}

/**
 * Require that the caller is a university-affiliated student.
 *
 * This is the hard constraint for Student Advisor Hub access:
 * - role === 'student'
 * - university_id exists and is valid
 *
 * @param ctx - Convex query or mutation context
 * @param clerkId - Clerk user ID from the client
 * @returns User ID and University ID for scoping queries
 * @throws ConvexError if authorization fails
 */
export async function requireUniversityStudent(
  ctx: Ctx,
  clerkId: string,
): Promise<UniversityStudentAuth> {
  // Find user by Clerk ID
  const user = await ctx.db
    .query('users')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
    .unique();

  if (!user) {
    throw new ConvexError({
      code: 'NOT_FOUND',
      message: 'User not found',
    });
  }

  // Check account status
  if (user.account_status === 'deleted') {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message: 'User account has been deleted',
    });
  }

  if (user.account_status === 'suspended') {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message: 'User account has been suspended',
    });
  }

  // Enforce role === 'student'
  if (user.role !== 'student') {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message: 'This feature is only available to university students',
    });
  }

  // Enforce university_id exists
  if (!user.university_id) {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message: 'This feature is only available to university-affiliated students',
    });
  }

  // Verify university exists and is active
  const university = await ctx.db.get(user.university_id);
  if (!university) {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message: 'University not found',
    });
  }

  if (university.status !== 'active' && university.status !== 'trial') {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message: 'University subscription is not active',
    });
  }

  return {
    userId: user._id,
    universityId: user.university_id,
    clerkId: user.clerkId,
    email: user.email,
  };
}

/**
 * Get the student's assigned advisor(s).
 * Returns null if no advisor is assigned.
 */
export async function getStudentAdvisor(
  ctx: Ctx,
  studentId: Id<'users'>,
  universityId: Id<'universities'>,
): Promise<{
  advisorId: Id<'users'>;
  advisorName: string;
  advisorEmail: string;
  advisorTitle?: string;
  hasAvailability: boolean;
} | null> {
  // Find advisor assignment
  const assignment = await ctx.db
    .query('student_advisors')
    .withIndex('by_student', (q) => q.eq('student_id', studentId).eq('university_id', universityId))
    .filter((q) => q.eq(q.field('is_owner'), true))
    .first();

  if (!assignment) {
    return null;
  }

  // Get advisor details
  const advisor = await ctx.db.get(assignment.advisor_id);
  if (!advisor) {
    return null;
  }

  // Check if advisor has any active availability slots
  const availabilitySlot = await ctx.db
    .query('advisor_availability')
    .withIndex('by_advisor', (q) => q.eq('advisor_user_id', advisor._id))
    .filter((q) => q.eq(q.field('is_active'), true))
    .first();

  return {
    advisorId: advisor._id,
    advisorName: advisor.name || advisor.email,
    advisorEmail: advisor.email,
    advisorTitle: advisor.job_title,
    hasAvailability: availabilitySlot !== null,
  };
}

/**
 * Assert that the student has an assigned advisor.
 * @throws ConvexError if no advisor is assigned
 */
export async function requireStudentHasAdvisor(
  ctx: Ctx,
  studentId: Id<'users'>,
  universityId: Id<'universities'>,
): Promise<{
  advisorId: Id<'users'>;
  advisorName: string;
  advisorEmail: string;
}> {
  const advisor = await getStudentAdvisor(ctx, studentId, universityId);

  if (!advisor) {
    throw new ConvexError({
      code: 'NOT_FOUND',
      message: 'No advisor assigned. Please contact your university career center.',
    });
  }

  return advisor;
}
