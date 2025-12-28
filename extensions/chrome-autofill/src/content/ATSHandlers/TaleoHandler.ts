/**
 * Taleo ATS Handler
 *
 * Handles form filling for Oracle Taleo job applications.
 * Used by many enterprise companies.
 */

import { BaseATSHandler } from './BaseATSHandler';
import type { FieldMapping, ATSPlatform } from '~/types';

export class TaleoHandler extends BaseATSHandler {
  readonly platformName: ATSPlatform = 'taleo';
  readonly displayName = 'Taleo';

  readonly urlPatterns = [
    /\.taleo\.net/i,
    /taleo\.com/i,
    /recruiter\.oracle\.cloud/i,
  ];

  readonly fieldMappings: FieldMapping[] = [
    // Personal Information
    {
      fieldType: 'text',
      selectors: [
        'input[id*="FirstName"]',
        'input[name*="FirstName"]',
        'input[id*="firstName"]',
        'input[name*="firstName"]',
        'input[aria-label*="First Name"]',
        'input[aria-label*="First name"]',
      ],
      dataKey: 'firstName',
      priority: 10,
      required: true,
    },
    {
      fieldType: 'text',
      selectors: [
        'input[id*="LastName"]',
        'input[name*="LastName"]',
        'input[id*="lastName"]',
        'input[name*="lastName"]',
        'input[aria-label*="Last Name"]',
        'input[aria-label*="Last name"]',
      ],
      dataKey: 'lastName',
      priority: 10,
      required: true,
    },
    {
      fieldType: 'email',
      selectors: [
        'input[id*="Email"]',
        'input[name*="Email"]',
        'input[id*="email"]',
        'input[name*="email"]',
        'input[type="email"]',
        'input[aria-label*="Email"]',
      ],
      dataKey: 'email',
      priority: 10,
      required: true,
    },
    {
      fieldType: 'phone',
      selectors: [
        'input[id*="Phone"]',
        'input[name*="Phone"]',
        'input[id*="phone"]',
        'input[name*="phone"]',
        'input[type="tel"]',
        'input[aria-label*="Phone"]',
        'input[aria-label*="Telephone"]',
      ],
      dataKey: 'phone',
      priority: 9,
    },

    // Address Fields - Taleo often has detailed address
    {
      fieldType: 'text',
      selectors: [
        'input[id*="Address"]',
        'input[name*="Address"]',
        'input[id*="address"]',
        'input[name*="address"]',
        'input[id*="Street"]',
        'input[name*="Street"]',
        'input[aria-label*="Address"]',
        'input[aria-label*="Street"]',
      ],
      dataKey: 'location',
      priority: 7,
    },
    {
      fieldType: 'text',
      selectors: [
        'input[id*="City"]',
        'input[name*="City"]',
        'input[id*="city"]',
        'input[name*="city"]',
        'input[aria-label*="City"]',
      ],
      dataKey: 'location',
      priority: 7,
    },
    {
      fieldType: 'text',
      selectors: [
        'input[id*="ZipCode"]',
        'input[name*="ZipCode"]',
        'input[id*="PostalCode"]',
        'input[name*="PostalCode"]',
        'input[id*="zipCode"]',
        'input[id*="postalCode"]',
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
        'input[id*="LinkedIn"]',
        'input[name*="LinkedIn"]',
        'input[id*="linkedin"]',
        'input[name*="linkedin"]',
        'input[aria-label*="LinkedIn"]',
      ],
      dataKey: 'linkedinUrl',
      priority: 5,
    },
    {
      fieldType: 'url',
      selectors: [
        'input[id*="Website"]',
        'input[name*="Website"]',
        'input[id*="portfolio"]',
        'input[name*="portfolio"]',
        'input[aria-label*="Website"]',
        'input[aria-label*="Portfolio"]',
      ],
      dataKey: 'websiteUrl',
      priority: 4,
    },

    // Current Employment
    {
      fieldType: 'text',
      selectors: [
        'input[id*="CurrentTitle"]',
        'input[name*="CurrentTitle"]',
        'input[id*="JobTitle"]',
        'input[name*="JobTitle"]',
        'input[aria-label*="Current Title"]',
        'input[aria-label*="Job Title"]',
        'input[aria-label*="Current Position"]',
      ],
      dataKey: 'currentTitle',
      priority: 6,
    },
    {
      fieldType: 'text',
      selectors: [
        'input[id*="CurrentEmployer"]',
        'input[name*="CurrentEmployer"]',
        'input[id*="Company"]',
        'input[name*="Company"]',
        'input[aria-label*="Current Employer"]',
        'input[aria-label*="Company"]',
      ],
      dataKey: 'currentCompany',
      priority: 6,
    },

    // Cover Letter / Summary
    {
      fieldType: 'textarea',
      selectors: [
        'textarea[id*="CoverLetter"]',
        'textarea[name*="CoverLetter"]',
        'textarea[id*="coverLetter"]',
        'textarea[name*="coverLetter"]',
        'textarea[aria-label*="Cover Letter"]',
        'textarea[aria-label*="Cover letter"]',
      ],
      dataKey: 'summary',
      priority: 4,
    },
    {
      fieldType: 'textarea',
      selectors: [
        'textarea[id*="Summary"]',
        'textarea[name*="Summary"]',
        'textarea[id*="summary"]',
        'textarea[aria-label*="Summary"]',
        'textarea[aria-label*="About"]',
      ],
      dataKey: 'summary',
      priority: 3,
    },
  ];

  /**
   * Extract job title from Taleo page
   */
  extractJobTitle(): string | undefined {
    const selectors = [
      '.requisitionTitle',
      '.job-title',
      '.jobTitle',
      'h1.title',
      'h1[class*="title"]',
      '.contentlinepanel h1',
      'span.requisitionTitle',
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
   * Extract company name from Taleo page
   */
  extractCompany(): string | undefined {
    const selectors = [
      '.companyName',
      '.company-name',
      '.requisitionCompany',
      'span.companyName',
      '.contentlinepanel .company',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    // Try to extract from page title or URL
    const titleMatch = document.title.match(/(.+?)\s*-\s*Careers/i);
    if (titleMatch) {
      return titleMatch[1].trim();
    }

    return undefined;
  }

  /**
   * Check if this is an application form (vs job listing)
   */
  isApplicationPage(): boolean {
    // Taleo application forms typically have specific indicators
    const formIndicators = [
      'form[id*="application"]',
      'form[id*="apply"]',
      '.applicationForm',
      '.apply-form',
      '#requisitionApplyModal',
      'button[id*="submit"]',
      'input[type="submit"][value*="Apply"]',
    ];

    return formIndicators.some((selector) => document.querySelector(selector));
  }
}

export default TaleoHandler;
