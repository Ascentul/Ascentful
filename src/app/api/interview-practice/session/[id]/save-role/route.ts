/**
 * Interview Practice - Save Role from Session API
 *
 * POST: Save a role from a session's embedded snapshot
 */

import { auth } from '@clerk/nextjs/server';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { NextRequest, NextResponse } from 'next/server';

import { convexServer } from '@/lib/convex-server';
import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/interview-practice/session/[id]/save-role
 * Save a role from a session's embedded snapshot
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: sessionId } = await params;
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'interview-practice',
    httpMethod: 'POST',
    httpPath: `/api/interview-practice/session/${sessionId}/save-role`,
  });

  const startTime = Date.now();
  log.info('Save role from session request', { event: 'request.start', extra: { sessionId } });

  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      log.warn('Unauthorized request', { event: 'auth.failed', errorCode: 'UNAUTHORIZED' });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: { 'x-correlation-id': correlationId } },
      );
    }
    const token = await getToken({ template: 'convex' });
    if (!token) {
      return NextResponse.json(
        { error: 'Failed to obtain auth token' },
        { status: 401, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Save role from session using Convex mutation
    const profileId = await convexServer.mutation(
      api.interview_practice.saveRoleFromSession,
      {
        sessionId: sessionId as Id<'interview_practice_sessions'>,
        linkToSession: true,
      },
      token,
    );

    // Get the created profile
    const profile = await convexServer.query(
      api.interview_practice.getRoleProfile,
      { profileId },
      token,
    );

    const durationMs = Date.now() - startTime;
    log.info('Role saved from session', {
      event: 'request.success',
      httpStatus: 201,
      durationMs,
      extra: { sessionId, profileId },
    });

    return NextResponse.json(
      { profileId, profile },
      { status: 201, headers: { 'x-correlation-id': correlationId } },
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error('Save role from session failed', toErrorCode(error), {
      event: 'request.error',
      httpStatus: 500,
      durationMs,
    });
    return NextResponse.json(
      { error: errorMessage || 'Failed to save role' },
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}
