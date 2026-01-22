/**
 * Graduation Outcomes Module
 *
 * Manages graduation cohorts and graduate outcomes for NACE reporting.
 * Supports:
 * - Cohort management (by term/year)
 * - Individual graduate outcome tracking
 * - Computed statistics (employment rate, knowledge rate, salary metrics)
 * - Survey and reminder tracking
 *
 * All mutations require university_admin role with tenant isolation.
 */

import { v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { getCurrentUser, requireTenant } from './advisor_auth';
import { assertUniversityAccess, requireUniversityAdmin } from './lib/roles';

// ============================================================================
// COHORT QUERIES
// ============================================================================

/**
 * Get all cohorts for an institution
 */
export const getCohortsByInstitution = query({
  args: {
    institutionId: v.id('universities'),
    year: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal('draft'),
        v.literal('collecting'),
        v.literal('finalized'),
        v.literal('submitted'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);

    // Super admins can access any institution
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (universityId !== args.institutionId) {
        throw new Error('Unauthorized: Different university');
      }
    }

    let cohorts;

    if (args.year) {
      cohorts = await ctx.db
        .query('graduation_cohorts')
        .withIndex('by_institution_year', (q) =>
          q.eq('institution_id', args.institutionId).eq('graduation_year', args.year!),
        )
        .collect();
    } else {
      cohorts = await ctx.db
        .query('graduation_cohorts')
        .withIndex('by_institution', (q) => q.eq('institution_id', args.institutionId))
        .collect();
    }

    if (args.status) {
      cohorts = cohorts.filter((c) => c.status === args.status);
    }

    // Sort by year desc, then term
    const termOrder = { spring: 1, summer: 2, fall: 3, winter: 4 };
    return cohorts.sort((a, b) => {
      if (b.graduation_year !== a.graduation_year) {
        return b.graduation_year - a.graduation_year;
      }
      return termOrder[a.graduation_term] - termOrder[b.graduation_term];
    });
  },
});

/**
 * Get a single cohort by ID
 */
export const getCohort = query({
  args: {
    cohortId: v.id('graduation_cohorts'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);

    const cohort = await ctx.db.get(args.cohortId);
    if (!cohort) {
      throw new Error('Cohort not found');
    }

    // Super admins can access any cohort
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (cohort.institution_id !== universityId) {
        throw new Error('Unauthorized: Cohort is not in your university');
      }
    }

    return cohort;
  },
});

/**
 * Get cohort with computed statistics
 * Calculates real-time metrics from graduate_outcomes
 */
export const getCohortWithStats = query({
  args: {
    cohortId: v.id('graduation_cohorts'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);

    const cohort = await ctx.db.get(args.cohortId);
    if (!cohort) {
      throw new Error('Cohort not found');
    }

    // Super admins can access any cohort
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (cohort.institution_id !== universityId) {
        throw new Error('Unauthorized: Cohort is not in your university');
      }
    }

    // Get all outcomes for this cohort
    const outcomes = await ctx.db
      .query('graduate_outcomes')
      .withIndex('by_cohort', (q) => q.eq('cohort_id', args.cohortId))
      .collect();

    // Compute statistics
    const totalCount = outcomes.length;
    const knownOutcomes = outcomes.filter((o) => o.outcome_status === 'known');
    const knownCount = knownOutcomes.length;

    const employedOutcomes = knownOutcomes.filter(
      (o) => o.outcome_type === 'employed_fulltime' || o.outcome_type === 'employed_parttime',
    );
    const employedCount = employedOutcomes.length;

    const continuingEdCount = knownOutcomes.filter(
      (o) => o.outcome_type === 'continuing_education',
    ).length;

    // Calculate salary statistics from employed outcomes only (consistent with finalizeCohort)
    const salaries = employedOutcomes
      .filter((o) => o.salary !== undefined && o.salary !== null && o.salary > 0)
      .map((o) => o.salary as number)
      .sort((a, b) => a - b);

    let averageSalary: number | null = null;
    let medianSalary: number | null = null;

    if (salaries.length > 0) {
      averageSalary = Math.round(salaries.reduce((a, b) => a + b, 0) / salaries.length);
      const mid = Math.floor(salaries.length / 2);
      medianSalary =
        salaries.length % 2 !== 0
          ? salaries[mid]
          : Math.round((salaries[mid - 1] + salaries[mid]) / 2);
    }

    // Calculate rates
    const knowledgeRate = totalCount > 0 ? Math.round((knownCount / totalCount) * 100) : 0;
    const employmentRate = knownCount > 0 ? Math.round((employedCount / knownCount) * 100) : 0;

    return {
      ...cohort,
      computed_stats: {
        total_count: totalCount,
        known_count: knownCount,
        employed_count: employedCount,
        continuing_ed_count: continuingEdCount,
        knowledge_rate: knowledgeRate,
        employment_rate: employmentRate,
        average_salary: averageSalary,
        median_salary: medianSalary,
      },
    };
  },
});

// ============================================================================
// COHORT MUTATIONS
// ============================================================================

/**
 * Create a new graduation cohort
 * Requires university_admin role
 */
export const createCohort = mutation({
  args: {
    institutionId: v.id('universities'),
    graduationTerm: v.union(
      v.literal('spring'),
      v.literal('summer'),
      v.literal('fall'),
      v.literal('winter'),
    ),
    graduationYear: v.number(),
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
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);
    assertUniversityAccess(user, args.institutionId);

    // Check for duplicate cohort
    const existing = await ctx.db
      .query('graduation_cohorts')
      .withIndex('by_institution_year', (q) =>
        q.eq('institution_id', args.institutionId).eq('graduation_year', args.graduationYear),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field('graduation_term'), args.graduationTerm),
          args.degreeLevel
            ? q.eq(q.field('degree_level'), args.degreeLevel)
            : q.eq(q.field('degree_level'), undefined),
        ),
      )
      .first();

    if (existing) {
      throw new Error(
        `Cohort for ${args.graduationTerm} ${args.graduationYear} already exists${args.degreeLevel ? ` (${args.degreeLevel})` : ''}`,
      );
    }

    const now = Date.now();

    const cohortId = await ctx.db.insert('graduation_cohorts', {
      institution_id: args.institutionId,
      graduation_term: args.graduationTerm,
      graduation_year: args.graduationYear,
      degree_level: args.degreeLevel,
      status: 'draft',
      notes: args.notes,
      created_at: now,
      updated_at: now,
    });

    return cohortId;
  },
});

/**
 * Update a cohort
 * Requires university_admin role
 */
