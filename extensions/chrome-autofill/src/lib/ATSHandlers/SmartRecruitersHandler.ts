/**
 * SmartRecruiters ATS Handler
 *
 * Handles form filling for SmartRecruiters job applications.
 * Modern cloud-based ATS used by many tech companies.
 */

import { BaseATSHandler } from './BaseATSHandler';
import type { FieldMapping, ATSPlatform } from '~/types';

export class SmartRecruitersHandler extends BaseATSHandler {
  readonly platformName: ATSPlatform = 'smartrecruiters';
  readonly displayName = 'SmartRecruiters';

  readonly urlPatterns = [
    /jobs\.smartrecruiters\.com/i,
    /smartrecruiters\.com/i,
    /\.smartrecruiters\.com/i,
  ];

  readonly fieldMappings: FieldMapping[] = [
    // SmartRecruiters uses specific form patterns
    {
      fieldType: 'text',
      selectors: [
        'input[name="firstName"]',
        'input[id="firstName"]',
        'input[data-test="first-name-input"]',
        'input[placeholder*="First Name"]',
        'input[placeholder*="First name"]',
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
        'input[name="lastName"]',
        'input[id="lastName"]',
        'input[data-test="last-name-input"]',
        'input[placeholder*="Last Name"]',
        'input[placeholder*="Last name"]',
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
        'input[name="email"]',
        'input[id="email"]',
        'input[data-test="email-input"]',
        'input[type="email"]',
        'input[placeholder*="Email"]',
        'input[aria-label*="Email"]',
      ],
      dataKey: 'email',
      priority: 10,
      required: true,
    },
    {
      fieldType: 'phone',
      selectors: [
        'input[name="phoneNumber"]',
        'input[name="phone"]',
        'input[id="phoneNumber"]',
        'input[id="phone"]',
        'input[data-test="phone-input"]',
        'input[type="tel"]',
        'input[placeholder*="Phone"]',
        'input[aria-label*="Phone"]',
      ],
      dataKey: 'phone',
      priority: 9,
    },

    // Location
    {
      fieldType: 'text',
      selectors: [
        'input[name="location"]',
        'input[id="location"]',
        'input[name="currentLocation"]',
        'input[data-test="location-input"]',
        'input[placeholder*="Location"]',
        'input[placeholder*="City"]',
        'input[aria-label*="Location"]',
        'input[aria-label*="City"]',
      ],
      dataKey: 'location',
      priority: 7,
    },

    // Professional Links
    {
      fieldType: 'url',
      selectors: [
        'input[name="linkedinUrl"]',
        'input[name="linkedin"]',
        'input[id="linkedinUrl"]',
        'input[id="linkedin"]',
        'input[data-test="linkedin-input"]',
        'input[placeholder*="LinkedIn"]',
        'input[aria-label*="LinkedIn"]',
      ],
      dataKey: 'linkedin',
      priority: 5,
    },
    {
      fieldType: 'url',
      selectors: [
        'input[name="website"]',
        'input[name="portfolioUrl"]',
        'input[id="website"]',
        'input[id="portfolioUrl"]',
        'input[data-test="website-input"]',
        'input[placeholder*="Website"]',
        'input[placeholder*="Portfolio"]',
        'input[aria-label*="Website"]',
        'input[aria-label*="Portfolio"]',
      ],
      dataKey: 'website',
      priority: 4,
    },
    {
      fieldType: 'url',
      selectors: [
        'input[name="github"]',
        'input[name="githubUrl"]',
        'input[id="github"]',
        'input[id="githubUrl"]',
        'input[placeholder*="GitHub"]',
        'input[aria-label*="GitHub"]',
      ],
      dataKey: 'github',
      priority: 4,
    },

    // Current Employment
    {
      fieldType: 'text',
      selectors: [
        'input[name="currentTitle"]',
        'input[name="jobTitle"]',
        'input[name="currentPosition"]',
        'input[id="currentTitle"]',
        'input[id="jobTitle"]',
        'input[data-test="current-title-input"]',
        'input[placeholder*="Current Title"]',
        'input[placeholder*="Job Title"]',
        'input[aria-label*="Current Title"]',
        'input[aria-label*="Job Title"]',
      ],
      dataKey: 'currentTitle',
      priority: 6,
    },
    {
      fieldType: 'text',
      selectors: [
        'input[name="currentCompany"]',
        'input[name="currentEmployer"]',
        'input[name="company"]',
        'input[id="currentCompany"]',
        'input[id="company"]',
        'input[data-test="current-company-input"]',
        'input[placeholder*="Current Company"]',
        'input[placeholder*="Employer"]',
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
        'textarea[name="coverLetter"]',
        'textarea[id="coverLetter"]',
        'textarea[data-test="cover-letter-input"]',
        'textarea[placeholder*="Cover Letter"]',
        'textarea[placeholder*="Cover letter"]',
        'textarea[aria-label*="Cover Letter"]',
        'textarea[aria-label*="Cover letter"]',
      ],
      dataKey: 'summary',
      priority: 4,
    },
    {
      fieldType: 'textarea',
      selectors: [
        'textarea[name="summary"]',
        'textarea[name="about"]',
        'textarea[id="summary"]',
        'textarea[data-test="summary-input"]',
        'textarea[placeholder*="Summary"]',
        'textarea[placeholder*="Tell us about yourself"]',
        'textarea[aria-label*="Summary"]',
        'textarea[aria-label*="About"]',
      ],
      dataKey: 'summary',
      priority: 3,
    },

    // Address Fields
    {
      fieldType: 'text',
      selectors: [
        'input[name="address"]',
        'input[name="streetAddress"]',
        'input[id="address"]',
        'input[data-test="address-input"]',
        'input[placeholder*="Address"]',
        'input[placeholder*="Street"]',
        'input[aria-label*="Address"]',
        'input[aria-label*="Street"]',
      ],
      dataKey: 'streetAddress',
      priority: 6,
    },
    {
      fieldType: 'text',
      selectors: [
        'input[name="state"]',
        'input[id="state"]',
        'select[name="state"]',
        'input[data-test="state-input"]',
        'input[placeholder*="State"]',
        'input[aria-label*="State"]',
        'input[aria-label*="Province"]',
      ],
      dataKey: 'state',
      priority: 6,
    },
    {
      fieldType: 'text',
      selectors: [
        'input[name="zipCode"]',
        'input[name="postalCode"]',
        'input[id="zipCode"]',
        'input[data-test="zip-input"]',
        'input[placeholder*="Zip"]',
        'input[placeholder*="Postal"]',
        'input[aria-label*="Zip"]',
        'input[aria-label*="Postal"]',
      ],
      dataKey: 'zipCode',
      priority: 6,
    },
    {
      fieldType: 'text',
      selectors: [
        'input[name="country"]',
        'input[id="country"]',
        'select[name="country"]',
        'input[data-test="country-input"]',
        'input[placeholder*="Country"]',
        'input[aria-label*="Country"]',
      ],
      dataKey: 'country',
      priority: 6,
    },

    // Work Authorization
    {
      fieldType: 'text',
      selectors: [
        'input[name="workAuthorization"]',
        'input[name="authorized"]',
        'input[id="workAuthorization"]',
        'select[name="workAuthorization"]',
        'input[data-test="work-authorization-input"]',
        'input[placeholder*="authorized"]',
        'input[aria-label*="authorized to work"]',
        'input[aria-label*="work authorization"]',
      ],
      dataKey: 'workAuthorization',
      priority: 8,
    },
    {
      fieldType: 'text',
      selectors: [
        'input[name="sponsorship"]',
        'input[name="visaSponsorship"]',
        'input[id="sponsorship"]',
        'select[name="sponsorship"]',
        'input[data-test="sponsorship-input"]',
        'input[placeholder*="sponsorship"]',
        'input[aria-label*="sponsorship"]',
        'input[aria-label*="visa"]',
      ],
      dataKey: 'sponsorshipRequired',
      priority: 8,
    },

    // Years of Experience
    {
      fieldType: 'text',
      selectors: [
        'input[name="yearsOfExperience"]',
        'input[name="experience"]',
        'input[id="yearsOfExperience"]',
        'select[name="experience"]',
        'input[data-test="experience-input"]',
        'input[placeholder*="years of experience"]',
        'input[aria-label*="years of experience"]',
        'input[aria-label*="total experience"]',
      ],
      dataKey: 'yearsOfExperience',
      priority: 7,
    },

    // Salary & Availability
    {
      fieldType: 'text',
      selectors: [
        'input[name="salary"]',
        'input[name="expectedSalary"]',
        'input[id="salary"]',
        'input[data-test="salary-input"]',
        'input[placeholder*="Salary"]',
        'input[placeholder*="salary"]',
        'input[aria-label*="Salary"]',
        'input[aria-label*="Compensation"]',
      ],
      dataKey: 'desiredSalary',
      priority: 5,
    },
    {
      fieldType: 'text',
      selectors: [
        'input[name="startDate"]',
        'input[name="availability"]',
        'input[id="startDate"]',
        'input[data-test="start-date-input"]',
        'input[placeholder*="start date"]',
        'input[placeholder*="Start date"]',
        'input[aria-label*="Start Date"]',
        'input[aria-label*="Available"]',
      ],
      dataKey: 'availableStartDate',
      priority: 5,
    },
  ];

