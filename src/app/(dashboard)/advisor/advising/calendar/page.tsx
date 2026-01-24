'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { Calendar as CalendarIcon, Clock, Download, Plus, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';

import { AdvisorGate } from '@/components/advisor/AdvisorGate';
import { CalendarView } from '@/components/advisor/calendar/CalendarView';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdvisorCalendarPage() {
  const { user } = useUser();
  const clerkId = user?.id;
  const pathname = usePathname();

  // Determine route prefix based on current path context
  const routePrefix = pathname?.startsWith('/u') ? '/u' : '/advisor';

  const [currentDate, setCurrentDate] = useState(new Date());

  const { startDate, endDate } = useMemo(() => {
    // Fetch data for the current month plus adjacent weeks for smooth navigation
    // Use weekStartsOn: 1 (Monday) to match CalendarControls display
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const start = startOfWeek(monthStart, { weekStartsOn: 1 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return {
      startDate: start.getTime(),
      endDate: end.getTime(),
    };
  }, [currentDate]);

  const sessions = useQuery(
    api.advisor_calendar.getSessionsInRange,
    clerkId ? { clerkId, startDate, endDate } : 'skip',
  );

  const followUps = useQuery(
    api.advisor_calendar.getFollowUpsInRange,
    clerkId ? { clerkId, startDate, endDate } : 'skip',
  );

  const stats = useQuery(
    api.advisor_calendar.getCalendarStats,
    clerkId ? { clerkId, startDate, endDate } : 'skip',
  );

  const isLoading = sessions === undefined || followUps === undefined || stats === undefined;

  // Normalize sessions to ensure required fields have values
  type SessionData = FunctionReturnType<typeof api.advisor_calendar.getSessionsInRange>[number];
  const normalizedSessions = useMemo(() => {
    if (!sessions) return [];
    return sessions.map((s: SessionData) => ({
      ...s,
      session_type: s.session_type ?? 'general_advising',
      duration_minutes: s.duration_minutes ?? 60,
      visibility: s.visibility ?? 'shared',
    }));
  }, [sessions]);

  // Normalize follow-ups to ensure required fields have values
  type FollowUpData = FunctionReturnType<typeof api.advisor_calendar.getFollowUpsInRange>[number];
  const normalizedFollowUps = useMemo(() => {
    if (!followUps) return [];
    return followUps.map((f: FollowUpData) => ({
      ...f,
      priority: f.priority ?? 'medium',
    }));
  }, [followUps]);

  return (
    <AdvisorGate requiredFlag="advisor.advising">
      <div className="w-full">
        <div className="w-full gradient-border-bottom p-5 space-y-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
              <p className="text-muted-foreground mt-1">Manage your advising schedule</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  const url = `/api/advisor/calendar/export?startDate=${startDate}&endDate=${endDate}`;
                  window.open(url, '_blank');
                }}
                disabled={!sessions || sessions.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export .ics
              </Button>
              <Link href={`${routePrefix}/advising/sessions?action=new`}>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule Session
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="py-5 px-5">
              <div className="flex items-center gap-3">
                <CalendarIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <p className="text-xl font-semibold leading-none">{stats?.totalSessions ?? '-'}</p>
                <p className="text-xs text-muted-foreground">Total Sessions</p>
              </div>
            </Card>

            <Card className="py-5 px-5">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <p className="text-xl font-semibold leading-none">
                  {stats?.totalHours !== undefined ? `${stats.totalHours}h` : '-'}
                </p>
                <p className="text-xs text-muted-foreground">Total Hours</p>
              </div>
            </Card>

            <Card className="py-5 px-5">
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <p className="text-xl font-semibold leading-none">{stats?.uniqueStudents ?? '-'}</p>
                <p className="text-xs text-muted-foreground">Unique Students</p>
              </div>
            </Card>

            <Card className="py-5 px-5">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <p className="text-xl font-semibold leading-none">
                  {stats?.upcomingSessions ?? '-'}
                </p>
                <p className="text-xs text-muted-foreground">Upcoming Sessions</p>
              </div>
            </Card>
          </div>

          {/* Calendar */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Advising Calendar
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CalendarView
                sessions={normalizedSessions}
                followUps={normalizedFollowUps}
                isLoading={isLoading}
                currentDate={currentDate}
                onDateChange={setCurrentDate}
                routePrefix={routePrefix}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </AdvisorGate>
  );
}
