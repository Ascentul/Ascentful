/**
 * Interview Practice Types
 *
 * TypeScript types for the interview practice feature.
 */

import { Id } from 'convex/_generated/dataModel';

// ============================================================================
// ROLE PROFILE TYPES
// ============================================================================

export interface Competency {
  id: string;
  name: string;
  weight: number;
  description?: string;
}

export type InputType = 'title_company' | 'jd_text' | 'jd_link';
export type InterviewType = 'behavioral' | 'technical' | 'case' | 'mixed';

export interface RoleProfile {
  _id: Id<'interview_role_profiles'>;
  user_id: Id<'users'>;
  university_id?: Id<'universities'>;
  input_type: InputType;
  job_title: string;
  company_name?: string;
  job_level?: string;
  job_description_text?: string;
  job_url?: string;
  role_summary?: string;
  competencies?: Competency[];
  extracted_keywords?: string[];
  interview_type?: InterviewType;
  source_notes?: string;
  created_at: number;
  updated_at: number;
}

export interface RoleProfileInput {
  input_type: InputType;
  job_title: string;
  company_name?: string;
  job_level?: string;
  job_description_text?: string;
  job_url?: string;
}

/**
 * Role snapshot for sessions without saved role profiles
 * Same structure as RoleProfile but without _id, user_id, etc.
 */
export interface RoleSnapshot {
  input_type: InputType;
  job_title: string;
  company_name?: string;
  job_level?: string;
  job_description_text?: string;
  job_url?: string;
  role_summary?: string;
  competencies?: Competency[];
  extracted_keywords?: string[];
  interview_type?: InterviewType;
}

export interface RoleProfileAnalysis {
  role_summary: string;
  competencies: Competency[];
  extracted_keywords: string[];
  interview_type: InterviewType;
}

// ============================================================================
// SESSION TYPES
// ============================================================================

export type SessionStatus = 'setup' | 'in_progress' | 'completed' | 'abandoned';
export type SessionMode = 'neutral' | 'supportive' | 'pressure';
export type HireSignal = 'strong_yes' | 'yes' | 'mixed' | 'no' | 'strong_no';

export interface DimensionScores {
  communication?: number;
  relevance?: number;
  specificity?: number;
  structure?: number;
  confidence?: number;
}

export interface SessionConsent {
  mic: boolean;
  camera: boolean;
  timestamp: number;
}

export interface AgentState {
  coveredCompetencies: Record<string, number>;
  openThreads: Array<{
    id: string;
    topic: string;
    createdFromTurnIndex: number;
    priority: number;
  }>;
  followUpQueue: Array<{
    threadId: string;
    suggestedQuestionType: string;
    trigger: string;
  }>;
  difficultyLevel: number;
  evidenceGaps: string[];
  questionHistory: Array<{
    question: string;
    type: string;
  }>;
}

export interface InterviewSession {
  _id: Id<'interview_practice_sessions'>;
  user_id: Id<'users'>;
  university_id?: Id<'universities'>;
  // Either role_profile_id OR role_snapshot (one must be present)
  role_profile_id?: Id<'interview_role_profiles'>;
  role_snapshot?: RoleSnapshot;
  status: SessionStatus;
  mode: SessionMode;
  camera_enabled: boolean;
  question_count_target: number;
  current_question_index: number;
  agent_state?: AgentState;
  consent: SessionConsent;
  started_at?: number;
  ended_at?: number;
  total_duration_ms?: number;
  overall_score?: number;
  dimension_scores?: DimensionScores;
  coach_summary?: string;
  key_takeaways?: string[];
  improvement_priorities?: string[];
  hire_signal?: HireSignal;
  created_at: number;
  updated_at: number;
  // Joined data - normalized role info (from profile or snapshot)
  role_profile?: RoleProfile | RoleSnapshot | null;
}

export interface SessionCreateInput {
  // Either role_profile_id OR role_snapshot (one must be present)
  role_profile_id?: Id<'interview_role_profiles'>;
  role_snapshot?: RoleSnapshot;
  mode: SessionMode;
  camera_enabled: boolean;
  question_count_target: number;
  consent: SessionConsent;
}

// ============================================================================
// TURN TYPES
// ============================================================================

export type QuestionType =
  | 'behavioral'
  | 'technical'
  | 'situational'
  | 'role_specific'
  | 'culture'
  | 'follow_up';

export interface TranscriptMeta {
  words_per_minute?: number;
  filler_count?: number;
  filler_words?: Record<string, number>;
  pauses?: {
    count: number;
    avg_ms: number;
    max_ms: number;
  };
  duration_sec?: number;
}

export interface ContentSignals {
  metrics_count?: number;
  examples_count?: number;
  star_structure_score?: number;
  relevance_score?: number;
  role_relevance_score?: number;
}

export interface TurnScores {
  communication?: number;
  specificity?: number;
  structure?: number;
  role_fit?: number;
  overall?: number;
}

export interface InterviewTurn {
  _id: Id<'interview_practice_turns'>;
  session_id: Id<'interview_practice_sessions'>;
  user_id: Id<'users'>;
  university_id?: Id<'universities'>;
  turn_index: number;
  question_text: string;
  question_type: QuestionType;
  question_intent?: string;
  target_competencies?: string[];
  evaluation_focus?: string[];
  tts_audio_url?: string;
  user_audio_storage_id?: Id<'_storage'>;
  transcript_text?: string;
  response_duration_ms?: number;
  transcript_meta?: TranscriptMeta;
  content_signals?: ContentSignals;
  scores?: TurnScores;
  strengths?: string[];
  improvements?: string[];
  ideal_answer?: string;
  keywords_to_include?: string[];
  follow_up_threads_created?: string[];
  follow_up_threads_resolved?: string[];
  asked_at: number;
  answered_at?: number;
  created_at: number;
  updated_at: number;
}

export interface GeneratedQuestion {
  question_text: string;
  question_type: QuestionType;
  question_intent: string;
  target_competencies: string[];
  evaluation_focus: string[];
}

export interface ResponseEvaluation {
  scores: TurnScores;
  content_signals: ContentSignals;
  strengths: string[];
  improvements: string[];
  ideal_answer: string;
  keywords_to_include: string[];
}

// ============================================================================
// REPORT TYPES
// ============================================================================

export interface SessionReport extends InterviewSession {
  turns: InterviewTurn[];
  student?: {
    _id: Id<'users'>;
    name: string;
    email: string;
  } | null;
}

export interface SessionSummary {
  overall_score: number;
  dimension_scores: DimensionScores;
  hire_signal: HireSignal;
  coach_summary: string;
  key_takeaways: string[];
  improvement_priorities: string[];
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

export interface RoleProfileResponse {
  profileId: string;
  profile: RoleProfile;
}

export interface SessionResponse {
  sessionId: string;
  session: InterviewSession;
}

export interface QuestionResponse {
  turnId: string;
  question: GeneratedQuestion;
  ttsAudioUrl?: string;
}

export interface TurnSubmitResponse {
  turnId: string;
  transcript: string | null;
  nextQuestionAvailable: boolean;
  isLastQuestion: boolean;
}

export interface SessionCompleteResponse {
  sessionId: string;
  summary: SessionSummary;
}
