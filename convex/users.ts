import { ConvexError, v } from 'convex/values';

import { api } from './_generated/api';
import { internalMutation, mutation, MutationCtx, query } from './_generated/server';
import { ACTIVITY_EVENTS, trackActivity } from './lib/activityTracker';
import { logPermissionChange } from './lib/auditLogger';
import { isServiceRequest } from './lib/roles';
import { normalizeLegacyUserRole } from './lib/roleValidation';

// ============================================
// Shared Validators
// ============================================
// These validators are used across multiple mutations to ensure consistency
// and reduce duplication.

/** Validator for custom link objects */
const customLinkValidator = v.object({
  id: v.string(),
  title: v.string(),
  url: v.string(),
});

/** Validator for profile resume (uploaded or linked) - discriminated union */
const profileResumeValidator = v.union(
  v.object({
    id: v.string(),
    type: v.literal('upload'),
    title: v.optional(v.string()),
    storage_id: v.id('_storage'),
    file_name: v.optional(v.string()),
    uploaded_at: v.optional(v.number()),
  }),
  v.object({
    id: v.string(),
    type: v.literal('link'),
    title: v.optional(v.string()),
    url: v.string(),
  }),
);

/** Validator for profile documents (uploaded or linked) - discriminated union */
const profileDocumentValidator = v.union(
  v.object({
    id: v.string(),
    type: v.literal('upload'),
    title: v.string(),
    storage_id: v.id('_storage'),
    file_name: v.optional(v.string()),
    uploaded_at: v.optional(v.number()),
  }),
  v.object({
    id: v.string(),
    type: v.literal('link'),
    title: v.string(),
    url: v.string(),
  }),
);

/** Validator for email addresses */
const emailValidator = v.object({
  email: v.string(),
  type: v.union(v.literal('personal'), v.literal('work')),
  isPrimary: v.optional(v.boolean()),
});

/** Validator for phone numbers */
const phoneValidator = v.object({
  phone: v.string(),
  type: v.union(v.literal('mobile'), v.literal('home'), v.literal('work')),
  isPrimary: v.optional(v.boolean()),
});

/** Validator for education history entries */
const educationHistoryValidator = v.object({
  id: v.string(),
  school: v.optional(v.string()),
  degree: v.optional(v.string()),
  field_of_study: v.optional(v.string()),
  start_year: v.optional(v.string()),
  end_year: v.optional(v.string()),
  is_current: v.optional(v.boolean()),
  gpa: v.optional(v.string()),
  achievements: v.optional(v.array(v.string())),
  description: v.optional(v.string()),
});

/** Validator for work history entries */
const workHistoryValidator = v.object({
  id: v.string(),
  role: v.optional(v.string()),
  company: v.optional(v.string()),
  start_date: v.optional(v.string()),
  end_date: v.optional(v.string()),
  is_current: v.optional(v.boolean()),
  location: v.optional(v.string()),
  summary: v.optional(v.string()),
});

/** Validator for volunteer history entries */
const volunteerHistoryValidator = v.object({
  id: v.string(),
  role: v.optional(v.string()),
  organization: v.optional(v.string()),
  start_date: v.optional(v.string()),
  end_date: v.optional(v.string()),
  is_current: v.optional(v.boolean()),
  location: v.optional(v.string()),
  summary: v.optional(v.string()),
});

/** Validator for certification entries */
const certificationValidator = v.object({
  id: v.string(),
  name: v.optional(v.string()),
  issuing_organization: v.optional(v.string()),
  issue_date: v.optional(v.string()),
  expiration_date: v.optional(v.string()),
  credential_id: v.optional(v.string()),
  credential_url: v.optional(v.string()),
  does_not_expire: v.optional(v.boolean()),
});

/** Validator for achievement entries */
const achievementValidator = v.object({
  id: v.string(),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  date: v.optional(v.string()),
  organization: v.optional(v.string()),
});

/** Validator for user roles */
const roleValidator = v.union(
  v.literal('individual'),
  v.literal('user'),
  v.literal('student'),
  v.literal('staff'),
  v.literal('university_admin'),
  v.literal('advisor'),
  v.literal('super_admin'),
);

/** Validator for subscription plans */
const subscriptionPlanValidator = v.union(
  v.literal('free'),
  v.literal('premium'),
  v.literal('university'),
);

/** Validator for subscription status */
const subscriptionStatusValidator = v.union(
  v.literal('active'),
  v.literal('inactive'),
  v.literal('cancelled'),
  v.literal('past_due'),
);

/** Validator for account status */
const accountStatusValidator = v.union(
  v.literal('active'),
  v.literal('suspended'),
  v.literal('pending_activation'),
  v.literal('pending_deletion'),
  v.literal('deleted'),
);

// ============================================
// Role Constants
// ============================================

// Roles that require university_id (university-affiliated roles)
const UNIVERSITY_ROLES = ['student', 'university_admin', 'advisor', 'staff'] as const;
// Roles that must NOT have university_id (individual/platform-wide users)
// - individual/user: Regular individual users
// - super_admin: Platform-wide administrators (manage entire platform, not a specific university)
const INDIVIDUAL_ROLES = ['individual', 'user', 'super_admin'] as const;

