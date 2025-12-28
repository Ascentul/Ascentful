/**
 * iCIMS ATS Handler
 *
 * Handles form filling for iCIMS job applications.
 * Popular enterprise ATS platform.
 */

import { BaseATSHandler } from './BaseATSHandler';
import type { FieldMapping, ATSPlatform } from '~/types';

export class ICIMSHandler extends BaseATSHandler {
  readonly platformName: ATSPlatform = 'icims';
  readonly displayName = 'iCIMS';

  readonly urlPatterns = [
    /\.icims\.com/i,
    /icims\.com/i,
    /careers-.*\.icims\.com/i,
  ];

  readonly fieldMappings: FieldMapping[] = [
    // iCIMS uses specific field patterns
    {
      fieldType: 'text',
      selectors: [
        'input[id*="firstname"]',
        'input[name*="firstname"]',
        'input[id*="FirstName"]',
        'input[name*="FirstName"]',
        'input[data-field="firstName"]',
        'input[aria-label*="First Name"]',
        'input[aria-label*="First name"]',
        'input[placeholder*="First Name"]',
        'input[placeholder*="First name"]',
      ],
      dataKey: 'firstName',
      priority: 10,
      required: true,
    },
    {
      fieldType: 'text',
      selectors: [
        'input[id*="lastname"]',
        'input[name*="lastname"]',
        'input[id*="LastName"]',
        'input[name*="LastName"]',
        'input[data-field="lastName"]',
        'input[aria-label*="Last Name"]',
        'input[aria-label*="Last name"]',
        'input[placeholder*="Last Name"]',
        'input[placeholder*="Last name"]',
      ],
      dataKey: 'lastName',
      priority: 10,
      required: true,
    },
    {
      fieldType: 'email',
      selectors: [
        'input[id*="email"]',
        'input[name*="email"]',
        'input[data-field="email"]',
        'input[type="email"]',
        'input[aria-label*="Email"]',
        'input[placeholder*="Email"]',
      ],
      dataKey: 'email',
      priority: 10,
      required: true,
    },
    {
      fieldType: 'phone',
      selectors: [
        'input[id*="phone"]',
        'input[name*="phone"]',
        'input[id*="Phone"]',
        'input[name*="Phone"]',
        'input[data-field="phone"]',
        'input[type="tel"]',
        'input[aria-label*="Phone"]',
        'input[placeholder*="Phone"]',
      ],
      dataKey: 'phone',
      priority: 9,
    },

    // Address
    {
      fieldType: 'text',
      selectors: [
        'input[id*="address"]',
        'input[name*="address"]',
        'input[id*="street"]',
        'input[name*="street"]',
        'input[data-field="address"]',
        'input[aria-label*="Address"]',
        'input[aria-label*="Street"]',
      ],
      dataKey: 'location',
      priority: 7,
    },
    {
      fieldType: 'text',
      selectors: [
        'input[id*="city"]',
        'input[name*="city"]',
        'input[data-field="city"]',
        'input[aria-label*="City"]',
        'input[placeholder*="City"]',
      ],
      dataKey: 'location',
      priority: 7,
    },
    {
      fieldType: 'text',
      selectors: [
        'input[id*="zip"]',
        'input[name*="zip"]',
        'input[id*="postal"]',
        'input[name*="postal"]',
        'input[data-field="zipCode"]',
        'input[aria-label*="Zip"]',
        'input[aria-label*="Postal"]',
      ],
      dataKey: 'location',
      priority: 6,
    },

    // Professional Links
    {
      fieldType: 'url',
      selectors: [
        'input[id*="linkedin"]',
        'input[name*="linkedin"]',
        'input[id*="LinkedIn"]',
        'input[name*="LinkedIn"]',
        'input[data-field="linkedIn"]',
        'input[aria-label*="LinkedIn"]',
        'input[placeholder*="LinkedIn"]',
      ],
      dataKey: 'linkedinUrl',
      priority: 5,
    },
    {
      fieldType: 'url',
      selectors: [
        'input[id*="website"]',
        'input[name*="website"]',
        'input[id*="portfolio"]',
        'input[name*="portfolio"]',
        'input[data-field="website"]',
        'input[aria-label*="Website"]',
        'input[aria-label*="Portfolio"]',
      ],
      dataKey: 'websiteUrl',
      priority: 4,
    },
    {
      fieldType: 'url',
      selectors: [
        'input[id*="github"]',
        'input[name*="github"]',
        'input[id*="GitHub"]',
        'input[name*="GitHub"]',
        'input[aria-label*="GitHub"]',
      ],
      dataKey: 'githubUrl',
      priority: 4,
    },

    // Current Employment
    {
      fieldType: 'text',
      selectors: [
        'input[id*="currentTitle"]',
        'input[name*="currentTitle"]',
        'input[id*="jobTitle"]',
        'input[name*="jobTitle"]',
        'input[id*="title"]',
        'input[data-field="currentTitle"]',
        'input[aria-label*="Current Title"]',
        'input[aria-label*="Job Title"]',
      ],
      dataKey: 'currentTitle',
      priority: 6,
    },
    {
      fieldType: 'text',
      selectors: [
        'input[id*="currentCompany"]',
        'input[name*="currentCompany"]',
        'input[id*="employer"]',
        'input[name*="employer"]',
        'input[id*="company"]',
        'input[name*="company"]',
        'input[data-field="currentCompany"]',
        'input[aria-label*="Current Company"]',
        'input[aria-label*="Employer"]',
      ],
      dataKey: 'currentCompany',
      priority: 6,
    },

    // Cover Letter / Summary
    {
      fieldType: 'textarea',
      selectors: [
        'textarea[id*="coverLetter"]',
        'textarea[name*="coverLetter"]',
        'textarea[id*="cover"]',
        'textarea[name*="cover"]',
        'textarea[data-field="coverLetter"]',
        'textarea[aria-label*="Cover Letter"]',
        'textarea[aria-label*="Cover letter"]',
      ],
      dataKey: 'summary',
      priority: 4,
    },
    {
      fieldType: 'textarea',
      selectors: [
        'textarea[id*="summary"]',
        'textarea[name*="summary"]',
        'textarea[data-field="summary"]',
        'textarea[aria-label*="Summary"]',
        'textarea[aria-label*="About"]',
        'textarea[aria-label*="Introduction"]',
      ],
      dataKey: 'summary',
      priority: 3,
    },
  ];

