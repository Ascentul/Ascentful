'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { useCallback, useMemo } from 'react';

import type {
  CommentThread,
  CommentVisibility,
  CommentWithAuthor,
} from '@/components/advisor/comments/types';

/**
 * Options for useStudentComments hook
 */
export interface UseStudentCommentsOptions {
  targetType: 'resume' | 'cover_letter';
  resumeId?: Id<'resumes'>;
  coverLetterId?: Id<'cover_letters'>;
  includeResolved?: boolean;
}

/**
 * Return type for useStudentComments hook
 */
export interface UseStudentCommentsReturn {
  threads: CommentThread[];
  comments: CommentWithAuthor[];
  isLoading: boolean;
  totalCount: number;
  unresolvedCount: number;
  replyToComment: (parentId: Id<'advisor_comments'>, body: string) => Promise<void>;
  toggleReaction: (commentId: Id<'advisor_comments'>, emoji: string) => Promise<void>;
}

/**
 * useStudentComments Hook
 *
 * A simplified hook for students to view and reply to advisor comments.
 * Students can:
 * - View all "shared" comments on their own resumes/cover letters
 * - Reply to any comment
 * - React with emojis
 *
 * Students CANNOT:
 * - Create root comments (advisor-only)
 * - Resolve/unresolve comments (advisor-only)
 * - Pin comments (advisor-only)
 * - See advisor-only comments
 *
 * @example
 * ```tsx
 * const { threads, replyToComment, toggleReaction } = useStudentComments({
 *   targetType: 'resume',
 *   resumeId: resumeId,
 * });
 * ```
 */
export function useStudentComments(options: UseStudentCommentsOptions): UseStudentCommentsReturn {
  const { user } = useUser();
  const clerkId = user?.id ?? '';

  // Build query args based on target type
  const queryArgs = useMemo(() => {
    const baseArgs = {
      clerkId,
      targetType: options.targetType,
      includeResolved: options.includeResolved ?? true, // Show all by default
      includeReplies: true,
    };

    if (options.targetType === 'resume') {
      return { ...baseArgs, resumeId: options.resumeId };
    } else {
      return { ...baseArgs, coverLetterId: options.coverLetterId };
    }
  }, [
    clerkId,
    options.targetType,
    options.resumeId,
    options.coverLetterId,
    options.includeResolved,
  ]);

  // Query comments - backend automatically filters to shared-only for students
  const data = useQuery(
    api.advisor_comments.getCommentsByArtifact,
    clerkId && (options.resumeId || options.coverLetterId) ? queryArgs : 'skip',
  );

  // Mutations
  const createCommentMutation = useMutation(api.advisor_comments_mutations.createComment);
  const toggleReactionMutation = useMutation(api.advisor_comments_mutations.toggleReaction);

  // Reply to a comment (students can only reply, not create root comments)
  const replyToComment = useCallback(
    async (parentId: Id<'advisor_comments'>, body: string) => {
      if (!clerkId) throw new Error('Not authenticated');

      // Find the student ID from the comment's artifact owner
      // For students, they can only comment on their own artifacts
      // The backend will validate this

      await createCommentMutation({
        clerkId,
        studentId: undefined as any, // Backend will determine from artifact
        targetType: options.targetType,
        commentType: 'general', // Replies don't have inline position
        body,
        visibility: 'shared', // Student replies are always shared
        ...(options.targetType === 'resume'
          ? { resumeId: options.resumeId }
          : { coverLetterId: options.coverLetterId }),
        parentId,
      });
    },
    [clerkId, createCommentMutation, options.targetType, options.resumeId, options.coverLetterId],
  );

  // Toggle reaction on a comment
  const toggleReaction = useCallback(
    async (commentId: Id<'advisor_comments'>, emoji: string) => {
      if (!clerkId) throw new Error('Not authenticated');

      await toggleReactionMutation({
        clerkId,
        commentId,
        emoji,
      });
    },
    [clerkId, toggleReactionMutation],
  );

  // Calculate counts
  const { totalCount, unresolvedCount } = useMemo(() => {
    const threads = data?.threads ?? [];
    return {
      totalCount: threads.length,
      unresolvedCount: threads.filter((t) => t.root.status === 'active').length,
    };
  }, [data?.threads]);

  return {
    threads: (data?.threads ?? []) as CommentThread[],
    comments: (data?.comments ?? []) as CommentWithAuthor[],
    isLoading: data === undefined,
    totalCount,
    unresolvedCount,
    replyToComment,
    toggleReaction,
  };
}

/**
 * useStudentCommentCounts Hook
 *
 * Quick hook to get comment counts for badge display.
 * Only fetches counts, not full comment data.
 */
export function useStudentCommentCounts(
  targetType: 'resume' | 'cover_letter',
  targetId: Id<'resumes'> | Id<'cover_letters'> | undefined,
) {
  const { user } = useUser();
  const clerkId = user?.id ?? '';

  const queryArgs = useMemo(() => {
    if (!targetId || !clerkId) return null;

    return {
      clerkId,
      targetType,
      ...(targetType === 'resume'
        ? { resumeIds: [targetId as Id<'resumes'>] }
        : { coverLetterIds: [targetId as Id<'cover_letters'>] }),
    };
  }, [clerkId, targetType, targetId]);

  const data = useQuery(api.advisor_comments.getCommentCounts, queryArgs ?? 'skip');

  const counts = useMemo(() => {
    if (!data || !targetId) return { total: 0, unresolved: 0 };
    return data[targetId] ?? { total: 0, unresolved: 0 };
  }, [data, targetId]);

  return {
    total: counts.total,
    unresolved: counts.unresolved,
    isLoading: data === undefined,
  };
}
