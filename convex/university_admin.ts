import { v } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { normalizeLegacyUserRole } from './lib/roleValidation';
import { computeUniversityOverviewMetrics } from './university_overview_cache';

function requireAdmin(user: any, options?: { allowMissingUniversity?: boolean }) {
  const isAdmin = ['super_admin', 'university_admin', 'advisor'].includes(user.role);
  if (!isAdmin) {
    throw new Error('Unauthorized');
  }

  // University-scoped roles must be tied to a university (unless explicitly allowed)
  if (user.role !== 'super_admin' && !user.university_id && !options?.allowMissingUniversity) {
    throw new Error('Unauthorized: University membership required');
  }
}

async function getCurrentUser(ctx: any, clerkId: string) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error('Unauthorized');
  }
  if (clerkId && clerkId !== identity.subject) {
    throw new Error('Unauthorized: Clerk identity mismatch');
  }
  const user = await ctx.db
    .query('users')
    .withIndex('by_clerk_id', (q: any) => q.eq('clerkId', identity.subject))
    .unique();
  if (!user) throw new Error('User not found');
  return user;
}

export const getOverview = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx, args.clerkId);
    requireAdmin(user, { allowMissingUniversity: true });

    const uniId = user.university_id;
    if (!uniId) {
      return {
        totalStudents: 0,
        licenseCapacity: 0,
        activeLicenses: 0,
        departments: 0,
        totalCourses: 0,
        studentGrowthPercent: 0,
        activeStudents: 0,
        newStudentsThisMonth: 0,
        departmentDistribution: [],
        unassignedStudents: 0,
      };
    }

    const cachedOverview = await ctx.db
      .query('university_overview_metrics')
      .withIndex('by_university', (q) => q.eq('university_id', uniId))
      .unique();

    if (cachedOverview) {
      return {
        totalStudents: cachedOverview.total_students,
        activeLicenses: cachedOverview.active_licenses,
        licenseCapacity: cachedOverview.license_capacity,
        departments: cachedOverview.departments,
        totalCourses: cachedOverview.total_courses,
        studentGrowthPercent: cachedOverview.student_growth_percent,
        activeStudents: cachedOverview.active_students,
        newStudentsThisMonth: cachedOverview.new_students_this_month,
        departmentDistribution: cachedOverview.department_distribution,
        unassignedStudents: cachedOverview.unassigned_students,
      };
    }

    const metrics = await computeUniversityOverviewMetrics(ctx, uniId);
    return {
      totalStudents: metrics.total_students,
      activeLicenses: metrics.active_licenses,
      licenseCapacity: metrics.license_capacity,
      departments: metrics.departments,
      totalCourses: metrics.total_courses,
      studentGrowthPercent: metrics.student_growth_percent,
      activeStudents: metrics.active_students,
      newStudentsThisMonth: metrics.new_students_this_month,
      departmentDistribution: metrics.department_distribution,
      unassignedStudents: metrics.unassigned_students,
    };
  },
});

