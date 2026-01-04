/**
 * Advisor Student Management
 *
 * Queries and mutations for advisor caseload management:
 * - Get students assigned to advisor
 * - Student profile views
 * - Add advisor notes
 * - Assignment management (admin only)
 */

import { v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import {
  assertCanAccessStudent,
  createAuditLog,
  getCurrentUser,
  getOwnedStudentIds,
  requireAdvisorRole,
  requireTenant,
} from './advisor_auth';
import { ACTIVE_STAGES } from './advisor_constants';
import { requireSuperAdmin } from './lib/roles';

/**
 * Get advisor's caseload (all students they own)
 */
export const getMyCaseload = query({
  args: {
    clerkId: v.string(),
    filters: v.optional(
      v.object({
        major: v.optional(v.string()),
        graduationYear: v.optional(v.string()),
        departmentId: v.optional(v.id('departments')),
        atRisk: v.optional(v.boolean()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    // Get student IDs this advisor owns
    const studentIds = await getOwnedStudentIds(ctx, sessionCtx);

    if (studentIds.length === 0) {
      return [];
    }

    // Fetch full student records
    const students = await Promise.all(studentIds.map((id) => ctx.db.get(id)));

    // Filter out nulls and apply filters
    let filteredStudents = students.filter((s): s is NonNullable<typeof s> => s !== null);

    // Calculate time thresholds once at the top for reuse
    const now = Date.now();
    const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;

    if (args.filters) {
      const filters = args.filters;

      if (filters.major) {
        filteredStudents = filteredStudents.filter((s) => s.major === filters.major);
      }

      if (filters.graduationYear) {
        filteredStudents = filteredStudents.filter(
          (s) => s.graduation_year === filters.graduationYear,
        );
      }

      if (filters.departmentId) {
        filteredStudents = filteredStudents.filter((s) => s.department_id === filters.departmentId);
      }

      // At-risk filter (engagement-based): students with no activity in 60+ days
      // NOTE: This differs from outcome-based at-risk in advisor_dashboard.ts (>5 apps, no offers)
      // Student list shows engagement risk, dashboard shows outcome risk
      // Include students with no updated_at (legacy data) as at-risk
      if (filters.atRisk) {
        filteredStudents = filteredStudents.filter(
          (s) => !s.updated_at || s.updated_at < sixtyDaysAgo,
        );
      }
    }

    const studentIdSet = new Set<Id<'users'>>(filteredStudents.map((s) => s._id));

    // Aggregate follow-ups once (from unified follow_ups table)
    // Use collect() instead of take() to ensure accurate counts for all students
    const openFollowUps = await ctx.db
      .query('follow_ups')
      .withIndex('by_university', (q) => q.eq('university_id', universityId))
      .filter((q) =>
        q.and(q.eq(q.field('status'), 'open'), q.eq(q.field('created_by_id'), sessionCtx.userId)),
      )
      .collect();

    const followUpsByStudent = new Map<Id<'users'>, number>();
    for (const followUp of openFollowUps) {
      if (!studentIdSet.has(followUp.user_id)) continue;
      followUpsByStudent.set(followUp.user_id, (followUpsByStudent.get(followUp.user_id) || 0) + 1);
    }

    // Aggregate upcoming sessions once
    // Use collect() instead of take() to ensure accurate next session for all students
    const upcomingSessions = await ctx.db
      .query('advisor_sessions')
      .withIndex('by_advisor', (q) =>
        q.eq('advisor_id', sessionCtx.userId).eq('university_id', universityId),
      )
      .filter((q) => q.gte(q.field('start_at'), now))
      .order('asc')
      .collect();

    const nextSessionByStudent = new Map<
      Id<'users'>,
      { id: Id<'advisor_sessions'>; scheduledAt?: number; title?: string | null }
    >();

    for (const session of upcomingSessions) {
      if (!studentIdSet.has(session.student_id)) continue;
      if (nextSessionByStudent.has(session.student_id)) continue;
      nextSessionByStudent.set(session.student_id, {
        id: session._id,
        scheduledAt: session.scheduled_at ?? session.start_at,
        title: session.title || session.session_type,
      });
    }

    // Aggregate application stats once
    // Use collect() instead of take() to ensure accurate counts for all students
    const advisorApplications = await ctx.db
      .query('applications')
      .withIndex('by_advisor', (q) => q.eq('assigned_advisor_id', sessionCtx.userId))
      .collect();

    const activeStages = new Set(ACTIVE_STAGES);
    const appStatsByStudent = new Map<Id<'users'>, { active: number; hasOffer: boolean }>();

    for (const application of advisorApplications) {
      if (!studentIdSet.has(application.user_id)) continue;
      const stats = appStatsByStudent.get(application.user_id) ?? {
        active: 0,
        hasOffer: false,
      };
      if (application.stage && activeStages.has(application.stage)) {
        stats.active += 1;
      }
      // Check for offers using stage with status fallback during migration
      // See docs/TECH_DEBT_APPLICATION_STATUS_STAGE.md
      if (
        application.stage === 'Offer' ||
        application.stage === 'Accepted' ||
        (!application.stage && application.status === 'offer')
      ) {
        stats.hasOffer = true;
      }
      appStatsByStudent.set(application.user_id, stats);
    }

    const enrichedStudents = filteredStudents
      .map((student) => {
        if (!student) return null;
        const followUps = followUpsByStudent.get(student._id) ?? 0;
        const nextSession = nextSessionByStudent.get(student._id) ?? null;
        const appStats = appStatsByStudent.get(student._id) ?? {
          active: 0,
          hasOffer: false,
        };
        const isAtRisk = !student.updated_at || student.updated_at < sixtyDaysAgo;

        return {
          ...student,
          metadata: {
            openFollowUpsCount: followUps,
            nextSession,
            activeApplicationsCount: appStats.active,
            hasOffer: appStats.hasOffer,
            isAtRisk,
            lastActivity: student.updated_at,
          },
        };
      })
      .filter((student) => student !== null);

    return enrichedStudents;
  },
});

/**
 * Get detailed student profile with all career data
 */
export const getStudentProfile = query({
  args: {
    clerkId: v.string(),
    studentId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);

    // Check ownership/access
    const student = await assertCanAccessStudent(ctx, sessionCtx, args.studentId);

    const universityId = requireTenant(sessionCtx);

    // Fetch all related data in parallel
    // Use collect() for single-student queries to avoid silently truncating data
    const [goals, applications, resumes, coverLetters, projects, sessions, followUps, reviews] =
      await Promise.all([
        // Goals
        ctx.db
          .query('goals')
          .withIndex('by_user', (q) => q.eq('user_id', args.studentId))
          .collect(),

        // Applications
        ctx.db
          .query('applications')
          .withIndex('by_user', (q) => q.eq('user_id', args.studentId))
          .collect(),

        // Resumes
        ctx.db
          .query('resumes')
          .withIndex('by_user', (q) => q.eq('user_id', args.studentId))
          .collect(),

        // Cover Letters
        ctx.db
          .query('cover_letters')
          .withIndex('by_user', (q) => q.eq('user_id', args.studentId))
          .collect(),

        // Projects
        ctx.db
          .query('projects')
          .withIndex('by_user', (q) => q.eq('user_id', args.studentId))
          .collect(),

        // Advisor sessions (fetch once, slice for recent activity)
        ctx.db
          .query('advisor_sessions')
          .withIndex('by_student', (q) =>
            q.eq('student_id', args.studentId).eq('university_id', universityId),
          )
          .order('desc')
          .collect(),

        // Follow-ups (from unified follow_ups table)
        ctx.db
          .query('follow_ups')
          .withIndex('by_user_university', (q) =>
            q.eq('user_id', args.studentId).eq('university_id', universityId),
          )
          .order('desc')
          .collect(),

        // Reviews
        ctx.db
          .query('advisor_reviews')
          .withIndex('by_student', (q) =>
            q.eq('student_id', args.studentId).eq('university_id', universityId),
          )
          .order('desc')
          .collect(),
      ]);

    return {
      student,
      goals,
      applications,
      resumes,
      coverLetters,
      projects,
      sessions,
      recentActivity: sessions.slice(0, 10), // First 10 sessions for activity feed
      followUps,
      reviews,
    };
  },
});

/**
 * Add advisor-only note to student profile
 */
export const addAdvisorNote = mutation({
  args: {
    clerkId: v.string(),
    studentId: v.id('users'),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);

    // Validate note is not empty
    if (!args.note.trim()) {
      throw new Error('Note cannot be empty');
    }

    // Check ownership
    await assertCanAccessStudent(ctx, sessionCtx, args.studentId);
    const universityId = requireTenant(sessionCtx);

    // Get current notes
    const student = await ctx.db.get(args.studentId);
    if (!student) throw new Error('Student not found');

    const currentNotes = student.university_admin_notes || '';
    const timestamp = new Date().toISOString();
    const userName = sessionCtx.email.includes('@')
      ? sessionCtx.email.split('@')[0]
      : sessionCtx.email;

    const newNote = `[${timestamp}] ${userName}: ${args.note}`;
    const updatedNotes = currentNotes ? `${currentNotes}\n\n${newNote}` : newNote;

    // Update student record
    await ctx.db.patch(args.studentId, {
      university_admin_notes: updatedNotes,
      updated_at: Date.now(),
    });

    // Create audit log
    // NOTE: Store structural metadata only, not full note content (PII/FERPA compliance)
    // Full notes are stored in the student record; audit log tracks the action
    await createAuditLog(ctx, {
      actorId: sessionCtx.userId,
      universityId,
      action: 'advisor.note_added',
      entityType: 'student',
      entityId: args.studentId,
      studentId: args.studentId,
      newValue: {
        noteAdded: true,
        noteLength: args.note.length,
        timestamp: Date.now(),
      },
    });

    return { success: true };
  },
});

/**
 * Assign student to advisor (admin only)
 */
export const assignStudentToAdvisor = mutation({
  args: {
    clerkId: v.string(),
    studentId: v.id('users'),
    advisorId: v.id('users'),
    isOwner: v.boolean(),
    sharedType: v.optional(v.union(v.literal('reviewer'), v.literal('temp'))),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);

    // Only university_admin and super_admin can assign students
    if (sessionCtx.role !== 'university_admin' && sessionCtx.role !== 'super_admin') {
      throw new Error('Unauthorized: Only admins can assign students');
    }

    const universityId = requireTenant(sessionCtx);

    // Verify student and advisor are in same university
    const [student, advisor] = await Promise.all([
      ctx.db.get(args.studentId),
      ctx.db.get(args.advisorId),
    ]);

    if (!student || !advisor) {
      throw new Error('Student or advisor not found');
    }

    if (student.university_id !== universityId || advisor.university_id !== universityId) {
      throw new Error('Student and advisor must be in the same university as admin');
    }

    if (advisor.role !== 'advisor') {
      throw new Error('Assigned user must have advisor role');
    }

    // UNIQUENESS ENFORCEMENT: Exactly one owner per student
    //
    // Design: Convex mutations are atomic and serialized. We use a two-phase approach:
    // 1. Pre-check: Remove any existing owner before setting new one
    // 2. Post-check: Verify exactly one owner exists after operation (catches edge cases)
    //
    // This is sufficient because:
    // - Convex transactions are serialized (no concurrent writes to same data)
    // - Post-check with auto-correction handles any unexpected states
    // - All changes are audit-logged for compliance
    //
    // For enterprise deployments needing stronger guarantees, consider:
    // - Adding a version field to student_advisors for optimistic locking
    // - Using Convex's scheduled mutations for serialized processing
    //
    // TRANSACTION SAFETY: Convex mutations are fully transactional - if any
    // operation fails (e.g., the insert below), ALL operations are rolled back,
    // including the owner demotions. This ensures no orphan state where a
    // student has no primary advisor.
    if (args.isOwner) {
      // Find ALL current owners (handles corrupted state with multiple owners)
      const existingOwners = await ctx.db
        .query('student_advisors')
        .withIndex('by_student_owner', (q) =>
          q.eq('student_id', args.studentId).eq('is_owner', true),
        )
        .collect();

      // Demote all existing owners (safe: rolled back if subsequent ops fail)
      for (const existingOwner of existingOwners) {
        await ctx.db.patch(existingOwner._id, {
          is_owner: false,
          updated_at: Date.now(),
        });
      }

      if (existingOwners.length > 1) {
        console.warn(
          `[assignStudentToAdvisor] Found ${existingOwners.length} existing owners for student ${args.studentId}. All have been demoted.`,
        );
      }
    }

    // Check if assignment already exists
    const existing = await ctx.db
      .query('student_advisors')
      .withIndex('by_advisor', (q) =>
        q.eq('advisor_id', args.advisorId).eq('university_id', universityId),
      )
      .filter((q) => q.eq(q.field('student_id'), args.studentId))
      .unique();

    const now = Date.now();
    let resultId: Id<'student_advisors'>;

    if (existing) {
      // Update existing assignment
      await ctx.db.patch(existing._id, {
        is_owner: args.isOwner,
        shared_type: args.sharedType,
        notes: args.notes,
        updated_at: now,
      });

      // Audit log
      await createAuditLog(ctx, {
        actorId: sessionCtx.userId,
        universityId,
        action: 'student.advisor_updated',
        entityType: 'student_advisor',
        entityId: existing._id,
        studentId: args.studentId,
        previousValue: { is_owner: existing.is_owner },
        newValue: { is_owner: args.isOwner },
      });

      resultId = existing._id;
    } else {
      // Create new assignment
      const assignmentId = await ctx.db.insert('student_advisors', {
        student_id: args.studentId,
        advisor_id: args.advisorId,
        university_id: universityId,
        is_owner: args.isOwner,
        shared_type: args.sharedType,
        assigned_at: now,
        assigned_by: sessionCtx.userId,
        notes: args.notes,
        created_at: now,
        updated_at: now,
      });

      // Audit log
      await createAuditLog(ctx, {
        actorId: sessionCtx.userId,
        universityId,
        action: 'student.advisor_assigned',
        entityType: 'student_advisor',
        entityId: assignmentId,
        studentId: args.studentId,
        newValue: { advisor_id: args.advisorId, is_owner: args.isOwner },
      });

      resultId = assignmentId;
    }

    // Post-operation consistency check: verify exactly one owner exists
    // This catches race conditions where concurrent transactions may have
    // created multiple owners or removed the owner unexpectedly
    if (args.isOwner) {
      const owners = await ctx.db
        .query('student_advisors')
        .withIndex('by_student_owner', (q) =>
          q.eq('student_id', args.studentId).eq('is_owner', true),
        )
        .collect();

      if (owners.length !== 1) {
        console.warn(
          `[assignStudentToAdvisor] Consistency warning: Found ${owners.length} owners for student ${args.studentId}. Expected exactly 1.`,
        );

        if (owners.length > 1) {
          // Auto-correct: if multiple owners, keep only the most recently assigned
          const sortedByTime = owners.sort((a, b) => (b.assigned_at ?? 0) - (a.assigned_at ?? 0));
          for (let i = 1; i < sortedByTime.length; i++) {
            await ctx.db.patch(sortedByTime[i]._id, { is_owner: false });

            // Audit the auto-correction for compliance
            await createAuditLog(ctx, {
              actorId: sessionCtx.userId,
              universityId,
              action: 'student.owner_auto_corrected',
              entityType: 'student_advisor',
              entityId: sortedByTime[i]._id,
              studentId: args.studentId,
              previousValue: { is_owner: true },
              newValue: { is_owner: false, reason: 'duplicate_owner_correction' },
            });
          }
          console.log(
            `[assignStudentToAdvisor] Auto-corrected: kept ${sortedByTime[0].advisor_id} as owner`,
          );
        } else if (owners.length === 0) {
          // Zero owners after isOwner=true operation indicates a bug - escalate
          throw new Error(
            `Consistency error: No owner found for student ${args.studentId} after owner assignment. ` +
              `This indicates a database integrity issue that requires investigation.`,
          );
        }
      }
    }

    return resultId;
  },
});

/**
 * Remove student-advisor assignment (admin only)
 */
export const removeStudentAdvisor = mutation({
  args: {
    clerkId: v.string(),
    assignmentId: v.id('student_advisors'),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);

    // Only university_admin and super_admin can remove assignments
    if (sessionCtx.role !== 'university_admin' && sessionCtx.role !== 'super_admin') {
      throw new Error('Unauthorized: Only admins can remove assignments');
    }

    const universityId = requireTenant(sessionCtx);

    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) {
      throw new Error('Assignment not found');
    }

    if (assignment.university_id !== universityId) {
      throw new Error('Assignment not in your university');
    }

    // Prevent orphaning a student without any advisor
    // Get all other advisors for this student (excluding the one being removed)
    const otherAdvisors = await ctx.db
      .query('student_advisors')
      .withIndex('by_student', (q) =>
        q.eq('student_id', assignment.student_id).eq('university_id', universityId),
      )
      .filter((q) => q.neq(q.field('_id'), args.assignmentId))
      .collect();

    if (otherAdvisors.length === 0) {
      throw new Error('Cannot remove the only advisor. Assign another advisor first.');
    }

    // If removing an owner, ensure another owner exists
    if (assignment.is_owner) {
      const hasAnotherOwner = otherAdvisors.some((a) => a.is_owner);
      if (!hasAnotherOwner) {
        throw new Error('Cannot remove the owner advisor. Assign another advisor as owner first.');
      }
    }

    // Audit log before deletion
    await createAuditLog(ctx, {
      actorId: sessionCtx.userId,
      universityId,
      action: 'student.advisor_removed',
      entityType: 'student_advisor',
      entityId: args.assignmentId,
      studentId: assignment.student_id,
      previousValue: {
        advisor_id: assignment.advisor_id,
        is_owner: assignment.is_owner,
        reason: args.reason,
      },
    });

    await ctx.db.delete(args.assignmentId);

    return { success: true };
  },
});

