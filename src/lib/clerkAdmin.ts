/**
 * Clerk Admin API utilities
 * Server-side helpers for managing Clerk users via the Backend API
 */

import { clerkClient } from '@clerk/nextjs/server';

/**
 * Type guard to check if an error is a Clerk API error
 * Clerk API errors have a `clerkError: true` flag and a `status` property
 */
export function isClerkApiError(
  error: unknown,
): error is { clerkError: true; status: number; clerkTraceId?: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'clerkError' in error &&
    (error as Record<string, unknown>).clerkError === true &&
    'status' in error &&
    typeof (error as Record<string, unknown>).status === 'number'
  );
}

/**
 * Disable a Clerk user (prevents login but preserves identity)
 * Used for soft-deleted users to maintain FERPA compliance
 */
export async function disableClerkUser(clerkId: string): Promise<void> {
  try {
    const client = await clerkClient();

    // Ban the user in Clerk (prevents login but keeps data)
    await client.users.banUser(clerkId);

    console.log(`Clerk user disabled: ${clerkId}`);
  } catch (error) {
    console.error(`Failed to disable Clerk user ${clerkId}:`, error);
    throw new Error(`Failed to disable user in Clerk: ${error}`);
  }
}

/**
 * Enable a Clerk user (restores login access)
 * Used when un-deleting a soft-deleted user
 */
export async function enableClerkUser(clerkId: string): Promise<void> {
  try {
    const client = await clerkClient();

    // Unban the user in Clerk
    await client.users.unbanUser(clerkId);

    console.log(`Clerk user enabled: ${clerkId}`);
  } catch (error) {
    console.error(`Failed to enable Clerk user ${clerkId}:`, error);
    throw new Error(`Failed to enable user in Clerk: ${error}`);
  }
}

/**
 * Permanently delete a Clerk user identity
 * ONLY use for test users - this is irreversible
 */
export async function deleteClerkUser(clerkId: string): Promise<void> {
  try {
    const client = await clerkClient();

    // Permanently delete the user from Clerk
    await client.users.deleteUser(clerkId);

    console.log(`Clerk user permanently deleted: ${clerkId}`);
  } catch (error) {
    console.error(`Failed to delete Clerk user ${clerkId}:`, error);
    throw new Error(`Failed to delete user from Clerk: ${error}`);
  }
}

/**
 * Check if a Clerk user is banned
 */
export async function isClerkUserBanned(clerkId: string): Promise<boolean> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(clerkId);

    return user.banned || false;
  } catch (error) {
    console.error(`Failed to check Clerk user ban status ${clerkId}:`, error);
    return false;
  }
}

/**
 * Update Clerk user metadata
 * Useful for syncing deletion status to Clerk's publicMetadata
 */
export async function updateClerkUserMetadata(
  clerkId: string,
  metadata: Record<string, any>,
): Promise<void> {
  try {
    const client = await clerkClient();

    await client.users.updateUserMetadata(clerkId, {
      publicMetadata: metadata,
    });

    console.log(`Clerk user metadata updated: ${clerkId}`);
  } catch (error) {
    console.error(`Failed to update Clerk user metadata ${clerkId}:`, error);
    throw new Error(`Failed to update user metadata in Clerk: ${error}`);
  }
}
