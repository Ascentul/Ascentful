'use node';

/**
 * Node.js actions for admin user management
 * These need to run in Node.js runtime to access environment variables
 * and make authenticated fetch requests to Next.js API routes
 */

import { v } from 'convex/values';

import { api, internal } from './_generated/api';
import { action } from './_generated/server';

/**
 * Tables to cascade delete when hard-deleting a user.
 * IMPORTANT: Must match validTables list in _getRecordsByUserId (admin_users.ts)
 */
const TABLES_TO_CASCADE = [
  'applications',
  'resumes',
  'cover_letters',
  'goals',
  'projects',
  'networking_contacts',
  'contact_interactions',
  'followup_actions',
  'career_paths',
  'ai_coach_conversations',
  'ai_coach_messages',
  'support_tickets',
  'user_achievements',
  'user_daily_activity',
  'job_searches',
  'daily_recommendations',
] as const;

// Type for minimal user data from getAllUsersMinimal query
type MinimalUser = {
  _id: string;
  is_test_user?: boolean;
  account_status?: string;
  clerkId: string;
  email?: string;
  name?: string;
};

// Validate query results at the trust boundary
function assertMinimalUsers(data: any): asserts data is MinimalUser[] {
  if (!Array.isArray(data)) {
    throw new Error('Expected data to be an array');
  }

  for (const user of data) {
    if (!user || typeof user !== 'object') {
      throw new Error('Invalid user record: not an object');
    }
    if (typeof (user as any)._id !== 'string' || typeof (user as any).clerkId !== 'string') {
      throw new Error('Invalid user record: missing required id fields');
    }
    if ('is_test_user' in user && typeof (user as any).is_test_user !== 'boolean') {
      throw new Error('Invalid user record: is_test_user must be boolean');
    }
    if ('account_status' in user && typeof (user as any).account_status !== 'string') {
      throw new Error('Invalid user record: account_status must be string');
    }
  }
}

/**
 * Soft delete a user (super_admin only)
 * Public action that handles both Convex and Clerk
 */
