/**
 * Universal Scraper
 *
 * Scrapes job data from pages without structured metadata using
 * semantic HTML analysis and common patterns.
 */

import type { ScrapedJobData, JobType, RemoteType, PageType } from '~/types';

interface ScrapeResult {
  success: boolean;
  jobData?: ScrapedJobData;
  confidence: number;
  pageType: PageType;
}

export class UniversalScraper {
  /**
   * Main entry point for universal scraping
   */
  static scrape(url: string): ScrapeResult {
    // Detect page type first
    const pageType = this.detectPageType(url);

    if (pageType !== 'job_listing' && pageType !== 'application_form') {
      return {
        success: false,
        confidence: 0,
        pageType,
      };
    }

    // Extract job data
    const jobTitle = this.extractJobTitle();
    const company = this.extractCompany(url);
    const location = this.extractLocation();
    const salary = this.extractSalary();
    const jobType = this.extractJobType();
    const remote = this.extractRemoteType();
    const description = this.extractDescription();
    const logoUrl = this.extractLogoUrl();

    // Calculate confidence
    let confidence = 0;
    if (jobTitle) confidence += 0.35;
    if (company) confidence += 0.35;
    if (location) confidence += 0.1;
    if (salary) confidence += 0.1;
    if (description) confidence += 0.1;

    if (!jobTitle || !company) {
      return {
        success: false,
        confidence,
        pageType,
      };
    }

    return {
      success: true,
      jobData: {
        company,
        jobTitle,
        url,
        source: 'semantic',
        confidence,
        location,
        salary: salary?.text,
        salaryMin: salary?.min,
        salaryMax: salary?.max,
        jobType,
        remote,
        description,
        logoUrl,
      },
      confidence,
      pageType,
    };
  }

  /**
   * Detect page type from URL and content
   */
  private static detectPageType(url: string): PageType {
    const lowerUrl = url.toLowerCase();
    const lowerTitle = document.title.toLowerCase();

    // Check URL patterns
    if (lowerUrl.includes('/search') || lowerUrl.includes('q=') || lowerUrl.includes('query=')) {
      return 'search_results';
    }

    if (lowerUrl.includes('/apply') || lowerUrl.includes('/application')) {
      return 'application_form';
    }

    const jobPatterns = [
      '/job/', '/jobs/', '/position/', '/positions/', '/careers/',
      '/opening/', '/vacancy/', '/viewjob', '/job-details', '/jv/',
    ];
    if (jobPatterns.some((p) => lowerUrl.includes(p))) {
      return 'job_listing';
    }

    if (lowerUrl.includes('/company/') || lowerUrl.includes('/companies/')) {
      return 'company_page';
    }

    // Check title patterns
    const jobTitlePatterns = [
      ' - jobs', ' | jobs', 'job at ', 'position at ', 'opening at ',
      'career at ', 'hiring ', 'we\'re hiring',
    ];
    if (jobTitlePatterns.some((p) => lowerTitle.includes(p))) {
      return 'job_listing';
    }

    // Check content for job-like elements
    const jobElements = [
      '[class*="job-title"]',
      '[class*="jobtitle"]',
      '[class*="job-description"]',
      '[data-job-id]',
      '[data-job-title]',
      'h1.job-title',
    ];

    for (const selector of jobElements) {
      if (document.querySelector(selector)) {
        return 'job_listing';
      }
    }

    return 'unknown';
  }

