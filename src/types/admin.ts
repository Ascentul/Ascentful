/**
 * Admin Data Model Types
 *
 * Shared types for institution management, AI configuration,
 * and graduation outcomes tracking.
 *
 * Keep in sync with Convex schema validators in convex/schema.ts.
 */

import type { Id } from 'convex/_generated/dataModel';

// ============================================================================
// INSTITUTION TYPES
// ============================================================================

export type InstitutionType =
  | 'community_college'
  | 'public_4year'
  | 'private_nonprofit'
  | 'private_forprofit'
  | 'graduate_only'
  | 'vocational'
  | 'other';

export type DegreeLevel =
  | 'certificate'
  | 'associate'
  | 'bachelor'
  | 'master'
  | 'doctoral'
  | 'professional';

export type GraduationTerm = 'spring' | 'summer' | 'fall' | 'winter';

// ============================================================================
// AI CONFIGURATION TYPES
// ============================================================================

export type AIPersonality = 'professional' | 'friendly' | 'encouraging' | 'direct' | 'custom';

export type FormalityLevel = 'formal' | 'semiformal' | 'casual';

export type KnowledgeDocumentType =
  | 'policy'
  | 'faq'
  | 'resource'
  | 'guideline'
  | 'employer_list'
  | 'alumni_network'
  | 'other';

export type GuardrailRuleType =
  | 'topic_block'
  | 'topic_redirect'
  | 'content_filter'
  | 'response_modifier'
  | 'disclaimer_inject'
  | 'escalation';

export interface AIInstitutionConfig {
  _id: Id<'ai_institution_config'>;
  institution_id: Id<'universities'>;
  assistant_name?: string;
  personality?: AIPersonality;
  formality_level?: FormalityLevel;
  custom_personality_prompt?: string;
  enable_salary_advice?: boolean;
  enable_job_recommendations?: boolean;
  enable_interview_prep?: boolean;
  enable_resume_critique?: boolean;
  enable_networking_advice?: boolean;
  counseling_center_name?: string;
  counseling_center_url?: string;
  counseling_center_phone?: string;
  career_center_name?: string;
  career_center_url?: string;
  career_center_phone?: string;
  emergency_protocol?: string;
  model_preference?: string;
  max_tokens_per_response?: number;
  temperature?: number;
  blocked_topics?: string[];
  required_disclaimers?: string[];
  is_active?: boolean;
  created_at: number;
  updated_at: number;
}

export interface AIKnowledgeDocument {
  _id: Id<'ai_knowledge_documents'>;
  config_id: Id<'ai_institution_config'>;
  institution_id: Id<'universities'>;
  title: string;
  description?: string;
  document_type: KnowledgeDocumentType;
  file_url?: string;
  file_storage_id?: Id<'_storage'>;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  content?: string;
  is_processed?: boolean;
  embedding_id?: string;
  chunk_count?: number;
  processing_error?: string;
  processed_at?: number;
  is_active?: boolean;
  created_at: number;
  updated_at: number;
}

export interface AIGuardrail {
  _id: Id<'ai_guardrails'>;
  config_id: Id<'ai_institution_config'>;
  institution_id: Id<'universities'>;
  name: string;
  description?: string;
  rule_type: GuardrailRuleType;
  condition?: Record<string, unknown>;
  action?: Record<string, unknown>;
  custom_response?: string;
  redirect_url?: string;
  priority?: number;
  is_active?: boolean;
  is_default?: boolean;
  created_by?: Id<'users'>;
  created_at: number;
  updated_at: number;
}

// ============================================================================
// GRADUATION OUTCOMES TYPES
// ============================================================================

export type CohortStatus = 'draft' | 'collecting' | 'finalized' | 'submitted';

export type OutcomeStatus = 'unknown' | 'known' | 'partial';

export type OutcomeType =
  | 'employed_fulltime'
  | 'employed_parttime'
  | 'continuing_education'
  | 'military'
  | 'volunteer'
  | 'seeking'
  | 'not_seeking';

export type OutcomeDataSource =
  | 'survey'
  | 'linkedin'
  | 'advisor_input'
  | 'student_self_report'
  | 'employer_report'
  | 'platform_inference';

export interface GraduationCohort {
  _id: Id<'graduation_cohorts'>;
  institution_id: Id<'universities'>;
  graduation_term: GraduationTerm;
  graduation_year: number;
  degree_level?: DegreeLevel;
  total_graduates?: number;
  known_outcomes?: number;
  unknown_outcomes?: number;
  knowledge_rate?: number;
  employment_rate?: number;
  continuing_ed_rate?: number;
  seeking_employment_rate?: number;
  not_seeking_rate?: number;
  average_salary?: number;
  median_salary?: number;
  salary_25th_percentile?: number;
  salary_75th_percentile?: number;
  nace_submitted?: boolean;
  nace_submitted_at?: number;
  nace_report_url?: string;
  survey_launched_at?: number;
  survey_closed_at?: number;
  last_reminder_at?: number;
  reminder_count?: number;
  status?: CohortStatus;
  notes?: string;
  created_at: number;
  updated_at: number;
}

export interface GraduateOutcome {
  _id: Id<'graduate_outcomes'>;
  cohort_id: Id<'graduation_cohorts'>;
  institution_id: Id<'universities'>;
  student_id?: Id<'users'>;
  major_id?: Id<'majors'>;
  external_student_id?: string;
  student_email?: string;
  student_name?: string;
  outcome_status: OutcomeStatus;
  outcome_type?: OutcomeType;
  employer_name?: string;
  job_title?: string;
  job_function?: string;
  industry?: string;
  naics_code?: string;
  is_full_time?: boolean;
  salary?: number;
  start_date?: number;
  city?: string;
  state?: string;
  country?: string;
  is_remote?: boolean;
  grad_school_name?: string;
  grad_school_program?: string;
  grad_school_degree?: string;
  is_major_related?: boolean;
  data_source?: OutcomeDataSource;
  is_verified?: boolean;
  confidence_score?: number;
  verified_by?: Id<'users'>;
  verified_at?: number;
  notes?: string;
  created_at: number;
  updated_at: number;
}

// ============================================================================
// MAJOR TYPES
// ============================================================================

export interface Major {
  _id: Id<'majors'>;
  department_id: Id<'departments'>;
  university_id: Id<'universities'>;
  name: string;
  cip_code?: string;
  degree_level?: DegreeLevel;
  common_careers?: string[];
  average_salary?: number;
  job_growth_rate?: number;
  is_active?: boolean;
  created_at: number;
  updated_at: number;
}

// ============================================================================
// COMPUTED/AGGREGATE TYPES
// ============================================================================

/**
 * Computed statistics for a graduation cohort.
 * Used by getCohortWithStats query.
 */
export interface CohortComputedStats {
  total_count: number;
  known_count: number;
  employed_count: number;
  continuing_ed_count: number;
  knowledge_rate: number;
  employment_rate: number;
  average_salary: number | null;
  median_salary: number | null;
}

export interface GraduationCohortWithStats extends GraduationCohort {
  computed_stats: CohortComputedStats;
}
