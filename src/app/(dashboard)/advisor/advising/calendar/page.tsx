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
import { Calendar as CalendarIcon, Clock, Plus, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { AdvisorGate } from '@/components/advisor/AdvisorGate';
import { CalendarView } from '@/components/advisor/calendar/CalendarView';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdvisorCalendarPage() {
  const { user } = useUser();
  const clerkId = user?.id;

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
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
            <p className="text-muted-foreground mt-1">Manage your advising schedule</p>
          </div>
          <div className="flex gap-2">
            <Link href="/advisor/advising/sessions?action=new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Schedule Session
              </Button>
            </Link>
            {/* FEATURE INCOMPLETE: Calendar export to .ics format
             * Implementation plan:
             * 1. Install ical-generator package (npm install ical-generator)
             * 2. Create API route: /api/advisor/calendar/export
             * 3. Generate ICS from sessions array with VEVENT components
             * 4. Return as downloadable file with content-type: text/calendar
             * 5. Uncomment button and add onClick handler
             *
             * Example:
             * const calendar = ical({ name: 'Advisor Sessions' })
             * sessions.forEach(s => calendar.createEvent({ start: new Date(s.start_at), ... }))
             * return new Response(calendar.toString(), { headers: { 'Content-Type': 'text/calendar' } })
             */}
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalSessions ?? '-'}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.totalHours !== undefined ? `${stats.totalHours}h` : '-'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.uniqueStudents ?? '-'}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Upcoming Sessions</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.upcomingSessions ?? '-'}</div>
            </CardContent>
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
            />
          </CardContent>
        </Card>
      </div>
    </AdvisorGate>
  );
}