type UniversityRole = (typeof UNIVERSITY_ROLES)[number];
type IndividualRole = (typeof INDIVIDUAL_ROLES)[number];

function isUniversityRole(role: string): role is UniversityRole {
  return UNIVERSITY_ROLES.includes(role as UniversityRole);
}

function isIndividualRole(role: string): role is IndividualRole {
  return INDIVIDUAL_ROLES.includes(role as IndividualRole);
}

/**
 * Internal helper: Log role changes to audit_logs
 * Logs changes by super_admin users and service-initiated changes (webhooks, migrations)
 * Uses the centralized audit logger with permission_change category
 * Gracefully handles errors without failing the parent operation
 */
async function logRoleChange(
  ctx: MutationCtx,
  targetUser: any,
  oldRole: string,
  newRole: string,
  isServiceInitiated: boolean = false,
) {
  try {
    const identity = await ctx.auth.getUserIdentity();

    // Handle service-initiated changes (webhooks, migrations)
    if (isServiceInitiated || !identity) {
      await logPermissionChange(ctx, {
        action: 'role.changed',
        actorType: isServiceInitiated ? 'integration' : 'system',
        actorUniversityId: targetUser.university_id,
        targetType: 'user',
        targetId: targetUser._id,
        targetUniversityId: targetUser.university_id,
        studentId: newRole === 'student' ? targetUser._id : undefined,
        previousValue: { role: oldRole, source: 'system' },
        newValue: { role: newRole, source: isServiceInitiated ? 'webhook' : 'system' },
      });
      return;
    }

    const admin = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    // Log if performed by super_admin
    if (admin && admin.role === 'super_admin') {
      await logPermissionChange(ctx, {
        action: 'role.changed',
        actorUserId: admin._id,
        actorRole: admin.role,
        actorUniversityId: admin.university_id,
        targetType: 'user',
        targetId: targetUser._id,
        targetUniversityId: targetUser.university_id,
        studentId: newRole === 'student' ? targetUser._id : undefined,
        previousValue: { role: oldRole },
        newValue: { role: newRole },
      });
    }
  } catch (auditError) {
    console.error('Failed to create role change audit log:', auditError);
    // Don't fail the update if audit logging fails
  }
}

// Get user by Clerk ID
export const getUserByClerkId = query({
  args: {
    clerkId: v.string(),
    serviceToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const isService = isServiceRequest(args.serviceToken);

    // Service token requests bypass auth checks (used by webhooks)
    if (!isService) {
      if (!identity) {
        throw new Error('Unauthorized: Not authenticated');
      }
      // For non-admin users, only allow querying own data
      if (identity.subject !== args.clerkId) {
        const actor = await ctx.db
          .query('users')
          .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
          .unique();
        if (!actor || !['super_admin', 'university_admin', 'advisor'].includes(actor.role)) {
          throw new Error('Unauthorized: Cannot query other users');
        }
        // For university_admin and advisor, verify tenant isolation
        if (actor.role !== 'super_admin') {
          const targetUser = await ctx.db
            .query('users')
            .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
            .unique();
          if (targetUser && targetUser.university_id !== actor.university_id) {
            throw new Error('Unauthorized: Cannot query users from other universities');
          }
        }
      }
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();
    return user;
  },
});

// Get user by ID (for internal lookups like dialogs)
export const getUserById = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }

    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    // Check authorization
    const requester = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!requester) {
      throw new Error('Unauthorized');
    }

    const isSelf = requester._id === user._id;
    const isSuperAdmin = requester.role === 'super_admin';
    const isUniversityStaff =
      ['university_admin', 'advisor'].includes(requester.role) &&
      requester.university_id &&
      requester.university_id === user.university_id;

    if (!isSelf && !isSuperAdmin && !isUniversityStaff) {
      throw new Error('Unauthorized: Cannot access this user');
    }

    // Return minimal info for display purposes
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  },
});

// Get user by email (useful for webhook sync verification)
export const getUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }

    // Only super admins can look up arbitrary users by email
    const requester = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!requester || requester.role !== 'super_admin') {
      throw new Error('Unauthorized');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .unique();
    return user;
  },
});

// DEPRECATED: Legacy Stripe integration - Use Clerk Billing instead
// Kept for backwards compatibility only
export const setStripeCustomer = mutation({
  args: { clerkId: v.string(), stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    // Authentication check - prevent unauthenticated access
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }

    // Only allow users to set their own Stripe customer ID
    if (identity.subject !== args.clerkId) {
      throw new Error('Unauthorized');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) throw new Error('User not found');

    await ctx.db.patch(user._id, {
      stripe_customer_id: args.stripeCustomerId,
      updated_at: Date.now(),
    });

    return user._id;
  },
});

