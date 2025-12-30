/**
 * Application Detail View
 *
 * Full details view for a selected application with editing capabilities.
 */

import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import type { ApplicationStage } from '~/types';
import { useApplicationsStore, type Application } from '~/store/applicationsStore';
import { StatusSelector } from '../components/StatusSelector';
import { NotesEditor } from '../components/NotesEditor';

interface ApplicationDetailProps {
  applicationId: string;
  onClose: () => void;
}

export function ApplicationDetail({ applicationId, onClose }: ApplicationDetailProps) {
  const { applications, updateApplication, isUpdating } = useApplicationsStore();
  const [application, setApplication] = useState<Application | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    const app = applications.find((a) => a.id === applicationId);
    setApplication(app || null);
  }, [applicationId, applications]);

  if (!application) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100">
          <svg className="h-8 w-8 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-medium text-neutral-900">Application not found</h3>
        <button onClick={onClose} className="text-sm font-medium text-primary-600 hover:text-primary-700">
          Go back
        </button>
      </div>
    );
  }

  const handleStageChange = async (stage: ApplicationStage) => {
    setUpdateError(null);
    const success = await updateApplication(application.id, { stage });
    if (!success) {
      setUpdateError('Failed to update stage');
    }
  };

  const handleNotesSave = async (notes: string) => {
    setUpdateError(null);
    const success = await updateApplication(application.id, { notes });
    if (!success) {
      throw new Error('Failed to save notes');
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const appUrl = process.env.PLASMO_PUBLIC_APP_URL || 'https://app.ascentful.io';

  return (
    <div className="flex h-full flex-col">
      {/* Header with back button */}
      <div className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3">
        <button
          onClick={onClose}
          aria-label="Go back"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="flex-1 truncate text-lg font-semibold text-neutral-900">Application Details</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Company & Job Header */}
        <div className="border-b border-neutral-200 bg-white p-4">
          <div className="flex items-start gap-3">
            {/* Company Logo */}
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-neutral-100">
              {application.logoUrl ? (
                <img
                  src={application.logoUrl}
                  alt={application.company}
                  className="h-12 w-12 rounded-lg object-contain"
                />
              ) : (
                <span className="text-xl font-semibold text-neutral-500">
                  {application.company?.charAt(0)?.toUpperCase() || '?'}
                </span>
              )}
            </div>

            {/* Job Info */}
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-neutral-900">{application.jobTitle}</h3>
              <p className="text-sm text-neutral-600">{application.company}</p>
              {application.location && (
                <p className="mt-1 flex items-center gap-1 text-xs text-neutral-500">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {application.location}
                </p>
              )}
            </div>
          </div>

          {/* Status Badge & Date */}
          <div className="mt-4 flex items-center justify-between">
            <StatusSelector
              currentStage={application.stage}
              onChange={handleStageChange}
              disabled={isUpdating}
            />
            <span className="text-xs text-neutral-500">
              Added {formatDate(application.appliedAt)}
            </span>
          </div>

          {updateError && (
            <p className="mt-2 text-xs text-red-600">{updateError}</p>
          )}
        </div>

        {/* Details Section */}
        <div className="space-y-4 p-4">
          {/* Salary */}
          {application.salary && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3">
              <svg className="h-5 w-5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              <span className="text-sm font-medium text-green-700">{application.salary}</span>
            </div>
          )}

          {/* Tasks Summary */}
          {(application.openTasks || application.overdueTasks) && (
            <div className="rounded-lg border border-neutral-200 bg-white p-3">
              <h4 className="mb-2 text-sm font-medium text-neutral-700">Tasks</h4>
              <div className="flex gap-4">
                {application.openTasks !== undefined && application.openTasks > 0 && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <span className="text-neutral-600">{application.openTasks} open</span>
                  </div>
                )}
                {application.overdueTasks !== undefined && application.overdueTasks > 0 && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <div className="h-2 w-2 rounded-full bg-red-500" />
                    <span className="text-red-600">{application.overdueTasks} overdue</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Next Interview */}
          {application.nextInterviewAt && (
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <div>
                  <p className="text-xs text-purple-600">Next Interview</p>
                  <p className="text-sm font-medium text-purple-700">
                    {new Date(application.nextInterviewAt).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="rounded-lg border border-neutral-200 bg-white p-3">
            <NotesEditor
              initialNotes={application.notes}
              onSave={handleNotesSave}
              disabled={isUpdating}
            />
          </div>

          {/* Job URL */}
          {application.url && (
            <a
              href={application.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white p-3 text-sm text-neutral-600 transition-colors hover:bg-neutral-50"
            >
              <svg className="h-4 w-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              <span className="flex-1 truncate">{application.url}</span>
            </a>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="border-t border-neutral-200 bg-white p-3">
        <div className="flex gap-2">
          <button
            onClick={() => window.open(`${appUrl}/applications/${application.id}`, '_blank')}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Open in Ascentul
          </button>
          {application.url && (
            <button
              onClick={() => window.open(application.url, '_blank')}
              aria-label="View job posting"
              className="flex items-center justify-center rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-600"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
