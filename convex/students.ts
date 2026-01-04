import { v } from 'convex/values';

import { internal } from './_generated/api';
import { Doc, Id } from './_generated/dataModel';
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  MutationCtx,
  query,
  QueryCtx,
} from './_generated/server';
import { maskEmail, maskId } from './lib/piiSafe';

/**
 * Basic email format validation
 *
 * IMPORTANT: This is a simplified validation for Convex compatibility.
 * The email-validator package is not compatible with Convex's V8 isolate environment.
 *
 * Current validation ONLY checks:
 * - Non-whitespace characters before @
 * - Non-whitespace characters after @ and before .
 * - Non-whitespace characters after final .
 *
 * This regex does NOT validate:
 * - RFC 5322 compliance
 * - Internationalized domain names (IDN)
 * - Plus-addressing or special characters
 * - Length limits (local part max 64, domain max 255)
 * - IPv6 address literals
 * - Quoted strings in local parts
 *
 * Trade-off: We rely on email delivery systems to catch actual delivery issues.
 * This basic validation prevents obviously malformed addresses while remaining
 * compatible with Convex's runtime environment.
 */
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valid academic year classifications for students
 *
 * Used for validation in student profile creation and updates.
 * Ensures consistency across invite acceptance, profile updates, and queries.
 */
const VALID_YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'] as const;

type CryptoLike = {
  getRandomValues(array: Uint8Array): Uint8Array;
};

/**
 * Generate a cryptographically secure random token
 *
 * Uses Web Crypto `getRandomValues` which Convex exposes in its environment.
 * Avoids importing Node's `crypto` module so this file can run in the default
 * Convex runtime while still producing strong randomness.
 */
function generateSecureToken(): string {
  const cryptoObj = (globalThis as { crypto?: CryptoLike }).crypto;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    throw new Error('Secure crypto API is unavailable in this environment');
  }

  const bytes = new Uint8Array(32);
  cryptoObj.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate GPA value
 *
 * @param gpa - GPA value to validate (optional)
 * @throws Error if GPA is invalid
 *
 * Validation rules:
 * - If null/undefined, validation passes (GPA is optional)
 * - If provided, must be between 0.0 and 4.0 (inclusive)
 * - Non-numeric values are rejected
 */
function validateGPA(gpa: number | null | undefined): void {
  if (gpa === undefined || gpa === null) {
    return; // GPA is optional
  }

  if (typeof gpa !== 'number' || isNaN(gpa)) {
    throw new Error('GPA must be a valid number');
  }

  if (gpa < 0.0 || gpa > 4.0) {
    throw new Error('GPA must be between 0.0 and 4.0');
  }
}

/**
 * Rollback invite acceptance when capacity is exceeded
 *
 * Performs rollback operations in reverse order of creation.
 * Each step has independent error handling to maximize recovery.
 *
 * @param ctx - Mutation context
 * @param params - Rollback parameters including entities to revert
 * @returns Object with success status and any errors encountered
 */
async function rollbackInviteAcceptance(
  ctx: MutationCtx,
  params: {
    userId: Id<'users'>;
    studentProfileId: Id<'studentProfiles'>;
    inviteId: Id<'studentInvites'>;
    universityId: Id<'universities'>;
    originalUserState: {
      role: Doc<'users'>['role'];
      university_id?: Doc<'users'>['university_id'];
      subscription_plan?: Doc<'users'>['subscription_plan'];
      subscription_status?: Doc<'users'>['subscription_status'];
    };
    context: {
      userEmail: string;
      universityName: string;
      currentUsage: number;
      capacity: number;
    };
  },
): Promise<{ success: boolean; errors: string[] }> {
  const now = Date.now();
  const rollbackErrors: string[] = [];

  console.error(
    `[ROLLBACK INITIATED] License capacity exceeded for ${params.context.universityName}: ` +
      `${params.context.currentUsage}/${params.context.capacity}`,
  );
  console.error(`User: ${maskId(params.userId)}, Invite: ${maskId(params.inviteId)}`);

  // Rollback Step 1: Decrement license usage
  try {
    const university = await ctx.db.get(params.universityId);
    if (university) {
      await ctx.db.patch(params.universityId, {
        license_used: Math.max(0, (university.license_used || 0) - 1),
        updated_at: now,
      });
      console.log('[ROLLBACK] ✓ License count decremented');
    }
  } catch (error) {
    const errMsg = `Failed to decrement license count: ${error}`;
    console.error(`[ROLLBACK] ✗ ${errMsg}`);
    rollbackErrors.push(errMsg);
  }

  // Rollback Step 2: Delete student profile
  try {
    await ctx.db.delete(params.studentProfileId);
    console.log('[ROLLBACK] ✓ Student profile deleted');
  } catch (error) {
    const errMsg = `Failed to delete student profile ${params.studentProfileId}: ${error}`;
    console.error(`[ROLLBACK] ✗ ${errMsg}`);
    rollbackErrors.push(errMsg);
  }

  // Rollback Step 3: Restore user's original state
  try {
    await ctx.db.patch(params.userId, {
      role: params.originalUserState.role,
      university_id: params.originalUserState.university_id,
      subscription_plan: params.originalUserState.subscription_plan,
      subscription_status: params.originalUserState.subscription_status,
      updated_at: now,
    });
    console.log('[ROLLBACK] ✓ User state restored');
  } catch (error) {
    const errMsg = `Failed to restore user state for ${params.userId}: ${error}`;
    console.error(`[ROLLBACK] ✗ ${errMsg}`);
    rollbackErrors.push(errMsg);
  }

  // Rollback Step 4: Deactivate student membership (if created)
  try {
    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_user_role', (q) => q.eq('user_id', params.userId).eq('role', 'student'))
      .first();

    if (membership) {
      await ctx.db.patch(membership._id, {
        status: 'inactive',
        updated_at: now,
      });
      console.log('[ROLLBACK] ✓ Student membership deactivated');
    }
  } catch (error) {
    const errMsg = `Failed to adjust student membership for ${params.userId}: ${error}`;
    console.error(`[ROLLBACK] ✗ ${errMsg}`);
    rollbackErrors.push(errMsg);
  }

  // Rollback Step 5: Mark invite as pending again and clear acceptance data
  // Explicitly set accepted_at and accepted_by_user_id to null to prevent stale data
  // that could cause issues with queries filtering by these fields or audit trails
  try {
    await ctx.db.patch(params.inviteId, {
      status: 'pending',
      accepted_at: null,
      accepted_by_user_id: null,
      updated_at: now,
    });
    console.log('[ROLLBACK] ✓ Invite reset to pending (acceptance data cleared)');
  } catch (error) {
    const errMsg = `Failed to reset invite ${params.inviteId}: ${error}`;
    console.error(`[ROLLBACK] ✗ ${errMsg}`);
    rollbackErrors.push(errMsg);
  }

  // Log rollback completion status
  if (rollbackErrors.length > 0) {
    console.error(
      `[ROLLBACK INCOMPLETE] ${rollbackErrors.length} step(s) failed. ` +
        `Manual cleanup may be required. Run: npx convex run students:detectOrphanedProfiles`,
    );
  } else {
    console.log('[ROLLBACK COMPLETE] All changes successfully reverted');
  }

  return {
    success: rollbackErrors.length === 0,
    errors: rollbackErrors,
  };
}

/**
 * Helper function to require student role
 * Throws error if user is not a student with valid studentProfile
 *
 * LEGACY SUPPORT: Currently accepts both "student" role AND legacy "user" role with university_id.
 * This is intentional for backward compatibility during the user→student migration period.
 * To remove: Run backfillStudentRoles migration, verify no users have role="user", then simplify this check.
 * See: convex/migrations.ts:backfillStudentRoles and scripts/backfill-student-roles.js
 */
