/**
 * AI Evaluation Rubrics Registry (v2.0)
 *
 * Central registry for all tool-specific evaluation rubrics.
 *
 * VERSION 2.0: Uses standardized 1-5 scoring with 5 unified dimensions.
 * Tool rubrics now specify metadata and critical flags only.
 * The actual dimension definitions are in standardized-rubric.ts.
 *
 * @see docs/AI_EVALUATOR_STRATEGY.md for governance
 */

import { AIToolId, ToolRubric } from '../types';
import { AI_COACH_MESSAGE_RUBRIC, AI_COACH_RESPONSE_RUBRIC } from './ai-coach';
import { CAREER_CERTIFICATIONS_RUBRIC } from './career-certifications';
import {
  CAREER_EXPLORER_NEXT_ROLES_RUBRIC,
  CAREER_PATH_FROM_JOB_RUBRIC,
  CAREER_PATH_GENERATION_RUBRIC,
  CAREER_PATHS_GENERATION_RUBRIC,
} from './career-path';
import { COVER_LETTER_ANALYSIS_RUBRIC, COVER_LETTER_GENERATION_RUBRIC } from './cover-letter';
import {
  INTERVIEW_QUESTION_GENERATION_RUBRIC,
  INTERVIEW_RESPONSE_EVALUATION_RUBRIC,
  INTERVIEW_ROLE_PROFILE_ANALYSIS_RUBRIC,
  INTERVIEW_SESSION_SUMMARY_RUBRIC,
} from './interview-practice';
import {
  RESUME_ANALYSIS_RUBRIC,
  RESUME_GENERATION_RUBRIC,
  RESUME_OPTIMIZATION_RUBRIC,
  RESUME_PARSE_RUBRIC,
  RESUME_SUGGESTIONS_RUBRIC,
} from './resume';
import { JD_ANALYSIS_RUBRIC, RESUME_GUIDANCE_RUBRIC, RESUME_MATCH_RUBRIC } from './resume-advanced';
import {
  buildRubricPromptSection,
  getAllDimensions,
  getDimensionDef,
  getScoringCriteria,
  isSafetyGateDimension,
  STANDARDIZED_RUBRIC,
  STANDARDIZED_RUBRIC_VERSION,
} from './standardized-rubric';

/**
 * Registry of all rubrics by tool ID
 */
export const RUBRICS: Record<AIToolId, ToolRubric> = {
  // Resume tools
  'resume-generation': RESUME_GENERATION_RUBRIC,
  'resume-analysis': RESUME_ANALYSIS_RUBRIC,
  'resume-optimization': RESUME_OPTIMIZATION_RUBRIC,
  'resume-suggestions': RESUME_SUGGESTIONS_RUBRIC,
  'resume-parse': RESUME_PARSE_RUBRIC,

  // Cover letter tools
  'cover-letter-generation': COVER_LETTER_GENERATION_RUBRIC,
  'cover-letter-analysis': COVER_LETTER_ANALYSIS_RUBRIC,

  // AI Coach tools
  'ai-coach-response': AI_COACH_RESPONSE_RUBRIC,
  'ai-coach-message': AI_COACH_MESSAGE_RUBRIC,

  // Career path tools
  'career-path-generation': CAREER_PATH_GENERATION_RUBRIC,
  'career-path-from-job': CAREER_PATH_FROM_JOB_RUBRIC,
  'career-paths-generation': CAREER_PATHS_GENERATION_RUBRIC,

  // Career explorer tools
  'career-explorer-next-roles': CAREER_EXPLORER_NEXT_ROLES_RUBRIC,

  // Interview practice tools
  'interview-role-profile-analysis': INTERVIEW_ROLE_PROFILE_ANALYSIS_RUBRIC,
  'interview-question-generation': INTERVIEW_QUESTION_GENERATION_RUBRIC,
  'interview-response-evaluation': INTERVIEW_RESPONSE_EVALUATION_RUBRIC,
  'interview-session-summary': INTERVIEW_SESSION_SUMMARY_RUBRIC,

  // Other tools
  'career-certifications': CAREER_CERTIFICATIONS_RUBRIC,

  // Resume advanced tools
  'jd-analysis': JD_ANALYSIS_RUBRIC,
  'resume-match': RESUME_MATCH_RUBRIC,
  'resume-guidance': RESUME_GUIDANCE_RUBRIC,
};

/**
 * Get rubric for a specific tool
 */
export function getRubric(toolId: AIToolId): ToolRubric {
  const rubric = RUBRICS[toolId];
  if (!rubric) {
    throw new Error(`No rubric found for tool: ${toolId}`);
  }
  return rubric;
}

/**
 * Get all rubrics
 */
export function getAllRubrics(): ToolRubric[] {
  return Object.values(RUBRICS);
}

/**
 * Check if a tool has a rubric
 */
export function hasRubric(toolId: string): toolId is AIToolId {
  return toolId in RUBRICS;
}

// Re-export individual rubrics for direct import
export {
  AI_COACH_MESSAGE_RUBRIC,
  // AI Coach
  AI_COACH_RESPONSE_RUBRIC,
  // Other
  CAREER_CERTIFICATIONS_RUBRIC,
  CAREER_PATH_FROM_JOB_RUBRIC,
  // Career Path
  CAREER_PATH_GENERATION_RUBRIC,
  CAREER_PATHS_GENERATION_RUBRIC,
  COVER_LETTER_ANALYSIS_RUBRIC,
  // Cover Letter
  COVER_LETTER_GENERATION_RUBRIC,
  // Resume advanced
  JD_ANALYSIS_RUBRIC,
  RESUME_ANALYSIS_RUBRIC,
  // Resume
  RESUME_GENERATION_RUBRIC,
  RESUME_GUIDANCE_RUBRIC,
  RESUME_MATCH_RUBRIC,
  RESUME_OPTIMIZATION_RUBRIC,
  RESUME_PARSE_RUBRIC,
  RESUME_SUGGESTIONS_RUBRIC,
};

// Re-export standardized rubric utilities
export {
  buildRubricPromptSection,
  getAllDimensions,
  getDimensionDef,
  getScoringCriteria,
  isSafetyGateDimension,
  STANDARDIZED_RUBRIC,
  STANDARDIZED_RUBRIC_VERSION,
};
