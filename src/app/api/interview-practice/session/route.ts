/**
 * Interview Practice - Session API
 *
 * POST: Create a new interview session
 * GET: List user's sessions
 */

import { auth } from '@clerk/nextjs/server';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { NextRequest, NextResponse } from 'next/server';

import { convexServer } from '@/lib/convex-server';
import type { SessionCreateInput, SessionMode } from '@/lib/interview-practice/types';
import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

export const runtime = 'nodejs';

/**
 * POST /api/interview-practice/session
 * Create a new interview session
 */
export async function POST(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'interview-practice',
    httpMethod: 'POST',
    httpPath: '/api/interview-practice/session',
  });

  const startTime = Date.now();
  log.info('Session creation request started', { event: 'request.start' });

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

    log.debug('User authenticated', { event: 'auth.success', clerkId: userId });

    const body = (await request.json()) as SessionCreateInput;
    const { role_profile_id, mode, camera_enabled, question_count_target, consent } = body;

    // Validation
    if (!role_profile_id) {
      log.warn('Missing role profile ID', { event: 'validation.failed', errorCode: 'BAD_REQUEST' });
      return NextResponse.json(
        { error: 'Role profile ID is required' },
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }

    if (!mode || !['neutral', 'supportive', 'pressure'].includes(mode)) {
      log.warn('Invalid mode', { event: 'validation.failed', errorCode: 'BAD_REQUEST' });
      return NextResponse.json(
        { error: 'Invalid mode. Must be: neutral, supportive, or pressure' },
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }

    if (!question_count_target || question_count_target < 3 || question_count_target > 15) {
      log.warn('Invalid question count', { event: 'validation.failed', errorCode: 'BAD_REQUEST' });
      return NextResponse.json(
        { error: 'Question count must be between 3 and 15' },
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }

    if (!consent || !consent.mic) {
      log.warn('Missing mic consent', { event: 'validation.failed', errorCode: 'BAD_REQUEST' });
      return NextResponse.json(
        { error: 'Microphone consent is required' },
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Create session in Convex
    const sessionId = await convexServer.mutation(
      api.interview_practice.createSession,
      {
        role_profile_id: role_profile_id as Id<'interview_role_profiles'>,
        mode: mode as SessionMode,
        camera_enabled: camera_enabled ?? false,
        question_count_target,
        consent: {
          mic: consent.mic,
          camera: consent.camera ?? false,
          timestamp: consent.timestamp ?? Date.now(),
        },
      },
      token,
    );

    // Fetch the created session
    const session = await convexServer.query(
      api.interview_practice.getSession,
      { sessionId },
      token,
    );

    const durationMs = Date.now() - startTime;
    log.info('Session created', {
      event: 'request.success',
      httpStatus: 201,
      durationMs,
      extra: { sessionId },
    });

    return NextResponse.json(
      { sessionId, session },
      { status: 201, headers: { 'x-correlation-id': correlationId } },
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error('Session creation failed', toErrorCode(error), {
      event: 'request.error',
      httpStatus: 500,
      durationMs,
    });
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}

/**
 * GET /api/interview-practice/session
 * List user's sessions
 */
export async function GET(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'interview-practice',
    httpMethod: 'GET',
    httpPath: '/api/interview-practice/session',
  });

  const startTime = Date.now();
  log.info('Sessions list request started', { event: 'request.start' });

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

    // Parse query params
    const url = new URL(request.url);
    const status = url.searchParams.get('status') as
      | 'setup'
      | 'in_progress'
      | 'completed'
      | 'abandoned'
      | null;
    const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);

    const sessions = await convexServer.query(
      api.interview_practice.getSessions,
      {
        status: status ?? undefined,
        limit: Math.min(limit, 50),
      },
      token,
    );

    const durationMs = Date.now() - startTime;
    log.info('Sessions retrieved', {
      event: 'request.success',
      httpStatus: 200,
      durationMs,
      extra: { count: sessions.length },
    });

    return NextResponse.json(
      { sessions },
      { status: 200, headers: { 'x-correlation-id': correlationId } },
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error('Sessions retrieval failed', toErrorCode(error), {
      event: 'request.error',
      httpStatus: 500,
      durationMs,
    });
    return NextResponse.json(
      { error: 'Failed to retrieve sessions' },
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}