export const getUniversityAnalytics = query({
  args: { clerkId: v.string(), departmentId: v.optional(v.id('departments')) },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx, args.clerkId);
    requireAdmin(user, { allowMissingUniversity: true });

    const uniId = user.university_id;
    if (!uniId) {
      return {
        studentGrowthData: [],
        activityData: [],
        departmentStats: [],
        platformUsageData: [],
      };
    }

    // OPTIMIZED: Add limits to prevent bandwidth issues
    const [allUsers, departments, courses] = await Promise.all([
      ctx.db
        .query('users')
        .withIndex('by_university', (q: any) => q.eq('university_id', uniId))
        .take(2000), // Limit to 2000 users max
      ctx.db
        .query('departments')
        .withIndex('by_university', (q: any) => q.eq('university_id', uniId))
        .take(100), // Limit to 100 departments max
      ctx.db
        .query('courses')
        .withIndex('by_university', (q: any) => q.eq('university_id', uniId))
        .take(500), // Limit to 500 courses max
    ]);

    // Filter to only actual students (exclude university_admin)
    // Include both legacy 'user' role and current 'student' role
    let students = allUsers.filter((s: any) => s.role === 'user' || s.role === 'student');

    // Filter by department if specified
    if (args.departmentId) {
      students = students.filter((s: any) => s.department_id === args.departmentId);
    }

    // Calculate student growth data (last 6 months)
    const studentGrowthData = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).getTime();

      const monthStudents = students.filter(
        (student) =>
          student.role === 'user' &&
          student.created_at >= monthStart &&
          student.created_at <= monthEnd,
      ).length;

      studentGrowthData.push({
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        students: monthStudents,
      });
    }

    // Calculate department statistics with real student counts
    const departmentStats = departments.map((dept: any) => {
      // Count students actually assigned to this department
      const deptStudents = students.filter((student) => student.department_id === dept._id);

      const deptCourses = courses.filter((course) => course.department_id === dept._id);

      return {
        name: dept.name,
        students: deptStudents.length,
        courses: deptCourses.length,
      };
    });

    // Calculate activity data (last 7 days)
    // Since we don't have session tracking, we'll use application activity as a proxy
    const activityData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;

      // Use university + created_at index for tenant-scoped daily counts
      const dayApplications = await ctx.db
        .query('applications')
        .withIndex('by_university_created_at', (q) =>
          q.eq('university_id', uniId).gte('created_at', dayStart).lte('created_at', dayEnd),
        )
        .take(500); // Limit to 500 applications per day

      // Filter to only include university students
      const universityApplications = dayApplications.filter((app) =>
        students.some((student) => student._id === app.user_id),
      );

      activityData.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        logins: Math.max(0, universityApplications.length * 2), // Estimate logins based on activity
        assignments: universityApplications.length,
      });
    }

    // Calculate monthly platform usage (last 6 months)
    const platformUsageData = [];

    // OPTIMIZED: Filter by time window and limit results to prevent bandwidth issues
    const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000; // 6 months
    const studentIds = students.map((s) => s._id);

    // Load only recent data for university students with limits
    const [allApplications, allResumes, allCoverLetters, allGoals] = await Promise.all([
      ctx.db
        .query('applications')
        .withIndex('by_university_created_at', (q) =>
          q.eq('university_id', uniId).gte('created_at', sixMonthsAgo),
        )
        .take(2000), // Limit to 2000 per category
      ctx.db
        .query('resumes')
        .withIndex('by_university_created_at', (q) =>
          q.eq('university_id', uniId).gte('created_at', sixMonthsAgo),
        )
        .take(1000),
      ctx.db
        .query('cover_letters')
        .withIndex('by_university_created_at', (q) =>
          q.eq('university_id', uniId).gte('created_at', sixMonthsAgo),
        )
        .take(1000),
      ctx.db
        .query('goals')
        .withIndex('by_university_created_at', (q) =>
          q.eq('university_id', uniId).gte('created_at', sixMonthsAgo),
        )
        .take(1000),
    ]);

    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).getTime();

      const monthGoals = allGoals.filter(
        (g) =>
          studentIds.includes(g.user_id) && g.created_at >= monthStart && g.created_at <= monthEnd,
      ).length;
      const monthApplications = allApplications.filter(
        (a) =>
          studentIds.includes(a.user_id) && a.created_at >= monthStart && a.created_at <= monthEnd,
      ).length;
      const monthResumes = allResumes.filter(
        (r) =>
          studentIds.includes(r.user_id) && r.created_at >= monthStart && r.created_at <= monthEnd,
      ).length;
      const monthCoverLetters = allCoverLetters.filter(
        (cl) =>
          studentIds.includes(cl.user_id) &&
          cl.created_at >= monthStart &&
          cl.created_at <= monthEnd,
      ).length;

      platformUsageData.push({
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        goals: monthGoals,
        applications: monthApplications,
        resumes: monthResumes,
        coverLetters: monthCoverLetters,
      });
    }

    return {
      studentGrowthData,
      activityData,
      departmentStats,
      platformUsageData,
    };
  },
});

export const getCourse = query({
  args: { clerkId: v.string(), courseId: v.id('courses') },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx, args.clerkId);
    requireAdmin(user);
    const course = await ctx.db.get(args.courseId);
    if (!course) return null;
    if (user.university_id && course.university_id !== user.university_id) {
      throw new Error('Unauthorized');
    }
    return course;
  },
});

