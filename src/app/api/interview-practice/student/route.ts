/**
 * Student Interview Practice API Route
 *
 * Allows advisors and university admins to view student interview practice data.
 * Requires advisor-level access with proper university isolation.
 *
 * GET: Fetch student's interview practice sessions
 */

import { auth } from '@clerk/nextjs/server';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { NextRequest, NextResponse } from 'next/server';

import { convexServer } from '@/lib/convex-server';
import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'interview-practice',
    httpMethod: 'GET',
    httpPath: '/api/interview-practice/student',
  });

  try {
    const { userId, getToken } = await auth();

    if (!userId) {
      log.warn('Unauthorized: No user ID', { errorCode: 'UNAUTHORIZED' });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = await getToken({ template: 'convex' });
    if (!token) {
      log.warn('Unauthorized: No token', { errorCode: 'UNAUTHORIZED' });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const sessionId = searchParams.get('sessionId');
    const limit = searchParams.get('limit');
    const status = searchParams.get('status') as 'completed' | 'in_progress' | 'abandoned' | null;

    // Get a single session report
    if (sessionId) {
      log.info('Fetching student session report', { event: 'fetch.report', extra: { sessionId } });

      const report = await convexServer.query(
        api.interview_practice.getStudentSessionReport,
        { sessionId: sessionId as Id<'interview_practice_sessions'> },
        token,
      );

      return NextResponse.json({ report });
    }

    // Get list of sessions for a student
    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
    }

    log.info('Fetching student sessions', { event: 'fetch.sessions', extra: { studentId } });

    const sessions = await convexServer.query(
      api.interview_practice.getStudentSessions,
      {
        studentId: studentId as Id<'users'>,
        status: status || undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      },
      token,
    );

    return NextResponse.json({ sessions });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch student data';
    log.error('Error fetching student interview data', toErrorCode(error), {
      event: 'request.error',
    });

    // Return appropriate status based on error type
    if (message.includes('Unauthorized') || message.includes('Forbidden')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
