import { NextResponse } from 'next/server';

/**
 * VAPID Public Key Endpoint
 *
 * Returns the VAPID public key for push subscription.
 * Called by service worker when it needs to resubscribe after restart.
 * This is a public endpoint since the VAPID public key is not secret.
 */
export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  if (!publicKey) {
    return NextResponse.json({ error: 'Push notifications not configured' }, { status: 503 });
  }

  return NextResponse.json({ publicKey });
}
