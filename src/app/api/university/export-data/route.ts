import { api } from 'convex/_generated/api';
import { NextRequest, NextResponse } from 'next/server';

import { hasUniversityAdminAccess } from '@/lib/constants/roles';
import { requireConvexToken } from '@/lib/convex-auth';
import { convexServer } from '@/lib/convex-server';
import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'university',
    httpMethod: 'POST',
    httpPath: '/api/university/export-data',
  });

  const startTime = Date.now();
  log.info('Export data request started', { event: 'request.start' });

  try {
    // Get authentication from request
    const { userId, token } = await requireConvexToken();
    log.debug('User authenticated', { event: 'auth.success', clerkId: userId });

    let body: any;
    try {
      body = await request.json();
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
    const { clerkId } = body;

    if (!clerkId) {
      log.warn('Missing clerkId', { event: 'validation.failed', errorCode: 'BAD_REQUEST' });
      return NextResponse.json(
        { error: 'Missing clerkId' },
        {
          status: 400,
          headers: { 'x-correlation-id': correlationId },
        },
      );
    }

    // For additional security, verify the clerkId matches the authenticated user
    if (userId !== clerkId) {
      log.warn('ClerkId mismatch', { event: 'auth.forbidden', errorCode: 'FORBIDDEN' });
      return NextResponse.json(
        { error: 'ClerkId mismatch' },
        {
          status: 403,
          headers: { 'x-correlation-id': correlationId },
        },
      );
    }

    // Get the current user to verify admin access
    let user;
    try {
      user = await convexServer.query(api.users.getUserByClerkId, { clerkId }, token);
    } catch (error) {
      log.error('Error fetching user', toErrorCode(error), { event: 'data.fetch_failed' });
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        {
          status: 500,
          headers: { 'x-correlation-id': correlationId },
        },
      );
    }

    if (!user) {
      log.warn('User not found', { event: 'data.not_found', errorCode: 'NOT_FOUND' });
      return NextResponse.json(
        { error: 'User not found' },
        {
          status: 404,
          headers: { 'x-correlation-id': correlationId },
        },
      );
    }

    if (!hasUniversityAdminAccess(user.role)) {
      log.warn('Insufficient permissions', { event: 'auth.forbidden', errorCode: 'FORBIDDEN' });
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        {
          status: 403,
          headers: { 'x-correlation-id': correlationId },
        },
      );
    }

    if (!user.university_id) {
      log.warn('No university assigned', { event: 'validation.failed', errorCode: 'BAD_REQUEST' });
      return NextResponse.json(
        { error: 'No university assigned to user' },
        {
          status: 400,
          headers: { 'x-correlation-id': correlationId },
        },
      );
    }

    // Fetch all relevant data
    let students, departments;
    try {
      [students, departments] = await Promise.all([
        convexServer.query(api.university_admin.listStudents, { clerkId }, token),
        convexServer.query(api.university_admin.listDepartments, { clerkId }, token),
      ]);
    } catch (error) {
      log.error('Error fetching data', toErrorCode(error), { event: 'data.fetch_failed' });
      return NextResponse.json(
        { error: 'Failed to fetch data' },
        {
          status: 500,
          headers: { 'x-correlation-id': correlationId },
        },
      );
    }

    // Generate CSV content
    const csvHeaders = [
      'Name',
      'Email',
      'Role',
      'Department',
      'Account Status',
      'Joined Date',
      'Last Active',
      'Subscription Plan',
    ];

    const csvRows = students.map((student: any) => [
      student.name || '',
      student.email || '',
      student.role || '',
      student.department_id
        ? departments.find((d: any) => d._id === student.department_id)?.name || 'Unknown'
        : 'Unassigned',
      student.account_status || 'active',
      student.created_at ? new Date(student.created_at).toLocaleDateString() : '',
      student.updated_at ? new Date(student.updated_at).toLocaleDateString() : 'Never',
      student.subscription_plan || 'university',
    ]);

    // Escape CSV cells to handle commas, quotes, and prevent CSV injection
    const escapeCSV = (field: string | number) => {
      const stringField = String(field);
      // Prevent CSV injection by quoting cells that start with formula characters
      const formulaChars = ['=', '+', '-', '@', '|'];
      const startsWithFormula = formulaChars.some((char) => stringField.startsWith(char));
      if (
        stringField.includes(',') ||
        stringField.includes('"') ||
        stringField.includes('\n') ||
        startsWithFormula
      ) {
        return `"${stringField.replace(/"/g, '""')}"`;
      }
      return stringField;
    };

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map((row) => row.map(escapeCSV).join(',')),
    ].join('\n');

    const filename = `university-data-export-${new Date().toISOString().split('T')[0]}.csv`;

    const durationMs = Date.now() - startTime;
    log.info('Export data completed', {
      event: 'university.data_exported',
      clerkId: userId,
      httpStatus: 200,
      durationMs,
      extra: { studentCount: students.length },
    });

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'x-correlation-id': correlationId,
      },
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error('Export data error', toErrorCode(error), {
      event: 'request.error',
      httpStatus: 500,
      durationMs,
    });
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}
