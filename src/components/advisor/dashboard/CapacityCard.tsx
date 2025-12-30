'use client';

/**
 * Capacity and Schedule Card
 *
 * Shows the advisor's session capacity utilization for the current week
 * with a visual progress indicator, plus upcoming sessions list.
 *
 * Business meaning: This helps advisors manage their time by showing:
 * - Current week capacity (booked vs available slots)
 * - Visual indicator of utilization level
 * - Next few upcoming sessions for quick reference
 */

import { format, isToday, isTomorrow } from 'date-fns';
import { Calendar, ChevronRight, Clock, Plus, User } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface UpcomingSession {
  _id: string;
  student_id: string;
  student_name: string;
  title: string;
  start_at: number;
  session_type?: string;
  status?: string;
}

interface CapacityData {
  capacity: {
    booked: number;
    total: number;
    percentage: number;
  };
  sessionsThisWeek: number;
  upcoming: {
    count: number;
    items: UpcomingSession[];
  };
}

interface CapacityCardProps {
  data: CapacityData | undefined;
  isLoading?: boolean;
}

function getCapacityColor(percentage: number): string {
  if (percentage >= 90) return 'bg-red-500';
  if (percentage >= 70) return 'bg-amber-500';
  return 'bg-primary';
}

function getCapacityLabel(percentage: number): string {
  if (percentage >= 90) return 'Nearly full';
  if (percentage >= 70) return 'Busy week';
  if (percentage >= 40) return 'Balanced';
  return 'Light week';
}

function SessionRow({ session }: { session: UpcomingSession }) {
  if (!session.start_at) return null;

  const sessionDate = new Date(session.start_at);
  let dateLabel = format(sessionDate, 'EEE, MMM d');
  const timeLabel = format(sessionDate, 'h:mm a');

  if (isToday(sessionDate)) {
    dateLabel = 'Today';
  } else if (isTomorrow(sessionDate)) {
    dateLabel = 'Tomorrow';
  }

  return (
    <Link
      href={`/advisor/advising/sessions/${session._id}`}
      className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-slate-50 transition-colors group"
    >
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Calendar className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{session.title}</p>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <span className="truncate">{session.student_name}</span>
          </div>
          <span>·</span>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>
              {dateLabel}, {timeLabel}
            </span>
          </div>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 shrink-0" />
    </Link>
  );
}

function LoadingState() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Schedule & Capacity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="animate-pulse space-y-2">
          <div className="flex justify-between">
            <div className="h-4 w-24 bg-slate-200 rounded" />
            <div className="h-4 w-16 bg-slate-200 rounded" />
          </div>
          <div className="h-3 bg-slate-200 rounded-full" />
        </div>
        <div className="border-t pt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="h-10 w-10 rounded-lg bg-slate-200" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-32 bg-slate-200 rounded" />
                <div className="h-3 w-48 bg-slate-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function CapacityCard({ data, isLoading }: CapacityCardProps) {
  if (isLoading) {
    return <LoadingState />;
  }

  if (!data) return null;

  const { capacity, upcoming } = data;
  const capacityColor = getCapacityColor(capacity.percentage);
  const capacityLabel = getCapacityLabel(capacity.percentage);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Schedule & Capacity
          </CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/advisor/advising/sessions?action=new" className="flex items-center gap-1">
              <Plus className="h-3.5 w-3.5" />
              New Session
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Capacity meter */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">This Week</span>
            <div className="flex items-center gap-2">
              <span className="font-semibold">
                {capacity.booked} of {capacity.total} slots
              </span>
              <Badge
                variant="outline"
                className={cn(
                  'text-xs',
                  capacity.percentage >= 90
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : capacity.percentage >= 70
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-green-50 text-green-700 border-green-200',
                )}
              >
                {capacityLabel}
              </Badge>
            </div>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', capacityColor)}
              style={{ width: `${Math.min(capacity.percentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Upcoming sessions */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Upcoming Sessions
            </p>
            {upcoming.count > 0 && (
              <Badge variant="secondary" className="text-xs">
                {upcoming.count} this week
              </Badge>
            )}
          </div>

          {upcoming.items.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-500 bg-slate-50 rounded-lg">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No upcoming sessions scheduled</p>
              <Button variant="link" size="sm" asChild className="mt-1">
                <Link href="/advisor/advising/calendar">View calendar</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {upcoming.items.map((session) => (
                <SessionRow key={session._id} session={session} />
              ))}
            </div>
          )}

          {upcoming.items.length > 0 && (
            <Button variant="ghost" size="sm" className="w-full mt-3" asChild>
              <Link href="/advisor/advising/calendar" className="flex items-center gap-1">
                View Full Calendar
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
