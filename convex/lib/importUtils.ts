/**
 * Import Utilities Module
 *
 * Provides identity resolution and idempotent import utilities for CSV imports.
 * Supports:
 * - Student identity resolution by external_student_id, email, or name
 * - Idempotent upsert for graduate outcomes
 * - Import result tracking and error handling
 */

import { Id } from '../_generated/dataModel';
import { QueryCtx } from '../_generated/server';

// ============================================================================
// TYPES
// ============================================================================

export interface IdentityMatch {
  matched: boolean;
  userId?: Id<'users'>;
  studentProfileId?: Id<'studentProfiles'>;
  confidence: 'exact' | 'high' | 'low' | 'none';
  matchedBy?: 'external_id' | 'email' | 'name';
  suggestions?: Array<{
    userId: Id<'users'>;
    name: string;
    email: string;
    confidence: number;
  }>;
}

export interface IdentityResolutionInput {
  externalStudentId?: string;
  email?: string;
  name?: string;
}

export interface UpsertResult {
  action: 'created' | 'updated' | 'skipped';
  id: string;
  externalId?: string;
  error?: string;
}

export interface BulkImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{
    row: number;
    error: string;
    data?: Record<string, unknown>;
  }>;
}

// ============================================================================
// IDENTITY RESOLUTION
// ============================================================================

/**
 * Resolve a student identity from import data.
 *
 * Resolution strategy (in order of precedence):
 * 1. Match by external_student_id (university-specific ID) - Exact match
 * 2. Match by email (case-insensitive) - Exact match
 * 3. Match by name + university - Fuzzy match (returns suggestions for manual review)
 *
 * @param ctx - Convex query context
 * @param universityId - University to scope the search
 * @param input - Identity resolution input (externalStudentId, email, name)
 * @returns IdentityMatch with match result and confidence
 */
export async function resolveStudentIdentity(
  ctx: QueryCtx,
  universityId: Id<'universities'>,
  input: IdentityResolutionInput,
): Promise<IdentityMatch> {
  // 1. Try external_student_id first (most reliable)
  if (input.externalStudentId) {
    const profile = await ctx.db
      .query('studentProfiles')
      .withIndex('by_university_student_id', (q) =>
        q.eq('university_id', universityId).eq('student_id', input.externalStudentId!),
      )
      .first();

    if (profile) {
      return {
        matched: true,
        userId: profile.user_id,
        studentProfileId: profile._id,
        confidence: 'exact',
        matchedBy: 'external_id',
      };
    }
  }

  // 2. Try email match (case-insensitive)
  if (input.email) {
    const normalizedEmail = input.email.toLowerCase().trim();
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', normalizedEmail))
      .first();

    if (user && user.university_id === universityId) {
      // Get associated student profile
      const profile = await ctx.db
        .query('studentProfiles')
        .withIndex('by_user_id', (q) => q.eq('user_id', user._id))
        .first();

      return {
        matched: true,
        userId: user._id,
        studentProfileId: profile?._id,
        confidence: 'exact',
        matchedBy: 'email',
      };
    }
  }

  // 3. Try name-based fuzzy match (return suggestions for manual review)
  if (input.name) {
    const suggestions = await findUsersByNameFuzzy(ctx, universityId, input.name);
    if (suggestions.length > 0) {
      return {
        matched: false,
        confidence: 'low',
        suggestions,
      };
    }
  }

  return { matched: false, confidence: 'none', suggestions: [] };
}

/**
 * Find users by name with fuzzy matching within a university.
 * Returns suggestions sorted by confidence score.
 *
 * **Scalability notes:**
 * - Fetches up to `limit` students, then loads user records individually via Promise.all
 * - For universities with >500 students, increase the limit to avoid missing matches
 * - The N individual db.get() calls are acceptable for import workflows but not for
 *   high-frequency queries. Consider a denormalized index if this becomes a bottleneck.
 *
 * @param limit - Maximum students to search (default 500, increase for larger universities)
 */
async function findUsersByNameFuzzy(
  ctx: QueryCtx,
  universityId: Id<'universities'>,
  searchName: string,
  limit: number = 500,
): Promise<
  Array<{
    userId: Id<'users'>;
    name: string;
    email: string;
    confidence: number;
  }>