export const softDeleteUser = action({
  args: {
    targetClerkId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message: string; userId: any }> => {
    // Get app URL from environment
    const appUrl = process.env.CONVEX_APP_URL || process.env.NEXT_PUBLIC_APP_URL;

    if (!appUrl) {
      throw new Error(
        'Server configuration error: App URL not configured. ' +
          'Set CONVEX_APP_URL or NEXT_PUBLIC_APP_URL in Convex dashboard.',
      );
    }

    // Get admin identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized: Not authenticated');
    }

    // SECURITY: Explicit role check at action boundary (defense-in-depth)
    // Internal mutation also checks, but we validate early to fail fast
    const admin = await ctx.runQuery(api.users.getUserByClerkId, {
      clerkId: identity.subject,
    });

    if (!admin || admin.role !== 'super_admin') {
      throw new Error('Forbidden: Only super admins can soft delete users');
    }

    // Soft delete in Convex
    const result: { success: boolean; message: string; userId: any } = await ctx.runMutation(
      internal.admin_users._softDeleteUserInternal,
      {
        targetClerkId: args.targetClerkId,
        adminClerkId: identity.subject,
        reason: args.reason,
      },
    );

    // Disable Clerk account (ban user to prevent login)
    try {
      // Call our backend API to disable the Clerk user
      const response = await fetch(`${appUrl}/api/admin/clerk-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'disable',
          clerkId: args.targetClerkId,
        }),
      });

      if (!response.ok) {
        console.error('Failed to disable Clerk account, but Convex delete succeeded');
      }
    } catch (clerkError) {
      // Log error but don't fail the operation - user is still marked deleted in Convex
      console.error('Failed to disable Clerk account:', clerkError);
    }

    return result;
  },
});

/**
 * Hard delete a test user (super_admin only)
 * Permanently removes user and cascades delete to all related data
 * ONLY works for users marked as test users
 */
export const hardDeleteUser = action({
  args: {
    targetClerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const deleteFromClerk = async (appUrl: string, clerkId: string) => {
      const maxAttempts = 3;
      let lastError: any = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const response = await fetch(`${appUrl}/api/admin/clerk-sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'delete',
              clerkId,
            }),
          });

          if (response.ok) {
            return;
          }

          lastError = new Error(`Clerk delete failed (status ${response.status})`);
          console.error(
            `[HardDeleteUser] Clerk delete attempt ${attempt}/${maxAttempts} failed:`,
            await response.text(),
          );
        } catch (error) {
          lastError = error;
          console.error(
            `[HardDeleteUser] Clerk delete attempt ${attempt}/${maxAttempts} threw:`,
            error,
          );
        }
      }

      throw lastError || new Error('Failed to delete Clerk user after retries');
    };

    // Get app URL from environment
    const appUrl = process.env.CONVEX_APP_URL || process.env.NEXT_PUBLIC_APP_URL;

    if (!appUrl) {
      throw new Error(
        'Server configuration error: App URL not configured. ' +
          'Set CONVEX_APP_URL or NEXT_PUBLIC_APP_URL in Convex dashboard.',
      );
    }

    // Get admin identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized: Not authenticated');
    }

    // Get admin user
    const admin = await ctx.runQuery(api.users.getUserByClerkId, {
      clerkId: identity.subject,
    });

    if (!admin || admin.role !== 'super_admin') {
      throw new Error('Forbidden: Only super admins can hard delete users');
    }

    // Get target user
    const targetUser = await ctx.runQuery(api.users.getUserByClerkId, {
      clerkId: args.targetClerkId,
    });

    if (!targetUser) {
      throw new Error('User not found');
    }

    // Prevent deleting self
    if (targetUser.clerkId === admin.clerkId) {
      throw new Error('Cannot delete your own account');
    }

    // ONLY allow hard delete for test users
    if (!targetUser.is_test_user) {
      throw new Error(
        'Cannot hard delete real users. Only test users can be permanently deleted. Use softDeleteUser instead.',
      );
    }

    // CASCADE DELETE: Remove all related data
    // This is a destructive operation that cannot be undone
    const tablesToCascade = TABLES_TO_CASCADE;

    let deletedRecords = 0;

    for (const tableName of tablesToCascade) {
      try {
        // Query records for this user
        const records = await ctx.runQuery(internal.admin_users._getRecordsByUserId, {
          tableName,
          userId: targetUser._id,
        });

        // Delete each record
        for (const recordId of records) {
          await ctx.runMutation(internal.admin_users._deleteRecord, {
            tableName,
            recordId,
          });
          deletedRecords++;
        }
      } catch (error) {
        console.warn(`Warning: Could not cascade delete from ${tableName}:`, error);
        // Continue with other tables even if one fails
      }
    }

    // Create audit log BEFORE deleting the user
    await ctx.runMutation(internal.audit_logs._createAuditLogInternal, {
      action: 'user_hard_deleted',
      target_type: 'user',
      target_id: targetUser._id,
      target_email: targetUser.email,
      target_name: targetUser.name,
      performed_by_id: admin._id,
      performed_by_email: admin.email,
      performed_by_name: admin.name,
      reason: 'Test user permanently deleted (hard delete)',
      metadata: {
        targetRole: targetUser.role,
        targetUniversityId: targetUser.university_id,
        deletedRecordsCount: deletedRecords,
        isTestUser: true,
      },
    });

    // Finally, delete the user record
    await ctx.runMutation(internal.admin_users._deleteUserRecord, {
      userId: targetUser._id,
    });

    // Delete from Clerk (permanently remove identity) with retries
    // Don't throw on failure - Convex data is already deleted and can't be rolled back
    let clerkDeleted = true;
    let clerkError: string | undefined;
    try {
      await deleteFromClerk(appUrl, args.targetClerkId);
    } catch (error) {
      clerkDeleted = false;
      clerkError = error instanceof Error ? error.message : String(error);
      console.error('[HardDeleteUser] Failed to delete Clerk account after retries:', error);
    }

    return {
      success: true, // Convex deletion succeeded
      clerkDeleted,
      message: clerkDeleted
        ? `Test user permanently deleted. Removed ${deletedRecords} related records.`
        : `Test user deleted from Convex but Clerk deletion failed. Removed ${deletedRecords} related records.`,
      ...(clerkError && { warning: `Clerk deletion failed: ${clerkError}` }),
      deletedRecords,
    };
  },
});

