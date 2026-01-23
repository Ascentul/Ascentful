import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import webpush from 'web-push';

/**
 * Test Push Notification API
 *
 * Allows authenticated users to test their own push notification subscription.
 * This endpoint does NOT require admin privileges - any authenticated user can
 * test their own subscription.
 */

// Configure VAPID keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:support@ascentul.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else if (VAPID_PUBLIC_KEY || VAPID_PRIVATE_KEY) {
  console.warn('Push notifications partially configured - both VAPID keys required');
}

interface PushSubscription {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

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
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
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

    if (!subscription || !subscription.endpoint || !subscription.keys) {
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
