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
// SHARED VALIDATION
// ============================================================================

/**
 * Centralized validation for outcome data fields.
 * Enforces salary constraints and PII string length limits.
 * Used by createOutcome, updateOutcome, bulkImportOutcomes, upsertOutcome, bulkUpsertOutcomes.
 *
 * @param data - The outcome data to validate
 * @param rowIndex - Optional row index for bulk operations (for error messages)
 * @throws Error if validation fails
 */
function validateOutcomeData(
  data: {
    salary?: number;
    studentName?: string;
    studentEmail?: string;
    employerName?: string;
    jobTitle?: string;
    notes?: string;
  },
  rowIndex?: number,
): void {
  const rowPrefix = rowIndex !== undefined ? `Row ${rowIndex + 1}: ` : '';

  // Validation: Salary must be non-negative (OUT-H1)
  if (data.salary !== undefined && data.salary < 0) {
    throw new Error(`${rowPrefix}Salary must be a non-negative number`);
  }

  // Validation: PII string length limits (OUT-H2)
  if (data.studentName !== undefined && data.studentName.length > 255) {
    throw new Error(`${rowPrefix}Student name must be 255 characters or less`);
  }
  if (data.studentEmail !== undefined && data.studentEmail.length > 254) {
    throw new Error(`${rowPrefix}Student email must be 254 characters or less`);
  }
  if (data.employerName !== undefined && data.employerName.length > 255) {
    throw new Error(`${rowPrefix}Employer name must be 255 characters or less`);
  }
  if (data.jobTitle !== undefined && data.jobTitle.length > 255) {
    throw new Error(`${rowPrefix}Job title must be 255 characters or less`);
  }
  if (data.notes !== undefined && data.notes.length > 2000) {
    throw new Error(`${rowPrefix}Notes must be 2000 characters or less`);
  }
}

/**
 * Calculate days from graduation to employment start.
 * Used for the NACE "Time to Employment" metric.
 *
 * @param cohort - The graduation cohort (contains graduation term/year)
 * @param startDate - The employment start date (timestamp)
 * @returns Number of days from graduation to employment, or undefined if not calculable
 */
function calculateDaysToEmployment(
  cohort: { graduation_term: string; graduation_year: number },
  startDate: number | undefined,
): number | undefined {
  if (!startDate) return undefined;

  // Approximate graduation date based on term
  // Spring: May 15, Summer: August 15, Fall: December 15, Winter: January 15
  const termDates: Record<string, { month: number; day: number }> = {
    spring: { month: 4, day: 15 }, // May 15 (0-indexed months)
    summer: { month: 7, day: 15 }, // August 15
    fall: { month: 11, day: 15 }, // December 15
    winter: { month: 0, day: 15 }, // January 15 (of the next year)
  };

  const termDate = termDates[cohort.graduation_term];
  if (!termDate) return undefined;

  // For winter term, the graduation year is actually the next calendar year
  const gradYear =
    cohort.graduation_term === 'winter' ? cohort.graduation_year + 1 : cohort.graduation_year;

  const gradDate = new Date(gradYear, termDate.month, termDate.day);
  const employmentDate = new Date(startDate);

  // Calculate difference in days
  const diffMs = employmentDate.getTime() - gradDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  // Return signed value: negative means employment started before graduation
  return diffDays;
}

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
// FIRST DESTINATION SURVEY (FDS) DISTRIBUTION
// ============================================================================

/**
 * Generate a unique survey token for a graduate outcome
 */
function generateSurveyToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Launch First Destination Survey for a cohort
 * Prepares all outcome records with survey tokens for distribution
 * Requires university_admin role
 */