/**
 * DIAGNOSTIC: Find students with duplicate owners
 *
 * This query identifies data integrity issues where a student has
 * more than one advisor marked as is_owner=true.
 *
 * SECURITY: Requires super_admin role - exposes student-advisor relationships
 *
 * Run: npx convex run advisor_students:findDuplicateOwners
 */
export const findDuplicateOwners = query({
  args: {},
  handler: async (ctx) => {
    // SECURITY: Only super_admin can run diagnostic queries
    // This prevents information disclosure about student-advisor relationships
    await requireSuperAdmin(ctx);

    // Get all ownership records
    const allOwnerRecords = await ctx.db
      .query('student_advisors')
      .filter((q) => q.eq(q.field('is_owner'), true))
      .collect();

    // Group by student_id
    const ownersByStudent = new Map<string, typeof allOwnerRecords>();
    for (const record of allOwnerRecords) {
      const studentId = record.student_id;
      if (!ownersByStudent.has(studentId)) {
        ownersByStudent.set(studentId, []);
      }
      ownersByStudent.get(studentId)!.push(record);
    }

    // Find students with multiple owners
    const duplicates: Array<{
      studentId: string;
      ownerCount: number;
      owners: Array<{
        assignmentId: string;
        advisorId: string;
        assignedAt: number;
      }>;
    }> = [];

    for (const [studentId, records] of ownersByStudent) {
      if (records.length > 1) {
        duplicates.push({
          studentId,
          ownerCount: records.length,
          owners: records.map((r) => ({
            assignmentId: r._id,
            advisorId: r.advisor_id,
            assignedAt: r.assigned_at,
          })),
        });
      }
    }

    // Find students with NO owners
    const allStudentAssignments = await ctx.db.query('student_advisors').collect();
    const studentsWithAssignments = new Set(allStudentAssignments.map((a) => a.student_id));
    const studentsWithOwners = new Set(allOwnerRecords.map((r) => r.student_id));

    const orphanedStudents: string[] = [];
    for (const studentId of studentsWithAssignments) {
      if (!studentsWithOwners.has(studentId)) {
        orphanedStudents.push(studentId);
      }
    }

    return {
      summary: {
        totalOwnerRecords: allOwnerRecords.length,
        studentsWithDuplicateOwners: duplicates.length,
        studentsWithNoOwner: orphanedStudents.length,
      },
      duplicates,
      orphanedStudents,
    };
  },
});