export const updateCohort = mutation({
  args: {
    cohortId: v.id('graduation_cohorts'),
    status: v.optional(
      v.union(
        v.literal('draft'),
        v.literal('collecting'),
        v.literal('finalized'),
        v.literal('submitted'),
      ),
    ),
    totalGraduates: v.optional(v.number()),
    surveyLaunchedAt: v.optional(v.number()),
    surveyClosedAt: v.optional(v.number()),
    naceSubmitted: v.optional(v.boolean()),
    naceSubmittedAt: v.optional(v.number()),
    naceReportUrl: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    const cohort = await ctx.db.get(args.cohortId);
    if (!cohort) {
      throw new Error('Cohort not found');
    }

    assertUniversityAccess(user, cohort.institution_id);

    const updates: Record<string, unknown> = { updated_at: Date.now() };

    if (args.status !== undefined) updates.status = args.status;
    if (args.totalGraduates !== undefined) updates.total_graduates = args.totalGraduates;
    if (args.surveyLaunchedAt !== undefined) updates.survey_launched_at = args.surveyLaunchedAt;
    if (args.surveyClosedAt !== undefined) updates.survey_closed_at = args.surveyClosedAt;
    if (args.naceSubmitted !== undefined) updates.nace_submitted = args.naceSubmitted;
    if (args.naceSubmittedAt !== undefined) updates.nace_submitted_at = args.naceSubmittedAt;
    if (args.naceReportUrl !== undefined) updates.nace_report_url = args.naceReportUrl;
    if (args.notes !== undefined) updates.notes = args.notes;

    await ctx.db.patch(args.cohortId, updates);
    return args.cohortId;
  },
});

/**
 * Record a survey reminder sent
 * Requires university_admin role
 */
export const recordSurveyReminder = mutation({
  args: {
    cohortId: v.id('graduation_cohorts'),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    const cohort = await ctx.db.get(args.cohortId);
    if (!cohort) {
      throw new Error('Cohort not found');
    }

    assertUniversityAccess(user, cohort.institution_id);

    const now = Date.now();

    await ctx.db.patch(args.cohortId, {
      last_reminder_at: now,
      reminder_count: (cohort.reminder_count ?? 0) + 1,
      updated_at: now,
    });

    return args.cohortId;
  },
});

/**
 * Finalize cohort and calculate summary statistics
 * Called when survey collection is complete
 */
export const finalizeCohort = mutation({
  args: {
    cohortId: v.id('graduation_cohorts'),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    const cohort = await ctx.db.get(args.cohortId);
    if (!cohort) {
      throw new Error('Cohort not found');
    }

    assertUniversityAccess(user, cohort.institution_id);

    // Get all outcomes for this cohort
    const outcomes = await ctx.db
      .query('graduate_outcomes')
      .withIndex('by_cohort', (q) => q.eq('cohort_id', args.cohortId))
      .collect();

    const totalCount = outcomes.length;
    const knownOutcomes = outcomes.filter((o) => o.outcome_status === 'known');
    const unknownCount = outcomes.filter((o) => o.outcome_status === 'unknown').length;

    const employed = knownOutcomes.filter(
      (o) => o.outcome_type === 'employed_fulltime' || o.outcome_type === 'employed_parttime',
    );
    const continuingEd = knownOutcomes.filter((o) => o.outcome_type === 'continuing_education');
    const seeking = knownOutcomes.filter((o) => o.outcome_type === 'seeking');
    const notSeeking = knownOutcomes.filter((o) => o.outcome_type === 'not_seeking');

    // Salary calculations
    const salaries = employed
      .filter((o) => o.salary !== undefined && o.salary !== null && o.salary > 0)
      .map((o) => o.salary as number)
      .sort((a, b) => a - b);

    let averageSalary: number | undefined;
    let medianSalary: number | undefined;
    let salary25th: number | undefined;
    let salary75th: number | undefined;

    if (salaries.length > 0) {
      averageSalary = Math.round(salaries.reduce((a, b) => a + b, 0) / salaries.length);

      const mid = Math.floor(salaries.length / 2);
      medianSalary =
        salaries.length % 2 !== 0
          ? salaries[mid]
          : Math.round((salaries[mid - 1] + salaries[mid]) / 2);

      const q1Index = Math.floor(salaries.length * 0.25);
      const q3Index = Math.floor(salaries.length * 0.75);
      salary25th = salaries[q1Index];
      salary75th = salaries[q3Index];
    }

    const knownCount = knownOutcomes.length;

    await ctx.db.patch(args.cohortId, {
      status: 'finalized',
      total_graduates: totalCount,
      known_outcomes: knownCount,
      unknown_outcomes: unknownCount,
      knowledge_rate: totalCount > 0 ? Math.round((knownCount / totalCount) * 100) : 0,
      employment_rate: knownCount > 0 ? Math.round((employed.length / knownCount) * 100) : 0,
      continuing_ed_rate: knownCount > 0 ? Math.round((continuingEd.length / knownCount) * 100) : 0,
      seeking_employment_rate: knownCount > 0 ? Math.round((seeking.length / knownCount) * 100) : 0,
      not_seeking_rate: knownCount > 0 ? Math.round((notSeeking.length / knownCount) * 100) : 0,
      average_salary: averageSalary,
      median_salary: medianSalary,
      salary_25th_percentile: salary25th,
      salary_75th_percentile: salary75th,
      survey_closed_at: Date.now(),
      updated_at: Date.now(),
    });

    return args.cohortId;
  },
});

// ============================================================================
// OUTCOME QUERIES
// ============================================================================

/**
 * Get outcomes for a cohort
 */
export const getOutcomesByCohort = query({
  args: {
    cohortId: v.id('graduation_cohorts'),
    outcomeStatus: v.optional(
      v.union(v.literal('unknown'), v.literal('known'), v.literal('partial')),
    ),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);
    const limit = args.limit ?? 50;

    const cohort = await ctx.db.get(args.cohortId);
    if (!cohort) {
      throw new Error('Cohort not found');
    }

    // Super admins can access any cohort
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (cohort.institution_id !== universityId) {
        throw new Error('Unauthorized: Cohort is not in your university');
      }
    }

    let query = ctx.db
      .query('graduate_outcomes')
      .withIndex('by_cohort', (q) => q.eq('cohort_id', args.cohortId));

    // Apply filter before pagination to ensure consistent page sizes
    if (args.outcomeStatus) {
      query = query.filter((q) => q.eq(q.field('outcome_status'), args.outcomeStatus));
    }

    const result = await query.paginate({
      numItems: limit,
      cursor: args.cursor ?? null,
    });

    return {
      outcomes: result.page,
      cursor: result.continueCursor,
      hasMore: !result.isDone,
    };
  },
});

/**
 * Get a single outcome by ID
 */
export const getOutcome = query({
  args: {
    outcomeId: v.id('graduate_outcomes'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);

    const outcome = await ctx.db.get(args.outcomeId);
    if (!outcome) {
      throw new Error('Outcome not found');
    }

    // Super admins can access any outcome
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (outcome.institution_id !== universityId) {
        throw new Error('Unauthorized: Outcome is not in your university');
      }
    }

    return outcome;
  },
});

