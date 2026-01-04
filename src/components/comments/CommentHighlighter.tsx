'use client';

import type { Id } from 'convex/_generated/dataModel';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { CommentWithAuthor } from '@/components/advisor/comments/types';
import { cn } from '@/lib/utils';

/**
 * Props for CommentHighlighter component
 */
export interface CommentHighlighterProps {
  /** The document content to wrap and potentially highlight */
  children: React.ReactNode;
  /** List of inline comments with position data */
  comments: CommentWithAuthor[];
  /** Currently active/focused comment ID */
  activeCommentId?: Id<'advisor_comments'>;
  /** Callback when a highlighted section is clicked */
  onCommentClick?: (commentId: Id<'advisor_comments'>) => void;
  /** Whether the comment sidebar is open (enables highlights) */
  sidebarOpen?: boolean;
  /** CSS class for the container */
  className?: string;
}

/**
 * CommentHighlighter Component
 *
 * Wraps document content and adds visual highlights for commented text sections.
 * When the sidebar is open, commented text is highlighted with a yellow background.
 * Clicking on a highlight focuses the corresponding comment in the sidebar.
 *
 * This is a simplified highlighter that shows indicator dots rather than
 * trying to highlight within editable form fields.
 */
export function CommentHighlighter({
  children,
  comments,
  activeCommentId,
  onCommentClick,
  sidebarOpen = false,
  className,
}: CommentHighlighterProps) {
  // Filter to only inline comments with position data
  const inlineComments = useMemo(() => {
    return comments.filter((c) => c.comment_type === 'inline' && c.inline_position?.selection_text);
  }, [comments]);

  // Don't render highlights if sidebar is closed
  if (!sidebarOpen || inlineComments.length === 0) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={cn('relative', className)}>
      {children}

      {/* Floating indicators for commented sections */}
      <CommentIndicators
        comments={inlineComments}
        activeCommentId={activeCommentId}
        onCommentClick={onCommentClick}
      />
    </div>
  );
}

/**
 * Props for CommentIndicators
 */
interface CommentIndicatorsProps {
  comments: CommentWithAuthor[];
  activeCommentId?: Id<'advisor_comments'>;
  onCommentClick?: (commentId: Id<'advisor_comments'>) => void;
}

/**
 * CommentIndicators Component
 *
 * Shows small indicator badges for comments, grouped by section.
 */
function CommentIndicators({ comments, activeCommentId, onCommentClick }: CommentIndicatorsProps) {
  // Group comments by section
  const bySection = useMemo(() => {
    const sections = new Map<string, CommentWithAuthor[]>();

    for (const comment of comments) {
      const sectionId = comment.inline_position?.section_id || 'general';
      const existing = sections.get(sectionId) || [];
      existing.push(comment);
      sections.set(sectionId, existing);
    }

    return sections;
  }, [comments]);

  return (
    <div className="absolute right-0 top-0 w-6 pointer-events-none">
      {Array.from(bySection.entries()).map(([sectionId, sectionComments]) => (
        <SectionIndicator
          key={sectionId}
          sectionId={sectionId}
          comments={sectionComments}
          activeCommentId={activeCommentId}
          onCommentClick={onCommentClick}
        />
      ))}
    </div>
  );
}

/**
 * Props for SectionIndicator
 */
interface SectionIndicatorProps {
  sectionId: string;
  comments: CommentWithAuthor[];
  activeCommentId?: Id<'advisor_comments'>;
  onCommentClick?: (commentId: Id<'advisor_comments'>) => void;
}

/**
 * SectionIndicator Component
 *
 * A small badge showing comment count for a section.
 */
function SectionIndicator({
  sectionId,
  comments,
  activeCommentId,
  onCommentClick,
}: SectionIndicatorProps) {
  const isActive = comments.some((c) => c._id === activeCommentId);
  const unresolvedCount = comments.filter((c) => c.status === 'active').length;

  const handleClick = () => {
    // Click the first unresolved comment, or the first comment
    const targetComment = comments.find((c) => c.status === 'active') || comments[0];
    if (targetComment && onCommentClick) {
      onCommentClick(targetComment._id);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'pointer-events-auto inline-flex items-center justify-center',
        'w-5 h-5 rounded-full text-xs font-medium transition-all',
        'shadow-sm border focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1',
        isActive
          ? 'bg-primary-500 text-white border-primary-600 scale-110'
          : unresolvedCount > 0
            ? 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200'
            : 'bg-neutral-100 text-neutral-500 border-neutral-200 hover:bg-neutral-200',
      )}
      title={`${unresolvedCount > 0 ? unresolvedCount + ' open' : comments.length} comments in ${sectionId}`}
    >
      {unresolvedCount > 0 ? unresolvedCount : comments.length}
    </button>
  );
}

/**
 * useHighlightedText Hook
 *
 * A utility hook that can be used to apply highlights to specific text
 * within a document. This is useful for more advanced highlighting scenarios.
 *
 * Note: This is a simplified implementation. For production use with
 * contenteditable or complex DOM structures, consider using a library
 * like rangy or a custom text overlay approach.
 */
export function useHighlightedText(
  containerRef: React.RefObject<HTMLElement>,
  comments: CommentWithAuthor[],
  activeCommentId?: Id<'advisor_comments'>,
) {
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  const highlightComment = useCallback(
    (commentId: Id<'advisor_comments'>) => {
      const comment = comments.find((c) => c._id === commentId);
      if (!comment?.inline_position?.selection_text) return;

      // Find and scroll to the text in the document
      const container = containerRef.current;
      if (!container) return;

      const text = comment.inline_position.selection_text;
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);

      let node: Node | null;
      while ((node = walker.nextNode())) {
        const content = node.textContent || '';
        if (content.includes(text)) {
          // Found the text - scroll parent into view
          const parent = node.parentElement;
          if (parent) {
            parent.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Briefly highlight the parent
            parent.classList.add('bg-yellow-200');
            // Clear any existing timeout before setting a new one
            if (highlightTimeoutRef.current) {
              clearTimeout(highlightTimeoutRef.current);
            }
            highlightTimeoutRef.current = setTimeout(() => {
              parent.classList.remove('bg-yellow-200');
            }, 2000);
          }
          break;
        }
      }
    },
    [comments, containerRef],
  );

  // Auto-highlight when activeCommentId changes
  useEffect(() => {
    if (activeCommentId) {
      highlightComment(activeCommentId);
    }
  }, [activeCommentId, highlightComment]);

  return { highlightComment };
}
