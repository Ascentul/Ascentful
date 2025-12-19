import { clerkClient } from '@clerk/nextjs/server';
import { api } from 'convex/_generated/api';
import { NextRequest, NextResponse } from 'next/server';

import { requireConvexToken } from '@/lib/convex-auth';
import { convexServer } from '@/lib/convex-server';
import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';
import { ClerkPublicMetadata } from '@/types/clerk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Grant or revoke Pro subscription access for a user (Admin-granted, not billed)
 *
 * This endpoint:
 * 1. Verifies caller is super_admin
 * 2. Updates Clerk publicMetadata with admin-granted subscription
 * 3. Syncs to Convex (webhook will also sync, but we do it directly for immediate effect)
 *
 * POST /api/admin/users/grant-pro-access
 * Body: { userId: string, grantAccess: boolean, reason?: string }
 */
export async function POST(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'admin',
    httpMethod: 'POST',
    httpPath: '/api/admin/users/grant-pro-access',
  });

  const startTime = Date.now();
  log.info('Pro access grant request started', { event: 'request.start' });

  try {
    const { userId, token } = await requireConvexToken();
    log.debug('User authenticated', { event: 'auth.success', clerkId: userId });

    // Get caller's role from Clerk
    const client = await clerkClient();
    const caller = await client.users.getUser(userId);
    const callerRole = (caller.publicMetadata as ClerkPublicMetadata)?.role;

    // Only super_admin can grant pro access
    if (callerRole !== 'super_admin') {
      log.warn('Forbidden - not super_admin', {
        event: 'auth.forbidden',
        errorCode: 'FORBIDDEN',
        extra: { callerRole },
      });
      return NextResponse.json(
        { error: 'Forbidden - Only super admins can grant pro access' },
        {
          status: 403,
          headers: { 'x-correlation-id': correlationId },
        },
      );
    }

    const body = await request.json();
    const { userId: targetUserId, grantAccess, reason } = body;

    if (!targetUserId || typeof grantAccess !== 'boolean') {
      log.warn('Missing required fields', { event: 'validation.failed', errorCode: 'BAD_REQUEST' });
      return NextResponse.json(
        { error: 'Missing required fields: userId, grantAccess (boolean)' },
        {
          status: 400,
          headers: { 'x-correlation-id': correlationId },
        },
      );
    }

    // Get target user from Clerk
    let targetUser;
    try {
      targetUser = await client.users.getUser(targetUserId);
    } catch (error: unknown) {
      const errorObj = error as { status?: number; errors?: Array<{ code?: string }> };
      if (errorObj?.status === 404 || errorObj?.errors?.[0]?.code === 'resource_not_found') {
        log.warn('Target user not found', { event: 'data.not_found', errorCode: 'NOT_FOUND' });
        return NextResponse.json(
          { error: 'User not found' },
          {
            status: 404,
            headers: { 'x-correlation-id': correlationId },
          },
        );
      }
      throw error;
    }

    const currentMetadata = targetUser.publicMetadata as ClerkPublicMetadata;
    const currentRole = currentMetadata?.role;

    // Prevent granting pro access to university-affiliated users (they already have access)
    if (
      currentRole === 'student' ||
      currentRole === 'university_admin' ||
      currentRole === 'advisor'
    ) {
      log.warn('Cannot grant pro to university user', {
        event: 'validation.failed',
        errorCode: 'BAD_REQUEST',
        extra: { currentRole },
      });
      return NextResponse.json(
        {
          error:
            'University-affiliated users already have premium access through their institution. No need to grant pro access.',
        },
        {
          status: 400,
          headers: { 'x-correlation-id': correlationId },
        },
      );
    }

    // Prevent granting pro access to staff/admins (they have full access)
    if (currentRole === 'super_admin' || currentRole === 'staff') {
      log.warn('Cannot grant pro to staff/admin', {
        event: 'validation.failed',
        errorCode: 'BAD_REQUEST',
        extra: { currentRole },
      });
      return NextResponse.json(
        { error: 'Staff and admin users already have full platform access.' },
        {
          status: 400,
          headers: { 'x-correlation-id': correlationId },
        },
      );
    }

    // Build new metadata with admin-granted subscription
    // Using a specific structure that the webhook will recognize
    const newMetadata: Record<string, unknown> = {
      ...currentMetadata,
    };

    if (grantAccess) {
      // Grant pro access - set admin_granted_subscription
      newMetadata.admin_granted_subscription = {
        plan: 'premium_monthly',
        status: 'active',
        granted_by: userId,
        granted_at: new Date().toISOString(),
        reason: reason || 'Admin granted pro access',
      };
      // Also set the billing fields that the webhook looks for
      newMetadata.billing = {
        plan: 'premium_monthly',
        status: 'active',
      };
    } else {
      // Revoke pro access - remove admin-granted subscription
      delete newMetadata.admin_granted_subscription;
      delete newMetadata.billing;
      // Also clean up any subscriptions array if it exists
      if (Array.isArray(newMetadata.subscriptions)) {
        newMetadata.subscriptions = (newMetadata.subscriptions as any[]).filter(
          (sub) => sub.plan !== 'premium_monthly' || sub.admin_granted !== true,
        );
      }
    }

    // Update Clerk metadata
    await client.users.updateUser(targetUserId, {
      publicMetadata: newMetadata,
    });

    log.info('Clerk metadata updated', {
      event: 'clerk.metadata.updated',
      extra: { grantAccess, targetUserId },
    });

    // Also update Convex directly for immediate effect
    // The webhook will also sync, but this ensures immediate visibility
    try {
      await convexServer.mutation(
        api.users.updateSubscriptionByIdentifier,
        {
          clerkId: targetUserId,
          subscription_plan: grantAccess ? 'premium' : 'free',
          subscription_status: 'active',
        },
        token,
      );
      log.info('Convex subscription updated directly', { event: 'convex.sync.success' });
    } catch (convexError: any) {
      // Log but don't fail - webhook will sync eventually
      log.warn('Direct Convex sync failed (webhook will sync)', {
        event: 'convex.sync.failed',
        errorCode: toErrorCode(convexError),
        extra: { message: convexError?.message },
      });
    }

    const durationMs = Date.now() - startTime;
    log.info('Pro access updated successfully', {
      event: 'admin.pro_access.updated',
      clerkId: userId,
      httpStatus: 200,
      durationMs,
      extra: {
        targetUserId,
        grantAccess,
        reason: reason || 'No reason provided',
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: grantAccess
          ? 'Pro access granted successfully. User now has premium features.'
          : 'Pro access revoked. User is now on the free plan.',
        user: {
          id: targetUser.id,
          email: targetUser.emailAddresses[0]?.emailAddress || 'no-email',
          newPlan: grantAccess ? 'premium' : 'free',
        },
      },
      {
        headers: { 'x-correlation-id': correlationId },
      },
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const message = error instanceof Error ? error.message : 'Failed to update pro access';
    const status =
      message === 'Unauthorized' || message === 'Failed to obtain auth token' ? 401 : 500;
    log.error('Pro access request failed', toErrorCode(error), {
      event: 'request.error',
      httpStatus: status,
      durationMs,
    });
    return NextResponse.json(
      { error: message },
      {
        status,
        headers: { 'x-correlation-id': correlationId },
      },
    );
  }
}