/**
 * Get outcomes by major for reporting
 */
export const getOutcomesByMajor = query({
  args: {
    cohortId: v.id('graduation_cohorts'),
    majorId: v.id('majors'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);

    const cohort = await ctx.db.get(args.cohortId);
    if (!cohort) {
      throw new Error('Cohort not found');
    }

    // Super admins can access any cohort
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (cohort.institution_id !== universityId) {
        throw new Error('Unauthorized: Cohort is not in your university');
      }
    }

    const outcomes = await ctx.db
      .query('graduate_outcomes')
      .withIndex('by_major', (q) => q.eq('major_id', args.majorId))
      .filter((q) => q.eq(q.field('cohort_id'), args.cohortId))
      .collect();

    return outcomes;
  },
});

// ============================================================================
// OUTCOME MUTATIONS
// ============================================================================

/**
 * Create a graduate outcome
 * Requires university_admin role
 */
export const createOutcome = mutation({
  args: {
    cohortId: v.id('graduation_cohorts'),
    studentId: v.optional(v.id('users')),
    majorId: v.optional(v.id('majors')),
    externalStudentId: v.optional(v.string()),
    studentEmail: v.optional(v.string()),
    studentName: v.optional(v.string()),
    outcomeStatus: v.union(v.literal('unknown'), v.literal('known'), v.literal('partial')),
    outcomeType: v.optional(
      v.union(
        v.literal('employed_fulltime'),
        v.literal('employed_parttime'),
        v.literal('continuing_education'),
        v.literal('military'),
        v.literal('volunteer'),
        v.literal('seeking'),
        v.literal('not_seeking'),
      ),
    ),
    employerName: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    jobFunction: v.optional(v.string()),
    industry: v.optional(v.string()),
    naicsCode: v.optional(v.string()),
    isFullTime: v.optional(v.boolean()),
    salary: v.optional(v.number()),
    startDate: v.optional(v.number()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    country: v.optional(v.string()),
    isRemote: v.optional(v.boolean()),
    gradSchoolName: v.optional(v.string()),
    gradSchoolProgram: v.optional(v.string()),
    gradSchoolDegree: v.optional(v.string()),
    isMajorRelated: v.optional(v.boolean()),
    dataSource: v.optional(
      v.union(
        v.literal('survey'),
        v.literal('linkedin'),
        v.literal('advisor_input'),
        v.literal('student_self_report'),
        v.literal('employer_report'),
        v.literal('platform_inference'),
      ),
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    const cohort = await ctx.db.get(args.cohortId);
    if (!cohort) {
      throw new Error('Cohort not found');
    }

    assertUniversityAccess(user, cohort.institution_id);

    const now = Date.now();

    const outcomeId = await ctx.db.insert('graduate_outcomes', {
      cohort_id: args.cohortId,
      institution_id: cohort.institution_id,
      student_id: args.studentId,
      major_id: args.majorId,
      external_student_id: args.externalStudentId,
      student_email: args.studentEmail,
      student_name: args.studentName,
      outcome_status: args.outcomeStatus,
      outcome_type: args.outcomeType,
      employer_name: args.employerName,
      job_title: args.jobTitle,
      job_function: args.jobFunction,
      industry: args.industry,
      naics_code: args.naicsCode,
      is_full_time: args.isFullTime,
      salary: args.salary,
      start_date: args.startDate,
      city: args.city,
      state: args.state,
      country: args.country,
      is_remote: args.isRemote,
      grad_school_name: args.gradSchoolName,
      grad_school_program: args.gradSchoolProgram,
      grad_school_degree: args.gradSchoolDegree,
      is_major_related: args.isMajorRelated,
      data_source: args.dataSource,
      is_verified: false,
      created_at: now,
      updated_at: now,
    });

    return outcomeId;
  },
});

/**
 * Update a graduate outcome
 * Requires university_admin role
 */
export const updateOutcome = mutation({
  args: {
    outcomeId: v.id('graduate_outcomes'),
    outcomeStatus: v.optional(
      v.union(v.literal('unknown'), v.literal('known'), v.literal('partial')),
    ),
    outcomeType: v.optional(
      v.union(
        v.literal('employed_fulltime'),
        v.literal('employed_parttime'),
        v.literal('continuing_education'),
        v.literal('military'),
        v.literal('volunteer'),
        v.literal('seeking'),
        v.literal('not_seeking'),
      ),
    ),
    employerName: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    jobFunction: v.optional(v.string()),
    industry: v.optional(v.string()),
    naicsCode: v.optional(v.string()),
    isFullTime: v.optional(v.boolean()),
    salary: v.optional(v.number()),
    startDate: v.optional(v.number()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    country: v.optional(v.string()),
    isRemote: v.optional(v.boolean()),
    gradSchoolName: v.optional(v.string()),
    gradSchoolProgram: v.optional(v.string()),
    gradSchoolDegree: v.optional(v.string()),
    isMajorRelated: v.optional(v.boolean()),
    dataSource: v.optional(
      v.union(
        v.literal('survey'),
        v.literal('linkedin'),
        v.literal('advisor_input'),
        v.literal('student_self_report'),
        v.literal('employer_report'),
        v.literal('platform_inference'),
      ),
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    const outcome = await ctx.db.get(args.outcomeId);
    if (!outcome) {
      throw new Error('Outcome not found');
    }

    assertUniversityAccess(user, outcome.institution_id);

    const updates: Record<string, unknown> = { updated_at: Date.now() };

    if (args.outcomeStatus !== undefined) updates.outcome_status = args.outcomeStatus;
    if (args.outcomeType !== undefined) updates.outcome_type = args.outcomeType;
    if (args.employerName !== undefined) updates.employer_name = args.employerName;
    if (args.jobTitle !== undefined) updates.job_title = args.jobTitle;
    if (args.jobFunction !== undefined) updates.job_function = args.jobFunction;
    if (args.industry !== undefined) updates.industry = args.industry;
    if (args.naicsCode !== undefined) updates.naics_code = args.naicsCode;
    if (args.isFullTime !== undefined) updates.is_full_time = args.isFullTime;
    if (args.salary !== undefined) updates.salary = args.salary;
    if (args.startDate !== undefined) updates.start_date = args.startDate;
    if (args.city !== undefined) updates.city = args.city;
    if (args.state !== undefined) updates.state = args.state;
    if (args.country !== undefined) updates.country = args.country;
    if (args.isRemote !== undefined) updates.is_remote = args.isRemote;
    if (args.gradSchoolName !== undefined) updates.grad_school_name = args.gradSchoolName;
    if (args.gradSchoolProgram !== undefined) updates.grad_school_program = args.gradSchoolProgram;
    if (args.gradSchoolDegree !== undefined) updates.grad_school_degree = args.gradSchoolDegree;
    if (args.isMajorRelated !== undefined) updates.is_major_related = args.isMajorRelated;
    if (args.dataSource !== undefined) updates.data_source = args.dataSource;
    if (args.notes !== undefined) updates.notes = args.notes;

    await ctx.db.patch(args.outcomeId, updates);
    return args.outcomeId;
  },
});

/**
 * Verify an outcome
 * Requires university_admin role
 */
export const verifyOutcome = mutation({
  args: {
    outcomeId: v.id('graduate_outcomes'),
    isVerified: v.boolean(),
    confidenceScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    const outcome = await ctx.db.get(args.outcomeId);
    if (!outcome) {
      throw new Error('Outcome not found');
    }

    assertUniversityAccess(user, outcome.institution_id);

    const now = Date.now();

    await ctx.db.patch(args.outcomeId, {
      is_verified: args.isVerified,
      confidence_score: args.confidenceScore,
      verified_by: args.isVerified ? user._id : undefined,
      verified_at: args.isVerified ? now : undefined,
      updated_at: now,
    });

    return args.outcomeId;
  },
});

/**
 * Bulk import outcomes for a cohort
 * Requires university_admin role
 */
export const bulkImportOutcomes = mutation({
  args: {
    cohortId: v.id('graduation_cohorts'),
    outcomes: v.array(
      v.object({
        externalStudentId: v.optional(v.string()),
        studentEmail: v.optional(v.string()),
        studentName: v.optional(v.string()),
        majorId: v.optional(v.id('majors')),
        outcomeStatus: v.union(v.literal('unknown'), v.literal('known'), v.literal('partial')),
        outcomeType: v.optional(
          v.union(
            v.literal('employed_fulltime'),
            v.literal('employed_parttime'),
            v.literal('continuing_education'),
            v.literal('military'),
            v.literal('volunteer'),
            v.literal('seeking'),
            v.literal('not_seeking'),
          ),
        ),
        employerName: v.optional(v.string()),
        jobTitle: v.optional(v.string()),
        salary: v.optional(v.number()),
        city: v.optional(v.string()),
        state: v.optional(v.string()),
        country: v.optional(v.string()),
        gradSchoolName: v.optional(v.string()),
        gradSchoolProgram: v.optional(v.string()),
      }),
    ),
    dataSource: v.optional(
      v.union(
        v.literal('survey'),
        v.literal('linkedin'),
        v.literal('advisor_input'),
        v.literal('student_self_report'),
        v.literal('employer_report'),
        v.literal('platform_inference'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    const cohort = await ctx.db.get(args.cohortId);
    if (!cohort) {
      throw new Error('Cohort not found');
    }

    assertUniversityAccess(user, cohort.institution_id);

    const now = Date.now();
    const createdIds: Id<'graduate_outcomes'>[] = [];

    for (const outcomeData of args.outcomes) {
      const outcomeId = await ctx.db.insert('graduate_outcomes', {
        cohort_id: args.cohortId,
        institution_id: cohort.institution_id,
        external_student_id: outcomeData.externalStudentId,
        student_email: outcomeData.studentEmail,
        student_name: outcomeData.studentName,
        major_id: outcomeData.majorId,
        outcome_status: outcomeData.outcomeStatus,
        outcome_type: outcomeData.outcomeType,
        employer_name: outcomeData.employerName,
        job_title: outcomeData.jobTitle,
        salary: outcomeData.salary,
        city: outcomeData.city,
        state: outcomeData.state,
        country: outcomeData.country,
        grad_school_name: outcomeData.gradSchoolName,
        grad_school_program: outcomeData.gradSchoolProgram,
        data_source: args.dataSource ?? 'survey',
        is_verified: false,
        created_at: now,
        updated_at: now,
      });
      createdIds.push(outcomeId);
    }

    return createdIds;
  },
});

/**
 * Archive an outcome (soft delete)
 * Requires university_admin role
 *
 * Uses soft delete to preserve data for:
 * - NACE reporting audit trails
 * - Institutional metrics history
 * - Data correction tracking
 */
export const archiveOutcome = mutation({
  args: {
    outcomeId: v.id('graduate_outcomes'),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    const outcome = await ctx.db.get(args.outcomeId);
    if (!outcome) {
      throw new Error('Outcome not found');
    }

    assertUniversityAccess(user, outcome.institution_id);

    await ctx.db.patch(args.outcomeId, {
      is_active: false,
      updated_at: Date.now(),
    });

    return args.outcomeId;
  },
});

/**
 * Hard delete an outcome - use only for test data cleanup
 * Requires university_admin role
 *
 * WARNING: Permanently removes data. Use archiveOutcome for normal operations.
 */
export const hardDeleteOutcome = mutation({
  args: {
    outcomeId: v.id('graduate_outcomes'),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    const outcome = await ctx.db.get(args.outcomeId);
    if (!outcome) {
      throw new Error('Outcome not found');
    }

    assertUniversityAccess(user, outcome.institution_id);

    await ctx.db.delete(args.outcomeId);

    return args.outcomeId;
  },
});

// ============================================================================
// IDEMPOTENT IMPORT
// ============================================================================

/**
 * Upsert a graduate outcome using external_outcome_id for deduplication.
 *
 * This is the preferred method for CSV imports as it:
 * - Creates new records if no match exists
 * - Updates existing records if external_outcome_id matches
 * - Returns the action taken (created/updated/skipped)
 *
 * Requires university_admin role.
 */
export const upsertOutcome = mutation({
  args: {
    cohortId: v.id('graduation_cohorts'),
    externalOutcomeId: v.string(),
    studentId: v.optional(v.id('users')),
    majorId: v.optional(v.id('majors')),
    externalStudentId: v.optional(v.string()),
    studentEmail: v.optional(v.string()),
    studentName: v.optional(v.string()),
    outcomeStatus: v.union(v.literal('unknown'), v.literal('known'), v.literal('partial')),
    outcomeType: v.optional(
      v.union(
        v.literal('employed_fulltime'),
        v.literal('employed_parttime'),
        v.literal('continuing_education'),
        v.literal('military'),
        v.literal('volunteer'),
        v.literal('seeking'),
        v.literal('not_seeking'),
      ),
    ),
    employerName: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    jobFunction: v.optional(v.string()),
    industry: v.optional(v.string()),
    naicsCode: v.optional(v.string()),
    isFullTime: v.optional(v.boolean()),
    salary: v.optional(v.number()),
    startDate: v.optional(v.number()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    country: v.optional(v.string()),
    isRemote: v.optional(v.boolean()),
    gradSchoolName: v.optional(v.string()),
    gradSchoolProgram: v.optional(v.string()),
    gradSchoolDegree: v.optional(v.string()),
    isMajorRelated: v.optional(v.boolean()),
    dataSource: v.optional(
      v.union(
        v.literal('survey'),
        v.literal('linkedin'),
        v.literal('advisor_input'),
        v.literal('student_self_report'),
        v.literal('employer_report'),
        v.literal('platform_inference'),
      ),
    ),
    notes: v.optional(v.string()),
    skipIfManuallyEdited: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    const cohort = await ctx.db.get(args.cohortId);
    if (!cohort) {
      throw new Error('Cohort not found');
    }

    assertUniversityAccess(user, cohort.institution_id);

    const now = Date.now();

    // Check for existing by external_outcome_id
    const existing = await ctx.db
      .query('graduate_outcomes')
      .withIndex('by_external_outcome_id', (q) =>
        q
          .eq('institution_id', cohort.institution_id)
          .eq('external_outcome_id', args.externalOutcomeId),
      )
      .first();

    if (existing) {
      // Check if we should skip manually edited records
      if (args.skipIfManuallyEdited) {
        const manualSources = ['advisor_input', 'student_self_report'];
        if (existing.data_source && manualSources.includes(existing.data_source)) {
          return {
            action: 'skipped' as const,
            outcomeId: existing._id,
            reason: 'manually_edited',
          };
        }
      }

      // Update existing record
      const updates: Record<string, unknown> = { updated_at: now };

      if (args.studentId !== undefined) updates.student_id = args.studentId;
      if (args.majorId !== undefined) updates.major_id = args.majorId;
      if (args.externalStudentId !== undefined)
        updates.external_student_id = args.externalStudentId;
      if (args.studentEmail !== undefined) updates.student_email = args.studentEmail;
      if (args.studentName !== undefined) updates.student_name = args.studentName;
      if (args.outcomeStatus !== undefined) updates.outcome_status = args.outcomeStatus;
      if (args.outcomeType !== undefined) updates.outcome_type = args.outcomeType;
      if (args.employerName !== undefined) updates.employer_name = args.employerName;
      if (args.jobTitle !== undefined) updates.job_title = args.jobTitle;
      if (args.jobFunction !== undefined) updates.job_function = args.jobFunction;
      if (args.industry !== undefined) updates.industry = args.industry;
      if (args.naicsCode !== undefined) updates.naics_code = args.naicsCode;
      if (args.isFullTime !== undefined) updates.is_full_time = args.isFullTime;
      if (args.salary !== undefined) updates.salary = args.salary;
      if (args.startDate !== undefined) updates.start_date = args.startDate;
      if (args.city !== undefined) updates.city = args.city;
      if (args.state !== undefined) updates.state = args.state;
      if (args.country !== undefined) updates.country = args.country;
      if (args.isRemote !== undefined) updates.is_remote = args.isRemote;
      if (args.gradSchoolName !== undefined) updates.grad_school_name = args.gradSchoolName;
      if (args.gradSchoolProgram !== undefined)
        updates.grad_school_program = args.gradSchoolProgram;
      if (args.gradSchoolDegree !== undefined) updates.grad_school_degree = args.gradSchoolDegree;
      if (args.isMajorRelated !== undefined) updates.is_major_related = args.isMajorRelated;
      if (args.dataSource !== undefined) updates.data_source = args.dataSource;
      if (args.notes !== undefined) updates.notes = args.notes;

      await ctx.db.patch(existing._id, updates);

      return {
        action: 'updated' as const,
        outcomeId: existing._id,
      };
    }

    // Create new record
    const outcomeId = await ctx.db.insert('graduate_outcomes', {
      cohort_id: args.cohortId,
      institution_id: cohort.institution_id,
      external_outcome_id: args.externalOutcomeId,
      student_id: args.studentId,
      major_id: args.majorId,
      external_student_id: args.externalStudentId,
      student_email: args.studentEmail,
      student_name: args.studentName,
      outcome_status: args.outcomeStatus,
      outcome_type: args.outcomeType,
      employer_name: args.employerName,
      job_title: args.jobTitle,
      job_function: args.jobFunction,
      industry: args.industry,
      naics_code: args.naicsCode,
      is_full_time: args.isFullTime,
      salary: args.salary,
      start_date: args.startDate,
      city: args.city,
      state: args.state,
      country: args.country,
      is_remote: args.isRemote,
      grad_school_name: args.gradSchoolName,
      grad_school_program: args.gradSchoolProgram,
      grad_school_degree: args.gradSchoolDegree,
      is_major_related: args.isMajorRelated,
      data_source: args.dataSource ?? 'survey',
      is_verified: false,
      is_active: true,
      notes: args.notes,
      created_at: now,
      updated_at: now,
    });

    return {
      action: 'created' as const,
      outcomeId,
    };
  },
});

/**
 * Bulk upsert outcomes with idempotent behavior.
 * Processes each row and returns detailed results.
 *
 * Requires university_admin role.
 */
export const bulkUpsertOutcomes = mutation({
  args: {
    cohortId: v.id('graduation_cohorts'),
    outcomes: v.array(
      v.object({
        externalOutcomeId: v.string(),
        externalStudentId: v.optional(v.string()),
        studentEmail: v.optional(v.string()),
        studentName: v.optional(v.string()),
        majorId: v.optional(v.id('majors')),
        outcomeStatus: v.union(v.literal('unknown'), v.literal('known'), v.literal('partial')),
        outcomeType: v.optional(
          v.union(
            v.literal('employed_fulltime'),
            v.literal('employed_parttime'),
            v.literal('continuing_education'),
            v.literal('military'),
            v.literal('volunteer'),
            v.literal('seeking'),
            v.literal('not_seeking'),
          ),
        ),
        employerName: v.optional(v.string()),
        jobTitle: v.optional(v.string()),
        salary: v.optional(v.number()),
        city: v.optional(v.string()),
        state: v.optional(v.string()),
        country: v.optional(v.string()),
        gradSchoolName: v.optional(v.string()),
        gradSchoolProgram: v.optional(v.string()),
      }),
    ),
    dataSource: v.optional(
      v.union(
        v.literal('survey'),
        v.literal('linkedin'),
        v.literal('advisor_input'),
        v.literal('student_self_report'),
        v.literal('employer_report'),
        v.literal('platform_inference'),
      ),
    ),
    skipIfManuallyEdited: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    const cohort = await ctx.db.get(args.cohortId);
    if (!cohort) {
      throw new Error('Cohort not found');
    }

    assertUniversityAccess(user, cohort.institution_id);

    const now = Date.now();
    const results = {
      total: args.outcomes.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as Array<{ row: number; externalId: string; error: string }>,
    };

    for (let i = 0; i < args.outcomes.length; i++) {
      const outcomeData = args.outcomes[i];

      try {
        // Check for existing
        const existing = await ctx.db
          .query('graduate_outcomes')
          .withIndex('by_external_outcome_id', (q) =>
            q
              .eq('institution_id', cohort.institution_id)
              .eq('external_outcome_id', outcomeData.externalOutcomeId),
          )
          .first();

        if (existing) {
          // Check if we should skip manually edited records
          if (args.skipIfManuallyEdited) {
            const manualSources = ['advisor_input', 'student_self_report'];
            if (existing.data_source && manualSources.includes(existing.data_source)) {
              results.skipped++;
              continue;
            }
          }

          // Update - only override fields that are explicitly provided (not undefined)
          // This prevents bulk imports from accidentally clearing existing data
          await ctx.db.patch(existing._id, {
            // Always update required fields and timestamp
            outcome_status: outcomeData.outcomeStatus,
            updated_at: now,
            // Only override optional fields if explicitly provided
            ...(outcomeData.externalStudentId !== undefined && {
              external_student_id: outcomeData.externalStudentId,
            }),
            ...(outcomeData.studentEmail !== undefined && {
              student_email: outcomeData.studentEmail,
            }),
            ...(outcomeData.studentName !== undefined && {
              student_name: outcomeData.studentName,
            }),
            ...(outcomeData.majorId !== undefined && {
              major_id: outcomeData.majorId,
            }),
            ...(outcomeData.outcomeType !== undefined && {
              outcome_type: outcomeData.outcomeType,
            }),
            ...(outcomeData.employerName !== undefined && {
              employer_name: outcomeData.employerName,
            }),
            ...(outcomeData.jobTitle !== undefined && {
              job_title: outcomeData.jobTitle,
            }),
            ...(outcomeData.salary !== undefined && {
              salary: outcomeData.salary,
            }),
            ...(outcomeData.city !== undefined && {
              city: outcomeData.city,
            }),
            ...(outcomeData.state !== undefined && {
              state: outcomeData.state,
            }),
            ...(outcomeData.country !== undefined && {
              country: outcomeData.country,
            }),
            ...(outcomeData.gradSchoolName !== undefined && {
              grad_school_name: outcomeData.gradSchoolName,
            }),
            ...(outcomeData.gradSchoolProgram !== undefined && {
              grad_school_program: outcomeData.gradSchoolProgram,
            }),
            ...(args.dataSource !== undefined && {
              data_source: args.dataSource,
            }),
          });
          results.updated++;
        } else {
          // Create
          await ctx.db.insert('graduate_outcomes', {
            cohort_id: args.cohortId,
            institution_id: cohort.institution_id,
            external_outcome_id: outcomeData.externalOutcomeId,
            external_student_id: outcomeData.externalStudentId,
            student_email: outcomeData.studentEmail,
            student_name: outcomeData.studentName,
            major_id: outcomeData.majorId,
            outcome_status: outcomeData.outcomeStatus,
            outcome_type: outcomeData.outcomeType,
            employer_name: outcomeData.employerName,
            job_title: outcomeData.jobTitle,
            salary: outcomeData.salary,
            city: outcomeData.city,
            state: outcomeData.state,
            country: outcomeData.country,
            grad_school_name: outcomeData.gradSchoolName,
            grad_school_program: outcomeData.gradSchoolProgram,
            data_source: args.dataSource ?? 'survey',
            is_verified: false,
            is_active: true,
            created_at: now,
            updated_at: now,
          });
          results.created++;
        }
      } catch (error) {
        results.errors.push({
          row: i + 1,
          externalId: outcomeData.externalOutcomeId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  },
});

// ============================================================================
// IMPORT PREVIEW
// ============================================================================

/**
 * Preview an import without making changes.
 * Uses identity resolution to match students and returns preview data.
 *
 * Requires university_admin role.
 */
export const previewOutcomeImport = query({
  args: {
    cohortId: v.id('graduation_cohorts'),
    outcomes: v.array(
      v.object({
        externalStudentId: v.optional(v.string()),
        studentEmail: v.optional(v.string()),
        studentName: v.optional(v.string()),
        outcomeStatus: v.union(v.literal('unknown'), v.literal('known'), v.literal('partial')),
        outcomeType: v.optional(
          v.union(
            v.literal('employed_fulltime'),
            v.literal('employed_parttime'),
            v.literal('continuing_education'),
            v.literal('military'),
            v.literal('volunteer'),
            v.literal('seeking'),
            v.literal('not_seeking'),
          ),
        ),
        employerName: v.optional(v.string()),
        jobTitle: v.optional(v.string()),
        salary: v.optional(v.number()),
        city: v.optional(v.string()),
        state: v.optional(v.string()),
        country: v.optional(v.string()),
        gradSchoolName: v.optional(v.string()),
        gradSchoolProgram: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);

    const cohort = await ctx.db.get(args.cohortId);
    if (!cohort) {
      throw new Error('Cohort not found');
    }

    // Super admins can access any cohort
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (cohort.institution_id !== universityId) {
        throw new Error('Unauthorized: Cohort is not in your university');
      }
    }

    const { resolveStudentIdentity, generateExternalOutcomeId } = await import('./lib/importUtils');

    const preview: Array<{
      rowIndex: number;
      identifierUsed: string;
      identityMatch: {
        matched: boolean;
        confidence: 'exact' | 'high' | 'low' | 'none';
        matchedBy?: string;
        userId?: string;
        userName?: string;
        userEmail?: string;
        suggestions?: Array<{ name: string; email: string; confidence: number }>;
      };
      existingOutcome: boolean;
      action: 'create' | 'update' | 'skip';
      validationErrors: string[];
      data: {
        studentName?: string;
        studentEmail?: string;
        externalStudentId?: string;
        outcomeStatus: string;
        outcomeType?: string;
        employerName?: string;
        jobTitle?: string;
        salary?: number;
      };
    }> = [];

    for (let i = 0; i < args.outcomes.length; i++) {
      const row = args.outcomes[i];
      const validationErrors: string[] = [];

      // Validate required fields
      if (!row.externalStudentId && !row.studentEmail) {
        validationErrors.push('Either external_student_id or student_email is required');
      }

      // Resolve identity
      const identityMatch = await resolveStudentIdentity(ctx, cohort.institution_id, {
        externalStudentId: row.externalStudentId,
        email: row.studentEmail,
        name: row.studentName,
      });

      // Check for existing outcome
      const identifier = row.externalStudentId || row.studentEmail || '';
      const externalOutcomeId = identifier
        ? generateExternalOutcomeId(args.cohortId, row.externalStudentId, row.studentEmail)
        : '';

      let existingOutcome = false;
      let action: 'create' | 'update' | 'skip' = 'create';

      if (externalOutcomeId) {
        const existing = await ctx.db
          .query('graduate_outcomes')
          .withIndex('by_external_outcome_id', (q) =>
            q
              .eq('institution_id', cohort.institution_id)
              .eq('external_outcome_id', externalOutcomeId),
          )
          .first();

        if (existing) {
          existingOutcome = true;
          action = 'update';
        }
      }

      // Get matched user details if found
      let userName: string | undefined;
      let userEmail: string | undefined;
      if (identityMatch.matched && identityMatch.userId) {
        const matchedUser = await ctx.db.get(identityMatch.userId);
        if (matchedUser) {
          userName = matchedUser.name || undefined;
          userEmail = matchedUser.email || undefined;
        }
      }

      preview.push({
        rowIndex: i,
        identifierUsed: row.externalStudentId || row.studentEmail || row.studentName || 'Unknown',
        identityMatch: {
          matched: identityMatch.matched,
          confidence: identityMatch.confidence,
          matchedBy: identityMatch.matchedBy,
          userId: identityMatch.userId,
          userName,
          userEmail,
          suggestions: identityMatch.suggestions?.map((s) => ({
            name: s.name,
            email: s.email,
            confidence: s.confidence,
          })),
        },
        existingOutcome,
        action,
        validationErrors,
        data: {
          studentName: row.studentName,
          studentEmail: row.studentEmail,
          externalStudentId: row.externalStudentId,
          outcomeStatus: row.outcomeStatus,
          outcomeType: row.outcomeType,
          employerName: row.employerName,
          jobTitle: row.jobTitle,
          salary: row.salary,
        },
      });
    }

    // Summary stats
    const summary = {
      total: preview.length,
      willCreate: preview.filter((p) => p.action === 'create').length,
      willUpdate: preview.filter((p) => p.action === 'update').length,
      hasErrors: preview.filter((p) => p.validationErrors.length > 0).length,
      identityMatched: preview.filter((p) => p.identityMatch.matched).length,
      needsReview: preview.filter(
        (p) => !p.identityMatch.matched && p.identityMatch.confidence === 'low',
      ).length,
    };

    return { preview, summary };
  },
});

// ============================================================================
// OUTCOMES ANALYTICS - For Leadership Dashboard
// ============================================================================

/**
 * Get aggregated outcomes analytics with filters
 * Used for Leadership Outcomes Dashboard KPIs and breakdowns
 */
export const getOutcomesAnalytics = query({
  args: {
    institutionId: v.id('universities'),
    cohortIds: v.optional(v.array(v.id('graduation_cohorts'))),
    degreeLevels: v.optional(v.array(v.string())),
    programs: v.optional(v.array(v.string())),
    graduationYear: v.optional(v.number()),
    groupBy: v.optional(
      v.union(v.literal('cohort'), v.literal('program'), v.literal('degree_level')),
    ),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);

    // Verify access
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (universityId !== args.institutionId) {
        throw new Error('Unauthorized: Different university');
      }
    }

    // Get all cohorts for this institution
    let cohorts = await ctx.db
      .query('graduation_cohorts')
      .withIndex('by_institution', (q) => q.eq('institution_id', args.institutionId))
      .collect();

    // Filter cohorts if specific IDs provided
    if (args.cohortIds && args.cohortIds.length > 0) {
      const cohortIdSet = new Set(args.cohortIds);
      cohorts = cohorts.filter((c) => cohortIdSet.has(c._id));
    }

    // Filter by graduation year
    if (args.graduationYear) {
      cohorts = cohorts.filter((c) => c.graduation_year === args.graduationYear);
    }

    // Filter by degree level
    if (args.degreeLevels && args.degreeLevels.length > 0) {
      const degreeLevelSet = new Set(args.degreeLevels);
      cohorts = cohorts.filter((c) => c.degree_level && degreeLevelSet.has(c.degree_level));
    }

    // If no cohorts after filtering, return empty results
    if (cohorts.length === 0) {
      return {
        summary: {
          total_students: 0,
          known_outcomes: 0,
          unknown_outcomes: 0,
          partial_outcomes: 0,
          knowledge_rate: 0,
          employed_fulltime: 0,
          employed_parttime: 0,
          continuing_education: 0,
          military: 0,
          volunteer: 0,
          seeking: 0,
          not_seeking: 0,
          employment_rate: 0,
          continuing_ed_rate: 0,
        },
        breakdown: {},
        outcomes: [],
      };
    }

    // Get all outcomes for filtered cohorts
    const cohortIds = new Set(cohorts.map((c) => c._id));
    const allOutcomes = await ctx.db
      .query('graduate_outcomes')
      .withIndex('by_institution', (q) => q.eq('institution_id', args.institutionId))
      .collect();

    // Filter to only outcomes in our cohorts
    let outcomes = allOutcomes.filter((o) => cohortIds.has(o.cohort_id) && o.is_active !== false);

    // Filter by program (major) if specified
    if (args.programs && args.programs.length > 0) {
      const programSet = new Set(args.programs.map((p) => p.toLowerCase()));
      // Get majors to map major_id to name
      const majorIds = outcomes.filter((o) => o.major_id).map((o) => o.major_id!);
      const majors = await Promise.all(majorIds.map((id) => ctx.db.get(id)));
      const majorNameMap = new Map<string, string>();
      majors.forEach((m) => {
        if (m) majorNameMap.set(m._id, m.name.toLowerCase());
      });

      outcomes = outcomes.filter((o) => {
        if (o.major_id) {
          const majorName = majorNameMap.get(o.major_id);
          return majorName && programSet.has(majorName);
        }
        return false;
      });
    }

    // Helper function to compute metrics for a set of outcomes
    const computeMetrics = (
      outcomesList: typeof outcomes,
    ): {
      total_students: number;
      known_outcomes: number;
      unknown_outcomes: number;
      partial_outcomes: number;
      knowledge_rate: number;
      employed_fulltime: number;
      employed_parttime: number;
      continuing_education: number;
      military: number;
      volunteer: number;
      seeking: number;
      not_seeking: number;
      employment_rate: number;
      continuing_ed_rate: number;
    } => {
      const total = outcomesList.length;
      const known = outcomesList.filter((o) => o.outcome_status === 'known').length;
      const unknown = outcomesList.filter((o) => o.outcome_status === 'unknown').length;
      const partial = outcomesList.filter((o) => o.outcome_status === 'partial').length;

      const employed_fulltime = outcomesList.filter(
        (o) => o.outcome_type === 'employed_fulltime',
      ).length;
      const employed_parttime = outcomesList.filter(
        (o) => o.outcome_type === 'employed_parttime',
      ).length;
      const continuing_education = outcomesList.filter(
        (o) => o.outcome_type === 'continuing_education',
      ).length;
      const military = outcomesList.filter((o) => o.outcome_type === 'military').length;
      const volunteer = outcomesList.filter((o) => o.outcome_type === 'volunteer').length;
      const seeking = outcomesList.filter((o) => o.outcome_type === 'seeking').length;
      const not_seeking = outcomesList.filter((o) => o.outcome_type === 'not_seeking').length;

      const knowledge_rate = total > 0 ? Math.round((known / total) * 1000) / 10 : 0;
      const employment_rate =
        known > 0 ? Math.round(((employed_fulltime + employed_parttime) / known) * 1000) / 10 : 0;
      const continuing_ed_rate =
        known > 0 ? Math.round((continuing_education / known) * 1000) / 10 : 0;

      return {
        total_students: total,
        known_outcomes: known,
        unknown_outcomes: unknown,
        partial_outcomes: partial,
        knowledge_rate,
        employed_fulltime,
        employed_parttime,
        continuing_education,
        military,
        volunteer,
        seeking,
        not_seeking,
        employment_rate,
        continuing_ed_rate,
      };
    };

    // Compute overall summary
    const summary = computeMetrics(outcomes);

    // Compute breakdown if groupBy specified
    type BreakdownRecord = Record<string, ReturnType<typeof computeMetrics>>;
    let breakdown: BreakdownRecord = {};

    if (args.groupBy === 'cohort') {
      const cohortMap = new Map(cohorts.map((c) => [c._id, c]));
      const groups = new Map<string, typeof outcomes>();

      for (const outcome of outcomes) {
        const cohort = cohortMap.get(outcome.cohort_id);
        const key = cohort
          ? `${cohort.graduation_term} ${cohort.graduation_year}`
          : 'Unknown Cohort';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(outcome);
      }

      for (const [key, groupOutcomes] of groups) {
        breakdown[key] = computeMetrics(groupOutcomes);
      }
    } else if (args.groupBy === 'program') {
      // Get all majors for this institution
      const allMajors = await ctx.db
        .query('majors')
        .withIndex('by_university', (q) => q.eq('university_id', args.institutionId))
        .collect();
      const majorMap = new Map(allMajors.map((m) => [m._id, m.name]));

      const groups = new Map<string, typeof outcomes>();

      for (const outcome of outcomes) {
        const key = outcome.major_id
          ? majorMap.get(outcome.major_id) || 'Unknown Program'
          : 'No Program';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(outcome);
      }

      for (const [key, groupOutcomes] of groups) {
        breakdown[key] = computeMetrics(groupOutcomes);
      }
    } else if (args.groupBy === 'degree_level') {
      const cohortMap = new Map(cohorts.map((c) => [c._id, c.degree_level || 'Unknown']));
      const groups = new Map<string, typeof outcomes>();

      for (const outcome of outcomes) {
        const key = cohortMap.get(outcome.cohort_id) || 'Unknown';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(outcome);
      }

      for (const [key, groupOutcomes] of groups) {
        breakdown[key] = computeMetrics(groupOutcomes);
      }
    }

    // Get cohort names for outcome display
    const cohortMap = new Map(
      cohorts.map((c) => [c._id, `${c.graduation_term} ${c.graduation_year}`]),
    );

    // Return outcomes with cohort name included
    const outcomesWithDetails = outcomes.map((o) => ({
      ...o,
      cohort_name: cohortMap.get(o.cohort_id) || 'Unknown',
    }));

    return {
      summary,
      breakdown,
      outcomes: outcomesWithDetails,
    };
  },
});

// ============================================================================
// SNAPSHOT QUERIES & MUTATIONS
// ============================================================================

/**
 * Create a point-in-time snapshot of outcomes analytics
 */
export const createSnapshot = mutation({
  args: {
    institutionId: v.id('universities'),
    name: v.string(),
    description: v.optional(v.string()),
    filters: v.object({
      cohortIds: v.optional(v.array(v.id('graduation_cohorts'))),
      degreeLevels: v.optional(v.array(v.string())),
      programs: v.optional(v.array(v.string())),
      graduationYear: v.optional(v.number()),
    }),
    metrics: v.object({
      total_students: v.number(),
      known_outcomes: v.number(),
      unknown_outcomes: v.number(),
      partial_outcomes: v.number(),
      knowledge_rate: v.number(),
      employed_fulltime: v.number(),
      employed_parttime: v.number(),
      continuing_education: v.number(),
      military: v.number(),
      volunteer: v.number(),
      seeking: v.number(),
      not_seeking: v.number(),
      employment_rate: v.number(),
      continuing_ed_rate: v.number(),
    }),
    breakdownByProgram: v.optional(
      v.record(
        v.string(),
        v.object({
          knowledge_rate: v.number(),
          employment_rate: v.number(),
          total_students: v.number(),
        }),
      ),
    ),
    breakdownByDegree: v.optional(
      v.record(
        v.string(),
        v.object({
          knowledge_rate: v.number(),
          employment_rate: v.number(),
          total_students: v.number(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);
    assertUniversityAccess(user, args.institutionId);

    const now = Date.now();

    const snapshotId = await ctx.db.insert('outcome_snapshots', {
      institution_id: args.institutionId,
      name: args.name,
      description: args.description,
      snapshot_date: now,
      filters: {
        cohort_ids: args.filters.cohortIds,
        degree_levels: args.filters.degreeLevels,
        programs: args.filters.programs,
        graduation_year: args.filters.graduationYear,
      },
      metrics: args.metrics,
      breakdown_by_program: args.breakdownByProgram,
      breakdown_by_degree: args.breakdownByDegree,
      created_by: user._id,
      created_at: now,
    });

    return snapshotId;
  },
});

/**
 * List all snapshots for an institution
 */
export const listSnapshots = query({
  args: {
    institutionId: v.id('universities'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);

    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (universityId !== args.institutionId) {
        throw new Error('Unauthorized: Different university');
      }
    }

    const snapshots = await ctx.db
      .query('outcome_snapshots')
      .withIndex('by_institution', (q) => q.eq('institution_id', args.institutionId))
      .order('desc')
      .collect();

    // Get creator names
    const creatorIds = [...new Set(snapshots.map((s) => s.created_by))];
    const creators = await Promise.all(creatorIds.map((id) => ctx.db.get(id)));
    const creatorMap = new Map(creators.filter(Boolean).map((c) => [c!._id, c!.name || 'Unknown']));

    return snapshots.map((s) => ({
      ...s,
      created_by_name: creatorMap.get(s.created_by) || 'Unknown',
    }));
  },
});

/**
 * Get a single snapshot by ID
 */
export const getSnapshot = query({
  args: {
    snapshotId: v.id('outcome_snapshots'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);

    const snapshot = await ctx.db.get(args.snapshotId);
    if (!snapshot) {
      throw new Error('Snapshot not found');
    }

    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (snapshot.institution_id !== universityId) {
        throw new Error('Unauthorized: Snapshot is not in your university');
      }
    }

    // Get creator name
    const creator = await ctx.db.get(snapshot.created_by);

    return {
      ...snapshot,
      created_by_name: creator?.name || 'Unknown',
    };
  },
});

/**
 * Delete a snapshot
 */
export const deleteSnapshot = mutation({
  args: {
    snapshotId: v.id('outcome_snapshots'),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    const snapshot = await ctx.db.get(args.snapshotId);
    if (!snapshot) {
      throw new Error('Snapshot not found');
    }

    assertUniversityAccess(user, snapshot.institution_id);

    await ctx.db.delete(args.snapshotId);
    return { success: true };
  },
});
