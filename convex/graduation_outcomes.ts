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

    const employedCount = knownOutcomes.filter(
      (o) => o.outcome_type === 'employed_fulltime' || o.outcome_type === 'employed_parttime',
    ).length;

    const continuingEdCount = knownOutcomes.filter(
      (o) => o.outcome_type === 'continuing_education',
    ).length;

    // Calculate salary statistics from employed outcomes with salary data
    const salaries = knownOutcomes
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
