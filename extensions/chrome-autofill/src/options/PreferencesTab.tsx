/**
 * Preferences Tab
 *
 * Extension settings and preferences.
 */

import React from 'react';
import { useSettingsStore } from '~/store/settingsStore';
import { useAuthStore } from '~/store/authStore';

export default function PreferencesTab() {
  const { settings, updateSettings, resetSettings } = useSettingsStore();
  const { logout } = useAuthStore();

  const handleToggle = async (key: keyof typeof settings) => {
    await updateSettings({ [key]: !settings[key] });
  };

  const handleAutoLogChange = async (value: boolean) => {
    await updateSettings({ autoLogApplications: value });
  };

  const handleReset = async () => {
    if (window.confirm('Are you sure you want to reset all settings to defaults?')) {
      await resetSettings();
    }
  };

  const handleSignOut = async () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      await logout();
      window.location.reload();
    }
  };

  return (
    <div className="tab-content">
      {/* Autofill Settings */}
      <div className="form-section">
        <h2>Autofill Behavior</h2>

        <div className="toggle-group">
          <div className="toggle-label">
            <span>Auto-detect ATS platforms</span>
            <small>Automatically show the fill button when an ATS is detected</small>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.autoDetect}
              onChange={() => handleToggle('autoDetect')}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="toggle-group">
          <div className="toggle-label">
            <span>Show floating button</span>
            <small>Display a floating action button on supported job sites</small>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.showFloatingButton}
              onChange={() => handleToggle('showFloatingButton')}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="toggle-group">
          <div className="toggle-label">
            <span>Show notifications</span>
            <small>Display success/error notifications after filling forms</small>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.showNotifications}
              onChange={() => handleToggle('showNotifications')}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      {/* Application Tracking */}
      <div className="form-section">
        <h2>Application Tracking</h2>

        <div className="toggle-group">
          <div className="toggle-label">
            <span>Automatically log applications</span>
            <small>Add applications to your dashboard when you fill forms</small>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.autoLogApplications}
              onChange={() => handleAutoLogChange(!settings.autoLogApplications)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="toggle-group">
          <div className="toggle-label">
            <span>Sync with Ascentul</span>
            <small>Keep your profile data synced with your Ascentul account</small>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.syncEnabled}
              onChange={() => handleToggle('syncEnabled')}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="form-section">
        <h2>Keyboard Shortcuts</h2>
        <div style={{ fontSize: '14px', color: '#64748b' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 0',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <span>Quick fill current form</span>
            <code
              style={{
                background: '#f1f5f9',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '12px',
              }}
            >
              Ctrl/Cmd + Shift + F
            </code>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 0',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <span>Open extension popup</span>
            <code
              style={{
                background: '#f1f5f9',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '12px',
              }}
            >
              Ctrl/Cmd + Shift + A
            </code>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
            <span>Toggle floating button</span>
            <code
              style={{
                background: '#f1f5f9',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '12px',
              }}
            >
              Ctrl/Cmd + Shift + B
            </code>
          </div>
        </div>
      </div>

      {/* Account */}
      <div className="form-section">
        <h2>Account</h2>
        <div className="btn-group">
          <button className="btn-secondary" onClick={handleReset}>
            Reset Settings
          </button>
          <button className="btn-danger" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </div>

      {/* About */}
      <div className="form-section">
        <h2>About</h2>
        <div style={{ fontSize: '14px', color: '#64748b' }}>
          <p style={{ margin: '0 0 8px 0' }}>
            <strong>Ascentul Autofill Extension</strong>
          </p>
          <p style={{ margin: '0 0 4px 0' }}>Version 1.0.0</p>
          <p style={{ margin: '0' }}>
            <a
              href="https://ascentful.io/privacy"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#5371ff' }}
            >
              Privacy Policy
            </a>
            {' • '}
            <a
              href="https://ascentful.io/terms"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#5371ff' }}
            >
              Terms of Service
            </a>
            {' • '}
            <a
              href="https://ascentful.io/help"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#5371ff' }}
            >
              Help Center
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
