'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useQuery } from 'convex/react';
import {
  AlertCircle,
  ArrowRight,
  Bookmark,
  Briefcase,
  Calendar,
  Clock,
  MessageSquare,
  Plus,
  Send,
  Trophy,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { formatInterviewDate } from '@/lib/date-utils';
import { calculateFunnelStats } from '@/lib/journey';
import { cn } from '@/lib/utils';

// Funnel stage configuration
const FUNNEL_STAGES = [
  { id: 'saved', label: 'Saved', icon: Bookmark },
  { id: 'applied', label: 'Applied', icon: Send },
  { id: 'interview', label: 'Interviews', icon: MessageSquare },
  { id: 'offer', label: 'Offers', icon: Trophy },
] as const;

interface FunnelBarProps {
  stats: { saved: number; applied: number; interview: number; offer: number; total: number };
}

function FunnelBar({ stats }: FunnelBarProps) {
  const maxCount = Math.max(stats.saved, stats.applied, stats.interview, stats.offer, 1);

  return (
    <div className="space-y-2">
      {FUNNEL_STAGES.map((stage) => {
        const count = stats[stage.id as keyof typeof stats] as number;
        const percentage = (count / maxCount) * 100;
        const Icon = stage.icon;

        return (
          <Link
            key={stage.id}
            href={`/applications?stage=${stage.id === 'saved' ? 'Prospect' : stage.label}`}
            className="group flex items-center gap-3"
          >
            <div className="flex items-center gap-2 w-24 flex-shrink-0">
              <Icon className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#5371FF] transition-colors" />
              <span className="text-xs text-slate-600 group-hover:text-slate-900 transition-colors">
                {stage.label}
              </span>
            </div>
            <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300 group-hover:opacity-90',
                  stage.id === 'saved' && 'bg-slate-400',
                  stage.id === 'applied' && 'bg-blue-500',
                  stage.id === 'interview' && 'bg-purple-500',
                  stage.id === 'offer' && 'bg-green-500',
                )}
                style={{ width: `${Math.max(percentage, count > 0 ? 8 : 0)}%` }}
              />
            </div>
            <span className="w-8 text-right text-sm font-medium text-slate-700">{count}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function JobSearchOverview() {
  const { user: clerkUser } = useUser();
  const clerkId = clerkUser?.id;

  // Fetch applications
  const applications = useQuery(
    api.applications.getUserApplications,
    clerkId ? { clerkId } : 'skip',
  );

  // Fetch dashboard data for interview and followup info
  const dashboardData = useQuery(
    api.analytics.getUserDashboardAnalytics,
    clerkId ? { clerkId } : 'skip',
  );

  const isLoading = applications === undefined || dashboardData === undefined;

  // Calculate funnel stats
  const funnelStats = useMemo(() => {
    if (!applications) return { saved: 0, applied: 0, interview: 0, offer: 0, total: 0 };
    return calculateFunnelStats(applications);
  }, [applications]);

  const hasApplications = funnelStats.total > 0;
  const nextInterview = dashboardData?.nextInterviewDetails;
  const overdueFollowups = dashboardData?.overdueFollowups || 0;
  const pendingTasks = dashboardData?.pendingTasks || 0;

  return (
    <section className="h-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Briefcase className="h-4 w-4 text-[#5371FF]" />
            Job Search Overview
          </h3>
          <p className="text-xs text-slate-500">Track your application progress</p>
        </div>
        <Link href="/applications">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-slate-600 hover:text-slate-900"
          >
            View all
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>

      <div className="border-t border-slate-100" />

      <div className="flex-1 px-5 py-4 space-y-5">
        {isLoading ? (
          <div className="space-y-4">
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-24 h-4 bg-slate-100 rounded animate-pulse" />
                  <div className="flex-1 h-5 bg-slate-100 rounded-full animate-pulse" />
                  <div className="w-8 h-4 bg-slate-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ) : !hasApplications ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <Briefcase className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm text-slate-600 mb-1">No applications yet</p>
            <p className="text-xs text-slate-500 mb-4 max-w-[220px]">
              Start tracking your job search to see your progress
            </p>
            <Link href="/applications/new">
              <Button size="sm" className="bg-[#5371FF] hover:bg-[#4260e6] text-white rounded-xl">
                <Plus className="h-4 w-4 mr-1" />
                Add your first application
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Applications Journey Funnel */}
            <div>
              <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
                Applications Journey
              </h4>
              <FunnelBar stats={funnelStats} />
            </div>

            {/* Next Interview */}
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
                Next Interview
              </h4>
              {nextInterview ? (
                <Link
                  href="/applications"
                  className="flex items-start gap-3 p-3 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <Calendar className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {nextInterview.company}
                    </p>
                    <p className="text-xs text-slate-600 truncate">{nextInterview.title}</p>
                    <p className="text-xs text-purple-600 mt-1">
                      {nextInterview.date ? formatInterviewDate(nextInterview.date) : 'Date TBD'}
                    </p>
                  </div>
                </Link>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-500">No interviews scheduled</p>
                    <Link href="/applications" className="text-xs text-[#5371FF] hover:underline">
                      Review applications
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Follow-ups Summary */}
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
                Follow-ups
              </h4>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {overdueFollowups > 0 ? (
                    <>
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      <span className="text-sm text-slate-700">
                        <span className="font-medium text-amber-600">{overdueFollowups}</span>{' '}
                        overdue follow-up{overdueFollowups !== 1 ? 's' : ''}
                      </span>
                    </>
                  ) : pendingTasks > 0 ? (
                    <>
                      <Clock className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-slate-700">
                        <span className="font-medium">{pendingTasks}</span> pending task
                        {pendingTasks !== 1 ? 's' : ''}
                      </span>
                    </>
                  ) : (
                    <>
                      <Clock className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-slate-500">All caught up!</span>
                    </>
                  )}
                </div>
                <Link href="/applications" className="text-xs text-[#5371FF] hover:underline">
                  View all
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
