/**
 * Interview Practice Tool Rubrics (v2.0)
 *
 * Configuration for interview practice tool evaluations.
 * These rubrics evaluate the quality of AI-generated interview questions,
 * response evaluations, and session summaries.
 *
 * NOTE: v2.0 uses 5 standardized dimensions (relevance, specificity, safety, tone_fit, factual_correctness)
 * defined in standardized-rubric.ts. Tool rubrics now only specify metadata and critical flags.
 */

import { ToolRubric } from '../types';

/**
 * Interview Role Profile Analysis Rubric
 *
 * Evaluates AI extraction of competencies from job descriptions.
 */
export const INTERVIEW_ROLE_PROFILE_ANALYSIS_RUBRIC: ToolRubric = {
  tool_id: 'interview-role-profile-analysis',
  version: '2.0.0',
  description:
    'Evaluates AI extraction of job competencies and requirements. Output should accurately capture key skills and competencies from the job information, assign appropriate importance weights, and provide a clear role summary.',
  category: 'student-facing',
  critical_risk_flags: ['hallucination_detected', 'discriminatory_content', 'safety_violation'],
};

/**
 * Interview Question Generation Rubric
 *
 * Evaluates AI-generated interview questions for relevance and appropriateness.
 */
export const INTERVIEW_QUESTION_GENERATION_RUBRIC: ToolRubric = {
  tool_id: 'interview-question-generation',
  version: '2.0.0',
  description:
    'Evaluates AI-generated interview questions. Questions should be relevant to the role and competencies being assessed, appropriately challenging, conversational in tone, and never quote job descriptions verbatim. Questions must avoid discriminatory, illegal, or inappropriate topics.',
  category: 'student-facing',
  critical_risk_flags: [
    'discriminatory_content',
    'safety_violation',
    'out_of_scope',
    'low_relevance',
  ],
};

/**
 * Interview Response Evaluation Rubric
 *
 * Evaluates AI scoring and feedback on user interview responses.
 */
export const INTERVIEW_RESPONSE_EVALUATION_RUBRIC: ToolRubric = {
  tool_id: 'interview-response-evaluation',
  version: '2.0.0',
  description:
    'Evaluates AI assessment of interview responses. Scoring should be consistent and fair, feedback should be specific and constructive, and the evaluation should accurately reflect the quality of the response. Feedback must be encouraging while being honest about areas for improvement.',
  category: 'student-facing',
  critical_risk_flags: [
    'discriminatory_content',
    'factual_inconsistency',
    'safety_violation',
    'unprofessional_tone',
  ],
};

/**
 * Interview Session Summary Rubric
 *
 * Evaluates AI-generated coaching summaries for interview sessions.
 */
export const INTERVIEW_SESSION_SUMMARY_RUBRIC: ToolRubric = {
  tool_id: 'interview-session-summary',
  version: '2.0.0',
  description:
    'Evaluates AI-generated interview coaching summaries. Output should accurately summarize performance across all questions, provide specific and actionable takeaways, set realistic expectations, and maintain an encouraging tone while being honest about areas for improvement.',
  category: 'student-facing',
  critical_risk_flags: [
    'discriminatory_content',
    'factual_inconsistency',
    'safety_violation',
    'unprofessional_tone',
  ],
};
