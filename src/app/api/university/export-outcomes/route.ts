import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { NextRequest, NextResponse } from 'next/server';

import { hasUniversityAdminAccess } from '@/lib/constants/roles';
import { requireConvexToken } from '@/lib/convex-auth';
import { convexServer } from '@/lib/convex-server';
import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface ExportFilters {
  cohortIds?: string[];
  degreeLevels?: string[];
  programs?: string[];
  graduationYear?: number;
}

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'university',
    httpMethod: 'POST',
    httpPath: '/api/university/export-outcomes',
  });

  const startTime = Date.now();
  log.info('Export outcomes request started', { event: 'request.start' });

  try {
    // Get authentication from request
    const { userId, token } = await requireConvexToken();
    log.debug('User authenticated', { event: 'auth.success', clerkId: userId });

    let body: { clerkId: string; filters?: ExportFilters; snapshotId?: string };
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
    const { clerkId, filters, snapshotId } = body;

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

    let outcomeData: {
      outcomes: Array<{
        external_student_id?: string;
        student_name?: string;
        student_email?: string;
        cohort_name?: string;
        outcome_status: string;
        outcome_type?: string;
        employer_name?: string;
        job_title?: string;
        is_verified?: boolean;
        confidence_score?: number;
        evidence_files?: Array<{ id: string; name: string; type: string }>;
        data_source?: string;
        updated_at: number;
      }>;
      summary: {
        total_students: number;
        known_outcomes: number;
        unknown_outcomes: number;
        partial_outcomes: number;
        knowledge_rate: number;
        employment_rate: number;
        continuing_ed_rate: number;
      };
    };

    // If snapshotId provided, get data from snapshot
    // Otherwise, get live data with filters
    if (snapshotId) {
      try {
        const snapshot = await convexServer.query(
          api.graduation_outcomes.getSnapshot,
          { snapshotId: snapshotId as Id<'outcome_snapshots'> },
          token,
        );

        if (!snapshot) {
          log.warn('Snapshot not found', { event: 'data.not_found', errorCode: 'NOT_FOUND' });
          return NextResponse.json(
            { error: 'Snapshot not found' },
            {
              status: 404,
              headers: { 'x-correlation-id': correlationId },
            },
          );
        }

        // For snapshot export, we need to re-fetch the outcomes with the snapshot's filters
        const analytics = await convexServer.query(
          api.graduation_outcomes.getOutcomesAnalytics,
          {
            institutionId: user.university_id,
            cohortIds: snapshot.filters.cohort_ids || undefined,
            degreeLevels: snapshot.filters.degree_levels || undefined,
            programs: snapshot.filters.programs || undefined,
            graduationYear: snapshot.filters.graduation_year || undefined,
          },
          token,
        );

        outcomeData = {
          outcomes: analytics.outcomes,
          summary: snapshot.metrics,
        };
      } catch (error) {
        log.error('Error fetching snapshot', toErrorCode(error), { event: 'data.fetch_failed' });
        return NextResponse.json(
          { error: 'Failed to fetch snapshot data' },
          {
            status: 500,
            headers: { 'x-correlation-id': correlationId },
          },
        );
      }
    } else {
      // Fetch live data with filters
      try {
        const analytics = await convexServer.query(
          api.graduation_outcomes.getOutcomesAnalytics,
          {
            institutionId: user.university_id,
            cohortIds: filters?.cohortIds?.map((id) => id as Id<'graduation_cohorts'>),
            degreeLevels: filters?.degreeLevels,
            programs: filters?.programs,
            graduationYear: filters?.graduationYear,
          },
          token,
        );

        outcomeData = {
          outcomes: analytics.outcomes,
          summary: analytics.summary,
        };
      } catch (error) {
        log.error('Error fetching outcomes', toErrorCode(error), { event: 'data.fetch_failed' });
        return NextResponse.json(
          { error: 'Failed to fetch outcomes data' },
          {
            status: 500,
            headers: { 'x-correlation-id': correlationId },
          },
        );
      }
    }

    // Generate CSV content
    const csvHeaders = [
      'external_student_id',
      'student_name',
      'student_email',
      'cohort_name',
      'outcome_status',
      'outcome_type',
      'employer_name',
      'job_title',
      'is_verified',
      'confidence_score',
      'evidence_count',
      'data_source',
      'last_updated',
    ];

    const csvRows = outcomeData.outcomes.map((outcome) => [
      outcome.external_student_id || '',
      outcome.student_name || '',
      outcome.student_email || '',
      outcome.cohort_name || '',
      outcome.outcome_status || '',
      outcome.outcome_type || '',
      outcome.employer_name || '',
      outcome.job_title || '',
      outcome.is_verified ? 'true' : 'false',
      outcome.confidence_score?.toString() || '',
      outcome.evidence_files?.length?.toString() || '0',
      outcome.data_source || '',
      outcome.updated_at ? new Date(outcome.updated_at).toISOString().split('T')[0] : '',
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

    const filename = `outcomes-export-${new Date().toISOString().split('T')[0]}.csv`;

    const durationMs = Date.now() - startTime;
    log.info('Export outcomes completed', {
      event: 'university.outcomes_exported',
      clerkId: userId,
      httpStatus: 200,
      durationMs,
      extra: {
        outcomeCount: outcomeData.outcomes.length,
        knowledgeRate: outcomeData.summary.knowledge_rate,
        employmentRate: outcomeData.summary.employment_rate,
      },
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
    log.error('Export outcomes error', toErrorCode(error), {
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
