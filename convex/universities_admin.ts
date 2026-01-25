import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { getAuthenticatedUser, requireSuperAdmin } from './lib/roles';

export const createUniversity = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    license_plan: v.union(
      v.literal('Starter'),
      v.literal('Basic'),
      v.literal('Pro'),
      v.literal('Enterprise'),
    ),
    license_seats: v.number(),
    status: v.union(
      v.literal('active'),
      v.literal('expired'),
      v.literal('trial'),
      v.literal('suspended'),
    ),
    admin_email: v.optional(v.string()),
    created_by_clerkId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const existing = await ctx.db
      .query('universities')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .unique();

    if (existing) return existing._id;

    const creator = await getAuthenticatedUser(ctx);
    const created_by_id = creator?._id ?? undefined;

    const now = Date.now();
    const uniId = await ctx.db.insert('universities', {
      name: args.name,
      slug: args.slug,
      license_plan: args.license_plan,
      license_seats: args.license_seats,
      license_used: 0,
      license_start: now,
      license_end: undefined,
      status: args.status,
      admin_email: args.admin_email,
      created_by_id,
      created_at: now,
      updated_at: now,
    });

    return uniId;
  },
});

export const getAllUniversities = query({
  args: {
    clerkId: v.optional(v.string()),
    includeDeleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const universities = await ctx.db.query('universities').collect();

    if (!args.includeDeleted) {
      return universities.filter((u) => u.status !== 'deleted');
    }

    return universities;
  },
});