  /**
   * Extract job title from SmartRecruiters page
   */
  extractJobTitle(): string | undefined {
    const selectors = [
      '.job-title',
      '.jobTitle',
      'h1.title',
      '[data-test="job-title"]',
      'h1[class*="JobTitle"]',
      '.sr-job-title',
      '.posting-headline h1',
      'h1.job-title',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const text = element?.textContent?.trim();
      if (text && text.length < 100) {
        return text;
      }
    }

    // Check for JSON-LD structured data
    const jsonLd = document.querySelector('script[type="application/ld+json"]');
    if (jsonLd) {
      try {
        const data = JSON.parse(jsonLd.textContent || '{}');
        if (data.title) {
          return data.title;
        }
      } catch {
        // Ignore parsing errors
      }
    }

    return undefined;
  }

  /**
   * Extract company name from SmartRecruiters page
   */
  extractCompany(): string | undefined {
    const selectors = [
      '.company-name',
      '.companyName',
      '[data-test="company-name"]',
      '.sr-company-name',
      '.posting-headline .company',
      '[class*="CompanyName"]',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    // Try to extract from URL
    const urlMatch = window.location.pathname.match(/\/([^/]+)\/[^/]+$/);
    if (urlMatch) {
      return urlMatch[1].replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    }

    // Check for JSON-LD structured data
    const jsonLd = document.querySelector('script[type="application/ld+json"]');
    if (jsonLd) {
      try {
        const data = JSON.parse(jsonLd.textContent || '{}');
        if (data.hiringOrganization?.name) {
          return data.hiringOrganization.name;
        }
      } catch {
        // Ignore parsing errors
      }
    }

    return undefined;
  }

  /**
   * Check if this is an application form
   */
  isApplicationPage(): boolean {
    const formIndicators = [
      '[data-test="apply-form"]',
      '.apply-form',
      '.application-form',
      'form[name="application"]',
      '#apply-form',
      '.sr-apply-form',
      'button[data-test="submit-application"]',
    ];

    return formIndicators.some((selector) => document.querySelector(selector));
  }

  /**
   * SmartRecruiters often uses React, need special handling
   */
  async fillTextInput(input: HTMLInputElement, value: string): Promise<void> {
    // SmartRecruiters uses React, need to dispatch proper events
    input.focus();

    // Use native setter to bypass React's controlled components
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, value);
    } else {
      input.value = value;
    }

    // Dispatch events for React
    input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

    input.blur();
  }
}

export default SmartRecruitersHandler;
