/**
 * Workday ATS Handler
 *
 * Handles form filling for Workday job applications.
 * Common for enterprise and large corporations.
 */

import { BaseATSHandler } from './BaseATSHandler';
import type { FieldMapping, ATSPlatform } from '~/types';

export class WorkdayHandler extends BaseATSHandler {
  readonly platformName: ATSPlatform = 'workday';
  readonly displayName = 'Workday';

  readonly urlPatterns = [
    /myworkdayjobs\.com/i,
    /workday\.com\/.*\/job/i,
    /wd\d\.myworkdayjobs\.com/i,
  ];

  readonly fieldMappings: FieldMapping[] = [
    // Workday uses data-automation-id attributes extensively
    {
      fieldType: 'text',
      selectors: [
        '[data-automation-id="legalNameSection_firstName"] input',
        '[data-automation-id="firstName"] input',
        'input[name*="firstName"]',
        'input[aria-label*="First Name"]',
      ],
      dataKey: 'firstName',
      priority: 10,
      required: true,
    },
    {
      fieldType: 'text',
      selectors: [
        '[data-automation-id="legalNameSection_lastName"] input',
        '[data-automation-id="lastName"] input',
        'input[name*="lastName"]',
        'input[aria-label*="Last Name"]',
      ],
      dataKey: 'lastName',
      priority: 10,
      required: true,
    },
    {
      fieldType: 'email',
      selectors: [
        '[data-automation-id="email"] input',
        '[data-automation-id="emailAddress"] input',
        'input[type="email"]',
        'input[name*="email"]',
        'input[aria-label*="Email"]',
      ],
      dataKey: 'email',
      priority: 10,
      required: true,
    },
    {
      fieldType: 'phone',
      selectors: [
        '[data-automation-id="phone-number"] input',
        '[data-automation-id="phoneNumber"] input',
        'input[type="tel"]',
        'input[name*="phone"]',
        'input[aria-label*="Phone"]',
      ],
      dataKey: 'phone',
      priority: 9,
    },

    // Address Fields
    {
      fieldType: 'text',
      selectors: [
        '[data-automation-id="addressSection_addressLine1"] input',
        '[data-automation-id="address1"] input',
        'input[name*="addressLine1"]',
        'input[aria-label*="Address Line 1"]',
      ],
      dataKey: 'location',
      priority: 7,
    },
    {
      fieldType: 'text',
      selectors: [
        '[data-automation-id="addressSection_city"] input',
        '[data-automation-id="city"] input',
        'input[name*="city"]',
        'input[aria-label*="City"]',
      ],
      dataKey: 'city',
      priority: 7,
    },
    {
      fieldType: 'text',
      selectors: [
        '[data-automation-id="addressSection_postalCode"] input',
        '[data-automation-id="postalCode"] input',
        'input[name*="postalCode"]',
        'input[name*="zipCode"]',
        'input[aria-label*="Postal"]',
      ],
      dataKey: 'location',
      priority: 6,
      transform: (location: string) => {
        // Extract postal code from location if it contains one
        const postalMatch = location?.match(/\d{5}(-\d{4})?/);
        return postalMatch ? postalMatch[0] : '';
      },
    },

    // Links
    {
      fieldType: 'text',
      selectors: [
        '[data-automation-id="linkedinQuestion"] input',
        '[data-automation-id="linkedin"] input',
        'input[name*="linkedin"]',
        'input[aria-label*="LinkedIn"]',
      ],
      dataKey: 'linkedin',
      priority: 8,
    },

    // Previous Employment
    {
      fieldType: 'text',
      selectors: [
        '[data-automation-id="previousWorker"] input',
        'input[name*="previousEmployer"]',
        'input[aria-label*="Previous Employer"]',
        'input[aria-label*="Current Employer"]',
      ],
      dataKey: 'currentCompany',
      priority: 6,
    },
  ];

  /**
   * Extract job title from Workday page
   */
  extractJobTitle(): string | undefined {
    const selectors = [
      '[data-automation-id="jobPostingHeader"] h2',
      '.css-1q2dra3',
      'h1[data-automation-id="jobTitle"]',
      '[data-automation-id="jobTitle"]',
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
   * Extract company name from Workday page
   */
  extractCompany(): string | undefined {
    const selectors = [
      '[data-automation-id="jobPostingHeader"] h3',
      '[data-automation-id="companyName"]',
      '.css-wvr9gz',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    // Fallback: extract from URL
    const match = window.location.hostname.match(/^([^.]+)\./);
    if (match) {
      return match[1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }

    return undefined;
  }

  /**
   * Override to handle Workday's multi-page forms
   */
  async fillForm(data: any) {
    // Wait for Workday to fully load (it's slow)
    await this.delay(1000);

    // Check if we need to wait for specific elements
    const formLoaded = await this.waitForElement('[data-automation-id="jobPostingPage"]', 5000);
    if (!formLoaded) {
      console.warn('[Ascentful] Workday form not fully loaded');
    }

    return super.fillForm(data);
  }

  /**
   * Wait for an element to appear
   */
  private async waitForElement(selector: string, timeout: number): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (document.querySelector(selector)) {
        return true;
      }
      await this.delay(200);
    }

    return false;
  }
}

export default WorkdayHandler;
