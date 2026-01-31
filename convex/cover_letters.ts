import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { safeLogAudit } from './lib/auditLogger';
import { getAuthenticatedUser } from './lib/authorization';
import { requireMembership } from './lib/roles';

// Get cover letters for a user
export const getUserCoverLetters = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    // Note: We don't require membership for read queries - users can always view their own cover letters
    // Membership is only used for write operations and tenant isolation

    // OPTIMIZED: Add limit to prevent bandwidth issues
    const coverLetters = await ctx.db
      .query('cover_letters')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .order('desc')
      .take(50); // Limit to 50 most recent cover letters

    return coverLetters;
  },
});

// Create a new cover letter
export const createCoverLetter = mutation({
  args: {
    name: v.string(),
    job_title: v.string(),
    company_name: v.optional(v.string()),
    template: v.string(),
    content: v.optional(v.string()),
    closing: v.string(),
    source: v.optional(
      v.union(
        v.literal('manual'),
        v.literal('ai_generated'),
        v.literal('ai_optimized'),
        v.literal('pdf_upload'),
      ),
    ),
    // SECURITY: Optional clerkId for server-side API routes that have already
    // authenticated the user through their own mechanisms.
    // Client-side calls should NOT pass this - JWT auth is preferred.
    clerkId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // SECURITY: Prefer JWT token authentication for client-side calls.
    // Fall back to clerkId lookup only for authenticated server-side API routes.
    const identity = await ctx.auth.getUserIdentity();
    let user;
    if (identity) {
      user = await ctx.db
        .query('users')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
        .unique();
    } else if (args.clerkId) {
      // Server-side call with clerkId (API routes that verified auth separately)
      const clerkIdForLookup = args.clerkId;
      user = await ctx.db
        .query('users')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkIdForLookup))
        .unique();
    }
    if (!user) {
      throw new Error('Unauthorized: User not found');
    }

    const membership =
      user.role === 'student'
        ? (await requireMembership(ctx, { role: 'student' })).membership
        : null;

    const coverLetterId = await ctx.db.insert('cover_letters', {
      user_id: user._id,
      university_id: membership?.university_id ?? user.university_id ?? undefined,
      name: args.name,
      job_title: args.job_title,
      company_name: args.company_name,
      template: args.template,
      content: args.content,
      closing: args.closing,
      source: args.source ?? 'manual',
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    // Audit log: cover letter created
    await safeLogAudit(ctx, {
      category: 'user_action',
      action: 'cover_letter.created',
      actorUserId: user._id,
      actorRole: user.role,
      actorUniversityId: user.university_id ?? undefined,
      targetType: 'cover_letter',
      targetId: coverLetterId,
      metadata: {
        name: args.name,
        job_title: args.job_title,
        source: args.source ?? 'manual',
      },
    });

    const doc = await ctx.db.get(coverLetterId);
    return doc;
  },
});

// Update a cover letter
export const updateCoverLetter = mutation({
  args: {
    coverLetterId: v.id('cover_letters'),
    updates: v.object({
      name: v.optional(v.string()),
      job_title: v.optional(v.string()),
      company_name: v.optional(v.string()),
      template: v.optional(v.string()),
      content: v.optional(v.string()),
      closing: v.optional(v.string()),
      source: v.optional(
        v.union(
          v.literal('manual'),
          v.literal('ai_generated'),
          v.literal('ai_optimized'),
          v.literal('pdf_upload'),
        ),
      ),
    }),
  },
  handler: async (ctx, args) => {
    // SECURITY: Get user from JWT token instead of client-supplied clerkId
    const user = await getAuthenticatedUser(ctx);

    const membership =
      user.role === 'student'
        ? (await requireMembership(ctx, { role: 'student' })).membership
        : null;

    const coverLetter = await ctx.db.get(args.coverLetterId);
    if (!coverLetter || coverLetter.user_id !== user._id) {
      throw new Error('Cover letter not found or unauthorized');
    }

    if (
      coverLetter.university_id &&
      membership &&
      coverLetter.university_id !== membership.university_id
    ) {
      throw new Error('Unauthorized: Cover letter belongs to another university');
    }

    await ctx.db.patch(args.coverLetterId, {
      ...args.updates,
      updated_at: Date.now(),
    });

    // Audit log: cover letter updated
    await safeLogAudit(ctx, {
      category: 'user_action',
      action: 'cover_letter.updated',
      actorUserId: user._id,
      actorRole: user.role,
      actorUniversityId: user.university_id ?? undefined,
      targetType: 'cover_letter',
      targetId: args.coverLetterId,
      metadata: {
        name: coverLetter.name,
        updatedFields: Object.keys(args.updates),
      },
    });

    return args.coverLetterId;
  },
});