export const assignStudentByEmail = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    role: v.optional(v.union(v.literal('user'), v.literal('student'), v.literal('staff'))),
    departmentId: v.optional(v.id('departments')),
  },
  handler: async (ctx, args) => {
    const admin = await getCurrentUser(ctx, args.clerkId);
    requireAdmin(admin);
    if (!admin.university_id) throw new Error('No university assigned');
    const now = Date.now();

    // Check if user already exists
    const existingStudent = await ctx.db
      .query('users')
      .withIndex('by_email', (q: any) => q.eq('email', args.email))
      .first();

    if (
      existingStudent &&
      existingStudent.university_id &&
      existingStudent.university_id !== admin.university_id
    ) {
      // Prevent silently moving a user between universities
      throw new Error('User already belongs to a different university');
    }

    // Only super admins/university admins/advisors can operate within their own university
    const isSameUniversity =
      !existingStudent ||
      !existingStudent.university_id ||
      existingStudent.university_id === admin.university_id;
    if (!isSameUniversity) {
      throw new Error('Unauthorized to reassign this user');
    }

    if (existingStudent) {
      const requestedRole =
        args.role || (existingStudent.role === 'user' ? ('student' as const) : undefined);
      const normalizedRole =
        requestedRole && normalizeLegacyUserRole(requestedRole, admin.university_id);

      // Update existing user
      await ctx.db.patch(existingStudent._id, {
        university_id: admin.university_id,
        subscription_plan: 'university',
        ...(normalizedRole ? { role: normalizedRole } : {}),
        ...(args.departmentId ? { department_id: args.departmentId } : {}),
        updated_at: now,
      });
      const membership = await ctx.db
        .query('memberships')
        .withIndex('by_user_role', (q: any) =>
          q.eq('user_id', existingStudent._id).eq('role', 'student'),
        )
        .first();
      if (!membership) {
        await ctx.db.insert('memberships', {
          user_id: existingStudent._id,
          university_id: admin.university_id,
          role: 'student',
          status: 'active',
          created_at: now,
          updated_at: now,
        });
      } else if (membership.university_id !== admin.university_id) {
        throw new Error('Existing student membership is tied to another university');
      } else if (membership.status !== 'active') {
        await ctx.db.patch(membership._id, { status: 'active', updated_at: now });
      }
      return { userId: existingStudent._id, isNew: false };
    } else {
      const requestedRole = args.role || 'student';
      const normalizedRole =
        normalizeLegacyUserRole(requestedRole, admin.university_id) || 'student';

      // Create pending user invitation
      // This user will be activated when they click the magic link in their email
      const userId = await ctx.db.insert('users', {
        email: args.email,
        name: '', // Will be filled in when user activates
        clerkId: '', // Will be filled in when user activates via Clerk
        university_id: admin.university_id,
        subscription_plan: 'university',
        subscription_status: 'active',
        role: normalizedRole,
        account_status: 'pending_activation',
        ...(args.departmentId ? { department_id: args.departmentId } : {}),
        created_at: now,
        updated_at: now,
      });
      await ctx.db.insert('memberships', {
        user_id: userId,
        university_id: admin.university_id,
        role: 'student',
        status: 'active',
        created_at: now,
        updated_at: now,
      });
      return { userId, isNew: true };
    }
  },
});

/**
 * Assign an advisor to a student
 *
 * CONSOLIDATED: Now uses `student_advisors` table (canonical source).
 * Previously used `advisorStudents` table which is deprecated.
 *
 * Accepts studentProfileId for backward compatibility with existing UI,
 * but internally resolves to user_id for the student_advisors table.
 */
