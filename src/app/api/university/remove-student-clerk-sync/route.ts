import { auth, clerkClient } from '@clerk/nextjs/server';
import { api } from 'convex/_generated/api';
import { NextRequest, NextResponse } from 'next/server';

import { hasPlatformAdminAccess, hasUniversityAdminAccess } from '@/lib/constants/roles';
import { convexServer } from '@/lib/convex-server';
import { getErrorMessage } from '@/lib/errors';
import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

/**
 * Type guard to check if an error is a Clerk API error
 * Clerk API errors have a `clerkError: true` flag and a `status` property
 */
function isClerkApiError(
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
 * Sync role change to Clerk when removing a student from university
 *
 * When a university admin removes a student, the Convex mutation updates the
 * Convex role to 'individual'. This endpoint syncs that change to Clerk's
 * publicMetadata to maintain consistency (Clerk is the source of truth for auth).
 *
 * Updates:
 * - Sets role to 'individual'
 * - Clears university_id from publicMetadata
 */
export async function POST(req: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(req);
  const log = createRequestLogger(correlationId, {
    feature: 'university',
    httpMethod: 'POST',
    httpPath: '/api/university/remove-student-clerk-sync',
  });

  const startTime = Date.now();
  log.info('Remove student Clerk sync request started', { event: 'request.start' });

  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      log.warn('User not authenticated', { event: 'auth.failed', errorCode: 'UNAUTHORIZED' });
      return NextResponse.json(
        { error: 'Unauthorized' },
        {
          status: 401,
          headers: { 'x-correlation-id': correlationId },
        },
      );
    }
    log.debug('User authenticated', { event: 'auth.success', clerkId: userId });

    const token = await getToken({ template: 'convex' });
    if (!token) {
      log.warn('Failed to obtain auth token', {
        event: 'auth.token_failed',
        errorCode: 'UNAUTHORIZED',
      });
      return NextResponse.json(
        { error: 'Failed to obtain auth token' },
        {
          status: 401,
          headers: { 'x-correlation-id': correlationId },
        },
      );
    }

    let body: { studentClerkId?: string; universityId?: string };
    try {
      body = await req.json();
    } catch {
      log.warn('Invalid JSON in request body', {
        event: 'validation.failed',
        errorCode: 'BAD_REQUEST',
      });
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        {
          status: 400,
          headers: { 'x-correlation-id': correlationId },
        },
      );
    }
    const { studentClerkId, universityId } = body;

    if (!studentClerkId?.trim() || !universityId?.trim()) {
      log.warn('Missing required fields', { event: 'validation.failed', errorCode: 'BAD_REQUEST' });
      return NextResponse.json(
        { error: 'Missing studentClerkId or universityId' },
        {
          status: 400,
          headers: { 'x-correlation-id': correlationId },
        },
      );
    }

    // Verify the requester is a university admin
    const adminUser = await convexServer.query(
      api.users.getUserByClerkId,
      {
        clerkId: userId,
      },
      token,
    );

    if (!adminUser || !hasUniversityAdminAccess(adminUser.role)) {
      log.warn('Forbidden - not a university admin', {
        event: 'auth.forbidden',
        errorCode: 'FORBIDDEN',
      });
      return NextResponse.json(
        { error: 'Forbidden: University admin access required' },
        {
          status: 403,
          headers: { 'x-correlation-id': correlationId },
        },
      );
    }

    // Verify the admin belongs to this university (unless super_admin)
    if (!hasPlatformAdminAccess(adminUser.role) && adminUser.university_id !== universityId) {
      log.warn('Admin attempting cross-university removal', {
        event: 'auth.forbidden',
        errorCode: 'FORBIDDEN',
      });
      return NextResponse.json(
        { error: 'Cannot remove students from other universities' },
        { status: 403, headers: { 'x-correlation-id': correlationId } },
      );
    }

    const client = await clerkClient();

    // Get the student's current Clerk user
    let studentClerkUser;
    try {
      studentClerkUser = await client.users.getUser(studentClerkId);
    } catch (clerkError: unknown) {
      // Distinguish Clerk API errors from other failures
      if (isClerkApiError(clerkError)) {
        if (clerkError.status === 404) {
          // User genuinely doesn't exist - idempotent success
          log.warn('Student not found in Clerk', {
            event: 'clerk.user_not_found',
          });
          return NextResponse.json(
            {
              success: true,
              message: 'Student not found in Clerk (may already be removed)',
              userFound: false,
            },
            { headers: { 'x-correlation-id': correlationId } },
          );
        }
        // Non-404 Clerk API error (auth, rate limit, service issue)
        log.error('Clerk API error fetching student', toErrorCode(clerkError), {
          event: 'clerk.api_error',
        });
      }
      // Re-throw to be handled by outer error handler
      throw clerkError;
    }

    // Verify the student belongs to this university before updating
    const studentCurrentUniversityId = studentClerkUser.publicMetadata?.university_id as
      | string
      | undefined;
    if (!studentCurrentUniversityId || studentCurrentUniversityId !== universityId) {
      log.warn('Student does not belong to this university', {
        event: 'auth.forbidden',
        errorCode: 'FORBIDDEN',
      });
      return NextResponse.json(
        { error: 'Student does not belong to this university' },
        { status: 403, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Update Clerk publicMetadata: set role to 'individual' and clear university_id
    // Preserve other metadata fields
    const { university_id: _removed, ...restMetadata } = studentClerkUser.publicMetadata as Record<
      string,
      unknown
    >;
    await client.users.updateUser(studentClerkId, {
      publicMetadata: {
        ...restMetadata,
        role: 'individual',
        // university_id is intentionally omitted (cleared)
      },
    });

    const durationMs = Date.now() - startTime;
    log.info('Student Clerk metadata updated for removal', {
      event: 'university.student_removed_clerk_synced',
      clerkId: userId,
      httpStatus: 200,
      durationMs,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Student role updated to individual in Clerk',
        userFound: true,
      },
      { headers: { 'x-correlation-id': correlationId } },
    );
  } catch (error: unknown) {
    const durationMs = Date.now() - startTime;
    log.error('Remove student Clerk sync error', toErrorCode(error), {
      event: 'request.error',
      httpStatus: 500,
      durationMs,
    });
    const message = getErrorMessage(error, 'Internal server error');
    return NextResponse.json(
      { error: message },
      {
        status: 500,
        headers: { 'x-correlation-id': correlationId },
      },
    );
  }
}