export async function requireStudent(ctx: QueryCtx | MutationCtx, userId: Id<'users'>) {
  const user = await ctx.db.get(userId);

  if (!user) {
    throw new Error('User not found');
  }

  // Check if user is a student (includes legacy "user" role with university_id for backward compatibility)
  const isStudent = user.role === 'student' || (user.role === 'user' && user.university_id);

  if (!isStudent) {
    throw new Error('Unauthorized: Student role required');
  }

  // Check if user has university_id
  if (!user.university_id) {
    throw new Error('Student must belong to a university');
  }

  // Check if studentProfile exists
  const studentProfile = await ctx.db
    .query('studentProfiles')
    .withIndex('by_user_id', (q) => q.eq('user_id', userId))
    .first();

  if (!studentProfile) {
    throw new Error('Student profile not found. Student must have a valid profile.');
  }

  // Validate active membership
  const membership = await ctx.db
    .query('memberships')
    .withIndex('by_user_role', (q) => q.eq('user_id', userId).eq('role', 'student'))
    .first();

  if (!membership || membership.status !== 'active') {
    throw new Error('Unauthorized: Active student membership required');
  }

  return { user, studentProfile };
}

/**
 * Create a student invite (ACTION - generates secure token)
 *
 * This action:
 * 0. Generates a cryptographically secure random token
 * 1. Calls internal mutation to validate and create the invite
 *
 * Args:
 * - universityId: University issuing the invite
 * - email: Email of the student to invite (will be normalized to lowercase)
 * - createdByClerkId: Clerk ID of the university admin creating the invite
 * - expiresInDays: Number of days until invite expires (default: 7)
 * - metadata: Optional student data (major, year, student_id)
 *
 * Returns: { inviteId, token, expiresAt }
 *
 * SECURITY NOTE: This is an action (not a mutation) because we need to generate
 * cryptographically secure random tokens using Node.js crypto.randomBytes().
 * Never use Math.random() for security-sensitive tokens!
 */
export const createInvite = action({
  args: {
    universityId: v.id('universities'),
    email: v.string(),
    createdByClerkId: v.string(),
    expiresInDays: v.optional(v.number()),
    metadata: v.optional(
      v.object({
        student_id: v.optional(v.string()),
        major: v.optional(v.string()),
        year: v.optional(v.string()),
      }),
    ),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ inviteId: Id<'studentInvites'>; token: string; expiresAt: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized: Authentication required');
    }
    if (identity.subject !== args.createdByClerkId) {
      throw new Error('Unauthorized: Clerk identity mismatch');
    }

    // Generate cryptographically secure token
    const token = generateSecureToken();

    // Call internal mutation to create the invite with the secure token
    const result = await ctx.runMutation(internal.students.createInviteInternal, {
      ...args,
      token,
    });

    return result;
  },
});

/**
 * Internal mutation: Create student invite with provided token
 *
 * This mutation:
 * 0. Validates email format and normalizes it (lowercase, trimmed)
 * 1. Validates the university exists and is active
 * 2. Validates the creator is a university_admin for that university
 * 3. Checks for existing pending invites (enforces uniqueness invariant)
 * 4. Enforces rate limiting (max 50 invites per hour per admin)
 * 5. Creates the invite with the provided secure token
 *
 * SECURITY FEATURES:
 * - Email validation: Rejects invalid email formats
 * - Email normalization: Converts to lowercase and trims whitespace
 * - Rate limiting: Max 50 invites per hour per admin to prevent spam
 * - Uniqueness check: Only ONE pending invite per (email, university) pair
 * - Cryptographically secure token (generated by parent action)
 *
 * UNIQUENESS INVARIANT:
 * This mutation enforces that only ONE pending invite exists per (email, university) pair.
 * If a pending invite already exists, it throws an error instead of creating a duplicate.
 * This prevents the race condition where multiple admins create invites for the same student,
 * and both invites could be accepted, creating duplicate student profiles.
 */
export const createInviteInternal = internalMutation({
  args: {
    universityId: v.id('universities'),
    email: v.string(),
    createdByClerkId: v.string(),
    token: v.string(),
    expiresInDays: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const expiresInDays = args.expiresInDays ?? 7;
    const expiresAt = now + expiresInDays * 24 * 60 * 60 * 1000;

    // 0. Normalize email first (lowercase, trim whitespace)
    // This ensures we don't reject valid emails due to formatting differences
    const normalizedEmail = args.email.toLowerCase().trim();

    // 1. Validate email format using basic regex validation
    // NOTE: This is simplified validation for Convex compatibility (see validateEmail function)
    // Checks basic structure only: local@domain.tld
    // Email delivery systems will catch actual delivery issues
    if (!validateEmail(normalizedEmail)) {
      throw new Error('Invalid email format. Please provide a valid email address.');
    }

    // 2. Validate university exists and is active
    const university = await ctx.db.get(args.universityId);
    if (!university) {
      throw new Error('University not found');
    }

    if (university.status !== 'active') {
      throw new Error(
        `University is ${university.status}. Only active universities can send invites.`,
      );
    }

    // 3. Validate creator is university_admin for this university
    const creator = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.createdByClerkId))
      .unique();

    if (!creator) {
      throw new Error('Creator not found');
    }

    if (!['university_admin', 'advisor'].includes(creator.role)) {
      throw new Error('Only university admins or advisors can create invites');
    }

    if (creator.university_id !== args.universityId) {
      throw new Error('Cannot create invites for a different university');
    }

    // 4. Check for existing pending invite (UNIQUENESS INVARIANT)
    // Use university-scoped compound index for efficient lookup
    //
    // RACE CONDITION NOTE: This query-then-insert pattern has a race window where
    // concurrent requests can both pass this check and create duplicate invites.
    // Mitigation: Optimistic concurrency control with post-insert verification (step 5a)
    const existingPendingInvite = await ctx.db
      .query('studentInvites')
      .withIndex('by_university_email_status', (q) =>
        q
          .eq('university_id', args.universityId)
          .eq('email', normalizedEmail)
          .eq('status', 'pending'),
      )
      .first();

    if (existingPendingInvite) {
      throw new Error(
        `A pending invite already exists for ${normalizedEmail} at this university. ` +
          `Please revoke the existing invite first or wait for it to expire.`,
      );
    }

    // 5. Rate limiting check - prevent invite spam
    // Check how many invites this admin created in the last hour
    const oneHourAgo = now - 60 * 60 * 1000;
    const recentInvites = await ctx.db
      .query('studentInvites')
      .withIndex('by_created_by', (q) => q.eq('created_by_id', creator._id))
      .filter((q) => q.gte(q.field('created_at'), oneHourAgo))
      .collect();

    const rateLimitPerHour = 50; // Max 50 invites per hour per admin
    if (recentInvites.length >= rateLimitPerHour) {
      throw new Error(
        `Rate limit exceeded. You can only create ${rateLimitPerHour} invites per hour. ` +
          `Please try again later.`,
      );
    }

    // 6. Create invite with the cryptographically secure token
    const inviteId = await ctx.db.insert('studentInvites', {
      university_id: args.universityId,
      email: normalizedEmail,
      token: args.token,
      created_by_id: creator._id,
      status: 'pending',
      expires_at: expiresAt,
      metadata: args.metadata,
      created_at: now,
      updated_at: now,
    });

    // 6a. Optimistic concurrency control: verify no duplicate was created
    // This handles the race condition where concurrent requests both passed step 4
    // before either completed the insert. We detect duplicates immediately after insert.
    const allPendingForEmail = await ctx.db
      .query('studentInvites')
      .withIndex('by_university_email_status', (q) =>
        q
          .eq('university_id', args.universityId)
          .eq('email', normalizedEmail)
          .eq('status', 'pending'),
      )
      .collect();

    if (allPendingForEmail.length > 1) {
      // Race condition detected: multiple pending invites created concurrently
      // Keep the oldest invite (first by created_at), delete the newer one(s)
      const sortedInvites = [...allPendingForEmail].sort((a, b) => a.created_at - b.created_at);
      const keepInvite = sortedInvites[0];
      const deleteInvites = sortedInvites.slice(1);

      console.error(
        `🚨 RACE CONDITION DETECTED: ${allPendingForEmail.length} pending invites for ${normalizedEmail} ` +
          `at university ${args.universityId}`,
      );
      console.error(
        `  Keeping oldest invite: ${keepInvite._id} (created: ${new Date(keepInvite.created_at).toISOString()})`,
      );

      // Delete the duplicate(s) - including this one if it's not the oldest
      for (const inviteToDelete of deleteInvites) {
        console.error(
          `  Deleting duplicate invite: ${inviteToDelete._id} (created: ${new Date(inviteToDelete.created_at).toISOString()})`,
        );
        await ctx.db.delete(inviteToDelete._id);
      }

      // If we just deleted our own invite, throw an error to retry
      if (deleteInvites.some((inv) => inv._id === inviteId)) {
        throw new Error(
          `A pending invite for ${normalizedEmail} was created concurrently by another admin. ` +
            `The existing invite has been preserved. Please refresh to see the current invite.`,
        );
      }

      // Log for monitoring - this indicates high concurrency or potential issue
      console.warn(
        `⚠️  Resolved race condition: Kept invite ${keepInvite._id}, deleted ${deleteInvites.length} duplicate(s). ` +
          `If this happens frequently, consider implementing distributed locking.`,
      );
    }

    return {
      inviteId,
      token: args.token,
      expiresAt,
    };
  },
});

