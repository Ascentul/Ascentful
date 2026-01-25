import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { isPushConfigured, PushSubscription, webpush } from '@/lib/push-config';

/**
 * Test Push Notification API
 *
 * Allows authenticated users to test their own push notification subscription.
 * This endpoint does NOT require admin privileges - any authenticated user can
 * test their own subscription.
 */

export async function POST(request: Request) {
  try {
    // Any authenticated user can test their own subscription
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if VAPID keys are configured
    if (!isPushConfigured) {
      return NextResponse.json(
        {
          success: false,
          error: 'Push notifications not configured. VAPID keys missing.',
        },
        { status: 503 },
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }
    const { subscription }: { subscription: PushSubscription } = body;

    if (
      !subscription ||
      !subscription.endpoint ||
      !subscription.keys?.p256dh ||
      !subscription.keys?.auth
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid subscription data' },
        { status: 400 },
      );
    }

    // Prepare test notification payload
    const notificationPayload = JSON.stringify({
      title: 'Test Notification',
      body: 'Push notifications are working correctly!',
      icon: '/logo.png',
      badge: '/logo.png',
      url: '/account/settings',
      tag: 'test-notification',
      data: { test: true },
    });

    try {
      await webpush.sendNotification(subscription, notificationPayload);
      return NextResponse.json({ success: true });
    } catch (error: unknown) {
      const pushError = error as { statusCode?: number; message?: string };

      if (pushError.statusCode === 410 || pushError.statusCode === 404) {
        return NextResponse.json(
          {
            success: false,
            error: 'Subscription expired or invalid. Please re-subscribe.',
            expired: true,
          },
          { status: 410 },
        );
      }

      return NextResponse.json(
        { success: false, error: pushError.message || 'Failed to send notification' },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('Test push notification error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send test notification' },
      { status: 500 },
    );
  }
}