// Update user subscription fields - Clerk Billing provides clerkId directly
export const updateSubscriptionByIdentifier = mutation({
  args: {
    clerkId: v.optional(v.string()),
    email: v.optional(v.string()),
    serviceToken: v.optional(v.string()),
    subscription_plan: v.union(v.literal('free'), v.literal('premium'), v.literal('university')),
    subscription_status: v.union(
      v.literal('active'),
      v.literal('inactive'),
      v.literal('cancelled'),
      v.literal('past_due'),
    ),
    onboarding_completed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const isService = isServiceRequest(args.serviceToken);
    if (!identity && !isService) {
      throw new Error('Unauthorized');
    }

    let actingUser = null as any;
    if (!isService) {
      actingUser = await ctx.db
        .query('users')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity!.subject))
        .unique();
      if (!actingUser) {
        throw new Error('Unauthorized');
      }
    }

    let user = null as any;

    // Prefer Clerk ID (should always be provided by Clerk webhooks)
    if (args.clerkId) {
      user = await ctx.db
        .query('users')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId!))
        .unique();
    }

    // Fallback to email (indexed) - legacy support
    if (!user && args.email && (isService || actingUser?.role === 'super_admin')) {
      user = await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', args.email!))
        .unique();
    }

    if (!user) throw new Error('User not found for subscription update');

    const isSelf = !isService && actingUser.clerkId === user.clerkId;
    if (!isService && !isSelf && actingUser.role !== 'super_admin') {
      throw new Error('Unauthorized');
    }

    await ctx.db.patch(user._id, {
      subscription_plan: args.subscription_plan,
      subscription_status: args.subscription_status,
      ...(args.onboarding_completed !== undefined
        ? { onboarding_completed: args.onboarding_completed }
        : {}),
      updated_at: Date.now(),
    });

    return user._id;
  },
});

