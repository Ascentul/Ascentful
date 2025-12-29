/**
 * Extension Popup
 *
 * Main entry point for the extension popup UI.
 */

import { useEffect, useState } from 'react';
import { useAuthStore } from '~/store/authStore';
import { useProfileStore } from '~/store/profileStore';
import { useSettingsStore } from '~/store/settingsStore';
import { PopupAuth } from './PopupAuth';
import { QuickFillButton } from './QuickFillButton';
import { ProfilePreview } from './ProfilePreview';
import { RecentApplications } from './RecentApplications';

import '~/styles/globals.css';

function Popup() {
  const { isAuthenticated, initialize: initAuth } = useAuthStore();
  const { profile, isLoading: profileLoading, initialize: initProfile } = useProfileStore();
  const { initialize: initSettings } = useSettingsStore();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    async function init() {
      await initAuth();
      await initSettings();

      // Only init profile if authenticated
      const auth = useAuthStore.getState();
      if (auth.isAuthenticated) {
        await initProfile();
      }

      setIsInitializing(false);
    }

    init();
  }, []);

  // Show loading spinner during initialization
  if (isInitializing) {
    return (
      <div className="w-[360px] h-[400px] flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-neutral-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Show auth screen if not logged in
  if (!isAuthenticated) {
    return <PopupAuth />;
  }

  // Main popup content
  return (
    <div className="w-[360px] bg-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
        <div className="flex items-center gap-2">
          {/* Ascentful Logo */}
          <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="headerLogoGradient" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6"/>
                <stop offset="100%" stopColor="#2563eb"/>
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="6" fill="url(#headerLogoGradient)"/>
            <path d="M9.5 22.5l6.5-13 6.5 13h-2.9l-1.5-3.2h-4.2l-1.5 3.2H9.5zm8-5.7l-1.6-3.5-1.6 3.5h3.2z" fill="#ffffff"/>
          </svg>
          <span className="font-semibold text-neutral-900">Ascentful</span>
        </div>
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
          title="Settings"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </header>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Quick Fill Button */}
        <QuickFillButton />

        {/* Profile Preview */}
        {profileLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : profile ? (
          <ProfilePreview profile={profile} />
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-neutral-500">
              No profile data available.{' '}
              <button
                onClick={() => useProfileStore.getState().syncProfile()}
                className="text-primary-500 hover:underline"
              >
                Sync now
              </button>
            </p>
          </div>
        )}

        {/* Recent Applications */}
        <RecentApplications />
      </div>

      {/* Footer */}
      <footer className="px-4 py-3 border-t border-neutral-100 bg-neutral-50">
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>Logged in as {profile?.email || 'User'}</span>
          <button
            onClick={() => useAuthStore.getState().logout()}
            className="text-neutral-500 hover:text-danger-500 transition-colors"
          >
            Sign out
          </button>
        </div>
      </footer>
    </div>
  );
}

export default Popup;
