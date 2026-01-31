/**
 * HTML Sanitization Utility
 *
 * Provides safe HTML rendering by sanitizing user-generated content
 * to prevent XSS attacks.
 */

import sanitizeHtml from 'sanitize-html';

/**
 * Default options for sanitizing user-generated HTML content.
 * Allows basic formatting but strips dangerous elements and attributes.
 */
const defaultOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    'b',
    'i',
    'em',
    'strong',
    'a',
    'p',
    'br',
    'ul',
    'ol',
    'li',
    'blockquote',
    'code',
    'pre',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  // Force safe link attributes
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        target: '_blank',
        rel: 'noopener noreferrer',
      },
    }),
  },
};

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Use this before rendering any user-generated HTML with dangerouslySetInnerHTML.
 *
 * @param dirty - The potentially unsafe HTML string
 * @param options - Optional custom sanitization options
 * @returns Sanitized HTML string safe for rendering
 */
export function sanitizeUserHtml(
  dirty: string | undefined | null,
  options?: sanitizeHtml.IOptions,
): string {
  if (!dirty) return '';
  // Merge custom options with defaults, ensuring transformTags is always applied
  const mergedOptions: sanitizeHtml.IOptions = options
    ? {
        ...defaultOptions,
        ...options,
        allowedAttributes: {
          ...((defaultOptions.allowedAttributes &&
          typeof defaultOptions.allowedAttributes === 'object'
            ? defaultOptions.allowedAttributes
            : {}) as Record<string, string[]>),
          ...((options.allowedAttributes && typeof options.allowedAttributes === 'object'
            ? options.allowedAttributes
            : {}) as Record<string, string[]>),
          // Ensure anchor security attributes are always allowed
          a: [
            ...new Set([
              ...((
                (defaultOptions.allowedAttributes &&
                typeof defaultOptions.allowedAttributes === 'object'
                  ? defaultOptions.allowedAttributes
                  : {}) as Record<string, string[]>
              ).a || []),
              ...((
                (options.allowedAttributes && typeof options.allowedAttributes === 'object'
                  ? options.allowedAttributes
                  : {}) as Record<string, string[]>
              ).a || []),
            ]),
          ],
        },
        transformTags: {
          ...options.transformTags,
          // Enforce safe link behavior by applying default 'a' transform last
          a: defaultOptions.transformTags!.a,
        },
      }
    : defaultOptions;
  return sanitizeHtml(dirty, mergedOptions);
}
