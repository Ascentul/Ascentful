/**
 * Career Path Tool Rubrics (v2.0)
 *
 * Configuration for career path generation tool evaluations.
 * These complement the existing quality validation in career-path/types.ts
 *
 * NOTE: v2.0 uses 5 standardized dimensions (relevance, specificity, safety, tone_fit, factual_correctness)
 * defined in standardized-rubric.ts. Tool rubrics now only specify metadata and critical flags.
 */

import { ToolRubric } from '../types';

/**
 * Career Path Generation Rubric
 *
 * Evaluates AI-generated career paths for realism and usefulness.
 */
export const CAREER_PATH_GENERATION_RUBRIC: ToolRubric = {
  tool_id: 'career-path-generation',
  version: '2.0.0',
  description:
    "Evaluates AI-generated career progression paths. Output should be relevant to user's current role and goals, specific with clear steps and milestones, realistic and achievable, and factually accurate about industry expectations.",
  category: 'student-facing',
  critical_risk_flags: ['hallucination_detected', 'low_relevance', 'safety_violation'],
};

/**
 * Career Path from Job Rubric
 *
 * Evaluates career paths generated from specific job descriptions.
 */
export const CAREER_PATH_FROM_JOB_RUBRIC: ToolRubric = {
  tool_id: 'career-path-from-job',
  version: '2.0.0',
  description:
    'Evaluates career paths generated from job descriptions. Output should align with the target job, provide specific skill mapping and steps, and be realistic about progression timeline.',
  category: 'student-facing',
  critical_risk_flags: ['hallucination_detected', 'low_relevance', 'safety_violation'],
};

/**
 * Career Paths (Multiple) Generation Rubric
 *
 * Evaluates generation of multiple career path options.
 */
export const CAREER_PATHS_GENERATION_RUBRIC: ToolRubric = {
  tool_id: 'career-paths-generation',
  version: '2.0.0',
  description:
    'Evaluates generation of multiple career path options. Output should offer genuinely diverse paths, all relevant to the user, and each complete with realistic progression steps.',
  category: 'student-facing',
  critical_risk_flags: ['hallucination_detected', 'safety_violation'],
};

/**
 * Career Explorer Next Roles Rubric
 *
 * Evaluates AI-generated role recommendations in the career explorer.
 */
export const CAREER_EXPLORER_NEXT_ROLES_RUBRIC: ToolRubric = {
  tool_id: 'career-explorer-next-roles',
  version: '2.0.0',
  description:
    'Evaluates AI-generated next role recommendations. Output should be relevant to the current role, realistic for the career stage (entry/lateral/promotion), and provide accurate fit scores and skill requirements.',
  category: 'student-facing',
  critical_risk_flags: ['hallucination_detected', 'low_relevance', 'safety_violation'],
};
