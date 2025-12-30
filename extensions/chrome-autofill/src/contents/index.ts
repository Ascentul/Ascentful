/**
 * Content Script Entry Point
 *
 * This script is injected into job application pages to:
 * 1. Detect the ATS platform
 * 2. Inject the floating action button
 * 3. Handle form filling requests from the popup
 */

import type { PlasmoCSConfig } from 'plasmo';
import { detectATS, getHandlerForCurrentPage } from '~/lib/ATSHandlers';
import { storage } from '~/lib/storage';
import { api } from '~/lib/api';

// Plasmo content script configuration
export const config: PlasmoCSConfig = {
  matches: [
    'https://boards.greenhouse.io/*',
    'https://job-boards.greenhouse.io/*',
    'https://*.greenhouse.io/*',
    'https://jobs.lever.co/*',
    'https://*.lever.co/*',
    'https://*.myworkdayjobs.com/*',
    'https://www.linkedin.com/jobs/*',
    'https://*.indeed.com/*',
    'https://*.taleo.net/*',
    'https://*.icims.com/*',
    'https://*.smartrecruiters.com/*',
  ],
  all_frames: true,
  run_at: 'document_end',
};

// Track if we've already initialized
let initialized = false;

/**
 * Initialize the content script
 */
async function initialize() {
  if (initialized) return;
  initialized = true;

  console.log('[Ascentful] Content script loaded');

  // Detect ATS on page
  const atsInfo = detectATS();

  if (!atsInfo.detected) {
    console.log('[Ascentful] Not a supported ATS page');
    return;
  }

  console.log(`[Ascentful] Detected ${atsInfo.platform}:`, atsInfo);

  // Check settings to see if we should show FAB
  const settings = await storage.getSettings();

  if (settings.showFloatingButton) {
    injectFloatingButton(atsInfo);
  }

  // Listen for messages from popup/background
  setupMessageListener();
}

/**
 * Inject the floating action button into the page
 */
function injectFloatingButton(atsInfo: ReturnType<typeof detectATS>) {
  // Check if already injected
  if (document.getElementById('ascentul-fab-container')) return;

  // Create container
  const container = document.createElement('div');
  container.id = 'ascentul-fab-container';
  container.innerHTML = `
    <style>
      #ascentul-fab {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      #ascentul-fab-button {
        width: 56px;
        height: 56px;
        border-radius: 28px;
        background: linear-gradient(135deg, #5371FF 0%, #7B93FF 100%);
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(83, 113, 255, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s, box-shadow 0.2s;
      }

      #ascentul-fab-button:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 20px rgba(83, 113, 255, 0.5);
      }

      #ascentul-fab-button:active {
        transform: scale(0.95);
      }

      #ascentul-fab-button.loading {
        cursor: wait;
        opacity: 0.8;
      }

      #ascentul-fab-button.success {
        background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
      }

      #ascentul-fab-button.error {
        background: linear-gradient(135deg, #ef4444 0%, #f87171 100%);
      }

      #ascentul-fab-tooltip {
        position: absolute;
        bottom: 100%;
        right: 0;
        margin-bottom: 8px;
        background: #1f2937;
        color: white;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 13px;
        white-space: nowrap;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.2s, visibility 0.2s;
      }

      #ascentul-fab:hover #ascentul-fab-tooltip {
        opacity: 1;
        visibility: visible;
      }

      #ascentul-fab-icon {
        width: 24px;
        height: 24px;
      }

      #ascentul-fab-spinner {
        width: 24px;
        height: 24px;
        border: 3px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: ascentul-spin 0.8s linear infinite;
        display: none;
      }

      #ascentul-fab-button.loading #ascentul-fab-icon {
        display: none;
      }

      #ascentul-fab-button.loading #ascentul-fab-spinner {
        display: block;
      }

      @keyframes ascentul-spin {
        to { transform: rotate(360deg); }
      }
    </style>

    <div id="ascentul-fab">
      <button id="ascentul-fab-button" title="Fill with Ascentful">
        <svg id="ascentul-fab-icon" viewBox="0 0 24 24" fill="white">
          <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>
        <div id="ascentul-fab-spinner"></div>
      </button>
      <div id="ascentul-fab-tooltip">
        Fill application with Ascentful
      </div>
    </div>
  `;

  document.body.appendChild(container);

  // Add click handler
  const button = document.getElementById('ascentul-fab-button');
  button?.addEventListener('click', () => handleFillClick(atsInfo));
}

/**
 * Handle click on the floating button
 */
