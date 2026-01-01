/**
 * Metadata Scraper
 *
 * Extracts job data from structured metadata:
 * - JSON-LD (Schema.org JobPosting)
 * - OpenGraph tags
 * - Twitter Card meta tags
 * - Standard HTML meta tags
 */

import type { ScrapedJobData, JobType, RemoteType } from '~/types';

interface ScrapeResult {
  success: boolean;
  jobData?: ScrapedJobData;
  confidence: number;
}

interface JsonLdJobPosting {
  '@type': string;
  title?: string;
  jobTitle?: string;
  name?: string;
  hiringOrganization?: {
    name?: string;
    '@type'?: string;
    logo?: {
      url?: string;
    } | string;
  };
  jobLocation?: {
    address?: {
      addressLocality?: string;
      addressRegion?: string;
      addressCountry?: string;
      streetAddress?: string;
    };
    name?: string;
  } | Array<{
    address?: {
      addressLocality?: string;
      addressRegion?: string;
      addressCountry?: string;
    };
    name?: string;
  }>;
  baseSalary?: {
    currency?: string;
    value?: {
      minValue?: number;
      maxValue?: number;
      value?: number;
    } | number;
  };
  employmentType?: string | string[];
  jobLocationType?: string;
  description?: string;
  datePosted?: string;
  validThrough?: string;
  identifier?: {
    value?: string;
  };
}

export class MetadataScraper {
  /**
   * Main entry point for structured data scraping
   */
  static scrapeStructuredData(): ScrapeResult {
    // Try JSON-LD first (most reliable)
    const jsonLdResult = this.scrapeJsonLd();
    if (jsonLdResult.success && jsonLdResult.confidence > 0.7) {
      return jsonLdResult;
    }

    // Try OpenGraph
    const ogResult = this.scrapeOpenGraph();
    if (ogResult.success && ogResult.confidence > 0.5) {
      // Merge with JSON-LD if partial
      if (jsonLdResult.success && jsonLdResult.jobData) {
        return {
          success: true,
          jobData: {
            ...ogResult.jobData!,
            ...jsonLdResult.jobData,
          },
          confidence: Math.max(jsonLdResult.confidence, ogResult.confidence),
        };
      }
      return ogResult;
    }

    return jsonLdResult.success ? jsonLdResult : { success: false, confidence: 0 };
  }

  /**
   * Scrape JSON-LD structured data
   */
  static scrapeJsonLd(): ScrapeResult {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    let bestMatch: JsonLdJobPosting | null = null;
    let confidence = 0;

    scripts.forEach((script) => {
      try {
        const data = JSON.parse(script.textContent || '');

        // Handle @graph array
        const items = data['@graph'] || [data];
        const arrayItems = Array.isArray(items) ? items : [items];

        for (const item of arrayItems) {
          if (this.isJobPosting(item)) {
            bestMatch = item;
            confidence = 0.9; // High confidence for JSON-LD JobPosting
            break;
          }
        }
      } catch {
        // Invalid JSON, skip
      }
    });

    if (!bestMatch) {
      return { success: false, confidence: 0 };
    }

    const jobData = this.parseJobPosting(bestMatch);
    if (!jobData.company || !jobData.jobTitle) {
      return { success: false, confidence: 0 };
    }

    return {
      success: true,
      jobData: {
        company: jobData.company,
        jobTitle: jobData.jobTitle,
        url: window.location.href,
        source: 'structured',
        confidence,
        location: jobData.location,
        salary: jobData.salary,
        salaryMin: jobData.salaryMin,
        salaryMax: jobData.salaryMax,
        jobType: jobData.jobType,
        remote: jobData.remote,
        description: jobData.description,
        postedDate: jobData.postedDate,
        deadline: jobData.deadline,
        logoUrl: jobData.logoUrl,
        platformJobId: jobData.platformJobId,
      },
      confidence,
    };
  }

  /**
   * Scrape OpenGraph meta tags
   */
  static scrapeOpenGraph(): ScrapeResult {
    const getMeta = (property: string): string | undefined => {
      const element = document.querySelector(`meta[property="${property}"]`) ||
                      document.querySelector(`meta[name="${property}"]`);
      return element?.getAttribute('content') || undefined;
    };

    const title = getMeta('og:title');
    const siteName = getMeta('og:site_name');
    const description = getMeta('og:description');
    const image = getMeta('og:image');

    // Need at least title to be useful
    if (!title) {
      return { success: false, confidence: 0 };
    }

    // Try to extract job title and company from title
    const { jobTitle, company } = this.parseTitle(title, siteName);

    if (!jobTitle && !company) {
      return { success: false, confidence: 0 };
    }

    return {
      success: true,
      jobData: {
        company: company || siteName || 'Unknown Company',
        jobTitle: jobTitle || title,
        url: window.location.href,
        source: 'structured',
        confidence: 0.6,
        description: description?.slice(0, 500),
        logoUrl: image,
      },
      confidence: 0.6,
    };
  }

  /**
   * Check if object is a JobPosting
   */
  private static isJobPosting(item: unknown): item is JsonLdJobPosting {
    if (!item || typeof item !== 'object') return false;
    const type = (item as Record<string, unknown>)['@type'];
    if (typeof type === 'string') {
      return type.toLowerCase().includes('jobposting');
    }
    if (Array.isArray(type)) {
      return type.some((t) => typeof t === 'string' && t.toLowerCase().includes('jobposting'));
    }
    return false;
  }

