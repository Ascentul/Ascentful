import { NextResponse } from 'next/server';
import webpush from 'web-push';

/**
 * Web Push Notification API
 *
 * Sends push notifications to subscribed users.
 * Requires VAPID keys to be configured in environment.
 */

// Configure VAPID keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:support@ascentul.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

interface PushSubscription {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export async function POST(request: Request) {
  try {
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

    const body = await request.json();
    const { subscriptions, payload }: { subscriptions: PushSubscription[]; payload: PushPayload } =
      body;

    if (!subscriptions || !Array.isArray(subscriptions) || subscriptions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No subscriptions provided' },
        { status: 400 },
      );
    }

    if (!payload || !payload.title || !payload.body) {
      return NextResponse.json(
        { success: false, error: 'Invalid payload. Title and body required.' },
        { status: 400 },
      );
    }

    // Prepare notification payload
    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/logo.png',
      badge: payload.badge || '/logo.png',
      url: payload.url || '/',
      tag: payload.tag || `notification-${Date.now()}`,
      data: payload.data || {},
      actions: payload.actions || [],
    });

    const results: Array<{
      endpoint: string;
      success: boolean;
      error?: string;
    }> = [];

    // Send to all subscriptions
    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(subscription, notificationPayload);
        results.push({ endpoint: subscription.endpoint, success: true });
      } catch (error: any) {
        // Handle specific error codes
        let errorMessage = error.message || 'Unknown error';

        if (error.statusCode === 410) {
          // Subscription has expired or is no longer valid
          errorMessage = 'Subscription expired';
        } else if (error.statusCode === 404) {
          errorMessage = 'Subscription not found';
        }

        results.push({
          endpoint: subscription.endpoint,
          success: false,
          error: errorMessage,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: failureCount,
      results,
    });
  } catch (error) {
    console.error('Push notification error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send push notifications' },
      { status: 500 },
    );
  }
}
