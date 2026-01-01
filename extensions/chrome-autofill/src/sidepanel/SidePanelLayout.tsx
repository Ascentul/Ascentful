/**
 * Side Panel Layout
 *
 * Shell component with header, tab navigation, and content area.
 */

import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import type { SidePanelTab } from '~/types';
import { CurrentJobTab } from './tabs/CurrentJobTab';
import { JobsTab } from './tabs/JobsTab';
import { TasksTab } from './tabs/TasksTab';
import { ContactsTab } from './tabs/ContactsTab';
import { StatsTab } from './tabs/StatsTab';
import { useAuthStore } from '~/store/authStore';

const tabs: { id: SidePanelTab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'current',
    label: 'Current',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    id: 'jobs',
    label: 'Jobs',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      </svg>
    ),
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    id: 'contacts',
    label: 'Contacts',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: 'stats',
    label: 'Stats',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 20V10" />
        <path d="M12 20V4" />
        <path d="M6 20v-6" />
      </svg>
    ),
  },
];

export function SidePanelLayout() {
  const [activeTab, setActiveTab] = useState<SidePanelTab>('current');
  const { user } = useAuthStore();

  // Listen for page context updates to switch to current tab
  useEffect(() => {
    const handleMessage = (message: { type: string }) => {
      if (message.type === 'PAGE_CONTEXT_UPDATED') {
        setActiveTab('current');
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'current':
        return <CurrentJobTab />;
      case 'jobs':
        return <JobsTab />;
      case 'tasks':
        return <TasksTab />;
      case 'contacts':
        return <ContactsTab />;
      case 'stats':
        return <StatsTab />;
      default:
        return <CurrentJobTab />;
    }
  };

  return (
    <div className="flex h-screen flex-col bg-neutral-50">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500">
            <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-lg font-semibold text-neutral-900">Ascentul</span>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <div className="flex items-center gap-2">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="h-7 w-7 rounded-full"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-600">
                  {user.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => window.open(chrome.runtime.getURL('options.html'), '_blank')}
            className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
            title="Settings"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
          </button>
        </div>
      </header>

      {/* Tab Content */}
      <main className="flex-1 overflow-y-auto">
        {renderTabContent()}
      </main>

      {/* Tab Navigation */}
      <nav className="border-t border-neutral-200 bg-white">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors',
                activeTab === tab.id
                  ? 'text-primary-600'
                  : 'text-neutral-500 hover:text-neutral-700'
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
