import { v } from 'convex/values';

import { api } from './_generated/api';
import { mutation } from './_generated/server';
import { maskEmail, maskId } from './lib/piiSafe';
import { isServiceRequest } from './lib/roles';
import {
  normalizeLegacyUserRole,
  type UserRole,
  validateRoleTransition,
} from './lib/roleValidation';
import { getActingUser, logRoleChange } from './users_core';

// Create or update user from Clerk webhook
export const createUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    username: v.optional(v.string()),
    profile_image: v.optional(v.string()),
    serviceToken: v.optional(v.string()),
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
    const identity = await ctx.auth.getUserIdentity();
    const isService = isServiceRequest(args.serviceToken);

    if (!identity && !isService) {
      throw new Error('Unauthorized');
    }

    if (!isService && identity!.subject !== args.clerkId) {
      throw new Error('Unauthorized: Clerk identity mismatch');
    }

    const actingUser = !isService
      ? await ctx.db
          .query('users')
          .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity!.subject))
          .unique()
      : null;

    const privilegedRoles = new Set(['super_admin', 'university_admin', 'advisor', 'staff']);

    const canAssignPrivileged = actingUser?.role === 'super_admin';
    const requestedRole = args.role;
    const safeRole =
      requestedRole && (canAssignPrivileged || !privilegedRoles.has(requestedRole))
        ? requestedRole
        : undefined;

    const finalRole = safeRole ?? 'individual';
    const resolvedRole = normalizeLegacyUserRole(finalRole, undefined) ?? 'individual';

    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (existingUser) {
      const normalizedRole = safeRole
        ? normalizeLegacyUserRole(safeRole, existingUser.university_id)
        : undefined;
      await ctx.db.patch(existingUser._id, {
        email: args.email,
        name: args.name,
        username: args.username,
        profile_image: args.profile_image,
        ...(normalizedRole ? { role: normalizedRole } : {}),
        ...(args.subscription_plan ? { subscription_plan: args.subscription_plan } : {}),
        ...(args.subscription_status ? { subscription_status: args.subscription_status } : {}),
        updated_at: Date.now(),
      });
      return existingUser._id;
    }

    const pendingUser = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .filter((q) =>
        q.or(q.eq(q.field('clerkId'), ''), q.eq(q.field('account_status'), 'pending_activation')),
      )
      .first();

    if (pendingUser) {
      const normalizedRole = normalizeLegacyUserRole(
        pendingUser.role as UserRole,
        pendingUser.university_id,
      );
      await ctx.db.patch(pendingUser._id, {
        clerkId: args.clerkId,
        name: args.name,
        username: args.username || pendingUser.username,
        profile_image: args.profile_image,
        account_status: 'active',
        ...(normalizedRole ? { role: normalizedRole } : {}),
        subscription_plan: args.subscription_plan || pendingUser.subscription_plan || 'free',
        subscription_status:
          args.subscription_status || pendingUser.subscription_status || 'active',
        updated_at: Date.now(),
      });

      console.log(`[createUser] Activated pending university student: ${maskEmail(args.email)}`);
      return pendingUser._id;
    }

    const userId = await ctx.db.insert('users', {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      username: args.username || `user_${Date.now()}`,
      profile_image: args.profile_image,
      role: resolvedRole,
      subscription_plan: args.subscription_plan ?? 'free',
      subscription_status: args.subscription_status ?? 'active',
      onboarding_completed: false,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    if (!args.role || resolvedRole === 'individual') {
      try {
        await ctx.scheduler.runAfter(0, api.email.sendWelcomeEmail, {
          email: args.email,
          name: args.name,
        });
      } catch (emailError) {
        console.warn('Failed to schedule welcome email:', emailError);
      }
    }

    return userId;
  },
});

export const createUserFromClerk = createUser;

/**
 * Update user profile fields.
 *
 * ⚠️ IMPORTANT: Role changes should go through Clerk first!
 * Clerk publicMetadata.role is the source of truth for authorization.
 * Direct role changes here will create a sync mismatch.
 *
 * Preferred flow for role changes:
 * 1. Update role in Clerk publicMetadata (via Dashboard or API)
 * 2. Clerk webhook triggers user.updated event
 * 3. Webhook handler calls this mutation with serviceToken
 *
 * See CLAUDE.md "Roles & Permissions" section for details.
 */
