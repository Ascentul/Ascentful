/**
 * BaseATSHandler
 *
 * Abstract base class for all ATS (Applicant Tracking System) handlers.
 * Each ATS platform extends this class with platform-specific selectors and logic.
 */

import type {
  ATSPlatform,
  ATSDetectionResult,
  FieldMapping,
  FillResult,
  FieldFillResult,
} from '~/types';
import type { AutofillData } from '~/store/profileStore';

export abstract class BaseATSHandler {
  abstract readonly platformName: ATSPlatform;
  abstract readonly displayName: string;
  abstract readonly urlPatterns: RegExp[];
  abstract readonly fieldMappings: FieldMapping[];

  /**
   * Detect if this handler should be used for the current page
   */
  detect(): ATSDetectionResult {
    const url = window.location.href;

    for (const pattern of this.urlPatterns) {
      if (pattern.test(url)) {
        const jobTitle = this.extractJobTitle();
        const company = this.extractCompany();

        return {
          detected: true,
          platform: this.platformName,
          confidence: 0.9,
          jobTitle,
          company,
          jobUrl: url,
        };
      }
    }

    return {
      detected: false,
      platform: 'unknown',
      confidence: 0,
    };
  }

  /**
   * Extract job title from the page (override in subclass)
   */
  extractJobTitle(): string | undefined {
    // Common selectors for job titles
    const selectors = [
      'h1',
      '.job-title',
      '[data-testid="job-title"]',
      '.posting-headline h1',
      '.app-title',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    return undefined;
  }

  /**
   * Extract company name from the page (override in subclass)
   */
  extractCompany(): string | undefined {
    // Common selectors for company names
    const selectors = ['.company-name', '[data-testid="company-name"]', '.posting-company'];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    return undefined;
  }

  /**
   * Fill the application form with the provided data
   */
  async fillForm(data: AutofillData): Promise<FillResult> {
    const results: FieldFillResult[] = [];
    const errors: string[] = [];

    // Sort field mappings by priority (higher first)
    const sortedMappings = [...this.fieldMappings].sort(
      (a, b) => (b.priority || 0) - (a.priority || 0),
    );

    for (const mapping of sortedMappings) {
      try {
        const result = await this.fillField(mapping, data);
        results.push(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${mapping.dataKey}: ${errorMessage}`);
        results.push({
          fieldKey: mapping.dataKey,
          success: false,
          skipped: false,
          error: errorMessage,
        });
      }
    }

    return {
      platform: this.platformName,
      totalFields: results.length,
      filledFields: results.filter((r) => r.success).length,
      skippedFields: results.filter((r) => r.skipped).length,
      errors,
      jobDetails: {
        company: this.extractCompany(),
        jobTitle: this.extractJobTitle(),
        url: window.location.href,
      },
    };
  }

  /**
   * Fill a single field based on its mapping
   */
  protected async fillField(mapping: FieldMapping, data: AutofillData): Promise<FieldFillResult> {
    // Find the element using selectors
    let element: HTMLElement | null = null;

    for (const selector of mapping.selectors) {
      element = document.querySelector(selector);
      if (element) break;
    }

    if (!element) {
      return { fieldKey: mapping.dataKey, success: false, skipped: true };
    }

    // Get the value from data using dot notation
    const value = this.getNestedValue(data, mapping.dataKey);

    if (!value && !mapping.required) {
      return { fieldKey: mapping.dataKey, success: false, skipped: true };
    }

    // Apply transform if provided
    const transformedValue = mapping.transform ? mapping.transform(value) : String(value || '');

    // Skip if no value after transform
    if (!transformedValue) {
      return { fieldKey: mapping.dataKey, success: false, skipped: true };
    }

    // Fill based on field type
    switch (mapping.fieldType) {
      case 'text':
      case 'email':
      case 'phone':
        await this.fillTextInput(element as HTMLInputElement, transformedValue);
        break;

      case 'textarea':
        await this.fillTextarea(element as HTMLTextAreaElement, transformedValue);
        break;

      case 'select':
        await this.fillSelect(element as HTMLSelectElement, transformedValue);
        break;

      case 'date':
        await this.fillDateInput(element as HTMLInputElement, transformedValue);
        break;

      default:
        await this.fillTextInput(element as HTMLInputElement, transformedValue);
    }

    return { fieldKey: mapping.dataKey, success: true, skipped: false };
  }

  /**
   * Fill a text input - handles React/Vue controlled components
   */
  protected async fillTextInput(input: HTMLInputElement, value: string): Promise<void> {
    // Scroll into view
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.delay(100);

    // Focus the input
    input.focus();

    // Clear existing value
    input.value = '';

    // Use native setter to bypass React's controlled input
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, value);
    } else {
      input.value = value;
    }

    // Dispatch events for React/Vue compatibility
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    // Blur to trigger validation
    await this.delay(50);
    input.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  /**
   * Fill a textarea - handles React/Vue controlled components
   */
  protected async fillTextarea(textarea: HTMLTextAreaElement, value: string): Promise<void> {
    textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.delay(100);

    textarea.focus();
    textarea.value = '';

    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )?.set;

    if (nativeTextAreaValueSetter) {
      nativeTextAreaValueSetter.call(textarea, value);
    } else {
      textarea.value = value;
    }

    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));

    await this.delay(50);
    textarea.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  /**
   * Fill a select dropdown
   */
  protected async fillSelect(select: HTMLSelectElement, value: string): Promise<void> {
    select.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.delay(100);

    // Find matching option (case-insensitive, partial match)
    const options = Array.from(select.options);
    const matchingOption = options.find(
      (opt) =>
        opt.value.toLowerCase() === value.toLowerCase() ||
        opt.text.toLowerCase() === value.toLowerCase() ||
        opt.text.toLowerCase().includes(value.toLowerCase()) ||
        opt.value.toLowerCase().includes(value.toLowerCase()),
    );

    if (matchingOption) {
      select.value = matchingOption.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  /**
   * Fill a date input
   */
  protected async fillDateInput(input: HTMLInputElement, value: string): Promise<void> {
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.delay(100);

    // Ensure date is in YYYY-MM-DD format
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * Get a nested value from an object using dot notation
   */
  protected getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  /**
   * Utility delay function
   */
  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Handle custom dropdowns (React Select, etc.) - override in subclass if needed
   */
  protected async fillCustomDropdown(element: HTMLElement, value: string): Promise<void> {
    // Default implementation - can be overridden
    element.click();
    await this.delay(200);

    // Look for an input in the dropdown
    const searchInput = element.querySelector('input') as HTMLInputElement;
    if (searchInput) {
      await this.fillTextInput(searchInput, value);
      await this.delay(200);

      // Click first option
      const option = document.querySelector('[class*="option"]');
      if (option) {
        (option as HTMLElement).click();
      }
    }
  }
}

export default BaseATSHandler;
