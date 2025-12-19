import { api } from 'convex/_generated/api';
import { NextRequest, NextResponse } from 'next/server';

import { requireConvexToken } from '@/lib/convex-auth';
import { convexServer } from '@/lib/convex-server';
import { verifyOAuthState } from '@/lib/email-integrations/oauthState';
import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getAppBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://app.ascentful.io';
}

export async function GET(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'auth',
    httpMethod: 'GET',
    httpPath: '/api/integrations/outlook/oauth/callback',
  });

  try {
    const { userId, token } = await requireConvexToken();
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const error = request.nextUrl.searchParams.get('error');

    if (error) {
      log.warn('Outlook OAuth error returned', { event: 'oauth.error', errorCode: error });
      return NextResponse.redirect(`${getAppBaseUrl()}/account?tab=settings&outlook_oauth=error`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${getAppBaseUrl()}/account?tab=settings&outlook_oauth=missing`);
    }

    const { mode } = verifyOAuthState(state, { clerkId: userId, provider: 'outlook' });
    const redirectUri = `${getAppBaseUrl()}/api/integrations/outlook/oauth/callback`;

    await convexServer.action(
      api.email_auto_updates_actions.completeOAuthConnection,
      { provider: 'outlook', code, redirectUri, mode },
      token,
    );

    return NextResponse.redirect(`${getAppBaseUrl()}/account?tab=settings&outlook_oauth=success`);
  } catch (err) {
    log.error('Outlook OAuth callback failed', toErrorCode(err), {
      event: 'oauth.callback.failed',
    });
    return NextResponse.redirect(`${getAppBaseUrl()}/account?tab=settings&outlook_oauth=failed`);
  }
}