// Create or update user from Clerk webhook
export const createUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    serviceToken: v.optional(v.string()),
    username: v.optional(v.string()),
    profile_image: v.optional(v.string()),
    // Allow optionally setting initial role (e.g., from Clerk public metadata)
    role: v.optional(
      v.union(
        v.literal('individual'),
        v.literal('user'),
        v.literal('student'),
        v.literal('staff'),
        v.literal('university_admin'),
        v.literal('advisor'),
        v.literal('super_admin'),
      ),
    ),
    // Cached subscription data synced from Clerk Billing via webhook
    subscription_plan: v.optional(
      v.union(v.literal('free'), v.literal('premium'), v.literal('university')),
    ),
    subscription_status: v.optional(
      v.union(
        v.literal('active'),
        v.literal('inactive'),
        v.literal('cancelled'),
        v.literal('past_due'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const isService = isServiceRequest(args.serviceToken);
    if (!isService) {
      throw new Error('Unauthorized: Service token required');
    }

    // First, try to find existing user by Clerk ID
    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (existingUser) {
      const normalizedRole = args.role
        ? normalizeLegacyUserRole(args.role, existingUser.university_id)
        : undefined;

      if (normalizedRole) {
        if (existingUser.university_id && isIndividualRole(normalizedRole)) {
          throw new Error(
            `Cannot set role '${normalizedRole}' for user with university assignment. ` +
              `Individual roles must not have university_id. Remove university_id first or choose a university role.`,
          );
        }
        if (!existingUser.university_id && isUniversityRole(normalizedRole)) {
          throw new Error(
            `Cannot set role '${normalizedRole}' without university assignment. ` +
              `University-affiliated roles require university_id.`,
          );
        }
      }

      // Track role change for audit (service-initiated via webhook)
      const roleChanged = normalizedRole && normalizedRole !== existingUser.role;
      const oldRole = existingUser.role;

      // Update existing user
      await ctx.db.patch(existingUser._id, {
        email: args.email,
        name: args.name,
        username: args.username,
        profile_image: args.profile_image,
        // If an explicit role is provided (e.g., from Clerk metadata), sync it
        ...(normalizedRole ? { role: normalizedRole } : {}),
        // Update cached subscription data if provided
        ...(args.subscription_plan ? { subscription_plan: args.subscription_plan } : {}),
        ...(args.subscription_status ? { subscription_status: args.subscription_status } : {}),
        updated_at: Date.now(),
      });

      // Audit log service-initiated role changes
      if (roleChanged && normalizedRole) {
        await logRoleChange(ctx, existingUser, oldRole, normalizedRole, true);
      }

      return existingUser._id;
    }

    // Check if there's a pending university student with this email (invited but not yet signed up)
    const pendingUser = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .filter((q) =>
        q.or(q.eq(q.field('clerkId'), ''), q.eq(q.field('account_status'), 'pending_activation')),
      )
      .first();

    if (pendingUser) {
      // Validate role-university invariant when overriding role
      // Individual roles (user, individual) must NOT have university_id
      // University roles (student, advisor, etc.) must have university_id
      if (args.role && pendingUser.university_id) {
        if (isIndividualRole(args.role)) {
          throw new Error(
            `Cannot set role '${args.role}' for pending user with university assignment. ` +
              `Individual roles must not have university_id. Remove university_id first or use a university-affiliated role.`,
          );
        }
      }
      if (args.role && !pendingUser.university_id) {
        if (isUniversityRole(args.role)) {
          throw new Error(
            `Cannot set role '${args.role}' for pending user without university assignment. ` +
              `University-affiliated roles require university_id. Assign a university first.`,
          );
        }
      }

      const requestedRole = args.role || pendingUser.role;
      const normalizedRole = normalizeLegacyUserRole(requestedRole, pendingUser.university_id);
      if (pendingUser.university_id && normalizedRole && isIndividualRole(normalizedRole)) {
        throw new Error(
          `Cannot activate pending user: role '${normalizedRole}' conflicts with university assignment. ` +
            `Individual roles must not have university_id.`,
        );
      }
      if (!pendingUser.university_id && normalizedRole && isUniversityRole(normalizedRole)) {
        throw new Error(
          `Cannot activate pending user: role '${normalizedRole}' requires university assignment. ` +
            `University-affiliated roles require university_id.`,
        );
      }

      // Track role change for audit (service-initiated via webhook)
      const pendingRoleChanged = normalizedRole && normalizedRole !== pendingUser.role;
      const pendingOldRole = pendingUser.role;

      // Activate the pending user by updating with Clerk ID
      await ctx.db.patch(pendingUser._id, {
        clerkId: args.clerkId,
        name: args.name,
        username: args.username || pendingUser.username,
        profile_image: args.profile_image,
        account_status: 'active',
        // Preserve university assignment but normalize legacy roles
        ...(normalizedRole ? { role: normalizedRole } : {}),
        // Update cached subscription data if provided, otherwise keep university plan
        subscription_plan: args.subscription_plan || pendingUser.subscription_plan || 'free',
        subscription_status:
          args.subscription_status || pendingUser.subscription_status || 'active',
        updated_at: Date.now(),
      });

      // Audit log service-initiated role changes during activation
      if (pendingRoleChanged && normalizedRole) {
        await logRoleChange(ctx, pendingUser, pendingOldRole, normalizedRole, true);
      }

      console.log(
        `[createUser] Activated pending user: ${pendingUser._id} (role: ${normalizedRole})`,
      );
      return pendingUser._id;
    }

    // Create new user
    const requestedRole = args.role ?? 'individual';
    const finalRole = normalizeLegacyUserRole(requestedRole, undefined) ?? 'individual';
    if (isUniversityRole(finalRole)) {
      throw new Error(
        `Cannot create user with role '${finalRole}' without university assignment. ` +
          `University-affiliated roles require university_id.`,
      );
    }

    const userId = await ctx.db.insert('users', {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      username: args.username || `user_${Date.now()}`,
      profile_image: args.profile_image,
      role: finalRole,
      subscription_plan: args.subscription_plan ?? 'free',
      subscription_status: args.subscription_status ?? 'active',
      onboarding_completed: false,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    // Send welcome email to new self-registered users
    // Only send if not created by admin and is a regular user
    if (!args.role || finalRole === 'individual') {
      try {
        await ctx.scheduler.runAfter(0, api.email.sendWelcomeEmail, {
          email: args.email,
          name: args.name,
        });
      } catch (emailError) {
        console.warn('Failed to schedule welcome email:', emailError);
        // Don't fail user creation if email scheduling fails
      }
    }

    return userId;
  },
});

// Alias for Clerk webhook - same as createUser
export const createUserFromClerk = createUser;

/**
 * Initialize user profile from client-side (called by ClerkAuthProvider)
 * This is for users who sign up directly through Clerk and need a Convex profile.
 * Unlike createUser (webhook-only), this validates the caller is the authenticated user.
 */
export const initializeUserProfile = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    username: v.optional(v.string()),
    profile_image: v.optional(v.string()),
    // Allow setting initial role from Clerk public metadata
    role: v.optional(
      v.union(
        v.literal('individual'),
        v.literal('user'),
        v.literal('student'),
        v.literal('staff'),
        v.literal('university_admin'),
        v.literal('advisor'),
        v.literal('super_admin'),
      ),
    ),
    // Allow setting university_id from Clerk public metadata for university roles
    university_id: v.optional(v.id('universities')),
  },
  handler: async (ctx, args) => {
    // Verify the caller is the authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: 'Unauthorized: Not authenticated', code: 'UNAUTHORIZED' });
    }
    if (identity.subject !== args.clerkId) {
      throw new ConvexError({
        message: 'Unauthorized: Cannot create profile for another user',
        code: 'UNAUTHORIZED',
      });
    }

    // Check if user already exists
    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (existingUser) {
      // User already exists, just return the ID
      return existingUser._id;
    }

    // Check for pending user (invited but not yet signed up)
    const pendingUser = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .filter((q) =>
        q.or(q.eq(q.field('clerkId'), ''), q.eq(q.field('account_status'), 'pending_activation')),
      )
      .first();

    if (pendingUser) {
      // Activate the pending user
      const requestedRole = args.role || pendingUser.role;
      const finalRole = normalizeLegacyUserRole(requestedRole, pendingUser.university_id);

      // Validate role-university invariant
      if (pendingUser.university_id && finalRole && isIndividualRole(finalRole)) {
        throw new Error(
          `Cannot activate with role '${finalRole}' - user has university assignment. ` +
            `Individual roles must not have university_id.`,
        );
      }
      if (!pendingUser.university_id && finalRole && isUniversityRole(finalRole)) {
        throw new Error(`Cannot activate with role '${finalRole}' without university assignment.`);
      }

      await ctx.db.patch(pendingUser._id, {
        clerkId: args.clerkId,
        name: args.name,
        username: args.username || pendingUser.username,
        profile_image: args.profile_image,
        account_status: 'active',
        ...(finalRole ? { role: finalRole } : {}),
        updated_at: Date.now(),
      });

      console.log(`[initializeUserProfile] Activated pending user: ${pendingUser._id}`);
      return pendingUser._id;
    }

    // Validate role for new user creation
    const requestedRole = args.role ?? 'individual';
    const finalRole = normalizeLegacyUserRole(requestedRole, args.university_id) ?? 'individual';

    // Validate role-university invariant
    if (isUniversityRole(finalRole) && !args.university_id) {
      throw new Error(`Cannot create user with role '${finalRole}' without university assignment.`);
    }
    if (isIndividualRole(finalRole) && args.university_id) {
      throw new Error(
        `Cannot create user with role '${finalRole}' and university assignment. ` +
          `Individual roles must not have university_id.`,
      );
    }

    // Verify university exists if provided
    if (args.university_id) {
      const university = await ctx.db.get(args.university_id);
      if (!university) {
        throw new Error(`University not found: ${args.university_id}`);
      }
    }

    // Create new user
    const userId = await ctx.db.insert('users', {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      username: args.username || `user_${Date.now()}`,
      profile_image: args.profile_image,
      role: finalRole,
      university_id: args.university_id,
      subscription_plan: args.university_id ? 'university' : 'free',
      subscription_status: 'active',
      onboarding_completed: false,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    // Send welcome email
    if (finalRole === 'individual') {
      try {
        await ctx.scheduler.runAfter(0, api.email.sendWelcomeEmail, {
          email: args.email,
          name: args.name,
        });
      } catch (emailError) {
        console.warn('Failed to schedule welcome email:', emailError);
      }
    }

    console.log(`[initializeUserProfile] Created new user: ${userId}`);
    return userId;
  },
});

