/**
 * Greenhouse ATS Handler
 *
 * Handles form filling for Greenhouse job applications.
 * Common on tech startups and mid-size companies.
 */

import { BaseATSHandler } from './BaseATSHandler';
import type { FieldMapping, ATSPlatform } from '~/types';

export class GreenhouseHandler extends BaseATSHandler {
  readonly platformName: ATSPlatform = 'greenhouse';
  readonly displayName = 'Greenhouse';

  readonly urlPatterns = [
    /boards\.greenhouse\.io/i,
    /job-boards\.greenhouse\.io/i,
    /greenhouse\.io\/.*\/jobs/i,
  ];

  readonly fieldMappings: FieldMapping[] = [
    // Personal Info - High Priority
    {
      fieldType: 'text',
      selectors: [
        '#first_name',
        'input[name="first_name"]',
        'input[name="job_application[first_name]"]',
        '[data-field="first_name"] input',
      ],
      dataKey: 'firstName',
      priority: 10,
      required: true,
    },
    {
      fieldType: 'text',
      selectors: [
        '#last_name',
        'input[name="last_name"]',
        'input[name="job_application[last_name]"]',
        '[data-field="last_name"] input',
      ],
      dataKey: 'lastName',
      priority: 10,
      required: true,
    },
    {
      fieldType: 'email',
      selectors: [
        '#email',
        'input[name="email"]',
        'input[name="job_application[email]"]',
        'input[type="email"]',
        '[data-field="email"] input',
      ],
      dataKey: 'email',
      priority: 10,
      required: true,
    },
    {
      fieldType: 'phone',
      selectors: [
        '#phone',
        'input[name="phone"]',
        'input[name="job_application[phone]"]',
        'input[type="tel"]',
        '[data-field="phone"] input',
      ],
      dataKey: 'phone',
      priority: 9,
    },

    // Location
    {
      fieldType: 'text',
      selectors: [
        'input[name*="location"]',
        'input[name*="city"]',
        '#location',
        '[data-field="location"] input',
        'input[autocomplete="address-level2"]',
      ],
      dataKey: 'location',
      priority: 7,
    },

    // Links
    {
      fieldType: 'text',
      selectors: [
        '#linkedin_profile',
        'input[name*="linkedin"]',
        'input[name*="linkedin_profile"]',
        '[data-field*="linkedin"] input',
        'input[placeholder*="LinkedIn"]',
        'input[placeholder*="linkedin"]',
      ],
      dataKey: 'linkedin',
      priority: 8,
    },
    {
      fieldType: 'text',
      selectors: [
        '#github',
        'input[name*="github"]',
        '[data-field*="github"] input',
        'input[placeholder*="GitHub"]',
        'input[placeholder*="github"]',
      ],
      dataKey: 'github',
      priority: 8,
    },
    {
      fieldType: 'text',
      selectors: [
        '#website',
        'input[name*="website"]',
        'input[name*="portfolio"]',
        '[data-field*="website"] input',
        '[data-field*="portfolio"] input',
        'input[placeholder*="Portfolio"]',
        'input[placeholder*="website"]',
      ],
      dataKey: 'website',
      priority: 7,
    },

    // Current Role
    {
      fieldType: 'text',
      selectors: [
        'input[name*="current_company"]',
        'input[name*="company"]',
        '[data-field*="company"] input',
        'input[placeholder*="Company"]',
      ],
      dataKey: 'currentCompany',
      priority: 6,
    },
    {
      fieldType: 'text',
      selectors: [
        'input[name*="current_title"]',
        'input[name*="title"]',
        '[data-field*="title"] input',
        'input[placeholder*="Title"]',
      ],
      dataKey: 'currentTitle',
      priority: 6,
    },

    // Education
    {
      fieldType: 'text',
      selectors: [
        'input[name*="school"]',
        'input[name*="university"]',
        '[data-field*="school"] input',
        'select[name*="school"]',
      ],
      dataKey: 'school',
      priority: 5,
    },
    {
      fieldType: 'text',
      selectors: [
        'input[name*="degree"]',
        'select[name*="degree"]',
        '[data-field*="degree"] input',
      ],
      dataKey: 'degree',
      priority: 5,
    },
    {
      fieldType: 'text',
      selectors: [
        'input[name*="discipline"]',
        'input[name*="major"]',
        'input[name*="field_of_study"]',
        'select[name*="discipline"]',
        '[data-field*="major"] input',
      ],
      dataKey: 'major',
      priority: 5,
    },

    // Cover Letter / Summary
    {
      fieldType: 'textarea',
      selectors: [
        'textarea[name*="cover_letter"]',
        'textarea[name*="cover"]',
        '#cover_letter',
        '[data-field="cover_letter"] textarea',
      ],
      dataKey: 'summary',
      priority: 4,
    },
  ];

  /**
   * Extract job title from Greenhouse page
   */
  extractJobTitle(): string | undefined {
    const selectors = [
      '.job-title',
      'h1.posting-headline',
      '.app-title',
      '[data-mapped="true"] h1',
      'h1',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const text = element?.textContent?.trim();
      if (text && text.length < 100) {
        return text;
      }
    }

    return undefined;
  }

  /**
   * Extract company name from Greenhouse page
   */
  extractCompany(): string | undefined {
    const selectors = ['.company-name', '[data-company-name]', '.posting-company'];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    // Fallback: extract from URL
    const match = window.location.href.match(/boards\.greenhouse\.io\/([^\/]+)/);
    if (match) {
      return match[1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }

    return undefined;
  }
}

export default GreenhouseHandler;