  /**
   * Extract job title from page
   */
  private static extractJobTitle(): string | undefined {
    // Priority order of selectors
    const selectors = [
      // Common job title selectors
      'h1[class*="job-title"]',
      'h1[class*="jobtitle"]',
      'h1[class*="JobTitle"]',
      '[data-testid="job-title"]',
      '[data-testid="jobTitle"]',
      '[data-job-title]',
      '.job-title h1',
      '.job-title',
      '.jobtitle',
      '#job-title',
      '[class*="job-title"]',
      '[class*="position-title"]',
      '[class*="job-header"] h1',
      '[class*="job-detail"] h1',
      'h1[itemprop="title"]',

      // Platform-specific
      '.jobs-unified-top-card__job-title', // LinkedIn
      '.jobsearch-JobInfoHeader-title', // Indeed
      '.job-details-jobs-unified-top-card__job-title', // LinkedIn (alt)

      // Fallback to first h1
      'h1',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const text = element?.textContent?.trim();
      if (text && text.length > 3 && text.length < 150 && !this.isCompanyName(text)) {
        return text;
      }
    }

    // Try document title parsing
    const title = document.title;
    const separators = [' - ', ' | ', ' — ', ' at '];
    for (const sep of separators) {
      if (title.includes(sep)) {
        const parts = title.split(sep);
        if (parts.length >= 2) {
          const firstPart = parts[0].trim();
          if (firstPart.length > 3 && firstPart.length < 100) {
            return firstPart;
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Extract company name from page
   */
  private static extractCompany(url: string): string | undefined {
    const selectors = [
      // Common company selectors
      '[class*="company-name"]',
      '[class*="companyname"]',
      '[class*="CompanyName"]',
      '[class*="employer-name"]',
      '[data-testid="company-name"]',
      '[data-company-name]',
      '.company-name',
      '.company',
      '#company-name',
      '[itemprop="hiringOrganization"]',
      '[itemprop="name"]',

      // Platform-specific
      '.jobs-unified-top-card__company-name', // LinkedIn
      '[data-testid="inlineHeader-companyName"]', // Indeed
      '.icl-u-lg-mr--sm a', // Indeed
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const text = element?.textContent?.trim();
      if (text && text.length > 1 && text.length < 100) {
        return text;
      }
    }

    // Try extracting from URL
    try {
      const hostname = new URL(url).hostname;
      // Pattern like careers.company.com or jobs.company.com
      const subdomainMatch = hostname.match(/^(?:careers|jobs|work)\.([\w-]+)\./i);
      if (subdomainMatch) {
        return this.formatCompanyName(subdomainMatch[1]);
      }

      // Pattern like company.careers.xyz or company-careers.com
      const domainMatch = hostname.match(/^([\w-]+)-?(?:careers|jobs)/i);
      if (domainMatch) {
        return this.formatCompanyName(domainMatch[1]);
      }
    } catch {
      // Invalid URL
    }

    // Try document title
    const title = document.title;
    const separators = [' - ', ' | ', ' — ', ' at '];
    for (const sep of separators) {
      if (title.includes(sep)) {
        const parts = title.split(sep);
        if (parts.length >= 2) {
          // Company is usually last or contains "Careers", "Jobs"
          for (let i = parts.length - 1; i >= 0; i--) {
            const part = parts[i].trim();
            if (part.toLowerCase().includes('careers') ||
                part.toLowerCase().includes('jobs')) {
              // Strip "Careers" or "Jobs" suffix
              return part.replace(/\s*(Careers|Jobs|Career|Job)$/i, '').trim();
            }
          }
          // Otherwise return last part
          return parts[parts.length - 1].trim();
        }
      }
    }

    return undefined;
  }

  /**
   * Extract location from page
   */
  private static extractLocation(): string | undefined {
    const selectors = [
      '[class*="location"]',
      '[class*="job-location"]',
      '[data-testid="location"]',
      '[data-testid="job-location"]',
      '[itemprop="jobLocation"]',
      '.job-location',
      '.location',
      '[class*="LocationIcon"]',
      // Near location icons
      'svg[class*="location"] + *',
      '[aria-label*="Location"] + *',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const text = element?.textContent?.trim();
      if (text && text.length > 2 && text.length < 100) {
        // Clean up common prefixes
        return text
          .replace(/^(Location|Job Location|Where|📍)[\s:]+/i, '')
          .trim();
      }
    }

    return undefined;
  }

  /**
   * Extract salary information
   */
  private static extractSalary(): { text: string; min?: number; max?: number } | undefined {
    const selectors = [
      '[class*="salary"]',
      '[class*="Salary"]',
      '[class*="compensation"]',
      '[class*="pay"]',
      '[data-testid="salary"]',
      '[data-testid="compensation"]',
      '.salary',
      '.compensation',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const text = element?.textContent?.trim();
      if (text) {
        const parsed = this.parseSalary(text);
        if (parsed) return parsed;
      }
    }

    // Search body text for salary patterns
    const bodyText = document.body?.innerText || '';
    const salaryPattern = /\$\s*[\d,]+(?:\s*(?:k|K))?\s*(?:-|–|to)\s*\$?\s*[\d,]+(?:\s*(?:k|K))?(?:\s*(?:per\s+)?(?:year|yr|annual|annum|\/yr|\/year))?/g;
    const matches = bodyText.match(salaryPattern);
    if (matches && matches.length > 0) {
      return this.parseSalary(matches[0]);
    }

    return undefined;
  }

  /**
   * Parse salary string to structured data
   */
  private static parseSalary(text: string): { text: string; min?: number; max?: number } | undefined {
    // Match patterns like "$80,000 - $120,000" or "$80k-120k" or "80K - 120K"
    const rangePattern = /\$?\s*([\d,]+)\s*(k|K)?\s*(?:-|–|to)\s*\$?\s*([\d,]+)\s*(k|K)?/;
    const match = text.match(rangePattern);

    if (match) {
      let min = parseInt(match[1].replace(/,/g, ''), 10);
      let max = parseInt(match[3].replace(/,/g, ''), 10);

      // Handle k/K suffix
      if (match[2] || min < 1000) min *= 1000;
      if (match[4] || max < 1000) max *= 1000;

      return {
        text: `$${(min / 1000).toFixed(0)}k - $${(max / 1000).toFixed(0)}k`,
        min,
        max,
      };
    }

    // Single value
    const singlePattern = /\$\s*([\d,]+)\s*(k|K)?/;
    const singleMatch = text.match(singlePattern);
    if (singleMatch) {
      let value = parseInt(singleMatch[1].replace(/,/g, ''), 10);
      if (singleMatch[2] || value < 1000) value *= 1000;

      return {
        text: `$${(value / 1000).toFixed(0)}k`,
        min: value,
        max: value,
      };
    }

    return undefined;
  }

  /**
   * Extract job type from page
   */
  private static extractJobType(): JobType | undefined {
    const text = (document.body?.innerText || '').toLowerCase();

    // Check for explicit mentions
    if (text.includes('full-time') || text.includes('full time')) return 'full-time';
    if (text.includes('part-time') || text.includes('part time')) return 'part-time';
    if (text.includes('contract')) return 'contract';
    if (text.includes('internship') || text.includes('intern position')) return 'internship';
    if (text.includes('temporary')) return 'temporary';

    // Check meta/data attributes
    const typeElements = document.querySelectorAll('[class*="employment"], [class*="job-type"], [data-employment-type]');
    for (const el of typeElements) {
      const content = el.textContent?.toLowerCase() || '';
      if (content.includes('full')) return 'full-time';
      if (content.includes('part')) return 'part-time';
      if (content.includes('contract')) return 'contract';
      if (content.includes('intern')) return 'internship';
    }

    return undefined;
  }

  /**
   * Extract remote work type
   */
  private static extractRemoteType(): RemoteType | undefined {
    const text = (document.body?.innerText || '').toLowerCase();

    // Check for explicit mentions
    if (text.includes('fully remote') || text.includes('100% remote') || text.includes('work from home')) {
      return 'remote';
    }
    if (text.includes('hybrid') || text.includes('partially remote')) {
      return 'hybrid';
    }
    if (text.includes('on-site') || text.includes('onsite') || text.includes('in-office') || text.includes('in office')) {
      return 'onsite';
    }

    // Check elements
    const remoteElements = document.querySelectorAll('[class*="remote"], [class*="location-type"], [data-remote]');
    for (const el of remoteElements) {
      const content = el.textContent?.toLowerCase() || '';
      if (content.includes('remote')) return 'remote';
      if (content.includes('hybrid')) return 'hybrid';
      if (content.includes('on-site') || content.includes('onsite')) return 'onsite';
    }

    return undefined;
  }

  /**
   * Extract job description
   */
  private static extractDescription(): string | undefined {
    const selectors = [
      '[class*="job-description"]',
      '[class*="jobDescription"]',
      '[class*="description"]',
      '[data-testid="job-description"]',
      '[data-testid="description"]',
      '#job-description',
      '.description',
      'article',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const text = element?.textContent?.trim();
      if (text && text.length > 100) {
        // Return first 1000 chars
        return text.slice(0, 1000);
      }
    }

    return undefined;
  }

  /**
   * Extract company logo URL
   */
  private static extractLogoUrl(): string | undefined {
    const selectors = [
      'img[class*="company-logo"]',
      'img[class*="companyLogo"]',
      'img[class*="employer-logo"]',
      'img[alt*="logo"]',
      '[class*="company-logo"] img',
      '[class*="logo-container"] img',
    ];

    for (const selector of selectors) {
      const img = document.querySelector(selector) as HTMLImageElement;
      if (img?.src && !img.src.includes('placeholder')) {
        return img.src;
      }
    }

    return undefined;
  }

  /**
   * Check if text looks like a company name (not job title)
   */
  private static isCompanyName(text: string): boolean {
    const companyIndicators = ['inc', 'llc', 'ltd', 'corp', 'company', 'technologies', 'solutions'];
    const lower = text.toLowerCase();
    return companyIndicators.some((i) => lower.includes(i));
  }

  /**
   * Format company name from URL slug
   */
  private static formatCompanyName(slug: string): string {
    return slug
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}

export default UniversalScraper;
