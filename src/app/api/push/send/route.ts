import { auth } from '@clerk/nextjs/server';
import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

import { isPushConfigured, PushSubscription, webpush } from '@/lib/push-config';

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

/**
 * Constant-time string comparison to prevent timing attacks.
 * Pads shorter buffer to avoid leaking length information.
 */
function safeTokenCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  const maxLen = Math.max(bufA.length, bufB.length);
  const paddedA = Buffer.alloc(maxLen);
  const paddedB = Buffer.alloc(maxLen);
  bufA.copy(paddedA);
  bufB.copy(paddedB);
  // Perform timing-safe comparison first, then check lengths
  const isEqual = timingSafeEqual(paddedA, paddedB);
  return isEqual && bufA.length === bufB.length;
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
    const serviceToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const isInternalRequest =
      INTERNAL_SERVICE_TOKEN &&
      serviceToken &&
      safeTokenCompare(serviceToken, INTERNAL_SERVICE_TOKEN);

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
    const { subscriptions, payload }: { subscriptions: PushSubscription[]; payload: PushPayload } =
      body;

    if (!subscriptions || !Array.isArray(subscriptions) || subscriptions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No subscriptions provided' },
        { status: 400 },
      );
    }

    // Limit subscriptions per request to prevent resource exhaustion
    if (subscriptions.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'Too many subscriptions. Maximum 1000 per request.' },
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
        let shouldRemove = false;

        if (error.statusCode === 410) {
          // Subscription has expired or is no longer valid
          errorMessage = 'Subscription expired';
          shouldRemove = true;
        } else if (error.statusCode === 404) {
          errorMessage = 'Subscription not found';
          shouldRemove = true;
        }

        return {
          endpoint: subscription.endpoint,
          success: false as const,
          error: errorMessage,
          shouldRemove,
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