async function handleFillClick(atsInfo: ReturnType<typeof detectATS>): Promise<{ filledFields: number } | null> {
  const button = document.getElementById('ascentul-fab-button');
  const tooltip = document.getElementById('ascentul-fab-tooltip');

  if (!button) return null;

  // Show loading state
  button.classList.add('loading');
  button.classList.remove('success', 'error');
  if (tooltip) tooltip.textContent = 'Filling form...';

  try {
    // Get handler for current page
    const handler = getHandlerForCurrentPage();

    if (!handler) {
      throw new Error('No handler available for this page');
    }

    // Get profile data
    const profile = await storage.getProfile();

    if (!profile) {
      throw new Error('Please set up your profile first');
    }

    // Get autofill data from profile store
    // Since we're in a content script, we need to manually construct the data
    const autofillData = constructAutofillData(profile);

    // Fill the form
    const result = await handler.fillForm(autofillData);

    if (result.filledFields > 0) {
      // Success
      button.classList.remove('loading');
      button.classList.add('success');
      if (tooltip) tooltip.textContent = `Filled ${result.filledFields} fields!`;

      // Log the application
      if (result.jobDetails) {
        await api.logApplication({
          company: result.jobDetails.company || 'Unknown Company',
          jobTitle: result.jobDetails.jobTitle || 'Unknown Position',
          url: result.jobDetails.url,
          atsPlatform: atsInfo.platform,
          source: 'extension_autofill',
        });

        showNotification('success', `Application to ${result.jobDetails.company} tracked!`);
      }

      // Reset after 3 seconds
      setTimeout(() => {
        button.classList.remove('success');
        if (tooltip) tooltip.textContent = 'Fill application with Ascentful';
      }, 3000);

      return { filledFields: result.filledFields };
    } else {
      throw new Error('No fields were filled');
    }
  } catch (error) {
    console.error('[Ascentful] Fill error:', error);

    button.classList.remove('loading');
    button.classList.add('error');
    if (tooltip) {
      tooltip.textContent = error instanceof Error ? error.message : 'Fill failed';
    }

    // Reset after 3 seconds
    setTimeout(() => {
      button.classList.remove('error');
      if (tooltip) tooltip.textContent = 'Fill application with Ascentful';
    }, 3000);

    throw error; // Re-throw to be caught by message listener
  }
}

/**
 * Construct autofill data from stored profile
 */
function constructAutofillData(profile: any) {
  const nameParts = profile.name?.split(' ') || [];
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const recentEducation = profile.educationHistory?.[0];
  const recentWork = profile.workHistory?.[0];

  return {
    firstName,
    lastName,
    fullName: profile.name || '',
    email: profile.email || '',
    phone: profile.phoneNumber || '',
    location: profile.location || '',
    city: profile.city || '',
    linkedin: profile.linkedinUrl || '',
    github: profile.githubUrl || '',
    website: profile.website || '',
    currentTitle: profile.currentPosition || '',
    currentCompany: profile.currentCompany || '',
    skills: profile.skills || '',
    skillsArray: profile.skills?.split(',').map((s: string) => s.trim()) || [],
    school: recentEducation?.school || '',
    degree: recentEducation?.degree || '',
    major: recentEducation?.fieldOfStudy || '',
    graduationYear: recentEducation?.endYear || '',
    gpa: '',
    previousCompany: recentWork?.company || '',
    previousTitle: recentWork?.role || '',
    previousStartDate: recentWork?.startDate || '',
    previousEndDate: recentWork?.endDate || '',
    summary: '',
    workHistory: profile.workHistory || [],
    educationHistory: profile.educationHistory || [],
  };
}

/**
 * Show a notification toast
 */
function showNotification(type: 'success' | 'error' | 'info', message: string) {
  const existing = document.getElementById('ascentul-notification');
  if (existing) existing.remove();

  const colors = {
    success: '#10b981',
    error: '#ef4444',
    info: '#5371FF',
  };

  const notification = document.createElement('div');
  notification.id = 'ascentul-notification';
  notification.style.cssText = `
    position: fixed;
    top: 24px;
    right: 24px;
    z-index: 2147483647;
    background: ${colors[type]};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
    animation: ascentul-slideIn 0.3s ease;
  `;
  notification.textContent = message;

  // Add animation keyframes if not present
  if (!document.getElementById('ascentul-notification-styles')) {
    const style = document.createElement('style');
    style.id = 'ascentul-notification-styles';
    style.textContent = `
      @keyframes ascentul-slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(notification);

  // Auto-remove after 3 seconds
  setTimeout(() => notification.remove(), 3000);
}

/**
 * Set up message listener for popup/background communication
 */
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'FILL_FORM') {
      // Trigger fill
      const atsInfo = detectATS();
      handleFillClick(atsInfo)
        .then((result) => {
          sendResponse({ success: true, filledFields: result?.filledFields });
        })
        .catch((error) => {
          sendResponse({ success: false, error: error instanceof Error ? error.message : 'Fill failed' });
        });
      return true; // Async response
    }

    if (message.type === 'DETECT_ATS') {
      const atsInfo = detectATS();
      sendResponse(atsInfo);
      return true;
    }

    return false;
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
