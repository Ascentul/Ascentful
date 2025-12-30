import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

import { getExtensionCorsHeaders } from '@/lib/extension-auth/cors';
import {
  generateExtensionSessionToken,
  verifyExtensionState,
} from '@/lib/extension-auth/extensionState';
import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('Origin');
  const corsHeaders = getExtensionCorsHeaders(origin, 'POST, OPTIONS');
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * POST /api/extension/auth/create-session
 *
 * Verifies the state token and creates a session token for the extension.
 * Called from the extension login page after Clerk authentication.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('Origin');
  const corsHeaders = getExtensionCorsHeaders(origin, 'POST, OPTIONS');
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'extension-auth',
    httpMethod: 'POST',
    httpPath: '/api/extension/auth/create-session',
  });

  try {
    // Verify user is authenticated with Clerk
    const authResult = await auth();
    const { userId } = authResult;

    if (!userId) {
      log.warn('User not authenticated', { event: 'auth.failed', errorCode: 'UNAUTHORIZED' });
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      log.warn('Invalid JSON in request body', { event: 'validation.failed' });
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400, headers: corsHeaders },
      );
    }
    const { state } = body as { state?: unknown };

    if (!state || typeof state !== 'string') {
      log.warn('Missing state parameter', { event: 'validation.failed' });
      return NextResponse.json(
        { error: 'Missing state parameter' },
        { status: 400, headers: corsHeaders },
      );
    }

    // Verify the state token
    try {
      const payload = verifyExtensionState(state);
      log.debug('State verified', {
        event: 'state.verified',
        extra: { extensionId: payload.extensionId },
      });
    } catch (error) {
      log.warn('State verification failed', {
        event: 'state.invalid',
        extra: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
      return NextResponse.json(
        { error: 'Invalid or expired state token' },
        { status: 400, headers: corsHeaders },
      );
    }

    // Generate session token for the extension
    const { token, expiresAt } = generateExtensionSessionToken(userId);

    log.info('Extension session created', {
      event: 'session.created',
      clerkId: userId,
      extra: { expiresAt },
    });

    return NextResponse.json(
      { token, expiresAt },
      { headers: { ...corsHeaders, 'x-correlation-id': correlationId } },
    );
  } catch (error) {
    log.error('Error creating extension session', toErrorCode(error), {
      event: 'request.error',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders },
    );
  }
}
