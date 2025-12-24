/**
 * AI Evaluation Types
 *
 * Core type definitions for the centralized AI evaluation framework.
 * Part of the Ascentful Evaluator Model Strategy.
 *
 * VERSION 2.0: Standardized 1-5 scoring scale with 5 unified dimensions.
 *
 * @see docs/AI_EVALUATOR_STRATEGY.md for governance and policies
 */

import { z } from 'zod';

// ============================================================================
// CONSTANTS
// ============================================================================

export const EVALUATION_VERSION = '2.0.0';

// ============================================================================
// TOOL IDENTIFIERS
// ============================================================================

/**
 * All AI tools that require evaluation.
 * Each tool using OpenAI prompts must have an entry here.
 */
export const AI_TOOL_IDS = [
  // Resume tools
  'resume-generation',
  'resume-analysis',
  'resume-optimization',
  'resume-suggestions',
  'resume-parse',
  // Cover letter tools
  'cover-letter-generation',
  'cover-letter-analysis',
  // AI Coach tools
  'ai-coach-response',
  'ai-coach-message',
  // Career path tools
  'career-path-generation',
  'career-path-from-job',
  'career-paths-generation',
  // Career explorer tools
  'career-explorer-next-roles',
  // Interview practice tools
  'interview-role-profile-analysis',
  'interview-question-generation',
  'interview-response-evaluation',
  'interview-session-summary',
  // Other tools
  'career-certifications',
] as const;

export type AIToolId = (typeof AI_TOOL_IDS)[number];

// ============================================================================
// TOOL CATEGORIES
// ============================================================================

/**
 * Tool categories determine threshold targets for evaluation metrics.
 */
export type ToolCategory = 'student-facing' | 'advisor-admin';

/**
 * Mapping of tool IDs to their categories
 */
export const TOOL_CATEGORIES: Record<AIToolId, ToolCategory> = {
  // Student-facing tools
  'resume-generation': 'student-facing',
  'resume-analysis': 'student-facing',
  'resume-optimization': 'student-facing',
  'resume-suggestions': 'student-facing',
  'resume-parse': 'student-facing',
  'cover-letter-generation': 'student-facing',
  'cover-letter-analysis': 'student-facing',
  'ai-coach-response': 'student-facing',
  'ai-coach-message': 'student-facing',
  'career-path-generation': 'student-facing',
  'career-path-from-job': 'student-facing',
  'career-paths-generation': 'student-facing',
  // Career explorer tools
  'career-explorer-next-roles': 'student-facing',
  // Interview practice tools
  'interview-role-profile-analysis': 'student-facing',
  'interview-question-generation': 'student-facing',
  'interview-response-evaluation': 'student-facing',
  'interview-session-summary': 'student-facing',
  'career-certifications': 'student-facing',
};

// ============================================================================
// STANDARDIZED DIMENSIONS (1-5 SCALE)
// ============================================================================

/**
 * The 5 standardized dimensions used across all tools.
 * Every evaluation scores these same dimensions.
 */
export const STANDARDIZED_DIMENSIONS = [
  'relevance',
  'specificity',
  'safety',
  'tone_fit',
  'factual_correctness',
] as const;

export type StandardizedDimension = (typeof STANDARDIZED_DIMENSIONS)[number];

/**
 * Score levels for the 1-5 scale
 */
export const SCORE_LEVELS = {
  5: 'excellent',
  4: 'good',
  3: 'acceptable',
  2: 'poor',
  1: 'unacceptable',
} as const;

export type ScoreLevel = (typeof SCORE_LEVELS)[keyof typeof SCORE_LEVELS];

/**
 * Score value (1-5)
 */
export type Score1to5 = 1 | 2 | 3 | 4 | 5;

// ============================================================================
// RISK FLAGS
// ============================================================================

/**
 * Risk flags that can be raised during evaluation.
 * Critical flags may block content from being shown to users.
 */
