import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

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

function getGmailScopes(mode: EmailScanMode): string[] {
  const gmailScope =
    mode === 'enhanced'
      ? 'https://www.googleapis.com/auth/gmail.readonly'
      : 'https://www.googleapis.com/auth/gmail.metadata';
  return ['openid', 'email', gmailScope];
}

export async function GET(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'auth',
    httpMethod: 'GET',
    httpPath: '/api/integrations/gmail/oauth/start',
  });

  try {
    const authResult = await auth();
    console.log('Gmail OAuth auth result:', {
      userId: authResult.userId,
      hasSession: !!authResult.sessionId,
    });

    const { userId } = authResult;
    if (!userId) {
      log.error('No userId from auth()', 'AUTH_ERROR', { event: 'auth.failed' });
      return NextResponse.json({ error: 'Unauthorized - not logged in' }, { status: 401 });
    }
    const mode = getModeFromRequest(request);

    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    if (!clientId) {
      log.error('Missing GOOGLE_OAUTH_CLIENT_ID', 'CONFIG_ERROR', { event: 'config.error' });
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const redirectUri = `${getAppBaseUrl()}/api/integrations/gmail/oauth/callback`;
    const state = createOAuthState({ clerkId: userId, provider: 'gmail', mode });

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', getGmailScopes(mode).join(' '));
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('state', state);

    return NextResponse.redirect(url.toString(), {
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    log.error('Failed to start Gmail OAuth', toErrorCode(error), { event: 'request.error' });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
