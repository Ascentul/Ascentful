'use client';

import { useUser } from '@clerk/nextjs';
import type { Id } from 'convex/_generated/dataModel';
import { Filter, MessageSquare, Plus, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useComments, useInlineComments } from '@/hooks/useComments';
import { cn } from '@/lib/utils';

import { CommentInput } from './CommentInput';
import { CommentThreadList } from './CommentThread';
import type { CommentFilter, CommentSidebarProps, CommentThread, CommentVisibility } from './types';

/**
 * CommentSidebar Component
 *
 * A sidebar panel for document inline comments (Google Docs style).
 * Shows:
 * - Filter tabs
 * - Selection prompt when text is selected
 * - List of comment threads organized by position
 */
export function CommentSidebar({
  targetType,
  targetId,
  studentId,
  onClose,
  activeCommentId,
  onCommentClick,
  selection,
  onClearSelection,
}: CommentSidebarProps) {
  const { user } = useUser();
  const [filter, setFilter] = useState<CommentFilter>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdvisor = ['advisor', 'university_admin', 'super_admin'].includes(
    (user?.publicMetadata?.role as string) ?? '',
  );
  const currentUserId = user?.id ?? '';

  // Get ID props
  const idProps =
    targetType === 'resume'
      ? { resumeId: targetId as Id<'resumes'> }
      : { coverLetterId: targetId as Id<'cover_letters'> };

  // Fetch comments with replies
  const {
    threads,
    isLoading,
    createComment,
    resolveComment,
    unresolveComment,
    updateComment,
    archiveComment,
    toggleReaction,
    togglePin,
  } = useComments({
    targetType,
    ...idProps,
    includeResolved: filter === 'all' || filter === 'resolved',
    includeReplies: true,
  });

  // Filter threads
  const filteredThreads = useMemo(() => {
    return threads.filter((thread) => {
      switch (filter) {
        case 'unresolved':
          return thread.root.status === 'active';
        case 'resolved':
          return thread.root.status === 'resolved';
        case 'advisor':
          return thread.root.visibility === 'advisor_only';
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
      advisor: threads.filter((t) => t.root.visibility === 'advisor_only').length,
    };
  }, [threads]);

  // Create new inline comment
  const handleCreateComment = useCallback(
    async (body: string, visibility: CommentVisibility) => {
      if (!currentUserId || !selection) return;

      setIsSubmitting(true);
      try {
        await createComment({
          studentId,
          targetType,
          commentType: 'inline',
          body,
          visibility,
          ...idProps,
          inlinePosition: {
            selection_start: selection.start,
            selection_end: selection.end,
            selection_text: selection.text,
            section_id: selection.sectionId,
            field_path: selection.fieldPath,
            page_number: selection.pageNumber,
          },
        });
        onClearSelection?.();
      } finally {
        setIsSubmitting(false);
      }
    },
    [createComment, currentUserId, studentId, targetType, idProps, selection, onClearSelection],
  );

  // Reply to comment
  const handleReply = useCallback(
    async (parentId: Id<'advisor_comments'>, body: string, visibility: CommentVisibility) => {
      if (!currentUserId) return;

      await createComment({
        studentId,
        targetType,
        commentType: 'inline',
        body,
        visibility,
        ...idProps,
        parentId,
      });
    },
    [createComment, currentUserId, studentId, targetType, idProps],
  );

  return (
    <div className="w-80 border-l bg-white flex flex-col h-full" data-comment-ui>
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between shrink-0">
        <h3 className="font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Comments
          {threads.length > 0 && (
            <span className="text-sm font-normal text-neutral-500">({threads.length})</span>
          )}
        </h3>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Filters */}
      <div className="p-2 border-b flex gap-1 flex-wrap shrink-0">
        {(['all', 'unresolved', 'advisor', 'resolved'] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setFilter(f)}
          >
            {f === 'all' && `All (${filterCounts.all})`}
            {f === 'unresolved' && `Open (${filterCounts.unresolved})`}
            {f === 'advisor' && `Internal (${filterCounts.advisor})`}
            {f === 'resolved' && `Resolved (${filterCounts.resolved})`}
          </Button>
        ))}
      </div>

      {/* New comment from selection */}
      {selection && isAdvisor && (
        <div className="p-3 bg-blue-50 border-b shrink-0" data-comment-ui>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-blue-600 font-medium flex items-center gap-1">
              <Plus className="h-3 w-3" />
              Add comment to selection
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-blue-600"
              onClick={onClearSelection}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <p className="text-sm text-neutral-600 italic mb-3 line-clamp-2 bg-white rounded p-2 border-l-2 border-yellow-300">
            &ldquo;{selection.text}&rdquo;
          </p>
          <CommentInput
            onSubmit={handleCreateComment}
            onCancel={onClearSelection}
            placeholder="Add your comment..."
            isAdvisor={isAdvisor}
            autoFocus
            isSubmitting={isSubmitting}
          />
        </div>
      )}

      {/* Comments list */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {isLoading ? (
            <div className="py-8 text-center text-neutral-500">Loading comments...</div>
          ) : (
            <CommentThreadList
              threads={filteredThreads}
              currentUserId={currentUserId}
              isAdvisor={isAdvisor}
              onReply={handleReply}
              onResolve={resolveComment}
              onUnresolve={unresolveComment}
              onEdit={updateComment}
              onDelete={archiveComment}
              onReact={toggleReaction}
              onPin={togglePin}
              emptyMessage={
                filter === 'all'
                  ? 'No comments yet. Select text in the document to add a comment.'
                  : `No ${filter} comments.`
              }
            />
          )}
        </div>
      </ScrollArea>

      {/* Bottom hint when no selection */}
      {!selection && isAdvisor && threads.length === 0 && (
        <div className="p-4 border-t bg-neutral-50 text-center text-sm text-neutral-500 shrink-0">
          <p>Select text in the document to add a comment</p>
        </div>
      )}
    </div>
  );
}

/**
 * CommentSidebarToggle Component
 *
 * A button to toggle the comment sidebar visibility.
 */
interface CommentSidebarToggleProps {
  isOpen: boolean;
  onClick: () => void;
  commentCount?: number;
  unresolvedCount?: number;
}

export function CommentSidebarToggle({
  isOpen,
  onClick,
  commentCount = 0,
  unresolvedCount = 0,
}: CommentSidebarToggleProps) {
  return (
    <Button
      variant={isOpen ? 'secondary' : 'ghost'}
      size="sm"
      onClick={onClick}
      className="relative"
    >
      <MessageSquare className="h-4 w-4 mr-1" />
      Comments
      {commentCount > 0 && (
        <span
          className={cn(
            'ml-1 rounded-full px-1.5 text-xs',
            unresolvedCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-neutral-100 text-neutral-600',
          )}
        >
          {unresolvedCount > 0 ? unresolvedCount : commentCount}
        </span>
      )}
    </Button>
  );
}