export const assignAdvisorToStudent = mutation({
  args: {
    clerkId: v.string(),
    advisorId: v.id('users'),
    studentProfileId: v.id('studentProfiles'),
  },
  handler: async (ctx, args) => {
    const acting = await getCurrentUser(ctx, args.clerkId);
    requireAdmin(acting);
    if (!acting.university_id) throw new Error('No university assigned');

    // Get the student profile to find the user_id
    const studentProfile = await ctx.db.get(args.studentProfileId);
    if (!studentProfile) throw new Error('Student profile not found');
    if (!studentProfile.user_id) throw new Error('Student profile missing user_id');
    if (studentProfile.university_id !== acting.university_id) {
      throw new Error('Unauthorized: Student not in your university');
    }

    const studentUserId = studentProfile.user_id;

    const advisor = await ctx.db.get(args.advisorId);
    if (!advisor) throw new Error('Advisor not found');
    if (advisor.role !== 'advisor' || advisor.university_id !== acting.university_id) {
      throw new Error('Advisor must belong to your university');
    }

    // Check if assignment already exists in student_advisors (canonical table)
    const existing = await ctx.db
      .query('student_advisors')
      .withIndex('by_student', (q: any) =>
        q.eq('student_id', studentUserId).eq('university_id', acting.university_id),
      )
      .filter((q: any) => q.eq(q.field('advisor_id'), args.advisorId))
      .unique();

    const now = Date.now();

    if (existing) {
      // If already assigned to this advisor, no-op
      return { success: true, studentAdvisorId: existing._id, updated: false };
    }

    // Check if student already has a primary owner
    const existingOwner = await ctx.db
      .query('student_advisors')
      .withIndex('by_student_owner', (q: any) =>
        q.eq('student_id', studentUserId).eq('is_owner', true),
      )
      .unique();

    // Only super admins or university admins can reassign primary ownership
    if (existingOwner && acting.role !== 'super_admin' && acting.role !== 'university_admin') {
      throw new Error('Unauthorized: Cannot reassign primary advisor');
    }

    // If there's an existing owner and we're assigning a new primary, demote the old one
    // TRANSACTION SAFETY: Convex mutations are fully transactional - if the insert
    // below fails, this patch is rolled back, preventing orphan state.
    if (existingOwner) {
      await ctx.db.patch(existingOwner._id, {
        is_owner: false,
        updated_at: now,
      });
    }

    // Create the new assignment as primary owner
    const studentAdvisorId = await ctx.db.insert('student_advisors', {
      student_id: studentUserId,
      advisor_id: args.advisorId,
      university_id: acting.university_id,
      is_owner: true, // University admin assignments are primary by default
      shared_type: undefined,
      assigned_at: now,
      assigned_by: acting._id,
      notes: undefined,
      created_at: now,
      updated_at: now,
    });

    return { success: true, studentAdvisorId, updated: true };
  },
});

export const updateDepartment = mutation({
  args: {
    clerkId: v.string(),
    departmentId: v.id('departments'),
    patch: v.object({
      name: v.optional(v.string()),
      code: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx, args.clerkId);
    requireAdmin(user);
    const dept = await ctx.db.get(args.departmentId);
    if (!dept) throw new Error('Department not found');
    if (dept.university_id !== user.university_id) throw new Error('Unauthorized');
    await ctx.db.patch(args.departmentId, {
      ...args.patch,
      updated_at: Date.now(),
    });
  },
});

export const deleteDepartment = mutation({
  args: { clerkId: v.string(), departmentId: v.id('departments') },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx, args.clerkId);
    requireAdmin(user);
    const dept = await ctx.db.get(args.departmentId);
    if (!dept) return;
    if (dept.university_id !== user.university_id) throw new Error('Unauthorized');
    await ctx.db.delete(args.departmentId);
  },
});

export const listStudents = query({
  args: { clerkId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx, args.clerkId);
    requireAdmin(user, { allowMissingUniversity: true });

    if (!user.university_id) return [];

    // OPTIMIZED: Use take() directly on the query instead of collect() + slice()
    const limit = Math.min(args.limit ?? 200, 500); // Max 500 students
    const allUsers = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', user.university_id!))
      .take(limit * 2); // Take 2x limit to account for filtering

    // Filter to only actual students (role === "user" or "student")
    const students = allUsers.filter((s: any) => s.role === 'user' || s.role === 'student');

    return students.slice(0, limit);
  },
});

export const listDepartments = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx, args.clerkId);
    requireAdmin(user, { allowMissingUniversity: true });
    if (!user.university_id) return [];
    // OPTIMIZED: Add limit to prevent bandwidth issues
    return await ctx.db
      .query('departments')
      .withIndex('by_university', (q: any) => q.eq('university_id', user.university_id!))
      .take(100); // Limit to 100 departments max
  },
});

export const createDepartment = mutation({
  args: { clerkId: v.string(), name: v.string(), code: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx, args.clerkId);
    requireAdmin(user);
    if (!user.university_id) throw new Error('No university assigned');
    const now = Date.now();
    return await ctx.db.insert('departments', {
      university_id: user.university_id!,
      name: args.name,
      code: args.code,
      created_at: now,
      updated_at: now,
    });
  },
});