// =============================================================================
// STUDENT TIMELINE (Unified Activity Feed)
// =============================================================================

/**
 * Timeline event types for unified activity feed
 */
type TimelineEventType =
  | 'application'
  | 'goal'
  | 'resume'
  | 'cover_letter'
  | 'session'
  | 'note'
  | 'comment';

interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  label: string;
  summary: string;
  timestamp: number;
  sourceId?: string;
  sourceLink?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Get unified activity timeline for a student
 * Aggregates events from applications, goals, documents, sessions, comments, and notes
 */
export const getStudentTimeline = query({
  args: {
    clerkId: v.string(),
    studentId: v.id('users'),
    filters: v.optional(
      v.object({
        types: v.optional(v.array(v.string())),
      }),
    ),
    cursor: v.optional(v.number()), // Pagination cursor (timestamp)
    limit: v.optional(v.number()), // Default 20
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);
    await assertCanAccessStudent(ctx, sessionCtx, args.studentId);

    const universityId = requireTenant(sessionCtx);
    const limit = args.limit ?? 20;
    // Use Date.now() + 1 for initial call to include events at current timestamp with strict < comparison
    const cursor = args.cursor ?? Date.now() + 1;
    const typeFilters = args.filters?.types ?? [];
    const filterByType = typeFilters.length > 0;

    const events: TimelineEvent[] = [];

    // Helper to check if type is included in filters
    const includeType = (type: TimelineEventType) => !filterByType || typeFilters.includes(type);

    // 1. Applications
    if (includeType('application')) {
      const applications = await ctx.db
        .query('applications')
        .withIndex('by_user', (q) => q.eq('user_id', args.studentId))
        .collect();

      for (const app of applications) {
        // Application created
        if (app.created_at && app.created_at < cursor) {
          events.push({
            id: `app-created-${app._id}`,
            type: 'application',
            label: 'Application Added',
            summary: `Applied to ${app.job_title || 'Position'} at ${app.company || 'Company'}`,
            timestamp: app.created_at,
            sourceId: app._id,
            sourceLink: `/advisor/students/${args.studentId}?tab=applications`,
            metadata: { stage: app.stage, company: app.company },
          });
        }

        // Stage changes (if tracked)
        if (app.stage_set_at && app.stage_set_at !== app.created_at && app.stage_set_at < cursor) {
          events.push({
            id: `app-stage-${app._id}-${app.stage_set_at}`,
            type: 'application',
            label: 'Stage Updated',
            summary: `${app.company}: moved to ${app.stage || 'Unknown'}`,
            timestamp: app.stage_set_at,
            sourceId: app._id,
            sourceLink: `/advisor/students/${args.studentId}?tab=applications`,
            metadata: { stage: app.stage, company: app.company },
          });
        }
      }
    }

    // 2. Goals
    if (includeType('goal')) {
      const goals = await ctx.db
        .query('goals')
        .withIndex('by_user', (q) => q.eq('user_id', args.studentId))
        .collect();

      for (const goal of goals) {
        if (goal.created_at && goal.created_at < cursor) {
          events.push({
            id: `goal-created-${goal._id}`,
            type: 'goal',
            label: 'Goal Created',
            summary: goal.title || 'Untitled Goal',
            timestamp: goal.created_at,
            sourceId: goal._id,
            metadata: { status: goal.status },
          });
        }

        // Goal completed
        if (goal.status === 'completed' && goal.completed_at && goal.completed_at < cursor) {
          events.push({
            id: `goal-completed-${goal._id}`,
            type: 'goal',
            label: 'Goal Completed',
            summary: `Completed: ${goal.title || 'Untitled Goal'}`,
            timestamp: goal.completed_at,
            sourceId: goal._id,
          });
        }
      }
    }

    // 3. Resumes
    if (includeType('resume')) {
      const resumes = await ctx.db
        .query('resumes')
        .withIndex('by_user', (q) => q.eq('user_id', args.studentId))
        .collect();

      for (const resume of resumes) {
        if (resume.created_at && resume.created_at < cursor) {
          events.push({
            id: `resume-created-${resume._id}`,
            type: 'resume',
            label: 'Resume Created',
            summary: resume.title || 'Untitled Resume',
            timestamp: resume.created_at,
            sourceId: resume._id,
            sourceLink: `/advisor/students/${args.studentId}?tab=documents`,
          });
        }

        // Resume updated (if significantly different from created)
        if (
          resume.updated_at &&
          resume.updated_at > resume.created_at + 60000 && // More than 1 minute after creation
          resume.updated_at < cursor
        ) {
          events.push({
            id: `resume-updated-${resume._id}-${resume.updated_at}`,
            type: 'resume',
            label: 'Resume Updated',
            summary: `Updated: ${resume.title || 'Untitled Resume'}`,
            timestamp: resume.updated_at,
            sourceId: resume._id,
            sourceLink: `/advisor/students/${args.studentId}?tab=documents`,
          });
        }
      }
    }

    // 4. Cover Letters
    if (includeType('cover_letter')) {
      const coverLetters = await ctx.db
        .query('cover_letters')
        .withIndex('by_user', (q) => q.eq('user_id', args.studentId))
        .collect();

      for (const cl of coverLetters) {
        if (cl.created_at && cl.created_at < cursor) {
          events.push({
            id: `cover-letter-created-${cl._id}`,
            type: 'cover_letter',
            label: 'Cover Letter Created',
            summary: cl.name || cl.company_name || 'Untitled Cover Letter',
            timestamp: cl.created_at,
            sourceId: cl._id,
            sourceLink: `/advisor/students/${args.studentId}?tab=documents`,
          });
        }
      }
    }

    // 5. Sessions
    if (includeType('session')) {
      const sessions = await ctx.db
        .query('advisor_sessions')
        .withIndex('by_student', (q) =>
          q.eq('student_id', args.studentId).eq('university_id', universityId),
        )
        .collect();

      for (const session of sessions) {
        const sessionTime = session.scheduled_at ?? session.start_at ?? session.created_at;
        if (sessionTime && sessionTime < cursor) {
          events.push({
            id: `session-${session._id}`,
            type: 'session',
            label: session.status === 'completed' ? 'Session Completed' : 'Session Scheduled',
            summary: session.title || session.session_type || 'Advising Session',
            timestamp: sessionTime,
            sourceId: session._id,
            sourceLink: `/advisor/students/${args.studentId}?tab=sessions`,
            metadata: { status: session.status, type: session.session_type },
          });
        }
      }
    }

    // 6. Advisor Comments
    if (includeType('comment')) {
      const comments = await ctx.db
        .query('advisor_comments')
        .withIndex('by_student', (q) => q.eq('student_id', args.studentId).eq('status', 'active'))
        .collect();

      for (const comment of comments) {
        if (comment.created_at && comment.created_at < cursor) {
          events.push({
            id: `comment-${comment._id}`,
            type: 'comment',
            label: 'Comment Added',
            summary: `Comment on ${comment.target_type}: ${comment.body?.slice(0, 50) || ''}...`,
            timestamp: comment.created_at,
            sourceId: comment._id,
            metadata: { targetType: comment.target_type },
          });
        }
      }
    }

    // 7. Advisor Notes (parsed from university_admin_notes)
    if (includeType('note')) {
      const student = await ctx.db.get(args.studentId);
      if (student?.university_admin_notes) {
        const notes = student.university_admin_notes.split('\n\n').filter(Boolean);
        for (let i = 0; i < notes.length; i++) {
          const note = notes[i];
          // Parse timestamp from note format: [ISO_TIMESTAMP] author: content
          const match = note.match(/^\[(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\]/);
          if (match) {
            const timestamp = new Date(match[1]).getTime();
            if (timestamp < cursor) {
              events.push({
                id: `note-${i}-${timestamp}`,
                type: 'note',
                label: 'Advisor Note',
                summary: note.slice(match[0].length + 1).slice(0, 100),
                timestamp,
              });
            }
          }
        }
      }
    }

    // Sort by timestamp descending
    events.sort((a, b) => b.timestamp - a.timestamp);

    // Apply pagination
    const paginatedEvents = events.slice(0, limit + 1);
    const hasMore = paginatedEvents.length > limit;
    const returnEvents = hasMore ? paginatedEvents.slice(0, limit) : paginatedEvents;
    const nextCursor = hasMore ? returnEvents[returnEvents.length - 1]?.timestamp : undefined;

    return {
      events: returnEvents,
      nextCursor,
      hasMore,
    };
  },
});