// Update user profile
/**
 * Update user profile by Clerk ID
 *
 * WARNING - Clerk Sync Required for Role Changes:
 * This mutation updates Convex directly. Per the Clerk-first role update pattern,
 * Clerk publicMetadata.role is the source of truth for authorization.
 *
 * For role changes, prefer using the admin UI at /admin/settings → "User Roles"
 * which handles Clerk sync automatically. If using this mutation directly for
 * role changes, you must sync to Clerk afterward:
 *   - Via API: POST /api/admin/users/sync-role-to-convex with role parameter
 *   - Via script: npx convex run admin/syncRolesToClerk:syncAllRolesToClerk
 */
export const updateUser = mutation({
  args: {
    clerkId: v.string(),
    updates: v.object({
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      username: v.optional(v.string()),
      profile_image: v.optional(v.string()),
      cover_image: v.optional(v.string()),
      linkedin_url: v.optional(v.string()),
      github_url: v.optional(v.string()),
      twitter_url: v.optional(v.string()),
      dribbble_url: v.optional(v.string()),
      portfolio_url: v.optional(v.string()),
      custom_links: v.optional(v.array(customLinkValidator)),
      profile_resume: v.optional(profileResumeValidator),
      profile_documents: v.optional(v.array(profileDocumentValidator)),
      bio: v.optional(v.string()),
      headline: v.optional(v.string()),
      emails: v.optional(v.array(emailValidator)),
      phones: v.optional(v.array(phoneValidator)),
      job_title: v.optional(v.string()),
      company: v.optional(v.string()),
      location: v.optional(v.string()),
      city: v.optional(v.string()),
      phone_number: v.optional(v.string()),
      legally_authorized_us: v.optional(v.boolean()),
      requires_sponsorship: v.optional(v.boolean()),
      // Job preferences
      primary_role: v.optional(v.string()),
      primary_role_experience: v.optional(v.string()),
      other_roles: v.optional(v.array(v.string())),
      industries: v.optional(v.array(v.string())),
      desired_salary: v.optional(v.string()),
      salary_type: v.optional(v.union(v.literal('exact'), v.literal('range'))),
      salary_min: v.optional(v.number()),
      salary_max: v.optional(v.number()),
      preferred_experience_level: v.optional(
        v.union(v.literal('entry'), v.literal('mid'), v.literal('senior')),
      ),
      job_types: v.optional(v.array(v.string())),
      open_to_environments: v.optional(v.array(v.string())),
      preferred_environment: v.optional(v.string()),
      preferred_locations: v.optional(v.array(v.string())),
      willing_to_relocate: v.optional(v.boolean()),
      years_of_experience: v.optional(v.string()),
      website: v.optional(v.string()),
      skills: v.optional(v.string()),
      current_company: v.optional(v.string()),
      current_position: v.optional(v.string()),
      experience_level: v.optional(v.string()),
      industry: v.optional(v.string()),
      career_goals: v.optional(v.string()),
      education: v.optional(v.string()),
      education_history: v.optional(v.array(educationHistoryValidator)),
      work_history: v.optional(v.array(workHistoryValidator)),
      volunteer_history: v.optional(v.array(volunteerHistoryValidator)),
      certifications: v.optional(v.array(certificationValidator)),
      achievements_history: v.optional(v.array(achievementValidator)),
      university_name: v.optional(v.string()),
      major: v.optional(v.string()),
      graduation_year: v.optional(v.string()),
      dream_job: v.optional(v.string()),
      onboarding_completed: v.optional(v.boolean()),
      // Role must match schema - see convex/schema.ts for valid values
      role: v.optional(roleValidator),
      subscription_plan: v.optional(subscriptionPlanValidator),
      subscription_status: v.optional(subscriptionStatusValidator),
      university_id: v.optional(v.id('universities')),
      department_id: v.optional(v.id('departments')),
      account_status: v.optional(accountStatusValidator),
      // Allow updating Stripe IDs via this mutation as well
      stripe_customer_id: v.optional(v.string()),
      stripe_subscription_id: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }

    const actor = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!actor || (actor.clerkId !== args.clerkId && actor.role !== 'super_admin')) {
      throw new Error('Unauthorized');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    // Filter out undefined values from updates
    const cleanUpdates = Object.fromEntries(
      Object.entries(args.updates).filter(([_, value]) => value !== undefined),
    );

    // Track role changes for audit logging
    const roleChanged = args.updates.role && args.updates.role !== user.role;
    const oldRole = user.role;
    const newRole = args.updates.role;

    // Only super_admin can change roles
    if (newRole && actor.role !== 'super_admin') {
      throw new Error('Unauthorized: Only super_admin can change user roles');
    }

    // Only super_admin can update subscription/account status fields
    const restrictedFields = ['subscription_plan', 'subscription_status', 'account_status'];
    if (actor.role !== 'super_admin') {
      for (const field of restrictedFields) {
        if (field in cleanUpdates) {
          throw new Error('Unauthorized: Only super_admin can update subscription/account status');
        }
      }
    }

    // Validate role-university invariant for role changes
    if (newRole) {
      const finalUniversityId =
        args.updates.university_id !== undefined ? args.updates.university_id : user.university_id;

      if (isUniversityRole(newRole) && !finalUniversityId) {
        throw new Error(
          `Cannot set role '${newRole}' without university_id. ` +
            `University-affiliated roles require university_id.`,
        );
      }
      if (isIndividualRole(newRole) && finalUniversityId) {
        throw new Error(
          `Cannot set role '${newRole}' with university_id. ` +
            `Individual roles must not have university_id.`,
        );
      }
    }

    await ctx.db.patch(user._id, {
      ...cleanUpdates,
      updated_at: Date.now(),
    });

    // Create audit log for role changes (super admin actions)
    if (roleChanged) {
      await logRoleChange(ctx, user, oldRole, newRole!);
    }

    return user._id;
  },
});

/**
 * Update user profile by Convex document ID (useful for admin/dev utilities)
 *
 * WARNING - Clerk Sync Required for Role Changes:
 * This mutation updates Convex directly. Per the Clerk-first role update pattern,
 * Clerk publicMetadata.role is the source of truth for authorization.
 *
 * For role changes, prefer using the admin UI at /admin/settings → "User Roles"
 * which handles Clerk sync automatically. If using this mutation directly for
 * role changes, you must sync to Clerk afterward:
 *   - Via API: POST /api/admin/users/sync-role-to-convex with role parameter
 *   - Via script: npx convex run admin/syncRolesToClerk:syncAllRolesToClerk
 */
export const updateUserById = mutation({
  args: {
    id: v.id('users'),
    updates: v.object({
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      username: v.optional(v.string()),
      profile_image: v.optional(v.string()),
      linkedin_url: v.optional(v.string()),
      github_url: v.optional(v.string()),
      twitter_url: v.optional(v.string()),
      dribbble_url: v.optional(v.string()),
      portfolio_url: v.optional(v.string()),
      custom_links: v.optional(v.array(customLinkValidator)),
      profile_resume: v.optional(profileResumeValidator),
      profile_documents: v.optional(v.array(profileDocumentValidator)),
      bio: v.optional(v.string()),
      headline: v.optional(v.string()),
      emails: v.optional(v.array(emailValidator)),
      phones: v.optional(v.array(phoneValidator)),
      job_title: v.optional(v.string()),
      company: v.optional(v.string()),
      location: v.optional(v.string()),
      city: v.optional(v.string()),
      phone_number: v.optional(v.string()),
      website: v.optional(v.string()),
      skills: v.optional(v.string()),
      current_company: v.optional(v.string()),
      current_position: v.optional(v.string()),
      experience_level: v.optional(v.string()),
      industry: v.optional(v.string()),
      career_goals: v.optional(v.string()),
      education: v.optional(v.string()),
      education_history: v.optional(v.array(educationHistoryValidator)),
      work_history: v.optional(v.array(workHistoryValidator)),
      volunteer_history: v.optional(v.array(volunteerHistoryValidator)),
      certifications: v.optional(v.array(certificationValidator)),
      achievements_history: v.optional(v.array(achievementValidator)),
      university_name: v.optional(v.string()),
      major: v.optional(v.string()),
      graduation_year: v.optional(v.string()),
      dream_job: v.optional(v.string()),
      onboarding_completed: v.optional(v.boolean()),
      // Role must match schema - see convex/schema.ts for valid values
      role: v.optional(roleValidator),
      subscription_plan: v.optional(subscriptionPlanValidator),
      subscription_status: v.optional(subscriptionStatusValidator),
      university_id: v.optional(v.id('universities')),
      department_id: v.optional(v.id('departments')),
      account_status: v.optional(accountStatusValidator),
      university_admin_notes: v.optional(v.string()),
      stripe_customer_id: v.optional(v.string()),
      stripe_subscription_id: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }

    const actingUser = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!actingUser) {
      throw new Error('Unauthorized');
    }

    const targetUser = await ctx.db.get(args.id);
    if (!targetUser) {
      throw new Error('User not found');
    }

    const isSelf = actingUser._id === targetUser._id;
    const isSuperAdmin = actingUser.role === 'super_admin';
    if (!isSelf && !isSuperAdmin) {
      throw new Error('Unauthorized');
    }

    const user = targetUser;

    // Filter out undefined values from updates
    const cleanUpdates = Object.fromEntries(
      Object.entries(args.updates).filter(([_, value]) => value !== undefined),
    );

    // Track role changes for audit logging
    const roleChanged = args.updates.role && args.updates.role !== user.role;
    const oldRole = user.role;
    const newRole = args.updates.role;

    // Only super_admin can change roles
    if (newRole && !isSuperAdmin) {
      throw new Error('Unauthorized: Only super_admin can change user roles');
    }

    // Only super_admin can update subscription/account status fields
    const restrictedFields = ['subscription_plan', 'subscription_status', 'account_status'];
    if (!isSuperAdmin) {
      for (const field of restrictedFields) {
        if (field in cleanUpdates) {
          throw new Error('Unauthorized: Only super_admin can update subscription/account status');
        }
      }
    }

    // Validate role-university invariant for role changes
    if (newRole) {
      const finalUniversityId =
        args.updates.university_id !== undefined ? args.updates.university_id : user.university_id;

      if (isUniversityRole(newRole) && !finalUniversityId) {
        throw new Error(
          `Cannot set role '${newRole}' without university_id. ` +
            `University-affiliated roles require university_id.`,
        );
      }
      if (isIndividualRole(newRole) && finalUniversityId) {
        throw new Error(
          `Cannot set role '${newRole}' with university_id. ` +
            `Individual roles must not have university_id.`,
        );
      }
    }

    await ctx.db.patch(args.id, {
      ...cleanUpdates,
      updated_at: Date.now(),
    });

    // Create audit log for role changes (super admin actions)
    if (roleChanged) {
      await logRoleChange(ctx, user, oldRole, newRole!);
    }

    return args.id;
  },
});

/**
 * DEPRECATED: Legacy deleteUser function
 * DO NOT USE - No longer performs deletions
 * Use admin_users:softDeleteUser or admin_users:hardDeleteUser instead
 */
export const deleteUser = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    throw new Error(
      'deleteUser is deprecated. Use admin_users:softDeleteUser or admin_users:hardDeleteUser instead.',
    );
  },
});