export const listCourses = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx, args.clerkId);
    requireAdmin(user);
    if (!user.university_id) return [];
    // OPTIMIZED: Add limit to prevent bandwidth issues
    return await ctx.db
      .query('courses')
      .withIndex('by_university', (q: any) => q.eq('university_id', user.university_id!))
      .take(500); // Limit to 500 courses max
  },
});

export const createCourse = mutation({
  args: {
    clerkId: v.string(),
    title: v.string(),
    departmentId: v.optional(v.id('departments')),
    category: v.optional(v.string()),
    level: v.optional(v.string()),
    published: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx, args.clerkId);
    requireAdmin(user);
    if (!user.university_id) throw new Error('No university assigned');
    const now = Date.now();
    return await ctx.db.insert('courses', {
      university_id: user.university_id!,
      department_id: args.departmentId,
      title: args.title,
      category: args.category,
      level: args.level,
      published: args.published ?? false,
      enrollments: 0,
      completion_rate: 0,
      created_at: now,
      updated_at: now,
    });
  },
});

export const updateCourse = mutation({
  args: {
    clerkId: v.string(),
    courseId: v.id('courses'),
    patch: v.object({
      title: v.optional(v.string()),
      department_id: v.optional(v.id('departments')),
      category: v.optional(v.string()),
      level: v.optional(v.string()),
      published: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx, args.clerkId);
    requireAdmin(user);
    const course = await ctx.db.get(args.courseId);
    if (!course) throw new Error('Course not found');
    if (course.university_id !== user.university_id) throw new Error('Unauthorized');
    await ctx.db.patch(args.courseId, {
      ...args.patch,
      updated_at: Date.now(),
    });
  },
});

export const deleteCourse = mutation({
  args: { clerkId: v.string(), courseId: v.id('courses') },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx, args.clerkId);
    requireAdmin(user);
    const course = await ctx.db.get(args.courseId);
    if (!course) return;
    if (course.university_id !== user.university_id) throw new Error('Unauthorized');
    await ctx.db.delete(args.courseId);
  },
});

export const getStudentMetrics = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx, args.clerkId);
    requireAdmin(user, { allowMissingUniversity: true });

    if (!user.university_id) {
      return {
        totalApplications: 0,
        totalResumes: 0,
        totalCoverLetters: 0,
        totalGoals: 0,
        totalProjects: 0,
        avgCareerCompletion: 0,
      };
    }

    // OPTIMIZED: Get students for this university with limit
    const allUsers = await ctx.db
      .query('users')
      .withIndex('by_university', (q: any) => q.eq('university_id', user.university_id!))
      .take(2000); // Limit to 2000 users max

    // Include both legacy 'user' role and current 'student' role for analytics
    const students = allUsers.filter((s: any) => s.role === 'user' || s.role === 'student');
    const studentIds = students.map((s) => s._id);

    if (studentIds.length === 0) {
      return {
        totalApplications: 0,
        totalResumes: 0,
        totalCoverLetters: 0,
        totalGoals: 0,
        totalProjects: 0,
        avgCareerCompletion: 0,
      };
    }

    // OPTIMIZED: Load only recent data with time filter and limits (last 6 months)
    const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;
    const [applications, resumes, coverLetters, goals, projects] = await Promise.all([
      ctx.db
        .query('applications')
        .withIndex('by_university_created_at', (q) =>
          q.eq('university_id', user.university_id!).gte('created_at', sixMonthsAgo),
        )
        .take(3000),
      ctx.db
        .query('resumes')
        .withIndex('by_university_created_at', (q) =>
          q.eq('university_id', user.university_id!).gte('created_at', sixMonthsAgo),
        )
        .take(1500),
      ctx.db
        .query('cover_letters')
        .withIndex('by_university_created_at', (q) =>
          q.eq('university_id', user.university_id!).gte('created_at', sixMonthsAgo),
        )
        .take(1500),
      ctx.db
        .query('goals')
        .withIndex('by_university_created_at', (q) =>
          q.eq('university_id', user.university_id!).gte('created_at', sixMonthsAgo),
        )
        .take(1500),
      ctx.db
        .query('projects')
        .withIndex('by_university_created_at', (q) =>
          q.eq('university_id', user.university_id!).gte('created_at', sixMonthsAgo),
        )
        .take(1500),
    ]);

    // Filter to only include items belonging to university students
    const studentApplications = applications.filter((app) => studentIds.includes(app.user_id));
    const studentResumes = resumes.filter((resume) => studentIds.includes(resume.user_id));
    const studentCoverLetters = coverLetters.filter((cl) => studentIds.includes(cl.user_id));
    const studentGoals = goals.filter((goal) => studentIds.includes(goal.user_id));
    const studentProjects = projects.filter((project) => studentIds.includes(project.user_id));

    // Calculate average career completion percentage
    // Based on: resumes (30%), cover letters (20%), applications (30%), goals (10%), projects (10%)
    const careerCompletions = students.map((student) => {
      const hasResume = studentResumes.some((r) => r.user_id === student._id);
      const hasCoverLetter = studentCoverLetters.some((cl) => cl.user_id === student._id);
      const hasApplication = studentApplications.some((app) => app.user_id === student._id);
      const hasGoal = studentGoals.some((g) => g.user_id === student._id);
      const hasProject = studentProjects.some((p) => p.user_id === student._id);

      let completion = 0;
      if (hasResume) completion += 30;
      if (hasCoverLetter) completion += 20;
      if (hasApplication) completion += 30;
      if (hasGoal) completion += 10;
      if (hasProject) completion += 10;

      return completion;
    });

    const avgCareerCompletion =
      careerCompletions.length > 0
        ? Math.round(careerCompletions.reduce((a, b) => a + b, 0) / careerCompletions.length)
        : 0;

    return {
      totalApplications: studentApplications.length,
      totalResumes: studentResumes.length,
      totalCoverLetters: studentCoverLetters.length,
      totalGoals: studentGoals.length,
      totalProjects: studentProjects.length,
      avgCareerCompletion,
    };
  },
});

