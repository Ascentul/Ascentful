/**
 * Extension Options Page
 *
 * Full-page settings UI for editing profile, work history,
 * education, documents, and preferences.
 */

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '~/store/authStore';
import { useProfileStore } from '~/store/profileStore';
import { useSettingsStore } from '~/store/settingsStore';
import ProfileTab from './ProfileTab';
import WorkHistoryTab from './WorkHistoryTab';
import EducationTab from './EducationTab';
import DocumentsTab from './DocumentsTab';
import PreferencesTab from './PreferencesTab';
import './options.css';

type TabId = 'profile' | 'work' | 'education' | 'documents' | 'preferences';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

const tabs: Tab[] = [
  { id: 'profile', label: 'Profile', icon: '👤' },
  { id: 'work', label: 'Work History', icon: '💼' },
  { id: 'education', label: 'Education', icon: '🎓' },
  { id: 'documents', label: 'Documents', icon: '📄' },
  { id: 'preferences', label: 'Preferences', icon: '⚙️' },
];

export default function OptionsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('profile');

  const { isAuthenticated, isLoading: authLoading, initialize: initAuth, login } = useAuthStore();
  const { profile, isLoading: profileLoading, initialize: initProfile } = useProfileStore();
  const { initialize: initSettings } = useSettingsStore();

  useEffect(() => {
    initAuth();
    initSettings();
  }, [initAuth, initSettings]);

  useEffect(() => {
    if (isAuthenticated) {
      initProfile();
    }
  }, [isAuthenticated, initProfile]);

  const isLoading = authLoading || profileLoading;

  if (authLoading) {
    return (
      <div className="options-container">
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="options-container">
        <div className="auth-required">
          <div className="logo">
            <img src="/assets/icon-128.png" alt="Ascentul" />
          </div>
          <h1>Sign In Required</h1>
          <p>Please sign in to access your profile and settings.</p>
          <button className="btn-primary" onClick={login}>
            Sign In with Ascentul
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="options-container">
      {/* Header */}
      <header className="options-header">
        <div className="header-content">
          <img src="/assets/icon-48.png" alt="Ascentul" className="header-logo" />
          <h1>Ascentul Autofill Settings</h1>
        </div>
        {profile && (
          <div className="header-user">
            <span>{profile.name || profile.email}</span>
          </div>
        )}
      </header>

      {/* Main Content */}
      <div className="options-main">
        {/* Sidebar Navigation */}
        <nav className="options-nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="nav-icon">{tab.icon}</span>
              <span className="nav-label">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Tab Content */}
        <main className="options-content">
          {isLoading && !profile ? (
            <div className="loading-state">
              <div className="spinner" />
              <p>Loading profile...</p>
            </div>
          ) : (
            <>
              {activeTab === 'profile' && <ProfileTab />}
              {activeTab === 'work' && <WorkHistoryTab />}
              {activeTab === 'education' && <EducationTab />}
              {activeTab === 'documents' && <DocumentsTab />}
              {activeTab === 'preferences' && <PreferencesTab />}
            </>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="options-footer">
        <p>
          Ascentul Autofill Extension •{' '}
          <a href="https://ascentful.io" target="_blank" rel="noopener noreferrer">
            Visit Dashboard
          </a>{' '}
          •{' '}
          <a href="https://ascentful.io/help" target="_blank" rel="noopener noreferrer">
            Help Center
          </a>
        </p>
      </footer>
    </div>
  );
}
