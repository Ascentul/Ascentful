/**
 * Momentum Scoring System
 *
 * Calculates student momentum based on activity patterns for advisor triage.
 * Used in the Action Queue to prioritize which students need attention.
 *
 * Momentum Signal:
 *   - GREEN: Student is on track, progressing well
 *   - YELLOW: Student needs attention, slowing down
 *   - RED: Student is stalled, requires immediate intervention
 *
 * Scoring Factors:
 *   - Resume freshness (days since last update)
 *   - Application activity (applications in last 30 days)
 *   - Job board engagement (based on recent activity)
 *   - Goal progress (completion rate of active goals)
 */

import { mutation, query, internalMutation } from './_generated/server';
import { v } from 'convex/values';
import { Id } from './_generated/dataModel';

// ============================================================================
// AUTHORIZATION HELPERS
// ============================================================================

async function requireUniversityAccess(ctx: any, universityId: Id<'universities'>) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error('Unauthorized');
  }

  const user = await ctx.db
    .query('users')
    .withIndex('by_clerk_id', (q: any) => q.eq('clerkId', identity.subject))
    .unique();

  if (!user) {
    throw new Error('User not found');
  }

  // Super admins can access any university
  if (user.role === 'super_admin') {
    return user;
  }

  // University admins and advisors can only access their own university
  if (!['university_admin', 'advisor'].includes(user.role)) {
    throw new Error('Unauthorized: Insufficient permissions');
  }

  if (user.university_id !== universityId) {
    throw new Error('Unauthorized: Cannot access other university data');
  }

  return user;
}

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

type MomentumSignal = 'green' | 'yellow' | 'red';
type JobBoardActivity = 'active' | 'moderate' | 'inactive';

interface MomentumFactors {
  resumeFreshnessDays: number;
  applicationsLast30Days: number;
  goalsCompleted: number;
  goalsTotal: number;
  lastActivityDays: number;
}

interface MomentumResult {
  score: number; // 0-100
  signal: MomentumSignal;
  reason: string;
  jobBoardActivity: JobBoardActivity;
}

// Thresholds for scoring
const THRESHOLDS = {
  resume: {
    fresh: 14, // < 14 days = fresh
    stale: 30, // 30-60 days = getting stale
    old: 60, // > 60 days = old
  },
  applications: {
    active: 3, // 3+ apps in 30 days = active
    moderate: 1, // 1-2 apps = moderate
  },
  activity: {
    active: 7, // < 7 days since activity = active
    moderate: 14, // 7-14 days = moderate
    inactive: 30, // > 30 days = inactive
  },
  goals: {
    goodProgress: 0.5, // > 50% goals completed = good
  },
};

// Reason tags for different scenarios
const REASONS = {
  searchPlateau: 'Search Plateau',
  resumeStale: 'Resume Stale',
  inactiveStudent: 'Inactive',
  lowApplications: 'Low Applications',
  noGoalProgress: 'No Goal Progress',
  onTrack: 'On Track',
  engagementDrop: 'Engagement Drop',
  needsGuidance: 'Needs Guidance',
};

// ============================================================================
// SCORING LOGIC
// ============================================================================

