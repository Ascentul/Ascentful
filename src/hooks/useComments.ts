'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { useCallback, useMemo } from 'react';

import type {
  CommentTargetType,
  CommentThread,
  CommentWithAuthor,
  CreateCommentArgs,
  UseCommentsOptions,
  UseCommentsReturn,
} from '@/components/advisor/comments/types';

/**
 * useComments Hook
 *
 * Provides comments data and mutation functions for a specific artifact.
 * Uses Convex's built-in reactivity for real-time updates.
 *
 * @example
 * ```tsx
 * const { threads, createComment, resolveComment } = useComments({
 *   targetType: 'resume',
 *   resumeId: resumeId,
 * });
 * ```
 */
export function useComments(options: UseCommentsOptions): UseCommentsReturn {
  const { user } = useUser();
  const clerkId = user?.id ?? '';

  // Build query args based on target type
  const queryArgs = useMemo(() => {
    const baseArgs = {
      clerkId,
      targetType: options.targetType,
      includeResolved: options.includeResolved ?? false,
      includeReplies: options.includeReplies ?? true,
    };

    switch (options.targetType) {
      case 'resume':
        return { ...baseArgs, resumeId: options.resumeId };
      case 'cover_letter':
        return { ...baseArgs, coverLetterId: options.coverLetterId };
      case 'goal':
        return { ...baseArgs, goalId: options.goalId };
      case 'application':
        return { ...baseArgs, applicationId: options.applicationId };
      case 'session':
        return { ...baseArgs, sessionId: options.sessionId };
      case 'career_plan':
        return { ...baseArgs, careerPlanId: options.careerPlanId };
      default:
        return baseArgs;
    }
  }, [
    clerkId,
    options.targetType,
    options.resumeId,
    options.coverLetterId,
    options.goalId,
    options.applicationId,
    options.sessionId,
    options.careerPlanId,
    options.includeResolved,
    options.includeReplies,
  ]);

  // Query comments - Convex provides automatic reactivity
  const data = useQuery(api.advisor_comments.getCommentsByArtifact, clerkId ? queryArgs : 'skip');

  // Mutations
  const createCommentMutation = useMutation(api.advisor_comments_mutations.createComment);
  const updateCommentMutation = useMutation(api.advisor_comments_mutations.updateComment);
  const resolveCommentMutation = useMutation(api.advisor_comments_mutations.resolveComment);
  const unresolveCommentMutation = useMutation(api.advisor_comments_mutations.unresolveComment);
  const archiveCommentMutation = useMutation(api.advisor_comments_mutations.archiveComment);
  const toggleReactionMutation = useMutation(api.advisor_comments_mutations.toggleReaction);
  const togglePinMutation = useMutation(api.advisor_comments_mutations.togglePin);

  // Create comment handler
  const createComment = useCallback(
    async (args: CreateCommentArgs) => {
      if (!clerkId) throw new Error('Not authenticated');

      await createCommentMutation({
        clerkId,
        studentId: args.studentId,
        targetType: args.targetType,
        commentType: args.commentType,
        body: args.body,
        visibility: args.visibility,
        resumeId: args.resumeId,
        coverLetterId: args.coverLetterId,
        goalId: args.goalId,
        applicationId: args.applicationId,
        sessionId: args.sessionId,
        careerPlanId: args.careerPlanId,
        inlinePosition: args.inlinePosition,
        sectionPosition: args.sectionPosition,
        mediaPosition: args.mediaPosition,
        parentId: args.parentId,
      });
    },
    [clerkId, createCommentMutation],
  );

  // Update comment handler
  const updateComment = useCallback(
    async (commentId: Id<'advisor_comments'>, body: string, version: number) => {
      if (!clerkId) throw new Error('Not authenticated');

      await updateCommentMutation({
        clerkId,
        commentId,
        body,
        version,
      });
    },
    [clerkId, updateCommentMutation],
  );

  // Resolve comment handler
  const resolveComment = useCallback(
    async (commentId: Id<'advisor_comments'>) => {
      if (!clerkId) throw new Error('Not authenticated');

      await resolveCommentMutation({
        clerkId,
        commentId,
      });
    },
    [clerkId, resolveCommentMutation],
  );

  // Unresolve comment handler
  const unresolveComment = useCallback(
    async (commentId: Id<'advisor_comments'>) => {
      if (!clerkId) throw new Error('Not authenticated');

      await unresolveCommentMutation({
        clerkId,
        commentId,
      });
    },
    [clerkId, unresolveCommentMutation],
  );

  // Archive comment handler
  const archiveComment = useCallback(
    async (commentId: Id<'advisor_comments'>) => {
      if (!clerkId) throw new Error('Not authenticated');

      await archiveCommentMutation({
        clerkId,
        commentId,
      });
    },
    [clerkId, archiveCommentMutation],
  );

  // Toggle reaction handler
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

  // Toggle pin handler
  const togglePin = useCallback(
    async (commentId: Id<'advisor_comments'>) => {
      if (!clerkId) throw new Error('Not authenticated');

      await togglePinMutation({
        clerkId,
        commentId,
      });
    },
    [clerkId, togglePinMutation],
  );

  return {
    comments: (data?.comments ?? []) as CommentWithAuthor[],
    threads: (data?.threads ?? []) as CommentThread[],
    isLoading: data === undefined,
    createComment,
    updateComment,
    resolveComment,
    unresolveComment,
    archiveComment,
    toggleReaction,
    togglePin,
  };
}

/**
 * useCommentCounts Hook
 *
 * Fetches comment counts for multiple artifacts (for badges).
 */
export function useCommentCounts(
  targetType: CommentTargetType,
  ids: {
    resumeIds?: Id<'resumes'>[];
    coverLetterIds?: Id<'cover_letters'>[];
    goalIds?: Id<'goals'>[];
    applicationIds?: Id<'applications'>[];
    sessionIds?: Id<'advisor_sessions'>[];
  },
) {
  const { user } = useUser();
  const clerkId = user?.id ?? '';

  const data = useQuery(
    api.advisor_comments.getCommentCounts,
    clerkId
      ? {
          clerkId,
          targetType,
          ...ids,
        }
      : 'skip',
  );

  return {
    counts: data ?? {},
    isLoading: data === undefined,
  };
}

/**
 * useInlineComments Hook
 *
 * Fetches inline comments for documents with position data.
 * Used for document sidebar and highlighting.
 */
export function useInlineComments(
  targetType: 'resume' | 'cover_letter',
  targetId: Id<'resumes'> | Id<'cover_letters'> | undefined,
  options?: { includeResolved?: boolean },
) {
  const { user } = useUser();
  const clerkId = user?.id ?? '';

  const queryArgs = useMemo(() => {
    if (!targetId || !clerkId) return null;

    return {
      clerkId,
      targetType,
      ...(targetType === 'resume'
        ? { resumeId: targetId as Id<'resumes'> }
        : { coverLetterId: targetId as Id<'cover_letters'> }),
      includeResolved: options?.includeResolved ?? false,
    };
  }, [clerkId, targetType, targetId, options?.includeResolved]);

  const data = useQuery(api.advisor_comments.getInlineComments, queryArgs ?? 'skip');

  return {
    comments: (data ?? []) as CommentWithAuthor[],
    isLoading: data === undefined,
  };
}
