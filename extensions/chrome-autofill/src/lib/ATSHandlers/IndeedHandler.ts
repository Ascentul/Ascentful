/**
 * Indeed ATS Handler
 *
 * Handles form filling for Indeed job applications.
 * One of the highest volume job boards.
 */

import { BaseATSHandler } from './BaseATSHandler';
import type { FieldMapping, ATSPlatform } from '~/types';

export class IndeedHandler extends BaseATSHandler {
  readonly platformName: ATSPlatform = 'indeed';
  readonly displayName = 'Indeed';

  readonly urlPatterns = [
    /indeed\.com\/viewjob/i,
    /indeed\.com\/applystart/i,
    /indeed\.com\/m\/viewjob/i,
    /indeed\.com\/jobs/i,
  ];

  readonly fieldMappings: FieldMapping[] = [
    // Indeed uses specific input names and IDs
    {
      fieldType: 'text',
      selectors: [
        'input[name="applicant.name"]',
        'input[id="input-applicant.name"]',
        'input[name="name"]',
        'input[aria-label="Full name"]',
        'input[placeholder*="name"]',
      ],
      dataKey: 'fullName',
      priority: 10,
      required: true,
    },
    {
      fieldType: 'email',
      selectors: [
        'input[name="applicant.email"]',
        'input[id="input-applicant.email"]',
        'input[name="email"]',
        'input[type="email"]',
        'input[aria-label="Email"]',
      ],
      dataKey: 'email',
      priority: 10,
      required: true,
    },
    {
      fieldType: 'phone',
      selectors: [
        'input[name="applicant.phoneNumber"]',
        'input[id="input-applicant.phoneNumber"]',
        'input[name="phone"]',
        'input[type="tel"]',
        'input[aria-label*="Phone"]',
      ],
      dataKey: 'phone',
      priority: 9,
    },

    // Location
    {
      fieldType: 'text',
      selectors: [
        'input[name="applicant.location"]',
        'input[name="location"]',
        'input[aria-label*="Location"]',
        'input[aria-label*="City"]',
      ],
      dataKey: 'location',
      priority: 7,
    },

    // Current Role
    {
      fieldType: 'text',
      selectors: [
        'input[name="experience.title"]',
        'input[aria-label*="Job title"]',
        'input[aria-label*="Current position"]',
      ],
      dataKey: 'currentTitle',
      priority: 6,
    },
    {
      fieldType: 'text',
      selectors: [
        'input[name="experience.company"]',
        'input[aria-label*="Company"]',
        'input[aria-label*="Employer"]',
      ],
      dataKey: 'currentCompany',
      priority: 6,
    },

    // Cover Letter / Summary
    {
      fieldType: 'textarea',
      selectors: [
        'textarea[name="coverletter"]',
        'textarea[name="coverLetter"]',
        'textarea[aria-label*="Cover letter"]',
        'textarea[aria-label*="message"]',
      ],
      dataKey: 'summary',
      priority: 4,
    },
  ];

  /**
   * Extract job title from Indeed page
   */
  extractJobTitle(): string | undefined {
    const selectors = [
      '.jobsearch-JobInfoHeader-title',
      'h1[data-testid="jobTitle"]',
      '.icl-u-xs-mb--xs',
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
   * Extract company name from Indeed page
   */
  extractCompany(): string | undefined {
    const selectors = [
      '.jobsearch-JobInfoHeader-subtitle',
      '[data-testid="companyName"]',
      '.icl-u-lg-mr--sm',
      'a[data-tn-element="companyName"]',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    return undefined;
  }
}

export default IndeedHandler;