/**
 * Accept a student invite using a token
 *
 * This mutation:
 * 1. Validates the invite token (checks expiration, status)
 * 2. Updates user role to "student"
 * 3. Creates studentProfile linked to the university
 * 4. Updates invite status to "accepted"
 * 5. Links user to university via university_id
 *
 * Args:
 * - token: Unique invite token from email
 * - clerkId: Clerk user ID of the accepting user
 *
 * Returns: { success: true, universityName: string, studentProfileId: Id<"studentProfiles"> }
 *
 * KNOWN LIMITATION - Race Conditions:
 * Despite defensive double-checking and try-catch patterns, this mutation CANNOT
 * guarantee uniqueness without database-level unique constraints (which Convex lacks).
 *
 * Scenarios where duplicates could still occur:
 * 1. Concurrent acceptInvite calls for same user (extremely rare, requires precise timing)
 * 2. Manual database modifications outside this controlled mutation
 *
 * Mitigation strategy:
 * - Double-check immediately before insert (minimizes window to < 1ms)
 * - Try-catch fallback to use existing profile if insert fails
 * - Monitoring: Run findDuplicateProfiles periodically to detect duplicates
 * - Manual cleanup: If duplicates found, delete newer profiles (keep oldest)
 *
 * Production monitoring:
 * - Schedule periodic checks: npx convex run students:findDuplicateProfiles
 * - Alert on: duplicatesFound === true
 * - Resolution: Manual deletion of duplicate profiles via Convex dashboard
 */
export const acceptInvite = mutation({
  args: {
    token: v.string(),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Verify authenticated identity matches the claimed clerkId
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized: Authentication required');
    }
    if (identity.subject !== args.clerkId) {
      throw new Error('Unauthorized: Clerk identity mismatch');
    }

    // 1. Find the invite by token
    const invite = await ctx.db
      .query('studentInvites')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .first();

    if (!invite) {
      throw new Error('Invalid invite token');
    }

    // 2. Validate invite status
    if (invite.status !== 'pending') {
      throw new Error(`Invite is ${invite.status}. Only pending invites can be accepted.`);
    }

    // 3. Check if invite has expired
    if (invite.expires_at < now) {
      // Auto-expire the invite (best effort - don't block user if patch fails)
      try {
        await ctx.db.patch(invite._id, {
          status: 'expired',
          updated_at: now,
        });
      } catch (patchError) {
        // Log error but don't block the user from seeing the expired error
        console.error('Failed to auto-expire invite:', patchError);
        console.error('Invite ID:', invite._id);
      }
      throw new Error('Invite has expired');
    }

    // 4. Get the accepting user
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    // 5. Verify email matches (optional security check)
    // Note: invite.email is normalized to lowercase during creation, so we lowercase user.email for comparison
    if (!user.email || user.email.toLowerCase() !== invite.email) {
      throw new Error('Email mismatch. This invite was sent to a different email address.');
    }

    // 6. Get university details
    const university = await ctx.db.get(invite.university_id);
    if (!university) {
      throw new Error('University not found');
    }

    // 6a. Check university license capacity
    // Enforce license limits before accepting invite
    // NOTE: This initial check is not atomic with the increment (step 11), so concurrent
    // acceptances could pass this check simultaneously. However, optimistic concurrency
    // control (step 12) detects over-capacity after increment and rolls back changes.
    // This two-phase approach balances performance with strict capacity enforcement.
    const currentUsage = university.license_used || 0;
    const licenseLimit = university.license_seats;

    if (currentUsage >= licenseLimit) {
      throw new Error(
        `University has reached maximum capacity (${licenseLimit} licenses). ` +
          `Contact your university administrator to increase capacity.`,
      );
    }

    // Also check if university license is active
    if (university.status !== 'active') {
      throw new Error(
        `University license is ${university.status}. ` +
          `Contact your university administrator to resolve this issue.`,
      );
    }

    // Check if license has expired
    if (university.license_end && university.license_end < now) {
      throw new Error(
        `University license has expired. ` + `Contact your university administrator to renew.`,
      );
    }

    // 6b. Check for conflicting membership BEFORE creating profile to avoid partial state
    const existingMembership = await ctx.db
      .query('memberships')
      .withIndex('by_user_role', (q) => q.eq('user_id', user._id).eq('role', 'student'))
      .first();

    if (existingMembership && existingMembership.university_id !== invite.university_id) {
      throw new Error('Student membership belongs to a different university');
    }

    // 7. Check if user already has a student profile (race condition check)
    const existingProfile = await ctx.db
      .query('studentProfiles')
      .withIndex('by_user_id', (q) => q.eq('user_id', user._id))
      .first();

    if (existingProfile) {
      throw new Error('User already has a student profile');
    }

    // 8. Create student profile FIRST (before updating user role)
    // CRITICAL: This ordering prevents orphaned "student" users without profiles
    // If profile creation fails, user role remains unchanged (data integrity preserved)
    // Orphaned profiles (without student role) are easier to clean up than orphaned students

    // Store original user state for potential rollback (step 12)
    const originalUserState = {
      role: user.role,
      university_id: user.university_id,
      subscription_plan: user.subscription_plan,
      subscription_status: user.subscription_status,
    };

    // Re-check for existing profile immediately before insert to minimize race window
    const raceCheckProfile = await ctx.db
      .query('studentProfiles')
      .withIndex('by_user_id', (q) => q.eq('user_id', user._id))
      .first();

    let studentProfileId;

    if (raceCheckProfile) {
      // Profile was created by concurrent request - this is OK, use existing
      console.warn(
        `Race condition detected: studentProfile already exists for user ${maskId(user._id)}`,
      );
      studentProfileId = raceCheckProfile._id;
    } else {
      // Safe to create profile
      try {
        const metadata = invite.metadata || {};

        // Validate year if provided in metadata
        if (metadata.year && !(VALID_YEARS as readonly string[]).includes(metadata.year)) {
          throw new Error(
            `Invalid year in invite metadata: "${metadata.year}". Must be one of: ${VALID_YEARS.join(', ')}`,
          );
        }

        studentProfileId = await ctx.db.insert('studentProfiles', {
          user_id: user._id,
          university_id: invite.university_id,
          student_id: metadata.student_id,
          major: metadata.major,
          year: metadata.year,
          enrollment_date: now,
          status: 'active',
          created_at: now,
          updated_at: now,
        });
      } catch (error) {
        // If insert fails due to concurrent creation, fetch the existing profile
        const fallbackProfile = await ctx.db
          .query('studentProfiles')
          .withIndex('by_user_id', (q) => q.eq('user_id', user._id))
          .first();

        if (fallbackProfile) {
          console.warn(
            `Insert failed but profile exists - likely race condition for user ${maskEmail(user.email)}`,
          );
          studentProfileId = fallbackProfile._id;
        } else {
          // Genuine error - cannot proceed without profile
          // User role remains unchanged, maintaining invariant: all students have profiles
          throw new Error(`Failed to create student profile: ${error}`);
        }
      }
    }

    // 9. Re-verify invite is still pending before any state changes
    const currentInvite = await ctx.db.get(invite._id);

    if (!currentInvite) {
      throw new Error('Invite was deleted');
    }

    if (currentInvite.status !== 'pending') {
      throw new Error(
        `Invite was already ${currentInvite.status}. It may have been accepted by another user.`,
      );
    }

    // 10. Update user role AFTER successful profile creation
    // This ensures we NEVER have a student role without a valid profile (requireStudent invariant)
    await ctx.db.patch(user._id, {
      role: 'student',
      university_id: invite.university_id,
      subscription_plan: 'university',
      subscription_status: 'active',
      updated_at: now,
    });

    // 10a. Ensure membership record exists for this student
    if (!existingMembership) {
      await ctx.db.insert('memberships', {
        user_id: user._id,
        university_id: invite.university_id,
        role: 'student',
        status: 'active',
        created_at: now,
        updated_at: now,
      });
    } else if (existingMembership.status !== 'active') {
      await ctx.db.patch(existingMembership._id, {
        status: 'active',
        updated_at: now,
      });
    }

    // 11. Increment university license usage
    const latestUniversity = await ctx.db.get(university._id);
    if (!latestUniversity) {
      throw new Error('University not found during license update');
    }

    await ctx.db.patch(university._id, {
      license_used: (latestUniversity.license_used || 0) + 1,
      updated_at: now,
    });

    // 12. Optimistic concurrency control: verify we didn't exceed capacity
    // This handles race conditions where multiple concurrent acceptances all passed
    // the initial capacity check (step 6a) before any increments occurred
    const updatedUniversity = await ctx.db.get(university._id);
    if (updatedUniversity && updatedUniversity.license_used > updatedUniversity.license_seats) {
      // Over-capacity detected - rollback all changes using helper function
      const rollbackResult = await rollbackInviteAcceptance(ctx, {
        userId: user._id,
        studentProfileId,
        inviteId: invite._id,
        universityId: university._id,
        originalUserState,
        context: {
          userEmail: user.email,
          universityName: updatedUniversity.name,
          currentUsage: updatedUniversity.license_used,
          capacity: updatedUniversity.license_seats,
        },
      });

      // If rollback failed, log critical error for monitoring/alerting
      if (!rollbackResult.success) {
        console.error(
          `[CRITICAL] Rollback failed for user ${maskEmail(user.email)} (${maskId(user._id)}). ` +
            `Manual intervention required. Errors: ${rollbackResult.errors.join('; ')}`,
        );
      }

      throw new Error(
        `University has reached maximum capacity (${updatedUniversity.license_seats} licenses). ` +
          `This occurred due to concurrent enrollments. Please try again in a moment, or ` +
          `contact your university administrator to increase capacity.`,
      );
    }

    // 13. Mark invite as accepted (after capacity verification)
    await ctx.db.patch(invite._id, {
      status: 'accepted',
      accepted_at: now,
      accepted_by_user_id: user._id,
      updated_at: now,
    });

    return {
      success: true,
      universityName: university.name,
      studentProfileId,
    };
  },
});

