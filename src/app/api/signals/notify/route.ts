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
import { NextRequest, NextResponse } from 'next/server';

import { sendSignalAlertEmail } from '@/lib/email';

const INTERNAL_SERVICE_TOKEN = process.env.CONVEX_INTERNAL_SERVICE_TOKEN;

export async function POST(request: NextRequest) {
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
          { error: 'Unauthorized: Internal service or super_admin required' },
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

    // Validate required fields
    if (!advisorEmail || !studentName || !signalTitle || !priority || !signalType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
      dashboardUrl || 'https://app.ascentful.io/advisor/queue',
    );

    return NextResponse.json({
      success: true,
      messageId: result.id,
      skipped: result.skipped || false,
    });
  } catch (error) {
    console.error('Signal notification error:', error);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
