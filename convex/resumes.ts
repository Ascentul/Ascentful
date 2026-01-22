import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { ACTIVITY_EVENTS, trackActivity } from './lib/activityTracker';
import { safeLogAudit } from './lib/auditLogger';
import { requireMembership } from './lib/roles';

// Get resumes for a user
export const getUserResumes = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    // Note: We don't require membership for read queries - users can always view their own resumes
    // Membership is only used for write operations and tenant isolation

    // OPTIMIZED: Add limit to prevent bandwidth issues
    const resumes = await ctx.db
      .query('resumes')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .order('desc')
      .take(50); // Limit to 50 most recent resumes

    return resumes;
  },
});

// Create a new resume
export const createResume = mutation({
  args: {
    clerkId: v.string(),
    title: v.string(),
    content: v.any(),
    visibility: v.union(v.literal('private'), v.literal('public')),
    source: v.optional(
      v.union(
        v.literal('manual'),
        v.literal('ai_generated'),
        v.literal('ai_optimized'),
        v.literal('pdf_upload'),
      ),
    ),
    job_description: v.optional(v.string()),
    extracted_text: v.optional(v.string()),
    analysis_result: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    const membership =
      user.role === 'student'
        ? (await requireMembership(ctx, { role: 'student' })).membership
        : null;

    const now = Date.now();

    const resumeId = await ctx.db.insert('resumes', {
      user_id: user._id,
      university_id: membership?.university_id ?? user.university_id,
      title: args.title,
      content: args.content,
      visibility: args.visibility,
      source: args.source,
      job_description: args.job_description,
      extracted_text: args.extracted_text,
      analysis_result: args.analysis_result,
      version_counter: 1,
      created_at: now,
      updated_at: now,
    });

    await ctx.db.insert('resume_versions', {
      resume_id: resumeId,
      user_id: user._id,
      version_number: 1,
      version_label: 'Initial draft',
      content_snapshot: args.content,
      trigger: 'creation',
      created_at: now,
    });

    // Track activity event for engagement scoring
    await trackActivity(ctx, {
      userId: user._id,
      universityId: user.university_id,
      eventType: ACTIVITY_EVENTS.RESUME_CREATED,
      eventCategory: 'document',
      entityType: 'resume',
      entityId: resumeId,
      metadata: {
        title: args.title,
        source: args.source,
        visibility: args.visibility,
      },
    });

    // Audit log: resume created
    await safeLogAudit(ctx, {
      category: 'user_action',
      action: 'resume.created',
      actorUserId: user._id,
      actorRole: user.role,
      actorUniversityId: user.university_id,
      targetType: 'resume',
      targetId: resumeId,
      metadata: {
        title: args.title,
        source: args.source,
        visibility: args.visibility,
      },
    });

    return resumeId;
  },
});

// Update a resume
export const updateResume = mutation({
  args: {
    clerkId: v.string(),
    resumeId: v.id('resumes'),
    updates: v.object({
      title: v.optional(v.string()),
      content: v.optional(v.any()),
      visibility: v.optional(v.union(v.literal('private'), v.literal('public'))),
      extracted_text: v.optional(v.string()),
      job_description: v.optional(v.string()),
      analysis_result: v.optional(v.any()),
      ai_suggestions: v.optional(v.any()),
    }),
  },
  handler: async (ctx, { clerkId, resumeId, updates }) => {
    // Get user by Clerk ID
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    // Verify ownership
    const resume = await ctx.db.get(resumeId);
    if (!resume || resume.user_id !== user._id) {
      throw new Error('Resume not found or access denied');
    }

    if (resume.university_id && user.university_id && resume.university_id !== user.university_id) {
      throw new Error('Unauthorized: Resume belongs to another university');
    }

    // Update the resume
    await ctx.db.patch(resumeId, {
      ...updates,
      updated_at: Date.now(),
    });

    // Audit log: resume updated
    await safeLogAudit(ctx, {
      category: 'user_action',
      action: 'resume.updated',
      actorUserId: user._id,
      actorRole: user.role,
      actorUniversityId: user.university_id,
      targetType: 'resume',
      targetId: resumeId,
      metadata: {
        title: resume.title,
        updatedFields: Object.keys(updates),
      },
    });

    return { success: true };
  },
});

