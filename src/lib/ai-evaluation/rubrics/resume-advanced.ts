/**
 * Advanced Resume AI Tool Rubrics
 *
 * Rubrics for job description analysis, resume matching, and resume guidance tools.
 */

import { ToolRubric } from '../types';

/**
 * JD Analysis Rubric
 * For AI-powered job description parsing and keyword extraction
 */
export const JD_ANALYSIS_RUBRIC: ToolRubric = {
  tool_id: 'jd-analysis',
  version: '1.0.0',
  description: 'AI-powered job description analysis and parsing',
  category: 'student-facing',
  critical_risk_flags: ['hallucination_detected', 'factual_inconsistency'],
  evaluation_context: {
    relevance_focus: 'Accurately identify job requirements and qualifications',
    specificity_focus: 'Extract specific skills, years of experience, and keywords',
    factual_focus: 'Only report information present in the job description',
  },
};

/**
 * Resume Match Rubric
 * For resume-to-job-description matching and gap analysis
 */
export const RESUME_MATCH_RUBRIC: ToolRubric = {
  tool_id: 'resume-match',
  version: '1.0.0',
  description: 'Resume-to-job-description match scoring',
  category: 'student-facing',
  critical_risk_flags: ['hallucination_detected', 'factual_inconsistency'],
  evaluation_context: {
    relevance_focus: 'Accurately compare resume against JD requirements',
    specificity_focus: 'Provide specific match percentages and gap analysis',
    factual_focus: 'Only reference skills and experience present in the resume',
  },
};

/**
 * Resume Guidance Rubric
 * For conversational resume writing assistance
 */
export const RESUME_GUIDANCE_RUBRIC: ToolRubric = {
  tool_id: 'resume-guidance',
  version: '1.0.0',
  description: 'AI-powered conversational resume writing guidance',
  category: 'student-facing',
  critical_risk_flags: ['hallucination_detected', 'unprofessional_tone', 'safety_concern'],
  evaluation_context: {
    relevance_focus: 'Provide guidance relevant to the specific resume section',
    specificity_focus: 'Give actionable, specific advice for improvement',
    tone_focus: 'Maintain professional, encouraging, and helpful tone',
  },
};
