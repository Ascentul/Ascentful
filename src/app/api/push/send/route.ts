import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import webpush from 'web-push';

/**
 * Web Push Notification API
 *
 * Sends push notifications to subscribed users.
 * Requires VAPID keys to be configured in environment.
 *
 * Authentication:
 * - Internal service token (for Convex actions)
 * - Or authenticated super_admin user
 */

const INTERNAL_SERVICE_TOKEN = process.env.CONVEX_INTERNAL_SERVICE_TOKEN;

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
    // Authentication: Require internal service token or super_admin
    const authHeader = request.headers.get('Authorization');
    const serviceToken = authHeader?.replace('Bearer ', '');

    const isInternalRequest =
      INTERNAL_SERVICE_TOKEN && serviceToken && serviceToken === INTERNAL_SERVICE_TOKEN;

    if (!isInternalRequest) {
      // Fall back to user authentication - require super_admin
      const { userId, sessionClaims } = await auth();
      const publicMetadata = sessionClaims?.publicMetadata as { role?: string } | undefined;
      const userRole = publicMetadata?.role;

      if (!userId || userRole !== 'super_admin') {
        return NextResponse.json(
          { success: false, error: 'Unauthorized: Internal service or super_admin required' },
          { status: 401 },
        );
      }
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

    // Send to all subscriptions in parallel for better performance
    const sendPromises = subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(subscription, notificationPayload);
        return { endpoint: subscription.endpoint, success: true as const };
      } catch (error: any) {
        // Handle specific error codes
        let errorMessage = error.message || 'Unknown error';

        if (error.statusCode === 410) {
          // Subscription has expired or is no longer valid
          errorMessage = 'Subscription expired';
        } else if (error.statusCode === 404) {
          errorMessage = 'Subscription not found';
        }

        return {
          endpoint: subscription.endpoint,
          success: false as const,
          error: errorMessage,
        };
      }
    });

    const results = await Promise.all(sendPromises);

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