// Get all users (admin only)
export const getAllUsers = query({
  args: {
    clerkId: v.string(),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }

    const currentUser = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    // Only Super Admin can access global user list
    if (!currentUser || currentUser.role !== 'super_admin') {
      throw new Error('Unauthorized');
    }

    // Returns { page, isDone, continueCursor } for proper pagination
    const users = await ctx.db
      .query('users')
      .order('desc')
      .paginate({
        numItems: args.limit || 50,
        cursor: args.cursor ?? null,
      });

    return users;
  },
});

// Get all users with minimal fields (admin only) - optimized for bandwidth
export const getAllUsersMinimal = query({
  args: {
    clerkId: v.string(),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }

    const currentUser = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    // Only Super Admin can access global user list
    if (!currentUser || currentUser.role !== 'super_admin') {
      throw new Error('Unauthorized');
    }

    // Returns { page, isDone, continueCursor } for proper pagination
    const users = await ctx.db
      .query('users')
      .order('desc')
      .paginate({
        numItems: args.limit || 50,
        cursor: args.cursor ?? null,
      });

    // Return only essential fields to reduce bandwidth
    const minimalUsers = {
      ...users,
      page: users.page.map((user) => ({
        _id: user._id,
        _creationTime: user._creationTime,
        clerkId: user.clerkId,
        email: user.email,
        name: user.name,
        username: user.username,
        role: user.role,
        subscription_plan: user.subscription_plan,
        subscription_status: user.subscription_status,
        account_status: user.account_status,
        is_test_user: user.is_test_user,
        deleted_at: user.deleted_at,
        deleted_by: user.deleted_by,
        deleted_reason: user.deleted_reason,
        university_id: user.university_id,
        profile_image: user.profile_image,
        created_at: user.created_at,
        updated_at: user.updated_at,
        // Exclude: education_history, work_history, achievements_history, bio, etc.
      })),
    };

    return minimalUsers;
  },
});

