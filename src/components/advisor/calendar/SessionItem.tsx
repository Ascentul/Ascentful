'use client';

import { format } from 'date-fns';
import { MessageSquare, User, Video } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';

interface Session {
  _id: string;
  student_id: string;
  student_name: string;
  title: string;
  session_type: string;
  start_at: number;
  end_at?: number;
  duration_minutes?: number;
  location?: string;
  meeting_url?: string;
  notes?: string;
  visibility: string;
  status?: string;
}

interface SessionItemProps {
  session: Session;
  now: number;
  /** Route prefix for links (e.g., '/u' or '/advisor') */
  routePrefix?: string;
}

export function SessionItem({ session, now, routePrefix = '/advisor' }: SessionItemProps) {
  // Calculate end_at from duration if not provided (default: 60 min standard advising session)
  const endAt = session.end_at ?? session.start_at + (session.duration_minutes ?? 60) * 60 * 1000;
  const isPast = endAt < now;
  const isCurrent = session.start_at <= now && endAt >= now;

  const sessionIcon =
    {
      career_planning: User,
      resume_review: User,
      mock_interview: Video,
      application_strategy: User,
      general_advising: MessageSquare,
      other: User,
    }[session.session_type || 'general_advising'] || User;

  const SessionIcon = sessionIcon;

  return (
    <Link href={`${routePrefix}/advising/sessions/${session._id}`}>
      <div
        className={`p-3 border rounded-lg hover:bg-muted/50 cursor-pointer ${
          isCurrent ? 'border-blue-500 bg-blue-50' : isPast ? 'opacity-60' : ''
        }`}
      >
        <div className="flex items-center gap-3">
          <SessionIcon
            className={`h-5 w-5 ${
              isCurrent ? 'text-blue-500' : isPast ? 'text-gray-400' : 'text-primary'
            }`}
          />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div className="font-medium text-sm">{session.title || session.session_type}</div>
              <div className="text-sm text-muted-foreground">
                {format(new Date(session.start_at), 'h:mm a')} - {format(new Date(endAt), 'h:mm a')}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">{session.student_name}</div>
          </div>
          {isCurrent && <Badge variant="default">In Progress</Badge>}
        </div>
      </div>
    </Link>
  );
}
