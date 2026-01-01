/**
 * Job Detector
 *
 * Detects jobs on pages and provides page context to the side panel.
 * Runs as part of the content script.
 */

import type { PageContext, ATSPlatform } from '~/types';
import { scrapeJobFromPage, getPageContext } from '~/lib/jobScraper';
import { detectATS } from '~/lib/ATSHandlers';

let currentPageContext: PageContext | null = null;
let contextUpdateTimer: ReturnType<typeof setTimeout> | null = null;
let domObserver: MutationObserver | null = null;

/**
 * Initialize job detection on the page
 */
export function initJobDetection(): void {
  // Initial detection
  updatePageContext();

  // Re-detect on URL changes (for SPAs)
  observeUrlChanges();

  // Re-detect on significant DOM changes
  observeDomChanges();
}

/**
 * Get the current page context
 */
export function getCurrentPageContext(): PageContext | null {
  return currentPageContext;
}

/**
 * Force update of page context
 */
export async function updatePageContext(): Promise<PageContext> {
  const url = window.location.href;
  const atsInfo = detectATS();

  // Get page context with scraped job data
  const context = getPageContext(url, atsInfo.detected ? atsInfo.platform : undefined);

  // Merge with ATS detection info
  if (atsInfo.detected) {
    context.atsDetected = atsInfo.platform;
    context.formDetected = context.formDetected || atsInfo.confidence > 0.5;

    // Use ATS handler extracted info if available
    if (atsInfo.jobTitle && (!context.jobData?.jobTitle || context.jobData.jobTitle === 'Unknown')) {
      if (context.jobData) {
        context.jobData.jobTitle = atsInfo.jobTitle;
      }
    }
    if (atsInfo.company && (!context.jobData?.company || context.jobData.company === 'Unknown Company')) {
      if (context.jobData) {
        context.jobData.company = atsInfo.company;
      }
    }
  }

  currentPageContext = context;

  // Notify background/side panel of context update
  notifyContextUpdate(context);

  return context;
}

/**
 * Notify background script of context update
 */
function notifyContextUpdate(context: PageContext): void {
  try {
    chrome.runtime.sendMessage({
      type: 'PAGE_CONTEXT_UPDATED',
      payload: context,
    });
  } catch (error) {
    // Extension context may be invalid during page unload
    console.debug('[JobDetector] Failed to notify context update:', error);
  }
}

// Track interval and listener for cleanup
let urlCheckInterval: ReturnType<typeof setInterval> | null = null;
let popstateHandler: (() => void) | null = null;

/**
 * Observe URL changes for SPA navigation
 */
function observeUrlChanges(): void {
  let lastUrl = window.location.href;

  // Clear any existing interval (prevents accumulation on hot-reload)
  if (urlCheckInterval) {
    clearInterval(urlCheckInterval);
  }

  // Check URL periodically (for SPAs that don't fire popstate)
  urlCheckInterval = setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      scheduleContextUpdate();
    }
  }, 1000);

  // Remove existing listener if any
  if (popstateHandler) {
    window.removeEventListener('popstate', popstateHandler);
  }

  // Also listen to popstate for back/forward navigation
  popstateHandler = () => scheduleContextUpdate();
  window.addEventListener('popstate', popstateHandler);
}

/**
 * Observe DOM changes that might indicate content update
 */
function observeDomChanges(): void {
  // Clean up existing observer to prevent accumulation on hot-reload
  if (domObserver) {
    domObserver.disconnect();
  }

  domObserver = new MutationObserver((mutations) => {
    // Check if significant changes occurred
    const hasSignificantChange = mutations.some((mutation) => {
      // Look for added nodes that might contain job info
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          const tag = node.tagName?.toLowerCase();
          if (tag === 'main' || tag === 'article' || tag === 'section') {
            return true;
          }
          // Check if any class starts with 'job-' or 'job_'
          const hasJobClass = node.className && typeof node.className === 'string' && /\bjob[-_]/.test(node.className);
          if (hasJobClass || node.id?.includes('job')) {
            return true;
          }
        }
      }
      return false;
    });

    if (hasSignificantChange) {
      scheduleContextUpdate();
    }
  });

  domObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

/**
 * Schedule a context update (debounced)
 */
function scheduleContextUpdate(): void {
  if (contextUpdateTimer) {
    clearTimeout(contextUpdateTimer);
  }
  contextUpdateTimer = setTimeout(() => {
    updatePageContext();
    contextUpdateTimer = null;
  }, 500);
}

/**
 * Check if current page is a job listing
 */
export function isJobListingPage(): boolean {
  if (!currentPageContext) return false;
  return currentPageContext.type === 'job_listing' || currentPageContext.type === 'application_form';
}

/**
 * Check if current page has a detected job
 */
export function hasDetectedJob(): boolean {
  return Boolean(currentPageContext?.jobData?.company && currentPageContext?.jobData?.jobTitle);
}

/**
 * Get detected job confidence
 */
export function getJobConfidence(): number {
  return currentPageContext?.scrapingConfidence || 0;
}

export default {
  initJobDetection,
  getCurrentPageContext,
  updatePageContext,
  isJobListingPage,
  hasDetectedJob,
  getJobConfidence,
};
