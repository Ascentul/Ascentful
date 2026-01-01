/**
 * LinkedIn ATS Handler
 *
 * Handles form filling for LinkedIn Easy Apply and regular applications.
 * Highest volume job application platform.
 */

import { BaseATSHandler } from './BaseATSHandler';
import type { FieldMapping, ATSPlatform } from '~/types';

export class LinkedInHandler extends BaseATSHandler {
  readonly platformName: ATSPlatform = 'linkedin';
  readonly displayName = 'LinkedIn';

  readonly urlPatterns = [
    /linkedin\.com\/jobs\/view/i,
    /linkedin\.com\/jobs\/collections/i,
    /linkedin\.com\/jobs\/search/i,
  ];

  readonly fieldMappings: FieldMapping[] = [
    // LinkedIn Easy Apply uses specific class names and IDs
    {
      fieldType: 'text',
      selectors: [
        'input[name*="firstName"]',
        'input[id*="firstName"]',
        '[data-test-single-line-text-form-component] input',
        '.jobs-easy-apply-form-section__grouping input[aria-label*="First"]',
      ],
      dataKey: 'firstName',
      priority: 10,
    },
    {
      fieldType: 'text',
      selectors: [
        'input[name*="lastName"]',
        'input[id*="lastName"]',
        '.jobs-easy-apply-form-section__grouping input[aria-label*="Last"]',
      ],
      dataKey: 'lastName',
      priority: 10,
    },
    {
      fieldType: 'email',
      selectors: [
        'input[name*="email"]',
        'input[id*="email"]',
        'input[type="email"]',
        '.jobs-easy-apply-form-section__grouping input[aria-label*="Email"]',
      ],
      dataKey: 'email',
      priority: 10,
    },
    {
      fieldType: 'phone',
      selectors: [
        'input[name*="phone"]',
        'input[id*="phone"]',
        'input[type="tel"]',
        '.jobs-easy-apply-form-section__grouping input[aria-label*="Phone"]',
        'input[aria-label*="Mobile"]',
      ],
      dataKey: 'phone',
      priority: 9,
    },

    // Location / City
    {
      fieldType: 'text',
      selectors: [
        'input[name*="city"]',
        'input[id*="city"]',
        'input[aria-label*="City"]',
        'input[aria-label*="Location"]',
        '[data-test-single-typeahead-entity-form-component] input',
      ],
      dataKey: 'city',
      priority: 7,
    },

    // Current/Most Recent Title
    {
      fieldType: 'text',
      selectors: [
        'input[aria-label*="Title"]',
        'input[aria-label*="Position"]',
        'input[name*="title"]',
      ],
      dataKey: 'currentTitle',
      priority: 6,
    },

    // Company
    {
      fieldType: 'text',
      selectors: [
        'input[aria-label*="Company"]',
        'input[aria-label*="Employer"]',
        'input[name*="company"]',
      ],
      dataKey: 'currentCompany',
      priority: 6,
    },

    // School/University
    {
      fieldType: 'text',
      selectors: [
        'input[aria-label*="School"]',
        'input[aria-label*="University"]',
        'input[name*="school"]',
      ],
      dataKey: 'school',
      priority: 5,
    },

    // Degree
    {
      fieldType: 'text',
      selectors: [
        'input[aria-label*="Degree"]',
        'input[name*="degree"]',
        'select[aria-label*="Degree"]',
      ],
      dataKey: 'degree',
      priority: 5,
    },

    // Summary / Cover Letter
    {
      fieldType: 'textarea',
      selectors: [
        'textarea[aria-label*="Summary"]',
        'textarea[aria-label*="Cover"]',
        'textarea[name*="summary"]',
        'textarea[name*="coverLetter"]',
        '.jobs-easy-apply-form-section__grouping textarea',
      ],
      dataKey: 'summary',
      priority: 4,
    },

    // LinkedIn URL (sometimes asked)
    {
      fieldType: 'text',
      selectors: [
        'input[aria-label*="LinkedIn"]',
        'input[name*="linkedin"]',
      ],
      dataKey: 'linkedin',
      priority: 7,
    },

    // Portfolio/Website
    {
      fieldType: 'text',
      selectors: [
        'input[aria-label*="Website"]',
        'input[aria-label*="Portfolio"]',
        'input[name*="website"]',
        'input[name*="portfolio"]',
      ],
      dataKey: 'website',
      priority: 6,
    },

    // Address Fields
    {
      fieldType: 'text',
      selectors: [
        'input[aria-label*="Address"]',
        'input[aria-label*="Street"]',
        'input[name*="address"]',
        'input[name*="street"]',
      ],
      dataKey: 'streetAddress',
      priority: 6,
    },
    {
      fieldType: 'text',
      selectors: [
        'input[aria-label*="State"]',
        'input[aria-label*="Province"]',
        'input[name*="state"]',
        'select[name*="state"]',
      ],
      dataKey: 'state',
      priority: 6,
    },
    {
      fieldType: 'text',
      selectors: [
        'input[aria-label*="Zip"]',
        'input[aria-label*="Postal"]',
        'input[name*="zip"]',
        'input[name*="postal"]',
      ],
      dataKey: 'zipCode',
      priority: 6,
    },
    {
      fieldType: 'text',
      selectors: [
        'input[aria-label*="Country"]',
        'input[name*="country"]',
        'select[name*="country"]',
      ],
      dataKey: 'country',
      priority: 6,
    },

    // Work Authorization
    {
      fieldType: 'text',
      selectors: [
        'input[aria-label*="authorized to work"]',
        'input[aria-label*="work authorization"]',
        'input[name*="authorized"]',
        'select[name*="authorized"]',
      ],
      dataKey: 'workAuthorization',
      priority: 8,
    },
    {
      fieldType: 'text',
      selectors: [
        'input[aria-label*="sponsorship"]',
        'input[aria-label*="visa"]',
        'input[name*="sponsorship"]',
        'select[name*="sponsorship"]',
      ],
      dataKey: 'sponsorshipRequired',
      priority: 8,
    },

    // Years of Experience
    {
      fieldType: 'text',
      selectors: [
        'input[aria-label*="years of experience"]',
        'input[aria-label*="experience"]',
        'input[name*="experience"]',
        'select[aria-label*="experience"]',
      ],
      dataKey: 'yearsOfExperience',
      priority: 7,
    },

    // Salary & Availability
    {
      fieldType: 'text',
      selectors: [
        'input[aria-label*="salary"]',
        'input[aria-label*="compensation"]',
        'input[name*="salary"]',
      ],
      dataKey: 'desiredSalary',
      priority: 5,
    },
    {
      fieldType: 'text',
      selectors: [
        'input[aria-label*="start date"]',
        'input[aria-label*="available"]',
        'input[name*="start"]',
        'input[name*="availability"]',
      ],
      dataKey: 'availableStartDate',
      priority: 5,
    },
  ];

  /**
   * Extract job title from LinkedIn page
   */
  extractJobTitle(): string | undefined {
    const selectors = [
      '.job-details-jobs-unified-top-card__job-title',
      '.jobs-unified-top-card__job-title',
      'h1.t-24',
      'h1.jobs-unified-top-card__job-title',
      '.jobs-details-top-card__job-title',
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
   * Extract company name from LinkedIn page
   */
  extractCompany(): string | undefined {
    const selectors = [
      '.job-details-jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__subtitle-primary-grouping a',
      '.jobs-details-top-card__company-url',
      'a.ember-view[href*="/company/"]',
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
   * Override to handle LinkedIn's dynamic form loading
   */
  async fillForm(data: any) {
    // Wait for Easy Apply modal if present
    await this.delay(500);

    // Check if in Easy Apply modal
    const easyApplyModal = document.querySelector('.jobs-easy-apply-modal');
    if (easyApplyModal) {
      console.log('[Ascentful] LinkedIn Easy Apply modal detected');
    }

    return super.fillForm(data);
  }
}

export default LinkedInHandler;