function calculateMomentum(factors: MomentumFactors): MomentumResult {
  let score = 100;
  const issues: string[] = [];

  // Factor 1: Resume freshness (30 points max deduction)
  if (factors.resumeFreshnessDays > THRESHOLDS.resume.old) {
    score -= 30;
    issues.push(REASONS.resumeStale);
  } else if (factors.resumeFreshnessDays > THRESHOLDS.resume.stale) {
    score -= 15;
  } else if (factors.resumeFreshnessDays > THRESHOLDS.resume.fresh) {
    score -= 5;
  }

  // Factor 2: Application activity (30 points max deduction)
  if (factors.applicationsLast30Days === 0) {
    score -= 30;
    if (!issues.includes(REASONS.resumeStale)) {
      issues.push(REASONS.lowApplications);
    }
  } else if (factors.applicationsLast30Days < THRESHOLDS.applications.active) {
    // 1-2 applications: moderate activity, smaller deduction
    score -= 15;
  }
  // 3+ applications (active): no deduction

  // Factor 3: Last activity (20 points max deduction)
  if (factors.lastActivityDays > THRESHOLDS.activity.inactive) {
    score -= 20;
    if (issues.length === 0) {
      issues.push(REASONS.inactiveStudent);
    }
  } else if (factors.lastActivityDays > THRESHOLDS.activity.moderate) {
    score -= 10;
  } else if (factors.lastActivityDays > THRESHOLDS.activity.active) {
    score -= 5;
  }

  // Factor 4: Goal progress (20 points max deduction)
  const goalProgress = factors.goalsTotal > 0 ? factors.goalsCompleted / factors.goalsTotal : 0;
  if (factors.goalsTotal > 0 && goalProgress === 0) {
    score -= 20;
    if (issues.length === 0) {
      issues.push(REASONS.noGoalProgress);
    }
  } else if (goalProgress < THRESHOLDS.goals.goodProgress) {
    score -= 10;
  }

  // Determine signal based on score
  let signal: MomentumSignal;
  if (score >= 70) {
    signal = 'green';
  } else if (score >= 40) {
    signal = 'yellow';
  } else {
    signal = 'red';
  }

  // Determine reason
  let reason: string;
  if (issues.length > 0) {
    // Check for search plateau pattern (has resume issues + low activity)
    if (
      factors.resumeFreshnessDays > THRESHOLDS.resume.stale &&
      factors.applicationsLast30Days < THRESHOLDS.applications.active
    ) {
      reason = REASONS.searchPlateau;
    } else {
      reason = issues[0];
    }
  } else {
    reason = REASONS.onTrack;
  }

  // Determine job board activity
  let jobBoardActivity: JobBoardActivity;
  if (factors.applicationsLast30Days >= THRESHOLDS.applications.active) {
    jobBoardActivity = 'active';
  } else if (factors.applicationsLast30Days >= THRESHOLDS.applications.moderate) {
    jobBoardActivity = 'moderate';
  } else {
    jobBoardActivity = 'inactive';
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    signal,
    reason,
    jobBoardActivity,
  };
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get momentum data for a single student
 */
export const getStudentMomentum = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    // Verify caller has access to this student's data
    if (user.university_id) {
      await requireUniversityAccess(ctx, user.university_id);
    }

    return {
      score: user.momentum_score ?? null,
      signal: user.momentum_signal ?? null,
      reason: user.momentum_reason ?? null,
      jobBoardActivity: user.job_board_activity ?? null,
      updatedAt: user.momentum_updated_at ?? null,
    };
  },
});

/**
 * Get students by momentum signal for a university
 */
