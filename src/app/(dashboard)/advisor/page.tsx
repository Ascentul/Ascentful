'use client';

/**
 * Advisor Dashboard - Action-Oriented Control Center
 *
 * Redesigned dashboard that answers three key questions the moment an advisor logs in:
 * 1. Who needs my attention right now? (Needs Attention strip)
 * 2. Who might quietly be slipping through the cracks? (Risk Overview panel)
 * 3. Are my students actually making progress toward real paths? (Progress & Outcomes)
 *
 * Layout organization (top to bottom):
 * - Needs Attention Today strip (urgent items)
 * - Quick Actions bar
 * - Caseload & Risk section (My Caseload, Risk Overview)
 * - Activity & Capacity section (Schedule & Capacity, Activity Chart)
 * - Progress & Outcomes section
 * - Upcoming & Reviews section (Upcoming Items, Review Queue)
 */

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useQuery } from 'convex/react';

import { AdvisorGate } from '@/components/advisor/AdvisorGate';
// Existing analytics components (reused)
import { ActivityChart } from '@/components/advisor/analytics/ActivityChart';
import { ReviewQueueSnapshot } from '@/components/advisor/analytics/ReviewQueueSnapshot';
import { UpcomingItems } from '@/components/advisor/analytics/UpcomingItems';
// New action-oriented dashboard components
import {
  CapacityCard,
  CaseloadGapsCard,
  NeedsAttentionStrip,
  ProgressOutcomesCard,
  QuickActionsBar,
  RiskOverviewPanel,
} from '@/components/advisor/dashboard';

export default function AdvisorDashboardPage() {
  const { user } = useUser();
  const clerkId = user?.id;

  // New V2 dashboard queries for action-oriented metrics
  const needsAttention = useQuery(
    api.advisor_dashboard_v2.getNeedsAttentionToday,
    clerkId ? { clerkId } : 'skip',
  );

  const riskOverview = useQuery(
    api.advisor_dashboard_v2.getRiskOverview,
    clerkId ? { clerkId } : 'skip',
  );

  const caseloadGaps = useQuery(
    api.advisor_dashboard_v2.getCaseloadGaps,
    clerkId ? { clerkId } : 'skip',
  );

  const capacitySchedule = useQuery(
    api.advisor_dashboard_v2.getCapacityAndSchedule,
    clerkId ? { clerkId } : 'skip',
  );

  const progressOutcomes = useQuery(
    api.advisor_dashboard_v2.getProgressAndOutcomes,
    clerkId ? { clerkId } : 'skip',
  );

  // Existing queries for compatibility with current components
  const upcomingItems = useQuery(
    api.advisor_dashboard.getUpcomingItems,
    clerkId ? { clerkId } : 'skip',
  );

  const activityChart = useQuery(
    api.advisor_dashboard.getActivityChart,
    clerkId ? { clerkId } : 'skip',
  );

  const reviewQueue = useQuery(
    api.advisor_dashboard.getReviewQueueSnapshot,
    clerkId ? { clerkId } : 'skip',
  );

  return (
    <AdvisorGate>
      <div className="w-full">
        <div className="w-full gradient-border-bottom p-5 space-y-6 shadow-sm">
          {/* Needs Attention Today - Top Strip */}
          <NeedsAttentionStrip data={needsAttention} isLoading={needsAttention === undefined} />

          {/* Header with Quick Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Advisor Dashboard
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Your control center for student success
              </p>
            </div>
            <QuickActionsBar />
          </div>

          {/* Section 1: Caseload & Risk Overview */}
          <section>
            <h2 className="sr-only">Caseload and Risk</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {/* My Caseload with Readiness Gaps */}
              <CaseloadGapsCard data={caseloadGaps} isLoading={caseloadGaps === undefined} />

              {/* Risk Overview Panel (replaces single At-Risk card) */}
              <RiskOverviewPanel data={riskOverview} isLoading={riskOverview === undefined} />
            </div>
          </section>

          {/* Section 2: Schedule, Capacity & Activity */}
          <section>
            <h2 className="sr-only">Activity and Capacity</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Schedule & Capacity with visual meter */}
              <CapacityCard data={capacitySchedule} isLoading={capacitySchedule === undefined} />

              {/* Session Activity Chart (existing) */}
              <ActivityChart data={activityChart || []} isLoading={activityChart === undefined} />
            </div>
          </section>

          {/* Section 3: Progress & Outcomes */}
          <section>
            <h2 className="sr-only">Progress and Outcomes</h2>
            <ProgressOutcomesCard
              data={progressOutcomes}
              isLoading={progressOutcomes === undefined}
            />
          </section>

          {/* Section 4: Upcoming & Reviews */}
          <section>
            <h2 className="sr-only">Upcoming and Reviews</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Upcoming Sessions & Follow-ups (existing) */}
              <UpcomingItems items={upcomingItems || []} isLoading={upcomingItems === undefined} />

              {/* Review Queue Snapshot (existing) */}
              <ReviewQueueSnapshot
                reviews={reviewQueue || []}
                isLoading={reviewQueue === undefined}
              />
            </div>
          </section>
        </div>
      </div>
    </AdvisorGate>
  );
}
