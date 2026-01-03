'use client';

import { useUser } from '@clerk/nextjs';
import type { Id } from 'convex/_generated/dataModel';
import { MessageSquare, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { CommentInput } from '@/components/advisor/comments/CommentInput';
import type {
  CommentFilter,
  CommentThread,
  CommentVisibility,
} from '@/components/advisor/comments/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useStudentComments } from '@/hooks/useStudentComments';

import { StudentCommentThread } from './StudentCommentThread';

/**
 * Props for StudentCommentSidebar component
 */
export interface StudentCommentSidebarProps {
  targetType: 'resume' | 'cover_letter';
  targetId: Id<'resumes'> | Id<'cover_letters'>;
  onClose: () => void;
  activeCommentId?: Id<'advisor_comments'>;
  onCommentClick?: (commentId: Id<'advisor_comments'>) => void;
}

/**
 * StudentCommentSidebar Component
 *
 * A sidebar panel for students to view and reply to advisor comments.
 * Similar to Google Docs commenting experience.
 *
 * Features:
 * - View all shared comments from advisors
 * - Reply to any comment
 * - React with emojis
 * - Filter by status (All, Open, Resolved)
 *
 * Students CANNOT:
 * - Create new root comments
 * - Resolve/unresolve comments
 * - Pin comments
 * - See advisor-only comments
 */
export function StudentCommentSidebar({
  targetType,
  targetId,
  onClose,
  activeCommentId,
  onCommentClick,
}: StudentCommentSidebarProps) {
  const { user } = useUser();
  const [filter, setFilter] = useState<CommentFilter>('all');

  const currentUserId = user?.id ?? '';

  // Get ID props for the hook
  const idProps =
    targetType === 'resume'
      ? { resumeId: targetId as Id<'resumes'> }
      : { coverLetterId: targetId as Id<'cover_letters'> };

  // Fetch comments
  const { threads, isLoading, totalCount, unresolvedCount, replyToComment, toggleReaction } =
    useStudentComments({
      targetType,
      ...idProps,
      includeResolved: true,
    });

  // Filter threads based on selected filter
  const filteredThreads = useMemo(() => {
    return threads.filter((thread) => {
      switch (filter) {
        case 'unresolved':
          return thread.root.status === 'active';
        case 'resolved':
          return thread.root.status === 'resolved';
        default:
          return true;
      }
    });
  }, [threads, filter]);

  // Count for each filter
  const filterCounts = useMemo(() => {
    return {
      all: threads.length,
      unresolved: threads.filter((t) => t.root.status === 'active').length,
      resolved: threads.filter((t) => t.root.status === 'resolved').length,
    };
  }, [threads]);

  // Handle reply
  const handleReply = useCallback(
    async (parentId: Id<'advisor_comments'>, body: string) => {
      await replyToComment(parentId, body);
    },
    [replyToComment],
  );

  // Handle reaction
  const handleReaction = useCallback(
    async (commentId: Id<'advisor_comments'>, emoji: string) => {
      await toggleReaction(commentId, emoji);
    },
    [toggleReaction],
  );

  return (
    <div className="w-80 border-l bg-white flex flex-col h-full shadow-lg" data-comment-ui>
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between shrink-0 bg-gradient-to-r from-primary-50 to-white">
        <h3 className="font-semibold flex items-center gap-2 text-primary-900">
          <MessageSquare className="h-4 w-4" />
          Advisor Feedback
          {totalCount > 0 && (
            <span className="text-sm font-normal text-primary-600">
              ({unresolvedCount > 0 ? `${unresolvedCount} open` : `${totalCount} total`})
            </span>
          )}
        </h3>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Filters - simplified for students (no "Internal" filter) */}
      <div className="p-2 border-b flex gap-1 flex-wrap shrink-0">
        {(['all', 'unresolved', 'resolved'] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setFilter(f)}
          >
            {f === 'all' && `All (${filterCounts.all})`}
            {f === 'unresolved' && `Open (${filterCounts.unresolved})`}
            {f === 'resolved' && `Resolved (${filterCounts.resolved})`}
          </Button>
        ))}
      </div>

      {/* Comments list */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {isLoading ? (
            <div className="py-8 text-center text-neutral-500">Loading feedback...</div>
          ) : filteredThreads.length === 0 ? (
            <div className="py-8 text-center text-neutral-500">
              {filter === 'all' ? (
                <>
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 text-neutral-300" />
                  <p className="font-medium">No feedback yet</p>
                  <p className="text-sm mt-1">
                    Your advisor will leave comments here when they review your document.
                  </p>
                </>
              ) : (
                <p>No {filter} comments.</p>
              )}
            </div>
          ) : (
            <div className="space-y-4 divide-y divide-neutral-100">
              {filteredThreads.map((thread) => (
                <div key={thread.root._id} className="pt-4 first:pt-0">
                  <StudentCommentThread
                    thread={thread}
                    currentUserId={currentUserId}
                    onReply={handleReply}
                    onReact={handleReaction}
                    isActive={activeCommentId === thread.root._id}
                    onClick={() => onCommentClick?.(thread.root._id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Bottom info for students */}
      {totalCount === 0 && !isLoading && (
        <div className="p-4 border-t bg-neutral-50 text-center text-sm text-neutral-500 shrink-0">
          <p>Submit your resume for review to receive advisor feedback.</p>
        </div>
      )}
    </div>
  );
}

/**
 * StudentCommentSidebarToggle Component
 *
 * A button to toggle the student comment sidebar visibility.
 */
interface StudentCommentSidebarToggleProps {
  isOpen: boolean;
  onClick: () => void;
  commentCount?: number;
  unresolvedCount?: number;
}

export function StudentCommentSidebarToggle({
  isOpen,
  onClick,
  commentCount = 0,
  unresolvedCount = 0,
}: StudentCommentSidebarToggleProps) {
  // Don't show if no comments
  if (commentCount === 0) return null;

  return (
    <Button
      variant={isOpen ? 'secondary' : 'outline'}
      size="sm"
      onClick={onClick}
      className="relative"
    >
      <MessageSquare className="h-4 w-4 mr-2" />
      Feedback
      <span
        className={`ml-1 rounded-full px-1.5 text-xs ${
          unresolvedCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-neutral-100 text-neutral-600'
        }`}
      >
        {unresolvedCount > 0 ? unresolvedCount : commentCount}
      </span>
    </Button>
  );
}