// Get users by university (university admin only)
export const getUsersByUniversity = query({
  args: {
    clerkId: v.string(),
    universityId: v.id('universities'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin for this university
    const currentUser = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!currentUser) {
      throw new Error('User not found');
    }

    const isAuthorized =
      currentUser.role === 'super_admin' ||
      ((currentUser.role === 'university_admin' || currentUser.role === 'advisor') &&
        currentUser.university_id === args.universityId);

    if (!isAuthorized) {
      throw new Error('Unauthorized');
    }

    const users = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .collect();

    return users;
  },
});

// Get onboarding progress
export const getOnboardingProgress = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.clerkId) {
      throw new Error('Unauthorized');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      return { completed_tasks: [] };
    }

    return {
      completed_tasks: (user as any).completed_tasks || [],
      onboarding_completed: user.onboarding_completed || false,
    };
  },
});

// Update onboarding progress
export const updateOnboardingProgress = mutation({
  args: {
    clerkId: v.string(),
    completed_tasks: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.clerkId) {
      throw new Error('Unauthorized');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    // Determine if onboarding is complete (all 5 tasks done)
    const onboarding_completed = args.completed_tasks.length >= 5;

    await ctx.db.patch(user._id, {
      completed_tasks: args.completed_tasks,
      onboarding_completed,
      updated_at: Date.now(),
    });

    return user._id;
  },
});

