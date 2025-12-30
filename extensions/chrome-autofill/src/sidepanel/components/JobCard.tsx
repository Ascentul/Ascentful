/**
 * Job Card Component
 *
 * Compact display for a job application in the side panel.
 */

import { clsx } from 'clsx';
import type { ApplicationStage, ApplicationStatus } from '~/types';

interface Application {
  id: string;
  company: string;
  jobTitle: string;
  status?: ApplicationStatus;
  stage?: ApplicationStage;
  appliedAt?: number;
  url?: string;
  location?: string;
}

interface JobCardProps {
  application: Application;
  onClick?: () => void;
  onUpdateStatus?: (stage: ApplicationStage) => void;
}

const stageColors: Record<ApplicationStage, { bg: string; text: string }> = {
  Prospect: { bg: 'bg-neutral-100', text: 'text-neutral-600' },
  Applied: { bg: 'bg-blue-100', text: 'text-blue-700' },
  Interview: { bg: 'bg-amber-100', text: 'text-amber-700' },
  Offer: { bg: 'bg-green-100', text: 'text-green-700' },
  Accepted: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  Rejected: { bg: 'bg-red-100', text: 'text-red-700' },
  Withdrawn: { bg: 'bg-neutral-100', text: 'text-neutral-500' },
  Archived: { bg: 'bg-neutral-100', text: 'text-neutral-400' },
};

const stageLabels: Record<ApplicationStage, string> = {
  Prospect: 'Saved',
  Applied: 'Applied',
  Interview: 'Interview',
  Offer: 'Offer',
  Accepted: 'Accepted',
  Rejected: 'Rejected',
  Withdrawn: 'Withdrawn',
  Archived: 'Archived',
};

function formatDate(timestamp?: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getEffectiveStage(app: Application): ApplicationStage {
  // Use stage if available, otherwise map status to stage
  if (app.stage) return app.stage;
  if (!app.status) return 'Prospect';

  const statusToStage: Record<ApplicationStatus, ApplicationStage> = {
    'saved': 'Prospect',
    'applied': 'Applied',
    'interview': 'Interview',
    'offer': 'Offer',
    'rejected': 'Rejected',
  };
  return statusToStage[app.status] || 'Prospect';
}

export function JobCard({ application, onClick }: JobCardProps) {
  const effectiveStage = getEffectiveStage(application);
  const colors = stageColors[effectiveStage] || stageColors.Prospect;

  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border border-neutral-200 bg-white p-3 text-left transition-all hover:border-neutral-300 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-neutral-900">
            {application.company}
          </h3>
          <p className="truncate text-xs text-neutral-600">{application.jobTitle}</p>
          {application.location && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-neutral-400">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {application.location}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={clsx(
              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
              colors.bg,
              colors.text
            )}
          >
            {stageLabels[effectiveStage]}
          </span>
          {application.appliedAt && (
            <span className="text-[10px] text-neutral-400">
              {formatDate(application.appliedAt)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
