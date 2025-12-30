/**
 * Save Job Modal Component
 *
 * Modal for confirming and editing job details before saving.
 */

import { useState } from 'react';
import { clsx } from 'clsx';
import type { ScrapedJobData, JobType, RemoteType, ApplicationStage } from '~/types';

interface SaveJobModalProps {
  jobData: ScrapedJobData;
  onSave: (data: SaveJobFormData) => Promise<void>;
  onClose: () => void;
}

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

export function SaveJobModal({ jobData, onSave, onClose }: SaveJobModalProps) {
  const [formData, setFormData] = useState<SaveJobFormData>({
    company: jobData.company,
    jobTitle: jobData.jobTitle,
    url: jobData.url,
    location: jobData.location,
    salary: jobData.salary,
    jobType: jobData.jobType,
    remote: jobData.remote,
    notes: '',
    status: 'Prospect',
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = <K extends keyof SaveJobFormData>(key: K, value: SaveJobFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <h2 className="text-base font-medium text-neutral-900">Save Job</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="max-h-[60vh] overflow-y-auto p-4">
          <div className="space-y-4">
            {/* Company */}
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700">
                Company <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => updateField('company', e.target.value)}
                required
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            {/* Job Title */}
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700">
                Job Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.jobTitle}
                onChange={(e) => updateField('jobTitle', e.target.value)}
                required
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            {/* Location */}
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700">Location</label>
              <input
                type="text"
                value={formData.location || ''}
                onChange={(e) => updateField('location', e.target.value)}
                placeholder="e.g., San Francisco, CA"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            {/* Salary */}
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700">Salary</label>
              <input
                type="text"
                value={formData.salary || ''}
                onChange={(e) => updateField('salary', e.target.value)}
                placeholder="e.g., $100k - $150k"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            {/* Job Type & Remote */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700">Job Type</label>
                <select
                  value={formData.jobType || ''}
                  onChange={(e) => updateField('jobType', e.target.value as JobType || undefined)}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">Select...</option>
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="internship">Internship</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700">Remote</label>
                <select
                  value={formData.remote || ''}
                  onChange={(e) => updateField('remote', e.target.value as RemoteType || undefined)}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">Select...</option>
                  <option value="onsite">On-site</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700">Status</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => updateField('status', 'Prospect')}
                  className={clsx(
                    'flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                    formData.status === 'Prospect'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                  )}
                >
                  Save for Later
                </button>
                <button
                  type="button"
                  onClick={() => updateField('status', 'Applied')}
                  className={clsx(
                    'flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                    formData.status === 'Applied'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                  )}
                >
                  Already Applied
                </button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700">Notes</label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Add any notes about this job..."
                rows={3}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex gap-2 border-t border-neutral-200 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || !formData.company || !formData.jobTitle}
            className="flex-1 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Job'}
          </button>
        </div>
      </div>
    </div>
  );
}