/**
 * Get student profile for current user
 */
export const getStudentProfile = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }
    if (identity.subject !== args.clerkId) {
      throw new Error('Unauthorized: Can only view own profile');
    }

    // Get user
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      return null;
    }

    // Get student profile
    const studentProfile = await ctx.db
      .query('studentProfiles')
      .withIndex('by_user_id', (q) => q.eq('user_id', user._id))
      .first();

    if (!studentProfile) {
      return null;
    }

    // Get university
    const university = await ctx.db.get(studentProfile.university_id);

    return {
      ...studentProfile,
      university: university
        ? {
            name: university.name,
            slug: university.slug,
          }
        : null,
    };
  },
});

/**
 * Validate an invite token without accepting it
 * Useful for showing invite details before acceptance
 */
export const validateInviteToken = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const invite = await ctx.db
      .query('studentInvites')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .first();

    if (!invite) {
      return { valid: false, reason: 'Invalid token' };
    }

    if (invite.status !== 'pending') {
      return { valid: false, reason: `Invite is ${invite.status}` };
    }

    if (invite.expires_at < now) {
      // Note: We don't auto-expire here since this is a query (read-only).
      // The cron job (expireOldInvites) handles batch expiration hourly.
      // Auto-expiration also happens in acceptInvite mutation when actually accepting.
      return { valid: false, reason: 'Invite has expired' };
    }

    // Get university
    const university = await ctx.db.get(invite.university_id);

    return {
      valid: true,
      email: invite.email,
      universityName: university?.name ?? 'Unknown University',
      expiresAt: invite.expires_at,
    };
  },
});

/**
 * Check for accepted invites with multiple users (for monitoring/debugging)
 * Detects if a single invite was somehow accepted by multiple users
 *
 * NOTE: Due to lack of unique constraints, race conditions could theoretically
 * allow multiple acceptances of the same invite. This query helps detect such cases.
 */
export const findDuplicateInviteAcceptances = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }
    const caller = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();
    if (!caller || caller.role !== 'super_admin') {
      throw new Error('Unauthorized: Super admin access required');
    }

    // Get all accepted invites
    const acceptedInvites = await ctx.db
      .query('studentInvites')
      .withIndex('by_status', (q) => q.eq('status', 'accepted'))
      .collect();

    // Check for any "accepted" invites without an accepted_by_user_id (data integrity issue)
    const orphanedAcceptances = acceptedInvites.filter((inv) => !inv.accepted_by_user_id);

    // Note: We can't detect if multiple different invites were created for the same email
    // and all accepted (that's a different issue). This checks for data integrity.

    return {
      orphanedAcceptancesFound: orphanedAcceptances.length > 0,
      orphanedCount: orphanedAcceptances.length,
      orphanedInvites: orphanedAcceptances.map((inv) => ({
        inviteId: inv._id,
        email: inv.email,
        // Note: token intentionally omitted - security sensitive
        universityId: inv.university_id,
        acceptedAt: inv.accepted_at,
      })),
    };
  },
});

/**
 * Check for duplicate student profiles (for monitoring/debugging)
 * Returns users with multiple studentProfile records
 *
 * NOTE: Due to Convex's lack of unique constraints, duplicates are theoretically
 * possible via race conditions. This query helps detect and clean them up.
 *
 * PERFORMANCE NOTES:
 * - Current approach: Loads all profiles into memory (acceptable for <10,000 profiles)
 * - For large scale (10,000+ students), consider:
 *   1. Adding pagination/batching
 *   2. Batch-fetching user details instead of line-by-line lookups
 *   3. Running as scheduled background job with incremental processing
 * - As of now, this is a diagnostic query run manually or via daily cron
 *
 * USAGE:
 * 1. Run periodically: npx convex run students:findDuplicateProfiles
 * 2. If duplicates found, identify which profile to keep (usually oldest: lowest createdAt)
 * 3. Delete duplicate profiles manually via Convex dashboard or cleanup mutation
 * 4. Verify: Re-run query to confirm duplicates removed
 *
 * CLEANUP INSTRUCTIONS (if duplicates found):
 * For each duplicate user:
 * 1. Sort profiles by createdAt (ascending)
 * 2. Keep the FIRST profile (oldest, likely the "real" one)
 * 3. Delete all other profiles: await ctx.db.delete(duplicateProfileId)
 * 4. Verify student can still access their account and see university badge
 */
