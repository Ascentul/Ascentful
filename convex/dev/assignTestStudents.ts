/**
 * Dev utility: Assign students to an advisor for testing
 *
 * Usage:
 *   npx convex run dev/assignTestStudents:assignAllStudentsToAdvisor '{"advisorEmail": "advisor@example.com"}'
 *
 * Or to list available advisors/students:
 *   npx convex run dev/assignTestStudents:listAdvisorsAndStudents
 */

import { v } from 'convex/values';

import { internalMutation, internalQuery } from '../_generated/server';

/**
 * List all advisors and students in the system for debugging
 */
export const listAdvisorsAndStudents = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Get all advisors
    const advisors = await ctx.db
      .query('users')
      .filter((q) => q.eq(q.field('role'), 'advisor'))
      .collect();

    // Get all students
    const students = await ctx.db
      .query('users')
      .filter((q) => q.eq(q.field('role'), 'student'))
      .collect();

    // Get existing assignments
    const assignments = await ctx.db.query('student_advisors').collect();

    return {
      advisors: advisors.map((a) => ({
        id: a._id,
        clerkId: a.clerkId,
        email: a.email,
        name: a.name,
        universityId: a.university_id,
      })),
      students: students.map((s) => ({
        id: s._id,
        clerkId: s.clerkId,
        email: s.email,
        name: s.name,
        universityId: s.university_id,
      })),
      existingAssignments: assignments.length,
      assignmentDetails: assignments.map((a) => ({
        id: a._id,
        studentId: a.student_id,
        advisorId: a.advisor_id,
        universityId: a.university_id,
        isOwner: a.is_owner,
      })),
    };
  },
});

/**
 * Debug: Test getMyCaseload logic without auth
 */
export const debugGetCaseload = internalQuery({
  args: {
    advisorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the advisor
    const advisor = await ctx.db
      .query('users')
      .filter((q) => q.eq(q.field('email'), args.advisorEmail))
      .unique();

    if (!advisor) {
      return { error: 'Advisor not found' };
    }

    if (!advisor.university_id) {
      return { error: 'Advisor has no university_id', advisor };
    }

    // Query student_advisors using the same index as getMyCaseload
    const assignments = await ctx.db
      .query('student_advisors')
      .withIndex('by_advisor_owner', (q) =>
        q
          .eq('advisor_id', advisor._id)
          .eq('is_owner', true)
          .eq('university_id', advisor.university_id!),
      )
      .collect();

    // Get the students
    const studentIds = assignments.map((a) => a.student_id);
    const students = await Promise.all(studentIds.map((id) => ctx.db.get(id)));

    return {
      advisor: {
        id: advisor._id,
        email: advisor.email,
        role: advisor.role,
        universityId: advisor.university_id,
      },
      assignmentsFound: assignments.length,
      assignments: assignments.map((a) => ({
        id: a._id,
        studentId: a.student_id,
        advisorId: a.advisor_id,
        universityId: a.university_id,
        isOwner: a.is_owner,
      })),
      students: students.filter(Boolean).map((s) => ({
        id: s!._id,
        email: s!.email,
        name: s!.name,
        universityId: s!.university_id,
      })),
    };
  },
});

/**
 * Assign all students in a university to a specific advisor
 */
export const assignAllStudentsToAdvisor = internalMutation({
  args: {
    advisorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the advisor
    const advisor = await ctx.db
      .query('users')
      .filter((q) =>
        q.and(q.eq(q.field('email'), args.advisorEmail), q.eq(q.field('role'), 'advisor')),
      )
      .unique();

    if (!advisor) {
      throw new Error(`Advisor not found with email: ${args.advisorEmail}`);
    }

    if (!advisor.university_id) {
      throw new Error('Advisor must be associated with a university');
    }

    // Find all students in the same university
    const students = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', advisor.university_id))
      .filter((q) => q.eq(q.field('role'), 'student'))
      .collect();

    if (students.length === 0) {
      return {
        success: false,
        message: 'No students found in this university',
        advisorId: advisor._id,
        universityId: advisor.university_id,
      };
    }

    const now = Date.now();
    let created = 0;
    let skipped = 0;

    for (const student of students) {
      // Check if assignment already exists
      const existing = await ctx.db
        .query('student_advisors')
        .withIndex('by_student', (q) =>
          q.eq('student_id', student._id).eq('university_id', advisor.university_id!),
        )
        .filter((q) => q.eq(q.field('advisor_id'), advisor._id))
        .unique();

      if (existing) {
        skipped++;
        continue;
      }

      // Check if student already has an owner - if so, make this a non-owner assignment
      const existingOwner = await ctx.db
        .query('student_advisors')
        .withIndex('by_student_owner', (q) => q.eq('student_id', student._id).eq('is_owner', true))
        .unique();

      // Create the assignment
      await ctx.db.insert('student_advisors', {
        student_id: student._id,
        advisor_id: advisor._id,
        university_id: advisor.university_id!,
        is_owner: !existingOwner, // Make owner if no existing owner
        shared_type: existingOwner ? 'reviewer' : undefined,
        assigned_at: now,
        assigned_by: advisor._id, // Self-assigned for dev
        notes: 'Dev test assignment',
        created_at: now,
        updated_at: now,
      });
      created++;
    }

    return {
      success: true,
      advisorId: advisor._id,
      advisorEmail: advisor.email,
      universityId: advisor.university_id,
      totalStudents: students.length,
      created,
      skipped,
    };
  },
});

/**
 * Fix students with missing or mismatched university_id
 */
export const fixStudentUniversityIds = internalMutation({
  args: {
    targetUniversityId: v.optional(v.id('universities')),
  },
  handler: async (ctx, args) => {
    // Get all assignments
    const assignments = await ctx.db.query('student_advisors').collect();

    let fixed = 0;
    const issues: string[] = [];

    for (const assignment of assignments) {
      const student = await ctx.db.get(assignment.student_id);
      if (!student) {
        issues.push(`Student ${assignment.student_id} not found`);
        continue;
      }

      const targetUniversityId = args.targetUniversityId || assignment.university_id;

      // Fix if missing or mismatched
      if (student.university_id !== targetUniversityId) {
        await ctx.db.patch(student._id, {
          university_id: targetUniversityId,
          updated_at: Date.now(),
        });
        fixed++;
      }
    }

    return { fixed, issues };
  },
});

/**
 * Fix assignment university_id to match advisor's university
 */
export const fixAssignmentUniversityIds = internalMutation({
  args: {},
  handler: async (ctx) => {
    const assignments = await ctx.db.query('student_advisors').collect();

    let fixed = 0;

    for (const assignment of assignments) {
      const advisor = await ctx.db.get(assignment.advisor_id);
      if (!advisor || !advisor.university_id) continue;

      if (assignment.university_id !== advisor.university_id) {
        await ctx.db.patch(assignment._id, {
          university_id: advisor.university_id,
          updated_at: Date.now(),
        });
        fixed++;
      }
    }

    return { fixed };
  },
});

/**
 * Clear all student-advisor assignments (for testing reset)
 */
export const clearAllAssignments = internalMutation({
  args: {
    universityId: v.optional(v.id('universities')),
  },
  handler: async (ctx, args) => {
    let assignments;

    if (args.universityId) {
      assignments = await ctx.db
        .query('student_advisors')
        .withIndex('by_university', (q) => q.eq('university_id', args.universityId!))
        .collect();
    } else {
      assignments = await ctx.db.query('student_advisors').collect();
    }

    for (const assignment of assignments) {
      await ctx.db.delete(assignment._id);
    }

    return {
      success: true,
      deleted: assignments.length,
    };
  },
});
