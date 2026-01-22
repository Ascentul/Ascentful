import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
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
    httpPath: '/api/university/export-reports',
  });

  const startTime = Date.now();
  log.info('Export reports request started', { event: 'request.start' });

  try {
    // Get authentication from request
    const authResult = await requireConvexToken();
    const userId = authResult.userId;
    const token = authResult.token;
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
      log.error('Error fetching user by clerkId', toErrorCode(error), {
        event: 'data.fetch_failed',
      });
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

    // Get university data
    let universityId = user.university_id;

    // If university admin user doesn't have university_id, try to find university by admin_email
    if (!universityId && user.role === 'university_admin' && user.email) {
      try {
        // Use indexed query for efficient lookup instead of fetching all universities
        const matchingUniversity = (await convexServer.query(
          api.universities_queries.getUniversityByAdminEmail,
          { email: user.email },
          token,
        )) as any;

        if (matchingUniversity) {
          universityId = matchingUniversity._id;

          // SECURITY: Log this auto-assignment for audit trail
          // Note: Using user._id instead of email for privacy compliance (GDPR/CCPA/FERPA)
          log.warn('Auto-assigning university_id for admin', {
            event: 'security.auto_assignment',
            extra: {
              userId: user._id,
              universityId,
              universityName: matchingUniversity.name,
              reason: 'Account not properly configured during creation',
            },
          });

          // Update user's university_id for future requests.
          // Note: university_id is supplementary data, not a role. The Clerk-first pattern
          // (update publicMetadata, then sync via webhook) applies to role changes.
          // This is a one-time fix for improperly configured accounts. Ideally, university_id
          // should be set correctly during account creation in Clerk publicMetadata.
          await convexServer.mutation(
            api.users.updateUser,
            {
              clerkId,
              updates: { university_id: universityId },
            },
            token,
          );

          // COMPLIANCE: Persistent audit log for this security-sensitive auto-assignment
          try {
            await convexServer.mutation(
              api.audit_logs.createSystemAuditLog,
              {
                action: 'university_admin_auto_assigned',
                target_type: 'user',
                target_id: user._id,
                reason: `Auto-assigned university_id based on admin_email match during export-reports`,
                metadata: {
                  university_id: universityId,
                  university_name: matchingUniversity.name,
                  trigger: 'export_reports_endpoint',
                  // PII excluded for GDPR/CCPA compliance - user identified by target_id
                },
              },
              token,
            );
          } catch (auditError) {
            log.warn('Failed to create audit log for auto-assignment', {
              event: 'audit.log_failed',
              errorCode: toErrorCode(auditError),
            });
            // Don't fail the operation if audit logging fails
          }
        }
      } catch (error) {
        log.error('Error finding university for admin', toErrorCode(error), {
          event: 'data.fetch_failed',
        });
      }
    }

    if (!universityId) {
      // For university admin users, they should have a university_id
      // If they don't, provide a helpful error message
      if (user.role === 'university_admin') {
        log.warn('University admin account not properly configured', {
          event: 'validation.failed',
          errorCode: 'BAD_REQUEST',
        });
        return NextResponse.json(
          {
            error:
              'University admin account not properly configured. Please contact support to assign your account to a university.',
          },
          { status: 400, headers: { 'x-correlation-id': correlationId } },
        );
      }
      log.warn('No university assigned to user', {
        event: 'validation.failed',
        errorCode: 'BAD_REQUEST',
      });
      return NextResponse.json(
        { error: 'No university assigned to user' },
        {
          status: 400,
          headers: { 'x-correlation-id': correlationId },
        },
      );
    }

    // Fetch all relevant data including per-student metrics
    let students, departments, studentProgress;
    try {
      [students, departments, studentProgress] = await Promise.all([
        convexServer.query(api.university_admin.listStudents, { clerkId, limit: 1000 }, token),
        convexServer.query(api.university_admin.listDepartments, { clerkId }, token),
        convexServer.query(api.university_admin.getStudentProgress, { clerkId }, token),
      ]);
    } catch (error) {
      log.error('Error fetching university data', toErrorCode(error), {
        event: 'data.fetch_failed',
      });
      return NextResponse.json(
        { error: 'Failed to fetch university data' },
        {
          status: 500,
          headers: { 'x-correlation-id': correlationId },
        },
      );
    }

    // Create a map of student progress by student ID for fast lookup
    const progressMap = new Map((studentProgress as any[]).map((p) => [String(p.studentId), p]));

    // Generate CSV content
    const csvHeaders = [
      'Name',
      'Email',
      'Role',
      'Department',
      'Joined Date',
      'Last Updated',
      'Goals Set',
      'Applications Submitted',
      'Resumes Created',
      'Cover Letters Created',
    ];

    const csvRows = students.map((student) => {
      // Get actual metrics from studentProgress query
      const progress = progressMap.get(String(student._id)) || {
        goals: 0,
        applications: 0,
        resumes: 0,
        coverLetters: 0,
      };

      return [
        student.name || '',
        student.email || '',
        student.role || '',
        student.department_id
          ? departments.find((d) => d._id === (student.department_id as any))?.name || ''
          : '',
        student.created_at ? new Date(student.created_at).toLocaleDateString() : '',
        student.updated_at ? new Date(student.updated_at).toLocaleDateString() : '',
        progress.goals ?? 0,
        progress.applications ?? 0,
        progress.resumes ?? 0,
        progress.coverLetters ?? 0,
      ];
    });

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

    const filename = `university-report-${new Date().toISOString().split('T')[0]}.csv`;

    const durationMs = Date.now() - startTime;
    log.info('Export reports completed', {
      event: 'university.reports_exported',
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
    log.error('Export reports error', toErrorCode(error), {
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