/**
 * Restore a soft-deleted user (super_admin only)
 * Re-activates the user account and clears deletion metadata
 */
export const restoreDeletedUser = action({
  args: {
    targetClerkId: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message: string; userId: any }> => {
    // Get app URL from environment
    const appUrl = process.env.CONVEX_APP_URL || process.env.NEXT_PUBLIC_APP_URL;

    if (!appUrl) {
      throw new Error(
        'Server configuration error: App URL not configured. ' +
          'Set CONVEX_APP_URL or NEXT_PUBLIC_APP_URL in Convex dashboard.',
      );
    }

    // Get admin identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized: Not authenticated');
    }

    // Get admin user
    const admin = await ctx.runQuery(api.users.getUserByClerkId, {
      clerkId: identity.subject,
    });

    if (!admin || admin.role !== 'super_admin') {
      throw new Error('Forbidden: Only super admins can restore deleted users');
    }

    // Get target user
    const targetUser = await ctx.runQuery(api.users.getUserByClerkId, {
      clerkId: args.targetClerkId,
    });

    if (!targetUser) {
      throw new Error('User not found');
    }

    // Verify user is actually deleted
    if (targetUser.account_status !== 'deleted') {
      throw new Error('User is not deleted. Cannot restore an active user.');
    }

    // Restore in Convex
    const result = await ctx.runMutation(internal.admin_users._restoreUserInternal, {
      targetUserId: targetUser._id,
      adminId: admin._id,
    });

    // Re-enable Clerk account (unban user to allow login)
    try {
      const response = await fetch(`${appUrl}/api/admin/clerk-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enable',
          clerkId: args.targetClerkId,
        }),
      });

      if (!response.ok) {
        console.error('Failed to re-enable Clerk account, but Convex restore succeeded');
      }
    } catch (clerkError) {
      // Log error but don't fail the operation - user is still marked active in Convex
      console.error('Failed to re-enable Clerk account:', clerkError);
    }

    return result;
  },
});

/**
 * Reconcile lingering test users by re-attempting hard delete (Convex + Clerk).
 * Super admin only. Iterates through is_test_user users (optionally limited) and
 * attempts full cascade deletion plus Clerk removal with retries.
 */
type ReconcileResult = {
  clerkId: string;
  userId?: string;
  status: 'deleted' | 'failed';
  deletedRecords?: number;
  error?: string;
  clerkError?: string;
};

export const reconcileTestUsers = action({
  args: {
    limit: v.optional(v.number()),
    includeDeletedStatus: v.optional(v.boolean()), // also include account_status === "deleted"
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    totalCandidates: number;
    processed: number;
    deleted: number;
    failed: number;
    results: ReconcileResult[];
  }> => {
    const appUrl = process.env.CONVEX_APP_URL || process.env.NEXT_PUBLIC_APP_URL;

    if (!appUrl) {
      throw new Error(
        'Server configuration error: App URL not configured. ' +
          'Set CONVEX_APP_URL or NEXT_PUBLIC_APP_URL in Convex dashboard.',
      );
    }

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized: Not authenticated');
    }

    const admin = await ctx.runQuery(api.users.getUserByClerkId, {
      clerkId: identity.subject,
    });

    if (!admin || admin.role !== 'super_admin') {
      throw new Error('Forbidden: Only super admins can reconcile test users');
    }

    const deleteFromClerk = async (clerkId: string) => {
      const maxAttempts = 3;
      let lastError: unknown = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const response = await fetch(`${appUrl}/api/admin/clerk-sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'delete',
              clerkId,
            }),
          });

          if (response.ok) {
            return;
          }

          lastError = new Error(`Clerk delete failed (status ${response.status})`);
          console.error(
            `[ReconcileTestUsers] Clerk delete attempt ${attempt}/${maxAttempts} failed:`,
            await response.text(),
          );
        } catch (error) {
          lastError = error;
          console.error(
            `[ReconcileTestUsers] Clerk delete attempt ${attempt}/${maxAttempts} threw:`,
            error,
          );
        }
      }

      throw lastError || new Error('Failed to delete Clerk user after retries');
    };

    const maxUsers = args.limit ?? 200;

    const usersPage = await ctx.runQuery(api.users.getAllUsersMinimal, {
      clerkId: identity.subject,
      limit: maxUsers,
    });

    assertMinimalUsers(usersPage.page);
    const candidates = usersPage.page.filter(
      (u) =>
        u.is_test_user === true &&
        (u.account_status !== 'deleted' || args.includeDeletedStatus === true),
    );

    const tablesToCascade = TABLES_TO_CASCADE;

    const results: ReconcileResult[] = [];

    for (const user of candidates) {
      let deletedRecords = 0;
      try {
        // Prevent deleting self
        if (user.clerkId === admin.clerkId) {
          results.push({
            clerkId: user.clerkId,
            status: 'failed',
            error: 'Cannot delete your own account',
          });
          continue;
        }

        // Re-fetch full user to ensure still present
        const targetUser = await ctx.runQuery(api.users.getUserByClerkId, {
          clerkId: user.clerkId,
        });

        if (!targetUser) {
          // Already gone in Convex; still attempt Clerk cleanup
          await deleteFromClerk(user.clerkId);
          results.push({ clerkId: user.clerkId, status: 'deleted', deletedRecords: 0 });
          continue;
        }

        if (!targetUser.is_test_user) {
          results.push({
            clerkId: user.clerkId,
            userId: targetUser._id,
            status: 'failed',
            error: 'Not a test user; skipping',
          });
          continue;
        }

        for (const tableName of tablesToCascade) {
          try {
            const records = await ctx.runQuery(internal.admin_users._getRecordsByUserId, {
              tableName,
              userId: targetUser._id,
            });

            for (const recordId of records) {
              await ctx.runMutation(internal.admin_users._deleteRecord, {
                tableName,
                recordId,
              });
              deletedRecords++;
            }
          } catch (error) {
            console.warn(`[ReconcileTestUsers] Could not cascade delete from ${tableName}:`, error);
          }
        }
        await ctx.runMutation(internal.audit_logs._createAuditLogInternal, {
          action: 'user_hard_deleted_reconcile',
          target_type: 'user',
          target_id: targetUser._id,
          target_email: targetUser.email,
          target_name: targetUser.name,
          performed_by_id: admin._id,
          performed_by_email: admin.email,
          performed_by_name: admin.name,
          reason: 'Test user permanently deleted (reconcile)',
          metadata: {
            targetRole: targetUser.role,
            targetUniversityId: targetUser.university_id,
            deletedRecordsCount: deletedRecords,
            isTestUser: true,
          },
        });

        await ctx.runMutation(internal.admin_users._deleteUserRecord, {
          userId: targetUser._id,
        });

        // Delete from Clerk (don't fail operation if this fails)
        let clerkDeleted = true;
        let clerkError: string | undefined;
        try {
          await deleteFromClerk(user.clerkId);
        } catch (error) {
          clerkDeleted = false;
          clerkError = error instanceof Error ? error.message : String(error);
          console.error(
            '[ReconcileTestUsers] Failed to delete Clerk account after retries:',
            error,
          );
        }

        results.push({
          clerkId: user.clerkId,
          userId: targetUser._id,
          status: 'deleted',
          deletedRecords,
          ...(clerkError && { error: clerkError }),
        });
      } catch (error) {
        results.push({
          clerkId: user.clerkId,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          deletedRecords,
        });
      }
    }

    return {
      totalCandidates: candidates.length,
      processed: results.length,
      deleted: results.filter((r) => r.status === 'deleted').length,
      failed: results.filter((r) => r.status === 'failed').length,
      results,
    };
  },
});
