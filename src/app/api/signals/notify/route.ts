/**
 * Signal Notification API
 *
 * Sends email notifications for signals to advisors.
 * Called internally when new signals are created.
 */

import { NextRequest, NextResponse } from 'next/server';

import { sendSignalAlertEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
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
