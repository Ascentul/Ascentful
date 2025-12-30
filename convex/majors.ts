/**
 * Majors Module
 *
 * CRUD operations for university majors/programs.
 * All mutations require university_admin role with tenant isolation.
 */

import { v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { getCurrentUser, requireTenant } from './advisor_auth';
import { assertUniversityAccess, requireUniversityAdmin } from './lib/roles';

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get all majors for a department
 */
export const getMajorsByDepartment = query({
  args: {
    departmentId: v.id('departments'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);

    const department = await ctx.db.get(args.departmentId);
    if (!department) {
      throw new Error('Department not found');
    }

    // Super admins can access any department
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (department.university_id !== universityId) {
        throw new Error('Unauthorized: Department is not in your university');
      }
    }

    const majors = await ctx.db
      .query('majors')
      .withIndex('by_department', (q) => q.eq('department_id', args.departmentId))
      .collect();

    // Filter to active majors only (unless explicitly showing inactive)
    return majors.filter((m) => m.is_active !== false);
  },
});

/**
 * Get all majors for a university
 */
export const getMajorsByUniversity = query({
  args: {
    universityId: v.id('universities'),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);

    // Super admins can access any university
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (universityId !== args.universityId) {
        throw new Error('Unauthorized: Different university');
      }
    }

    const majors = await ctx.db
      .query('majors')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .collect();

    if (args.includeInactive) {
      return majors;
    }

    return majors.filter((m) => m.is_active !== false);
  },
});

/**
 * Get a single major by ID
 */
export const getMajor = query({
  args: {
    majorId: v.id('majors'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);

    const major = await ctx.db.get(args.majorId);
    if (!major) {
      throw new Error('Major not found');
    }

    // Super admins can access any major
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (major.university_id !== universityId) {
        throw new Error('Unauthorized: Major is not in your university');
      }
    }

    return major;
  },
});

/**
 * Search majors by name or CIP code
 */
export const searchMajors = query({
  args: {
    universityId: v.id('universities'),
    searchTerm: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);
    const limit = args.limit ?? 20;

    // Super admins can access any university
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (universityId !== args.universityId) {
        throw new Error('Unauthorized: Different university');
      }
    }

    const searchLower = args.searchTerm.toLowerCase();

    const majors = await ctx.db
      .query('majors')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .filter((q) => q.neq(q.field('is_active'), false))
      .collect();

    // Filter by search term (name or CIP code)
    const filtered = majors.filter(
      (m) =>
        m.name.toLowerCase().includes(searchLower) ||
        (m.cip_code && m.cip_code.includes(args.searchTerm)),
    );

    return filtered.slice(0, limit);
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new major
 * Requires university_admin role
 */
export const createMajor = mutation({
  args: {
    departmentId: v.id('departments'),
    name: v.string(),
    cipCode: v.optional(v.string()),
    degreeLevel: v.optional(
      v.union(
        v.literal('certificate'),
        v.literal('associate'),
        v.literal('bachelor'),
        v.literal('master'),
        v.literal('doctoral'),
        v.literal('professional'),
      ),
    ),
    commonCareers: v.optional(v.array(v.string())),
    averageSalary: v.optional(v.number()),
    jobGrowthRate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    // Get department and verify university access
    const department = await ctx.db.get(args.departmentId);
    if (!department) {
      throw new Error('Department not found');
    }

    assertUniversityAccess(user, department.university_id);

    const now = Date.now();

    const majorId = await ctx.db.insert('majors', {
      department_id: args.departmentId,
      university_id: department.university_id,
      name: args.name,
      cip_code: args.cipCode,
      degree_level: args.degreeLevel,
      common_careers: args.commonCareers,
      average_salary: args.averageSalary,
      job_growth_rate: args.jobGrowthRate,
      is_active: true,
      created_at: now,
      updated_at: now,
    });

    return majorId;
  },
});

/**
 * Update an existing major
 * Requires university_admin role
 */
export const updateMajor = mutation({
  args: {
    majorId: v.id('majors'),
    name: v.optional(v.string()),
    cipCode: v.optional(v.string()),
    degreeLevel: v.optional(
      v.union(
        v.literal('certificate'),
        v.literal('associate'),
        v.literal('bachelor'),
        v.literal('master'),
        v.literal('doctoral'),
        v.literal('professional'),
      ),
    ),
    commonCareers: v.optional(v.array(v.string())),
    averageSalary: v.optional(v.number()),
    jobGrowthRate: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    const major = await ctx.db.get(args.majorId);
    if (!major) {
      throw new Error('Major not found');
    }

    assertUniversityAccess(user, major.university_id);

    const updates: Partial<{
      name: string;
      cip_code: string;
      degree_level:
        | 'certificate'
        | 'associate'
        | 'bachelor'
        | 'master'
        | 'doctoral'
        | 'professional';
      common_careers: string[];
      average_salary: number;
      job_growth_rate: number;
      is_active: boolean;
      updated_at: number;
    }> = {
      updated_at: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.cipCode !== undefined) updates.cip_code = args.cipCode;
    if (args.degreeLevel !== undefined) updates.degree_level = args.degreeLevel;
    if (args.commonCareers !== undefined) updates.common_careers = args.commonCareers;
    if (args.averageSalary !== undefined) updates.average_salary = args.averageSalary;
    if (args.jobGrowthRate !== undefined) updates.job_growth_rate = args.jobGrowthRate;
    if (args.isActive !== undefined) updates.is_active = args.isActive;

    await ctx.db.patch(args.majorId, updates);

    return args.majorId;
  },
});

/**
 * Soft delete a major (set is_active to false)
 * Requires university_admin role
 */
export const deleteMajor = mutation({
  args: {
    majorId: v.id('majors'),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    const major = await ctx.db.get(args.majorId);
    if (!major) {
      throw new Error('Major not found');
    }

    assertUniversityAccess(user, major.university_id);

    await ctx.db.patch(args.majorId, {
      is_active: false,
      updated_at: Date.now(),
    });

    return args.majorId;
  },
});

/**
 * Bulk import majors for a department
 * Requires university_admin role
 */
export const bulkImportMajors = mutation({
  args: {
    departmentId: v.id('departments'),
    majors: v.array(
      v.object({
        name: v.string(),
        cipCode: v.optional(v.string()),
        degreeLevel: v.optional(
          v.union(
            v.literal('certificate'),
            v.literal('associate'),
            v.literal('bachelor'),
            v.literal('master'),
            v.literal('doctoral'),
            v.literal('professional'),
          ),
        ),
        commonCareers: v.optional(v.array(v.string())),
        averageSalary: v.optional(v.number()),
        jobGrowthRate: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    const department = await ctx.db.get(args.departmentId);
    if (!department) {
      throw new Error('Department not found');
    }

    assertUniversityAccess(user, department.university_id);

    const now = Date.now();
    const createdIds: Id<'majors'>[] = [];

    for (const majorData of args.majors) {
      const majorId = await ctx.db.insert('majors', {
        department_id: args.departmentId,
        university_id: department.university_id,
        name: majorData.name,
        cip_code: majorData.cipCode,
        degree_level: majorData.degreeLevel,
        common_careers: majorData.commonCareers,
        average_salary: majorData.averageSalary,
        job_growth_rate: majorData.jobGrowthRate,
        is_active: true,
        created_at: now,
        updated_at: now,
      });
      createdIds.push(majorId);
    }

    return createdIds;
  },
});
