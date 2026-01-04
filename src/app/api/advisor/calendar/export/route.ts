import { auth } from '@clerk/nextjs/server';
import { ConvexHttpClient } from 'convex/browser';
import { NextResponse } from 'next/server';

import { api } from '../../../../../../convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Generate ICS (iCalendar) format content for advisor sessions
 * RFC 5545 compliant format
 */
function generateICS(
  sessions: Array<{
    _id: string;
    title?: string | null;
    start_at: number;
    end_at?: number | null;
    duration_minutes?: number | null;
    location?: string | null;
    meeting_url?: string | null;
    session_type?: string | null;
    student_name?: string | null;
    notes?: string | null;
  }>,
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ascentul//Advisor Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Advisor Sessions',
  ];

  for (const session of sessions) {
    const startDate = new Date(session.start_at);
    const endDate = session.end_at
      ? new Date(session.end_at)
      : new Date(session.start_at + (session.duration_minutes || 60) * 60 * 1000);

    const formatDateTime = (date: Date): string => {
      return date
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '');
    };

    const escapeText = (text: string): string => {
      return text
        .replace(/\\/g, '\\\\')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;')
        .replace(/\n/g, '\\n');
    };

    const title = session.title || `Session with ${session.student_name || 'Student'}`;
    const description = [
      session.session_type ? `Type: ${session.session_type.replace(/_/g, ' ')}` : null,
      session.student_name ? `Student: ${session.student_name}` : null,
      session.notes ? `Notes: ${session.notes}` : null,
      session.meeting_url ? `Meeting URL: ${session.meeting_url}` : null,
    ]
      .filter(Boolean)
      .join('\\n');

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${session._id}@ascentul.com`);
    lines.push(`DTSTAMP:${formatDateTime(new Date())}`);
    lines.push(`DTSTART:${formatDateTime(startDate)}`);
    lines.push(`DTEND:${formatDateTime(endDate)}`);
    lines.push(`SUMMARY:${escapeText(title)}`);

    if (description) {
      lines.push(`DESCRIPTION:${escapeText(description)}`);
    }

    if (session.location) {
      lines.push(`LOCATION:${escapeText(session.location)}`);
    }

    if (session.meeting_url) {
      lines.push(`URL:${session.meeting_url}`);
    }

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters for date range
    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // Default to current month if no dates provided (with NaN validation)
    const now = new Date();
    const parsedStart = startDateParam ? parseInt(startDateParam, 10) : NaN;
    const parsedEnd = endDateParam ? parseInt(endDateParam, 10) : NaN;

    const startDate = !isNaN(parsedStart)
      ? parsedStart
      : new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const endDate = !isNaN(parsedEnd)
      ? parsedEnd
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();

    // Fetch sessions from Convex
    const sessions = await convex.query(api.advisor_calendar.getSessionsInRange, {
      clerkId: userId,
      startDate,
      endDate,
    });

    // Generate ICS content
    const icsContent = generateICS(sessions);

    // Return as downloadable file
    const filename = `advisor-calendar-${new Date().toISOString().split('T')[0]}.ics`;

    return new Response(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Calendar export error:', error);
    return NextResponse.json({ error: 'Failed to export calendar' }, { status: 500 });
  }
}