export const RISK_FLAGS = [
  'too_generic', // Content lacks specificity or personalization
  'potential_bias', // May contain biased language or assumptions
  'missing_requirements', // Doesn't address key job requirements
  'factual_inconsistency', // Claims don't match user's actual profile
  'pii_detected', // Contains personally identifiable information
  'discriminatory_content', // Contains discriminatory language
  'hallucination_detected', // AI made up facts not in source data
  'low_relevance', // Content not relevant to user's context
  'unprofessional_tone', // Inappropriate or unprofessional language
  'excessive_length', // Output exceeds reasonable limits
  'insufficient_detail', // Output lacks necessary detail
  'safety_concern', // Advice could cause harm to user
  'out_of_scope', // Response outside career guidance domain
  'copy_paste_detected', // Large portions copied from job description
  'safety_violation', // Safety dimension scored 1-2 (hard failure)
] as const;

export type RiskFlag = (typeof RISK_FLAGS)[number];

// ============================================================================
// EVALUATION RESULT TYPES
// ============================================================================

/**
 * Score for a single standardized dimension (1-5 scale)
 */
export interface DimensionScore {
  name: StandardizedDimension;
  score: number; // 1-5 scale
  feedback?: string;
}

/**
 * Safety gate result - binary pass/fail for Safety dimension
 */
export interface SafetyGateResult {
  passed: boolean; // true if safety score >= 3
  safety_score: number; // 1-5
  is_hard_failure: boolean; // true if score 1-2
}

/**
 * Complete evaluation result from the evaluator model (v2.0 - 1-5 scale)
 */
export interface EvaluationResult {
  // Scores (1-5 scale for each standardized dimension)
  overall_score: number; // Average of dimension scores (1-5)
  dimension_scores: Record<StandardizedDimension, DimensionScore>;

  // Safety gate (binary pass/fail)
  safety_gate: SafetyGateResult;

  // Risk assessment
  risk_flags: RiskFlag[];
  critical_flags_present: boolean;

  // Decision
  passed: boolean;

  // Explanation
  explanation: string; // Short rationale for audit/debugging

  // Metadata
  evaluation_version: string;
  evaluator_model: string;
  evaluation_duration_ms: number;
}

/**
 * Schema for validating evaluation results (v2.0)
 */
export const EvaluationResultSchema = z.object({
  overall_score: z.number().min(1).max(5),
  dimension_scores: z.record(
    z.object({
      name: z.enum(STANDARDIZED_DIMENSIONS),
      score: z.number().min(1).max(5),
      feedback: z.string().optional(),
    }),
  ),
  safety_gate: z.object({
    passed: z.boolean(),
    safety_score: z.number().min(1).max(5),
    is_hard_failure: z.boolean(),
  }),
  risk_flags: z.array(z.enum(RISK_FLAGS)),
  critical_flags_present: z.boolean(),
  passed: z.boolean(),
  explanation: z.string(),
  evaluation_version: z.string(),
  evaluator_model: z.string(),
  evaluation_duration_ms: z.number(),
});

// ============================================================================
// RUBRIC TYPES (V2.0 - 1-5 SCALE)
// ============================================================================

/**
 * Scoring criteria for the 1-5 scale
 */
export interface ScoringCriteria5Point {
  score_5: string; // Excellent
  score_4: string; // Good
  score_3: string; // Mixed/Acceptable
  score_2: string; // Poor
  score_1: string; // Unacceptable
}

/**
 * Single standardized dimension definition
 */
export interface StandardizedDimensionDef {
  name: StandardizedDimension;
  description: string;
  scoring_criteria: ScoringCriteria5Point;
  is_safety_gate?: boolean; // True for safety dimension only
}

/**
 * Threshold targets for quality metrics
 */
export interface ThresholdTargets {
  relevance_pct_at_4_plus: number; // e.g., 80 means 80% should score 4+
  specificity_pct_at_4_plus: number;
  safety_pct_at_1_2: number; // Target: 0 (zero tolerance for 1-2 scores)
  tone_fit_pct_at_4_plus: number;
  factual_correctness_pct_at_1_2: number; // Target: low (< 5%)
}

/**
 * Default threshold targets by tool category
 */
export const DEFAULT_THRESHOLD_TARGETS: Record<ToolCategory, ThresholdTargets> = {
  'student-facing': {
    relevance_pct_at_4_plus: 80,
    specificity_pct_at_4_plus: 75,
    safety_pct_at_1_2: 0,
    tone_fit_pct_at_4_plus: 80,
    factual_correctness_pct_at_1_2: 5,
  },
  'advisor-admin': {
    relevance_pct_at_4_plus: 90,
    specificity_pct_at_4_plus: 75,
    safety_pct_at_1_2: 0,
    tone_fit_pct_at_4_plus: 75,
    factual_correctness_pct_at_1_2: 5,
  },
};

