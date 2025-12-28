'use client';

import { Eye, EyeOff, Send, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import type { CommentInputProps, CommentVisibility } from './types';

/**
 * CommentInput Component
 *
 * Input field for creating new comments or replies with:
 * - Textarea for comment body
 * - Visibility toggle (shared vs advisor-only)
 * - Submit and cancel buttons
 */
export function CommentInput({
  onSubmit,
  onCancel,
  placeholder = 'Write a comment...',
  isReply = false,
  isAdvisor,
  defaultVisibility = 'shared',
  autoFocus = false,
  isSubmitting = false,
}: CommentInputProps) {
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<CommentVisibility>(defaultVisibility);

  const canToggleVisibility = isAdvisor && !isReply; // Students can't set visibility, replies inherit
  const isPrivate = visibility === 'advisor_only';

  const handleSubmit = () => {
    if (!body.trim() || isSubmitting) return;
    onSubmit(body.trim(), visibility);
    setBody('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd/Ctrl + Enter to submit
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
    // Escape to cancel
    if (e.key === 'Escape' && onCancel) {
      onCancel();
    }
  };

  return (
    <div className={cn('space-y-2', isReply && 'mt-2')}>
      <div className="relative">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            'min-h-[80px] resize-none pr-10 text-sm',
            isPrivate && 'border-amber-300 bg-amber-50/50',
          )}
          autoFocus={autoFocus}
          disabled={isSubmitting}
        />

        {/* Visibility indicator when private */}
        {isPrivate && (
          <div className="absolute top-2 right-2">
            <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700">
              <EyeOff className="h-3 w-3" />
              Internal
            </span>
          </div>
        )}
      </div>

      {/* Actions bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Visibility toggle */}
          {canToggleVisibility && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'h-8 px-2',
                      isPrivate
                        ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                        : 'text-neutral-500 hover:text-neutral-700',
                    )}
                    onClick={() => setVisibility(isPrivate ? 'shared' : 'advisor_only')}
                  >
                    {isPrivate ? (
                      <>
                        <EyeOff className="h-4 w-4 mr-1" />
                        Internal
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-1" />
                        Visible
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isPrivate
                    ? 'Only advisors can see this comment'
                    : 'Student can see this comment'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Hint for students */}
          {!isAdvisor && (
            <span className="text-xs text-neutral-400">Your reply will be visible to advisors</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={!body.trim() || isSubmitting}
          >
            {isSubmitting ? (
              'Posting...'
            ) : (
              <>
                <Send className="h-4 w-4 mr-1" />
                {isReply ? 'Reply' : 'Post'}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Keyboard shortcut hint */}
      <p className="text-xs text-neutral-400">
        Press <kbd className="px-1 py-0.5 rounded bg-neutral-100 text-neutral-600">⌘</kbd> +{' '}
        <kbd className="px-1 py-0.5 rounded bg-neutral-100 text-neutral-600">Enter</kbd> to submit
      </p>
    </div>
  );
}
