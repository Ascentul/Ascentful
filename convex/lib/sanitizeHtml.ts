/**
 * HTML Sanitization Utility
 *
 * Provides secure HTML sanitization for user-generated content.
 * Uses sanitize-html with a strict allowlist to prevent XSS attacks.
 *
 * IMPORTANT: This is the single source of truth for HTML sanitization
 * across the codebase. All user-generated HTML content should be
 * sanitized using these functions before storage.
 */

import type { IOptions, Attributes } from 'sanitize-html';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sanitizeHtml = require('sanitize-html') as (dirty: string, options?: IOptions) => string;

/**
 * Strict sanitization options - allows NO HTML tags.
 * Use this for plain text inputs (comments, notes, etc.)
 * where HTML is not expected or desired.
 */
const STRICT_OPTIONS: IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'recursiveEscape',
};

/**
 * Basic formatting options - allows minimal safe formatting tags.
 * Use this for content that may contain basic formatting.
 */
const BASIC_FORMATTING_OPTIONS: IOptions = {
  allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
  allowedAttributes: {},
  disallowedTagsMode: 'recursiveEscape',
};

/**
 * Rich text options - allows links and more formatting.
 * Use this for content from rich text editors.
 */
const RICH_TEXT_OPTIONS: IOptions = {
  allowedTags: [
    'b',
    'i',
    'em',
    'strong',
    'p',
    'br',
    'ul',
    'ol',
    'li',
    'a',
    'h1',
    'h2',
    'h3',
    'blockquote',
    'code',
    'pre',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
  },
  allowedSchemes: ['https', 'mailto'],
  transformTags: {
    // Ensure all links open in new tab and have security attributes
    a: (_tagName: string, attribs: Attributes) => ({
      tagName: 'a',
      attribs: {
        ...attribs,
        target: '_blank',
        rel: 'noopener noreferrer',
      },
    }),
  },
  disallowedTagsMode: 'recursiveEscape',
};

/**
 * Sanitize HTML with strict mode (no HTML allowed).
 * All HTML tags are escaped and displayed as text.
 *
 * Use for: comments, notes, plain text fields
 *
 * @param html - Raw HTML string from user input
 * @returns Sanitized string with all HTML escaped
 */
export function sanitizeStrict(html: string): string {
  if (!html) return '';
  return sanitizeHtml(html.trim(), STRICT_OPTIONS);
}

/**
 * Sanitize HTML with basic formatting allowed.
 * Allows: b, i, em, strong, p, br, ul, ol, li
 *
 * Use for: formatted text that doesn't need links
 *
 * @param html - Raw HTML string from user input
 * @returns Sanitized string with only safe formatting tags
 */
export function sanitizeBasicFormatting(html: string): string {
  if (!html) return '';
  return sanitizeHtml(html.trim(), BASIC_FORMATTING_OPTIONS);
}

/**
 * Sanitize HTML with rich text formatting allowed.
 * Allows: basic formatting + links, headings, blockquote, code
 * Links are automatically made safe (https/mailto only, open in new tab)
 *
 * Use for: rich text editor content, formatted descriptions
 *
 * @param html - Raw HTML string from user input
 * @returns Sanitized string with safe rich text formatting
 */
export function sanitizeRichText(html: string): string {
  if (!html) return '';
  return sanitizeHtml(html.trim(), RICH_TEXT_OPTIONS);
}

/**
 * Sanitize comment body.
 * Since comments use a plain textarea (not a rich text editor),
 * we use strict mode to escape all HTML.
 *
 * @param body - Comment body text
 * @returns Sanitized comment body
 */
export function sanitizeCommentBody(body: string): string {
  return sanitizeStrict(body);
}
