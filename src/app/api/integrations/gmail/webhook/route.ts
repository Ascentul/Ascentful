import { api } from 'convex/_generated/api';
import { NextRequest, NextResponse } from 'next/server';

import { convexServer } from '@/lib/convex-server';
import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PubSubPushBody = {
  message?: {
    data?: string;
    messageId?: string;
  };
  subscription?: string;
};

function decodeBase64Json(input: string): any {
  const decoded = Buffer.from(input, 'base64').toString('utf8');
  return JSON.parse(decoded);
}

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'webhook',
    httpMethod: 'POST',
    httpPath: '/api/integrations/gmail/webhook',
  });

  try {
    const expectedToken = process.env.GMAIL_PUBSUB_VERIFICATION_TOKEN;
    const providedToken = request.nextUrl.searchParams.get('token') || '';
    if (!expectedToken || providedToken !== expectedToken) {
      log.warn('Gmail webhook rejected', { event: 'webhook.verification.failed' });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceToken = process.env.CONVEX_INTERNAL_SERVICE_TOKEN;
    if (!serviceToken) {
      log.error('Missing CONVEX_INTERNAL_SERVICE_TOKEN', 'CONFIG_ERROR', { event: 'config.error' });
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const body = (await request.json()) as PubSubPushBody;
    const dataB64 = body.message?.data;
    if (!dataB64) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const decoded = decodeBase64Json(dataB64) as { emailAddress?: string; historyId?: string };
    if (!decoded.emailAddress) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    await convexServer.mutation(api.email_auto_updates.handleGmailPushNotification, {
      serviceToken,
      emailAddress: decoded.emailAddress,
      historyId: decoded.historyId,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    log.error('Gmail webhook handler failed', toErrorCode(err), { event: 'webhook.error' });
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
