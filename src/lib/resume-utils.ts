/**
 * Shared utility functions for resume formatting and processing
 */

/**
 * Formats a date range for display on resumes
 * @param startDate - The start date string
 * @param endDate - The end date string
 * @param current - Whether this is a current position/education
 * @returns Formatted date range string
 */
export function formatDateRange(startDate: string, endDate: string, current: boolean): string {
  if (current) return `${startDate} - Present`;
  return `${startDate} - ${endDate}`;
}

/**
 * Parses a description string into bullet points
 * Splits by newlines or bullet point characters and filters empty lines
 * @param description - The description text to parse (string or array)
 * @returns Array of parsed description lines
 */
export function parseDescription(description: string | string[]): string[] {
  if (!description) return [];

  // If already an array, return it cleaned up
  if (Array.isArray(description)) {
    return description
      .map((line) => (typeof line === 'string' ? line.trim() : String(line).trim()))
      .filter((line) => line.length > 0);
  }

  // Handle non-string values by converting to string
  const descriptionStr = typeof description === 'string' ? description : String(description);

  const lines = descriptionStr
    .split(/\n|•/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines;
}

/**
 * Parses a freeform description into structured summary and key contributions
 * - Text before any bullet points becomes the summary
 * - Lines starting with •, -, * become key contributions
 * - Inline bullets (e.g., "Summary • bullet1 • bullet2") are normalized to line-start format
 * - Non-bullet text after bullets is treated as additional contributions (legacy migration)
 *
 * @param description - The freeform description text to parse
 * @returns Object with summary and keyContributions array
 */
export function parseDescriptionToStructured(description: string): {
  summary: string;
  keyContributions: string[];
} {
  if (!description?.trim()) {
    return { summary: '', keyContributions: [] };
  }

  // Normalize inline bullets into newline-start bullets to support legacy "… • … • …" strings
  // Also handle inline - and * bullets for robustness (e.g., "text - bullet1 - bullet2")
  const normalized = description
    .replace(/•/g, '\n•')
    .replace(/\s-\s/g, '\n- ')
    .replace(/\s\*\s/g, '\n* ');
  const lines = normalized.split('\n');
  const summaryLines: string[] = [];
  const bullets: string[] = [];
  let foundBullet = false;

  for (const line of lines) {
    const trimmed = line.trim();
    // Check if line starts with a bullet character
    if (/^[•\-\*]/.test(trimmed)) {
      foundBullet = true;
      // Clean the bullet and add to keyContributions
      const cleanBullet = trimmed.replace(/^[•\-\*]\s*/, '').trim();
      if (cleanBullet) {
        bullets.push(cleanBullet);
      }
    } else if (!foundBullet && trimmed) {
      // Before we see any bullets, collect as summary
      summaryLines.push(trimmed);
    } else if (foundBullet && trimmed) {
      // After bullets start, if we see non-bullet text, treat it as continuation
      // or additional bullet (user typed without bullet char)
      bullets.push(trimmed);
    }
  }

  return {
    // Preserve original line breaks (closer to true round-trip behavior)
    summary: summaryLines.join('\n'),
    keyContributions: bullets,
  };
}

/**
 * Converts structured format (summary + keyContributions) back to description string
 * Inverse of parseDescriptionToStructured - ensures round-trip compatibility
 *
 * @param summary - The summary/overview text
 * @param keyContributions - Array of bullet point contributions
 * @returns Formatted description string with summary followed by bulleted contributions
 */
export function structuredToDescription(summary: string, keyContributions: string[]): string {
  const parts: string[] = [];
  if (summary?.trim()) {
    parts.push(summary.trim());
  }
  if (keyContributions && keyContributions.length > 0) {
    if (parts.length > 0) parts.push(''); // Add blank line between summary and bullets
    for (const bullet of keyContributions) {
      const cleaned = bullet
        .trim()
        .replace(/^[•\-*]\s*/, '')
        .trim();
      if (cleaned) {
        parts.push(`• ${cleaned}`);
      }
    }
  }
  return parts.join('\n');
}
