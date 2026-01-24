/**
 * Signal Notification API
 *
 * Sends email notifications for signals to advisors.
 * Called internally when new signals are created.
 *
 * Authentication:
 * - Internal service token (for Convex actions)
 * - Or authenticated super_admin user
 */

import { auth } from '@clerk/nextjs/server';
import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import { sendSignalAlertEmail } from '@/lib/email';

const INTERNAL_SERVICE_TOKEN = process.env.CONVEX_INTERNAL_SERVICE_TOKEN;
const DEFAULT_DASHBOARD_URL = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.ascentful.io'}/advisor/queue`;

/**
 * Validate and sanitize dashboard URL.
 * Only allows HTTPS URLs from our domain to prevent injection attacks.
 */
function sanitizeDashboardUrl(url: string | undefined): string {
  if (!url) return DEFAULT_DASHBOARD_URL;

  try {
    const parsed = new URL(url);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.ascentful.io';
    const appHost = new URL(appUrl).host;

    // Only allow HTTPS URLs from our domain
    if (parsed.protocol === 'https:' && parsed.host === appHost) {
      return url;
    }
  } catch {
    // Invalid URL format
  }

  return DEFAULT_DASHBOARD_URL;
}

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

export async function POST(request: NextRequest) {
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

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const {
      advisorEmail,
      advisorName,
      studentName,
      signalTitle,
      signalDescription,
      priority,
      signalType,
      dashboardUrl,
    } = body;

    // Validate required fields and email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!advisorEmail || !emailRegex.test(advisorEmail)) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid advisor email' },
        { status: 400 },
      );
    }
    if (!studentName || !signalTitle || !priority || !signalType) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 },
      );
    }

    // Only send emails for urgent and high priority signals by default
    if (priority !== 'urgent' && priority !== 'high') {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'Email not sent for non-urgent/high priority signals',
      });
    }

    const result = await sendSignalAlertEmail(
      advisorEmail,
      advisorName || 'Advisor',
      studentName,
      signalTitle,
      signalDescription || '',
      priority,
      signalType,
      sanitizeDashboardUrl(dashboardUrl),
    );

    return NextResponse.json({
      success: true,
      messageId: result.id,
      skipped: result.skipped || false,
    });
  } catch (error) {
    console.error('Signal notification error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send notification' },
      { status: 500 },
    );
  }
}
