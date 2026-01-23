import { api } from 'convex/_generated/api';
import { fetchQuery } from 'convex/nextjs';
import { NextRequest, NextResponse } from 'next/server';

import { requireConvexToken } from '@/lib/convex-auth';
import { getExtensionCorsHeaders } from '@/lib/extension-auth/cors';
import { verifyExtensionSessionToken } from '@/lib/extension-auth/extensionState';
import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('Origin');
  const corsHeaders = getExtensionCorsHeaders(origin, 'GET, OPTIONS');
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * GET /api/extension/stats/summary
 *
 * Returns summary statistics for the extension side panel.
 * Includes application counts by stage, activity metrics, and streak info.
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get('Origin');
  const corsHeaders = getExtensionCorsHeaders(origin, 'GET, OPTIONS');
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'extension',
    httpMethod: 'GET',
    httpPath: '/api/extension/stats/summary',
  });

  const startTime = Date.now();

  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('Authorization');
    const extensionToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    if (!extensionToken) {
      log.warn('Missing authorization header', { event: 'auth.failed' });
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401, headers: corsHeaders },
      );
    }

    // Verify the extension session token
    let clerkId: string;
    try {
      const result = verifyExtensionSessionToken(extensionToken);
      clerkId = result.clerkId;
    } catch (error) {
      log.warn('Token verification failed', {
        event: 'token.invalid',
        extra: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401, headers: corsHeaders },
      );
    }

    // Get Convex token for server-side queries
    const { token: convexToken } = await requireConvexToken();

    // Fetch user to verify they exist
    const user = await fetchQuery(
      api.users_queries.getUserByClerkId,
      { clerkId },
      { token: convexToken },
    );

    if (!user) {
      log.warn('User not found', { event: 'user.not_found' });
      return NextResponse.json({ error: 'User not found' }, { status: 404, headers: corsHeaders });
    }

    // Fetch applications for the Kanban view to get counts
    const kanbanData = await fetchQuery(
      api.applications.getApplicationsForKanban,
      { clerkId },
      { token: convexToken },
    );

    // Calculate application counts
    const applicationCounts = {
      saved: kanbanData.saved.length,
      applied: kanbanData.applied.length,
      interview: kanbanData.interview.length,
      offer: kanbanData.offer.length,
      rejected: kanbanData.rejected.length,
      total:
        kanbanData.saved.length +
        kanbanData.applied.length +
        kanbanData.interview.length +
        kanbanData.offer.length +
        kanbanData.rejected.length,
    };

    // Calculate this week's activity
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

    const allApps = [
      ...kanbanData.saved,
      ...kanbanData.applied,
      ...kanbanData.interview,
      ...kanbanData.offer,
      ...kanbanData.rejected,
    ];

    // Applications created this week
    const applicationsThisWeek = allApps.filter((app) => app.created_at >= oneWeekAgo).length;

    // Applications updated this week
    const activeThisWeek = allApps.filter((app) => app.updated_at >= oneWeekAgo).length;

    // Interviews scheduled (from kanban summaries)
    const upcomingInterviews = allApps.reduce((count, app) => {
      if (app.interviewSummary?.stages) {
        return count + app.interviewSummary.stages.filter((s) => s.scheduled_at >= now).length;
      }
      return count;
    }, 0);

    // Open tasks count
    const openTasks = allApps.reduce((count, app) => {
      return count + (app.actionSummary?.openCount || 0);
    }, 0);

    // Overdue tasks count
    const overdueTasks = allApps.reduce((count, app) => {
      return count + (app.actionSummary?.overdueCount || 0);
    }, 0);

    // Response rate calculation (applications that got past 'applied' stage)
    const appliedAndBeyond =
      applicationCounts.applied + applicationCounts.interview + applicationCounts.offer;
    const responses = applicationCounts.interview + applicationCounts.offer;
    const responseRate =
      appliedAndBeyond > 0 ? Math.round((responses / appliedAndBeyond) * 100) : 0;

    // Fetch streak summary
    // Note: getStreakSummary uses auth identity, not clerkId param
    let streakData = { currentStreak: 0, longestStreak: 0, totalActiveDays: 0 };
    try {
      const streak = await fetchQuery(api.activity.getStreakSummary, {}, { token: convexToken });
      if (streak) {
        streakData = {
          currentStreak: streak.currentStreak || 0,
          longestStreak: streak.longestStreak || 0,
          totalActiveDays: streak.totalActiveDays || 0,
        };
      }
    } catch {
      // Streak query might fail for new users, that's ok
    }

    const stats = {
      applications: applicationCounts,
      activity: {
        applicationsThisWeek,
        activeThisWeek,
        upcomingInterviews,
        openTasks,
        overdueTasks,
        responseRate,
      },
      streak: streakData,
    };

    const durationMs = Date.now() - startTime;
    log.debug('Stats summary fetched', {
      event: 'request.success',
      durationMs,
      extra: { totalApplications: applicationCounts.total },
    });

    return NextResponse.json(stats, {
      headers: { ...corsHeaders, 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error('Error fetching stats summary', toErrorCode(error), {
      event: 'request.error',
      durationMs,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders },
    );
  }
}