export const getStudentProgress = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx, args.clerkId);
    requireAdmin(user, { allowMissingUniversity: true });

    if (!user.university_id) return [];

    // OPTIMIZED: Get students for this university with limit
    const allUsers = await ctx.db
      .query('users')
      .withIndex('by_university', (q: any) => q.eq('university_id', user.university_id!))
      .take(2000); // Limit to 2000 users max

    // Include both legacy 'user' role and current 'student' role for analytics
    const students = allUsers.filter((s: any) => s.role === 'user' || s.role === 'student');
    const studentIds = students.map((s) => s._id);

    if (studentIds.length === 0) return [];

    // OPTIMIZED: Load only recent data with time filter and limits (last 6 months)
    const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;
    const [applications, resumes, coverLetters, goals, projects] = await Promise.all([
      ctx.db
        .query('applications')
        .withIndex('by_university_created_at', (q) =>
          q.eq('university_id', user.university_id!).gte('created_at', sixMonthsAgo),
        )
        .take(3000),
      ctx.db
        .query('resumes')
        .withIndex('by_university_created_at', (q) =>
          q.eq('university_id', user.university_id!).gte('created_at', sixMonthsAgo),
        )
        .take(1500),
      ctx.db
        .query('cover_letters')
        .withIndex('by_university_created_at', (q) =>
          q.eq('university_id', user.university_id!).gte('created_at', sixMonthsAgo),
        )
        .take(1500),
      ctx.db
        .query('goals')
        .withIndex('by_university_created_at', (q) =>
          q.eq('university_id', user.university_id!).gte('created_at', sixMonthsAgo),
        )
        .take(1500),
      ctx.db
        .query('projects')
        .withIndex('by_university_created_at', (q) =>
          q.eq('university_id', user.university_id!).gte('created_at', sixMonthsAgo),
        )
        .take(1500),
    ]);

    // Map student progress
    return students.map((student) => {
      const studentApps = applications.filter((app) => app.user_id === student._id);
      const studentResumes = resumes.filter((r) => r.user_id === student._id);
      const studentCoverLetters = coverLetters.filter((cl) => cl.user_id === student._id);
      const studentGoals = goals.filter((g) => g.user_id === student._id);
      const studentProjects = projects.filter((p) => p.user_id === student._id);

      // Calculate completion percentage
      let completion = 0;
      if (studentResumes.length > 0) completion += 30;
      if (studentCoverLetters.length > 0) completion += 20;
      if (studentApps.length > 0) completion += 30;
      if (studentGoals.length > 0) completion += 10;
      if (studentProjects.length > 0) completion += 10;

      return {
        studentId: student._id,
        name: student.name || student.email,
        email: student.email,
        applications: studentApps.length,
        resumes: studentResumes.length,
        coverLetters: studentCoverLetters.length,
        goals: studentGoals.length,
        projects: studentProjects.length,
        completion,
      };
    });
  },
});

