/**
 * Advisor Review Queue Queries
 *
 * Provides queries for managing resume/cover letter reviews:
 * - Get pending reviews
 * - Get review by ID
 * - Filter reviews by status/type
 */

import { v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { query, QueryCtx } from './_generated/server';
import {
  getCurrentUser,
  getOwnedStudentIds,
  optionalTenant,
  requireAdvisorRole,
} from './advisor_auth';

/**
 * Type for resume content details
 */
type ResumeContent = {
  title: string;
  content: string;
  created_at: number;
  updated_at: number;
};

/**
 * Type for cover letter content details
 */
type CoverLetterContent = {
  company_name: string | undefined;
  job_title: string | undefined;
  content: string | undefined;
  created_at: number;
  updated_at: number;
};

/**
 * Helper: Get asset name and optionally its content
 */
async function getAssetDetails(
  ctx: QueryCtx,
  assetType: 'resume' | 'cover_letter',
  resumeId: Id<'resumes'> | undefined,
  coverLetterId: Id<'cover_letters'> | undefined,
  includeContent: boolean = false,
): Promise<{
  name: string;
  id: Id<'resumes'> | Id<'cover_letters'> | null;
  content: ResumeContent | CoverLetterContent | null;
}> {
  if (assetType === 'resume' && resumeId) {
    const resume = await ctx.db.get(resumeId);
    if (resume) {
      return {
        name: resume.title || 'Untitled Resume',
        id: resumeId,
        content: includeContent
          ? {
              title: resume.title,
              content: resume.content,
              created_at: resume.created_at,
              updated_at: resume.updated_at,
            }
          : null,
      };
    }
    console.warn(`Resume ${resumeId} not found for asset_type=${assetType}`);
  } else if (assetType === 'cover_letter' && coverLetterId) {
    const coverLetter = await ctx.db.get(coverLetterId);
    if (coverLetter) {
      return {
        name: coverLetter.company_name
          ? `Cover Letter for ${coverLetter.company_name}`
          : 'Untitled Cover Letter',
        id: coverLetterId,
        content: includeContent
          ? {
              company_name: coverLetter.company_name,
              job_title: coverLetter.job_title,
              content: coverLetter.content,
              created_at: coverLetter.created_at,
              updated_at: coverLetter.updated_at,
            }
          : null,
      };
    }
    console.warn(`Cover letter ${coverLetterId} not found for asset_type=${assetType}`);
  } else {
    console.warn(
      `Asset not found: type=${assetType}, resumeId=${resumeId}, coverLetterId=${coverLetterId}`,
    );
  }

  return { name: 'Unknown', id: null, content: null };
}

/**
 * Get all reviews for advisor (with optional filters)
 */
export const getReviews = query({
  args: {
    clerkId: v.string(),
    status: v.optional(
      v.union(
        v.literal('waiting'),
        v.literal('in_review'),
        v.literal('needs_edits'),
        v.literal('approved'),
      ),
    ),
    asset_type: v.optional(v.union(v.literal('resume'), v.literal('cover_letter'))),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);

    // Get university_id - for super_admin without a university, return empty results gracefully
    const universityId = optionalTenant(sessionCtx);
    if (!universityId) {
      return [];
    }

    const ownedStudentIds = new Set(await getOwnedStudentIds(ctx, sessionCtx));

    // Use database-level filtering for better performance
    let reviews;

    if (args.status && args.asset_type) {
      // Both filters: use status index, then filter asset_type in-memory
      // (no compound index for both fields)
      const statusFilter = args.status;
      reviews = await ctx.db
        .query('advisor_reviews')
        .withIndex('by_status', (q) =>
          q.eq('status', statusFilter).eq('university_id', universityId),
        )
        .collect();
      reviews = reviews.filter((r) => r.asset_type === args.asset_type);
    } else if (args.status) {
      // Status filter only: use by_status index
      const statusFilter = args.status;
      reviews = await ctx.db
        .query('advisor_reviews')
        .withIndex('by_status', (q) =>
          q.eq('status', statusFilter).eq('university_id', universityId),
        )
        .collect();
    } else if (args.asset_type) {
      // Asset type filter only: use by_asset_type index
      const assetTypeFilter = args.asset_type;
      reviews = await ctx.db
        .query('advisor_reviews')
        .withIndex('by_asset_type', (q) =>
          q.eq('asset_type', assetTypeFilter).eq('university_id', universityId),
        )
        .collect();
    } else {
      // No filters: use by_university index
      reviews = await ctx.db
        .query('advisor_reviews')
        .withIndex('by_university', (q) => q.eq('university_id', universityId))
        .collect();
    }

    // Filter to advisor caseload and enrich with student data
    const caseloadReviews = reviews.filter((review) => ownedStudentIds.has(review.student_id));

    const enrichedReviews = await Promise.all(
      caseloadReviews.map(async (review) => {
        const student = await ctx.db.get(review.student_id);
        if (!student) {
          console.warn(`Student ${review.student_id} not found for review ${review._id}`);
        }

        // Get the asset details using helper
        const assetDetails = await getAssetDetails(
          ctx,
          review.asset_type,
          review.resume_id,
          review.cover_letter_id,
          false, // Don't include full content in list view
        );

        return {
          _id: review._id,
          student_id: review.student_id,
          student_name: student?.name || 'Unknown',
          student_email: student?.email || '',
          asset_id: assetDetails.id,
          asset_type: review.asset_type,
          asset_name: assetDetails.name,
          status: review.status,
          requested_at: review.created_at,
          reviewed_by: review.reviewed_by,
          reviewed_at: review.reviewed_at,
          rubric: review.rubric,
          comments: review.comments,
          version_id: review.version_id,
        };
      }),
    );

    return enrichedReviews.sort((a, b) => a.requested_at - b.requested_at);
  },
});

