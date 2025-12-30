/**
 * Current Job Tab
 *
 * Shows the detected job from the current page with options to save or autofill.
 */

import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import type { PageContext, ScrapedJobData, ApplicationStage, JobType, RemoteType } from '~/types';
import { SaveJobModal } from '../components/SaveJobModal';

interface SaveJobFormData {
  company: string;
  jobTitle: string;
  url: string;
  location?: string;
  salary?: string;
  jobType?: JobType;
  remote?: RemoteType;
  notes?: string;
  status: ApplicationStage;
}

export function CurrentJobTab() {
  const [pageContext, setPageContext] = useState<PageContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isFilling, setIsFilling] = useState(false);
  const [fillResult, setFillResult] = useState<{ success: boolean; message: string } | null>(null);

  // Fetch page context on mount and when page changes
  useEffect(() => {
    fetchPageContext();

    // Listen for page context updates
    const handleMessage = (message: { type: string; payload?: PageContext }) => {
      if (message.type === 'PAGE_CONTEXT_UPDATED' && message.payload) {
        setPageContext(message.payload);
        setIsLoading(false);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  const fetchPageContext = async () => {
    setIsLoading(true);
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        setIsLoading(false);
        return;
      }

      // Send message to content script to get page context
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTEXT' });
      if (response?.success && response.data) {
        setPageContext(response.data);
      }
    } catch (error) {
      console.error('[SidePanel] Failed to get page context:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillForm = async () => {
    setIsFilling(true);
    setFillResult(null);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      const response = await chrome.tabs.sendMessage(tab.id, { type: 'FILL_FORM' });
      if (response?.success) {
        setFillResult({
          success: true,
          message: `Filled ${response.filledFields || 0} fields!`,
        });
      } else {
        setFillResult({
          success: false,
          message: response?.error || 'Failed to fill form',
        });
      }
    } catch (error) {
      setFillResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fill form',
      });
    } finally {
      setIsFilling(false);
    }
  };

  const handleSaveJob = async (data: SaveJobFormData) => {
    if (!pageContext?.jobData) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_JOB',
        payload: {
          company: data.company,
          jobTitle: data.jobTitle,
          url: data.url,
          location: data.location,
          salary: data.salary,
          jobType: data.jobType,
          remote: data.remote,
          notes: data.notes,
          stage: data.status,
        },
      });

      if (response?.success) {
        // Update context to show it's saved
        setPageContext((prev) =>
          prev ? { ...prev, existingApplicationId: response.data?.id } : null
        );

        setShowSaveModal(false);
      }
    } catch (error) {
      console.error('[SidePanel] Failed to save job:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          <p className="text-sm text-neutral-500">Detecting job...</p>
        </div>
      </div>
    );
  }

  if (!pageContext?.jobData) {
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
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-medium text-neutral-900">No job detected</h3>
        <p className="mb-4 text-sm text-neutral-500">
          Navigate to a job listing to save or autofill it.
        </p>
        <button
          onClick={fetchPageContext}
          className="text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          Refresh
        </button>
      </div>
    );
  }

  const { jobData, formDetected, existingApplicationId } = pageContext;

  return (
    <div className="flex h-full flex-col">
      {/* Job Card */}
      <div className="border-b border-neutral-200 bg-white p-4">
        <div className="flex items-start gap-3">
          {/* Company Logo */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-neutral-100">
            {jobData.logoUrl ? (
              <img
                src={jobData.logoUrl}
                alt={jobData.company}
                className="h-10 w-10 rounded object-contain"
              />
            ) : (
              <span className="text-lg font-semibold text-neutral-500">
                {jobData.company?.charAt(0)?.toUpperCase() || '?'}
              </span>
            )}
          </div>

          {/* Job Info */}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-neutral-900">
              {jobData.jobTitle}
            </h2>
            <p className="truncate text-sm text-neutral-600">{jobData.company}</p>
            {jobData.location && (
              <p className="mt-1 flex items-center gap-1 text-xs text-neutral-500">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {jobData.location}
              </p>
            )}
          </div>
        </div>

        {/* Additional Details */}
        <div className="mt-3 flex flex-wrap gap-2">
          {jobData.salary && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              {jobData.salary}
            </span>
          )}
          {jobData.jobType && (
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
              {jobData.jobType}
            </span>
          )}
          {jobData.remote && (
            <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">
              {jobData.remote}
            </span>
          )}
        </div>

        {/* Confidence Indicator */}
        {pageContext.scrapingConfidence < 0.8 && (
          <p className="mt-3 text-xs text-amber-600">
            Some details may be incomplete. Please review before saving.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex-1 p-4">
        {existingApplicationId ? (
          <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <path d="M22 4L12 14.01l-3-3" />
              </svg>
              <span className="font-medium">Job already saved!</span>
            </div>
            <button
              onClick={() => {
                // Open in main app
                const appUrl = process.env.PLASMO_PUBLIC_APP_URL || 'https://app.ascentful.io';
                window.open(`${appUrl}/applications/${existingApplicationId}`, '_blank');
              }}
              className="mt-2 text-xs font-medium text-green-700 underline hover:no-underline"
            >
              View in Ascentul
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowSaveModal(true)}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-600"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            Save Job
          </button>
        )}

        {formDetected && (
          <>
            <button
              onClick={handleFillForm}
              disabled={isFilling}
              className={clsx(
                'flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
                isFilling
                  ? 'cursor-wait border-neutral-200 bg-neutral-50 text-neutral-400'
                  : 'border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100'
              )}
            >
              {isFilling ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                  Filling...
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Autofill Application
                </>
              )}
            </button>

            {fillResult && (
              <p
                className={clsx(
                  'mt-2 text-center text-sm',
                  fillResult.success ? 'text-green-600' : 'text-red-600'
                )}
              >
                {fillResult.message}
              </p>
            )}
          </>
        )}
      </div>

      {/* Job Description Preview */}
      {jobData.description && (
        <div className="border-t border-neutral-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-medium text-neutral-900">Description</h3>
          <p className="line-clamp-4 text-xs text-neutral-600">{jobData.description}</p>
        </div>
      )}

      {/* Save Job Modal */}
      {showSaveModal && jobData && (
        <SaveJobModal
          jobData={jobData}
          onSave={handleSaveJob}
          onClose={() => setShowSaveModal(false)}
        />
      )}
    </div>
  );
}
