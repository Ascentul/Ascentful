/**
 * Background Service Worker
 *
 * Handles:
 * - Message routing between popup, content scripts, and API
 * - Token refresh scheduling
 * - Offline queue synchronization
 * - Badge updates
 */

import { storage } from '~/lib/storage';
import { api } from '~/lib/api';
import type { ExtensionMessage, ExtensionResponse } from '~/types';

// Refresh token before it expires (10 minutes before)
const TOKEN_REFRESH_BUFFER = 10 * 60 * 1000;

/**
 * Initialize the background worker
 */
async function initialize() {
  console.log('[Ascentul] Background worker initialized');

  // Set up message listener
  chrome.runtime.onMessage.addListener(handleMessage);

  // Set up alarm for periodic tasks
  chrome.alarms.create('token-refresh', { periodInMinutes: 5 });
  chrome.alarms.create('sync-pending', { periodInMinutes: 15 });

  chrome.alarms.onAlarm.addListener(handleAlarm);

  // Initial token check
  await checkAndRefreshToken();

  // Update badge
  await updateBadge();
}

/**
 * Handle messages from popup and content scripts
 */
function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: ExtensionResponse) => void,
): boolean {
  console.log('[Ascentul] Received message:', message.type);

  // Handle async messages
  handleAsyncMessage(message, sender)
    .then(sendResponse)
    .catch((error) => {
      console.error('[Ascentul] Message handling error:', error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });

  return true; // Indicates async response
}

/**
 * Handle messages asynchronously
 */
async function handleAsyncMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
): Promise<ExtensionResponse> {
  switch (message.type) {
    case 'GET_PROFILE':
      return handleGetProfile();

    case 'SYNC_PROFILE':
      return handleSyncProfile();

    case 'LOG_APPLICATION':
      return handleLogApplication(message.payload);

    case 'GET_AUTH_STATE':
      return handleGetAuthState();

    case 'GET_SETTINGS':
      return handleGetSettings();

    case 'UPDATE_SETTINGS':
      return handleUpdateSettings(message.payload);

    case 'GET_RECENT_APPLICATIONS':
      return handleGetRecentApplications();

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}

/**
 * Get profile from storage or API
 */
async function handleGetProfile(): Promise<ExtensionResponse> {
  try {
    // Check if profile is stale
    const isStale = await storage.isProfileStale();

    if (isStale) {
      // Sync from API
      const profile = await api.syncProfile();
      if (profile) {
        return { success: true, data: { profile } };
      }
    }

    // Return cached profile
    const profile = await storage.getProfile();
    return { success: true, data: { profile } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get profile',
    };
  }
}

/**
 * Force sync profile from API
 */
async function handleSyncProfile(): Promise<ExtensionResponse> {
  try {
    const profile = await api.syncProfile();
    return { success: true, data: { profile } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync profile',
    };
  }
}

/**
 * Log a new application
 */
async function handleLogApplication(payload: any): Promise<ExtensionResponse> {
  try {
    const result = await api.logApplication({
      company: payload.company,
      jobTitle: payload.jobTitle || payload.job_title,
      url: payload.url,
      atsPlatform: payload.atsPlatform || payload.ats_platform,
      source: payload.source || 'extension_autofill',
    });

    // Update badge
    await updateBadge();

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to log application',
    };
  }
}

/**
 * Get current auth state
 */
async function handleGetAuthState(): Promise<ExtensionResponse> {
  const auth = await storage.getAuth();
  return {
    success: true,
    data: {
      isAuthenticated: !!auth?.token,
      expiresAt: auth?.expiresAt,
    },
  };
}

/**
 * Get extension settings
 */
async function handleGetSettings(): Promise<ExtensionResponse> {
  const settings = await storage.getSettings();
  return { success: true, data: settings };
}

/**
 * Update extension settings
 */
async function handleUpdateSettings(payload: any): Promise<ExtensionResponse> {
  try {
    await storage.setSettings(payload);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update settings',
    };
  }
}

/**
 * Get recent applications
 */
async function handleGetRecentApplications(): Promise<ExtensionResponse> {
  try {
    const result = await api.getRecentApplications();
    return { success: true, data: result.data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get applications',
    };
  }
}

/**
 * Handle periodic alarms
 */
async function handleAlarm(alarm: chrome.alarms.Alarm) {
  console.log('[Ascentul] Alarm triggered:', alarm.name);

  switch (alarm.name) {
    case 'token-refresh':
      await checkAndRefreshToken();
      break;

    case 'sync-pending':
      await syncPendingApplications();
      break;
  }
}

/**
 * Check and refresh token if needed
 */
async function checkAndRefreshToken() {
  const auth = await storage.getAuth();

  if (!auth?.token || !auth.expiresAt) {
    return;
  }

  const timeUntilExpiry = auth.expiresAt - Date.now();

  if (timeUntilExpiry < TOKEN_REFRESH_BUFFER) {
    console.log('[Ascentul] Token expiring soon, refreshing...');

    try {
      const response = await fetch(
        `${process.env.PLASMO_PUBLIC_APP_URL}/api/extension/auth/refresh`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${auth.token}`,
          },
        },
      );

      if (response.ok) {
        const { token, expiresAt } = await response.json();
        await storage.setAuth({ ...auth, token, expiresAt });
        console.log('[Ascentul] Token refreshed successfully');
      } else {
        console.warn('[Ascentul] Token refresh failed');
      }
    } catch (error) {
      console.error('[Ascentul] Token refresh error:', error);
    }
  }
}

/**
 * Sync pending applications (offline queue)
 */
async function syncPendingApplications() {
  const pending = await storage.getPendingApplications();

  if (pending.length === 0) {
    return;
  }

  console.log(`[Ascentul] Syncing ${pending.length} pending applications`);

  await api.syncPendingApplications();

  // Update badge after sync
  await updateBadge();
}

/**
 * Update extension badge
 */
async function updateBadge() {
  const pending = await storage.getPendingApplications();

  if (pending.length > 0) {
    // Show pending count
    chrome.action.setBadgeText({ text: String(pending.length) });
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
  } else {
    // Clear badge
    chrome.action.setBadgeText({ text: '' });
  }
}

// Initialize on install/update
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Ascentul] Extension installed/updated:', details.reason);
  initialize();
});

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
  console.log('[Ascentul] Extension started');
  initialize();
});

// Also initialize immediately (for development)
initialize();