/**
 * Tool-specific evaluation context for customizing how standardized dimensions
 * are interpreted for a particular tool. This allows adding tool-specific
 * guidance without breaking the standardized scoring system.
 *
 * @example
 * ```typescript
 * evaluation_context: {
 *   relevance_focus: 'Must align with target job requirements',
 *   specificity_focus: 'Include quantified achievements (numbers, percentages)',
 *   factual_focus: 'Verify company names and dates match source data',
 *   additional_checks: ['ATS keyword optimization', 'No first-person in summary'],
 * }
 * ```
 */
export interface ToolEvaluationContext {
  /** Specific guidance for evaluating relevance for this tool */
  relevance_focus?: string;
  /** Specific guidance for evaluating specificity for this tool */
  specificity_focus?: string;
  /** Specific guidance for evaluating factual correctness for this tool */
  factual_focus?: string;
  /** Specific guidance for evaluating tone fit for this tool */
  tone_focus?: string;
  /** Specific guidance for evaluating safety for this tool */
  safety_focus?: string;
  /** Additional tool-specific checks to perform */
  additional_checks?: string[];
}

/**
 * Tool-specific configuration (references standardized rubric)
 */
export interface ToolRubricConfig {
  tool_id: AIToolId;
  version: string;
  description: string;
  category: ToolCategory;
  threshold_targets?: Partial<ThresholdTargets>; // Override defaults if needed
  critical_risk_flags: RiskFlag[]; // Flags that cause automatic failure
  /** Optional tool-specific evaluation guidance */
  evaluation_context?: ToolEvaluationContext;
}

/**
 * Schema for validating tool evaluation context
 */
export const ToolEvaluationContextSchema = z.object({
  relevance_focus: z.string().optional(),
  specificity_focus: z.string().optional(),
  factual_focus: z.string().optional(),
  tone_focus: z.string().optional(),
  safety_focus: z.string().optional(),
  additional_checks: z.array(z.string()).optional(),
});

/**
 * Schema for validating tool rubric configuration
 */
export const ToolRubricConfigSchema = z.object({
  tool_id: z.enum(AI_TOOL_IDS),
  version: z.string(),
  description: z.string(),
  category: z.enum(['student-facing', 'advisor-admin']),
  threshold_targets: z
    .object({
      relevance_pct_at_4_plus: z.number().min(0).max(100).optional(),
      specificity_pct_at_4_plus: z.number().min(0).max(100).optional(),
      safety_pct_at_1_2: z.number().min(0).max(100).optional(),
      tone_fit_pct_at_4_plus: z.number().min(0).max(100).optional(),
      factual_correctness_pct_at_1_2: z.number().min(0).max(100).optional(),
    })
    .optional(),
  critical_risk_flags: z.array(z.enum(RISK_FLAGS)),
  evaluation_context: ToolEvaluationContextSchema.optional(),
});

// Legacy type alias for backwards compatibility
export interface ToolRubric extends ToolRubricConfig {}

// Legacy schema alias
export const ToolRubricSchema = ToolRubricConfigSchema;

// ============================================================================
// EVALUATION INPUT TYPES
// ============================================================================

/**
 * Input to the evaluator service
 */
export interface EvaluationInput {
  tool_id: AIToolId;
  tool_version?: string;

  // Content to evaluate - can be string or structured object
  input: Record<string, unknown>; // Original input (job desc, user profile, etc.)
  output: Record<string, unknown> | string; // The AI-generated content

  // Optional context
  user_id?: string;
  source_data?: Record<string, unknown>; // Ground truth data for factual checking
}

/**
 * Configuration for evaluation behavior
 */
export interface EvaluationConfig {
  // Model settings
  evaluator_model: string;
  temperature: number;

  // Behavior
  enabled: boolean;
  log_all: boolean; // Store all evaluations, even passing ones
  block_on_fail: boolean; // Return error vs warning when eval fails

  // Retry settings
  max_retries: number;
  retry_on_fail: boolean;
}