export const getStudentsByMomentum = query({
  args: {
    universityId: v.id('universities'),
    signal: v.optional(v.union(v.literal('green'), v.literal('yellow'), v.literal('red'))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireUniversityAccess(ctx, args.universityId);
    const limit = args.limit ?? 100;

    let students;
    if (args.signal) {
      students = await ctx.db
        .query('users')
        .withIndex('by_university_momentum', (q) =>
          q.eq('university_id', args.universityId).eq('momentum_signal', args.signal),
        )
        .take(limit);
    } else {
      students = await ctx.db
        .query('users')
        .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
        .filter((q) => q.neq(q.field('momentum_signal'), undefined))
        .take(limit);
    }

    return students.map((s) => ({
      id: s._id,
      name: s.name,
      email: s.email,
      momentumScore: s.momentum_score,
      momentumSignal: s.momentum_signal,
      momentumReason: s.momentum_reason,
      jobBoardActivity: s.job_board_activity,
      departmentId: s.department_id,
    }));
  },
});

/**
 * Get momentum distribution for a university (for charts)
 */
export const getMomentumDistribution = query({
  args: { universityId: v.id('universities') },
  handler: async (ctx, args) => {
    await requireUniversityAccess(ctx, args.universityId);

    const students = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .filter((q) => q.eq(q.field('role'), 'student'))
      .collect();

    const distribution = {
      green: 0,
      yellow: 0,
      red: 0,
      unknown: 0,
      total: students.length,
    };

    for (const student of students) {
      if (student.momentum_signal === 'green') {
        distribution.green++;
      } else if (student.momentum_signal === 'yellow') {
        distribution.yellow++;
      } else if (student.momentum_signal === 'red') {
        distribution.red++;
      } else {
        distribution.unknown++;
      }
    }

    return distribution;
  },
});

/**
 * Get momentum distribution by department (for cohort analytics chart)
 */
export const getMomentumByDepartment = query({
  args: {
    universityId: v.id('universities'),
    departmentId: v.optional(v.id('departments')),
  },
  handler: async (ctx, args) => {
    await requireUniversityAccess(ctx, args.universityId);
    // Get all students, optionally filtered by department
    let studentsQuery = ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .filter((q) => q.eq(q.field('role'), 'student'));

    const allStudents = await studentsQuery.collect();

    // Filter by department if specified
    const students = args.departmentId
      ? allStudents.filter((s) => s.department_id === args.departmentId)
      : allStudents;

    // Get departments for the university
    const departments = await ctx.db
      .query('departments')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .collect();

    // Build distribution by department
    const byDepartment: Record<
      string,
      {
        departmentId: string;
        departmentName: string;
        green: number;
        yellow: number;
        red: number;
        total: number;
      }
    > = {};

    // Initialize with all departments
    for (const dept of departments) {
      byDepartment[dept._id] = {
        departmentId: dept._id,
        departmentName: dept.name,
        green: 0,
        yellow: 0,
        red: 0,
        total: 0,
      };
    }

    // Add "Unknown" bucket for students without department
    byDepartment['unknown'] = {
      departmentId: 'unknown',
      departmentName: 'Unknown',
      green: 0,
      yellow: 0,
      red: 0,
      total: 0,
    };

    // Count students by department and signal
    for (const student of students) {
      const deptKey = student.department_id?.toString() || 'unknown';
      if (!byDepartment[deptKey]) continue;

      byDepartment[deptKey].total++;
      if (student.momentum_signal === 'green') {
        byDepartment[deptKey].green++;
      } else if (student.momentum_signal === 'yellow') {
        byDepartment[deptKey].yellow++;
      } else if (student.momentum_signal === 'red') {
        byDepartment[deptKey].red++;
      }
    }

    // Convert to array and filter out empty departments
    const result = Object.values(byDepartment).filter((d) => d.total > 0);

    // Calculate totals
    const totals = {
      green: students.filter((s) => s.momentum_signal === 'green').length,
      yellow: students.filter((s) => s.momentum_signal === 'yellow').length,
      red: students.filter((s) => s.momentum_signal === 'red').length,
      total: students.length,
    };

    return {
      byDepartment: result,
      totals,
      departments: departments.map((d) => ({ id: d._id, name: d.name })),
    };
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Calculate and update momentum for a single student
 */
export const calculateStudentMomentum = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== 'student') {
      return { success: false, error: 'User not found or not a student' };
    }

    // Require university access to calculate momentum
    if (user.university_id) {
      await requireUniversityAccess(ctx, user.university_id);
    } else {
      throw new Error('User is not associated with a university');
    }

    // Get resume freshness
    const resumes = await ctx.db
      .query('resumes')
      .withIndex('by_user', (q) => q.eq('user_id', args.userId))
      .collect();

    let resumeFreshnessDays = 365; // Default to very old if no resume
    if (resumes.length > 0) {
      const latestResume = resumes.reduce((latest, r) =>
        (r.updated_at ?? r.created_at) > (latest.updated_at ?? latest.created_at) ? r : latest,
      );
      const resumeAge = now - (latestResume.updated_at ?? latestResume.created_at);
      resumeFreshnessDays = Math.floor(resumeAge / (24 * 60 * 60 * 1000));
    }

    // Get application count in last 30 days
    const applications = await ctx.db
      .query('applications')
      .withIndex('by_user', (q) => q.eq('user_id', args.userId))
      .filter((q) => q.gte(q.field('created_at'), thirtyDaysAgo))
      .collect();
    const applicationsLast30Days = applications.length;

    // Get goal progress
    const goals = await ctx.db
      .query('goals')
      .withIndex('by_user', (q) => q.eq('user_id', args.userId))
      .collect();
    const goalsTotal = goals.length;
    const goalsCompleted = goals.filter((g) => g.status === 'completed').length;

    // Calculate last activity
    const lastActivityTs = user.last_login_at ?? user.updated_at ?? user.created_at;
    const lastActivityDays = Math.floor((now - lastActivityTs) / (24 * 60 * 60 * 1000));

    // Calculate momentum
    const factors: MomentumFactors = {
      resumeFreshnessDays,
      applicationsLast30Days,
      goalsCompleted,
      goalsTotal,
      lastActivityDays,
    };

    const result = calculateMomentum(factors);

    // Update user record
    await ctx.db.patch(args.userId, {
      momentum_score: result.score,
      momentum_signal: result.signal,
      momentum_reason: result.reason,
      job_board_activity: result.jobBoardActivity,
      momentum_updated_at: now,
    });

    return {
      success: true,
      userId: args.userId,
      ...result,
      factors,
    };
  },
});

/**
 * Calculate momentum for all students in a university
 */
