'use client';

/**
 * ComingUpPanel - Preview of upcoming days
 *
 * Shows session counts for tomorrow and the next 2 days
 * to help advisors prepare.
 */

import { Id } from 'convex/_generated/dataModel';
import { format } from 'date-fns';
import { Calendar, ChevronRight, Clock, User } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ComingUpSession {
  _id: Id<'advisor_sessions'>;
  student_id: Id<'users'>;
  student_name: string;
  title: string;
  session_type?: string;
  start_at: number;
}

interface ComingUpDay {
  date: number;
  dayLabel: string;
  sessions: ComingUpSession[];
}

interface ComingUpPanelProps {
  days: ComingUpDay[];
  isLoading?: boolean;
  /** Route prefix for links (e.g., '/u' or '/advisor') */
  routePrefix?: string;
}

const sessionTypeLabels: Record<string, string> = {
  career_planning: 'Career',
  resume_review: 'Resume',
  mock_interview: 'Interview',
  application_strategy: 'Strategy',
  general_advising: 'Advising',
  other: 'Other',
};

function DayRow({ day }: { day: ComingUpDay }) {
  const sessionCount = day.sessions.length;

  if (sessionCount === 0) {
    return (
      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600">{day.dayLabel}</span>
        </div>
        <span className="text-xs text-slate-400">No sessions</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">{day.dayLabel}</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {sessionCount} session{sessionCount !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Show first 2 sessions with names */}
      <div className="pl-6 space-y-1">
        {day.sessions.slice(0, 2).map((session) => (
          <div key={session._id} className="flex items-center gap-2 text-xs text-slate-600">
            <Clock className="h-3 w-3 text-slate-400" />
            <span className="font-medium">{format(new Date(session.start_at), 'h:mm a')}</span>
            <span className="text-slate-400">-</span>
            <User className="h-3 w-3 text-slate-400" />
            <span className="truncate">{session.student_name}</span>
            {session.session_type && (
              <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                {sessionTypeLabels[session.session_type] || session.session_type}
              </Badge>
            )}
          </div>
        ))}
        {sessionCount > 2 && (
          <div className="text-xs text-slate-400 pl-5">+{sessionCount - 2} more</div>
        )}
      </div>
    </div>
  );
}

export function ComingUpPanel({ days, isLoading, routePrefix = '/advisor' }: ComingUpPanelProps) {
  const totalUpcoming = days.reduce((sum, day) => sum + day.sessions.length, 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" />
            Coming Up
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" />
            Coming Up
            {totalUpcoming > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {totalUpcoming} sessions
              </Badge>
            )}
          </CardTitle>
          <Link
            href={`${routePrefix}/advising/calendar`}
            className="text-xs text-slate-500 hover:text-primary-600 flex items-center gap-1"
          >
            Calendar
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {totalUpcoming === 0 ? (
          <div className="text-center py-6 text-slate-500">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">No sessions scheduled</p>
            <p className="text-xs mt-0.5">No upcoming sessions</p>
          </div>
        ) : (
          <div className="space-y-3">
            {days.map((day) => (
              <DayRow key={day.date} day={day} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
