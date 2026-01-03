'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useQuery } from 'convex/react';
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek, subWeeks } from 'date-fns';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  Loader2,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useMemo } from 'react';

import { AdvisorGate } from '@/components/advisor/AdvisorGate';
import { ActivityChart } from '@/components/advisor/analytics/ActivityChart';
import { ReviewQueueSnapshot } from '@/components/advisor/analytics/ReviewQueueSnapshot';
import { UpcomingItem, UpcomingItems } from '@/components/advisor/analytics/UpcomingItems';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdvisorAnalyticsPage() {
  const { user: clerkUser } = useUser();
  const clerkId = clerkUser?.id;

  // Calculate date ranges
  const now = new Date();

  const weekStart = startOfWeek(now, { weekStartsOn: 1 }).getTime();
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 }).getTime();
  const monthStart = startOfMonth(now).getTime();
  const monthEnd = endOfMonth(now).getTime();

  // For the activity chart - last 4 weeks
  const fourWeeksAgo = subWeeks(now, 4);
  const activityStart = startOfWeek(fourWeeksAgo, { weekStartsOn: 1 }).getTime();

  // Queries
  const weekStats = useQuery(
    api.advisor_calendar.getCalendarStats,
    clerkId ? { clerkId, startDate: weekStart, endDate: weekEnd } : 'skip',
  );

  const monthStats = useQuery(
    api.advisor_calendar.getCalendarStats,
    clerkId ? { clerkId, startDate: monthStart, endDate: monthEnd } : 'skip',
  );

  const caseload = useQuery(api.advisor_students.getMyCaseload, clerkId ? { clerkId } : 'skip');

  const weekSessions = useQuery(
    api.advisor_calendar.getSessionsInRange,
    clerkId ? { clerkId, startDate: weekStart, endDate: weekEnd } : 'skip',
  );

  const weekFollowUps = useQuery(
    api.advisor_calendar.getFollowUpsInRange,
    clerkId ? { clerkId, startDate: weekStart, endDate: weekEnd } : 'skip',
  );

  const activitySessions = useQuery(
    api.advisor_calendar.getSessionsInRange,
    clerkId ? { clerkId, startDate: activityStart, endDate: weekEnd } : 'skip',
  );

  const reviews = useQuery(api.advisor_reviews_queries.getReviews, clerkId ? { clerkId } : 'skip');

  // Build activity chart data (sessions per week for last 4 weeks)
  const activityData = useMemo(() => {
    if (!activitySessions) return [];

    const now = new Date();
    const weekBuckets: { date: string; count: number }[] = [];

    // Create 4 week buckets
    for (let i = 0; i < 4; i++) {
      const weekStartDate = startOfWeek(subWeeks(now, 3 - i), { weekStartsOn: 1 });
      const weekEndDate = endOfWeek(weekStartDate, { weekStartsOn: 1 });

      const count = activitySessions.filter((session) => {
        const sessionDate = session.start_at;
        return sessionDate >= weekStartDate.getTime() && sessionDate <= weekEndDate.getTime();
      }).length;

      weekBuckets.push({
        date: weekStartDate.toISOString(),
        count,
      });
    }

    return weekBuckets;
  }, [activitySessions]);

  // Build upcoming items (sessions + follow-ups for this week)
  const upcomingItems: UpcomingItem[] = useMemo(() => {
    const items: UpcomingItem[] = [];
    const nowTime = Date.now();

    // Add upcoming sessions (future only)
    if (weekSessions) {
      weekSessions
        .filter((s) => s.start_at > nowTime)
        .forEach((session) => {
          items.push({
            _id: session._id,
            type: 'session',
            student_id: session.student_id,
            student_name: session.student_name,
            title: session.title || 'Advising Session',
            date: session.start_at,
          });
        });
    }

    // Add follow-ups (including overdue)
    if (weekFollowUps) {
      weekFollowUps.forEach((followUp) => {
        items.push({
          _id: followUp._id,
          type: 'followup',
          student_id: followUp.student_id,
          student_name: followUp.student_name,
          title: followUp.title || 'Follow-up',
          date: followUp.due_at || nowTime,
          priority: followUp.priority,
          status: followUp.status,
        });
      });
    }

    // Sort by date
    return items.sort((a, b) => a.date - b.date);
  }, [weekSessions, weekFollowUps]);
  const pendingReviews = useMemo(() => {
    if (!reviews) return [];
    return reviews
      .filter((r) => r.status === 'waiting' || r.status === 'in_review')
      .map((r) => ({
        _id: r._id,
        student_id: r.student_id,
        student_name: r.student_name || 'Unknown',
        asset_type: r.asset_type,
        asset_id: r.asset_id,
        status: r.status,
        submitted_at: r.requested_at ?? Date.now(), // Fallback to current time if missing
      }));
  }, [reviews]);

  const isLoading = weekStats === undefined || monthStats === undefined;

  return (
    <ErrorBoundary>
      <AdvisorGate requiredFlag="advisor.analytics">
        <div className="w-full">
          <div className="w-full gradient-border-bottom p-5 space-y-6 shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
                <p className="text-muted-foreground mt-1">
                  Insights into your advising effectiveness
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Key Metrics */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card className="py-4 px-5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground">Caseload</p>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <p className="text-xl font-semibold leading-none">
                        {caseload?.length ?? '-'}
                      </p>
                      <p className="text-xs text-muted-foreground">Active students</p>
                    </div>
                  </Card>

                  <Card className="py-4 px-5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground">Sessions This Week</p>
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <p className="text-xl font-semibold leading-none">
                        {weekStats?.totalSessions ?? '-'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(weekStats?.completedSessions ?? 0) > 0 ||
                        (weekStats?.upcomingSessions ?? 0) > 0
                          ? `${weekStats?.completedSessions ?? 0} completed, ${weekStats?.upcomingSessions ?? 0} upcoming`
                          : 'No sessions scheduled'}
                      </p>
                    </div>
                  </Card>

                  <Card className="py-4 px-5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground">Hours This Month</p>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <p className="text-xl font-semibold leading-none">
                        {monthStats?.totalHours ?? '-'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Across {monthStats?.totalSessions ?? 0} sessions
                      </p>
                    </div>
                  </Card>

                  <Card className="py-4 px-5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground">Follow-ups</p>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <p className="text-xl font-semibold leading-none">
                        {weekStats?.totalFollowUps ?? '-'}
                      </p>
                      {(weekStats?.overdueFollowUps ?? 0) > 0 ? (
                        <p className="text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {weekStats?.overdueFollowUps} overdue
                        </p>
                      ) : (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          All on track
                        </p>
                      )}
                    </div>
                  </Card>
                </div>

                {/* Charts and Lists */}
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Activity Chart */}
                  <ActivityChart data={activityData} isLoading={activitySessions === undefined} />

                  {/* Upcoming Items */}
                  <UpcomingItems
                    items={upcomingItems}
                    isLoading={weekSessions === undefined || weekFollowUps === undefined}
                  />
                </div>

                {/* Review Queue */}
                <div className="grid gap-6 lg:grid-cols-2">
                  <ReviewQueueSnapshot reviews={pendingReviews} isLoading={reviews === undefined} />

                  {/* Month Overview */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Month Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-4 bg-muted rounded-lg">
                          <div className="text-3xl font-bold">
                            {monthStats?.totalSessions ?? '-'}
                          </div>
                          <p className="text-sm text-muted-foreground">Total Sessions</p>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-lg">
                          <div className="text-3xl font-bold">
                            {monthStats?.uniqueStudents ?? '-'}
                          </div>
                          <p className="text-sm text-muted-foreground">Students Seen</p>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-lg">
                          <div className="text-3xl font-bold">
                            {monthStats?.completedSessions ?? '-'}
                          </div>
                          <p className="text-sm text-muted-foreground">Completed</p>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-lg">
                          <div className="text-3xl font-bold">{monthStats?.totalHours ?? '-'}</div>
                          <p className="text-sm text-muted-foreground">Hours</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </div>
        </div>
      </AdvisorGate>
    </ErrorBoundary>
  );
}
