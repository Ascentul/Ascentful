'use client';

import type { Id } from 'convex/_generated/dataModel';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle, ChevronDown, ChevronUp, Reply, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { CommentInput } from '@/components/advisor/comments/CommentInput';
import type {
  CommentThread,
  CommentVisibility,
  CommentWithAuthor,
} from '@/components/advisor/comments/types';
import { getInitials, groupReactions, REACTION_EMOJIS } from '@/components/advisor/comments/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * Props for StudentCommentThread
 */
interface StudentCommentThreadProps {
  thread: CommentThread;
  currentUserId: string;
  onReply: (parentId: Id<'advisor_comments'>, body: string) => Promise<void>;
  onReact: (commentId: Id<'advisor_comments'>, emoji: string) => Promise<void>;
  isActive?: boolean;
  onClick?: () => void;
}

/**
 * StudentCommentThread Component
 *
 * Displays a comment thread from the student's perspective.
 * Students can:
 * - View the comment and replies
 * - Reply to comments
 * - React with emojis
 *
 * Students CANNOT:
 * - Resolve/unresolve
 * - Pin
 * - Edit/delete advisor comments
 */
export function StudentCommentThread({
  thread,
  currentUserId,
  onReply,
  onReact,
  isActive,
  onClick,
}: StudentCommentThreadProps) {
  const [isCollapsed, setIsCollapsed] = useState(thread.replies.length > 3);
  const [isReplying, setIsReplying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const visibleReplies = isCollapsed ? thread.replies.slice(0, 2) : thread.replies;
  const hiddenCount = thread.replies.length - 2;
  const isResolved = thread.root.status === 'resolved';

  const handleReply = async (body: string, _visibility: CommentVisibility) => {
    setIsSubmitting(true);
    try {
      await onReply(thread.root._id, body);
      setIsReplying(false);
    } catch (error) {
      // Keep reply input open on failure so user can retry
      console.error('Failed to submit reply:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        'rounded-lg transition-colors cursor-pointer',
        isActive && 'bg-primary-50 ring-2 ring-primary-200',
        isResolved && 'opacity-60',
      )}
      onClick={onClick}
    >
      {/* Root comment */}
      <StudentCommentItem
        comment={thread.root}
        currentUserId={currentUserId}
        isRoot={true}
        onReply={() => setIsReplying(true)}
        onReact={onReact}
      />

      {/* Replies */}
      {visibleReplies.length > 0 && (
        <div className="ml-4 mt-2 space-y-2">
          {visibleReplies.map((reply) => (
            <StudentCommentItem
              key={reply._id}
              comment={reply}
              currentUserId={currentUserId}
              isRoot={false}
              onReply={() => setIsReplying(true)}
              onReact={onReact}
            />
          ))}

          {/* Show more replies button */}
          {isCollapsed && hiddenCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-primary-600 hover:text-primary-700"
              onClick={(e) => {
                e.stopPropagation();
                setIsCollapsed(false);
              }}
            >
              <ChevronDown className="h-4 w-4 mr-1" />
              Show {hiddenCount} more {hiddenCount === 1 ? 'reply' : 'replies'}
            </Button>
          )}

          {/* Collapse button when expanded */}
          {!isCollapsed && thread.replies.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-neutral-500 hover:text-neutral-700"
              onClick={(e) => {
                e.stopPropagation();
                setIsCollapsed(true);
              }}
            >
              <ChevronUp className="h-4 w-4 mr-1" />
              Show less
            </Button>
          )}
        </div>
      )}

      {/* Reply input */}
      {isReplying && (
        <div className="ml-10 mt-3" onClick={(e) => e.stopPropagation()}>
          <CommentInput
            onSubmit={handleReply}
            onCancel={() => setIsReplying(false)}
            placeholder="Write a reply..."
            isReply={true}
            isAdvisor={false} // Student mode
            defaultVisibility="shared"
            autoFocus
            isSubmitting={isSubmitting}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Props for StudentCommentItem
 */
interface StudentCommentItemProps {
  comment: CommentWithAuthor;
  currentUserId: string;
  isRoot: boolean;
  onReply: () => void;
  onReact: (commentId: Id<'advisor_comments'>, emoji: string) => Promise<void>;
}

/**
 * StudentCommentItem Component
 *
 * Displays a single comment from the student's perspective.
 */
function StudentCommentItem({
  comment,
  currentUserId,
  isRoot,
  onReply,
  onReact,
}: StudentCommentItemProps) {
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);

  const isAIComment = comment.author.role === 'ai_assistant';
  const isResolved = comment.status === 'resolved';
  const isAdvisorRole = ['advisor', 'university_admin', 'super_admin'].includes(
    comment.author.role,
  );
  const isOwnComment = currentUserId === comment.author_id;

  const groupedReactions = groupReactions(comment.reactions, currentUserId);

  return (
    <div className={cn('group relative', !isRoot && 'ml-6 pl-3 border-l-2 border-neutral-100')}>
      <div className="flex gap-3">
        {/* Avatar */}
        <Avatar className={cn('h-8 w-8 shrink-0', isAIComment && 'ring-2 ring-purple-200')}>
          {isAIComment ? (
            <div className="flex h-full w-full items-center justify-center bg-purple-100">
              <Sparkles className="h-4 w-4 text-purple-600" />
            </div>
          ) : (
            <>
              <AvatarImage src={comment.author.avatarUrl} alt={comment.author.name} />
              <AvatarFallback
                className={cn(
                  'text-xs',
                  isAdvisorRole
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-neutral-100 text-neutral-700',
                )}
              >
                {getInitials(comment.author.name)}
              </AvatarFallback>
            </>
          )}
        </Avatar>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-neutral-900">
              {isAIComment ? 'AI Assistant' : comment.author.name}
            </span>

            {isAdvisorRole && !isAIComment && (
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-primary-100 text-primary-700">
                Advisor
              </span>
            )}

            {isOwnComment && <span className="text-xs text-neutral-400">(You)</span>}

            <span className="text-xs text-neutral-400">
              {formatDistanceToNow(comment.created_at, { addSuffix: true })}
            </span>

            {isResolved && isRoot && (
              <span className="inline-flex items-center gap-1 text-xs text-green-600">
                <CheckCircle className="h-3 w-3" />
                Resolved
              </span>
            )}
          </div>

          {/* Selection quote (for inline comments) */}
          {comment.inline_position?.selection_text && isRoot && (
            <div className="mt-1 px-2 py-1 bg-yellow-50 border-l-2 border-yellow-300 text-sm text-neutral-600 italic rounded-r">
              &ldquo;{comment.inline_position.selection_text}&rdquo;
            </div>
          )}

          {/* Body */}
          <div className="mt-1 text-sm text-neutral-700 whitespace-pre-wrap">{comment.body}</div>

          {/* Reactions */}
          {groupedReactions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {groupedReactions.map((reaction) => (
                <button
                  key={reaction.emoji}
                  onClick={(e) => {
                    e.stopPropagation();
                    onReact(comment._id, reaction.emoji);
                  }}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors',
                    reaction.hasCurrentUser
                      ? 'bg-primary-100 text-primary-700 border border-primary-200'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
                  )}
                >
                  <span>{reaction.emoji}</span>
                  <span>{reaction.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-neutral-500"
              onClick={(e) => {
                e.stopPropagation();
                onReply();
              }}
            >
              <Reply className="h-3 w-3 mr-1" />
              Reply
            </Button>

            {/* Reaction picker */}
            <Popover open={reactionPickerOpen} onOpenChange={setReactionPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-neutral-500"
                  onClick={(e) => e.stopPropagation()}
                >
                  😀
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-1" side="top" align="start">
                <div className="flex gap-1" role="group" aria-label="Reaction emojis">
                  {REACTION_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      aria-label={`React with ${emoji}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onReact(comment._id, emoji);
                        setReactionPickerOpen(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          onReact(comment._id, emoji);
                          setReactionPickerOpen(false);
                        }
                      }}
                      className="p-1 hover:bg-neutral-100 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
    </div>
  );
}
