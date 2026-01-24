'use client';

import { format, isSameDay } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { FollowUpItem } from './FollowUpItem';
import { SessionItem } from './SessionItem';

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

interface DayCardProps {
  day: Date;
  sessions: Session[];
  followUps: FollowUp[];
  now: number;
  /** Route prefix for links (e.g., '/u' or '/advisor') */
  routePrefix?: string;
}

export function DayCard({ day, sessions, followUps, now, routePrefix = '/advisor' }: DayCardProps) {
  const isToday = isSameDay(day, new Date(now));

  return (
    <Card className={cn(isToday && 'border-blue-500')}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">{format(day, 'EEEE, MMMM d')}</h3>
            {isToday && (
              <Badge variant="default" className="ml-2">
                Today
              </Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}, {followUps.length}{' '}
            {followUps.length === 1 ? 'task' : 'tasks'}
          </div>
        </div>

        {sessions.length === 0 && followUps.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No sessions or tasks scheduled
          </div>
        ) : (
          <div className="space-y-2">
            {/* Sessions */}
            {sessions.map((session) => (
              <SessionItem
                key={session._id}
                session={session}
                now={now}
                routePrefix={routePrefix}
              />
            ))}

            {/* Follow-ups */}
            {followUps.map((followUp) => (
              <FollowUpItem
                key={followUp._id}
                followUp={followUp}
                now={now}
                routePrefix={routePrefix}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
