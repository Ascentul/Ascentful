/**
 * Side Panel Entry Point
 *
 * Main entry for the Chrome Side Panel that provides:
 * - Current page job detection and saving
 * - Applications list with status management
 * - Tasks/follow-ups management
 * - Contacts management
 * - Quick stats dashboard
 */

import { useEffect, useState } from 'react';
import { SidePanelLayout } from './SidePanelLayout';
import { useAuthStore } from '~/store/authStore';
import '~/styles/globals.css';

function SidePanel() {
  const { isAuthenticated, isLoading, initialize } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Check authentication status on mount
    initialize().finally(() => setReady(true));
  }, [initialize]);

  if (!ready || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          <p className="text-sm text-neutral-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-neutral-50 p-6">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-500">
          <svg
            className="h-8 w-8 text-white"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h1 className="mb-2 text-xl font-semibold text-neutral-900">
          Sign in to Ascentul
        </h1>
        <p className="mb-6 text-center text-sm text-neutral-500">
          Sign in to track jobs, manage tasks, and autofill applications.
        </p>
        <button
          onClick={() => {
            // Open the extension popup to trigger login
            chrome.runtime.sendMessage({ type: 'LOGIN' });
          }}
          className="rounded-full bg-primary-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-600"
        >
          Sign In
        </button>
      </div>
    );
  }

  return <SidePanelLayout />;
}

export default SidePanel;