/**
 * Universal search across students, advisors, departments, and courses
 * for the university admin search bar
 */
export const universitySearch = query({
  args: {
    clerkId: v.string(),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx, args.clerkId);
    requireAdmin(user, { allowMissingUniversity: true });

    if (!user.university_id) {
      return {
        students: [],
        advisors: [],
        departments: [],
        courses: [],
      };
    }

    const searchTerm = args.query.toLowerCase().trim();
    const limit = Math.min(args.limit ?? 5, 10); // Max 10 results per category

    if (!searchTerm) {
      return {
        students: [],
        advisors: [],
        departments: [],
        courses: [],
      };
    }

    // Fetch all data for the university (limited)
    const [allUsers, departments, courses] = await Promise.all([
      ctx.db
        .query('users')
        .withIndex('by_university', (q: any) => q.eq('university_id', user.university_id!))
        .take(500),
      ctx.db
        .query('departments')
        .withIndex('by_university', (q: any) => q.eq('university_id', user.university_id!))
        .take(100),
      ctx.db
        .query('courses')
        .withIndex('by_university', (q: any) => q.eq('university_id', user.university_id!))
        .take(200),
    ]);

    // Search students (role === 'user' or 'student')
    const students = allUsers
      .filter(
        (u: any) =>
          (u.role === 'user' || u.role === 'student') &&
          (u.name?.toLowerCase().includes(searchTerm) ||
            u.email?.toLowerCase().includes(searchTerm)),
      )
      .slice(0, limit)
      .map((s: any) => ({
        _id: s._id,
        name: s.name || 'Unnamed',
        email: s.email,
        role: s.role,
        department_id: s.department_id,
        last_active: s.last_active,
        clerkId: s.clerkId,
      }));

    // Search advisors
    const advisors = allUsers
      .filter(
        (u: any) =>
          u.role === 'advisor' &&
          (u.name?.toLowerCase().includes(searchTerm) ||
            u.email?.toLowerCase().includes(searchTerm)),
      )
      .slice(0, limit)
      .map((a: any) => ({
        _id: a._id,
        name: a.name || 'Unnamed',
        email: a.email,
        clerkId: a.clerkId,
      }));

    // Search departments
    const filteredDepartments = departments
      .filter(
        (d: any) =>
          d.name?.toLowerCase().includes(searchTerm) || d.code?.toLowerCase().includes(searchTerm),
      )
      .slice(0, limit)
      .map((d: any) => ({
        _id: d._id,
        name: d.name,
        code: d.code,
      }));

    // Search courses
    const filteredCourses = courses
      .filter(
        (c: any) =>
          c.title?.toLowerCase().includes(searchTerm) ||
          c.category?.toLowerCase().includes(searchTerm),
      )
      .slice(0, limit)
      .map((c: any) => ({
        _id: c._id,
        title: c.title,
        category: c.category,
        department_id: c.department_id,
        published: c.published,
      }));

    return {
      students,
      advisors,
      departments: filteredDepartments,
      courses: filteredCourses,
    };
  },
});

/**
 * Update a student's profile as university admin
 * Allows updating name and role for students in the admin's university.
 *
 * NOTE: Email is not editable here - Clerk is the source of truth for email.
 * Users should change their email through their Clerk account settings.
 *
 * IMPORTANT: For role changes, the frontend MUST call /api/university/sync-student-role
 * to update Clerk's publicMetadata.role after this mutation succeeds.
 * Clerk is the source of truth for authorization; Convex role is cached for display.
 */
