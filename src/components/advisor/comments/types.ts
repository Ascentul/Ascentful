/**
 * Types for the Universal Commenting System
 *
 * These types mirror the Convex schema and provide TypeScript interfaces
 * for the frontend components.
 */

import type { Doc, Id } from 'convex/_generated/dataModel';

// ============================================================================
// Comment Target Types
// ============================================================================

export type CommentTargetType =
  | 'resume'
  | 'cover_letter'
  | 'goal'
  | 'application'
  | 'session'
  | 'career_plan'
  | 'skill'
  | 'linkedin_profile'
  | 'interview_recording'
  | 'profile';

export type CommentType = 'inline' | 'section' | 'media' | 'general';

export type CommentVisibility = 'shared' | 'advisor_only';

export type CommentStatus = 'active' | 'resolved' | 'archived';

// ============================================================================
// Position Types
// ============================================================================

/**
 * Position data for inline comments (text selection)
 */
export interface InlinePosition {
  selection_start: number;
  selection_end: number;
  selection_text: string;
  section_id?: string;
  field_path?: string;
  page_number?: number;
}

/**
 * Position data for section comments
 */
export interface SectionPosition {
  target_section: string;
  field_label?: string;
}

/**
 * Position data for media comments (timestamps)
 */
export interface MediaPosition {
  timestamp_ms: number;
  duration_ms?: number;
}

// ============================================================================
// Reaction Types
// ============================================================================

export interface CommentReaction {
  user_id: Id<'users'>;
  emoji: string;
  created_at: number;
}

// ============================================================================
// Author Types
// ============================================================================

export interface CommentAuthor {
  id: Id<'users'>;
  name: string;
  email: string;
  avatarUrl?: string;
  role: string;
}

// ============================================================================
// Comment Types
// ============================================================================

/**
 * Base comment from database
 */
export type Comment = Doc<'advisor_comments'>;

/**
 * Comment enriched with author info
 */
export interface CommentWithAuthor extends Comment {
  author: CommentAuthor;
  replyCount?: number;
}

/**
 * Thread structure for nested comments
 */
export interface CommentThread {
  root: CommentWithAuthor;
  replies: CommentWithAuthor[];
}

// ============================================================================
// Component Props Types
// ============================================================================

/**
 * Props for CommentThread component
 */
export interface CommentThreadProps {
  thread: CommentThread;
  currentUserId: string; // Clerk user ID
  isAdvisor: boolean;
  onReply: (parentId: Id<'advisor_comments'>, body: string, visibility: CommentVisibility) => void;
  onResolve: (commentId: Id<'advisor_comments'>) => void;
  onUnresolve: (commentId: Id<'advisor_comments'>) => void;
  onEdit: (commentId: Id<'advisor_comments'>, body: string, version: number) => void;
  onDelete: (commentId: Id<'advisor_comments'>) => void;
  onReact: (commentId: Id<'advisor_comments'>, emoji: string) => void;
  onPin: (commentId: Id<'advisor_comments'>) => void;
  collapsed?: boolean;
}

/**
 * Props for CommentItem component
 */
export interface CommentItemProps {
  comment: CommentWithAuthor;
  currentUserId: string; // Clerk user ID
  isAdvisor: boolean;
  isRoot?: boolean;
  depth?: number;
  onReply: () => void;
  onResolve: () => void;
  onUnresolve: () => void;
  onEdit: (body: string) => void;
  onDelete: () => void;
  onReact: (emoji: string) => void;
  onPin?: () => void;
}

/**
 * Props for CommentInput component
 */
export interface CommentInputProps {
  onSubmit: (body: string, visibility: CommentVisibility) => void;
  onCancel?: () => void;
  placeholder?: string;
  isReply?: boolean;
  isAdvisor: boolean;
  defaultVisibility?: CommentVisibility;
  autoFocus?: boolean;
  isSubmitting?: boolean;
}

/**
 * Props for CommentButton component
 */
