import { NextRequest, NextResponse } from 'next/server';

import { getExtensionCorsHeaders } from '@/lib/extension-auth/cors';
import {
  generateExtensionSessionToken,
  verifyExtensionSessionToken,
} from '@/lib/extension-auth/extensionState';
import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('Origin');
  const corsHeaders = getExtensionCorsHeaders(origin, 'POST, OPTIONS');
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * POST /api/extension/auth/refresh
 *
 * Refreshes an extension session token.
 * The old token must still be valid (not expired) to get a new one.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('Origin');
  const corsHeaders = getExtensionCorsHeaders(origin, 'POST, OPTIONS');
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'extension-auth',
    httpMethod: 'POST',
    httpPath: '/api/extension/auth/refresh',
  });

  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      log.warn('Missing authorization header', { event: 'auth.failed' });
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401, headers: corsHeaders },
      );
    }

    // Verify the existing token
    let clerkId: string;
    try {
      const result = verifyExtensionSessionToken(token);
      clerkId = result.clerkId;
    } catch (error) {
      log.warn('Token verification failed', {
        event: 'token.invalid',
        extra: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401, headers: corsHeaders },
      );
    }

    // Generate a new session token
    const { token: newToken, expiresAt } = generateExtensionSessionToken(clerkId);

    log.debug('Extension session refreshed', {
      event: 'session.refreshed',
      clerkId,
      extra: { expiresAt },
    });

    return NextResponse.json(
      { token: newToken, expiresAt },
      { headers: { ...corsHeaders, 'x-correlation-id': correlationId } },
    );
  } catch (error) {
    log.error('Error refreshing extension session', toErrorCode(error), {
      event: 'request.error',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders },
    );
  }
}
