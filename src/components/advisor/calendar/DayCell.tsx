'use client';

import { format, isSameDay, isSameMonth } from 'date-fns';
import Link from 'next/link';

interface Session {
  _id: string;
  student_id: string;
  student_name: string;
  title: string;
  session_type: string;
  start_at: number;
  end_at?: number; // Optional - calculated from duration_minutes if not provided
  duration_minutes: number;
  location?: string;
  meeting_url?: string;
  notes?: string;
  visibility: string;
  status?: string;
}

interface FollowUp {
  _id: string;
  student_id: string;
  student_name: string;
  title: string;
  priority: string;
  due_at?: number | null;
}

interface DayCellProps {
  day: Date;
  currentMonth: Date;
  sessions: Session[];
  followUps: FollowUp[];
  now: number;
  /** Route prefix for links (e.g., '/u' or '/advisor') */
  routePrefix?: string;
}

export function DayCell({
  day,
  currentMonth,
  sessions,
  followUps,
  now,
  routePrefix = '/advisor',
}: DayCellProps) {
  const isToday = isSameDay(day, new Date(now));
  const isCurrentMonth = isSameMonth(day, currentMonth);

  const displayedSessions = sessions.slice(0, 2);
  const displayedFollowUps = followUps.slice(0, 1);
  const displayed = Math.min(sessions.length, 2) + Math.min(followUps.length, 1);
  const total = sessions.length + followUps.length;
  const hidden = total - displayed;

  return (
    <div
      className={`min-h-[120px] p-2 border-r border-b last:border-r-0 ${
        isToday ? 'bg-blue-50' : !isCurrentMonth ? 'bg-muted/30' : ''
      }`}
    >
      <div
        className={`text-sm font-medium mb-1 ${
          isToday ? 'text-blue-600 font-bold' : !isCurrentMonth ? 'text-muted-foreground' : ''
        }`}
      >
        {format(day, 'd')}
      </div>
      <div className="space-y-1">
        {displayedSessions.map((session) => (
          <Link key={session._id} href={`${routePrefix}/advising/sessions/${session._id}`}>
            <div className="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded truncate hover:bg-blue-200 cursor-pointer">
              {format(new Date(session.start_at), 'h:mm a')} • {session.student_name}
            </div>
          </Link>
        ))}
        {displayedFollowUps.map((followUp) => (
          <Link key={followUp._id} href={`${routePrefix}/students/${followUp.student_id}`}>
            <div className="text-xs bg-orange-100 text-orange-800 px-1 py-0.5 rounded truncate hover:bg-orange-200 cursor-pointer">
              Task: {followUp.title}
            </div>
          </Link>
        ))}
        {hidden > 0 && <div className="text-xs text-muted-foreground">+{hidden} more</div>}
      </div>
    </div>
  );
}
