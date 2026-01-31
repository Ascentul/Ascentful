'use client';

import {
  ArrowRight,
  BarChart3,
  Bell,
  Calendar,
  CheckCircle,
  ClipboardList,
  Clock,
  Download,
  FileText,
  Globe,
  MessageSquare,
  Search,
  Send,
  TrendingUp,
  Upload,
  UserCheck,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ImportSurveyModal } from '@/components/cohortos/modals';
import { AlertCard } from '@/components/cohortos/ui/alert-card';
import { PipelineBar } from '@/components/cohortos/ui/pipeline-bar';
import { StatCard } from '@/components/cohortos/ui/stat-card';
import { Button } from '@/components/ui/button';
import { getAlertCounts, getPipelineStats, mockSurveys } from '@/lib/cohortos/mock-data';

// Recent activity data (hardcoded for demo)
const recentActivity = [
  {
    id: 1,
    icon: TrendingUp,
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    description: 'Sarah Chen moved to "Interviewing"',
    timestamp: '2 hours ago',
  },
  {
    id: 2,
    icon: Send,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    description: 'Auto-reminder sent to 12 non-responders',
    timestamp: '6 hours ago',
  },
  {
    id: 3,
    icon: CheckCircle,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    description: 'Michael Torres - blocker resolved',
    timestamp: 'Yesterday',
  },
  {
    id: 4,
    icon: ClipboardList,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    description: 'Survey imported: 36 responses',
    timestamp: 'Jan 20',
  },
  {
    id: 5,
    icon: UserCheck,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    description: 'Kevin Nguyen placed at Google',
    timestamp: '8 days ago',
  },
];

export default function CohortOSDashboardPage() {
  const router = useRouter();
  const stats = getPipelineStats();
  const alerts = getAlertCounts();
  const latestSurvey = mockSurveys[0];

  // Modal state
  const [showImportModal, setShowImportModal] = useState(false);

  // Navigation handlers
  const navigateToStudents = (filter?: string, value?: string) => {
    const params = new URLSearchParams();
    if (filter && value) {
      params.set(filter, value);
    }
    const queryString = params.toString();
    router.push(`/cohortos/students${queryString ? `?${queryString}` : ''}`);
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Spring 2026 Cohort</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import Survey
          </Button>
          <Button variant="outline" size="sm" onClick={() => console.log('New Outreach clicked')}>
            <Send className="h-4 w-4 mr-2" />
            New Outreach
          </Button>
          <Button variant="outline" size="sm" onClick={() => console.log('Export Data clicked')}>
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      {/* Pipeline Summary Section */}
      <section>
        <h2 className="text-lg font-medium text-slate-900 mb-4">Pipeline Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard
            label="Total Students"
            value={stats.total}
            icon={Users}
            onClick={() => navigateToStudents()}
          />
          <StatCard
            label="Searching"
            value={stats.searching}
            icon={Search}
            onClick={() => navigateToStudents('status', 'searching')}
          />
          <StatCard
            label="Applying"
            value={stats.applying}
            icon={FileText}
            onClick={() => navigateToStudents('status', 'applying')}
          />
          <StatCard
            label="Interviewing"
            value={stats.interviewing}
            icon={MessageSquare}
            onClick={() => navigateToStudents('status', 'interviewing')}
          />
          <StatCard
            label="Offered + Placed"
            value={stats.offered + stats.placed}
            icon={CheckCircle}
            onClick={() => navigateToStudents('status', 'placed')}
          />
        </div>

        {/* Pipeline Progress Bar */}
        <div className="mt-6 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <PipelineBar stats={stats} height="lg" />
        </div>
      </section>

      {/* Two-Column Section: Alerts + Survey Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alerts Section */}
        <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-slate-600" />
            <h2 className="text-lg font-medium text-slate-900">Alerts</h2>
          </div>
          <div className="space-y-3">
            <AlertCard
              variant="warning"
              title="Students not updated in 14+ days"
              count={alerts.staleCount}
              onAction={() => navigateToStudents('filter', 'stale')}
            />
            <AlertCard
              variant="warning"
              title="Students with blockers"
              count={alerts.blockerCount}
              onAction={() => navigateToStudents('filter', 'blockers')}
            />
            <AlertCard
              variant="info"
              title="International students still searching"
              count={alerts.internationalSearchingCount}
              onAction={() => navigateToStudents('filter', 'international-searching')}
            />
            <AlertCard
              variant="error"
              title="CPT deadlines within 60 days"
              count={alerts.cptDeadlineSoonCount}
              onAction={() => navigateToStudents('filter', 'cpt-deadline')}
            />
          </div>
        </section>

        {/* Survey Performance Section */}
        <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-slate-600" />
            <h2 className="text-lg font-medium text-slate-900">Survey Performance</h2>
          </div>

          {latestSurvey ? (
            <div className="space-y-4">
              {/* Survey Info */}
              <div>
                <h3 className="font-medium text-slate-900">{latestSurvey.name}</h3>
                <p className="text-sm text-slate-500">Sent {latestSurvey.dateSent}</p>
              </div>

              {/* Response Rate */}
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-slate-900">
                    {latestSurvey.responses.final.percentage}%
                  </span>
                  <span className="text-sm text-slate-500">response rate</span>
                </div>

                {/* Progress Bar */}
                <div className="mt-3 h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 rounded-full transition-all"
                    style={{ width: `${latestSurvey.responses.final.percentage}%` }}
                  />
                </div>

                {/* Comparison */}
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <span className="text-slate-500">Initial:</span>
                  <span className="font-medium text-slate-700">
                    {latestSurvey.responses.initial.percentage}%
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-500">Final:</span>
                  <span className="font-medium text-green-600">
                    {latestSurvey.responses.final.percentage}%
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div className="text-sm">
                  <span className="text-slate-500">Responses:</span>{' '}
                  <span className="font-medium text-slate-900">
                    {latestSurvey.responses.final.count} / {latestSurvey.totalSent}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">Auto-reminders:</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    ON
                  </span>
                </div>
              </div>

              {/* View Details Link */}
              <button
                onClick={() => router.push('/cohortos/surveys')}
                className="w-full mt-2 text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center justify-center gap-1"
              >
                View Details
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">No surveys yet</div>
          )}
        </section>
      </div>

      {/* Recent Activity Section */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-slate-600" />
          <h2 className="text-lg font-medium text-slate-900">Recent Activity</h2>
        </div>
        <div className="space-y-4">
          {recentActivity.map((activity) => {
            const Icon = activity.icon;
            return (
              <div key={activity.id} className="flex items-start gap-3">
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${activity.iconBg}`}
                >
                  <Icon className={`h-4 w-4 ${activity.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900">{activity.description}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{activity.timestamp}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Import Survey Modal */}
      <ImportSurveyModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} />
    </div>
  );
}