export const updateUser = mutation({
  args: {
    clerkId: v.string(),
    serviceToken: v.optional(v.string()),
    updates: v.object({
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      username: v.optional(v.string()),
      profile_image: v.optional(v.string()),
      cover_image: v.optional(v.string()),
      linkedin_url: v.optional(v.string()),
      bio: v.optional(v.string()),
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
      education_history: v.optional(
        v.array(
          v.object({
            id: v.string(),
            school: v.optional(v.string()),
            degree: v.optional(v.string()),
            field_of_study: v.optional(v.string()),
            start_year: v.optional(v.string()),
            end_year: v.optional(v.string()),
            is_current: v.optional(v.boolean()),
            description: v.optional(v.string()),
          }),
        ),
      ),
      work_history: v.optional(
        v.array(
          v.object({
            id: v.string(),
            role: v.optional(v.string()),
            company: v.optional(v.string()),
            start_date: v.optional(v.string()),
            end_date: v.optional(v.string()),
            is_current: v.optional(v.boolean()),
            location: v.optional(v.string()),
            summary: v.optional(v.string()),
          }),
        ),
      ),
      achievements_history: v.optional(
        v.array(
          v.object({
            id: v.string(),
            title: v.optional(v.string()),
            description: v.optional(v.string()),
            date: v.optional(v.string()),
            organization: v.optional(v.string()),
          }),
        ),
      ),
      university_name: v.optional(v.string()),
      major: v.optional(v.string()),
      graduation_year: v.optional(v.string()),
      dream_job: v.optional(v.string()),
      onboarding_completed: v.optional(v.boolean()),
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
      university_id: v.optional(v.id('universities')),
      department_id: v.optional(v.id('departments')),
      account_status: v.optional(
        v.union(v.literal('active'), v.literal('suspended'), v.literal('pending_activation')),
      ),
      stripe_customer_id: v.optional(v.string()),
      stripe_subscription_id: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const { actingUser, isService } = await getActingUser(ctx, args.serviceToken);
    const targetUser = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!targetUser) {
      throw new Error('User not found');
    }

    const isSelf = !isService && actingUser._id === targetUser._id;
    const sameUniversity =
      !isService &&
      actingUser.university_id &&
      targetUser.university_id &&
      actingUser.university_id === targetUser.university_id;
    const canManageTenant =
      isService ||
      actingUser.role === 'super_admin' ||
      (actingUser.role === 'university_admin' && sameUniversity);

    if (!isSelf && !canManageTenant) {
      throw new Error('Unauthorized');
    }

    const protectedFields = new Set([
      'role',
      'university_id',
      'subscription_plan',
      'subscription_status',
      'account_status',
      'department_id',
    ]);

    const cleanUpdates = Object.fromEntries(
      Object.entries(args.updates).filter(([_, value]) => value !== undefined),
    );

    if (
      !isService &&
      actingUser.role !== 'super_admin' &&
      Object.keys(cleanUpdates).some((key) => protectedFields.has(key))
    ) {
      throw new Error('Unauthorized to change restricted fields');
    }

    const roleChanged = args.updates.role && args.updates.role !== targetUser.role;
    const oldRole = targetUser.role;
    const newRole = args.updates.role;

    if (roleChanged && newRole) {
      // ⚠️ Warn if role change is not from webhook (service token)
      // Clerk publicMetadata.role is the source of truth - direct changes create sync issues
      if (!isService) {
        console.warn(
          `[updateUser] ⚠️ Direct role change for ${args.clerkId}: ${oldRole} → ${newRole}. ` +
            `Consider updating Clerk publicMetadata.role first to maintain sync.`,
        );
      }

      const targetUniversityId =
        args.updates.university_id !== undefined
          ? args.updates.university_id
          : targetUser.university_id;

      const validation = await validateRoleTransition(
        ctx,
        targetUser.clerkId,
        oldRole as UserRole,
        newRole as UserRole,
        targetUniversityId ?? undefined,
      );

      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid role transition');
      }
    }

    await ctx.db.patch(targetUser._id, {
      ...cleanUpdates,
      updated_at: Date.now(),
    });

    if (roleChanged && !isService) {
      await logRoleChange(ctx, targetUser, oldRole, newRole!);
    }

    return targetUser._id;
  },
});

