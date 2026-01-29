/**
 * University Overview Metrics Cache
 *
 * Precomputes exact dashboard counts to avoid heavy per-request scans.
 * Updated nightly via cron.
 */

import { v } from 'convex/values';

import { internal } from './_generated/api';
import { Doc, Id } from './_generated/dataModel';
import { internalMutation, MutationCtx, QueryCtx } from './_generated/server';
import { normalizeLegacyUserRole, type UserRole } from './lib/roleValidation';

const STUDENT_PAGE_SIZE = 1000;

function isUniversityStudent(user: Doc<'users'>) {
  const normalizedRole = normalizeLegacyUserRole(
    user.role as UserRole | undefined,
    user.university_id,
  );
  return normalizedRole === 'student';
}

export async function computeUniversityOverviewMetrics(
  ctx: QueryCtx | MutationCtx,
  universityId: Id<'universities'>,
) {
  const university = (await ctx.db.get(universityId)) as Doc<'universities'> | null;
  if (!university) {
    throw new Error('University not found');
  }

  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);

  const lastMonthEnd = new Date(thisMonthStart);
  lastMonthEnd.setDate(0);
  lastMonthEnd.setHours(23, 59, 59, 999);

  const departments = await ctx.db
    .query('departments')
    .withIndex('by_university', (q) => q.eq('university_id', universityId))
    .collect();

  const departmentCounts = new Map<string, number>(
    departments.map((dept: Doc<'departments'>) => [dept._id, 0]),
  );

  let totalStudents = 0;
  let activeStudents = 0;
  let newStudentsThisMonth = 0;
  let studentsLastMonth = 0;
  let unassignedStudents = 0;

  let cursor: string | null = null;
  let isDone = false;
  while (!isDone) {
    const page = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', universityId))
      .paginate({ cursor, numItems: STUDENT_PAGE_SIZE });

    for (const student of page.page) {
      if (!isUniversityStudent(student)) continue;

      totalStudents++;

      const lastActive = (student as { last_active?: number }).last_active ?? student.last_login_at;
      if (lastActive && lastActive > thirtyDaysAgo) {
        activeStudents++;
      }

      if (student.created_at && student.created_at >= thisMonthStart.getTime()) {
        newStudentsThisMonth++;
      }
      if (student.created_at && student.created_at <= lastMonthEnd.getTime()) {
        studentsLastMonth++;
      }

      if (student.department_id && departmentCounts.has(student.department_id)) {
        departmentCounts.set(
          student.department_id,
          (departmentCounts.get(student.department_id) || 0) + 1,
        );
      } else {
        // Count as unassigned if no department or department no longer exists
        unassignedStudents++;
      }
    }

    cursor = page.isDone ? null : page.continueCursor;
    isDone = page.isDone;
  }

  // Courses are typically far fewer than students; collect in one query
  // to avoid multiple paginated queries in a single function.
  const courses = await ctx.db
    .query('courses')
    .withIndex('by_university', (q) => q.eq('university_id', universityId))
    .collect();
  const totalCourses = courses.length;

  const studentGrowthPercent =
    studentsLastMonth > 0
      ? Math.round(((totalStudents - studentsLastMonth) / studentsLastMonth) * 1000) / 10
      : 0;

  const departmentDistribution = departments.map((dept: Doc<'departments'>) => {
    const count = departmentCounts.get(dept._id) || 0;
    return {
      id: dept._id,
      name: dept.name,
      count,
      percentage: totalStudents > 0 ? Math.round((count / totalStudents) * 100) : 0,
    };
  });

  const licenseCapacity = (university.license_seats as number | undefined) ?? totalStudents;

  return {
    university_id: universityId,
    computed_at: now,
    total_students: totalStudents,
    active_students: activeStudents,
    new_students_this_month: newStudentsThisMonth,
    student_growth_percent: studentGrowthPercent,
    departments: departments.length,
    total_courses: totalCourses,
    license_capacity: licenseCapacity,
    active_licenses: totalStudents,
    unassigned_students: unassignedStudents,
    department_distribution: departmentDistribution,
  };
}

async function upsertUniversityOverviewMetrics(
  ctx: MutationCtx,
  metrics: Omit<Doc<'university_overview_metrics'>, '_id' | '_creationTime'>,
) {
  const existing = await ctx.db
    .query('university_overview_metrics')
    .withIndex('by_university', (q) => q.eq('university_id', metrics.university_id))
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, metrics);
  } else {
    await ctx.db.insert('university_overview_metrics', metrics);
  }
}

export const refreshUniversityOverviewMetrics = internalMutation({
  args: {
    universityId: v.id('universities'),
  },
  handler: async (ctx, args) => {
    const metrics = await computeUniversityOverviewMetrics(ctx, args.universityId);
    await upsertUniversityOverviewMetrics(ctx, metrics);

    return { updated: true, universityId: args.universityId };
  },
});

export const refreshUniversityOverviewMetricsJob = internalMutation({
  args: {
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query('universities')
      .filter((q) => q.or(q.eq(q.field('status'), 'active'), q.eq(q.field('status'), 'trial')))
      .paginate({ cursor: args.cursor ?? null, numItems: 5 });

    for (const university of page.page as Doc<'universities'>[]) {
      const metrics = await computeUniversityOverviewMetrics(ctx, university._id);
      await upsertUniversityOverviewMetrics(ctx, metrics);
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.university_overview_cache.refreshUniversityOverviewMetricsJob,
        {
          cursor: page.continueCursor,
        },
      );
    }

    return { processed: page.page.length, hasMore: !page.isDone };
  },
});
