/**
 * Convex ID validation utilities
 *
 * Convex IDs use Crockford Base32 encoding: 0-9, A-H, J-N, P-T, V-Z
 * (excludes I, L, O, U to avoid ambiguity)
 *
 * Note: Convex does not document a minimum ID length. We rely solely on
 * the character set validation. Route keywords like "new" are filtered
 * by the ROUTE_KEYWORDS set, not by length.
 */
export const CONVEX_ID_REGEX = /^[0-9A-HJ-NP-TV-Z]+$/i;

/** Common route keywords that should not be treated as Convex IDs */
const ROUTE_KEYWORDS = new Set(['new', 'edit', 'create', 'delete', 'settings', 'list']);

export function isValidConvexId(id: string | null | undefined): id is string {
  if (typeof id !== 'string' || id.length === 0) return false;
  if (ROUTE_KEYWORDS.has(id.toLowerCase())) return false;
  return CONVEX_ID_REGEX.test(id);
}
