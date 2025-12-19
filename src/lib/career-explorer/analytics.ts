/**
 * Career Explorer Analytics Event Definitions
 *
 * Provides standardized event names and payload types for tracking
 * user interactions in the Career Explorer feature.
 */

// ============================================
// Event Name Constants
// ============================================

export const CAREER_EXPLORER_EVENTS = {
  // Quiz Events
  QUIZ_STARTED: 'career_explorer.quiz_started',
  QUIZ_STEP_COMPLETED: 'career_explorer.quiz_step_completed',
  QUIZ_ABANDONED: 'career_explorer.quiz_abandoned',
  QUIZ_RESUMED: 'career_explorer.quiz_resumed',
  QUIZ_COMPLETED: 'career_explorer.quiz_completed',
  QUIZ_DRAFT_SAVED: 'career_explorer.quiz_draft_saved',

  // Role Exploration Events
  ROLE_VIEWED: 'career_explorer.role_viewed',
  ROLE_SAVED: 'career_explorer.role_saved',
  ROLE_UNSAVED: 'career_explorer.role_unsaved',
  ROLE_DETAIL_TAB_VIEWED: 'career_explorer.role_detail_tab_viewed',

  // Galaxy View Events
  GALAXY_VIEW_LOADED: 'career_explorer.galaxy_view_loaded',
  GALAXY_FILTER_CHANGED: 'career_explorer.galaxy_filter_changed',
  GALAXY_VIEW_TOGGLED: 'career_explorer.galaxy_view_toggled',
  GALAXY_NODE_FOCUSED: 'career_explorer.galaxy_node_focused',

  // Path Editor Events
  PATH_STEP_ADDED: 'career_explorer.path_step_added',
  PATH_STEP_UPDATED: 'career_explorer.path_step_updated',
  PATH_STEP_DELETED: 'career_explorer.path_step_deleted',
  PATH_STEP_REORDERED: 'career_explorer.path_step_reordered',
  PATH_STEP_CONVERTED: 'career_explorer.path_step_converted',
  PATH_UNDO: 'career_explorer.path_undo',
  PATH_REDO: 'career_explorer.path_redo',
  PATH_PUBLISHED: 'career_explorer.path_published',
  PATH_EXPORTED: 'career_explorer.path_exported',

  // Action Plan Events
  STUDY_PLAN_VIEWED: 'career_explorer.study_plan_viewed',
  STUDY_PLAN_GENERATED: 'career_explorer.study_plan_generated',
  PORTFOLIO_PROJECT_VIEWED: 'career_explorer.portfolio_project_viewed',
  INTERVIEW_PREP_VIEWED: 'career_explorer.interview_prep_viewed',
} as const;

export type CareerExplorerEventName =
  (typeof CAREER_EXPLORER_EVENTS)[keyof typeof CAREER_EXPLORER_EVENTS];

// ============================================
// Event Payload Types
// ============================================

export interface QuizStartedPayload {
  has_draft: boolean;
  prefilled_count: number;
}

export interface QuizStepCompletedPayload {
  step_index: number;
  step_id: string;
  category: string;
  time_on_step_ms: number;
}

export interface QuizAbandonedPayload {
  steps_completed: number;
  total_steps: number;
  last_step_id: string;
}

export interface QuizResumedPayload {
  steps_completed: number;
  draft_age_hours: number;
}

export interface QuizCompletedPayload {
  total_time_ms: number;
  roles_generated: number;
  top_fit_score: number;
}

export interface RoleViewedPayload {
  role_id: string;
  role_title: string;
  fit_score?: number;
  source: 'galaxy' | 'list' | 'search' | 'related';
}

export interface RoleSavedPayload {
  role_id: string;
  role_title: string;
  fit_score?: number;
}

export interface RoleDetailTabViewedPayload {
  role_id: string;
  tab: 'overview' | 'compensation' | 'skills' | 'day_in_life' | 'certifications' | 'related';
}

export interface GalaxyViewLoadedPayload {
  total_nodes: number;
  saved_count: number;
  main_path_count: number;
}

export interface GalaxyFilterChangedPayload {
  filter_mode: 'all' | 'main_path' | 'saved';
  visible_nodes: number;
}

export interface GalaxyViewToggledPayload {
  view_type: 'galaxy' | 'list';
}

export interface PathStepAddedPayload {
  step_type: string;
  timeframe: string;
  has_skills: boolean;
  has_projects: boolean;
  has_certifications: boolean;
}

