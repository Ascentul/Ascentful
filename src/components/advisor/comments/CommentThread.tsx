'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { CommentInput } from './CommentInput';
import { CommentItem } from './CommentItem';
import type { CommentThreadProps, CommentVisibility } from './types';

/**
 * CommentThread Component
 *
 * Displays a comment thread with:
 * - Root comment
 * - Nested replies (collapsible)
 * - Reply input form
 */
export function CommentThread({
  thread,
  currentUserId,
  isAdvisor,
  onReply,
  onResolve,
  onUnresolve,
  onEdit,
  onDelete,
  onReact,
  onPin,
  collapsed = false,
}: CommentThreadProps) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed && thread.replies.length > 2);
  const [isReplying, setIsReplying] = useState(false);

  const visibleReplies = isCollapsed ? thread.replies.slice(0, 2) : thread.replies;
  const hiddenCount = thread.replies.length - 2;

  const handleReply = (body: string, visibility: CommentVisibility) => {
    onReply(thread.root._id, body, visibility);
    setIsReplying(false);
  };

  return (
    <div className="space-y-2">
      {/* Root comment */}
      <CommentItem
        comment={thread.root}
        currentUserId={currentUserId}
        isAdvisor={isAdvisor}
        isRoot={true}
        depth={0}
        onReply={() => setIsReplying(true)}
        onResolve={() => onResolve(thread.root._id)}
        onUnresolve={() => onUnresolve(thread.root._id)}
        onEdit={(body) => onEdit(thread.root._id, body, thread.root.version ?? 0)}
        onDelete={() => onDelete(thread.root._id)}
        onReact={(emoji) => onReact(thread.root._id, emoji)}
        onPin={() => onPin(thread.root._id)}
      />

      {/* Replies */}
      {visibleReplies.length > 0 && (
        <div className="ml-4 space-y-2">
          {visibleReplies.map((reply) => (
            <CommentItem
              key={reply._id}
              comment={reply}
              currentUserId={currentUserId}
              isAdvisor={isAdvisor}
              isRoot={false}
              depth={1}
              onReply={() => setIsReplying(true)}
              onResolve={() => onResolve(reply._id)}
              onUnresolve={() => onUnresolve(reply._id)}
              onEdit={(body) => onEdit(reply._id, body, reply.version ?? 0)}
              onDelete={() => onDelete(reply._id)}
              onReact={(emoji) => onReact(reply._id, emoji)}
            />
          ))}

          {/* Show more replies button */}
          {isCollapsed && hiddenCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-primary-600 hover:text-primary-700"
              onClick={() => setIsCollapsed(false)}
            >
              <ChevronDown className="h-4 w-4 mr-1" />
              Show {hiddenCount} more {hiddenCount === 1 ? 'reply' : 'replies'}
            </Button>
          )}

          {/* Collapse button when expanded */}
          {!isCollapsed && thread.replies.length > 2 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-neutral-500 hover:text-neutral-700"
              onClick={() => setIsCollapsed(true)}
            >
              <ChevronUp className="h-4 w-4 mr-1" />
              Show less
            </Button>
          )}
        </div>
      )}

      {/* Reply input */}
      {isReplying && (
        <div className="ml-10">
          <CommentInput
            onSubmit={handleReply}
            onCancel={() => setIsReplying(false)}
            placeholder="Write a reply..."
            isReply={true}
            isAdvisor={isAdvisor}
            defaultVisibility={thread.root.visibility}
            autoFocus
          />
        </div>
      )}
    </div>
  );
}

/**
 * CommentThreadList Component
 *
 * Displays a list of comment threads with optional filtering
 */
interface CommentThreadListProps {
  threads: CommentThreadProps['thread'][];
  currentUserId: string;
  isAdvisor: boolean;
  onReply: CommentThreadProps['onReply'];
  onResolve: CommentThreadProps['onResolve'];
  onUnresolve: CommentThreadProps['onUnresolve'];
  onEdit: CommentThreadProps['onEdit'];
  onDelete: CommentThreadProps['onDelete'];
  onReact: CommentThreadProps['onReact'];
  onPin: CommentThreadProps['onPin'];
  emptyMessage?: string;
}

export function CommentThreadList({
  threads,
  currentUserId,
  isAdvisor,
  onReply,
  onResolve,
  onUnresolve,
  onEdit,
  onDelete,
  onReact,
  onPin,
  emptyMessage = 'No comments yet',
}: CommentThreadListProps) {
  if (threads.length === 0) {
    return (
      <div className="py-8 text-center text-neutral-500">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 divide-y divide-neutral-100">
      {threads.map((thread) => (
        <div key={thread.root._id} className="pt-4 first:pt-0">
          <CommentThread
            thread={thread}
            currentUserId={currentUserId as any}
            isAdvisor={isAdvisor}
            onReply={onReply}
            onResolve={onResolve}
            onUnresolve={onUnresolve}
            onEdit={onEdit}
            onDelete={onDelete}
            onReact={onReact}
            onPin={onPin}
            collapsed={threads.length > 3}
          />
        </div>
      ))}
    </div>
  );
}