/**
 * Update user profile by Convex document ID.
 *
 * ⚠️ IMPORTANT: Role changes should go through Clerk first!
 * Clerk publicMetadata.role is the source of truth for authorization.
 * Direct role changes here will create a sync mismatch.
 *
 * Preferred flow for role changes:
 * 1. Update role in Clerk publicMetadata (via Dashboard or API)
 * 2. Clerk webhook triggers user.updated event
 * 3. Webhook handler calls this mutation with serviceToken
 *
 * If role must be changed directly, sync afterward via:
 *   - API: POST /api/admin/users/sync-role-to-convex with role parameter
 *   - Script: npx convex run admin/syncRolesToClerk:syncAllRolesToClerk
 *
 * See CLAUDE.md "Roles & Permissions" section for details.
 */
export const updateUserById = mutation({
  args: {
    id: v.id('users'),
    serviceToken: v.optional(v.string()),
    updates: v.object({
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      username: v.optional(v.string()),
      profile_image: v.optional(v.string()),
      linkedin_url: v.optional(v.string()),
      bio: v.optional(v.string()),
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
      education_history: v.optional(
        v.array(
          v.object({
            id: v.string(),
            school: v.optional(v.string()),
            degree: v.optional(v.string()),
            field_of_study: v.optional(v.string()),
            start_year: v.optional(v.string()),
            end_year: v.optional(v.string()),
            is_current: v.optional(v.boolean()),
            description: v.optional(v.string()),
          }),
        ),
      ),
      work_history: v.optional(
        v.array(
          v.object({
            id: v.string(),
            role: v.optional(v.string()),
            company: v.optional(v.string()),
            start_date: v.optional(v.string()),
            end_date: v.optional(v.string()),
            is_current: v.optional(v.boolean()),
            location: v.optional(v.string()),
            summary: v.optional(v.string()),
          }),
        ),
      ),
      achievements_history: v.optional(
        v.array(
          v.object({
            id: v.string(),
            title: v.optional(v.string()),
            description: v.optional(v.string()),
            date: v.optional(v.string()),
            organization: v.optional(v.string()),
          }),
        ),
      ),
      university_name: v.optional(v.string()),
      major: v.optional(v.string()),
      graduation_year: v.optional(v.string()),
      dream_job: v.optional(v.string()),
      onboarding_completed: v.optional(v.boolean()),
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
      university_id: v.optional(v.id('universities')),
      department_id: v.optional(v.id('departments')),
      account_status: v.optional(
        v.union(v.literal('active'), v.literal('suspended'), v.literal('pending_activation')),
      ),
      university_admin_notes: v.optional(v.string()),
      stripe_customer_id: v.optional(v.string()),
      stripe_subscription_id: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const { actingUser, isService } = await getActingUser(ctx, args.serviceToken);
    const user = await ctx.db.get(args.id);

    if (!user) {
      throw new Error('User not found');
    }

    const isSelf = !isService && actingUser._id === user._id;
    const sameUniversity =
      !isService &&
      actingUser.university_id &&
      user.university_id &&
      actingUser.university_id === user.university_id;
    const canManageTenant =
      isService ||
      actingUser.role === 'super_admin' ||
      (actingUser.role === 'university_admin' && sameUniversity);

    if (!isSelf && !canManageTenant) {
      throw new Error('Unauthorized');
    }

    const protectedFields = new Set([
      'role',
      'university_id',
      'subscription_plan',
      'subscription_status',
      'account_status',
      'department_id',
    ]);

    const cleanUpdates = Object.fromEntries(
      Object.entries(args.updates).filter(([_, value]) => value !== undefined),
    );

    if (
      !isService &&
      actingUser.role !== 'super_admin' &&
      Object.keys(cleanUpdates).some((key) => protectedFields.has(key))
    ) {
      throw new Error('Unauthorized to change restricted fields');
    }

    const roleChanged = args.updates.role && args.updates.role !== user.role;
    const oldRole = user.role;
    const newRole = args.updates.role;

    // Validate role transition if role is being changed
    if (roleChanged && newRole) {
      // ⚠️ Warn if role change is not from webhook (service token)
      // Clerk publicMetadata.role is the source of truth - direct changes create sync issues
      if (!isService) {
        console.warn(
          `[updateUserById] ⚠️ Direct role change for user ${args.id}: ${oldRole} → ${newRole}. ` +
            `Consider updating Clerk publicMetadata.role first to maintain sync.`,
        );
      }

      // Use the university_id from updates if provided, otherwise use existing
      const targetUniversityId =
        args.updates.university_id !== undefined ? args.updates.university_id : user.university_id;

      const validation = await validateRoleTransition(
        ctx,
        user.clerkId,
        oldRole as UserRole,
        newRole as UserRole,
        targetUniversityId ?? undefined,
      );

      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid role transition');
      }
    }

    await ctx.db.patch(args.id, {
      ...cleanUpdates,
      updated_at: Date.now(),
    });

    if (roleChanged && !isService) {
      await logRoleChange(ctx, user, oldRole, newRole!);
    }

    return args.id;
  },
});

export const deleteUser = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    throw new Error(
      'deleteUser is deprecated. Use admin_users:softDeleteUser or admin_users:hardDeleteUser instead.',
    );
  },
});

