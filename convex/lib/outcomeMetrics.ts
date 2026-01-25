/**
 * Outcome Metrics Utilities
 *
 * Pure calculation functions for outcome KPIs.
 * These functions are used by both the production code and tests.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface OutcomeRecord {
  outcome_status: 'unknown' | 'known' | 'partial';
  outcome_type?:
    | 'employed_fulltime'
    | 'employed_parttime'
    | 'continuing_education'
    | 'military'
    | 'volunteer'
    | 'seeking'
    | 'not_seeking';
}

export interface OutcomeMetrics {
  total_students: number;
  known_outcomes: number;
  unknown_outcomes: number;
  partial_outcomes: number;
  knowledge_rate: number;
  employed_fulltime: number;
  employed_parttime: number;
  continuing_education: number;
  military: number;
  volunteer: number;
  seeking: number;
  not_seeking: number;
  employment_rate: number;
  continuing_ed_rate: number;
}

// ============================================================================
// RATE CALCULATIONS
// ============================================================================

/**
 * Calculate knowledge rate as percentage of known outcomes.
 * Returns 0 if total is 0 to avoid division by zero.
 *
 * @param known - Number of known outcomes
 * @param total - Total number of outcomes
 * @param precision - Decimal places (default 1, e.g., 66.7)
 */
export function calculateKnowledgeRate(
  known: number,
  total: number,
  precision: number = 1,
): number {
  if (total <= 0) return 0;
  const multiplier = Math.pow(10, precision + 2);
  return Math.round((known / total) * multiplier) / Math.pow(10, precision);
}

/**
 * Calculate employment rate as percentage of employed among known outcomes.
 * Counts both fulltime and parttime employment.
 * Returns 0 if known is 0 to avoid division by zero.
 *
 * @param employed - Number of employed outcomes (fulltime + parttime)
 * @param known - Number of known outcomes
 * @param precision - Decimal places (default 1, e.g., 66.7)
 */
export function calculateEmploymentRate(
  employed: number,
  known: number,
  precision: number = 1,
): number {
  if (known <= 0) return 0;
  const multiplier = Math.pow(10, precision + 2);
  return Math.round((employed / known) * multiplier) / Math.pow(10, precision);
}

/**
 * Calculate continuing education rate as percentage among known outcomes.
 * Returns 0 if known is 0 to avoid division by zero.
 *
 * @param continuingEd - Number of continuing education outcomes
 * @param known - Number of known outcomes
 * @param precision - Decimal places (default 1, e.g., 25.0)
 */
export function calculateContinuingEdRate(
  continuingEd: number,
  known: number,
  precision: number = 1,
): number {
  if (known <= 0) return 0;
  const multiplier = Math.pow(10, precision + 2);
  return Math.round((continuingEd / known) * multiplier) / Math.pow(10, precision);
}

// ============================================================================
// OUTCOME COUNTING
// ============================================================================

/**
 * Count outcomes by status.
 */
export function countByStatus(outcomes: OutcomeRecord[]): {
  known: number;
  unknown: number;
  partial: number;
} {
  return {
    known: outcomes.filter((o) => o.outcome_status === 'known').length,
    unknown: outcomes.filter((o) => o.outcome_status === 'unknown').length,
    partial: outcomes.filter((o) => o.outcome_status === 'partial').length,
  };
}

/**
 * Count outcomes by type (only counts known outcomes).
 */
export function countByType(outcomes: OutcomeRecord[]): {
  employed_fulltime: number;
  employed_parttime: number;
  continuing_education: number;
  military: number;
  volunteer: number;
  seeking: number;
  not_seeking: number;
} {
  return {
    employed_fulltime: outcomes.filter((o) => o.outcome_type === 'employed_fulltime').length,
    employed_parttime: outcomes.filter((o) => o.outcome_type === 'employed_parttime').length,
    continuing_education: outcomes.filter((o) => o.outcome_type === 'continuing_education').length,
    military: outcomes.filter((o) => o.outcome_type === 'military').length,
    volunteer: outcomes.filter((o) => o.outcome_type === 'volunteer').length,
    seeking: outcomes.filter((o) => o.outcome_type === 'seeking').length,
    not_seeking: outcomes.filter((o) => o.outcome_type === 'not_seeking').length,
  };
}

/**
 * Count total employed (fulltime + parttime).
 */
export function countEmployed(outcomes: OutcomeRecord[]): number {
  return outcomes.filter(
    (o) => o.outcome_type === 'employed_fulltime' || o.outcome_type === 'employed_parttime',
  ).length;
}

// ============================================================================
// COMPREHENSIVE METRICS
// ============================================================================

/**
 * Compute all outcome metrics for a set of outcomes.
 * This is the main function used by dashboard analytics.
 *
 * @param outcomes - Array of outcome records
 * @param precision - Decimal places for rates (default 1)
 */
export function computeOutcomeMetrics(
  outcomes: OutcomeRecord[],
  precision: number = 1,
): OutcomeMetrics {
  const total = outcomes.length;
  const statusCounts = countByStatus(outcomes);
  const typeCounts = countByType(outcomes);

  const employed = typeCounts.employed_fulltime + typeCounts.employed_parttime;

  return {
    total_students: total,
    known_outcomes: statusCounts.known,
    unknown_outcomes: statusCounts.unknown,
    partial_outcomes: statusCounts.partial,
    knowledge_rate: calculateKnowledgeRate(statusCounts.known, total, precision),
    employed_fulltime: typeCounts.employed_fulltime,
    employed_parttime: typeCounts.employed_parttime,
    continuing_education: typeCounts.continuing_education,
    military: typeCounts.military,
    volunteer: typeCounts.volunteer,
    seeking: typeCounts.seeking,
    not_seeking: typeCounts.not_seeking,
    employment_rate: calculateEmploymentRate(employed, statusCounts.known, precision),
    continuing_ed_rate: calculateContinuingEdRate(
      typeCounts.continuing_education,
      statusCounts.known,
      precision,
    ),
  };
}

// ============================================================================
// SALARY STATISTICS
// ============================================================================

/**
 * Calculate salary statistics from a list of salaries.
 * Filters out zero/null values and computes average, median, and percentiles.
 */
export function calculateSalaryStats(salaries: (number | null | undefined)[]): {
  average: number | null;
  median: number | null;
  percentile25: number | null;
  percentile75: number | null;
  count: number;
} {
  // Filter valid salaries
  const validSalaries = salaries
    .filter((s): s is number => s !== null && s !== undefined && s > 0)
    .sort((a, b) => a - b);

  if (validSalaries.length === 0) {
    return {
      average: null,
      median: null,
      percentile25: null,
      percentile75: null,
      count: 0,
    };
  }

  const average = Math.round(validSalaries.reduce((a, b) => a + b, 0) / validSalaries.length);

  const mid = Math.floor(validSalaries.length / 2);
  const median =
    validSalaries.length % 2 !== 0
      ? validSalaries[mid]
      : Math.round((validSalaries[mid - 1] + validSalaries[mid]) / 2);

  const q1Index = Math.floor(validSalaries.length * 0.25);
  const q3Index = Math.floor(validSalaries.length * 0.75);

  return {
    average,
    median,
    percentile25: validSalaries[q1Index],
    percentile75: validSalaries[q3Index],
    count: validSalaries.length,
  };
}