export const updateStudentByAdmin = mutation({
  args: {
    clerkId: v.string(),
    studentId: v.id('users'),
    updates: v.object({
      name: v.optional(v.string()),
      // email intentionally removed - Clerk is source of truth for email
      role: v.optional(v.union(v.literal('student'), v.literal('user'), v.literal('advisor'))),
    }),
  },
  handler: async (ctx, args) => {
    const admin = await getCurrentUser(ctx, args.clerkId);
    requireAdmin(admin);

    // Only super_admin and university_admin can change roles (prevent advisor privilege escalation)
    const canChangeRole = admin.role === 'super_admin' || admin.role === 'university_admin';
    if (args.updates.role !== undefined && !canChangeRole) {
      throw new Error('Unauthorized: Only university admins can change roles');
    }

    const normalizedRole = args.updates.role === 'user' ? 'student' : args.updates.role;

    const student = await ctx.db.get(args.studentId);
    if (!student) {
      throw new Error('Student not found');
    }

    // Verify the target user has a student-like role
    if (!['user', 'student'].includes(student.role)) {
      throw new Error('Target user is not a student');
    }

    // Verify student belongs to admin's university
    if (admin.role !== 'super_admin' && student.university_id !== admin.university_id) {
      throw new Error('Unauthorized: Cannot update students outside your university');
    }

    // Build updates object
    const updates: Record<string, unknown> = {
      updated_at: Date.now(),
    };

    if (args.updates.name !== undefined) {
      updates.name = args.updates.name;
    }
    if (normalizedRole !== undefined) {
      updates.role = normalizedRole;
    }

    await ctx.db.patch(args.studentId, updates);

    // If role is changing to advisor, update the membership record
    if (normalizedRole === 'advisor' && student.role !== 'advisor' && student.university_id) {
      const membership = await ctx.db
        .query('memberships')
        .withIndex('by_user', (q) => q.eq('user_id', args.studentId))
        .filter((q) => q.eq(q.field('university_id'), student.university_id!))
        .first();

      if (membership) {
        await ctx.db.patch(membership._id, {
          role: 'advisor',
          updated_at: Date.now(),
        });
      } else {
        // Create membership for new advisor if none exists
        await ctx.db.insert('memberships', {
          user_id: args.studentId,
          university_id: student.university_id!,
          role: 'advisor',
          status: 'active',
          created_at: Date.now(),
          updated_at: Date.now(),
        });
      }
    }

    return {
      success: true,
      studentId: args.studentId,
      studentClerkId: student.clerkId, // Return for Clerk sync when role changes
      roleChanged: normalizedRole !== undefined && normalizedRole !== student.role,
      newRole: normalizedRole,
    };
  },
});

/**
 * Remove a student from the university
 * Unlinks the student from the university but does not delete the user account.
 *
 * IMPORTANT: This mutation updates the Convex role to 'individual' for caching purposes.
 * The frontend MUST call /api/university/remove-student-clerk-sync to update Clerk's
 * publicMetadata.role to 'individual' after this mutation succeeds. The returned
 * studentClerkId should be used for the sync call. See CLAUDE.md for role management architecture.
 */
export const removeStudentFromUniversity = mutation({
  args: {
    clerkId: v.string(),
    studentId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const admin = await getCurrentUser(ctx, args.clerkId);
    requireAdmin(admin);

    const student = await ctx.db.get(args.studentId);
    if (!student) {
      throw new Error('Student not found');
    }

    // Validate target is a student (prevent removing admins/advisors)
    if (!['user', 'student'].includes(student.role)) {
      throw new Error('Target user is not a student');
    }

    // Verify student belongs to admin's university
    if (admin.role !== 'super_admin' && student.university_id !== admin.university_id) {
      throw new Error('Unauthorized: Cannot remove students outside your university');
    }

    // Store university_id before clearing for membership deactivation
    const universityId = student.university_id;

    // Unlink from university (soft removal)
    // Note: Role is updated here for Convex caching; frontend must sync to Clerk
    await ctx.db.patch(args.studentId, {
      university_id: undefined,
      department_id: undefined,
      role: 'individual', // Convert to individual user (must sync to Clerk)
      updated_at: Date.now(),
    });

    // Deactivate memberships to update license counts
    if (universityId) {
      const memberships = await ctx.db
        .query('memberships')
        .withIndex('by_user', (q) => q.eq('user_id', args.studentId))
        .filter((q) => q.eq(q.field('university_id'), universityId))
        .collect();
      for (const membership of memberships) {
        await ctx.db.patch(membership._id, { status: 'inactive', updated_at: Date.now() });
      }
    }

    // Also remove any advisor assignments for this student
    const advisorAssignments = await ctx.db
      .query('student_advisors')
      .withIndex('by_student', (q) => q.eq('student_id', args.studentId))
      .collect();

    for (const assignment of advisorAssignments) {
      await ctx.db.delete(assignment._id);
    }

    return {
      success: true,
      studentId: args.studentId,
      studentClerkId: student.clerkId, // Return for Clerk sync
    };
  },
});