// =============================================================================
// STUDENT FOLLOW-UPS (Next Actions Panel)
// =============================================================================

/**
 * Get follow-ups/actions for a specific student (advisor-created only)
 */
export const getStudentFollowUps = query({
  args: {
    clerkId: v.string(),
    studentId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);
    await assertCanAccessStudent(ctx, sessionCtx, args.studentId);

    const universityId = requireTenant(sessionCtx);
    const now = Date.now();

    // Get follow-ups created by this advisor for this student
    const followUps = await ctx.db
      .query('follow_ups')
      .withIndex('by_user_university', (q) =>
        q.eq('user_id', args.studentId).eq('university_id', universityId),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field('created_by_id'), sessionCtx.userId),
          q.eq(q.field('created_by_type'), 'advisor'),
        ),
      )
      .collect();

    // Enrich with overdue status and sort
    const enrichedFollowUps = followUps.map((f) => ({
      ...f,
      isOverdue: f.due_at ? f.due_at < now && f.status === 'open' : false,
    }));

    // Sort: open first, then by due date ascending
    enrichedFollowUps.sort((a, b) => {
      // Open items first
      if (a.status !== b.status) {
        return a.status === 'open' ? -1 : 1;
      }
      // Then by due date
      const aDue = a.due_at ?? Infinity;
      const bDue = b.due_at ?? Infinity;
      return aDue - bDue;
    });

    return enrichedFollowUps;
  },
});

