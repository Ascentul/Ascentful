'use client';

import { formatDistanceToNow } from 'date-fns';
import {
  CheckCircle,
  Edit2,
  EyeOff,
  MoreHorizontal,
  Pin,
  Reply,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import type { CommentItemProps, GroupedReaction } from './types';

/**
 * Group reactions by emoji for display
 */
function groupReactions(
  reactions: Array<{ user_id: string; emoji: string; created_at: number }> | undefined,
  currentUserId: string,
): GroupedReaction[] {
  if (!reactions || reactions.length === 0) return [];

  const grouped = new Map<string, GroupedReaction>();

  for (const reaction of reactions) {
    const existing = grouped.get(reaction.emoji);
    if (existing) {
      existing.count++;
      existing.userIds.push(reaction.user_id);
      if (reaction.user_id === currentUserId) {
        existing.hasCurrentUser = true;
      }
    } else {
      grouped.set(reaction.emoji, {
        emoji: reaction.emoji,
        count: 1,
        userIds: [reaction.user_id],
        hasCurrentUser: reaction.user_id === currentUserId,
      });
    }
  }

  return Array.from(grouped.values());
}

/**
 * Get initials from name
 */
function getInitials(name: string): string {
  if (!name.trim()) return '?';
  return name
    .split(' ')
    .filter((n) => n.length > 0)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Common reaction emojis
 */
const REACTION_EMOJIS = ['👍', '👎', '❤️', '🎉', '🤔', '👀'];

/**
 * CommentItem Component
 *
 * Displays a single comment with:
 * - Author avatar and info
 * - Comment body
 * - Selection quote (for inline comments)
 * - Status indicators (resolved, internal, pinned)
 * - Actions (reply, resolve, edit, delete, react)
 * - Reactions display
 */
export function CommentItem({
  comment,
  currentUserId,
  isAdvisor,
  isRoot = false,
  depth = 0,
  onReply,
  onResolve,
  onUnresolve,
  onEdit,
  onDelete,
  onReact,
  onPin,
}: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.body);
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);

  const isAuthor = currentUserId === comment.author_id;
  const isAIComment = comment.author.role === 'ai_assistant';
  const isResolved = comment.status === 'resolved';
  const isInternal = comment.visibility === 'advisor_only';

  const groupedReactions = groupReactions(comment.reactions, currentUserId);

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== comment.body) {
      onEdit(editContent.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(comment.body);
    setIsEditing(false);
  };

  return (
    <div
      className={cn(
        'group relative',
        depth > 0 && 'ml-10 mt-2 pl-3 border-l-2 border-neutral-100',
        isResolved && 'opacity-60',
      )}
    >
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
              <AvatarFallback className="text-xs">
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

            {comment.author.role && !isAIComment && (
              <span className="text-xs text-neutral-400 capitalize">
                {comment.author.role.replace('_', ' ')}
              </span>
            )}

            <span className="text-xs text-neutral-400">
              {formatDistanceToNow(comment.created_at, { addSuffix: true })}
            </span>

            {/* Status badges */}
            {isInternal && (
              <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700">
                <EyeOff className="h-3 w-3" />
                Internal
              </span>
            )}

            {comment.is_pinned && <Pin className="h-3 w-3 text-primary-500" />}

            {isResolved && (
              <span className="inline-flex items-center gap-1 text-xs text-green-600">
                <CheckCircle className="h-3 w-3" />
                Resolved
              </span>
            )}
          </div>

          {/* Selection quote (for inline comments) */}
          {comment.inline_position?.selection_text && (
            <div className="mt-1 px-2 py-1 bg-yellow-50 border-l-2 border-yellow-300 text-sm text-neutral-600 italic">
              &ldquo;{comment.inline_position.selection_text}&rdquo;
            </div>
          )}

          {/* Body */}
          {isEditing ? (
            <div className="mt-2 space-y-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[80px] resize-none text-sm"
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit} disabled={!editContent.trim()}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-1 text-sm text-neutral-700 whitespace-pre-wrap">{comment.body}</div>
          )}

          {/* Reactions */}
          {groupedReactions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {groupedReactions.map((reaction) => (
                <button
                  key={reaction.emoji}
                  onClick={() => onReact(reaction.emoji)}
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
          {!isEditing && (
            <div className="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-neutral-500"
                onClick={onReply}
              >
                <Reply className="h-3 w-3 mr-1" />
                Reply
              </Button>

              {/* Reaction picker */}
              <Popover open={reactionPickerOpen} onOpenChange={setReactionPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-neutral-500">
                    😀
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-1" side="top" align="start">
                  <div className="flex gap-1">
                    {REACTION_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          onReact(emoji);
                          setReactionPickerOpen(false);
                        }}
                        className="p-1 hover:bg-neutral-100 rounded transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Resolve/Unresolve */}
              {isAdvisor && !isAIComment && (
                <>
                  {isResolved ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-neutral-500"
                      onClick={onUnresolve}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Reopen
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-neutral-500"
                      onClick={onResolve}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Resolve
                    </Button>
                  )}
                </>
              )}

              {/* More actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-neutral-500">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {/* Pin (root comments only, advisors only) */}
                  {isRoot && isAdvisor && onPin && (
                    <DropdownMenuItem onClick={onPin}>
                      <Pin className="h-4 w-4 mr-2" />
                      {comment.is_pinned ? 'Unpin' : 'Pin'}
                    </DropdownMenuItem>
                  )}

                  {/* Edit (author only) */}
                  {isAuthor && (
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  )}

                  {/* Delete (author only) */}
                  {isAuthor && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={onDelete}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