export const launchFirstDestinationSurvey = mutation({
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

    // Validate cohort status
    if (cohort.survey_launched_at) {
      throw new Error('Survey has already been launched for this cohort');
    }

    if (cohort.status === 'finalized' || cohort.status === 'submitted') {
      throw new Error('Cannot launch survey for finalized or submitted cohort');
    }

    const now = Date.now();

    // Get all outcome records for this cohort
    const outcomes = await ctx.db
      .query('graduate_outcomes')
      .withIndex('by_cohort', (q) => q.eq('cohort_id', args.cohortId))
      .collect();

    // Prepare each outcome record with a survey token
    let preparedCount = 0;
    let skippedCount = 0;

    for (const outcome of outcomes) {
      // Skip if outcome already has known status (data from other sources)
      if (outcome.outcome_status === 'known') {
        skippedCount++;
        continue;
      }

      // Skip if no email to send survey to
      if (!outcome.student_email && !outcome.student_id) {
        skippedCount++;
        continue;
      }

      // Generate unique survey token
      const surveyToken = generateSurveyToken();

      await ctx.db.patch(outcome._id, {
        survey_token: surveyToken,
        survey_response_status: 'pending',
        survey_sent_at: now,
        survey_reminder_count: 0,
        updated_at: now,
      });

      preparedCount++;
    }

    // Update cohort status
    await ctx.db.patch(args.cohortId, {
      status: 'collecting',
      survey_launched_at: now,
      reminder_count: 0,
      updated_at: now,
    });

    return {
      cohortId: args.cohortId,
      totalOutcomes: outcomes.length,
      preparedForSurvey: preparedCount,
      skipped: skippedCount,
      launchedAt: now,
    };
  },
});

/**
 * Get survey distribution status for a cohort
 * Returns counts of survey responses by status
 */
export const getSurveyDistributionStatus = query({
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

    const outcomes = await ctx.db
      .query('graduate_outcomes')
      .withIndex('by_cohort', (q) => q.eq('cohort_id', args.cohortId))
      .collect();

    // Count by survey response status
    const surveyStats = {
      pending: 0,
      started: 0,
      completed: 0,
      optedOut: 0,
      notSent: 0, // No survey_sent_at
      alreadyKnown: 0, // Known from other sources before survey
    };

    for (const outcome of outcomes) {
      if (!outcome.survey_sent_at) {
        if (outcome.outcome_status === 'known') {
          surveyStats.alreadyKnown++;
        } else {
          surveyStats.notSent++;
        }
      } else {
        switch (outcome.survey_response_status) {
          case 'pending':
            surveyStats.pending++;
            break;
          case 'started':
            surveyStats.started++;
            break;
          case 'completed':
            surveyStats.completed++;
            break;
          case 'opted_out':
            surveyStats.optedOut++;
            break;
          default:
            surveyStats.pending++;
        }
      }
    }

    const totalSurveySent = outcomes.filter((o) => o.survey_sent_at).length;
    const responseRate =
      totalSurveySent > 0
        ? Math.round(((surveyStats.completed + surveyStats.started) / totalSurveySent) * 100)
        : 0;

    return {
      cohort: {
        id: cohort._id,
        term: cohort.graduation_term,
        year: cohort.graduation_year,
        status: cohort.status,
        surveyLaunchedAt: cohort.survey_launched_at,
        surveyClosedAt: cohort.survey_closed_at,
        lastReminderAt: cohort.last_reminder_at,
        reminderCount: cohort.reminder_count ?? 0,
      },
      totalOutcomes: outcomes.length,
      surveyStats,
      responseRate,
      knowledgeRate: cohort.knowledge_rate ?? 0,
    };
  },
});

/**
 * Send survey reminders for a cohort
 * Updates all pending outcomes with reminder tracking
 * Requires university_admin role
 */
export const sendSurveyReminders = mutation({
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

    if (!cohort.survey_launched_at) {
      throw new Error('Survey has not been launched for this cohort');
    }

    if (cohort.status === 'finalized' || cohort.status === 'submitted') {
      throw new Error('Cannot send reminders for finalized or submitted cohort');
    }

    const now = Date.now();

    // Get pending outcomes
    const outcomes = await ctx.db
      .query('graduate_outcomes')
      .withIndex('by_cohort', (q) => q.eq('cohort_id', args.cohortId))
      .collect();

    const pendingOutcomes = outcomes.filter(
      (o) => o.survey_sent_at && o.survey_response_status === 'pending',
    );

    // Update reminder tracking for each pending outcome
    for (const outcome of pendingOutcomes) {
      await ctx.db.patch(outcome._id, {
        survey_last_reminder_at: now,
        survey_reminder_count: (outcome.survey_reminder_count ?? 0) + 1,
        updated_at: now,
      });
    }

    // Update cohort reminder tracking
    await ctx.db.patch(args.cohortId, {
      last_reminder_at: now,
      reminder_count: (cohort.reminder_count ?? 0) + 1,
      updated_at: now,
    });

    return {
      cohortId: args.cohortId,
      remindersSent: pendingOutcomes.length,
      reminderNumber: (cohort.reminder_count ?? 0) + 1,
      sentAt: now,
    };
  },
});