/**
 * Create a follow-up/action for a student
 */
export const createStudentFollowUp = mutation({
  args: {
    clerkId: v.string(),
    studentId: v.id('users'),
    title: v.string(),
    description: v.optional(v.string()),
    due_at: v.optional(v.number()),
    related_type: v.optional(
      v.union(
        v.literal('application'),
        v.literal('contact'),
        v.literal('session'),
        v.literal('review'),
        v.literal('general'),
      ),
    ),
    related_id: v.optional(v.string()),
    priority: v.optional(
      v.union(v.literal('low'), v.literal('medium'), v.literal('high'), v.literal('urgent')),
    ),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);
    await assertCanAccessStudent(ctx, sessionCtx, args.studentId);

    const universityId = requireTenant(sessionCtx);
    const now = Date.now();

    const effectivePriority = args.priority ?? 'medium';

    const followUpId = await ctx.db.insert('follow_ups', {
      user_id: args.studentId,
      owner_id: sessionCtx.userId,
      created_by_id: sessionCtx.userId,
      created_by_type: 'advisor',
      university_id: universityId,
      title: args.title,
      description: args.description,
      due_at: args.due_at,
      related_type: args.related_type,
      related_id: args.related_id,
      priority: effectivePriority,
      status: 'open',
      created_at: now,
      updated_at: now,
    });

    // Audit log
    await createAuditLog(ctx, {
      actorId: sessionCtx.userId,
      universityId,
      action: 'advisor.followup_created',
      entityType: 'follow_up',
      entityId: followUpId,
      studentId: args.studentId,
      newValue: {
        title: args.title,
        due_at: args.due_at,
        priority: effectivePriority,
      },
    });

    return followUpId;
  },
});