/**
 * Get a single review by ID
 */
export const getReviewById = query({
  args: {
    clerkId: v.string(),
    review_id: v.id('advisor_reviews'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);

    // Get university_id - for super_admin without a university, they cannot access reviews
    const universityId = optionalTenant(sessionCtx);
    if (!universityId) {
      return null;
    }

    const review = await ctx.db.get(args.review_id);
    if (!review) {
      throw new Error('Review not found');
    }

    // Verify tenant isolation
    if (review.university_id !== universityId) {
      throw new Error('Unauthorized: Review not in your university');
    }

    // Verify advisor can access this student (caseload)
    const ownedStudentIds = await getOwnedStudentIds(ctx, sessionCtx);
    const ownedStudentIdSet = new Set(ownedStudentIds);
    if (!ownedStudentIdSet.has(review.student_id)) {
      throw new Error('Unauthorized: Student not in your caseload');
    }

    const student = await ctx.db.get(review.student_id);

    const assetDetails = await getAssetDetails(
      ctx,
      review.asset_type,
      review.resume_id,
      review.cover_letter_id,
      true, // Include full content for detail view
    );

    // For detail views, asset must exist to provide complete review information
    if (assetDetails.id === null) {
      throw new Error(`Associated ${review.asset_type} not found for review`);
    }
    if (assetDetails.content === null) {
      throw new Error(`Content not loaded for ${review.asset_type}`);
    }

    return {
      _id: review._id,
      student_id: review.student_id,
      student_name: student?.name || 'Unknown',
      student_email: student?.email || '',
      asset_id: assetDetails.id,
      asset_type: review.asset_type,
      asset_name: assetDetails.name,
      asset_content: assetDetails.content,
      status: review.status,
      requested_at: review.created_at,
      reviewed_by: review.reviewed_by,
      reviewed_at: review.reviewed_at,
      rubric: review.rubric,
      comments: review.comments,
      version_id: review.version_id,
    };
  },
});

/**
 * Get review queue stats
 */
export const getReviewQueueStats = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);

    // Get university_id - for super_admin without a university, return empty stats gracefully
    const universityId = optionalTenant(sessionCtx);
    if (!universityId) {
      return {
        waiting: 0,
        inReview: 0,
        needsEdits: 0,
        approved: 0,
        resumes: 0,
        coverLetters: 0,
        urgent: 0,
        inProgress: 0,
        completed: 0,
        total: 0,
      };
    }

    const ownedStudentIds = new Set(await getOwnedStudentIds(ctx, sessionCtx));

    const allReviews = await ctx.db
      .query('advisor_reviews')
      .withIndex('by_university', (q) => q.eq('university_id', universityId))
      .collect();

    // Filter to advisor's caseload for consistent stats
    const caseloadReviews = allReviews.filter((r) => ownedStudentIds.has(r.student_id));

    // Single-pass statistics calculation for better performance
    // Urgent threshold: reviews waiting more than 3 days
    const urgentThreshold = Date.now() - 3 * 24 * 60 * 60 * 1000;

    const stats = caseloadReviews.reduce(
      (acc, r) => {
        if (r.status === 'waiting') {
          acc.waiting++;
          // Check if waiting review is urgent (submitted > 3 days ago)
          if (r.created_at < urgentThreshold) {
            acc.urgent++;
          }
        }
        if (r.status === 'in_review') acc.inReview++;
        if (r.status === 'needs_edits') acc.needsEdits++;
        if (r.status === 'approved') acc.approved++;
        if (r.asset_type === 'resume') acc.resumes++;
        if (r.asset_type === 'cover_letter') acc.coverLetters++;
        return acc;
      },
      {
        waiting: 0,
        inReview: 0,
        needsEdits: 0,
        approved: 0,
        resumes: 0,
        coverLetters: 0,
        urgent: 0,
      },
    );

    return {
      ...stats,
      // Aliases for UI compatibility
      inProgress: stats.inReview,
      completed: stats.approved,
      total: caseloadReviews.length,
    };
  },
});
