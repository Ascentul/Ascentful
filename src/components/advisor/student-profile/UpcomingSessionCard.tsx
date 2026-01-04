'use client';

import { Id } from 'convex/_generated/dataModel';
import { Calendar, CalendarPlus, Clock, ExternalLink, ListPlus, MapPin, Video } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isValidHttpUrl } from '@/lib/utils';

interface UpcomingSession {
  _id: Id<'advisor_sessions'>;
  title?: string | null;
  start_at: number;
  location?: string | null;
  meeting_url?: string | null;
  session_type?: string | null;
}

interface UpcomingSessionCardProps {
  session: UpcomingSession | null;
  studentId: Id<'users'>;
  onAddAction?: (prefillTitle: string) => void;
}

function formatSessionTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    date.getDate() === tomorrow.getDate() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getFullYear() === tomorrow.getFullYear();

  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (isToday) {
    return `Today at ${time}`;
  }
  if (isTomorrow) {
    return `Tomorrow at ${time}`;
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getSessionTypeLabel(type: string | null | undefined): string {
  if (!type) return 'Advising';

  const labels: Record<string, string> = {
    career_planning: 'Career Planning',
    resume_review: 'Resume Review',
    mock_interview: 'Mock Interview',
    application_strategy: 'Application Strategy',
    general_advising: 'General Advising',
    other: 'Other',
  };

  return labels[type] || type;
}

export function UpcomingSessionCard({ session, studentId, onAddAction }: UpcomingSessionCardProps) {
  if (!session) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" />
            Upcoming Session
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <CalendarPlus className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground mb-3">No upcoming sessions</p>
            <div className="flex flex-col gap-2">
              <Button asChild>
                <Link href={`/advisor/advising/sessions?action=new&studentId=${studentId}`}>
                  <CalendarPlus className="h-4 w-4 mr-2" />
                  Schedule Session
                </Link>
              </Button>
              {onAddAction && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAddAction('Schedule advising session')}
                >
                  <ListPlus className="h-4 w-4 mr-1" />
                  Add next action
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-primary" />
            Upcoming Session
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {getSessionTypeLabel(session.session_type)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Session title */}
        {session.title && <p className="font-medium text-sm">{session.title}</p>}

        {/* Date/Time */}
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span>{formatSessionTime(session.start_at)}</span>
        </div>

        {/* Location */}
        {session.location && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{session.location}</span>
          </div>
        )}

        {/* Meeting URL */}
        {session.meeting_url && isValidHttpUrl(session.meeting_url) && (
          <div className="flex items-center gap-2 text-sm">
            <Video className="h-4 w-4 text-muted-foreground" />
            <a
              href={session.meeting_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1"
            >
              Join meeting
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button asChild>
            <Link href={`/advisor/advising/sessions/${session._id}`}>Open Session</Link>
          </Button>
          {onAddAction && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onAddAction(`Prepare agenda for ${session.title || 'upcoming session'}`)
              }
            >
              <ListPlus className="h-4 w-4 mr-1" />
              Add Agenda Item
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