export const calculateUniversityMomentum = mutation({
  args: {
    universityId: v.id('universities'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireUniversityAccess(ctx, args.universityId);
    const limit = args.limit ?? 500;

    const students = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .filter((q) => q.eq(q.field('role'), 'student'))
      .take(limit);

    const results = {
      processed: 0,
      green: 0,
      yellow: 0,
      red: 0,
      errors: 0,
    };

    for (const student of students) {
      try {
        const now = Date.now();
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

        // Get resume freshness
        const resumes = await ctx.db
          .query('resumes')
          .withIndex('by_user', (q) => q.eq('user_id', student._id))
          .collect();

        let resumeFreshnessDays = 365;
        if (resumes.length > 0) {
          const latestResume = resumes.reduce((latest, r) =>
            (r.updated_at ?? r.created_at) > (latest.updated_at ?? latest.created_at) ? r : latest,
          );
          const resumeAge = now - (latestResume.updated_at ?? latestResume.created_at);
          resumeFreshnessDays = Math.floor(resumeAge / (24 * 60 * 60 * 1000));
        }

        // Get application count
        const applications = await ctx.db
          .query('applications')
          .withIndex('by_user', (q) => q.eq('user_id', student._id))
          .filter((q) => q.gte(q.field('created_at'), thirtyDaysAgo))
          .collect();

        // Get goals
        const goals = await ctx.db
          .query('goals')
          .withIndex('by_user', (q) => q.eq('user_id', student._id))
          .collect();

        const lastActivityTs = student.last_login_at ?? student.updated_at ?? student.created_at;
        const lastActivityDays = Math.floor((now - lastActivityTs) / (24 * 60 * 60 * 1000));

        const factors: MomentumFactors = {
          resumeFreshnessDays,
          applicationsLast30Days: applications.length,
          goalsCompleted: goals.filter((g) => g.status === 'completed').length,
          goalsTotal: goals.length,
          lastActivityDays,
        };

        const result = calculateMomentum(factors);

        await ctx.db.patch(student._id, {
          momentum_score: result.score,
          momentum_signal: result.signal,
          momentum_reason: result.reason,
          job_board_activity: result.jobBoardActivity,
          momentum_updated_at: now,
        });

        results.processed++;
        if (result.signal === 'green') results.green++;
        else if (result.signal === 'yellow') results.yellow++;
        else results.red++;
      } catch (error) {
        console.error(`Error processing student ${student._id}:`, error);
        results.errors++;
      }
    }

    return results;
  },
});

/**
 * Seed momentum data for demo students (for YC demo)
 * This sets specific momentum values to create the demo narrative
 */
export const seedDemoMomentum = mutation({
  args: { universityId: v.id('universities') },
  handler: async (ctx, args) => {
    await requireUniversityAccess(ctx, args.universityId);
    const now = Date.now();

    // Get all demo students
    const students = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .filter((q) => q.and(q.eq(q.field('role'), 'student'), q.eq(q.field('is_test_user'), true)))
      .collect();

    let seeded = 0;

    for (const student of students) {
      // Special handling for Marcus P.
      if (student.email === 'marcus.patel@demo.edu') {
        await ctx.db.patch(student._id, {
          momentum_score: 35,
          momentum_signal: 'red',
          momentum_reason: 'Search Plateau',
          job_board_activity: 'active', // Active on job boards but resume is stale
          momentum_updated_at: now,
        });
        seeded++;
        continue;
      }

      // Distribute other students with realistic momentum
      // Target distribution: 40% green, 35% yellow, 25% red
      const random = Math.random();
      let signal: MomentumSignal;
      let score: number;
      let reason: string;
      let jobBoardActivity: JobBoardActivity;

      if (random < 0.4) {
        // Green - on track
        signal = 'green';
        score = 70 + Math.floor(Math.random() * 30); // 70-100
        reason = 'On Track';
        jobBoardActivity = Math.random() < 0.7 ? 'active' : 'moderate';
      } else if (random < 0.75) {
        // Yellow - needs attention
        signal = 'yellow';
        score = 40 + Math.floor(Math.random() * 30); // 40-70
        const reasons = ['Low Applications', 'Needs Guidance', 'Engagement Drop'];
        reason = reasons[Math.floor(Math.random() * reasons.length)];
        jobBoardActivity = Math.random() < 0.5 ? 'moderate' : 'inactive';
      } else {
        // Red - stalled
        signal = 'red';
        score = Math.floor(Math.random() * 40); // 0-40
        const reasons = ['Search Plateau', 'Resume Stale', 'Inactive'];
        reason = reasons[Math.floor(Math.random() * reasons.length)];
        jobBoardActivity = Math.random() < 0.3 ? 'active' : 'inactive';
      }

      await ctx.db.patch(student._id, {
        momentum_score: score,
        momentum_signal: signal,
        momentum_reason: reason,
        job_board_activity: jobBoardActivity,
        momentum_updated_at: now,
      });
      seeded++;
    }

    return { seeded, total: students.length };
  },
});