/**
 * Update a follow-up/action
 */
export const updateStudentFollowUp = mutation({
  args: {
    clerkId: v.string(),
    followUpId: v.id('follow_ups'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    due_at: v.optional(v.number()),
    status: v.optional(v.union(v.literal('open'), v.literal('done'))),
    priority: v.optional(
      v.union(v.literal('low'), v.literal('medium'), v.literal('high'), v.literal('urgent')),
    ),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);

    const followUp = await ctx.db.get(args.followUpId);
    if (!followUp) {
      throw new Error('Follow-up not found');
    }

    // Verify ownership
    if (followUp.created_by_id !== sessionCtx.userId) {
      throw new Error('You can only edit follow-ups you created');
    }

    const universityId = requireTenant(sessionCtx);
    const now = Date.now();

    const updates: Record<string, unknown> = { updated_at: now };

    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.due_at !== undefined) updates.due_at = args.due_at;
    if (args.priority !== undefined) updates.priority = args.priority;
    if (args.status !== undefined) {
      updates.status = args.status;
      if (args.status === 'done') {
        updates.completed_at = now;
        updates.completed_by = sessionCtx.userId;
      } else if (args.status === 'open') {
        // Clear completion metadata when reopening
        updates.completed_at = undefined;
        updates.completed_by = undefined;
      }
    }

    await ctx.db.patch(args.followUpId, updates);

    // Audit log
    await createAuditLog(ctx, {
      actorId: sessionCtx.userId,
      universityId,
      action: 'advisor.followup_updated',
      entityType: 'follow_up',
      entityId: args.followUpId,
      studentId: followUp.user_id,
      previousValue: { status: followUp.status },
      newValue: updates,
    });

    return { success: true };
  },
});

/**
 * Delete a follow-up/action
 */
export const deleteStudentFollowUp = mutation({
  args: {
    clerkId: v.string(),
    followUpId: v.id('follow_ups'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);

    const followUp = await ctx.db.get(args.followUpId);
    if (!followUp) {
      throw new Error('Follow-up not found');
    }

    // Verify ownership
    if (followUp.created_by_id !== sessionCtx.userId) {
      throw new Error('You can only delete follow-ups you created');
    }

    const universityId = requireTenant(sessionCtx);

    // Audit log before deletion
    await createAuditLog(ctx, {
      actorId: sessionCtx.userId,
      universityId,
      action: 'advisor.followup_deleted',
      entityType: 'follow_up',
      entityId: args.followUpId,
      studentId: followUp.user_id,
      previousValue: {
        title: followUp.title,
        status: followUp.status,
      },
    });

    await ctx.db.delete(args.followUpId);

    return { success: true };
  },
});

// =============================================================================
// ENGAGEMENT / OUTREACH SNOOZE
// =============================================================================

/**
 * Snooze the "needs outreach" indicator for a student
 */
export const snoozeOutreach = mutation({
  args: {
    clerkId: v.string(),
    studentId: v.id('users'),
    days: v.number(), // Typically 7
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);
    await assertCanAccessStudent(ctx, sessionCtx, args.studentId);

    const universityId = requireTenant(sessionCtx);
    const now = Date.now();

    // Clamp days to reasonable range (1-90) to prevent accidental large/negative values
    const clampedDays = Math.max(1, Math.min(90, Math.round(args.days)));
    const snoozeUntil = now + clampedDays * 24 * 60 * 60 * 1000;

    await ctx.db.patch(args.studentId, {
      outreach_snoozed_until: snoozeUntil,
      updated_at: now,
    });

    // Audit log
    await createAuditLog(ctx, {
      actorId: sessionCtx.userId,
      universityId,
      action: 'advisor.outreach_snoozed',
      entityType: 'student',
      entityId: args.studentId,
      studentId: args.studentId,
      newValue: {
        snoozedDays: clampedDays,
        snoozedUntil: snoozeUntil,
      },
    });

    return { success: true, snoozedUntil: snoozeUntil };
  },
});

/**
 * Clear the snooze on "needs outreach" indicator (unsnooze)
 */
export const clearOutreachSnooze = mutation({
  args: {
    clerkId: v.string(),
    studentId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);
    await assertCanAccessStudent(ctx, sessionCtx, args.studentId);

    const universityId = requireTenant(sessionCtx);
    const now = Date.now();

    await ctx.db.patch(args.studentId, {
      outreach_snoozed_until: undefined,
      updated_at: now,
    });

    // Audit log
    await createAuditLog(ctx, {
      actorId: sessionCtx.userId,
      universityId,
      action: 'advisor.outreach_unsnoozed',
      entityType: 'student',
      entityId: args.studentId,
      studentId: args.studentId,
    });

    return { success: true };
  },
});

// =============================================================================
// STUDENT TAGS
// =============================================================================

/**
 * Update advisor-internal tags for a student
 * Max 5 tags, each max 20 characters
 */
export const updateStudentTags = mutation({
  args: {
    clerkId: v.string(),
    studentId: v.id('users'),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);
    await assertCanAccessStudent(ctx, sessionCtx, args.studentId);

    const universityId = requireTenant(sessionCtx);
    const now = Date.now();

    // Validate: max 5 tags, each max 20 chars
    if (args.tags.length > 5) {
      throw new Error('Maximum 5 tags allowed per student');
    }
    const sanitizedTags = args.tags.map((t) => t.trim().slice(0, 20)).filter((t) => t.length > 0);

    // Get previous tags for audit
    const student = await ctx.db.get(args.studentId);
    const previousTags = student?.advisor_tags || [];

    await ctx.db.patch(args.studentId, {
      advisor_tags: sanitizedTags,
      updated_at: now,
    });

    // Audit log
    await createAuditLog(ctx, {
      actorId: sessionCtx.userId,
      universityId,
      action: 'advisor.student_tags_updated',
      entityType: 'student',
      entityId: args.studentId,
      studentId: args.studentId,
      previousValue: { tags: previousTags },
      newValue: { tags: sanitizedTags },
    });

    return { success: true, tags: sanitizedTags };
  },
});

// =============================================================================
// ENHANCED STUDENT PROFILE (with engagement data)
// =============================================================================

/**
 * Get enhanced student profile with engagement metrics
 * Extends getStudentProfile with needs_outreach and upcoming_session
 */
