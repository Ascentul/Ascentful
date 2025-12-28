// Shared Convex ID validation utilities (Crockford Base32: 0-9, A-H, J-N, P-T, V-Z; excludes I, L, O, U)
// Convex IDs are typically 24+ characters, so we reject short strings like "new"
export const CONVEX_ID_REGEX = /^[0-9A-HJ-NP-TV-Z]+$/i;
const MIN_CONVEX_ID_LENGTH = 20;

export function isValidConvexId(id: string | null | undefined): id is string {
  return typeof id === 'string' && id.length >= MIN_CONVEX_ID_LENGTH && CONVEX_ID_REGEX.test(id);
}