/**
 * Ensure a membership record exists for a user with a university-based role.
 * Creates a new membership if one doesn't exist, or updates the university_id if changed.
 *
 * This is called when a super admin assigns a role like student/advisor/university_admin
 * to ensure the user has the required membership record for authorization checks.
 */
export const ensureMembership = mutation({
  args: {
    clerkId: v.string(),
    role: v.union(v.literal('student'), v.literal('advisor'), v.literal('university_admin')),
    universityId: v.id('universities'),
    serviceToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const isService = isServiceRequest(args.serviceToken);

    // Verify caller is super_admin unless using trusted service token (webhook)
    if (!isService) {
      if (!identity) {
        throw new Error('Unauthorized: User not authenticated');
      }

      const callingUser = await ctx.db
        .query('users')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
        .unique();

      if (!callingUser || callingUser.role !== 'super_admin') {
        throw new Error('Forbidden: Only super admins can manage memberships');
      }
    }

    // Get target user by clerkId
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    // Check for existing membership with this role
    const existingMembership = await ctx.db
      .query('memberships')
      .withIndex('by_user_role', (q) => q.eq('user_id', user._id).eq('role', args.role))
      .first();

    const now = Date.now();

    if (existingMembership) {
      // Update if university changed or status is not active
      if (
        existingMembership.university_id !== args.universityId ||
        existingMembership.status !== 'active'
      ) {
        await ctx.db.patch(existingMembership._id, {
          university_id: args.universityId,
          status: 'active',
          updated_at: now,
        });
        console.log(
          `[ensureMembership] Updated membership for user ${maskId(args.clerkId)} with role ${args.role}`,
        );
      }
      return existingMembership._id;
    }

    // Create new membership
    const membershipId = await ctx.db.insert('memberships', {
      user_id: user._id,
      university_id: args.universityId,
      role: args.role,
      status: 'active',
      created_at: now,
      updated_at: now,
    });

    console.log(
      `[ensureMembership] Created membership for user ${maskId(args.clerkId)} with role ${args.role}`,
    );
    return membershipId;
  },
});

/**
 * Atomically update user and ensure membership in a single transaction.
 *
 * This mutation combines updateUser and ensureMembership operations to prevent
 * partial updates where user role changes but membership creation fails.
 *
 * Used by Clerk webhook for user.updated events to ensure data consistency.
 *
 * ⚠️ IMPORTANT: This mutation should primarily be called from the Clerk webhook.
 * Clerk publicMetadata.role is the source of truth for authorization.
 * When called directly (not from webhook), role changes will update Convex
 * but Clerk may still have the old role, causing authorization mismatches.
 *
 * Preferred flow:
 * 1. Update role in Clerk publicMetadata (via Dashboard or API)
 * 2. Clerk webhook triggers user.updated event
 * 3. Webhook handler calls this mutation with serviceToken
 *
 * See CLAUDE.md "Roles & Permissions" section for details.
 */
