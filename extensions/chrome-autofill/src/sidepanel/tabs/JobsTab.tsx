/**
 * Jobs Tab
 *
 * Shows recent applications grouped by status with quick actions.
 */

import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import type { ApplicationStage } from '~/types';
import { JobCard } from '../components/JobCard';
import { ApplicationDetail } from '../views/ApplicationDetail';
import { useApplicationsStore } from '~/store/applicationsStore';

const stageGroups: { stage: ApplicationStage; label: string; color: string }[] = [
  { stage: 'Prospect', label: 'Saved', color: 'bg-neutral-100 text-neutral-700' },
  { stage: 'Applied', label: 'Applied', color: 'bg-blue-100 text-blue-700' },
  { stage: 'Interview', label: 'Interview', color: 'bg-purple-100 text-purple-700' },
  { stage: 'Offer', label: 'Offer', color: 'bg-green-100 text-green-700' },
];

export function JobsTab() {
  const {
    applications,
    isLoading,
    fetchApplications,
    selectedApplicationId,
    selectApplication,
  } = useApplicationsStore();
  const [filter, setFilter] = useState<ApplicationStage | 'all'>('all');

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const filteredApplications =
    filter === 'all'
      ? applications
      : applications.filter((app) => app.stage === filter || (!app.stage && filter === 'Prospect'));

  const groupedApplications = stageGroups.map((group) => ({
    ...group,
    applications: applications.filter(
      (app) => app.stage === group.stage || (!app.stage && group.stage === 'Prospect')
    ),
  }));

  // Show detail view if an application is selected
  if (selectedApplicationId) {
    return (
      <ApplicationDetail
        applicationId={selectedApplicationId}
        onClose={() => selectApplication(null)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          <p className="text-sm text-neutral-500">Loading applications...</p>
        </div>
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100">
          <svg
            className="h-8 w-8 text-neutral-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-medium text-neutral-900">No applications yet</h3>
        <p className="text-sm text-neutral-500">
          Save jobs from listings to start tracking your applications.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Filter Tabs */}
      <div className="border-b border-neutral-200 bg-white px-4 py-2">
        <div className="flex gap-1 overflow-x-auto">
          <button
            onClick={() => setFilter('all')}
            className={clsx(
              'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              filter === 'all'
                ? 'bg-neutral-900 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            )}
          >
            All ({applications.length})
          </button>
          {stageGroups.map((group) => {
            const count = groupedApplications.find((g) => g.stage === group.stage)?.applications.length || 0;
            if (count === 0) return null;
            return (
              <button
                key={group.stage}
                onClick={() => setFilter(group.stage)}
                className={clsx(
                  'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  filter === group.stage
                    ? 'bg-neutral-900 text-white'
                    : clsx(group.color, 'hover:opacity-80')
                )}
              >
                {group.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Applications List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {filteredApplications.map((app) => (
            <JobCard
              key={app.id}
              application={{
                id: app.id,
                company: app.company,
                jobTitle: app.jobTitle,
                status: app.status,
                stage: app.stage,
                appliedAt: app.appliedAt,
                url: app.url,
                location: app.location,
              }}
              onClick={() => selectApplication(app.id)}
            />
          ))}
        </div>
      </div>

      {/* Open Full App Button */}
      <div className="border-t border-neutral-200 bg-white p-3">
        <button
          onClick={() => {
            const appUrl = process.env.PLASMO_PUBLIC_APP_URL || 'https://app.ascentful.io';
            window.open(`${appUrl}/applications`, '_blank');
          }}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          View All in Ascentul
        </button>
      </div>
    </div>
  );
}