// Delete a cover letter
export const deleteCoverLetter = mutation({
  args: {
    coverLetterId: v.id('cover_letters'),
  },
  handler: async (ctx, args) => {
    // SECURITY: Get user from JWT token instead of client-supplied clerkId
    const user = await getAuthenticatedUser(ctx);

    const membership =
      user.role === 'student'
        ? (await requireMembership(ctx, { role: 'student' })).membership
        : null;

    const coverLetter = await ctx.db.get(args.coverLetterId);
    if (!coverLetter || coverLetter.user_id !== user._id) {
      throw new Error('Cover letter not found or unauthorized');
    }

    // University isolation check
    if (
      coverLetter.university_id &&
      membership &&
      coverLetter.university_id !== membership.university_id
    ) {
      throw new Error('Unauthorized: Cover letter belongs to another university');
    }

    // Referential integrity: Check for active reviews before deletion
    // Uses by_cover_letter index for O(1) lookup instead of scanning by_student
    // Active reviews are those awaiting action (waiting/in_review), not finalized ones (approved/needs_edits)
    const activeReview = await ctx.db
      .query('advisor_reviews')
      .withIndex('by_cover_letter', (q) => q.eq('cover_letter_id', args.coverLetterId))
      .filter((q) => q.or(q.eq(q.field('status'), 'waiting'), q.eq(q.field('status'), 'in_review')))
      .first();

    if (activeReview) {
      throw new Error(
        'Cannot delete cover letter: Active review in progress. Please wait for the review to complete or contact your advisor.',
      );
    }

    await ctx.db.delete(args.coverLetterId);

    // Audit log: cover letter deleted
    await safeLogAudit(ctx, {
      category: 'user_action',
      action: 'cover_letter.deleted',
      actorUserId: user._id,
      actorRole: user.role,
      actorUniversityId: user.university_id ?? undefined,
      targetType: 'cover_letter',
      targetId: args.coverLetterId,
      previousValue: {
        name: coverLetter.name,
        job_title: coverLetter.job_title,
      },
    });

    return args.coverLetterId;
  },
});

// Generate cover letter content (AI-powered)
export const generateCoverLetterContent = mutation({
  args: {
    job_title: v.string(),
    company_name: v.string(),
    job_description: v.optional(v.string()),
    user_experience: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // SECURITY: Get user from JWT token instead of client-supplied clerkId
    const user = await getAuthenticatedUser(ctx);

    // Mock AI-generated content for now
    // In production, this would integrate with OpenAI or another AI service
    const mockContent = `Dear Hiring Manager,

I am writing to express my strong interest in the ${args.job_title} position at ${args.company_name}. With my background and experience, I am confident that I would be a valuable addition to your team.

${args.user_experience ? `My experience includes: ${args.user_experience}` : 'I bring relevant experience and skills that align well with this role.'}

${args.job_description ? 'Based on the job description, I believe my skills in problem-solving, communication, and technical expertise make me an ideal candidate.' : 'I am excited about the opportunity to contribute to your organization.'}

I would welcome the opportunity to discuss how my background and enthusiasm can contribute to ${args.company_name}'s continued success. Thank you for considering my application.

Sincerely,
${user.name}`;

    return { content: mockContent };
  },
});
