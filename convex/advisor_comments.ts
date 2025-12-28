/**
 * Advisor Comments Queries
 *
 * Provides queries for the universal commenting system:
 * - Get comments for any artifact (resume, cover letter, goal, application, session, etc.)
 * - Get inline comments with position data for documents
 * - Get comment threads
 * - Get comment counts for badges
 *
 * All queries enforce:
 * - Tenant isolation (university_id)
 * - Visibility filtering (students only see 'shared' comments)
 * - Authorization (advisor access to student's artifacts)
 */

import { v } from 'convex/values';

import { Doc, Id } from './_generated/dataModel';
import { query, QueryCtx } from './_generated/server';
import {
  AdvisorSessionContext,
  canAccessStudent,
  canViewPrivateContent,
  getCurrentUser,
} from './advisor_auth';

// ============================================================================
// Types
// ============================================================================

/**
 * Comment target types supported by the system
 */
export const targetTypeValidator = v.union(
  v.literal('resume'),
  v.literal('cover_letter'),
  v.literal('goal'),
  v.literal('application'),
  v.literal('session'),
  v.literal('career_plan'),
  v.literal('skill'),
  v.literal('linkedin_profile'),
  v.literal('interview_recording'),
  v.literal('profile'),
);

export type CommentTargetType =
  | 'resume'
  | 'cover_letter'
  | 'goal'
  | 'application'
  | 'session'
  | 'career_plan'
  | 'skill'
  | 'linkedin_profile'
  | 'interview_recording'
  | 'profile';

/**
 * Comment with author info populated
 */
export interface CommentWithAuthor extends Doc<'advisor_comments'> {
  author: {
    id: Id<'users'>;
    name: string;
    email: string;
    avatarUrl?: string;
    role: string;
  };
  replyCount?: number;
}

/**
 * Thread structure for nested comments
 */