export const findDuplicateProfiles = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }
    const caller = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();
    if (!caller || caller.role !== 'super_admin') {
      throw new Error('Unauthorized: Super admin access required');
    }

    // PERFORMANCE CRITICAL: Loads all profiles into memory
    // Convex query limits: 1-second execution, 64 MiB memory
    // Current approach risks timeout at ~3,000-5,000 profiles depending on data size
    //
    // MIGRATION PRIORITY (Phase 2 - before 2,000 profiles):
    // See detectOrphanedProfiles for reference implementation of paginated internalMutation.
    //
    // Migration steps:
    // 1. Convert to internalMutation (removes 1-second query limit)
    // 2. Add cursor-based pagination (see detectOrphanedProfiles pattern)
    // 3. Store results in diagnostics table for async retrieval
    // 4. Set up scheduled nightly runs instead of on-demand
    //
    // Priority order for diagnostic query migrations:
    // - Phase 1 (NOW): detectOrphanedProfiles ✅ Already migrated to internalMutation
    // - Phase 2 (before 2,000 profiles): findDuplicateProfiles, findStudentsAtInactiveUniversities
    // - Phase 3 (before 2,500 invites): detectDuplicateInvites
    //
    // Monitor: Convex dashboard function execution time
    // Hard limit: 1 second (query will fail if exceeded)
    const allProfiles = await ctx.db.query('studentProfiles').collect();

    // Early warning: Log if approaching realistic scale limits
    if (allProfiles.length > 2500) {
      console.warn(
        `[SCALE WARNING] findDuplicateProfiles processing ${allProfiles.length} profiles. ` +
          `Approaching 1-second query limit. MIGRATION TO BACKGROUND JOB REQUIRED SOON.`,
      );
    }

    // Group by user_id
    type ProfileType = (typeof allProfiles)[number];
    const profilesByUser = new Map<string, ProfileType[]>();

    for (const profile of allProfiles) {
      const userId = profile.user_id.toString();
      if (!profilesByUser.has(userId)) {
        profilesByUser.set(userId, []);
      }
      profilesByUser.get(userId)!.push(profile);
    }

    // Find users with multiple profiles and collect user IDs for batch fetch
    const usersWithDuplicates: { userIdStr: string; profiles: Doc<'studentProfiles'>[] }[] = [];
    const userIdsToFetch: Id<'users'>[] = [];

    profilesByUser.forEach((profiles, userIdStr) => {
      if (profiles.length > 1) {
        usersWithDuplicates.push({ userIdStr, profiles });
        userIdsToFetch.push(profiles[0].user_id);
      }
    });

    // Fetch user data for affected users
    // NOTE: This still uses sequential N+1 calls (Convex doesn't provide batch get() API).
    // Pre-fetching here provides no performance benefit over inline fetching, but makes
    // the code slightly cleaner by separating data fetching from processing logic.
    // For 10k+ profiles, consider pagination or batch processing if Convex adds batch APIs.
    const userMap = new Map<string, any>();
    for (const userId of userIdsToFetch) {
      const user = await ctx.db.get(userId);
      if (user) {
        userMap.set(userId.toString(), user);
      }
    }

    // Build duplicate results using pre-fetched user data
    const duplicates = [];
    for (const { userIdStr, profiles } of usersWithDuplicates) {
      const user = userMap.get(userIdStr);

      // Sort profiles by created_at to identify oldest (keep) vs newest (delete)
      const sortedProfiles = [...profiles].sort((a, b) => a.created_at - b.created_at);

      duplicates.push({
        userId: userIdStr,
        email: user?.email || 'unknown',
        name: user?.name || 'unknown',
        profileCount: profiles.length,
        // First profile is the one to KEEP
        profileToKeep: {
          id: sortedProfiles[0]._id,
          universityId: sortedProfiles[0].university_id,
          createdAt: sortedProfiles[0].created_at,
          createdAtDate: new Date(sortedProfiles[0].created_at).toISOString(),
        },
        // Remaining profiles should be DELETED
        profilesToDelete: sortedProfiles.slice(1).map((p) => ({
          id: p._id,
          universityId: p.university_id,
          createdAt: p.created_at,
          createdAtDate: new Date(p.created_at).toISOString(),
        })),
      });
    }

    return {
      duplicatesFound: duplicates.length > 0,
      count: duplicates.length,
      duplicates,
      cleanupInstructions:
        duplicates.length > 0
          ? 'Run students:cleanupDuplicateProfiles with userId for each affected user to automatically clean up duplicates'
          : null,
    };
  },
});

/**
 * Automated cleanup for duplicate student profiles
 *
 * This mutation safely removes duplicate profiles for a specific user, keeping only the oldest.
 * Use this after detecting duplicates via findDuplicateProfiles query.
 *
 * Safety features:
 * - Only deletes duplicates (keeps oldest profile by created_at)
 * - Returns detailed report of deletions
 * - Idempotent (safe to run multiple times)
 *
 * Usage:
 * npx convex run students:cleanupDuplicateProfiles --userId "user-id-here"
 *
 * IMPORTANT: Run findDuplicateProfiles first to identify which users need cleanup
 */
export const cleanupDuplicateProfiles = internalMutation({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    // Get all profiles for this user
    const profiles = await ctx.db
      .query('studentProfiles')
      .withIndex('by_user_id', (q) => q.eq('user_id', args.userId))
      .collect();

    // Sort by created_at to ensure we keep the oldest profile
    profiles.sort((a, b) => a.created_at - b.created_at);

    // No duplicates - nothing to do
    if (profiles.length <= 1) {
      return {
        success: true,
        userId: args.userId,
        profilesFound: profiles.length,
        profilesDeleted: 0,
        profileKept: profiles.length === 1 ? profiles[0]._id : null,
        message:
          profiles.length === 0
            ? 'No profiles found for this user'
            : 'User has only one profile - no cleanup needed',
      };
    }

    // Get user details for logging
    const user = await ctx.db.get(args.userId);

    console.log(
      `🧹 Cleaning up duplicate profiles for user ${args.userId}: ` +
        `${profiles.length} profiles found`,
    );

    // Keep the oldest (first) profile, delete the rest
    const profileToKeep = profiles[0];
    const profilesToDelete = profiles.slice(1);

    // Delete duplicate profiles
    for (const profile of profilesToDelete) {
      console.log(
        `  🗑️  Deleting duplicate profile ${profile._id} (created: ${new Date(profile.created_at).toISOString()})`,
      );
      await ctx.db.delete(profile._id);
    }

    console.log(
      `  ✅ Kept oldest profile ${profileToKeep._id} (created: ${new Date(profileToKeep.created_at).toISOString()})`,
    );

    return {
      success: true,
      userId: args.userId,
      userEmail: user?.email || 'unknown',
      profilesFound: profiles.length,
      profilesDeleted: profilesToDelete.length,
      profileKept: profileToKeep._id,
      deletedProfiles: profilesToDelete.map((p) => ({
        id: p._id,
        createdAt: p.created_at,
        universityId: p.university_id,
      })),
      message: `Successfully cleaned up ${profilesToDelete.length} duplicate profile(s)`,
    };
  },
});

/**
 * Scheduled monitoring for duplicate student profiles
 *
 * This internal mutation runs daily via cron job to detect race condition duplicates.
 * It alerts via console logs and provides cleanup instructions.
 *
 * Called by: convex/crons.ts daily job
 *
 * Actions:
 * - Detects duplicate profiles
 * - Logs detailed error reports
 * - Returns alert data for monitoring systems
 *
 * Response to alerts:
 * 1. Check Convex logs for full duplicate report
 * 2. For each affected user, run: npx convex run students:cleanupDuplicateProfiles --userId "user-id"
 * 3. Investigate root cause if duplicates are frequent
 */
