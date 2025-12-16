// Career Explorer 2.0 Types

import { Id } from 'convex/_generated/dataModel';

// ============================================
// Major Context Types
// ============================================

export type GradSchoolInterest = 'none' | 'considering' | 'planning';

export interface MajorContext {
  major?: string;
  enabled: boolean;
  closeness: number; // 0-100: 0=open, 100=strict
  open_to_unrelated: boolean;
  grad_school_interest?: GradSchoolInterest;
}

// ============================================
// Quiz Types
// ============================================

export type QuizQuestionType = 'single_choice' | 'multiple_choice' | 'scale' | 'ranking';

export interface QuizQuestion {
  id: string;
  category: 'work_style' | 'interests' | 'values' | 'constraints' | 'major_context';
  question: string;
  type: QuizQuestionType;
  options?: { value: string; label: string }[];
  scaleMin?: number;
  scaleMax?: number;
  scaleLabels?: { min: string; max: string };
}

export interface QuizAnswers {
  [questionId: string]: string | string[] | number;
}

export type ConfidenceLevel = 'exploration' | 'leaning' | 'locked_in';

export interface Theme {
  name: string;
  description: string;
  weight: number;
}

export interface RecommendedDirection {
  title: string;
  fit_score: number;
  reasoning: string;
}

export interface RoleToExplore {
  role_id: string;
  title: string;
  reason: string;
  fit_score: number;
}

export type BundleType = 'safe' | 'ambitious' | 'alternative';

export interface PathBundle {
  bundle_type: BundleType;
  name: string;
  path_graph: PathGraph;
  starter_checklist: string[];
}

export interface QuizResult {
  _id: Id<'career_quiz_results'>;
  user_id: Id<'users'>;
  university_id?: Id<'universities'>;
  profile_snapshot_id?: string;
  major_context: MajorContext;
  answers: QuizAnswers;
  themes: Theme[];
  recommended_directions: RecommendedDirection[];
  roles_to_explore: RoleToExplore[];
  suggested_bundles: PathBundle[];
  confidence_level: ConfidenceLevel;
  prompt_version?: string;
  model_used?: string;
  created_at: number;
  updated_at: number;
}

// ============================================
// Path Graph Types
// ============================================

export type NodeType = 'role' | 'bridge' | 'current' | 'target';

export interface PathNode {
  id: string;
  type: NodeType;
  title: string;
  subtitle?: string;
  x: number;
  y: number;
  fit_score?: number;
  skills?: string[];
  is_main_path?: boolean;
  is_saved?: boolean;
}

export interface PathEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  is_main_path?: boolean;
}

export interface PathGraph {
  nodes: PathNode[];
  edges: PathEdge[];
}

// ============================================
// Main Path Types
// ============================================

export type MainPathSource = 'manual' | 'quiz' | 'suggested' | 'search';
export type MainPathStatus = 'draft' | 'published' | 'archived';

export type StepTimeframe = '6m' | '12m' | '24m' | '36m' | 'semester_1' | 'semester_2' | 'summer';

export type StepType = 'role' | 'bridge' | 'project' | 'internship' | 'certification';

export interface StepDetails {
  skills_to_build?: string[];
  projects?: string[];
  certifications?: string[];
  experience_targets?: string[];
}

export interface MainPathStep {
  _id: Id<'career_main_path_steps'>;
  path_id: Id<'career_main_paths'>;
  user_id: Id<'users'>;
  university_id?: Id<'universities'>;
  index: number;
  timeframe: StepTimeframe;
  step_type: StepType;
  role_id?: string;
  title: string;
  details: StepDetails;
  notes?: string;
  created_at: number;
  updated_at: number;
}

export interface MainPath {
  _id: Id<'career_main_paths'>;
  user_id: Id<'users'>;
  university_id?: Id<'universities'>;
  title: string;
  source: MainPathSource;
  status: MainPathStatus;
  version: number;
  published_at?: number;
  major_context?: {
    major?: string;
    closeness: number;
  };
  graph: PathGraph;
  notes?: string;
  created_at: number;
  updated_at: number;
}

// ============================================
// Saved Roles Types
// ============================================

export interface SavedRole {
  _id: Id<'saved_roles'>;
  user_id: Id<'users'>;
  role_id: string;
  role_data: {
    title: string;
    description?: string;
    skills?: string[];
    salary_range?: { min: number; max: number };
    growth_outlook?: string;
  };
  tags?: string[];
  created_at: number;
}

// ============================================
// UI State Types
// ============================================

export type ExplorerView = 'landing' | 'quiz' | 'explore' | 'main-path' | 'saved' | 'results';

export interface ExplorerState {
  currentView: ExplorerView;
  selectedNodeId?: string;
  majorContext: MajorContext;
  pathGraph?: PathGraph;
  isLoading: boolean;
}

// ============================================
// API Types
// ============================================

export interface QuizSubmitRequest {
  answers: QuizAnswers;
  majorContext: MajorContext;
}

export interface QuizSubmitResponse {
  success: boolean;
  result?: QuizResult;
  error?: string;
}

export interface SuggestPathsRequest {
  majorContext: MajorContext;
  quizResultId?: string;
  targetRole?: string;
}

export interface SuggestPathsResponse {
  success: boolean;
  bundles?: PathBundle[];
  error?: string;
}
