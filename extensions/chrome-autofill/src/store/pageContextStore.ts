/**
 * Page Context Store
 *
 * Manages the current page context state for the extension side panel.
 * Tracks detected job data, page type, and scraping state.
 */

import { create } from 'zustand';
import type { ScrapedJobData, PageContext, PageType, ATSPlatform } from '~/types';

interface PageContextState {
  // Current page context
  context: PageContext | null;

  // Page URL
  url: string | null;

  // Detected job data
  jobData: ScrapedJobData | null;

  // Page type
  pageType: PageType;

  // Whether an ATS platform was detected
  atsDetected: ATSPlatform | null;

  // Whether a form was detected on the page
  formDetected: boolean;

  // Scraping confidence score
  scrapingConfidence: number;

  // Whether we're currently scraping
  isLoading: boolean;

  // Error message if scraping failed
  error: string | null;
}

interface PageContextActions {
  // Set the full page context
  setContext: (context: PageContext) => void;

  // Update job data
  setJobData: (jobData: ScrapedJobData | null) => void;

  // Update page type
  setPageType: (pageType: PageType) => void;

  // Set ATS platform
  setAtsDetected: (ats: ATSPlatform | null) => void;

  // Set form detected
  setFormDetected: (detected: boolean) => void;

  // Set loading state
  setLoading: (isLoading: boolean) => void;

  // Set error
  setError: (error: string | null) => void;

  // Clear the context (e.g., when navigating away)
  clearContext: () => void;

  // Refresh context from current page
  refreshContext: () => Promise<void>;
}

type PageContextStore = PageContextState & PageContextActions;

const initialState: PageContextState = {
  context: null,
  url: null,
  jobData: null,
  pageType: 'unknown',
  atsDetected: null,
  formDetected: false,
  scrapingConfidence: 0,
  isLoading: false,
  error: null,
};

export const usePageContextStore = create<PageContextStore>((set, get) => ({
  ...initialState,

  setContext: (context: PageContext) => {
    set({
      context,
      url: context.url,
      jobData: context.jobData || null,
      pageType: context.type,
      atsDetected: context.atsDetected || null,
      formDetected: context.formDetected || false,
      scrapingConfidence: context.scrapingConfidence || 0,
      isLoading: false,
      error: null,
    });
  },

  setJobData: (jobData: ScrapedJobData | null) => {
    set({ jobData });
    // Update context if it exists
    const { context } = get();
    if (context) {
      set({
        context: { ...context, jobData: jobData || undefined },
      });
    }
  },

  setPageType: (pageType: PageType) => {
    set({ pageType });
    // Update context if it exists
    const { context } = get();
    if (context) {
      set({
        context: { ...context, type: pageType },
      });
    }
  },

  setAtsDetected: (ats: ATSPlatform | null) => {
    set({ atsDetected: ats });
    // Update context if it exists
    const { context } = get();
    if (context) {
      set({
        context: { ...context, atsDetected: ats || undefined },
      });
    }
  },

  setFormDetected: (detected: boolean) => {
    set({ formDetected: detected });
    // Update context if it exists
    const { context } = get();
    if (context) {
      set({
        context: { ...context, formDetected: detected },
      });
    }
  },

  setLoading: (isLoading: boolean) => {
    set({ isLoading });
  },

  setError: (error: string | null) => {
    set({ error, isLoading: false });
  },

  clearContext: () => {
    set(initialState);
  },

  refreshContext: async () => {
    set({ isLoading: true, error: null });

    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url) {
        set({ ...initialState });
        return;
      }

      // Request page context from content script
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTEXT' });

      if (response?.success && response.context) {
        const context = response.context as PageContext;
        set({
          context,
          url: context.url,
          jobData: context.jobData || null,
          pageType: context.type,
          atsDetected: context.atsDetected || null,
          formDetected: context.formDetected || false,
          scrapingConfidence: context.scrapingConfidence || 0,
          isLoading: false,
          error: null,
        });
      } else {
        set({
          ...initialState,
          url: tab.url,
          error: response?.error || null,
        });
      }
    } catch (error) {
      console.error('[PageContextStore] Failed to refresh context:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to get page context',
      });
    }
  },
}));

export default usePageContextStore;
