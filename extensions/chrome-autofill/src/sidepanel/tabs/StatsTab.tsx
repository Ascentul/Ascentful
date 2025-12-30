/**
 * Stats Tab
 *
 * Shows application analytics and activity summary.
 */

import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import type { ApplicationStats } from '~/types';

export function StatsTab() {
  const [stats, setStats] = useState<ApplicationStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
      if (response?.success && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('[StatsTab] Failed to fetch stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          <p className="text-sm text-neutral-500">Loading stats...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-neutral-500">Unable to load stats</p>
          <button
            onClick={fetchStats}
            className="mt-2 text-xs text-primary-500 hover:text-primary-600"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const stageData = [
    { label: 'Saved', count: stats.byStage.Prospect || 0, color: 'bg-neutral-400' },
    { label: 'Applied', count: stats.byStage.Applied || 0, color: 'bg-blue-500' },
    { label: 'Interview', count: stats.byStage.Interview || 0, color: 'bg-amber-500' },
    { label: 'Offer', count: stats.byStage.Offer || 0, color: 'bg-green-500' },
    { label: 'Rejected', count: stats.byStage.Rejected || 0, color: 'bg-red-400' },
  ];

  const totalApplications = stageData.reduce((sum, stage) => sum + stage.count, 0);
  const maxCount = Math.max(...stageData.map((s) => s.count), 1);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Summary Cards */}
      <div className="border-b border-neutral-200 bg-white px-4 py-3">
        <h2 className="mb-3 text-sm font-medium text-neutral-900">Activity Summary</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-neutral-50 p-3">
            <div className="text-2xl font-semibold text-neutral-900">{stats.totalApplications}</div>
            <div className="text-xs text-neutral-500">Total Applications</div>
          </div>
          <div className="rounded-lg bg-blue-50 p-3">
            <div className="text-2xl font-semibold text-blue-600">{stats.thisWeek}</div>
            <div className="text-xs text-neutral-500">This Week</div>
          </div>
          <div className="rounded-lg bg-amber-50 p-3">
            <div className="text-2xl font-semibold text-amber-600">{stats.interviews}</div>
            <div className="text-xs text-neutral-500">Interviews</div>
          </div>
          <div className="rounded-lg bg-green-50 p-3">
            <div className="text-2xl font-semibold text-green-600">{stats.responseRate}%</div>
            <div className="text-xs text-neutral-500">Response Rate</div>
          </div>
        </div>
      </div>

      {/* Pipeline Chart */}
      <div className="flex-1 px-4 py-4">
        <h3 className="mb-3 text-sm font-medium text-neutral-900">Application Pipeline</h3>
        <div className="space-y-3">
          {stageData.map((stage) => (
            <div key={stage.label}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs text-neutral-600">{stage.label}</span>
                <span className="text-xs font-medium text-neutral-900">{stage.count}</span>
              </div>
              <div className="h-2 rounded-full bg-neutral-100">
                <div
                  className={clsx('h-2 rounded-full transition-all', stage.color)}
                  style={{ width: `${(stage.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Application Streak */}
      {stats.streak > 0 && (
        <div className="border-t border-neutral-200 bg-gradient-to-r from-primary-50 to-blue-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100">
              <span className="text-lg">🔥</span>
            </div>
            <div>
              <div className="text-sm font-medium text-neutral-900">
                {stats.streak} Day Streak!
              </div>
              <div className="text-xs text-neutral-500">
                Keep applying to maintain your streak
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Tips */}
      <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-3">
        <h3 className="mb-2 text-xs font-medium uppercase text-neutral-500">Tips</h3>
        <ul className="space-y-1 text-xs text-neutral-600">
          {stats.interviews === 0 && stats.byStage.Applied > 3 && (
            <li>• Try customizing your resume for each application</li>
          )}
          {stats.thisWeek < 5 && (
            <li>• Aim for 5+ applications per week for best results</li>
          )}
          {stats.responseRate < 20 && stats.totalApplications > 10 && (
            <li>• Consider updating your resume summary</li>
          )}
          {stats.byStage.Interview > 0 && (
            <li>• Great job! Prepare for your interviews</li>
          )}
        </ul>
      </div>
    </div>
  );
}
