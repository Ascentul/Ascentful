import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Validates that a URL uses a safe protocol (http/https only).
 * Prevents javascript:, data:, and other potentially malicious URL schemes.
 */
export function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Simple HTML entity escaping for text interpolation.
 * Lightweight alternative to full sanitization when you just need
 * to safely embed plain text in HTML contexts (e.g., email templates).
 *
 * Escapes: & < > " '
 *
 * NOTE: Intentionally duplicated in convex/lib/sanitizeHtml.ts for server-side use.
 * Convex runtime isolation prevents sharing code between environments.
 * Keep implementations in sync if changes are needed.
 *
 * @param text - Plain text to escape
 * @returns HTML-safe string with entities escaped
 */
export function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