// Delete a resume
export const deleteResume = mutation({
  args: {
    clerkId: v.string(),
    resumeId: v.id('resumes'),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    const resume = await ctx.db.get(args.resumeId);
    if (!resume || resume.user_id !== user._id) {
      throw new Error('Resume not found or unauthorized');
    }

    // University isolation check
    if (resume.university_id && user.university_id && resume.university_id !== user.university_id) {
      throw new Error('Unauthorized: Resume belongs to another university');
    }

    // Referential integrity: Check for active reviews before deletion
    // Uses by_resume index for O(1) lookup instead of scanning by_student
    // Active reviews are those awaiting action (waiting/in_review), not finalized ones (approved/needs_edits)
    const activeReview = await ctx.db
      .query('advisor_reviews')
      .withIndex('by_resume', (q) => q.eq('resume_id', args.resumeId))
      .filter((q) => q.or(q.eq(q.field('status'), 'waiting'), q.eq(q.field('status'), 'in_review')))
      .first();

    if (activeReview) {
      throw new Error(
        'Cannot delete resume: Active review in progress. Please wait for the review to complete or contact your advisor.',
      );
    }

    await ctx.db.delete(args.resumeId);

    // Audit log: resume deleted
    await safeLogAudit(ctx, {
      category: 'user_action',
      action: 'resume.deleted',
      actorUserId: user._id,
      actorRole: user.role,
      actorUniversityId: user.university_id,
      targetType: 'resume',
      targetId: args.resumeId,
      previousValue: {
        title: resume.title,
        source: resume.source,
      },
    });

    return args.resumeId;
  },
});

// Get a single resume by id (ensures it belongs to the Clerk user)
export const getResumeById = query({
  args: {
    clerkId: v.string(),
    resumeId: v.id('resumes'),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) throw new Error('User not found');

    // Note: We don't require membership for read queries - consistent with getUserResumes
    // Users can always view their own resumes regardless of membership status

    const resume = await ctx.db.get(args.resumeId);
    if (!resume || resume.user_id !== user._id) {
      // Return null instead of throwing to avoid client runtime errors during transitions
      return null;
    }

    // University isolation for reads - use user's university_id directly
    if (resume.university_id && user.university_id && resume.university_id !== user.university_id) {
      return null;
    }

    return resume;
  },
});

// ============================================================================
// Resume Builder 2.0: New mutations and queries
// ============================================================================

