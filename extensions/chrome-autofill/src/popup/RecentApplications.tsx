/**
 * RecentApplications Component
 *
 * Shows a list of recently submitted applications.
 */

import { useEffect, useState } from 'react';
import { storage } from '~/lib/storage';
import { api } from '~/lib/api';
import type { JobApplication } from '~/types';

export function RecentApplications() {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    setIsLoading(true);

    try {
      // First load from cache
      const cached = await storage.getRecentApplications();
      if (cached.length > 0) {
        setApplications(cached.slice(0, 5));
      }

      // Then fetch fresh data
      const result = await api.getRecentApplications();
      if (result.success && result.data?.applications) {
        // Map API response to JobApplication type with defaults for missing fields
        const freshApps: JobApplication[] = result.data.applications.slice(0, 5).map((app) => ({
          id: app.id,
          company: app.company,
          jobTitle: app.jobTitle,
          url: app.url,
          status: app.status as JobApplication['status'],
          appliedAt: app.appliedAt,
          source: 'api',
          atsPlatform: 'unknown',
        }));
        setApplications(freshApps);
        // Update cache with fresh data
        await storage.setRecentApplications(freshApps);
      }
    } catch (error) {
      console.error('[Ascentul] Failed to load applications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && applications.length === 0) {
    return (
      <div className="py-4 text-center">
        <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="text-center py-4">
        <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-2">
          <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </div>
        <p className="text-sm text-neutral-500">No applications yet</p>
        <p className="text-xs text-neutral-400">Applications will appear here as you apply</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
        Recent Applications
      </h3>
      <div className="space-y-2">
        {applications.map((app) => (
          <ApplicationCard key={app.id} application={app} />
        ))}
      </div>
      <button
        onClick={() => window.open('https://app.ascentful.io/applications', '_blank')}
        className="w-full mt-2 py-2 text-xs text-primary-500 hover:text-primary-700
                   hover:bg-primary-50 rounded-lg transition-colors"
      >
        View all applications
      </button>
    </div>
  );
}

function ApplicationCard({ application }: { application: JobApplication }) {
  const statusColors: Record<string, string> = {
    saved: 'bg-neutral-100 text-neutral-600',
    applied: 'bg-blue-100 text-blue-700',
    interview: 'bg-purple-100 text-purple-700',
    offer: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div
      className="flex items-center gap-3 p-2 bg-white rounded-lg border border-neutral-100
                    hover:border-neutral-200 transition-colors cursor-pointer"
      onClick={() => application.url && window.open(application.url, '_blank')}
    >
      {/* Company Logo Placeholder */}
      <div className="w-8 h-8 bg-neutral-100 rounded flex items-center justify-center text-neutral-400 flex-shrink-0">
        <span className="text-xs font-medium">
          {application.company?.charAt(0).toUpperCase() || '?'}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-900 truncate">{application.jobTitle}</p>
        <p className="text-xs text-neutral-500 truncate">{application.company}</p>
      </div>

      {/* Status & Date */}
      <div className="text-right flex-shrink-0">
        <span
          className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
            statusColors[application.status] || statusColors.applied
          }`}
        >
          {application.status}
        </span>
        <p className="text-xs text-neutral-400 mt-0.5">{formatDate(application.appliedAt)}</p>
      </div>
    </div>
  );
}

export default RecentApplications;
