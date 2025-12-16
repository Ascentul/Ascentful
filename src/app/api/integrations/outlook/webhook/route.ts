import { api } from 'convex/_generated/api';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import { convexServer } from '@/lib/convex-server';
import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type GraphNotification = {
  subscriptionId?: string;
  clientState?: string;
};

type GraphNotificationBody = {
  value?: GraphNotification[];
};

function sha256Base64Url(input: string): string {
  const digest = crypto.createHash('sha256').update(input, 'utf8').digest('base64');
  return digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function GET(request: NextRequest) {
  const validationToken = request.nextUrl.searchParams.get('validationToken');
  if (!validationToken) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }
  return new NextResponse(validationToken, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'webhook',
    httpMethod: 'POST',
    httpPath: '/api/integrations/outlook/webhook',
  });

  try {
    const serviceToken = process.env.CONVEX_INTERNAL_SERVICE_TOKEN;
    if (!serviceToken) {
      log.error('Missing CONVEX_INTERNAL_SERVICE_TOKEN', 'CONFIG_ERROR', { event: 'config.error' });
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const body = (await request.json()) as GraphNotificationBody;
    const notifications = body.value || [];

    const unique = new Map<string, string>();
    for (const n of notifications) {
      if (!n.subscriptionId) continue;
      const hash = n.clientState ? sha256Base64Url(n.clientState) : '';
      unique.set(n.subscriptionId, hash);
    }

    await Promise.all(
      [...unique.entries()].map(([subscriptionId, clientStateHash]) =>
        convexServer.mutation(api.email_auto_updates.handleOutlookWebhookNotification, {
          serviceToken,
          subscriptionId,
          clientStateHash: clientStateHash || undefined,
        }),
      ),
    );

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (err) {
    log.error('Outlook webhook handler failed', toErrorCode(err), { event: 'webhook.error' });
    return NextResponse.json({ ok: false }, { status: 202 });
  }
}