export interface CommentButtonProps {
  targetType: CommentTargetType;
  targetId: string;
  studentId: Id<'users'>;
  count?: number;
  unresolvedCount?: number;
  variant?: 'default' | 'icon' | 'badge';
  section?: string; // For section comments
}

/**
 * Props for CommentSidebar component
 */
export interface CommentSidebarProps {
  targetType: 'resume' | 'cover_letter';
  targetId: Id<'resumes'> | Id<'cover_letters'>;
  studentId: Id<'users'>;
  onClose: () => void;
  activeCommentId?: Id<'advisor_comments'>;
  onCommentClick?: (commentId: Id<'advisor_comments'>) => void;
  selection?: TextSelection | null;
  onClearSelection?: () => void;
}

/**
 * Props for SectionCommentIndicator component
 */
export interface SectionCommentIndicatorProps {
  targetType: CommentTargetType;
  targetId: string;
  studentId: Id<'users'>;
  section: string;
  sectionLabel?: string;
  count?: number;
  unresolvedCount?: number;
}

// ============================================================================
// Hook Types
// ============================================================================

/**
 * Text selection state for inline comments
 */
export interface TextSelection {
  text: string;
  start: number;
  end: number;
  sectionId?: string;
  fieldPath?: string;
  pageNumber?: number;
  rect?: DOMRect;
}

/**
 * Return type for useCommentSelection hook
 */
export interface UseCommentSelectionReturn {
  selection: TextSelection | null;
  isSelecting: boolean;
  clearSelection: () => void;
}

/**
 * Options for useComments hook
 */
export interface UseCommentsOptions {
  targetType: CommentTargetType;
  resumeId?: Id<'resumes'>;
  coverLetterId?: Id<'cover_letters'>;
  goalId?: Id<'goals'>;
  applicationId?: Id<'applications'>;
  sessionId?: Id<'advisor_sessions'>;
  careerPlanId?: Id<'career_main_paths'>;
  includeResolved?: boolean;
  includeReplies?: boolean;
}

/**
 * Return type for useComments hook
 */
export interface UseCommentsReturn {
  comments: CommentWithAuthor[];
  threads: CommentThread[];
  isLoading: boolean;
  createComment: (args: CreateCommentArgs) => Promise<void>;
  updateComment: (
    commentId: Id<'advisor_comments'>,
    body: string,
    version: number,
  ) => Promise<void>;
  resolveComment: (commentId: Id<'advisor_comments'>) => Promise<void>;
  unresolveComment: (commentId: Id<'advisor_comments'>) => Promise<void>;
  archiveComment: (commentId: Id<'advisor_comments'>) => Promise<void>;
  toggleReaction: (commentId: Id<'advisor_comments'>, emoji: string) => Promise<void>;
  togglePin: (commentId: Id<'advisor_comments'>) => Promise<void>;
}

/**
 * Arguments for creating a comment
 */
export interface CreateCommentArgs {
  studentId: Id<'users'>;
  targetType: CommentTargetType;
  commentType: CommentType;
  body: string;
  visibility: CommentVisibility;
  resumeId?: Id<'resumes'>;
  coverLetterId?: Id<'cover_letters'>;
  goalId?: Id<'goals'>;
  applicationId?: Id<'applications'>;
  sessionId?: Id<'advisor_sessions'>;
  careerPlanId?: Id<'career_main_paths'>;
  inlinePosition?: InlinePosition;
  sectionPosition?: SectionPosition;
  mediaPosition?: MediaPosition;
  parentId?: Id<'advisor_comments'>;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Comment count for badges
 */
export interface CommentCount {
  total: number;
  unresolved: number;
}

/**
 * Filter options for comment lists
 */
export type CommentFilter = 'all' | 'unresolved' | 'advisor' | 'resolved';

/**
 * Grouped reactions for display
 */
export interface GroupedReaction {
  emoji: string;
  count: number;
  userIds: Id<'users'>[];
  hasCurrentUser: boolean;
}