  /**
   * Parse JobPosting JSON-LD to ScrapedJobData
   */
  private static parseJobPosting(posting: JsonLdJobPosting): Partial<ScrapedJobData> {
    const result: Partial<ScrapedJobData> = {};

    // Job title
    result.jobTitle = posting.title || posting.jobTitle || posting.name || '';

    // Company
    if (posting.hiringOrganization) {
      result.company = posting.hiringOrganization.name || '';
      const logo = posting.hiringOrganization.logo;
      if (logo) {
        result.logoUrl = typeof logo === 'string' ? logo : logo.url;
      }
    }

    // Location
    if (posting.jobLocation) {
      const locations = Array.isArray(posting.jobLocation)
        ? posting.jobLocation
        : [posting.jobLocation];

      const locationParts: string[] = [];
      for (const loc of locations) {
        if (loc.address) {
          const parts = [
            loc.address.addressLocality,
            loc.address.addressRegion,
            loc.address.addressCountry,
          ].filter(Boolean);
          if (parts.length > 0) {
            locationParts.push(parts.join(', '));
          }
        } else if (loc.name) {
          locationParts.push(loc.name as string);
        }
      }
      result.location = locationParts.join(' | ') || undefined;
    }

    // Salary
    if (posting.baseSalary) {
      const salary = posting.baseSalary;
      const currency = salary.currency || 'USD';
      const value = salary.value;

      if (typeof value === 'number') {
        result.salary = this.formatSalary(value, value, currency);
        result.salaryMin = value;
        result.salaryMax = value;
      } else if (value && typeof value === 'object') {
        const min = value.minValue || value.value;
        const max = value.maxValue || value.value;
        if (min || max) {
          result.salary = this.formatSalary(min, max, currency);
          result.salaryMin = min;
          result.salaryMax = max;
        }
      }
    }

    // Employment type
    const empType = Array.isArray(posting.employmentType)
      ? posting.employmentType[0]
      : posting.employmentType;
    result.jobType = this.parseEmploymentType(empType);

    // Remote
    if (posting.jobLocationType) {
      result.remote = this.parseRemoteType(posting.jobLocationType);
    }

    // Description
    if (posting.description) {
      // Strip HTML
      const temp = document.createElement('div');
      temp.innerHTML = posting.description;
      result.description = temp.textContent?.slice(0, 1000) || undefined;
    }

    // Dates
    result.postedDate = posting.datePosted;
    result.deadline = posting.validThrough;

    // Platform ID
    if (posting.identifier?.value) {
      result.platformJobId = posting.identifier.value;
    }

    return result;
  }

  /**
   * Parse title into job title and company
   */
  private static parseTitle(title: string, siteName?: string): { jobTitle?: string; company?: string } {
    // Common patterns:
    // "Software Engineer - Google"
    // "Software Engineer at Google"
    // "Software Engineer | Google"
    // "Google - Software Engineer"

    const separators = [' - ', ' | ', ' at ', ' — '];

    for (const sep of separators) {
      if (title.includes(sep)) {
        const parts = title.split(sep);
        if (parts.length >= 2) {
          // Determine which part is the job title vs company
          // Usually job title is first, but "Company - Job Title" is also common
          const [first, ...rest] = parts;
          const second = rest.join(sep);

          // If siteName matches one part, the other is the job title
          if (siteName) {
            if (first.toLowerCase().includes(siteName.toLowerCase())) {
              return { jobTitle: second, company: first };
            }
            if (second.toLowerCase().includes(siteName.toLowerCase())) {
              return { jobTitle: first, company: second };
            }
          }

          // Heuristic: job titles usually contain role words
          const roleWords = ['engineer', 'manager', 'developer', 'analyst', 'designer', 'director', 'lead', 'intern'];
          const firstIsRole = roleWords.some((w) => first.toLowerCase().includes(w));
          const secondIsRole = roleWords.some((w) => second.toLowerCase().includes(w));

          if (firstIsRole && !secondIsRole) {
            return { jobTitle: first, company: second };
          }
          if (secondIsRole && !firstIsRole) {
            return { jobTitle: second, company: first };
          }

          // Default: first is job title
          return { jobTitle: first, company: second };
        }
      }
    }

    return { jobTitle: title };
  }

  /**
   * Format salary range
   */
  private static formatSalary(min?: number, max?: number, currency = 'USD'): string {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    });

    if (min && max && min !== max) {
      return `${formatter.format(min)} - ${formatter.format(max)}`;
    }
    if (min) {
      return formatter.format(min);
    }
    if (max) {
      return formatter.format(max);
    }
    return '';
  }

  /**
   * Parse employment type string to JobType
   */
  private static parseEmploymentType(type?: string): JobType | undefined {
    if (!type) return undefined;
    const lower = type.toLowerCase();

    if (lower.includes('full') || lower === 'full_time') return 'full-time';
    if (lower.includes('part') || lower === 'part_time') return 'part-time';
    if (lower.includes('contract') || lower === 'contractor') return 'contract';
    if (lower.includes('intern')) return 'internship';
    if (lower.includes('temp')) return 'temporary';

    return undefined;
  }

  /**
   * Parse remote type string
   */
  private static parseRemoteType(type?: string): RemoteType | undefined {
    if (!type) return undefined;
    const lower = type.toLowerCase();

    if (lower.includes('remote') || lower === 'telecommute') return 'remote';
    if (lower.includes('hybrid')) return 'hybrid';
    if (lower.includes('onsite') || lower.includes('on-site') || lower.includes('in-person')) return 'onsite';

    return undefined;
  }
}

export default MetadataScraper;