export const getStudentProfileEnhanced = query({
  args: {
    clerkId: v.string(),
    studentId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);

    const student = await assertCanAccessStudent(ctx, sessionCtx, args.studentId);
    const universityId = requireTenant(sessionCtx);
    const now = Date.now();

    // Calculate engagement status
    const INACTIVITY_THRESHOLD_DAYS = 10;
    const inactivityThreshold = now - INACTIVITY_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

    const lastActiveAt = student.last_login_at ?? student.updated_at ?? student.created_at;
    const isInactive = lastActiveAt < inactivityThreshold;
    const isSnoozed = student.outreach_snoozed_until && student.outreach_snoozed_until > now;
    const needsOutreach = isInactive && !isSnoozed;

    // Get upcoming session
    const upcomingSession = await ctx.db
      .query('advisor_sessions')
      .withIndex('by_student', (q) =>
        q.eq('student_id', args.studentId).eq('university_id', universityId),
      )
      .filter((q) => q.and(q.gte(q.field('start_at'), now), q.neq(q.field('status'), 'cancelled')))
      .order('asc')
      .first();

    // Get assigned advisor (owner)
    const advisorAssignment = await ctx.db
      .query('student_advisors')
      .withIndex('by_student_owner', (q) => q.eq('student_id', args.studentId).eq('is_owner', true))
      .first();

    let assignedAdvisor: { _id: string; name: string; email: string } | null = null;
    if (advisorAssignment) {
      const advisor = await ctx.db.get(advisorAssignment.advisor_id);
      if (advisor) {
        assignedAdvisor = {
          _id: advisor._id,
          name: advisor.name,
          email: advisor.email,
        };
      }
    }

    // Fetch all related data in parallel
    const [goals, applications, resumes, coverLetters, projects, sessions, followUps, reviews] =
      await Promise.all([
        ctx.db
          .query('goals')
          .withIndex('by_user', (q) => q.eq('user_id', args.studentId))
          .collect(),
        ctx.db
          .query('applications')
          .withIndex('by_user', (q) => q.eq('user_id', args.studentId))
          .collect(),
        ctx.db
          .query('resumes')
          .withIndex('by_user', (q) => q.eq('user_id', args.studentId))
          .collect(),
        ctx.db
          .query('cover_letters')
          .withIndex('by_user', (q) => q.eq('user_id', args.studentId))
          .collect(),
        ctx.db
          .query('projects')
          .withIndex('by_user', (q) => q.eq('user_id', args.studentId))
          .collect(),
        ctx.db
          .query('advisor_sessions')
          .withIndex('by_student', (q) =>
            q.eq('student_id', args.studentId).eq('university_id', universityId),
          )
          .order('desc')
          .collect(),
        ctx.db
          .query('follow_ups')
          .withIndex('by_user_university', (q) =>
            q.eq('user_id', args.studentId).eq('university_id', universityId),
          )
          .order('desc')
          .collect(),
        ctx.db
          .query('advisor_reviews')
          .withIndex('by_student', (q) =>
            q.eq('student_id', args.studentId).eq('university_id', universityId),
          )
          .order('desc')
          .collect(),
      ]);

    // Parse last note timestamp from university_admin_notes
    let lastNoteAt: number | null = null;
    if (student.university_admin_notes) {
      const notes = student.university_admin_notes.split('\n\n').filter(Boolean);
      if (notes.length > 0) {
        // Get the most recent note (last one, since new notes are appended)
        const mostRecent = notes[notes.length - 1];
        const match = mostRecent.match(/^\[(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\]/);
        if (match) {
          lastNoteAt = new Date(match[1]).getTime();
        }
      }
    }

    return {
      student,
      goals,
      applications,
      resumes,
      coverLetters,
      projects,
      sessions,
      recentActivity: sessions.slice(0, 10),
      followUps,
      reviews,
      // Engagement data
      engagement: {
        lastActiveAt,
        needsOutreach,
        outreachSnoozedUntil: student.outreach_snoozed_until,
        inactivityDays: Math.floor((now - lastActiveAt) / (24 * 60 * 60 * 1000)),
      },
      // Upcoming session (first future session)
      upcomingSession: upcomingSession
        ? {
            _id: upcomingSession._id,
            title: upcomingSession.title,
            start_at: upcomingSession.start_at,
            location: upcomingSession.location,
            meeting_url: upcomingSession.meeting_url,
            session_type: upcomingSession.session_type,
          }
        : null,
      // Assigned advisor
      assignedAdvisor,
      // Last note timestamp
      lastNoteAt,
    };
  },
});

// ============================================================================
// Single Asset Queries (for slide-over detail views)
// ============================================================================

/**
 * Get a single application for a student (authorized)
 */
export const getStudentApplication = query({
  args: {
    clerkId: v.string(),
    studentId: v.id('users'),
    applicationId: v.id('applications'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);
    await assertCanAccessStudent(ctx, sessionCtx, args.studentId);

    const application = await ctx.db.get(args.applicationId);
    if (!application || application.user_id !== args.studentId) {
      return null;
    }

    return application;
  },
});

/**
 * Get a single goal for a student (authorized)
 */
export const getStudentGoal = query({
  args: {
    clerkId: v.string(),
    studentId: v.id('users'),
    goalId: v.id('goals'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);
    await assertCanAccessStudent(ctx, sessionCtx, args.studentId);

    const goal = await ctx.db.get(args.goalId);
    if (!goal || goal.user_id !== args.studentId) {
      return null;
    }

    return goal;
  },
});

/**
 * Get a single resume for a student (authorized)
 */
export const getStudentResume = query({
  args: {
    clerkId: v.string(),
    studentId: v.id('users'),
    resumeId: v.id('resumes'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);
    await assertCanAccessStudent(ctx, sessionCtx, args.studentId);

    const resume = await ctx.db.get(args.resumeId);
    if (!resume || resume.user_id !== args.studentId) {
      return null;
    }

    return resume;
  },
});

/**
 * Get a single cover letter for a student (authorized)
 */
export const getStudentCoverLetter = query({
  args: {
    clerkId: v.string(),
    studentId: v.id('users'),
    coverLetterId: v.id('cover_letters'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);
    await assertCanAccessStudent(ctx, sessionCtx, args.studentId);

    const coverLetter = await ctx.db.get(args.coverLetterId);
    if (!coverLetter || coverLetter.user_id !== args.studentId) {
      return null;
    }

    return coverLetter;
  },
});

