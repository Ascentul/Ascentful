import { NextRequest, NextResponse } from 'next/server';

import { requireConvexToken } from '@/lib/convex-auth';
import { createOAuthState, type EmailScanMode } from '@/lib/email-integrations/oauthState';
import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getAppBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://app.ascentful.io';
}

function getModeFromRequest(request: NextRequest): EmailScanMode {
  const mode = request.nextUrl.searchParams.get('mode');
  return mode === 'enhanced' ? 'enhanced' : 'metadata_only';
}

function getOutlookScopes(mode: EmailScanMode): string[] {
  const mailScope = mode === 'enhanced' ? 'Mail.Read' : 'Mail.ReadBasic';
  return ['openid', 'email', 'offline_access', mailScope];
}

export async function GET(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'auth',
    httpMethod: 'GET',
    httpPath: '/api/integrations/outlook/oauth/start',
  });

  try {
    const { userId } = await requireConvexToken();
    const mode = getModeFromRequest(request);

    const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
    if (!clientId) {
      log.error('Missing MICROSOFT_OAUTH_CLIENT_ID', 'CONFIG_ERROR', { event: 'config.error' });
      return NextResponse.json(
        { error: 'Server not configured' },
        { status: 500, headers: { 'x-correlation-id': correlationId } },
      );
    }

    const tenant = process.env.MICROSOFT_OAUTH_TENANT || 'common';
    const redirectUri = `${getAppBaseUrl()}/api/integrations/outlook/oauth/callback`;
    const state = createOAuthState({ clerkId: userId, provider: 'outlook', mode });

    const url = new URL(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('response_mode', 'query');
    url.searchParams.set('scope', getOutlookScopes(mode).join(' '));
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('state', state);

    return NextResponse.redirect(url.toString(), {
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    log.error('Failed to start Outlook OAuth', toErrorCode(error), { event: 'request.error' });
    // requireConvexToken throws for auth failures; other errors are internal
    const isAuthError = error instanceof Error && error.message.includes('Unauthorized');
    return NextResponse.json(
      { error: isAuthError ? 'Unauthorized' : 'Internal server error' },
      { status: isAuthError ? 401 : 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}
