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

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function safeTokenCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function POST(request: NextRequest) {
  try {
    // Authentication: Require internal service token or super_admin
    const authHeader = request.headers.get('Authorization');
    const serviceToken = authHeader?.replace('Bearer ', '');

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

    const body = await request.json();

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
      dashboardUrl ||
        `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.ascentful.io'}/advisor/queue`,
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
