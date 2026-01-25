import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { NextRequest, NextResponse } from 'next/server';

import { hasUniversityAdminAccess } from '@/lib/constants/roles';
import { requireConvexToken } from '@/lib/convex-auth';
import { convexServer } from '@/lib/convex-server';
import { csvFilename, OUTCOME_CSV_FIELDS, toCSV } from '@/lib/csv-utils';
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
    // Get authentication from request - userId is derived from session, not client
    const { userId, token } = await requireConvexToken();
    log.debug('User authenticated', { event: 'auth.success', clerkId: userId });

    let body: { filters?: ExportFilters; snapshotId?: string };
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
    const { filters, snapshotId } = body;

    // Get the current user to verify admin access using server-side authenticated userId
    let user;
    try {
      user = await convexServer.query(api.users.getUserByClerkId, { clerkId: userId }, token);
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

        // Verify snapshot belongs to user's university
        if (snapshot.institution_id !== user.university_id) {
          log.warn('Snapshot institution mismatch', {
            event: 'auth.forbidden',
            errorCode: 'FORBIDDEN',
          });
          return NextResponse.json(
            { error: 'Access denied to this snapshot' },
            {
              status: 403,
              headers: { 'x-correlation-id': correlationId },
            },
          );
        }

        // For snapshot export, re-fetch outcomes with the snapshot's filters
        // Use live analytics.summary for consistency with live outcomes data
        // (snapshot.metrics is point-in-time and may be stale)
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
          summary: analytics.summary,
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

    // Generate CSV content using shared field definitions
    const csvHeaders = OUTCOME_CSV_FIELDS.map((f) => f.header);
    const csvRows = outcomeData.outcomes.map((outcome) =>
      OUTCOME_CSV_FIELDS.map((f) => f.getValue(outcome)),
    );

    const csvContent = toCSV(csvHeaders, csvRows);
    const filename = csvFilename('outcomes-export');

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