export const monitorDuplicateProfiles = internalMutation({
  args: {},
  handler: async (ctx) => {
    // PERFORMANCE: Loads all profiles into memory
    // Internal mutation limits: 5-minute execution, 512 MiB memory
    // More headroom than queries, but still monitor performance
    // Safe up to ~20,000-30,000 profiles, but pagination recommended beyond 10k
    const allProfiles = await ctx.db.query('studentProfiles').collect();

    // Early warning if approaching reasonable scale limits
    if (allProfiles.length > 8000) {
      console.warn(
        `[SCALE WARNING] monitorDuplicateProfiles processing ${allProfiles.length} profiles. ` +
          `Consider migration to incremental processing for datasets >10k.`,
      );
    }

    // Group by user_id
    type ProfileType = (typeof allProfiles)[number];
    const profilesByUser = new Map<string, ProfileType[]>();

    for (const profile of allProfiles) {
      const userId = profile.user_id.toString();
      if (!profilesByUser.has(userId)) {
        profilesByUser.set(userId, []);
      }
      profilesByUser.get(userId)!.push(profile);
    }

    // Find users with multiple profiles
    const duplicates = [];
    for (const [userIdStr, profiles] of Array.from(profilesByUser.entries())) {
      if (profiles.length > 1) {
        const user = await ctx.db.get(profiles[0].user_id);
        const sortedProfiles = [...profiles].sort((a, b) => a.created_at - b.created_at);

        duplicates.push({
          userId: userIdStr,
          email: user?.email || 'unknown',
          profileCount: profiles.length,
          oldestProfile: sortedProfiles[0]._id,
          newerProfiles: sortedProfiles.slice(1).map((p) => p._id),
        });
      }
    }

    // Alert if duplicates found
    if (duplicates.length > 0) {
      console.error('🚨 ALERT: Duplicate student profiles detected!');
      console.error(`Total affected users: ${duplicates.length}`);
      console.error('\nAffected users:');

      for (const dup of duplicates) {
        console.error(`  - User ${dup.userId}: ${dup.profileCount} profiles`);
        console.error(`    Keep: ${dup.oldestProfile}`);
        console.error(`    Delete: ${dup.newerProfiles.join(', ')}`);
      }

      console.error('\n🔧 Cleanup command:');
      console.error('For each user, run:');
      for (const dup of duplicates) {
        console.error(
          `  npx convex run students:cleanupDuplicateProfiles --userId "${dup.userId}"`,
        );
      }
    } else {
      console.log('✅ Monitoring check: No duplicate student profiles found');
    }

    return {
      timestamp: Date.now(),
      duplicatesFound: duplicates.length > 0,
      affectedUserCount: duplicates.length,
      duplicates,
    };
  },
});

/**
 * Get invites created by a specific admin (for admin dashboard)
 *
 * Uses the by_created_by index for efficient lookups.
 * Useful for "My Invites" view in university admin panel.
 *
 * Args:
 * - createdByClerkId: Clerk ID of the admin who created the invites
 * - limit: Maximum number of invites to return (default: 50)
 *
 * Returns: Array of invites with student email, status, and expiration info
 */
export const getMyInvites = query({
  args: {
    createdByClerkId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }
    if (identity.subject !== args.createdByClerkId) {
      throw new Error('Unauthorized: Can only view your own invites');
    }

    // Get the admin user
    const admin = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.createdByClerkId))
      .unique();

    if (!admin) {
      throw new Error('Admin user not found');
    }

    // Query invites created by this admin using the by_created_by index
    const invites = await ctx.db
      .query('studentInvites')
      .withIndex('by_created_by', (q) => q.eq('created_by_id', admin._id))
      .order('desc')
      .take(args.limit ?? 50);

    // Get university names for each invite
    const invitesWithDetails = await Promise.all(
      invites.map(async (invite) => {
        const university = await ctx.db.get(invite.university_id);
        return {
          inviteId: invite._id,
          email: invite.email,
          status: invite.status,
          universityName: university?.name ?? 'Unknown',
          expiresAt: invite.expires_at,
          createdAt: invite.created_at,
          acceptedAt: invite.accepted_at,
          isExpired: invite.expires_at < Date.now(),
        };
      }),
    );

    return invitesWithDetails;
  },
});

/**
 * Auto-expire old student invites (cron job)
 *
 * This internal mutation is called hourly by the cron job to mark expired invites.
 * Uses the by_expires_at index for efficient queries.
 *
 * Actions:
 * 1. Find all pending invites where expires_at < now
 * 2. Update their status to "expired"
 * 3. Log count for monitoring
 *
 * Called by: convex/crons.ts (hourly cron job)
 */
export const expireOldInvites = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Query for expired pending invites using the by_expires_at index
    // Note: We still need to filter by status since the index only includes expires_at
    const expiredInvites = await ctx.db
      .query('studentInvites')
      .withIndex('by_expires_at')
      .filter((q) => q.and(q.lt(q.field('expires_at'), now), q.eq(q.field('status'), 'pending')))
      .collect();

    // Update each expired invite to "expired" status
    let expiredCount = 0;
    for (const invite of expiredInvites) {
      await ctx.db.patch(invite._id, {
        status: 'expired',
        updated_at: now,
      });
      expiredCount++;
    }

    if (expiredCount > 0) {
      console.log(`✅ Expired ${expiredCount} old student invite(s)`);
    }

    return {
      timestamp: now,
      expiredCount,
      expiredInvites: expiredInvites.map((inv) => ({
        inviteId: inv._id,
        email: inv.email,
        expiresAt: inv.expires_at,
      })),
    };
  },
});

/**
 * Find students at inactive universities (post-migration review)
 *
 * After running the backfill migration, this query helps identify students
 * whose universities are no longer active. Admins can review these users and decide:
 * - Keep as student if university will be reactivated
 * - Change to "individual" role if permanently leaving university
 * - Suspend or remove if no longer valid
 *
 * USAGE:
 * npx convex run students:findStudentsAtInactiveUniversities
 *
 * ACTIONS:
 * For each student, decide:
 * 1. Keep: If university is temporarily inactive (trial ended, payment lapsed)
 * 2. Convert to individual: If student no longer affiliated with university
 * 3. Suspend: If student account should be frozen
 */
export const findStudentsAtInactiveUniversities = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }
    const caller = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();
    if (!caller || caller.role !== 'super_admin') {
      throw new Error('Unauthorized: Super admin access required');
    }

    // PERFORMANCE CRITICAL: Loads all profiles into memory
    // Convex query limits: 1-second execution, 64 MiB memory
    // Risks timeout at ~3,000-5,000 profiles depending on data size
    //
    // MIGRATION PRIORITY: Phase 2 (before 2,000 profiles)
    // See findDuplicateProfiles for full migration plan and priority order.
    const allProfiles = await ctx.db.query('studentProfiles').collect();

    // Early warning if approaching 1-second query limit
    if (allProfiles.length > 2500) {
      console.warn(
        `[SCALE WARNING] findStudentsAtInactiveUniversities processing ${allProfiles.length} profiles. ` +
          `Approaching 1-second query limit. Pagination required soon. See findDuplicateProfiles for migration plan.`,
      );
    }

    // Get all inactive universities
    const inactiveUniversities = await ctx.db
      .query('universities')
      .filter((q) => q.neq(q.field('status'), 'active'))
      .collect();

    const inactiveUniversityIds = new Set(inactiveUniversities.map((u) => u._id));

    // Find student profiles at inactive universities
    const studentsAtInactive = [];
    for (const profile of allProfiles) {
      if (inactiveUniversityIds.has(profile.university_id)) {
        const user = await ctx.db.get(profile.user_id);
        const university = await ctx.db.get(profile.university_id);

        if (user && university) {
          studentsAtInactive.push({
            userId: user._id,
            userEmail: user.email,
            userName: user.name,
            userRole: user.role,
            profileId: profile._id,
            profileStatus: profile.status,
            universityId: university._id,
            universityName: university.name,
            universityStatus: university.status,
            enrollmentDate: profile.enrollment_date,
            enrollmentDateFormatted: new Date(profile.enrollment_date).toISOString(),
          });
        }
      }
    }

    // Group by university for easier review
    const byUniversity = new Map<string, typeof studentsAtInactive>();
    for (const student of studentsAtInactive) {
      const key = student.universityId;
      if (!byUniversity.has(key)) {
        byUniversity.set(key, []);
      }
      byUniversity.get(key)!.push(student);
    }

    const summary = Array.from(byUniversity.entries()).map(([universityId, students]) => ({
      universityId,
      universityName: students[0].universityName,
      universityStatus: students[0].universityStatus,
      studentCount: students.length,
      students: students.map((s) => ({
        userId: s.userId,
        email: s.userEmail,
        name: s.userName,
        role: s.userRole,
        profileStatus: s.profileStatus,
        enrollmentDate: s.enrollmentDateFormatted,
      })),
    }));

    return {
      studentsFound: studentsAtInactive.length > 0,
      totalStudents: studentsAtInactive.length,
      inactiveUniversityCount: inactiveUniversities.length,
      summary,
      recommendations:
        studentsAtInactive.length > 0
          ? 'Review each university and decide whether to reactivate, convert students to individual accounts, or suspend them.'
          : null,
    };
  },
});