  /**
   * Extract job title from iCIMS page
   */
  extractJobTitle(): string | undefined {
    const selectors = [
      '.iCIMS_JobTitle',
      '.job-title',
      '.jobTitle',
      'h1.title',
      '.iCIMS_Header h1',
      '[class*="JobTitle"]',
      'h1[class*="job"]',
      '.header-cell h1',
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
   * Extract company name from iCIMS page
   */
  extractCompany(): string | undefined {
    const selectors = [
      '.iCIMS_CompanyName',
      '.company-name',
      '.companyName',
      '.iCIMS_Header .company',
      '[class*="CompanyName"]',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    // Try to extract from URL or page title
    const urlMatch = window.location.hostname.match(/careers-(.+?)\.icims\.com/i);
    if (urlMatch) {
      return urlMatch[1].replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    }

    const titleMatch = document.title.match(/(.+?)\s*[-|]\s*Careers/i);
    if (titleMatch) {
      return titleMatch[1].trim();
    }

    return undefined;
  }

  /**
   * Check if this is an application form
   */
  isApplicationPage(): boolean {
    const formIndicators = [
      '.iCIMS_ApplyContent',
      '.iCIMS_ApplicationForm',
      'form[id*="apply"]',
      'form[id*="application"]',
      '#iCIMS_ApplyWidget',
      '.apply-form',
      'button[class*="apply"]',
    ];

    return formIndicators.some((selector) => document.querySelector(selector));
  }
}

export default ICIMSHandler;