export const updateUniversity = mutation({
  args: {
    universityId: v.id('universities'),
    updates: v.object({
      name: v.optional(v.string()),
      slug: v.optional(v.string()),
      description: v.optional(v.string()),
      website: v.optional(v.string()),
      contact_email: v.optional(v.string()),
      license_plan: v.optional(
        v.union(
          v.literal('Starter'),
          v.literal('Basic'),
          v.literal('Pro'),
          v.literal('Enterprise'),
        ),
      ),
      license_seats: v.optional(v.number()),
      max_students: v.optional(v.number()),
      status: v.optional(
        v.union(
          v.literal('active'),
          v.literal('expired'),
          v.literal('trial'),
          v.literal('suspended'),
        ),
      ),
      admin_email: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const { universityId, updates } = args;

    await ctx.db.patch(universityId, {
      ...updates,
      updated_at: Date.now(),
    });

    return universityId;
  },
});

export const toggleTestUniversity = mutation({
  args: {
    universityId: v.id('universities'),
    isTest: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const university = await ctx.db.get(args.universityId);
    if (!university) {
      throw new Error('University not found');
    }

    const now = Date.now();
    const actingUser = await getAuthenticatedUser(ctx);

    await ctx.db.patch(args.universityId, {
      is_test: args.isTest,
      updated_at: now,
    });

    await ctx.db.insert('audit_logs', {
      action: args.isTest ? 'university_marked_test' : 'university_unmarked_test',
      target_type: 'university',
      target_id: args.universityId,
      target_name: university.name,
      performed_by_id: actingUser._id,
      performed_by_email: actingUser.email,
      performed_by_name: actingUser.name,
      metadata: {
        university_slug: university.slug,
        is_test: args.isTest,
      },
      timestamp: now,
      created_at: now,
    });

    return {
      success: true,
      universityId: args.universityId,
      isTest: args.isTest,
      message: args.isTest
        ? `University "${university.name}" marked as test university`
        : `University "${university.name}" unmarked as test university`,
    };
  },
});

export const archiveUniversity = mutation({
  args: {
    universityId: v.id('universities'),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const university = await ctx.db.get(args.universityId);
    if (!university) {
      throw new Error('University not found');
    }

    if (university.status === 'archived') {
      throw new Error('University is already archived');
    }

    const now = Date.now();
    const actingUser = await getAuthenticatedUser(ctx);

    await ctx.db.patch(args.universityId, {
      status: 'archived',
      archived_at: now,
      updated_at: now,
    });

    await ctx.db.insert('audit_logs', {
      action: 'university_archived',
      target_type: 'university',
      target_id: args.universityId,
      target_name: university.name,
      performed_by_id: actingUser._id,
      performed_by_email: actingUser.email,
      performed_by_name: actingUser.name,
      metadata: {
        university_slug: university.slug,
        previous_status: university.status,
      },
      timestamp: now,
      created_at: now,
    });

    return {
      success: true,
      universityId: args.universityId,
      message: `University "${university.name}" has been archived`,
      previousStatus: university.status,
    };
  },
});

export const restoreUniversity = mutation({
  args: {
    universityId: v.id('universities'),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const university = await ctx.db.get(args.universityId);
    if (!university) {
      throw new Error('University not found');
    }

    if (university.status !== 'archived') {
      throw new Error(
        'Only archived universities can be restored. Current status: ' + university.status,
      );
    }

    const now = Date.now();
    const actingUser = await getAuthenticatedUser(ctx);
    const newStatus = 'active' as const;

    await ctx.db.patch(args.universityId, {
      status: newStatus,
      archived_at: undefined,
      updated_at: now,
    });

    await ctx.db.insert('audit_logs', {
      action: 'university_restored',
      target_type: 'university',
      target_id: args.universityId,
      target_name: university.name,
      performed_by_id: actingUser._id,
      performed_by_email: actingUser.email,
      performed_by_name: actingUser.name,
      reason: args.reason,
      metadata: {
        university_slug: university.slug,
        previous_status: 'archived',
        new_status: newStatus,
        archived_at: university.archived_at,
      },
      timestamp: now,
      created_at: now,
    });

    return {
      success: true,
      universityId: args.universityId,
      message: `University "${university.name}" has been restored from archive`,
      newStatus,
    };
  },
});

export const hardDeleteUniversity = mutation({
  args: {
    universityId: v.id('universities'),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const university = await ctx.db.get(args.universityId);
    if (!university) {
      throw new Error('University not found');
    }

    const now = Date.now();
    const actingUser = await getAuthenticatedUser(ctx);

    if (university.is_test === true) {
      const errors: Array<{ step: string; error: string }> = [];
      const deletedCounts = {
        studentAdvisors: 0, // Canonical table
        advisorStudentsLegacy: 0, // Legacy table (deprecated)
        memberships: 0,
        studentInvites: 0,
        studentProfiles: 0,
        courses: 0,
        departments: 0,
        unlinkedUsers: 0,
        clearedApplications: 0,
        clearedGoals: 0,
      };

      // Delete from canonical student_advisors table
      try {
        const studentAdvisors = await ctx.db
          .query('student_advisors')
          .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
          .collect();
        for (const record of studentAdvisors) {
          await ctx.db.delete(record._id);
          deletedCounts.studentAdvisors++;
        }
      } catch (error) {
        errors.push({ step: 'delete student_advisors', error: String(error) });
      }

      // Delete from legacy advisorStudents table (deprecated, will be removed)
      try {
        const advisorStudents = await ctx.db
          .query('advisorStudents')
          .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
          .collect();
        for (const record of advisorStudents) {
          await ctx.db.delete(record._id);
          deletedCounts.advisorStudentsLegacy++;
        }
      } catch (error) {
        errors.push({ step: 'delete advisorStudents (legacy)', error: String(error) });
      }

      try {
        const memberships = await ctx.db
          .query('memberships')
          .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
          .collect();
        for (const record of memberships) {
          await ctx.db.delete(record._id);
          deletedCounts.memberships++;
        }
      } catch (error) {
        errors.push({ step: 'delete memberships', error: String(error) });
      }

      try {
        const studentInvites = await ctx.db
          .query('studentInvites')
          .filter((q) => q.eq(q.field('university_id'), args.universityId))
          .collect();
        for (const record of studentInvites) {
          await ctx.db.delete(record._id);
          deletedCounts.studentInvites++;
        }
      } catch (error) {
        errors.push({ step: 'delete studentInvites', error: String(error) });
      }

      try {
        const studentProfiles = await ctx.db
          .query('studentProfiles')
          .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
          .collect();
        for (const record of studentProfiles) {
          await ctx.db.delete(record._id);
          deletedCounts.studentProfiles++;
        }
      } catch (error) {
        errors.push({ step: 'delete studentProfiles', error: String(error) });
      }

      try {
        const courses = await ctx.db
          .query('courses')
          .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
          .collect();
        for (const record of courses) {
          await ctx.db.delete(record._id);
          deletedCounts.courses++;
        }
      } catch (error) {
        errors.push({ step: 'delete courses', error: String(error) });
      }

      try {
        const departments = await ctx.db
          .query('departments')
          .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
          .collect();
        for (const record of departments) {
          await ctx.db.delete(record._id);
          deletedCounts.departments++;
        }
      } catch (error) {
        errors.push({ step: 'delete departments', error: String(error) });
      }

      try {
        const linkedUsers = await ctx.db
          .query('users')
          .filter((q) => q.eq(q.field('university_id'), args.universityId))
          .collect();
        for (const user of linkedUsers) {
          await ctx.db.patch(user._id, {
            university_id: undefined,
            is_test_user: true,
            ...(user.role === 'university_admin' || user.role === 'advisor'
              ? { role: 'individual' as const }
              : {}),
            ...(user.subscription_plan === 'university'
              ? { subscription_plan: 'free' as const }
              : {}),
            updated_at: now,
          });
          deletedCounts.unlinkedUsers++;
        }
      } catch (error) {
        errors.push({ step: 'unlink users', error: String(error) });
      }

      try {
        const applications = await ctx.db
          .query('applications')
          .filter((q) => q.eq(q.field('university_id'), args.universityId))
          .collect();
        for (const record of applications) {
          await ctx.db.patch(record._id, { university_id: undefined, updated_at: now });
          deletedCounts.clearedApplications++;
        }
      } catch (error) {
        errors.push({ step: 'clear applications', error: String(error) });
      }

      try {
        const goals = await ctx.db
          .query('goals')
          .filter((q) => q.eq(q.field('university_id'), args.universityId))
          .collect();
        for (const record of goals) {
          await ctx.db.patch(record._id, { university_id: undefined, updated_at: now });
          deletedCounts.clearedGoals++;
        }
      } catch (error) {
        errors.push({ step: 'clear goals', error: String(error) });
      }

      try {
        await ctx.db.insert('audit_logs', {
          action: 'university_hard_deleted',
          target_type: 'university',
          target_id: args.universityId,
          target_name: university.name,
          performed_by_id: actingUser._id,
          performed_by_email: actingUser.email,
          performed_by_name: actingUser.name,
          metadata: {
            university_slug: university.slug,
            university_status: university.status,
            is_test: true,
            deletedCounts,
            errors: errors.length > 0 ? errors : undefined,
          },
          timestamp: now,
          created_at: now,
        });
      } catch (error) {
        throw new Error(
          `Hard delete aborted: Could not create audit log. This operation requires an audit trail for compliance. ` +
            `Partial cleanup may have occurred (see counts). Do not retry without investigating. ` +
            `Deleted counts: ${JSON.stringify(deletedCounts)}. ` +
            `Audit log error: ${String(error)}`,
        );
      }

      try {
        await ctx.db.delete(args.universityId);
      } catch (error) {
        errors.push({ step: 'delete university record', error: String(error) });
        throw new Error(
          `Hard delete failed: Could not delete university record. ` +
            `Partial deletion occurred. Manual cleanup required. ` +
            `Errors: ${JSON.stringify(errors)}`,
        );
      }

      if (errors.length > 0) {
        throw new Error(
          `Hard delete completed with errors. University record deleted but some cleanup operations failed. ` +
            `Manual verification recommended. Deleted counts: ${JSON.stringify(deletedCounts)}. ` +
            `Errors: ${JSON.stringify(errors)}`,
        );
      }

      return {
        success: true,
        type: 'hard_delete_test',
        universityId: args.universityId,
        message: `Test university "${university.name}" and all related data have been permanently deleted`,
        deletedCounts,
      };
    }

    throw new Error(
      `Hard delete is disabled for real universities. ` +
        `University "${university.name}" (is_test = false) cannot be hard deleted. ` +
        `Use archiveUniversity instead for non-destructive disable. ` +
        `If you must perform hard delete for legal/compliance reasons, ` +
        `first mark the university as a test university using toggleTestUniversity.`,
    );
  },
});

export const deleteUniversity = mutation({
  args: {
    universityId: v.id('universities'),
    hardDelete: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.hardDelete) {
      throw new Error(
        'deleteUniversity with hardDelete=true is deprecated. ' +
          'Use hardDeleteUniversity instead. ' +
          'Note: Hard delete only works for test universities. ' +
          'For real universities, use archiveUniversity.',
      );
    } else {
      throw new Error(
        'deleteUniversity is deprecated. ' +
          'Use archiveUniversity for non-destructive disable (preferred), ' +
          'or hardDeleteUniversity for test universities only.',
      );
    }
  },
});
