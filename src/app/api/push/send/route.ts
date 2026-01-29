import { auth } from '@clerk/nextjs/server';
import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { isPushConfigured, webpush } from '@/lib/push-config';

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

// Maximum limits for payload fields to prevent abuse
const MAX_TITLE_LENGTH = 100;
const MAX_BODY_LENGTH = 500;
const MAX_URL_LENGTH = 2048;
const MAX_TAG_LENGTH = 100;
const MAX_ACTIONS = 5;
const MAX_SUBSCRIPTIONS_PER_REQUEST = 1000;

// Allowed push service domains (SSRF protection - PUSH-H1)
const ALLOWED_PUSH_SERVICE_HOSTS = [
  'fcm.googleapis.com', // Firebase Cloud Messaging (Chrome, Android)
  'updates.push.services.mozilla.com', // Mozilla Push Service (Firefox)
  'notify.windows.com', // Windows Push Notification Service (Edge, Windows)
  'push.apple.com', // Apple Push Notification Service
  'web.push.apple.com', // Apple Web Push
];

/**
 * Validate push service endpoint URL (SSRF protection)
 * Only allows known push service providers to prevent server-side request forgery
 */
function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    // Must be HTTPS
    if (url.protocol !== 'https:') return false;
    // Must be a known push service host
    return ALLOWED_PUSH_SERVICE_HOSTS.some(
      (host) => url.host === host || url.host.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}

// Base64 URL-safe pattern for subscription keys
const base64UrlPattern = /^[A-Za-z0-9_-]+={0,2}$/;

// Zod schema for push subscription validation (PUSH-C2)
const PushSubscriptionSchema = z.object({
  endpoint: z
    .string()
    .url('Invalid endpoint URL')
    .max(2048, 'Endpoint URL too long')
    .refine(isAllowedPushEndpoint, {
      message: 'Endpoint must be from a known push service provider',
    }),
  expirationTime: z.union([z.number(), z.null()]).optional(),
  keys: z.object({
    p256dh: z
      .string()
      .min(1, 'p256dh key is required')
      .max(256, 'p256dh key too long')
      .regex(base64UrlPattern, 'Invalid p256dh key format'),
    auth: z
      .string()
      .min(1, 'auth key is required')
      .max(64, 'auth key too long')
      .regex(base64UrlPattern, 'Invalid auth key format'),
  }),
});

// Zod schema for push notification payload validation (PUSH-C1)
const PushPayloadSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(MAX_TITLE_LENGTH, `Title must be ${MAX_TITLE_LENGTH} characters or less`),
  body: z
    .string()
    .min(1, 'Body is required')
    .max(MAX_BODY_LENGTH, `Body must be ${MAX_BODY_LENGTH} characters or less`),
  icon: z.string().max(MAX_URL_LENGTH).optional(),
  badge: z.string().max(MAX_URL_LENGTH).optional(),
  url: z.string().max(MAX_URL_LENGTH).optional().default('/'),
  tag: z.string().max(MAX_TAG_LENGTH).optional(),
  data: z.record(z.unknown()).optional(),
  actions: z
    .array(
      z.object({
        action: z.string().min(1).max(50),
        title: z.string().min(1).max(50),
        icon: z.string().max(MAX_URL_LENGTH).optional(),
      }),
    )
    .max(MAX_ACTIONS, `Maximum ${MAX_ACTIONS} actions allowed`)
    .optional(),
});

// Combined request body schema
const RequestBodySchema = z.object({
  subscriptions: z
    .array(PushSubscriptionSchema)
    .min(1, 'At least one subscription is required')
    .max(
      MAX_SUBSCRIPTIONS_PER_REQUEST,
      `Maximum ${MAX_SUBSCRIPTIONS_PER_REQUEST} subscriptions per request`,
    ),
  payload: PushPayloadSchema,
});

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

    // Parse JSON body
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    // Validate request body with Zod schema (PUSH-C1, PUSH-C2, PUSH-H1)
    const parseResult = RequestBodySchema.safeParse(rawBody);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: errors,
        },
        { status: 400 },
      );
    }

    const { subscriptions, payload } = parseResult.data;

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
