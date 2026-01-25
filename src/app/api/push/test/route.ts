import { auth } from '@clerk/nextjs/server';
import { api } from 'convex/_generated/api';
import { fetchQuery } from 'convex/nextjs';
import { NextResponse } from 'next/server';

import { isPushConfigured, PushSubscription, webpush } from '@/lib/push-config';

/**
 * Test Push Notification API
 *
 * Allows authenticated users to test their own push notification subscription.
 * This endpoint does NOT require admin privileges - any authenticated user can
 * test their own subscription.
 *
 * SECURITY: Validates that the subscription endpoint belongs to the authenticated
 * user to prevent sending notifications to arbitrary endpoints.
 */

export async function POST(request: Request) {
  try {
    // Any authenticated user can test their own subscription
    const authResult = await auth();
    const { userId } = authResult;

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

    // Get Convex token for authenticated queries
    const token = await authResult.getToken({ template: 'convex' });
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Failed to obtain auth token' },
        { status: 401 },
      );
    }

    // Look up the user in Convex
    const user = await fetchQuery(api.users.getUserByClerkId, { clerkId: userId }, { token });
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Validate subscription ownership - verify the endpoint belongs to this user
    const userSubscriptions = await fetchQuery(
      api.push_subscriptions.getUserSubscriptions,
      { userId: user._id },
      { token },
    );

    const ownsSubscription = userSubscriptions.some(
      (sub) => sub.endpoint === subscription.endpoint,
    );

    if (!ownsSubscription) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found for this user' },
        { status: 403 },
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