// Toggle hide/show progress card preference
export const toggleHideProgressCard = mutation({
  args: {
    clerkId: v.string(),
    hide: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.clerkId) {
      throw new Error('Unauthorized');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    await ctx.db.patch(user._id, {
      hide_progress_card: args.hide,
      updated_at: Date.now(),
    });

    return user._id;
  },
});

/**
 * Internal mutation to reactivate a deleted/suspended user account.
 * Used for admin recovery operations via CLI.
 *
 * @returns {Object} Result object with success, userId, and previousStatus
 * @returns {boolean} result.success - Always true if no error thrown
 * @returns {Id<'users'>} result.userId - The user's ID
 * @returns {string} result.previousStatus - The user's status before this call.
 *   If previousStatus === 'active', no changes were made (user was already active).
 */
export const reactivateUserAccount = internalMutation({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      throw new Error(`User not found with clerkId: ${args.clerkId}`);
    }

    // Validate that reactivation is needed - early return with same shape as normal return
    if (user.account_status === 'active' && !user.deleted_at) {
      return {
        success: true,
        userId: user._id,
        previousStatus: user.account_status,
      };
    }

    const previousStatus = user.account_status;
    const now = Date.now();

    await ctx.db.patch(user._id, {
      account_status: 'active',
      // Clear deletion metadata to maintain data consistency
      deleted_at: undefined,
      deleted_by: undefined,
      deleted_reason: undefined,
      deletion_scheduled_at: undefined,
      // Set restoration tracking
      restored_at: now,
      updated_at: now,
    });

    // Audit log the reactivation operation
    try {
      await logPermissionChange(ctx, {
        action: 'account.reactivated',
        actorType: 'system',
        actorUniversityId: user.university_id,
        targetType: 'user',
        targetId: user._id,
        targetUniversityId: user.university_id,
        previousValue: { account_status: previousStatus },
        newValue: { account_status: 'active' },
      });
    } catch (auditError) {
      console.error('Failed to create account reactivation audit log:', auditError);
      // Don't fail reactivation if audit logging fails
    }

    return { success: true, userId: user._id, previousStatus };
  },
});

/**
 * Record user login activity.
 * Updates last_login_at and creates an activity event for engagement tracking.
 *
 * Called by the frontend when a user session is established.
 */
export const recordLogin = mutation({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify caller is the authenticated user (prevents inflating other users' engagement metrics)
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.clerkId) {
      return { success: false, reason: 'unauthorized' };
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      // User not found - might be first login before profile is created
      return { success: false, reason: 'user_not_found' };
    }

    const now = Date.now();

    // Only update if last login was more than 1 hour ago (avoid excessive writes)
    const oneHourAgo = now - 60 * 60 * 1000;
    if (user.last_login_at && user.last_login_at > oneHourAgo) {
      return { success: true, skipped: true };
    }

    // Update last_login_at
    await ctx.db.patch(user._id, {
      last_login_at: now,
      updated_at: now,
    });

    // Track as activity event for engagement scoring (fire-and-forget)
    try {
      await trackActivity(ctx, {
        userId: user._id,
        universityId: user.university_id,
        eventType: ACTIVITY_EVENTS.LOGIN,
        eventCategory: 'auth',
      });
    } catch (error) {
      console.error('Failed to track login activity:', error);
      // Don't fail the login record if activity tracking fails
    }

    return { success: true, userId: user._id };
  },
});