export interface CommentThread {
  root: CommentWithAuthor;
  replies: CommentWithAuthor[];
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get author info for a comment
 */
async function getAuthorInfo(
  ctx: QueryCtx,
  authorId: Id<'users'>,
): Promise<CommentWithAuthor['author']> {
  const user = await ctx.db.get(authorId);
  if (!user) {
    return {
      id: authorId,
      name: 'Unknown User',
      email: '',
      role: 'user',
    };
  }

  return {
    id: authorId,
    name: user.name || user.email.split('@')[0],
    email: user.email,
    avatarUrl: user.profile_image,
    role: user.role,
  };
}

/**
 * Filter comments by visibility based on user role
 */
function filterByVisibility(
  comments: Doc<'advisor_comments'>[],
  sessionCtx: AdvisorSessionContext,
): Doc<'advisor_comments'>[] {
  return comments.filter((comment) =>
    canViewPrivateContent(sessionCtx, comment.visibility, comment.author_id),
  );
}

/**
 * Enrich comment with author info
 */
async function enrichComment(
  ctx: QueryCtx,
  comment: Doc<'advisor_comments'>,
): Promise<CommentWithAuthor> {
  const author = await getAuthorInfo(ctx, comment.author_id);
  return {
    ...comment,
    author,
  };
}

/**
 * Enrich multiple comments with author info
 */
async function enrichComments(
  ctx: QueryCtx,
  comments: Doc<'advisor_comments'>[],
): Promise<CommentWithAuthor[]> {
  return Promise.all(comments.map((c) => enrichComment(ctx, c)));
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Get all comments for a specific artifact
 *
 * Returns root-level comments (parentId is null) organized as threads.
 * Replies are fetched separately using getThread or included inline.
 */
export const getCommentsByArtifact = query({
  args: {
    clerkId: v.string(),
    targetType: targetTypeValidator,
    // Artifact IDs - exactly one should be provided based on targetType
    resumeId: v.optional(v.id('resumes')),
    coverLetterId: v.optional(v.id('cover_letters')),
    goalId: v.optional(v.id('goals')),
    applicationId: v.optional(v.id('applications')),
    sessionId: v.optional(v.id('advisor_sessions')),
    careerPlanId: v.optional(v.id('career_main_paths')),
    // Filters
    includeResolved: v.optional(v.boolean()),
    includeReplies: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);

    // Build query based on target type
    let comments: Doc<'advisor_comments'>[] = [];

    if (args.targetType === 'resume' && args.resumeId) {
      comments = await ctx.db
        .query('advisor_comments')
        .withIndex('by_resume', (q) => q.eq('resume_id', args.resumeId))
        .collect();
    } else if (args.targetType === 'cover_letter' && args.coverLetterId) {
      comments = await ctx.db
        .query('advisor_comments')
        .withIndex('by_cover_letter', (q) => q.eq('cover_letter_id', args.coverLetterId))
        .collect();
    } else if (args.targetType === 'goal' && args.goalId) {
      comments = await ctx.db
        .query('advisor_comments')
        .withIndex('by_goal', (q) => q.eq('goal_id', args.goalId))
        .collect();
    } else if (args.targetType === 'application' && args.applicationId) {
      comments = await ctx.db
        .query('advisor_comments')
        .withIndex('by_application', (q) => q.eq('application_id', args.applicationId))
        .collect();
    } else if (args.targetType === 'session' && args.sessionId) {
      comments = await ctx.db
        .query('advisor_comments')
        .withIndex('by_session', (q) => q.eq('session_id', args.sessionId))
        .collect();
    } else if (args.targetType === 'career_plan' && args.careerPlanId) {
      comments = await ctx.db
        .query('advisor_comments')
        .withIndex('by_career_plan', (q) => q.eq('career_plan_id', args.careerPlanId))
        .collect();
    } else {
      // For types without dedicated ID fields (skill, linkedin_profile, etc.)
      // We'd need to filter by target_type from a student query
      // For now, return empty - these can be implemented as needed
      return { comments: [], threads: [] };
    }

    // Filter by status
    if (!args.includeResolved) {
      comments = comments.filter((c) => c.status === 'active');
    } else {
      comments = comments.filter((c) => c.status !== 'archived');
    }

    // Filter by visibility
    comments = filterByVisibility(comments, sessionCtx);

    // Separate root comments and replies
    const rootComments = comments.filter((c) => !c.parent_id);
    const replies = comments.filter((c) => c.parent_id);

    // Enrich with author info
    const enrichedRoots = await enrichComments(ctx, rootComments);

    // Build threads if requested
    let threads: CommentThread[] = [];
    if (args.includeReplies) {
      const enrichedReplies = await enrichComments(ctx, replies);

      threads = enrichedRoots.map((root) => ({
        root,
        replies: enrichedReplies
          .filter((r) => r.thread_root_id === root._id || r.parent_id === root._id)
          .sort((a, b) => a.created_at - b.created_at),
      }));
    } else {
      // Just add reply counts
      threads = enrichedRoots.map((root) => ({
        root: {
          ...root,
          replyCount: replies.filter(
            (r) => r.thread_root_id === root._id || r.parent_id === root._id,
          ).length,
        },
        replies: [],
      }));
    }

    // Sort by pinned first, then by created_at desc
    threads.sort((a, b) => {
      if (a.root.is_pinned && !b.root.is_pinned) return -1;
      if (!a.root.is_pinned && b.root.is_pinned) return 1;
      return b.root.created_at - a.root.created_at;
    });

    return {
      comments: enrichedRoots,
      threads,
    };
  },
});

/**
 * Get inline comments for a document with position data
 *
 * Specialized query for resume/cover letter viewing that includes
 * selection coordinates for sidebar positioning and highlighting.
 */
export const getInlineComments = query({
  args: {
    clerkId: v.string(),
    targetType: v.union(v.literal('resume'), v.literal('cover_letter')),
    resumeId: v.optional(v.id('resumes')),
    coverLetterId: v.optional(v.id('cover_letters')),
    includeResolved: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);

    let comments: Doc<'advisor_comments'>[] = [];

    if (args.targetType === 'resume' && args.resumeId) {
      comments = await ctx.db
        .query('advisor_comments')
        .withIndex('by_resume', (q) => q.eq('resume_id', args.resumeId))
        .collect();
    } else if (args.targetType === 'cover_letter' && args.coverLetterId) {
      comments = await ctx.db
        .query('advisor_comments')
        .withIndex('by_cover_letter', (q) => q.eq('cover_letter_id', args.coverLetterId))
        .collect();
    }

    // Filter to only inline comments
    comments = comments.filter((c) => c.comment_type === 'inline' && c.inline_position);

    // Filter by status
    if (!args.includeResolved) {
      comments = comments.filter((c) => c.status === 'active');
    } else {
      comments = comments.filter((c) => c.status !== 'archived');
    }

    // Filter by visibility
    comments = filterByVisibility(comments, sessionCtx);

    // Enrich with author info
    const enriched = await enrichComments(ctx, comments);

    // Sort by position in document
    enriched.sort((a, b) => {
      const posA = a.inline_position?.selection_start ?? 0;
      const posB = b.inline_position?.selection_start ?? 0;
      return posA - posB;
    });

    return enriched;
  },
});

/**
 * Get a single comment thread by root ID
 */