/**
 * Default evaluation configuration
 *
 * Note: evaluator_model uses gpt-4o-mini as placeholder.
 * Will upgrade to a faster, cheaper model when available.
 */
export const DEFAULT_EVALUATION_CONFIG: EvaluationConfig = {
  evaluator_model: 'gpt-4o-mini', // TODO: Upgrade to a faster, cheaper model when available
  temperature: 0.1, // Deterministic
  enabled: true,
  log_all: true,
  block_on_fail: false, // Warn but don't block initially
  max_retries: 1,
  retry_on_fail: true,
};

// ============================================================================
// RULE CHECK TYPES
// ============================================================================

/**
 * Result of a pre or post evaluation rule check
 */
export interface RuleCheckResult {
  passed: boolean;
  rule_name: string;
  message?: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Combined result of all rule checks
 */
export interface RuleCheckResults {
  all_passed: boolean;
  results: RuleCheckResult[];
  blocking_failures: RuleCheckResult[];
}

// ============================================================================
// PERSISTENCE TYPES
// ============================================================================

/**
 * Data structure for storing evaluations in Convex
 */
export interface StoredEvaluation {
  // Identity
  tool_id: AIToolId;
  tool_version?: string;
  evaluator_model: string;
  rubric_version: string;

  // Scores
  overall_score: number;
  dimension_scores: Record<string, DimensionScore>;
  risk_flags: RiskFlag[];
  explanation: string;
  passed: boolean;

  // Context
  user_id?: string;
  input_hash: string; // Hash of input for deduplication
  output_hash: string; // Hash of output

  // Metadata
  environment: 'dev' | 'staging' | 'production';
  evaluation_duration_ms: number;
  created_at: number;
}

// ============================================================================
// TELEMETRY TYPES
// ============================================================================

/**
 * Telemetry event for evaluation tracking
 */
export interface EvaluationTelemetryEvent {
  event:
    | 'evaluation_started'
    | 'evaluation_completed'
    | 'evaluation_failed'
    | 'rule_check_failed'
    | 'content_blocked'
    | 'content_regenerated';
  tool_id: AIToolId;
  user_id?: string;
  timestamp: number;
  duration_ms?: number;
  overall_score?: number;
  passed?: boolean;
  risk_flags?: RiskFlag[];
  error?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a risk flag is in the critical list
 */
export function isCriticalFlag(flag: RiskFlag, criticalFlags: RiskFlag[]): boolean {
  return criticalFlags.includes(flag);
}

/**
 * Calculate overall score as average of dimension scores (1-5 scale)
 */
export function calculateOverallScore(dimensions: DimensionScore[]): number {
  if (dimensions.length === 0) return 3; // Default to acceptable
  const sum = dimensions.reduce((acc, d) => acc + d.score, 0);
  return Math.round((sum / dimensions.length) * 10) / 10; // Round to 1 decimal
}

/**
 * Check safety gate - returns result for safety dimension
 */
export function checkSafetyGate(safetyScore: number): SafetyGateResult {
  return {
    passed: safetyScore >= 3,
    safety_score: safetyScore,
    is_hard_failure: safetyScore <= 2,
  };
}

/**
 * Determine if evaluation passes based on safety gate and critical flags.
 * In v2.0, we use safety gate as primary pass/fail mechanism.
 * Overall score is for monitoring, not gating.
 */
export function evaluationPasses(
  safetyGate: SafetyGateResult,
  riskFlags: RiskFlag[],
  criticalFlags: RiskFlag[],
): boolean {
  // HARD FAILURE: Safety dimension scored 1-2
  if (safetyGate.is_hard_failure) {
    return false;
  }

  // Fail if any critical flags present
  const hasCriticalFlag = riskFlags.some((flag) => isCriticalFlag(flag, criticalFlags));
  if (hasCriticalFlag) {
    return false;
  }

  return true;
}

/**
 * Get score level label for 1-5 scale
 */
export function getScoreLevel(score: number): ScoreLevel {
  if (score >= 5) return 'excellent';
  if (score >= 4) return 'good';
  if (score >= 3) return 'acceptable';
  if (score >= 2) return 'poor';
  return 'unacceptable';
}

/**
 * Get score level from integer (1-5)
 */
export function getScoreLevelFromInt(score: Score1to5): ScoreLevel {
  return SCORE_LEVELS[score];
}