/**
 * Get a single project for a student (authorized)
 */
export const getStudentProject = query({
  args: {
    clerkId: v.string(),
    studentId: v.id('users'),
    projectId: v.id('projects'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);
    await assertCanAccessStudent(ctx, sessionCtx, args.studentId);

    const project = await ctx.db.get(args.projectId);
    if (!project || project.user_id !== args.studentId) {
      return null;
    }

    return project;
  },
});

// ============================================================================
// Asset Update Mutations (advisor can update student assets)
// ============================================================================

/**
 * Update a student's application (stage, notes)
 */
export const updateStudentApplication = mutation({
  args: {
    clerkId: v.string(),
    studentId: v.id('users'),
    applicationId: v.id('applications'),
    stage: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);
    await assertCanAccessStudent(ctx, sessionCtx, args.studentId);
    const universityId = requireTenant(sessionCtx);

    const application = await ctx.db.get(args.applicationId);
    if (!application || application.user_id !== args.studentId) {
      throw new Error('Application not found');
    }

    const updates: Record<string, unknown> = {
      updated_at: Date.now(),
    };

    if (args.stage !== undefined) {
      updates.stage = args.stage;
      updates.stage_set_at = Date.now();
    }

    if (args.notes !== undefined) {
      updates.notes = args.notes;
    }

    await ctx.db.patch(args.applicationId, updates);

    // Audit log
    await createAuditLog(ctx, {
      action: 'update_student_application',
      actorId: sessionCtx.userId,
      universityId,
      entityType: 'application',
      entityId: args.applicationId,
      studentId: args.studentId,
    });

    return { success: true };
  },
});

/**
 * Update a student's goal (status, progress)
 */
export const updateStudentGoal = mutation({
  args: {
    clerkId: v.string(),
    studentId: v.id('users'),
    goalId: v.id('goals'),
    status: v.optional(v.string()),
    progress: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);
    await assertCanAccessStudent(ctx, sessionCtx, args.studentId);
    const universityId = requireTenant(sessionCtx);

    const goal = await ctx.db.get(args.goalId);
    if (!goal || goal.user_id !== args.studentId) {
      throw new Error('Goal not found');
    }

    const updates: Record<string, unknown> = {
      updated_at: Date.now(),
    };

    if (args.status !== undefined) {
      updates.status = args.status;
      // If marking as completed, set completed_at
      if (args.status === 'completed' && !goal.completed_at) {
        updates.completed_at = Date.now();
      }
      // If reopening, clear completed_at
      if (args.status !== 'completed' && goal.completed_at) {
        updates.completed_at = undefined;
      }
    }

    if (args.progress !== undefined) {
      updates.progress = Math.max(0, Math.min(100, args.progress));
    }

    await ctx.db.patch(args.goalId, updates);

    // Audit log
    await createAuditLog(ctx, {
      action: 'update_student_goal',
      actorId: sessionCtx.userId,
      universityId,
      entityType: 'goal',
      entityId: args.goalId,
      studentId: args.studentId,
    });

    return { success: true };
  },
});

// ============================================================================
// ADVISOR SELF-ASSIGNMENT (Add Student to Caseload)
// ============================================================================

/**
 * Get all students in the advisor's university that are not already assigned to them
 */
export const getAvailableStudentsForAdvisor = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    // Get all students in the university (role = 'student' or 'user')
    const allUsers = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', universityId))
      .collect();

    const students = allUsers.filter((u) => u.role === 'student' || u.role === 'user');

    // Get students already assigned to this advisor
    const existingAssignments = await ctx.db
      .query('student_advisors')
      .withIndex('by_advisor', (q) =>
        q.eq('advisor_id', sessionCtx.userId).eq('university_id', universityId),
      )
      .collect();

    const assignedStudentIds = new Set(existingAssignments.map((a) => a.student_id));

    // Filter out already-assigned students
    const availableStudents = students.filter((s) => !assignedStudentIds.has(s._id));

    // Return basic info only (no sensitive data)
    return availableStudents.map((s) => ({
      _id: s._id,
      name: s.name,
      email: s.email,
      major: s.major,
      graduation_year: s.graduation_year,
      profile_image: s.profile_image,
    }));
  },
});

/**
 * Self-assign a student to the advisor's caseload
 * - If student has no primary advisor, advisor becomes primary (is_owner: true)
 * - If student already has a primary advisor, advisor becomes secondary (is_owner: false)
 */
export const selfAssignStudent = mutation({
  args: {
    clerkId: v.string(),
    studentId: v.id('users'),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx, args.clerkId);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    // Verify student exists and is in the same university
    const student = await ctx.db.get(args.studentId);
    if (!student) {
      throw new Error('Student not found');
    }
    if (student.university_id !== universityId) {
      throw new Error('Student is not in your university');
    }
    if (student.role !== 'student' && student.role !== 'user') {
      throw new Error('Selected user is not a student');
    }

    // Check if already assigned to this advisor
    const existingAssignment = await ctx.db
      .query('student_advisors')
      .withIndex('by_advisor', (q) =>
        q.eq('advisor_id', sessionCtx.userId).eq('university_id', universityId),
      )
      .filter((q) => q.eq(q.field('student_id'), args.studentId))
      .unique();

    if (existingAssignment) {
      throw new Error('This student is already assigned to you');
    }

    // Check if student already has a primary advisor
    const existingOwner = await ctx.db
      .query('student_advisors')
      .withIndex('by_student_owner', (q) => q.eq('student_id', args.studentId).eq('is_owner', true))
      .first();

    // Determine ownership: primary if no existing owner, secondary otherwise
    const isOwner = !existingOwner;

    const now = Date.now();

    // Create the assignment
    const assignmentId = await ctx.db.insert('student_advisors', {
      student_id: args.studentId,
      advisor_id: sessionCtx.userId,
      university_id: universityId,
      is_owner: isOwner,
      shared_type: undefined,
      assigned_at: now,
      assigned_by: sessionCtx.userId, // Self-assigned
      notes: args.notes,
      created_at: now,
      updated_at: now,
    });

    // Audit log
    await createAuditLog(ctx, {
      actorId: sessionCtx.userId,
      universityId,
      action: 'advisor.self_assigned_student',
      entityType: 'student_advisor',
      entityId: assignmentId,
      studentId: args.studentId,
      newValue: {
        is_owner: isOwner,
        self_assigned: true,
      },
    });

    return { assignmentId, isOwner };
  },
});