export interface PathStepUpdatedPayload {
  step_id: string;
  step_type: string;
  fields_changed: string[];
}

export interface PathStepDeletedPayload {
  step_id: string;
  step_type: string;
  was_converted_to_goal: boolean;
}

export interface PathStepReorderedPayload {
  steps_count: number;
  from_index: number;
  to_index: number;
}

export interface PathStepConvertedPayload {
  step_id: string;
  step_type: string;
  goal_id: string;
  checklist_items_count: number;
}

export interface PathExportedPayload {
  format: 'pdf' | 'json' | 'image';
  steps_count: number;
}

// ============================================
// Analytics Helper Functions
// ============================================

/**
 * Track a Career Explorer event.
 * This is a placeholder that integrates with your analytics provider.
 */
export function trackCareerExplorerEvent(
  eventName: CareerExplorerEventName,
  payload: Record<string, unknown>,
): void {
  // In production, this would send to your analytics provider
  // Examples: Mixpanel, Amplitude, PostHog, etc.

  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.debug(`[Analytics] ${eventName}`, payload);
  }

  // Example integrations:
  // mixpanel.track(eventName, payload);
  // amplitude.track(eventName, payload);
  // posthog.capture(eventName, payload);
}

/**
 * Track quiz started event
 */
export function trackQuizStarted(payload: QuizStartedPayload): void {
  trackCareerExplorerEvent(
    CAREER_EXPLORER_EVENTS.QUIZ_STARTED,
    payload as unknown as Record<string, unknown>,
  );
}

/**
 * Track quiz step completed event
 */
export function trackQuizStepCompleted(payload: QuizStepCompletedPayload): void {
  trackCareerExplorerEvent(
    CAREER_EXPLORER_EVENTS.QUIZ_STEP_COMPLETED,
    payload as unknown as Record<string, unknown>,
  );
}

/**
 * Track quiz completed event
 */
export function trackQuizCompleted(payload: QuizCompletedPayload): void {
  trackCareerExplorerEvent(
    CAREER_EXPLORER_EVENTS.QUIZ_COMPLETED,
    payload as unknown as Record<string, unknown>,
  );
}

/**
 * Track role viewed event
 */
export function trackRoleViewed(payload: RoleViewedPayload): void {
  trackCareerExplorerEvent(
    CAREER_EXPLORER_EVENTS.ROLE_VIEWED,
    payload as unknown as Record<string, unknown>,
  );
}

/**
 * Track role saved event
 */
export function trackRoleSaved(payload: RoleSavedPayload): void {
  trackCareerExplorerEvent(
    CAREER_EXPLORER_EVENTS.ROLE_SAVED,
    payload as unknown as Record<string, unknown>,
  );
}

/**
 * Track path step added event
 */
export function trackPathStepAdded(payload: PathStepAddedPayload): void {
  trackCareerExplorerEvent(
    CAREER_EXPLORER_EVENTS.PATH_STEP_ADDED,
    payload as unknown as Record<string, unknown>,
  );
}

/**
 * Track path step converted to goal event
 */
export function trackPathStepConverted(payload: PathStepConvertedPayload): void {
  trackCareerExplorerEvent(
    CAREER_EXPLORER_EVENTS.PATH_STEP_CONVERTED,
    payload as unknown as Record<string, unknown>,
  );
}

/**
 * Track galaxy view loaded event
 */
export function trackGalaxyViewLoaded(payload: GalaxyViewLoadedPayload): void {
  trackCareerExplorerEvent(
    CAREER_EXPLORER_EVENTS.GALAXY_VIEW_LOADED,
    payload as unknown as Record<string, unknown>,
  );
}

/**
 * Track galaxy filter changed event
 */
export function trackGalaxyFilterChanged(payload: GalaxyFilterChangedPayload): void {
  trackCareerExplorerEvent(
    CAREER_EXPLORER_EVENTS.GALAXY_FILTER_CHANGED,
    payload as unknown as Record<string, unknown>,
  );
}

/**
 * Track role detail tab viewed event
 */
export function trackRoleDetailTabViewed(payload: RoleDetailTabViewedPayload): void {
  trackCareerExplorerEvent(
    CAREER_EXPLORER_EVENTS.ROLE_DETAIL_TAB_VIEWED,
    payload as unknown as Record<string, unknown>,
  );
}
