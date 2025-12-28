/**
 * Universal Commenting System Components
 *
 * This module provides a complete commenting system for advisor feedback
 * on student artifacts (resumes, cover letters, goals, applications, etc.)
 */

// Types
export * from './types';

// Core Components
export { CommentButton } from './CommentButton';
export { CommentInput } from './CommentInput';
export { CommentItem } from './CommentItem';
export { CommentThread, CommentThreadList } from './CommentThread';

// Document Comments
export { CommentSidebar, CommentSidebarToggle } from './CommentSidebar';

// Section Comments
export {
  CommentableField,
  SectionCommentIndicator,
  SectionCommentWrapper,
} from './SectionCommentIndicator';
