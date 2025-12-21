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

export type StepType =
  | 'role'
  | 'bridge'
  | 'project'
  | 'internship'
  | 'certification'
  // New step types for Career Dreamer
  | 'foundation_skill'
  | 'portfolio_project'
  | 'stepping_stone'
  | 'target_role';

// Step type metadata for UI rendering
export const STEP_TYPE_CONFIG: Record<
  StepType,
  { label: string; icon: string; color: string; bgColor: string }
> = {
  role: {
    label: 'Role',
    icon: 'Briefcase',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  bridge: {
    label: 'Bridge',
    icon: 'ArrowRight',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
  },
  project: {
    label: 'Project',
    icon: 'Folder',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  internship: {
    label: 'Internship',
    icon: 'Building',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  certification: {
    label: 'Certification',
    icon: 'Award',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
  foundation_skill: {
    label: 'Foundation Skill',
    icon: 'BookOpen',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
  },
  portfolio_project: {
    label: 'Portfolio Project',
    icon: 'Code',
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
  },
  stepping_stone: {
    label: 'Stepping Stone',
    icon: 'TrendingUp',
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
  },
  target_role: {
    label: 'Target Role',
    icon: 'Target',
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
  },
};

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
// Quiz Draft Types (Save/Resume)
// ============================================

export interface QuizDraft {
  _id: Id<'career_quiz_drafts'>;
  user_id: Id<'users'>;
  answers: QuizAnswers;
  current_step: number;
  started_at: number;
  updated_at: number;
}

// ============================================
// Confidence & Fit Score Types
// ============================================

export type ConfidenceSource = 'verified' | 'inferred' | 'estimated';

export interface FitScoreDriver {
  factor: string;
  score: number; // 0-100
  contribution: number; // Percentage contribution to overall score
  explanation: string;
}

export interface FitScore {
  overall: number; // 0-100
  drivers: FitScoreDriver[];
  confidence: 'high' | 'medium' | 'low';
}

export interface ConfidenceLabel {
  level: 'high' | 'medium' | 'low';
  source: ConfidenceSource;
  tooltip: string;
}

// ============================================
// Role Detail Types
// ============================================

export interface RoleCompensation {
  min: number;
  max: number;
  median?: number;
  currency: string;
  confidence: ConfidenceLabel;
}

export interface RoleSkill {
  name: string;
  required: boolean;
  proficiency?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

export interface RoleCertification {
  name: string;
  issuer?: string;
  required: boolean;
  url?: string;
}

// Role relationship types for career progression
export type RoleRelationshipType =
  | 'entry_level'
  | 'lateral'
  | 'promotion'
  | 'pivot'
  | 'specialization';

// Industry context for role details
export interface RoleIndustryContext {
  industry: string;
  industryName: string;
  careerLevel?: {
    level: number;
    name: string;
  };
  typicalProgression?: string[];
  entryPathType?: string;
  hasInternships?: boolean;
  requiredCredentials?: string[];
}

export interface RoleDetail {
  role_id: string;
  title: string;
  description: string;
  fit_score: FitScore;
  compensation?: RoleCompensation;
  skills: RoleSkill[];
  certifications: RoleCertification[];
  day_in_life?: string;
  growth_outlook?: string;
  related_roles?: {
    role_id: string;
    title: string;
    fit_score: number;
    relationship?: RoleRelationshipType;
  }[];
  // Industry context (new)
  industryContext?: RoleIndustryContext;
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

// ============================================
// Plan Rail Types (V3 Timeline Explorer)
// ============================================

export interface PlacedStep {
  id: string;
  title: string;
  fit_score?: number;
  index: number;
  role_id?: string;
}

export interface AnchorNode {
  id: string;
  title: string;
  subtitle?: string;
  source: 'quiz' | 'profile' | 'default';
}

// ============================================
// Career Explorer V4 - 3-Step Wizard Types
// ============================================

export interface StartingRole {
  id: string;
  title: string;
  category?: string;
}

export interface CareerExplorerState {
  _id?: string;
  user_id: string;
  university_id?: string;

  // Step 1: Starting Role
  starting_role?: StartingRole;

  // Step 2: Skills
  skills_have?: string[];
  skills_want?: string[];

  // Step 3: Career Path (placed steps)
  placed_steps?: PlacedStep[];

  // Wizard progress
  current_step: number; // 1, 2, 3, or 4
  completed_steps: number[];

  // Timestamps
  created_at: number;
  updated_at: number;
}

export interface RoleSearchResult {
  id: string;
  title: string;
  category: string;
  skills?: string[];
}

export interface SkillsSuggestion {
  required: string[];
  recommended: string[];
  transferable: string[];
}
