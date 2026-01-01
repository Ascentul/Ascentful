/**
 * Job Scraper Main Entry
 *
 * Orchestrates job scraping from web pages using multiple strategies:
 * 1. Structured data (JSON-LD, OpenGraph)
 * 2. Platform-specific patterns (extend ATS handlers)
 * 3. Semantic HTML analysis
 * 4. Manual user-assisted selection
 */

import type { ScrapedJobData, PageContext, PageType, ATSPlatform } from '~/types';
import { MetadataScraper } from './MetadataScraper';
import { UniversalScraper } from './UniversalScraper';

export interface ScrapeResult {
  success: boolean;
  jobData?: ScrapedJobData;
  confidence: number;
  source: 'structured' | 'platform' | 'semantic' | 'manual';
  pageType: PageType;
  formDetected: boolean;
}

/**
 * Main job scraper that tries multiple strategies
 */
export async function scrapeJobFromPage(url: string): Promise<ScrapeResult> {
  const results: ScrapeResult[] = [];

  // Try structured data first (highest confidence)
  try {
    const structuredResult = MetadataScraper.scrapeStructuredData();
    if (structuredResult.success && structuredResult.jobData) {
      results.push({
        ...structuredResult,
        source: 'structured',
        pageType: 'job_listing',
        formDetected: detectForm(),
      });
    }
  } catch (error) {
    console.debug('[JobScraper] Structured data scraping failed:', error);
  }

  // Try universal scraper (semantic analysis)
  try {
    const universalResult = UniversalScraper.scrape(url);
    if (universalResult.success && universalResult.jobData) {
      results.push({
        ...universalResult,
        source: 'semantic',
        formDetected: detectForm(),
      });
    }
  } catch (error) {
    console.debug('[JobScraper] Universal scraping failed:', error);
  }

  // Return best result
  if (results.length === 0) {
    return {
      success: false,
      confidence: 0,
      source: 'semantic',
      pageType: detectPageType(),
      formDetected: detectForm(),
    };
  }

  // Sort by confidence and return best
  results.sort((a, b) => b.confidence - a.confidence);
  return results[0];
}

/**
 * Get full page context for side panel
 */
export function getPageContext(url: string, atsDetected?: ATSPlatform): PageContext {
  const scrapeResult = scrapeJobFromPageSync(url);

  return {
    type: scrapeResult.pageType,
    url,
    atsDetected,
    jobData: scrapeResult.jobData,
    formDetected: scrapeResult.formDetected,
    scrapingConfidence: scrapeResult.confidence,
  };
}

/**
 * Synchronous version for content script use
 */
function scrapeJobFromPageSync(url: string): ScrapeResult {
  const results: ScrapeResult[] = [];

  // Try structured data first
  try {
    const structuredResult = MetadataScraper.scrapeStructuredData();
    if (structuredResult.success && structuredResult.jobData) {
      results.push({
        ...structuredResult,
        source: 'structured',
        pageType: 'job_listing',
        formDetected: detectForm(),
      });
    }
  } catch {
    // Ignore errors
  }

  // Try universal scraper
  try {
    const universalResult = UniversalScraper.scrape(url);
    if (universalResult.success && universalResult.jobData) {
      results.push({
        ...universalResult,
        source: 'semantic',
        formDetected: detectForm(),
      });
    }
  } catch {
    // Ignore errors
  }

  if (results.length === 0) {
    return {
      success: false,
      confidence: 0,
      source: 'semantic',
      pageType: detectPageType(),
      formDetected: detectForm(),
    };
  }

  results.sort((a, b) => b.confidence - a.confidence);
  return results[0];
}

/**
 * Detect page type
 */
function detectPageType(): PageType {
  const url = window.location.href.toLowerCase();
  const title = document.title.toLowerCase();
  const bodyText = document.body?.innerText?.toLowerCase() || '';

  // Check for search results
  const searchIndicators = [
    'jobs/search',
    '/search?',
    'search-results',
    'job-search',
  ];
  if (searchIndicators.some((i) => url.includes(i))) {
    return 'search_results';
  }

  // Check for application form
  if (detectForm()) {
    const applyIndicators = ['/apply', 'application', 'submit'];
    if (applyIndicators.some((i) => url.includes(i) || title.includes(i))) {
      return 'application_form';
    }
  }

  // Check for job listing
  const jobIndicators = [
    '/job/', '/jobs/', '/position/', '/careers/', '/opening/',
    'job-details', 'job_details', 'viewjob',
  ];
  if (jobIndicators.some((i) => url.includes(i))) {
    return 'job_listing';
  }

  // Check for company page
  const companyIndicators = ['/company/', '/companies/', '/employer/'];
  if (companyIndicators.some((i) => url.includes(i))) {
    return 'company_page';
  }

  // Content analysis
  const jobPostingKeywords = [
    'job description',
    'qualifications',
    'requirements',
    'responsibilities',
    'apply now',
    'about this role',
    'what you\'ll do',
  ];

  const matchedKeywords = jobPostingKeywords.filter((k) => bodyText.includes(k));
  if (matchedKeywords.length >= 2) {
    return 'job_listing';
  }

  return 'unknown';
}

/**
 * Detect if page has an application form
 */
function detectForm(): boolean {
  const formIndicators = [
    'form[action*="apply"]',
    'form[action*="submit"]',
    'form[id*="application"]',
    'form[id*="apply"]',
    'form[class*="application"]',
    'form[class*="apply"]',
    '#application-form',
    '.application-form',
    '.job-apply-form',
    'button[type="submit"]',
    'input[type="file"][name*="resume"]',
    'input[type="file"][accept*="pdf"]',
  ];

  for (const selector of formIndicators) {
    if (document.querySelector(selector)) {
      return true;
    }
  }

  // Check for common form fields
  const formFields = [
    'input[name*="first"]',
    'input[name*="last"]',
    'input[name*="email"]',
    'input[name*="phone"]',
  ];

  let fieldCount = 0;
  for (const selector of formFields) {
    if (document.querySelector(selector)) {
      fieldCount++;
    }
  }

  return fieldCount >= 3;
}

export { MetadataScraper, UniversalScraper };
