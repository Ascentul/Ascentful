/**
 * ProfilePreview Component
 *
 * Shows a summary of the user's profile data that will be used for autofill.
 */

import type { ExtensionProfile } from '~/types';
import { useProfileStore } from '~/store/profileStore';

interface ProfilePreviewProps {
  profile: ExtensionProfile;
}

export function ProfilePreview({ profile }: ProfilePreviewProps) {
  const { selectedResumeId, selectResume, syncProfile } = useProfileStore();
  const selectedResume = profile.resumes.find((r) => r.id === selectedResumeId);

  const completionItems = [
    { label: 'Email', filled: !!profile.email },
    { label: 'Phone', filled: !!profile.phoneNumber },
    { label: 'Location', filled: !!profile.location || !!profile.city },
    { label: 'LinkedIn', filled: !!profile.linkedinUrl },
    { label: 'Work History', filled: profile.workHistory.length > 0 },
    { label: 'Education', filled: profile.educationHistory.length > 0 },
  ];

  const filledCount = completionItems.filter((i) => i.filled).length;
  const completionPercentage = Math.round((filledCount / completionItems.length) * 100);

  return (
    <div className="bg-neutral-50 rounded-card p-4">
      {/* Profile Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-semibold text-sm">
            {profile.name
              ?.split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2) || '?'}
          </div>
          <div>
            <h3 className="font-medium text-neutral-900 text-sm">{profile.name}</h3>
            <p className="text-xs text-neutral-500">
              {profile.currentPosition || 'No title set'}
              {profile.currentCompany && ` at ${profile.currentCompany}`}
            </p>
          </div>
        </div>
        <button
          onClick={() => syncProfile()}
          className="p-1.5 text-neutral-400 hover:text-primary-500 hover:bg-white rounded-lg transition-colors"
          title="Refresh profile"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {/* Completion Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-neutral-500">Profile completeness</span>
          <span className="font-medium text-neutral-700">{completionPercentage}%</span>
        </div>
        <div className="h-1.5 bg-neutral-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Stat label="Experience" value={`${profile.workHistory.length} roles`} />
        <Stat label="Education" value={`${profile.educationHistory.length} schools`} />
        <Stat label="Resumes" value={`${profile.resumes.length} saved`} />
      </div>

      {/* Resume Selector */}
      {profile.resumes.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1.5">
            Resume for autofill
          </label>
          <select
            value={selectedResumeId || ''}
            onChange={(e) => selectResume(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-neutral-200 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            {profile.resumes.map((resume) => (
              <option key={resume.id} value={resume.id}>
                {resume.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Edit Profile Link */}
      <button
        onClick={() => chrome.runtime.openOptionsPage()}
        className="w-full mt-3 py-2 text-xs text-primary-500 hover:text-primary-700
                   hover:bg-primary-50 rounded-lg transition-colors"
      >
        Edit profile data
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg p-2 text-center">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-sm font-medium text-neutral-900">{value}</p>
    </div>
  );
}

export default ProfilePreview;