/**
 * Record a survey response for an outcome
 * Called when a graduate submits their FDS survey
 */
export const recordSurveyResponse = mutation({
  args: {
    surveyToken: v.string(),
    responseStatus: v.union(v.literal('started'), v.literal('completed'), v.literal('opted_out')),
    // NACE FDS fields (all optional, filled as student progresses)
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
    salary: v.optional(v.number()),
    startDate: v.optional(v.number()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    country: v.optional(v.string()),
    isRemote: v.optional(v.boolean()),
    isMajorRelated: v.optional(v.boolean()),
    gradSchoolName: v.optional(v.string()),
    gradSchoolProgram: v.optional(v.string()),
    gradSchoolDegree: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Find outcome by survey token (no auth required - token is the auth)
    const outcomes = await ctx.db
      .query('graduate_outcomes')
      .filter((q) => q.eq(q.field('survey_token'), args.surveyToken))
      .collect();

    if (outcomes.length === 0) {
      throw new Error('Invalid survey token');
    }

    const outcome = outcomes[0];
    const now = Date.now();

    // Build update object
    const updates: Record<string, unknown> = {
      survey_response_status: args.responseStatus,
      updated_at: now,
    };

    if (args.responseStatus === 'completed' || args.responseStatus === 'started') {
      updates.survey_responded_at = now;
    }

    // Update outcome status based on response
    if (args.responseStatus === 'completed') {
      updates.outcome_status = 'known';
      updates.data_source = 'survey';
    } else if (args.responseStatus === 'started') {
      updates.outcome_status = 'partial';
      updates.data_source = 'survey';
    }

    // Update NACE fields if provided
    if (args.outcomeType !== undefined) updates.outcome_type = args.outcomeType;
    if (args.employerName !== undefined) updates.employer_name = args.employerName;
    if (args.jobTitle !== undefined) updates.job_title = args.jobTitle;
    if (args.jobFunction !== undefined) updates.job_function = args.jobFunction;
    if (args.industry !== undefined) updates.industry = args.industry;
    if (args.salary !== undefined) updates.salary = args.salary;
    if (args.startDate !== undefined) updates.start_date = args.startDate;
    if (args.city !== undefined) updates.city = args.city;
    if (args.state !== undefined) updates.state = args.state;
    if (args.country !== undefined) updates.country = args.country;
    if (args.isRemote !== undefined) updates.is_remote = args.isRemote;
    if (args.isMajorRelated !== undefined) updates.is_major_related = args.isMajorRelated;
    if (args.gradSchoolName !== undefined) updates.grad_school_name = args.gradSchoolName;
    if (args.gradSchoolProgram !== undefined) updates.grad_school_program = args.gradSchoolProgram;
    if (args.gradSchoolDegree !== undefined) updates.grad_school_degree = args.gradSchoolDegree;

    // Calculate days to employment if we have start date and cohort graduation date
    if (args.startDate) {
      const cohort = await ctx.db.get(outcome.cohort_id);
      if (cohort) {
        updates.days_to_employment = calculateDaysToEmployment(cohort, args.startDate);
      }
    }

    await ctx.db.patch(outcome._id, updates);

    return {
      outcomeId: outcome._id,
      responseStatus: args.responseStatus,
      recordedAt: now,
    };
  },
});

/**
 * Get outcomes pending survey response (for reminder emails)
 * Returns outcomes that have been sent surveys but haven't responded
 */
export const getPendingSurveyOutcomes = query({
  args: {
    cohortId: v.id('graduation_cohorts'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);
    const limit = args.limit ?? 100;

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
      .withIndex('by_cohort', (q) => q.eq('cohort_id', args.cohortId))
      .collect();

    // Filter to pending outcomes with email
    const pendingOutcomes = outcomes
      .filter(
        (o) =>
          o.survey_sent_at &&
          o.survey_response_status === 'pending' &&
          (o.student_email || o.student_id),
      )
      .slice(0, limit);

    // Enrich with student info if student_id is available
    const enrichedOutcomes = await Promise.all(
      pendingOutcomes.map(async (o) => {
        let email = o.student_email;
        let name = o.student_name;

        if (o.student_id) {
          const student = await ctx.db.get(o.student_id);
          if (student) {
            email = email || student.email;
            name = name || student.name;
          }
        }

        return {
          id: o._id,
          email,
          name,
          surveyToken: o.survey_token,
          surveyReminderCount: o.survey_reminder_count ?? 0,
          lastReminderAt: o.survey_last_reminder_at,
        };
      }),
    );

    return {
      outcomes: enrichedOutcomes.filter((o) => o.email), // Only return those with valid email
      cohort: {
        id: cohort._id,
        term: cohort.graduation_term,
        year: cohort.graduation_year,
        reminderCount: cohort.reminder_count ?? 0,
      },
    };
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

    // Centralized validation for salary and PII fields
    validateOutcomeData({
      salary: args.salary,
      studentName: args.studentName,
      studentEmail: args.studentEmail,
      employerName: args.employerName,
      jobTitle: args.jobTitle,
      notes: args.notes,
    });

    const now = Date.now();

    // Calculate days to employment if start date is provided
    const daysToEmployment = calculateDaysToEmployment(cohort, args.startDate);

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
      days_to_employment: daysToEmployment,
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

    // Centralized validation for salary and PII fields
    validateOutcomeData({
      salary: args.salary,
      employerName: args.employerName,
      jobTitle: args.jobTitle,
      notes: args.notes,
    });

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
    if (args.startDate !== undefined) {
      updates.start_date = args.startDate;
      // Recalculate days to employment when start date changes
      const cohort = await ctx.db.get(outcome.cohort_id);
      if (cohort) {
        updates.days_to_employment = calculateDaysToEmployment(cohort, args.startDate);
      }
    }
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

    // Validate all outcomes before inserting any
    for (let i = 0; i < args.outcomes.length; i++) {
      const outcomeData = args.outcomes[i];
      validateOutcomeData(
        {
          salary: outcomeData.salary,
          studentName: outcomeData.studentName,
          studentEmail: outcomeData.studentEmail,
          employerName: outcomeData.employerName,
          jobTitle: outcomeData.jobTitle,
        },
        i,
      );
    }

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

    // Centralized validation for salary and PII fields
    validateOutcomeData({
      salary: args.salary,
      studentName: args.studentName,
      studentEmail: args.studentEmail,
      employerName: args.employerName,
      jobTitle: args.jobTitle,
      notes: args.notes,
    });

    // Validate studentId belongs to the same institution and is actually a student
    if (args.studentId) {
      const student = await ctx.db.get(args.studentId);
      if (!student) {
        throw new Error('Student not found');
      }
      // Check student role (includes legacy "user" role with university_id for backward compatibility)
      const isStudent =
        student.role === 'student' || (student.role === 'user' && student.university_id);
      if (!isStudent) {
        throw new Error('Outcome can only be linked to a user with student role');
      }
      if (student.university_id !== cohort.institution_id) {
        throw new Error('Student does not belong to the cohort institution');
      }
    }

    // Validate majorId belongs to the same institution
    if (args.majorId) {
      const major = await ctx.db.get(args.majorId);
      if (!major) {
        throw new Error('Major not found');
      }
      if (major.university_id !== cohort.institution_id) {
        throw new Error('Major does not belong to the cohort institution');
      }
    }

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
      // Guard against cross-cohort collision: external_outcome_id must belong to same cohort
      if (existing.cohort_id !== args.cohortId) {
        throw new Error(
          `external_outcome_id "${args.externalOutcomeId}" is already used by a different cohort`,
        );
      }

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

      // Update existing record - reactivate if previously archived
      const updates: Record<string, unknown> = { updated_at: now, is_active: true };

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

    // Guard against oversized batches to avoid Convex execution timeouts
    // Each row does ~3 database operations (major lookup, existing check, insert/patch)
    const MAX_BATCH_SIZE = 200;
    if (args.outcomes.length > MAX_BATCH_SIZE) {
      throw new Error(
        `Cannot import more than ${MAX_BATCH_SIZE} outcomes per call. ` +
          `Split your import into smaller batches.`,
      );
    }

    const cohort = await ctx.db.get(args.cohortId);
    if (!cohort) {
      throw new Error('Cohort not found');
    }

    assertUniversityAccess(user, cohort.institution_id);

    // Validate all outcomes before processing any
    for (let i = 0; i < args.outcomes.length; i++) {
      const outcomeData = args.outcomes[i];
      validateOutcomeData(
        {
          salary: outcomeData.salary,
          studentName: outcomeData.studentName,
          studentEmail: outcomeData.studentEmail,
          employerName: outcomeData.employerName,
          jobTitle: outcomeData.jobTitle,
        },
        i,
      );
    }

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
        // Reject position-based external IDs (e.g., "cohortId_row_0")
        // These are unstable - re-importing a modified file would create duplicates or miss updates.
        // Rows must have either external_student_id or email for reliable deduplication.
        if (/_row_\d+$/.test(outcomeData.externalOutcomeId)) {
          results.errors.push({
            row: i + 1,
            externalId: outcomeData.externalOutcomeId,
            error:
              'Row is missing external_student_id and email - cannot import without stable identifier',
          });
          continue;
        }

        // Validate majorId belongs to the same institution
        if (outcomeData.majorId) {
          const major = await ctx.db.get(outcomeData.majorId);
          if (!major) {
            results.errors.push({
              row: i + 1,
              externalId: outcomeData.externalOutcomeId,
              error: 'Major not found',
            });
            continue;
          }
          if (major.university_id !== cohort.institution_id) {
            results.errors.push({
              row: i + 1,
              externalId: outcomeData.externalOutcomeId,
              error: 'Major does not belong to the cohort institution',
            });
            continue;
          }
        }

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
          // Guard against cross-cohort collision: external_outcome_id must belong to same cohort
          if (existing.cohort_id !== args.cohortId) {
            results.errors.push({
              row: i + 1,
              externalId: outcomeData.externalOutcomeId,
              error: `external_outcome_id is already used by a different cohort`,
            });
            continue;
          }

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
            // Always update required fields and timestamp - reactivate if previously archived
            outcome_status: outcomeData.outcomeStatus,
            updated_at: now,
            is_active: true,
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

    // Super admins can access any cohort; others require university_admin role
    if (sessionCtx.role !== 'super_admin') {
      const admin = await requireUniversityAdmin(ctx);
      assertUniversityAccess(admin, cohort.institution_id);
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

      // Mark invalid rows as skip to keep willCreate/willUpdate counts accurate
      if (validationErrors.length > 0) {
        action = 'skip';
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
        rowIndex: i + 1,
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
      // Count rows specifically missing both external_student_id and email
      // These would require position-based fallback IDs which are risky for re-imports
      missingIdentifiers: preview.filter((p) =>
        p.validationErrors.includes('Either external_student_id or student_email is required'),
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
    // Pagination for outcomes list (summary/breakdown always include all data)
    outcomeLimit: v.optional(v.number()),
    outcomeOffset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);

    // Verify access - require university_admin for aggregated analytics
    if (sessionCtx.role !== 'super_admin') {
      const admin = await requireUniversityAdmin(ctx);
      assertUniversityAccess(admin, args.institutionId);
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

    // If no cohorts after filtering, return empty results with consistent shape
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
          career_outcomes_rate: 0,
        },
        breakdown: {},
        outcomes: [],
        totalOutcomes: 0,
        hasMoreOutcomes: false,
      };
    }

    // Get outcomes for filtered cohorts using by_cohort index for efficiency
    const cohortIds = cohorts.map((c) => c._id);
    const outcomesByCohort = await Promise.all(
      cohortIds.map((cohortId) =>
        ctx.db
          .query('graduate_outcomes')
          .withIndex('by_cohort', (q) => q.eq('cohort_id', cohortId))
          .filter((q) => q.neq(q.field('is_active'), false))
          .collect(),
      ),
    );
    let outcomes = outcomesByCohort.flat();

    // Filter by program (major) if specified
    if (args.programs && args.programs.length > 0) {
      const programSet = new Set(args.programs.map((p) => p.toLowerCase()));
      // Get unique majors to map major_id to name (deduplicate to avoid redundant fetches)
      const uniqueMajorIds = [
        ...new Set(outcomes.filter((o) => o.major_id).map((o) => o.major_id!)),
      ];
      const majors = await Promise.all(uniqueMajorIds.map((id) => ctx.db.get(id)));
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
      career_outcomes_rate: number;
    } => {
      const total = outcomesList.length;
      // Filter to known outcomes for type counts - unknown/partial may have stale outcome_type
      const knownOutcomes = outcomesList.filter((o) => o.outcome_status === 'known');
      const known = knownOutcomes.length;
      const unknown = outcomesList.filter((o) => o.outcome_status === 'unknown').length;
      const partial = outcomesList.filter((o) => o.outcome_status === 'partial').length;

      // Count outcome types from known outcomes only (aligns with finalizeCohort logic)
      const employed_fulltime = knownOutcomes.filter(
        (o) => o.outcome_type === 'employed_fulltime',
      ).length;
      const employed_parttime = knownOutcomes.filter(
        (o) => o.outcome_type === 'employed_parttime',
      ).length;
      const continuing_education = knownOutcomes.filter(
        (o) => o.outcome_type === 'continuing_education',
      ).length;
      const military = knownOutcomes.filter((o) => o.outcome_type === 'military').length;
      const volunteer = knownOutcomes.filter((o) => o.outcome_type === 'volunteer').length;
      const seeking = knownOutcomes.filter((o) => o.outcome_type === 'seeking').length;
      const not_seeking = knownOutcomes.filter((o) => o.outcome_type === 'not_seeking').length;

      // Use integer precision to align with finalizeCohort calculations
      const knowledge_rate = total > 0 ? Math.round((known / total) * 100) : 0;
      const employment_rate =
        known > 0 ? Math.round(((employed_fulltime + employed_parttime) / known) * 100) : 0;
      const continuing_ed_rate = known > 0 ? Math.round((continuing_education / known) * 100) : 0;

      // NACE Career Outcomes Rate = (employed + education + military + volunteer) / (known - not_seeking)
      // This is the primary metric Career Services Directors report
      const careerOutcomesDenominator = known - not_seeking;
      const careerOutcomesNumerator =
        employed_fulltime + employed_parttime + continuing_education + military + volunteer;
      const career_outcomes_rate =
        careerOutcomesDenominator > 0
          ? Math.round((careerOutcomesNumerator / careerOutcomesDenominator) * 100)
          : 0;

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
        career_outcomes_rate,
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
          ? `${cohort.graduation_term} ${cohort.graduation_year}${
              cohort.degree_level ? ` (${cohort.degree_level})` : ''
            }`
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

    // Apply pagination to outcomes list for dashboard performance
    // Summary and breakdown always reflect all data for accurate KPIs
    const totalOutcomes = outcomesWithDetails.length;
    const limit = args.outcomeLimit ?? 1000; // Default limit for dashboard views
    const offset = args.outcomeOffset ?? 0;
    const paginatedOutcomes = outcomesWithDetails.slice(offset, offset + limit);

    return {
      summary,
      breakdown,
      outcomes: paginatedOutcomes,
      totalOutcomes,
      hasMoreOutcomes: offset + paginatedOutcomes.length < totalOutcomes,
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
      career_outcomes_rate: v.optional(v.number()),
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

    // Require university_admin to match createSnapshot mutation access control
    if (sessionCtx.role !== 'super_admin') {
      const admin = await requireUniversityAdmin(ctx);
      assertUniversityAccess(admin, args.institutionId);
    }

    const snapshots = await ctx.db
      .query('outcome_snapshots')
      .withIndex('by_institution_date', (q) => q.eq('institution_id', args.institutionId))
      .filter((q) => q.neq(q.field('is_active'), false)) // Exclude soft-deleted snapshots
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

    // Check if snapshot is soft deleted
    if (snapshot.is_active === false) {
      throw new Error('Snapshot not found'); // Don't reveal it was deleted
    }

    // Require university_admin to match createSnapshot mutation access control
    if (sessionCtx.role !== 'super_admin') {
      const admin = await requireUniversityAdmin(ctx);
      assertUniversityAccess(admin, snapshot.institution_id);
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
 * Delete a snapshot (soft delete for audit trail)
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

    // Don't allow deleting already deleted snapshots
    if (snapshot.is_active === false) {
      throw new Error('Snapshot is already deleted');
    }

    assertUniversityAccess(user, snapshot.institution_id);

    // Soft delete - preserve for audit trail
    await ctx.db.patch(args.snapshotId, {
      is_active: false,
      deleted_at: Date.now(),
      deleted_by: user._id,
    });
    return { success: true };
  },
});
