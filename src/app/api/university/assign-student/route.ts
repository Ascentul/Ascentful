import { auth, clerkClient } from '@clerk/nextjs/server';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { NextRequest, NextResponse } from 'next/server';

import { ASSIGNABLE_STUDENT_ROLES, hasAdvisorAccess } from '@/lib/constants/roles';
import { convexServer } from '@/lib/convex-server';
import { getErrorMessage } from '@/lib/errors';
import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

/**
 * Assign a student to a university
 *
 * This endpoint:
 * 1. Assigns student in Convex database
 * 2. Syncs university_id to Clerk publicMetadata
 * 3. Ensures student gets premium access
 */
export async function POST(req: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(req);
  const log = createRequestLogger(correlationId, {
    feature: 'university',
    httpMethod: 'POST',
    httpPath: '/api/university/assign-student',
  });

  const startTime = Date.now();
  log.info('Assign student request started', { event: 'request.start' });

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

    const body = await req.json();
    const { clerkId, email, role, departmentId } = body;

    if (!clerkId || !email) {
      return NextResponse.json({ error: 'Missing clerkId or email' }, { status: 400 });
    }

    // Validate departmentId format if provided (Convex will enforce ID validity)
    if (departmentId !== undefined) {
      if (typeof departmentId !== 'string' || !departmentId.trim()) {
        return NextResponse.json({ error: 'Invalid departmentId format' }, { status: 400 });
      }
    }

    // Get the admin's university info
    const adminUser = await convexServer.query(
      api.users.getUserByClerkId,
      { clerkId: userId },
      token,
    );

    if (!adminUser || !adminUser.university_id) {
      return NextResponse.json(
        { error: 'University admin not found or no university assigned' },
        { status: 404 },
      );
    }

    // SECURITY: Role-based access control
    // - hasAdvisorAccess allows super_admin, university_admin, and advisor roles
    // - Combined with university_id check above, this ensures tenant isolation:
    //   - university_admin/advisor can only assign to their own university
    //   - super_admin must also have a university_id to use this endpoint
    if (!hasAdvisorAccess(adminUser.role)) {
      return NextResponse.json(
        {
          error:
            'Insufficient permissions. Only super admins, university admins, and advisors can assign students.',
        },
        { status: 403 },
      );
    }

    // SECURITY: Validate department ownership (if provided)
    if (departmentId !== undefined) {
      const department = await convexServer.query(
        api.departments.getDepartment,
        { departmentId: departmentId as Id<'departments'> },
        token,
      );

      if (!department || department.university_id !== adminUser.university_id) {
        return NextResponse.json(
          { error: 'Department not found or access denied' },
          { status: 403 },
        );
      }
    }

    // Assign student in Convex
    // Note: This mutation should be idempotent - if the student is already assigned,
    // it should update rather than fail, to prevent issues on retry

    // Validate and normalize role
    // Legacy 'user' role is migrated to 'student'
    const normalizedRole = role === 'user' ? 'student' : role;

    // Validate role is in allowed list - reject invalid roles instead of silent fallback
    if (
      normalizedRole &&
      !(ASSIGNABLE_STUDENT_ROLES as readonly string[]).includes(normalizedRole)
    ) {
      log.warn('Invalid role provided for student assignment', {
        event: 'validation.failed',
        errorCode: 'BAD_REQUEST',
        extra: { providedRole: role, allowedRoles: ASSIGNABLE_STUDENT_ROLES },
      });
      return NextResponse.json(
        {
          error: `Invalid role: "${role}". Allowed roles: ${ASSIGNABLE_STUDENT_ROLES.join(', ')}`,
        },
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }

    const assignedRole = normalizedRole || 'student';

    const result = await convexServer.mutation(
      api.university_admin.assignStudentByEmail,
      {
        clerkId: clerkId,
        email: email,
        role: assignedRole,
        departmentId: departmentId as Id<'departments'> | undefined,
      },
      token,
    );

    // Sync to Clerk publicMetadata
    try {
      const client = await clerkClient();
      const users = await client.users.getUserList({
        emailAddress: [email],
      });

      if (users.data && users.data.length > 0) {
        const studentClerkUser = users.data[0];

        await client.users.updateUser(studentClerkUser.id, {
          publicMetadata: {
            ...studentClerkUser.publicMetadata,
            university_id: adminUser.university_id,
            role: assignedRole,
          },
        });

        log.info('Synced Clerk metadata for student', {
          event: 'university.student_clerk_synced',
          extra: {
            studentClerkId: studentClerkUser.id,
            adminClerkId: userId,
          },
        });
      } else {
        log.info('Student user not found in Clerk - will sync on signup', {
          event: 'university.student_pending_sync',
          extra: {
            studentEmail: email,
            adminClerkId: userId,
          },
        });
      }
    } catch (clerkError) {
      // Don't fail the request if Clerk sync fails - the webhook will handle it
      log.warn('Failed to sync Clerk metadata', {
        event: 'university.clerk_sync_failed',
        errorCode: toErrorCode(clerkError),
      });
    }

    const durationMs = Date.now() - startTime;
    log.info('Student assigned successfully', {
      event: 'university.student_assigned',
      clerkId: userId,
      httpStatus: 200,
      durationMs,
    });

    return NextResponse.json(
      {
        success: true,
        result,
        message: 'Student assigned successfully',
      },
      {
        headers: { 'x-correlation-id': correlationId },
      },
    );
  } catch (error: unknown) {
    const durationMs = Date.now() - startTime;
    const message = getErrorMessage(error, 'Internal server error');
    log.error('Assign student request failed', toErrorCode(error), {
      event: 'request.error',
      httpStatus: 500,
      durationMs,
    });
    return NextResponse.json(
      { error: message },
      {
        status: 500,
        headers: { 'x-correlation-id': correlationId },
      },
    );
  }
}
