'use client';

import { useUser } from '@clerk/nextjs';
import type { Id } from 'convex/_generated/dataModel';
import { MessageSquare } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useComments } from '@/hooks/useComments';
import { cn } from '@/lib/utils';

import { CommentInput } from './CommentInput';
import { CommentThreadList } from './CommentThread';
import type { CommentButtonProps, CommentTargetType, CommentVisibility } from './types';

/**
 * CommentButton Component
 *
 * A button that opens a popover with comments for an artifact.
 * Can be used in different variants:
 * - default: Full button with icon and text/count
 * - icon: Just the icon
 * - badge: Small badge-style indicator
 */
export function CommentButton({
  targetType,
  targetId,
  studentId,
  count = 0,
  unresolvedCount = 0,
  variant = 'default',
  section,
}: CommentButtonProps) {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdvisor = ['advisor', 'university_admin', 'super_admin'].includes(
    (user?.publicMetadata?.role as string) ?? '',
  );
  const currentUserId = user?.id ?? '';

  // Memoize ID props to use in callbacks
  const idProps = useMemo(() => {
    switch (targetType) {
      case 'resume':
        return { resumeId: targetId as Id<'resumes'> };
      case 'cover_letter':
        return { coverLetterId: targetId as Id<'cover_letters'> };
      case 'goal':
        return { goalId: targetId as Id<'goals'> };
      case 'application':
        return { applicationId: targetId as Id<'applications'> };
      case 'session':
        return { sessionId: targetId as Id<'advisor_sessions'> };
      case 'career_plan':
        return { careerPlanId: targetId as Id<'career_main_paths'> };
      default:
        return {};
    }
  }, [targetType, targetId]);

  // Fetch comments
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
    includeResolved: true,
    includeReplies: true,
  });

  // Create new comment
  const handleCreateComment = useCallback(
    async (body: string, visibility: CommentVisibility) => {
      if (!currentUserId) return;

      setIsSubmitting(true);
      try {
        await createComment({
          studentId,
          targetType,
          commentType: section ? 'section' : 'general',
          body,
          visibility,
          ...idProps,
          sectionPosition: section ? { target_section: section } : undefined,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [createComment, currentUserId, studentId, targetType, idProps, section],
  );

  // Reply to comment
  const handleReply = useCallback(
    async (parentId: Id<'advisor_comments'>, body: string, visibility: CommentVisibility) => {
      if (!currentUserId) return;

      await createComment({
        studentId,
        targetType,
        commentType: section ? 'section' : 'general',
        body,
        visibility,
        ...idProps,
        sectionPosition: section ? { target_section: section } : undefined,
        parentId,
      });
    },
    [createComment, currentUserId, studentId, targetType, idProps, section],
  );

  // Render different button variants
  const renderButton = () => {
    switch (variant) {
      case 'icon':
        return (
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MessageSquare className="h-4 w-4" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-4 flex items-center justify-center rounded-full bg-primary-500 text-[10px] font-medium text-white px-1">
                {count}
              </span>
            )}
          </Button>
        );

      case 'badge':
        return (
          <button className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700 transition-colors">
            <MessageSquare className="h-3 w-3" />
            <span>{count}</span>
          </button>
        );

      default:
        return (
          <Button variant="ghost" size="sm" className="gap-1">
            <MessageSquare className="h-4 w-4" />
            {count > 0 ? (
              <span>
                {count}{' '}
                {unresolvedCount > 0 && unresolvedCount !== count && (
                  <span className="text-amber-600">({unresolvedCount} open)</span>
                )}
              </span>
            ) : (
              'Comment'
            )}
          </Button>
        );
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>{renderButton()}</PopoverTrigger>
      <PopoverContent className="w-96 max-h-[500px] overflow-hidden flex flex-col" align="end">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b">
          <h4 className="font-medium text-sm">
            Comments {threads.length > 0 && `(${threads.length})`}
          </h4>
          {section && (
            <span className="text-xs text-neutral-500 capitalize">
              {section.replace(/_/g, ' ')}
            </span>
          )}
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto py-3 -mx-2 px-2">
          {isLoading ? (
            <div className="py-8 text-center text-neutral-500">Loading...</div>
          ) : (
            <CommentThreadList
              threads={threads}
              currentUserId={currentUserId}
              isAdvisor={isAdvisor}
              onReply={handleReply}
              onResolve={resolveComment}
              onUnresolve={unresolveComment}
              onEdit={updateComment}
              onDelete={archiveComment}
              onReact={toggleReaction}
              onPin={togglePin}
              emptyMessage="No comments yet. Be the first to add one!"
            />
          )}
        </div>

        {/* New comment input (advisors only for root comments) */}
        {isAdvisor && (
          <div className="pt-3 border-t">
            <CommentInput
              onSubmit={handleCreateComment}
              placeholder="Add a comment..."
              isAdvisor={isAdvisor}
              isSubmitting={isSubmitting}
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