/**
 * Detect orphaned student profiles (for monitoring/recovery)
 *
 * Identifies mismatched states that can occur if rollback operations fail:
 * 1. Student profiles where user.role !== "student"
 * 2. Users with role="student" but no student profile
 * 3. Invites marked "accepted" but user is not a student
 *
 * This query helps detect and recover from partial rollback failures.
 *
 * ⚠️ MIGRATION PRIORITY: HIGH - This query should be migrated FIRST among diagnostics.
 * It loads BOTH studentProfiles AND users tables into memory, making it the highest
 * timeout risk. Expected to fail at ~2,000-3,000 profiles.
 *
 * RECOMMENDED MIGRATION PATH:
 * 1. Convert to internalMutation (5-minute limit instead of 1 second)
 * 2. Process in batches with cursor pagination
 * 3. Store results in a diagnostics table
 * 4. Run on schedule (e.g., nightly) rather than on-demand
 * 5. Alert on anomalies instead of full scans
 *
 * USAGE:
 * npx convex run students:detectOrphanedProfiles
 *
 * CLEANUP:
 * For each orphaned state, manually decide whether to:
 * - Delete the orphaned profile
 * - Update the user role to match the profile
 * - Reset the invite to pending
 */
export const detectOrphanedProfiles = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Internal mutation - invoked via cron/admin flows; no auth check here.

    // Paginate users to avoid loading entire table
    const userMap = new Map<string, any>();
    const studentUsers: any[] = [];
    let userCursor: string | null = null;
    let usersDone = false;
    while (!usersDone) {
      const page = await ctx.db
        .query('users')
        .order('asc')
        .paginate({ cursor: userCursor, numItems: 500 });

      for (const u of page.page) {
        if (!u) continue;
        userMap.set(u._id.toString(), u);
        if (u.role === 'student') studentUsers.push(u);
      }

      userCursor = page.continueCursor;
      usersDone = page.isDone;
    }

    const orphanedStates = [];
    const profileUserIds = new Set<string>();

    // Check 1: Student profiles where user.role !== "student"
    let profileCursor: string | null = null;
    let profilesDone = false;
    while (!profilesDone) {
      const page = await ctx.db
        .query('studentProfiles')
        .order('asc')
        .paginate({ cursor: profileCursor, numItems: 500 });

      for (const profile of page.page) {
        profileUserIds.add(profile.user_id.toString());
        const user = userMap.get(profile.user_id.toString());
        if (!user) {
          orphanedStates.push({
            type: 'profile_without_user',
            profileId: profile._id,
            userId: profile.user_id,
            universityId: profile.university_id,
            issue: 'Student profile exists but user not found',
            recommendation: `Delete profile: ctx.db.delete("${profile._id}")`,
          });
        } else if (user.role !== 'student') {
          orphanedStates.push({
            type: 'profile_role_mismatch',
            profileId: profile._id,
            userId: user._id,
            userEmail: user.email,
            userRole: user.role,
            universityId: profile.university_id,
            issue: `User has role "${user.role}" but student profile exists`,
            recommendation:
              user.university_id === profile.university_id
                ? `Update user role to "student" OR delete profile`
                : `Delete profile (user not at this university)`,
          });
        }
      }

      profileCursor = page.continueCursor;
      profilesDone = page.isDone;
    }

    // Check 2: Users with role="student" but no student profile
    for (const user of studentUsers) {
      if (!profileUserIds.has(user._id.toString())) {
        orphanedStates.push({
          type: 'student_without_profile',
          userId: user._id,
          userEmail: user.email,
          universityId: user.university_id,
          issue: `User has role "student" but no student profile`,
          recommendation: user.university_id
            ? `Create student profile OR change user role to "individual"`
            : `Change user role to "individual" (no university)`,
        });
      }
    }

    // Check 3: Invites marked "accepted" but user is not a student
    const acceptedInvites = await ctx.db
      .query('studentInvites')
      .withIndex('by_status', (q) => q.eq('status', 'accepted'))
      .collect();

    for (const invite of acceptedInvites) {
      if (invite.accepted_by_user_id) {
        const user = await ctx.db.get(invite.accepted_by_user_id);
        if (!user) {
          orphanedStates.push({
            type: 'accepted_invite_user_deleted',
            inviteId: invite._id,
            email: invite.email,
            acceptedByUserId: invite.accepted_by_user_id,
            issue: 'Invite marked accepted but user not found',
            recommendation: `Reset invite to pending OR mark as revoked`,
          });
        } else if (user.role !== 'student' || user.university_id !== invite.university_id) {
          orphanedStates.push({
            type: 'accepted_invite_role_mismatch',
            inviteId: invite._id,
            email: invite.email,
            userId: user._id,
            userRole: user.role,
            userUniversityId: user.university_id,
            inviteUniversityId: invite.university_id,
            issue: `Invite marked accepted but user not a student at this university`,
            recommendation: `Reset invite to pending OR fix user state`,
          });
        }
      }
    }

    return {
      orphanedStatesFound: orphanedStates.length > 0,
      count: orphanedStates.length,
      orphanedStates,
      summary: {
        profilesWithoutUser: orphanedStates.filter((s) => s.type === 'profile_without_user').length,
        profileRoleMismatches: orphanedStates.filter((s) => s.type === 'profile_role_mismatch')
          .length,
        studentsWithoutProfile: orphanedStates.filter((s) => s.type === 'student_without_profile')
          .length,
        acceptedInviteUserDeleted: orphanedStates.filter(
          (s) => s.type === 'accepted_invite_user_deleted',
        ).length,
        acceptedInviteRoleMismatch: orphanedStates.filter(
          (s) => s.type === 'accepted_invite_role_mismatch',
        ).length,
      },
    };
  },
});

/**
 * Detect duplicate pending invites (monitoring/diagnostics)
 *
 * Identifies cases where multiple pending invites exist for the same (email, university) pair.
 * This should not happen with the optimistic concurrency control in createInviteInternal,
 * but this query helps detect any that existed before the fix was deployed.
 *
 * USAGE:
 * npx convex run students:detectDuplicateInvites
 *
 * CLEANUP:
 * For each duplicate, keep the oldest invite and delete the rest manually:
 * await ctx.db.delete(duplicateInviteId)
 */
export const detectDuplicateInvites = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }
    const caller = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();
    if (!caller || caller.role !== 'super_admin') {
      throw new Error('Unauthorized: Super admin access required');
    }

    // PERFORMANCE CRITICAL: Loads all pending invites into memory
    // Convex query limits: 1-second execution, 64 MiB memory
    // Risks timeout at ~3,000-5,000 pending invites depending on invite data size
    //
    // MIGRATION PRIORITY: Phase 3 (before 2,500 pending invites)
    // See findDuplicateProfiles for full migration plan and priority order.
    const allPendingInvites = await ctx.db
      .query('studentInvites')
      .withIndex('by_status', (q) => q.eq('status', 'pending'))
      .collect();

    // Early warning if approaching 1-second query limit
    if (allPendingInvites.length > 2500) {
      console.warn(
        `[SCALE WARNING] detectDuplicateInvites processing ${allPendingInvites.length} pending invites. ` +
          `Approaching 1-second query limit. Pagination required soon. See findDuplicateProfiles for migration plan.`,
      );
    }

    // Group by (university_id, email) pair
    type InviteType = (typeof allPendingInvites)[number];
    const invitesByKey = new Map<string, InviteType[]>();

    for (const invite of allPendingInvites) {
      const key = `${invite.university_id}:${invite.email}`;
      if (!invitesByKey.has(key)) {
        invitesByKey.set(key, []);
      }
      invitesByKey.get(key)!.push(invite);
    }

    // Find (university, email) pairs with multiple pending invites
    const duplicates = [];
    for (const [key, invites] of Array.from(invitesByKey.entries())) {
      if (invites.length > 1) {
        const colonIndex = key.indexOf(':');
        const universityId = key.substring(0, colonIndex);
        const email = key.substring(colonIndex + 1);
        const university = await ctx.db.get(universityId as Id<'universities'>);

        // Sort by created_at to identify oldest (keep) vs newest (delete)
        const sortedInvites = [...invites].sort((a, b) => a.created_at - b.created_at);

        duplicates.push({
          universityId,
          universityName: university?.name || 'Unknown',
          email,
          inviteCount: invites.length,
          // First invite is the one to KEEP
          inviteToKeep: {
            id: sortedInvites[0]._id,
            // Note: token intentionally omitted - security sensitive
            createdAt: sortedInvites[0].created_at,
            createdAtDate: new Date(sortedInvites[0].created_at).toISOString(),
            expiresAt: sortedInvites[0].expires_at,
          },
          // Remaining invites should be DELETED
          invitesToDelete: sortedInvites.slice(1).map((inv) => ({
            id: inv._id,
            // Note: token intentionally omitted - security sensitive
            createdAt: inv.created_at,
            createdAtDate: new Date(inv.created_at).toISOString(),
            expiresAt: inv.expires_at,
          })),
        });
      }
    }

    return {
      duplicatesFound: duplicates.length > 0,
      count: duplicates.length,
      totalPendingInvites: allPendingInvites.length,
      duplicates,
      cleanupInstructions:
        duplicates.length > 0
          ? 'For each duplicate, run: await ctx.db.delete(inviteId) for invitesToDelete entries'
          : null,
    };
  },
});

