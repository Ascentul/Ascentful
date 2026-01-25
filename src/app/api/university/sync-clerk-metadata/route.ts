import { auth, clerkClient } from '@clerk/nextjs/server';
import { api } from 'convex/_generated/api';
import { NextRequest, NextResponse } from 'next/server';

import { hasPlatformAdminAccess, hasUniversityAdminAccess } from '@/lib/constants/roles';
import { convexServer } from '@/lib/convex-server';
import { getErrorMessage } from '@/lib/errors';
import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

/**
 * Sync university assignment to Clerk publicMetadata
 *
 * This endpoint ensures that when a university admin assigns a student,
 * the student's Clerk account is updated with university_id in publicMetadata.
 * This allows the subscription hook to properly recognize university students
 * and grant them premium access.
 */
export async function POST(req: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(req);
  const log = createRequestLogger(correlationId, {
    feature: 'university',
    httpMethod: 'POST',
    httpPath: '/api/university/sync-clerk-metadata',
  });

  const startTime = Date.now();
  log.info('Sync Clerk metadata request started', { event: 'request.start' });

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

    let body: any;
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
    const { studentEmail: rawEmail, universityId: rawUniversityId } = body;

    // Normalize and validate inputs
    const studentEmail = typeof rawEmail === 'string' ? rawEmail.trim() : '';
    const universityId = typeof rawUniversityId === 'string' ? rawUniversityId.trim() : '';

    if (!studentEmail || !universityId) {
      log.warn('Missing required fields', { event: 'validation.failed', errorCode: 'BAD_REQUEST' });
      return NextResponse.json(
        { error: 'Missing studentEmail or universityId' },
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
      log.warn('Admin attempting cross-university assignment', {
        event: 'auth.forbidden',
        errorCode: 'FORBIDDEN',
      });
      return NextResponse.json(
        { error: 'Cannot assign students to other universities' },
        { status: 403, headers: { 'x-correlation-id': correlationId } },
      );
    }

    const client = await clerkClient();

    // Find the student by email in Clerk
    const users = await client.users.getUserList({
      emailAddress: [studentEmail],
    });

    if (!users.data || users.data.length === 0) {
      // Student doesn't have a Clerk account yet - they'll get the metadata when they sign up
      const durationMs = Date.now() - startTime;
      log.info('Student not yet registered', {
        event: 'university.student_pending_sync',
        clerkId: userId,
        httpStatus: 200,
        durationMs,
      });
      return NextResponse.json(
        {
          success: true,
          message: 'Student not yet registered. Metadata will be set upon signup.',
          userFound: false,
        },
        { headers: { 'x-correlation-id': correlationId } },
      );
    }

    const studentClerkUser = users.data[0];

    // Update Clerk publicMetadata with university_id
    await client.users.updateUser(studentClerkUser.id, {
      publicMetadata: {
        ...studentClerkUser.publicMetadata,
        university_id: universityId,
        // Set role to 'user' if not already set (students are regular users with university plan)
        role: studentClerkUser.publicMetadata.role || 'user',
      },
    });

    const durationMs = Date.now() - startTime;
    log.info('Clerk metadata updated successfully', {
      event: 'university.clerk_metadata_synced',
      clerkId: userId,
      httpStatus: 200,
      durationMs,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Clerk metadata updated successfully',
        userFound: true,
      },
      { headers: { 'x-correlation-id': correlationId } },
    );
  } catch (error: unknown) {
    const durationMs = Date.now() - startTime;
    log.error('Sync Clerk metadata error', toErrorCode(error), {
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