// Create resume from the 3-step funnel
export const createResumeFromFunnel = mutation({
  args: {
    clerkId: v.string(),
    title: v.string(),
    intent: v.union(
      v.literal('internship'),
      v.literal('fulltime'),
      v.literal('parttime'),
      v.literal('grad_school'),
      v.literal('unsure'),
    ),
    startSource: v.union(v.literal('profile'), v.literal('upload'), v.literal('blank')),
    templateId: v.union(
      v.literal('clean'),
      v.literal('modern'),
      v.literal('bold'),
      v.literal('minimal'),
      v.literal('classic'),
      v.literal('ats'),
      v.literal('executive'),
    ),
    enabledSections: v.array(v.string()),
    sectionOrder: v.array(v.string()),
    content: v.any(),
    styleConfig: v.optional(
      v.object({
        font_pairing: v.optional(
          v.union(
            v.literal('classic'),
            v.literal('modern'),
            v.literal('elegant'),
            v.literal('minimal'),
            v.literal('executive'),
            v.literal('creative'),
            v.literal('technical'),
            v.literal('swiss'),
            v.literal('editorial'),
            v.literal('geometric'),
            v.literal('humanist'),
            v.literal('traditional'),
          ),
        ),
        accent_color: v.optional(v.string()),
        density: v.optional(v.union(v.literal('comfortable'), v.literal('compact'))),
        heading_style: v.optional(v.union(v.literal('caps'), v.literal('title_case'))),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    const membership =
      user.role === 'student'
        ? (await requireMembership(ctx, { role: 'student' })).membership
        : null;

    const now = Date.now();

    // Create the resume
    const resumeId = await ctx.db.insert('resumes', {
      user_id: user._id,
      university_id: membership?.university_id ?? user.university_id,
      title: args.title,
      content: args.content,
      visibility: 'private',
      source: 'manual',
      intent: args.intent,
      start_source: args.startSource,
      template_id: args.templateId,
      style_config: args.styleConfig || {
        font_pairing: 'modern',
        accent_color: '#5371FF',
        density: 'comfortable',
        heading_style: 'title_case',
      },
      sections_config: {
        enabled_sections: args.enabledSections,
        section_order: args.sectionOrder,
      },
      is_draft: true,
      version_counter: 1,
      last_autosave_at: now,
      created_at: now,
      updated_at: now,
    });

    // Create initial version snapshot
    await ctx.db.insert('resume_versions', {
      resume_id: resumeId,
      user_id: user._id,
      version_number: 1,
      version_label: 'Initial draft',
      content_snapshot: args.content,
      trigger: 'creation',
      created_at: now,
    });

    // Audit log
    await safeLogAudit(ctx, {
      category: 'user_action',
      action: 'resume.created_from_funnel',
      actorUserId: user._id,
      actorRole: user.role,
      actorUniversityId: user.university_id,
      targetType: 'resume',
      targetId: resumeId,
      metadata: {
        title: args.title,
        intent: args.intent,
        startSource: args.startSource,
        templateId: args.templateId,
      },
    });

    // Track activity event for engagement scoring
    await trackActivity(ctx, {
      userId: user._id,
      universityId: user.university_id,
      eventType: ACTIVITY_EVENTS.RESUME_CREATED,
      eventCategory: 'document',
      entityType: 'resume',
      entityId: resumeId,
      metadata: {
        title: args.title,
        intent: args.intent,
        startSource: args.startSource,
        templateId: args.templateId,
      },
    });

    return resumeId;
  },
});

// Autosave resume (debounced from frontend)
export const autosaveResume = mutation({
  args: {
    clerkId: v.string(),
    resumeId: v.id('resumes'),
    content: v.optional(v.any()),
    styleConfig: v.optional(
      v.object({
        font_pairing: v.optional(
          v.union(
            v.literal('classic'),
            v.literal('modern'),
            v.literal('elegant'),
            v.literal('minimal'),
            v.literal('executive'),
            v.literal('creative'),
            v.literal('technical'),
            v.literal('swiss'),
            v.literal('editorial'),
            v.literal('geometric'),
            v.literal('humanist'),
            v.literal('traditional'),
          ),
        ),
        accent_color: v.optional(v.string()),
        density: v.optional(v.union(v.literal('comfortable'), v.literal('compact'))),
        heading_style: v.optional(v.union(v.literal('caps'), v.literal('title_case'))),
      }),
    ),
    sectionsConfig: v.optional(
      v.object({
        enabled_sections: v.optional(v.array(v.string())),
        section_order: v.optional(v.array(v.string())),
      }),
    ),
    templateId: v.optional(
      v.union(
        v.literal('clean'),
        v.literal('modern'),
        v.literal('bold'),
        v.literal('minimal'),
        v.literal('classic'),
        v.literal('ats'),
        v.literal('executive'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    const resume = await ctx.db.get(args.resumeId);
    if (!resume || resume.user_id !== user._id) {
      throw new Error('Resume not found or access denied');
    }

    // University isolation check
    if (resume.university_id && user.university_id && resume.university_id !== user.university_id) {
      throw new Error('Unauthorized: Resume belongs to another university');
    }

    const now = Date.now();
    const currentVersionCounter = resume.version_counter ?? 0;
    const newVersionCounter = currentVersionCounter + 1;

    const updates: Record<string, unknown> = {
      updated_at: now,
      last_autosave_at: now,
      version_counter: newVersionCounter,
    };

    if (args.content !== undefined) {
      updates.content = args.content;
    }
    if (args.styleConfig !== undefined) {
      updates.style_config = args.styleConfig;
    }
    if (args.sectionsConfig !== undefined) {
      updates.sections_config = args.sectionsConfig;
    }
    if (args.templateId !== undefined) {
      updates.template_id = args.templateId;
    }

    await ctx.db.patch(args.resumeId, updates);

    // Smart version creation for version history (Canva/Notion-like behavior)
    // Create a version snapshot when:
    // 1. It's been 5+ minutes since last autosave (user returned after break)
    // 2. Every 20 autosaves as a fallback (roughly every 10 seconds of active editing)
    // This provides meaningful restore points without overwhelming storage
    const lastAutosave = resume.last_autosave_at ?? 0;
    const timeSinceLastSave = now - lastAutosave;
    const fiveMinutes = 5 * 60 * 1000;

    const shouldCreateVersion =
      (timeSinceLastSave >= fiveMinutes && args.content !== undefined) || // Gap in editing
      (newVersionCounter % 20 === 0 && args.content !== undefined); // Periodic checkpoint

    if (shouldCreateVersion) {
      await ctx.db.insert('resume_versions', {
        resume_id: args.resumeId,
        user_id: user._id,
        university_id: resume.university_id ?? user.university_id ?? undefined,
        version_number: newVersionCounter,
        content_snapshot: args.content,
        // Use 'manual_save' for gap-based versions (user returned after break)
        // Use 'auto_checkpoint' for periodic automatic checkpoints
        trigger: timeSinceLastSave >= fiveMinutes ? 'manual_save' : 'auto_checkpoint',
        created_at: now,
      });
    }

    return { success: true, savedAt: now, versionCounter: newVersionCounter };
  },
});

// Create a version snapshot (for undo support)
export const createResumeVersion = mutation({
  args: {
    clerkId: v.string(),
    resumeId: v.id('resumes'),
    versionLabel: v.optional(v.string()),
    trigger: v.union(
      v.literal('creation'),
      v.literal('ai_edit'),
      v.literal('manual_save'),
      v.literal('section_change'),
      v.literal('auto_checkpoint'),
      v.literal('restoration'),
    ),
    contentSnapshot: v.any(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    const resume = await ctx.db.get(args.resumeId);
    if (!resume || resume.user_id !== user._id) {
      throw new Error('Resume not found or access denied');
    }

    // University isolation check
    if (resume.university_id && user.university_id && resume.university_id !== user.university_id) {
      throw new Error('Unauthorized: Resume belongs to another university');
    }

    // Use existing version_counter since we already have the resume document loaded
    const currentVersion = resume.version_counter ?? 0;
    const newVersionNumber = currentVersion + 1;

    await ctx.db.patch(args.resumeId, { version_counter: newVersionNumber });

    const versionId = await ctx.db.insert('resume_versions', {
      resume_id: args.resumeId,
      user_id: user._id,
      university_id: resume.university_id ?? user.university_id ?? undefined,
      version_number: newVersionNumber,
      version_label: args.versionLabel,
      content_snapshot: args.contentSnapshot,
      trigger: args.trigger,
      created_at: Date.now(),
    });

    return { versionId, versionNumber: newVersionNumber };
  },
});

// Restore a previous version
export const restoreResumeVersion = mutation({
  args: {
    clerkId: v.string(),
    resumeId: v.id('resumes'),
    versionNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    const resume = await ctx.db.get(args.resumeId);
    if (!resume || resume.user_id !== user._id) {
      throw new Error('Resume not found or access denied');
    }

    // University isolation check
    if (resume.university_id && user.university_id && resume.university_id !== user.university_id) {
      throw new Error('Unauthorized: Resume belongs to another university');
    }

    // Find the version to restore
    const versionToRestore = await ctx.db
      .query('resume_versions')
      .withIndex('by_resume_version', (q) =>
        q.eq('resume_id', args.resumeId).eq('version_number', args.versionNumber),
      )
      .first();
    if (!versionToRestore) {
      throw new Error('Version not found');
    }

    // Use existing version_counter since we already have the resume document loaded
    const currentVersion = resume.version_counter ?? 0;
    const newVersionNumber = currentVersion + 1;

    // Update the resume with the snapshot and new version counter
    await ctx.db.patch(args.resumeId, {
      content: versionToRestore.content_snapshot,
      version_counter: newVersionNumber,
      updated_at: Date.now(),
    });

    await ctx.db.insert('resume_versions', {
      resume_id: args.resumeId,
      user_id: user._id,
      university_id: resume.university_id ?? user.university_id ?? undefined,
      version_number: newVersionNumber,
      version_label: `Restored from version ${args.versionNumber}`,
      content_snapshot: versionToRestore.content_snapshot,
      trigger: 'restoration',
      created_at: Date.now(),
    });

    return { success: true };
  },
});

// Get version history for a resume
export const getResumeVersions = query({
  args: {
    clerkId: v.string(),
    resumeId: v.id('resumes'),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    const resume = await ctx.db.get(args.resumeId);
    if (!resume || resume.user_id !== user._id) {
      return [];
    }

    // University isolation check
    if (resume.university_id && user.university_id && resume.university_id !== user.university_id) {
      return [];
    }

    const versions = await ctx.db
      .query('resume_versions')
      .withIndex('by_resume', (q) => q.eq('resume_id', args.resumeId))
      .order('desc')
      .take(20); // Limit to last 20 versions

    return versions;
  },
});

// Get user profile data for resume prefill
export const getUserProfileForResume = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) {
      return null;
    }

    // Fetch user's projects
    const projects = await ctx.db
      .query('projects')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .order('desc')
      .take(10);

    return {
      // Contact info
      name: user.name,
      email: user.email,
      phone: user.phone_number,
      location: user.location,
      linkedin: user.linkedin_url,
      github: user.github_url,
      website: user.website,

      // Career data
      current_position: user.current_position,
      current_company: user.current_company,
      bio: user.bio,
      skills: user.skills, // Comma-separated string
      industry: user.industry,
      experience_level: user.experience_level,

      // History arrays
      work_history: user.work_history || [],
      education_history: user.education_history || [],
      achievements_history: user.achievements_history || [],

      // Projects from separate table
      projects: projects.map((p) => ({
        id: p._id,
        title: p.title,
        role: p.role,
        company: p.company,
        description: p.description,
        technologies: p.technologies,
        url: p.url,
        github_url: p.github_url,
        start_date: p.start_date,
        end_date: p.end_date,
      })),
    };
  },
});