export const updateUserWithMembership = mutation({
  args: {
    clerkId: v.string(),
    updates: v.object({
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      profile_image: v.optional(v.string()),
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
      university_id: v.optional(v.id('universities')),
      account_status: v.optional(
        v.union(v.literal('active'), v.literal('suspended'), v.literal('pending_activation')),
      ),
    }),
    // Membership data - only required for university roles
    membership: v.optional(
      v.object({
        role: v.union(v.literal('student'), v.literal('advisor'), v.literal('university_admin')),
        universityId: v.id('universities'),
      }),
    ),
    serviceToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const isService = isServiceRequest(args.serviceToken);

    // Service token required for webhook calls
    if (!identity && !isService) {
      throw new Error('Unauthorized: Authentication required');
    }

    let callingUser: any = null;

    // For non-service calls, ensure caller is authorized (super_admin)
    if (!isService && identity) {
      callingUser = await ctx.db
        .query('users')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
        .unique();

      if (!callingUser || callingUser.role !== 'super_admin') {
        throw new Error('Forbidden: Only super admins can update users with membership');
      }
    }

    const protectedFields = new Set([
      'role',
      'university_id',
      'subscription_plan',
      'subscription_status',
      'account_status',
      'department_id',
    ]);

    if (
      !isService &&
      callingUser?.role !== 'super_admin' &&
      Object.keys(args.updates).some((key) => protectedFields.has(key))
    ) {
      throw new Error('Unauthorized to change restricted fields');
    }

    // Get target user by clerkId
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      throw new Error(`User not found: ${maskId(args.clerkId)}`);
    }

    const now = Date.now();

    // Filter out undefined values from updates
    const cleanUpdates = Object.fromEntries(
      Object.entries(args.updates).filter(([_, value]) => value !== undefined),
    );

    // Validate that role and membership role (if provided) are consistent
    if (args.updates.role && args.membership && args.updates.role !== args.membership.role) {
      throw new Error(
        `Role mismatch: updates.role (${args.updates.role}) does not match membership.role (${args.membership.role})`,
      );
    }

    // Track role changes for audit logging
    const roleChanged = args.updates.role && args.updates.role !== user.role;
    const oldRole = user.role;
    const newRole = args.updates.role;

    // Validate role transition if changing role
    if (roleChanged && newRole) {
      // ⚠️ Warn if role change is not from webhook (service token)
      // Clerk publicMetadata.role is the source of truth - direct changes create sync issues
      if (!isService) {
        console.warn(
          `[updateUserWithMembership] ⚠️ Direct role change for ${args.clerkId}: ${oldRole} → ${newRole}. ` +
            `Consider updating Clerk publicMetadata.role first to maintain sync.`,
        );
      }

      const targetUniversityId =
        args.updates.university_id !== undefined
          ? args.updates.university_id
          : (args.membership?.universityId ?? user.university_id);

      const validation = await validateRoleTransition(
        ctx,
        user.clerkId,
        oldRole as UserRole,
        newRole as UserRole,
        targetUniversityId ?? undefined,
      );

      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid role transition');
      }
    }

    // Step 1: Update user record
    await ctx.db.patch(user._id, {
      ...cleanUpdates,
      updated_at: now,
    });

    // Step 2: Ensure membership if university role data provided
    let membershipId = null;
    if (args.membership) {
      // Check for existing membership with this role
      const existingMembership = await ctx.db
        .query('memberships')
        .withIndex('by_user_role', (q) =>
          q.eq('user_id', user._id).eq('role', args.membership!.role),
        )
        .first();

      if (existingMembership) {
        // Update if university changed or status is not active
        if (
          existingMembership.university_id !== args.membership.universityId ||
          existingMembership.status !== 'active'
        ) {
          await ctx.db.patch(existingMembership._id, {
            university_id: args.membership.universityId,
            // Reactivate membership when webhook confirms role assignment
            status: 'active',
            updated_at: now,
          });
          console.log(
            `[updateUserWithMembership] Updated membership for user ${maskId(args.clerkId)} with role ${args.membership.role}`,
          );
        }
        membershipId = existingMembership._id;
      } else {
        // Create new membership
        membershipId = await ctx.db.insert('memberships', {
          user_id: user._id,
          university_id: args.membership.universityId,
          role: args.membership.role,
          status: 'active',
          created_at: now,
          updated_at: now,
        });
        console.log(
          `[updateUserWithMembership] Created membership for user ${maskId(args.clerkId)} with role ${args.membership.role}`,
        );
      }
    }

    // Step 3: Log role change if applicable
    if (roleChanged && !isService) {
      await logRoleChange(ctx, user, oldRole, newRole!);
    }

    console.log(
      `[updateUserWithMembership] Updated user ${maskId(args.clerkId)}${membershipId ? ` with membership ${maskId(membershipId)}` : ''}`,
    );

    return {
      userId: user._id,
      membershipId,
      roleChanged,
    };
  },
});
