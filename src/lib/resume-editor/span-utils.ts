/**
 * Span Utilities
 * Utilities for generating and parsing span IDs for Grammarly-style suggestion targeting
 */

import type { SectionType, TextSpan } from '@/types/resume-editor';

// ============================================================================
// Span ID Generation
// ============================================================================

/**
 * Generate a span ID for targeting specific text in the resume
 * Format: "{sectionType}-{itemId}-{field}-{lineIndex}"
 *
 * Examples:
 * - "summary-text" (summary section, main text)
 * - "experience-exp-1-description-0" (first bullet of experience with id "exp-1")
 * - "contact-name" (contact section, name field)
 * - "skills-0" (first skill chip)
 */
export function generateSpanId(params: {
  sectionType: SectionType;
  itemId?: string;
  field: string;
  lineIndex?: number;
}): string {
  const parts: string[] = [params.sectionType];

  if (params.itemId) {
    parts.push(params.itemId);
  }

  parts.push(params.field);

  if (params.lineIndex !== undefined) {
    parts.push(String(params.lineIndex));
  }

  return parts.join('-');
}

/**
 * Parse a span ID back into its components
 */
export function parseSpanId(spanId: string): {
  sectionType: SectionType;
  itemId?: string;
  field: string;
  lineIndex?: number;
} | null {
  const parts = spanId.split('-');

  if (parts.length < 2) {
    return null;
  }

  const sectionType = parts[0] as SectionType;

  // Simple case: section-field (e.g., "summary-text", "contact-name")
  if (parts.length === 2) {
    return {
      sectionType,
      field: parts[1],
    };
  }

  // Check if last part is a number (line index)
  const lastPart = parts[parts.length - 1];
  const hasLineIndex = /^\d+$/.test(lastPart);

  if (hasLineIndex) {
    if (parts.length === 3) {
      // section-field-lineIndex (e.g., "skills-0")
      return {
        sectionType,
        field: parts[1],
        lineIndex: parseInt(lastPart, 10),
      };
    } else {
      // section-itemId-field-lineIndex (e.g., "experience-exp-1-description-0")
      // Need to handle itemIds that may contain dashes
      const lineIndex = parseInt(lastPart, 10);
      const field = parts[parts.length - 2];
      const itemId = parts.slice(1, parts.length - 2).join('-');
      return {
        sectionType,
        itemId,
        field,
        lineIndex,
      };
    }
  } else {
    // section-itemId-field (e.g., "experience-exp-1-title")
    const field = lastPart;
    const itemId = parts.slice(1, parts.length - 1).join('-');
    return {
      sectionType,
      itemId,
      field,
    };
  }
}

// ============================================================================
// DOM Utilities
// ============================================================================

/**
 * Get DOM element by span ID
 */
export function getSpanElement(spanId: string): HTMLElement | null {
  return document.querySelector(`[data-span-id="${spanId}"]`);
}

/**
 * Scroll canvas to show the element with the given span ID
 */
export function scrollToSpan(spanId: string, options?: ScrollIntoViewOptions): void {
  const element = getSpanElement(spanId);
  if (element) {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      ...options,
    });

    // Add temporary highlight
    element.classList.add('span-highlight-flash');
    setTimeout(() => {
      element.classList.remove('span-highlight-flash');
    }, 2000);
  }
}

/**
 * Focus on an editable span element
 */
export function focusSpan(spanId: string): void {
  const element = getSpanElement(spanId);
  if (element) {
    element.focus();

    // If contentEditable, place cursor at end
    if (element.contentEditable === 'true') {
      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(element);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }
}

// ============================================================================
// Span Query Utilities
// ============================================================================

/**
 * Get all span IDs for a section
 */
export function getSpanIdsForSection(sectionType: SectionType): string[] {
  const elements = document.querySelectorAll(`[data-span-id^="${sectionType}-"]`);
  return Array.from(elements)
    .map((el) => el.getAttribute('data-span-id') || '')
    .filter(Boolean);
}

/**
 * Get all span IDs for an item within a section
 */
export function getSpanIdsForItem(sectionType: SectionType, itemId: string): string[] {
  const elements = document.querySelectorAll(`[data-span-id^="${sectionType}-${itemId}-"]`);
  return Array.from(elements)
    .map((el) => el.getAttribute('data-span-id') || '')
    .filter(Boolean);
}

/**
 * Check if a span ID belongs to a section
 */
export function isSpanInSection(spanId: string, sectionType: SectionType): boolean {
  const parsed = parseSpanId(spanId);
  return parsed?.sectionType === sectionType;
}

// ============================================================================
// Text Extraction
// ============================================================================

/**
 * Extract text content from a span element
 */
export function getSpanText(spanId: string): string {
  const element = getSpanElement(spanId);
  return element?.textContent || '';
}

/**
 * Create a TextSpan object from a span ID and element
 */
export function createTextSpan(spanId: string): TextSpan | null {
  const parsed = parseSpanId(spanId);
  if (!parsed) return null;

  const text = getSpanText(spanId);

  return {
    spanId,
    sectionType: parsed.sectionType,
    itemId: parsed.itemId,
    field: parsed.field,
    lineIndex: parsed.lineIndex,
    text,
  };
}

// ============================================================================
// Bullet Point Utilities
// ============================================================================

/**
 * Parse a description into individual bullet points
 * Handles both bullet-prefixed lines and plain text lines
 */
export function parseBulletPoints(description: string): string[] {
  if (!description) return [];

  const lines = description
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line) => {
    // Remove common bullet prefixes
    return line.replace(/^[•\-\*]\s*/, '');
  });
}

/**
 * Convert bullet points array back to description string
 */
export function bulletPointsToDescription(bullets: string[]): string {
  return bullets.map((bullet) => `• ${bullet}`).join('\n');
}

/**
 * Generate span IDs for all bullets in an experience description
 */
export function generateBulletSpanIds(
  sectionType: SectionType,
  itemId: string,
  description: string,
): string[] {
  const bullets = parseBulletPoints(description);
  return bullets.map((_, index) =>
    generateSpanId({
      sectionType,
      itemId,
      field: 'description',
      lineIndex: index,
    }),
  );
}
