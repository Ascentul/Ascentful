/**
 * Lever ATS Handler
 *
 * Handles form filling for Lever job applications.
 * Popular with mid-size tech companies.
 */

import { BaseATSHandler } from './BaseATSHandler';
import type { FieldMapping, ATSPlatform } from '~/types';

export class LeverHandler extends BaseATSHandler {
  readonly platformName: ATSPlatform = 'lever';
  readonly displayName = 'Lever';

  readonly urlPatterns = [
    /jobs\.lever\.co/i,
    /lever\.co\/.*\/apply/i,
  ];

  readonly fieldMappings: FieldMapping[] = [
    // Lever uses unique field names
    {
      fieldType: 'text',
      selectors: [
        'input[name="name"]',
        '#name',
        'input[placeholder*="Full name"]',
      ],
      dataKey: 'fullName',
      priority: 10,
      required: true,
    },
    {
      fieldType: 'email',
      selectors: [
        'input[name="email"]',
        '#email',
        'input[type="email"]',
        'input[placeholder*="Email"]',
      ],
      dataKey: 'email',
      priority: 10,
      required: true,
    },
    {
      fieldType: 'phone',
      selectors: [
        'input[name="phone"]',
        '#phone',
        'input[type="tel"]',
        'input[placeholder*="Phone"]',
      ],
      dataKey: 'phone',
      priority: 9,
    },

    // Organization / Company
    {
      fieldType: 'text',
      selectors: [
        'input[name="org"]',
        'input[name="organization"]',
        '#org',
        'input[placeholder*="Current company"]',
        'input[placeholder*="Organization"]',
      ],
      dataKey: 'currentCompany',
      priority: 8,
    },

    // URLs Section - Lever has specific URL fields
    {
      fieldType: 'text',
      selectors: [
        'input[name="urls[LinkedIn]"]',
        'input[name*="linkedin"]',
        'input[placeholder*="LinkedIn"]',
        'input[placeholder*="linkedin.com"]',
      ],
      dataKey: 'linkedin',
      priority: 8,
    },
    {
      fieldType: 'text',
      selectors: [
        'input[name="urls[GitHub]"]',
        'input[name*="github"]',
        'input[placeholder*="GitHub"]',
        'input[placeholder*="github.com"]',
      ],
      dataKey: 'github',
      priority: 8,
    },
    {
      fieldType: 'text',
      selectors: [
        'input[name="urls[Portfolio]"]',
        'input[name*="portfolio"]',
        'input[placeholder*="Portfolio"]',
      ],
      dataKey: 'website',
      priority: 7,
    },
    {
      fieldType: 'text',
      selectors: [
        'input[name="urls[Twitter]"]',
        'input[name="urls[Other]"]',
        'input[name*="website"]',
        'input[placeholder*="Website"]',
      ],
      dataKey: 'website',
      priority: 6,
    },

    // Location
    {
      fieldType: 'text',
      selectors: [
        'input[name="location"]',
        '#location',
        'input[placeholder*="Location"]',
        'input[placeholder*="City"]',
      ],
      dataKey: 'location',
      priority: 7,
    },

    // Additional Info / Comments
    {
      fieldType: 'textarea',
      selectors: [
        'textarea[name="comments"]',
        '#comments',
        'textarea[placeholder*="Additional"]',
        'textarea[placeholder*="notes"]',
      ],
      dataKey: 'summary',
      priority: 4,
    },
  ];

  /**
   * Extract job title from Lever page
   */
  extractJobTitle(): string | undefined {
    const selectors = [
      '.posting-headline h2',
      '.posting-title',
      'h1.posting-headline',
      '.content h1',
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
   * Extract company name from Lever page
   */
  extractCompany(): string | undefined {
    const selectors = [
      '.posting-company',
      '.main-header-text h1',
      '.posting-company-name',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    // Fallback: extract from URL
    const match = window.location.pathname.match(/\/([^\/]+)\//);
    if (match) {
      return match[1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }

    return undefined;
  }
}

export default LeverHandler;