> {
  // Get all students from this university (limited for performance)
  const students = await ctx.db
    .query('studentProfiles')
    .withIndex('by_university', (q) => q.eq('university_id', universityId))
    .take(limit);

  if (students.length === 0) {
    return [];
  }

  // Get user records for these students
  const userIds = students.map((s) => s.user_id);
  const users = await Promise.all(userIds.map((id) => ctx.db.get(id)));

  const normalizedSearch = normalizeForMatching(searchName);
  const suggestions: Array<{
    userId: Id<'users'>;
    name: string;
    email: string;
    confidence: number;
  }> = [];

  for (const user of users) {
    if (!user || !user.name) continue;

    const normalizedName = normalizeForMatching(user.name);
    const confidence = calculateNameSimilarity(normalizedSearch, normalizedName);

    // Only include matches with confidence >= 70%
    if (confidence >= 0.7) {
      suggestions.push({
        userId: user._id,
        name: user.name,
        email: user.email || '',
        confidence: Math.round(confidence * 100),
      });
    }
  }

  // Sort by confidence descending, limit to top 5
  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

/**
 * Normalize a name for matching (lowercase, remove diacritics, standardize whitespace)
 */
export function normalizeForMatching(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ') // Standardize whitespace
    .trim();
}

/**
 * Calculate similarity between two normalized names.
 * Uses a simple token-based matching approach.
 */
export function calculateNameSimilarity(name1: string, name2: string): number {
  const tokens1 = new Set(name1.split(' ').filter((t) => t.length > 0));
  const tokens2 = new Set(name2.split(' ').filter((t) => t.length > 0));

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  // Count matching tokens
  let matches = 0;
  for (const token of tokens1) {
    if (tokens2.has(token)) {
      matches++;
    } else {
      // Check for partial match (prefix or substring)
      for (const t2 of tokens2) {
        if (t2.startsWith(token) || token.startsWith(t2)) {
          matches += 0.5;
          break;
        }
      }
    }
  }

  // Calculate Jaccard-like similarity
  const total = tokens1.size + tokens2.size - matches;
  return total > 0 ? matches / total : 0;
}

// ============================================================================
// IDEMPOTENT IMPORT UTILITIES
// ============================================================================

/**
 * Generate a unique external_outcome_id for deduplication.
 * Format: {cohort_id}_{external_student_id} or {cohort_id}_{email}
 */
export function generateExternalOutcomeId(
  cohortId: Id<'graduation_cohorts'>,
  externalStudentId?: string,
  email?: string,
): string {
  const identifier = externalStudentId || email;
  if (!identifier) {
    throw new Error(
      'Either externalStudentId or email is required to generate external_outcome_id',
    );
  }
  return `${cohortId}_${identifier.toLowerCase().trim()}`;
}

/**
 * Check if an outcome with the given external_outcome_id already exists.
 */
export async function findExistingOutcome(
  ctx: QueryCtx,
  institutionId: Id<'universities'>,
  externalOutcomeId: string,
): Promise<Id<'graduate_outcomes'> | null> {
  const existing = await ctx.db
    .query('graduate_outcomes')
    .withIndex('by_external_outcome_id', (q) =>
      q.eq('institution_id', institutionId).eq('external_outcome_id', externalOutcomeId),
    )
    .first();

  return existing?._id ?? null;
}

/**
 * Initialize a bulk import result tracker.
 */
export function initBulkImportResult(): BulkImportResult {
  return {
    total: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };
}

/**
 * Add a successful result to the bulk import tracker.
 */
export function recordImportSuccess(
  result: BulkImportResult,
  action: 'created' | 'updated' | 'skipped',
): void {
  result.total++;
  result[action]++;
}

/**
 * Add an error to the bulk import tracker.
 */
export function recordImportError(
  result: BulkImportResult,
  row: number,
  error: string,
  data?: Record<string, unknown>,
): void {
  result.total++;
  result.errors.push({ row, error, data });
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate required fields for outcome import.
 */
export function validateOutcomeImportRow(row: {
  externalStudentId?: string;
  studentEmail?: string;
  studentName?: string;
  outcomeStatus?: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Must have at least one identifier
  if (!row.externalStudentId && !row.studentEmail) {
    errors.push('Either external_student_id or student_email is required');
  }

  // Validate outcome_status if provided
  const validStatuses = ['unknown', 'known', 'partial'];
  if (row.outcomeStatus && !validStatuses.includes(row.outcomeStatus)) {
    errors.push(
      `Invalid outcome_status: ${row.outcomeStatus}. Must be one of: ${validStatuses.join(', ')}`,
    );
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate outcome type.
 */
export function validateOutcomeType(
  outcomeType?: string,
): outcomeType is
  | 'employed_fulltime'
  | 'employed_parttime'
  | 'continuing_education'
  | 'military'
  | 'volunteer'
  | 'seeking'
  | 'not_seeking'
  | undefined {
  if (!outcomeType) return true;
  const validTypes = [
    'employed_fulltime',
    'employed_parttime',
    'continuing_education',
    'military',
    'volunteer',
    'seeking',
    'not_seeking',
  ];
  return validTypes.includes(outcomeType);
}

/**
 * Validate data source.
 */
export function validateDataSource(
  dataSource?: string,
): dataSource is
  | 'survey'
  | 'linkedin'
  | 'advisor_input'
  | 'student_self_report'
  | 'employer_report'
  | 'platform_inference'
  | undefined {
  if (!dataSource) return true;
  const validSources = [
    'survey',
    'linkedin',
    'advisor_input',
    'student_self_report',
    'employer_report',
    'platform_inference',
  ];
  return validSources.includes(dataSource);
}