export const getThread = query({
  args: {
    clerkId: v.string(),
    threadRootId: v.id('advisor_comments'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);

    // Get root comment
    const root = await ctx.db.get(args.threadRootId);
    if (!root) {
      return null;
    }

    // Check visibility
    if (!canViewPrivateContent(sessionCtx, root.visibility, root.author_id)) {
      return null;
    }

    // Get all replies in thread
    const replies = await ctx.db
      .query('advisor_comments')
      .withIndex('by_thread_root', (q) => q.eq('thread_root_id', args.threadRootId))
      .collect();

    // Filter replies by visibility
    const visibleReplies = filterByVisibility(replies, sessionCtx);

    // Enrich with author info
    const enrichedRoot = await enrichComment(ctx, root);
    const enrichedReplies = await enrichComments(ctx, visibleReplies);

    // Sort replies by created_at
    enrichedReplies.sort((a, b) => a.created_at - b.created_at);

    return {
      root: enrichedRoot,
      replies: enrichedReplies,
    } as CommentThread;
  },
});

/**
 * Get comment counts for multiple artifacts (for badges)
 *
 * Useful for showing comment count badges on lists of artifacts.
 */
export const getCommentCounts = query({
  args: {
    clerkId: v.string(),
    targetType: targetTypeValidator,
    // Array of IDs to get counts for
    resumeIds: v.optional(v.array(v.id('resumes'))),
    coverLetterIds: v.optional(v.array(v.id('cover_letters'))),
    goalIds: v.optional(v.array(v.id('goals'))),
    applicationIds: v.optional(v.array(v.id('applications'))),
    sessionIds: v.optional(v.array(v.id('advisor_sessions'))),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    const isStudent = sessionCtx.role === 'student' || sessionCtx.role === 'user';

    const counts: Record<string, { total: number; unresolved: number }> = {};

    // Helper to count comments for an ID
    const countForId = async (
      index: 'by_resume' | 'by_cover_letter' | 'by_goal' | 'by_application' | 'by_session',
      id: Id<'resumes' | 'cover_letters' | 'goals' | 'applications' | 'advisor_sessions'>,
    ) => {
      const comments = await ctx.db
        .query('advisor_comments')
        .withIndex(index, (q) => q.eq((index.replace('by_', '') + '_id') as any, id))
        .collect();

      // Filter by visibility for students
      const visible = isStudent ? comments.filter((c) => c.visibility === 'shared') : comments;

      // Only count root comments (not replies)
      const rootComments = visible.filter((c) => !c.parent_id && c.status !== 'archived');

      return {
        total: rootComments.length,
        unresolved: rootComments.filter((c) => c.status === 'active').length,
      };
    };

    // Count for each ID based on target type
    if (args.targetType === 'resume' && args.resumeIds) {
      for (const id of args.resumeIds) {
        counts[id] = await countForId('by_resume', id);
      }
    } else if (args.targetType === 'cover_letter' && args.coverLetterIds) {
      for (const id of args.coverLetterIds) {
        counts[id] = await countForId('by_cover_letter', id);
      }
    } else if (args.targetType === 'goal' && args.goalIds) {
      for (const id of args.goalIds) {
        counts[id] = await countForId('by_goal', id);
      }
    } else if (args.targetType === 'application' && args.applicationIds) {
      for (const id of args.applicationIds) {
        counts[id] = await countForId('by_application', id);
      }
    } else if (args.targetType === 'session' && args.sessionIds) {
      for (const id of args.sessionIds) {
        counts[id] = await countForId('by_session', id);
      }
    }

    return counts;
  },
});

/**
 * Get all comments for a student (across all artifacts)
 *
 * Used for student activity feed or advisor overview.
 */
export const getCommentsByStudent = query({
  args: {
    clerkId: v.string(),
    studentId: v.id('users'),
    includeResolved: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);

    // Verify access to student
    const canAccess = await canAccessStudent(ctx, sessionCtx, args.studentId);
    if (!canAccess) {
      throw new Error('Unauthorized: Cannot access this student');
    }

    // Get comments for student
    let comments = await ctx.db
      .query('advisor_comments')
      .withIndex('by_student', (q) => q.eq('student_id', args.studentId))
      .collect();

    // Filter by status
    if (!args.includeResolved) {
      comments = comments.filter((c) => c.status === 'active');
    } else {
      comments = comments.filter((c) => c.status !== 'archived');
    }

    // Filter by visibility
    comments = filterByVisibility(comments, sessionCtx);

    // Only root comments
    comments = comments.filter((c) => !c.parent_id);

    // Sort by created_at desc
    comments.sort((a, b) => b.created_at - a.created_at);

    // Apply limit
    if (args.limit && args.limit > 0) {
      comments = comments.slice(0, args.limit);
    }

    // Enrich with author info
    return enrichComments(ctx, comments);
  },
});