/**
 * Update student profile
 *
 * Allows students or university admins to update student profile information.
 *
 * Args:
 * - studentProfileId: ID of the student profile to update
 * - clerkId: Clerk ID of the user making the update
 * - updates: Partial profile data to update
 *
 * Authorization:
 * - Student can update their own profile
 * - University admin can update profiles at their university
 * - Super admin can update any profile
 *
 * Validation:
 * - GPA must be between 0.0 and 4.0
 * - Year must be valid value (if provided)
 * - Status changes require admin privileges
 *
 * Returns: Updated student profile
 */
export const updateStudentProfile = mutation({
  args: {
    studentProfileId: v.id('studentProfiles'),
    clerkId: v.string(),
    updates: v.object({
      student_id: v.optional(v.string()),
      major: v.optional(v.string()),
      year: v.optional(v.string()),
      gpa: v.optional(v.number()),
      graduation_date: v.optional(v.number()),
      status: v.optional(
        v.union(
          v.literal('active'),
          v.literal('inactive'),
          v.literal('graduated'),
          v.literal('suspended'),
        ),
      ),
    }),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Verify authenticated identity matches the claimed clerkId
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }
    if (identity.subject !== args.clerkId) {
      throw new Error('Unauthorized: Identity mismatch');
    }

    // Get the student profile
    const profile = await ctx.db.get(args.studentProfileId);
    if (!profile) {
      throw new Error('Student profile not found');
    }

    // Get the requesting user
    const requestingUser = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!requestingUser) {
      throw new Error('User not found');
    }

    // Authorization check
    const isOwnProfile = profile.user_id === requestingUser._id;
    const isUniversityAdmin =
      requestingUser.role === 'university_admin' &&
      requestingUser.university_id === profile.university_id;
    const isSuperAdmin = requestingUser.role === 'super_admin';

    if (!isOwnProfile && !isUniversityAdmin && !isSuperAdmin) {
      throw new Error('Unauthorized: Cannot update this student profile');
    }

    // Validate GPA if provided
    if (args.updates.gpa !== undefined) {
      validateGPA(args.updates.gpa);
    }

    // Status changes require admin privileges
    if (args.updates.status !== undefined && !isUniversityAdmin && !isSuperAdmin) {
      throw new Error('Only administrators can change student status');
    }

    // Validate year if provided
    if (
      args.updates.year !== undefined &&
      !(VALID_YEARS as readonly string[]).includes(args.updates.year)
    ) {
      throw new Error(`Invalid year. Must be one of: ${VALID_YEARS.join(', ')}`);
    }

    // Update the profile
    await ctx.db.patch(args.studentProfileId, {
      ...args.updates,
      updated_at: now,
    });

    // Return updated profile
    const updatedProfile = await ctx.db.get(args.studentProfileId);
    return updatedProfile;
  },
});

/**
 * Get follow-ups/action items assigned to the current student
 *
 * This query allows students to see action items created by their advisors.
 * Unlike the advisor query, this does NOT filter by created_by_id since
 * students should see all follow-ups assigned to them regardless of which
 * advisor created them.
 *
 * Args:
 * - clerkId: Clerk ID of the student
 *
 * Returns: Array of follow-ups with enriched data (overdue status, creator info)
 *
 * Authorization:
 * - Only students can call this query
 * - Only returns follow-ups where user_id matches the student
 * - Only returns advisor-created follow-ups (not self-created ones)
 */
export const getMyFollowUps = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify authenticated identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }
    if (identity.subject !== args.clerkId) {
      throw new Error('Unauthorized: Identity mismatch');
    }

    // Get the student user
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      return [];
    }

    // Verify user is a student (includes legacy "user" role with university_id)
    const isStudent = user.role === 'student' || (user.role === 'user' && user.university_id);
    if (!isStudent || !user.university_id) {
      return [];
    }

    const now = Date.now();

    // Get follow-ups assigned to this student that were created by advisors
    const followUps = await ctx.db
      .query('follow_ups')
      .withIndex('by_user_university', (q) =>
        q.eq('user_id', user._id).eq('university_id', user.university_id),
      )
      .filter((q) => q.eq(q.field('created_by_type'), 'advisor'))
      .collect();

    // Fetch creator info for each follow-up
    const creatorIds = [...new Set(followUps.map((f) => f.created_by_id).filter(Boolean))];
    const creatorMap = new Map<string, { name: string; role: string }>();

    for (const creatorId of creatorIds) {
      if (creatorId) {
        const creator = await ctx.db.get(creatorId);
        if (creator) {
          creatorMap.set(creatorId.toString(), {
            name: creator.name || 'Advisor',
            role: creator.role,
          });
        }
      }
    }

    // Enrich with overdue status and creator info
    const enrichedFollowUps = followUps.map((f) => ({
      ...f,
      isOverdue: f.due_at ? f.due_at < now && f.status === 'open' : false,
      creator: f.created_by_id ? creatorMap.get(f.created_by_id.toString()) : null,
    }));

    // Sort: open first, then by due date ascending
    enrichedFollowUps.sort((a, b) => {
      // Open items first
      if (a.status !== b.status) {
        return a.status === 'open' ? -1 : 1;
      }
      // Then by due date (items without due date at end)
      const aDue = a.due_at ?? Infinity;
      const bDue = b.due_at ?? Infinity;
      return aDue - bDue;
    });

    return enrichedFollowUps;
  },
});

/**
 * Mark a follow-up as complete (student action)
 *
 * Students can mark follow-ups assigned to them as complete.
 *
 * Args:
 * - clerkId: Clerk ID of the student
 * - followUpId: ID of the follow-up to mark complete
 *
 * Authorization:
 * - Only the student who owns the follow-up can mark it complete
 */
export const completeMyFollowUp = mutation({
  args: {
    clerkId: v.string(),
    followUpId: v.id('follow_ups'),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Verify authenticated identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }
    if (identity.subject !== args.clerkId) {
      throw new Error('Unauthorized: Identity mismatch');
    }

    // Get the student user
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    // Get the follow-up
    const followUp = await ctx.db.get(args.followUpId);
    if (!followUp) {
      throw new Error('Follow-up not found');
    }

    // Verify the student owns this follow-up
    if (followUp.user_id !== user._id) {
      throw new Error('Unauthorized: This follow-up does not belong to you');
    }

    // Mark as complete
    await ctx.db.patch(args.followUpId, {
      status: 'done',
      completed_at: now,
      updated_at: now,
    });

    return { success: true };
  },
});

// Re-export from students_all for backward compatibility
export * from './students_all';
