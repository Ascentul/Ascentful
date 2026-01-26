import { v } from 'convex/values';

import { internal } from './_generated/api';
import { Id, Doc } from './_generated/dataModel';
import { internalMutation, MutationCtx, query, QueryCtx } from './_generated/server';
import { getCurrentUser, requireTenant } from './advisor_auth';

/**
 * Engagement Prediction Engine
 *
 * Analyzes historical engagement patterns to predict future engagement levels
 * and identify students at risk of disengagement.
 *
 * SCORING APPROACH: Risk-Based Prediction
 * Uses a factor-based risk scoring (0-100, higher = more at risk) with:
 * - Activity trend analysis (increasing/stable/decreasing)
 * - Days since last activity
 * - Application momentum (recent applications)
 * - Active pipeline status
 * - Predicted days until at-risk status
 *
 * This differs from engagement_definitions.ts which uses a score-based evaluation
 * (0-100, higher = better) for current state based on university-defined thresholds.
 *
 * Use this module for: Predictive analytics, at-risk forecasting, trend analysis
 * Use engagement_definitions.ts for: Current engagement status evaluation
 */

interface ActivityTrend {
  weeklyActivityCounts: number[];
  trend: 'increasing' | 'stable' | 'decreasing';
  velocity: number; // rate of change
}

interface EngagementPrediction {
  current_status: 'engaged' | 'moderate' | 'at_risk';
  predicted_status: 'engaged' | 'moderate' | 'at_risk';
  confidence: number; // 0-100
  risk_score: number; // 0-100 (higher = more at risk)
  factors: {
    factor: string;
    impact: 'positive' | 'negative' | 'neutral';
    weight: number;
    description: string;
  }[];
  recommendations: string[];
  predicted_days_to_risk?: number; // days until at_risk if trend continues
}

const DEFAULT_LOOKBACK_WEEKS = 8;
const MAX_LOOKBACK_WEEKS = 52; // Maximum 1 year to prevent unbounded queries (SIG-H1)
const DEFAULT_FORECAST_WEEKS = 4;
const MAX_FORECAST_WEEKS = 12;
const PREDICTION_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const PREDICTION_BATCH_SIZE = 50;
const SUMMARY_PAGE_SIZE = 1000;

function isUniversityStudent(user: Doc<'users'>) {
  return user.role === 'student' || (user.role === 'user' && user.university_id);
}

/**
 * Calculate activity trend from weekly activity counts
 */
function calculateTrend(weeklyActivityCounts: number[]): ActivityTrend {
  if (weeklyActivityCounts.length < 2) {
    return { weeklyActivityCounts, trend: 'stable', velocity: 0 };
  }

  // Calculate linear regression slope
  const n = weeklyActivityCounts.length;
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += weeklyActivityCounts[i];
    sumXY += i * weeklyActivityCounts[i];
    sumX2 += i * i;
  }

  const denominator = n * sumX2 - sumX * sumX;
  const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
  const avgActivity = sumY / n;

  // Normalize velocity as percentage change per week
  const velocity = avgActivity > 0 ? (slope / avgActivity) * 100 : 0;

  let trend: 'increasing' | 'stable' | 'decreasing';
  if (velocity > 10) {
    trend = 'increasing';
  } else if (velocity < -10) {
    trend = 'decreasing';
  } else {
    trend = 'stable';
  }

  return { weeklyActivityCounts, trend, velocity };
}

/**
 * Prepared input data for the shared scoring algorithm.
 * Both batch and single-student functions prepare this before scoring.
 */
interface ScoringInputData {
  weeklyActivityCounts: number[];
  activityEventCount: number;
  applications: Doc<'applications'>[];
  activeApplications: Doc<'applications'>[];
  recentApplications: Doc<'applications'>[];
  daysSinceActivity: number;
  trend: ActivityTrend;
}

/**
 * Shared scoring algorithm for engagement prediction.
 * Computes risk factors, scores, status, and recommendations from prepared data.
 *
 * This function contains the core prediction logic used by:
 * - computePredictionForStudent (single student with DB queries)
 */
function computePredictionFromScoringData(data: ScoringInputData): EngagementPrediction {
  const {
    weeklyActivityCounts,
    activityEventCount,
    applications,
    activeApplications,
    recentApplications,
    daysSinceActivity,
    trend,
  } = data;

  // Determine current status based on activity
  const recentWeekActivity = weeklyActivityCounts[weeklyActivityCounts.length - 1] || 0;
  const avgActivity =
    weeklyActivityCounts.length > 0
      ? weeklyActivityCounts.reduce((a, b) => a + b, 0) / weeklyActivityCounts.length
      : 0;

  let currentStatus: 'engaged' | 'moderate' | 'at_risk';
  if (daysSinceActivity > 14 || recentWeekActivity === 0) {
    currentStatus = 'at_risk';
  } else if (recentWeekActivity >= avgActivity && daysSinceActivity <= 3) {
    currentStatus = 'engaged';
  } else {
    currentStatus = 'moderate';
  }

  // Build risk factors
  const factors: EngagementPrediction['factors'] = [];

  // Factor 1: Activity trend
  if (trend.trend === 'decreasing') {
    factors.push({
      factor: 'Activity Trend',
      impact: 'negative',
      weight: 25,
      description: `Activity has decreased by ${Math.abs(trend.velocity).toFixed(0)}% per week`,
    });
  } else if (trend.trend === 'increasing') {
    factors.push({
      factor: 'Activity Trend',
      impact: 'positive',
      weight: 20,
      description: `Activity has increased by ${trend.velocity.toFixed(0)}% per week`,
    });
  } else {
    factors.push({
      factor: 'Activity Trend',
      impact: 'neutral',
      weight: 5,
      description: 'Activity level is stable',
    });
  }

  // Factor 2: Days since last activity
  if (daysSinceActivity > 14) {
    factors.push({
      factor: 'Recent Activity',
      impact: 'negative',
      weight: 30,
      description: `No activity in ${daysSinceActivity} days`,
    });
  } else if (daysSinceActivity > 7) {
    factors.push({
      factor: 'Recent Activity',
      impact: 'negative',
      weight: 15,
      description: `Last active ${daysSinceActivity} days ago`,
    });
  } else if (daysSinceActivity <= 2) {
    factors.push({
      factor: 'Recent Activity',
      impact: 'positive',
      weight: 15,
      description: 'Recently active',
    });
  }
  // Days 3-7: No factor added (neutral range)

  // Factor 3: Application momentum
  if (recentApplications.length === 0 && applications.length > 0) {
    factors.push({
      factor: 'Application Momentum',
      impact: 'negative',
      weight: 20,
      description: 'No new applications in past 8 weeks',
    });
  } else if (recentApplications.length >= 3) {
    factors.push({
      factor: 'Application Momentum',
      impact: 'positive',
      weight: 15,
      description: `${recentApplications.length} new applications recently`,
    });
  }

  // Factor 4: Active pipeline
  if (activeApplications.length === 0 && applications.length > 0) {
    factors.push({
      factor: 'Active Pipeline',
      impact: 'negative',
      weight: 15,
      description: 'No active applications in pipeline',
    });
  } else if (activeApplications.length >= 5) {
    factors.push({
      factor: 'Active Pipeline',
      impact: 'positive',
      weight: 10,
      description: `${activeApplications.length} active applications`,
    });
  }

  // Calculate risk score
  // Base risk of 30 represents a neutral starting point.
  // Negative factors add their full weight; positive factors reduce by 70% of weight.
  // This asymmetry intentionally makes negative signals more impactful, reflecting
  // that disengagement warning signs require more attention than positive indicators.
  let riskScore = 30;
  for (const factor of factors) {
    if (factor.impact === 'negative') {
      riskScore += factor.weight;
    } else if (factor.impact === 'positive') {
      riskScore -= factor.weight * 0.7;
    }
  }
  riskScore = Math.max(0, Math.min(100, riskScore));

  // Predict future status
  let predictedStatus: 'engaged' | 'moderate' | 'at_risk';
  if (riskScore >= 60) {
    predictedStatus = 'at_risk';
  } else if (riskScore >= 35) {
    predictedStatus = 'moderate';
  } else {
    predictedStatus = 'engaged';
  }

  // Adjust based on trend
  if (trend.trend === 'decreasing' && currentStatus === 'engaged') {
    predictedStatus = 'moderate';
  }
  if (trend.trend === 'increasing' && currentStatus === 'at_risk') {
    predictedStatus = 'moderate';
  }

  // Calculate confidence based on data availability
  let confidence = 60; // Base confidence
  if (activityEventCount > 20) confidence += 15;
  if (activityEventCount > 50) confidence += 10;
  if (weeklyActivityCounts.filter((c) => c > 0).length >= 4) confidence += 10;
  if (applications.length > 0) confidence += 5;
  confidence = Math.min(95, confidence);

  // Calculate days to risk if decreasing
  let predictedDaysToRisk: number | undefined;
  if (trend.trend === 'decreasing' && currentStatus !== 'at_risk' && trend.velocity !== 0) {
    // Rough estimate based on velocity
    const weeksToRisk = Math.abs(50 / trend.velocity);
    predictedDaysToRisk = Math.max(7, Math.round(weeksToRisk * 7));
  }

  // Generate recommendations
  const recommendations: string[] = [];
  if (daysSinceActivity > 7) {
    recommendations.push('Schedule a check-in to understand any blockers');
  }
  if (trend.trend === 'decreasing') {
    recommendations.push('Review engagement strategy and career goals');
  }
  if (activeApplications.length === 0 && applications.length > 0) {
    recommendations.push('Discuss application pipeline and next steps');
  }
  if (recentApplications.length === 0) {
    recommendations.push('Help identify new job opportunities to apply for');
  }
  if (riskScore > 50) {
    recommendations.push('Prioritize outreach before student becomes fully disengaged');
  }

  return {
    current_status: currentStatus,
    predicted_status: predictedStatus,
    confidence,
    risk_score: Math.round(riskScore),
    factors,
    recommendations,
    predicted_days_to_risk: predictedDaysToRisk,
  };
}

/**
 * Prepare scoring data from a student and their activity/application data.
 * Shared helper to transform raw data into the format needed for scoring.
 */
function prepareScoringData(
  student: Doc<'users'>,
  activityEvents: Doc<'activity_events'>[],
  applications: Doc<'applications'>[],
  lookbackWeeks: number,
): ScoringInputData {
  const now = Date.now();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const lookbackMs = lookbackWeeks * msPerWeek;
  const startTime = now - lookbackMs;

  // Filter events within lookback period
  const filteredEvents = activityEvents.filter((e) => e.occurred_at >= startTime);

  // Group by week
  const weeklyActivityCounts: number[] = Array(lookbackWeeks).fill(0);
  for (const event of filteredEvents) {
    const weekIndex = Math.floor((now - event.occurred_at) / msPerWeek);
    if (weekIndex >= 0 && weekIndex < lookbackWeeks) {
      weeklyActivityCounts[lookbackWeeks - 1 - weekIndex]++; // Oldest first
    }
  }

  const trend = calculateTrend(weeklyActivityCounts);

  // Use stage (primary field) with fallback to legacy status
  const terminalStages = new Set(['rejected', 'withdrawn', 'accepted', 'archived']);
  const activeApplications = applications.filter((app) => {
    const stageOrStatus = (app.stage ?? app.status ?? '').toLowerCase();
    return !terminalStages.has(stageOrStatus);
  });
  const recentApplications = applications.filter(
    (app) => app.created_at && app.created_at > startTime,
  );

  // Use most recent activity event for accurate days-since-activity calculation
  // Falls back to last_login_at or _creationTime only when no events exist
  const lastEventAt =
    activityEvents.length > 0
      ? activityEvents.reduce(
          (max, e) => (e.occurred_at > max ? e.occurred_at : max),
          activityEvents[0].occurred_at,
        )
      : undefined;
  const lastActivityAt = lastEventAt ?? student.last_login_at ?? student._creationTime;
  const daysSinceActivity = Math.floor((now - lastActivityAt) / (24 * 60 * 60 * 1000));

  return {
    weeklyActivityCounts,
    activityEventCount: filteredEvents.length,
    applications,
    activeApplications,
    recentApplications,
    daysSinceActivity,
    trend,
  };
}

/**
 * Internal helper to compute prediction for a single student (makes DB queries).
 */
async function computePredictionForStudent(
  ctx: QueryCtx,
  student: Doc<'users'>,
  lookbackWeeks: number,
): Promise<EngagementPrediction | null> {
  // Fetch activity events for this student
  const activityEvents = await ctx.db
    .query('activity_events')
    .withIndex('by_user', (q) => q.eq('user_id', student._id))
    .collect();

  // Fetch applications for this student
  const applications = await ctx.db
    .query('applications')
    .withIndex('by_user', (q) => q.eq('user_id', student._id))
    .collect();

  // Prepare and compute using shared algorithm
  const scoringData = prepareScoringData(student, activityEvents, applications, lookbackWeeks);
  return computePredictionFromScoringData(scoringData);
}

function mapPredictionCacheToResponse(prediction: Doc<'engagement_prediction_cache'>) {
  return {
    student_id: prediction.student_id,
    student_name: prediction.student_name,
    student_email: prediction.student_email ?? null,
    prediction: {
      current_status: prediction.current_status,
      predicted_status: prediction.predicted_status,
      confidence: prediction.confidence,
      risk_score: prediction.risk_score,
      factors: prediction.factors,
      recommendations: prediction.recommendations,
      predicted_days_to_risk: prediction.predicted_days_to_risk ?? undefined,
    },
  };
}

async function upsertPredictionCache(
  ctx: MutationCtx,
  record: Omit<Doc<'engagement_prediction_cache'>, '_id' | '_creationTime'>,
) {
  const existing = await ctx.db
    .query('engagement_prediction_cache')
    .withIndex('by_student', (q) => q.eq('student_id', record.student_id))
    .collect();

  if (existing.length > 0) {
    await ctx.db.patch(existing[0]._id, record);
    for (const extra of existing.slice(1)) {
      await ctx.db.delete(extra._id);
    }
  } else {
    await ctx.db.insert('engagement_prediction_cache', record);
  }
}

async function upsertPredictionSummary(
  ctx: MutationCtx,
  summary: Omit<Doc<'engagement_prediction_summary'>, '_id' | '_creationTime'>,
) {
  const existing = await ctx.db
    .query('engagement_prediction_summary')
    .withIndex('by_university', (q) => q.eq('university_id', summary.university_id))
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, summary);
  } else {
    await ctx.db.insert('engagement_prediction_summary', summary);
  }
}

async function computePredictionSummaryFromCache(
  ctx: QueryCtx | MutationCtx,
  universityId: Id<'universities'>,
  weeksAhead = DEFAULT_FORECAST_WEEKS,
) {
  const forecastWeeks = Math.max(0, Math.min(weeksAhead, MAX_FORECAST_WEEKS));
  const atRiskByWeek = Array.from({ length: forecastWeeks }, () => 0);

  let total = 0;
  let predictedEngaged = 0;
  let predictedModerate = 0;
  let predictedAtRisk = 0;
  let riskSum = 0;

  let currentEngaged = 0;
  let currentModerate = 0;
  let currentAtRisk = 0;

  const highRiskStudents: Array<{
    id: Id<'users'>;
    name: string;
    risk_score: number;
    predicted_days_to_risk?: number;
  }> = [];

  const maybeTrackHighRisk = (prediction: Doc<'engagement_prediction_cache'>) => {
    if (prediction.risk_score < 70) return;

    highRiskStudents.push({
      id: prediction.student_id,
      name: prediction.student_name,
      risk_score: prediction.risk_score,
      predicted_days_to_risk: prediction.predicted_days_to_risk ?? undefined,
    });

    highRiskStudents.sort((a, b) => b.risk_score - a.risk_score);
    if (highRiskStudents.length > 10) {
      highRiskStudents.length = 10;
    }
  };

  let cursor: string | null = null;
  do {
    const page = await ctx.db
      .query('engagement_prediction_cache')
      .withIndex('by_university', (q) => q.eq('university_id', universityId))
      .paginate({ cursor, numItems: SUMMARY_PAGE_SIZE });

    for (const prediction of page.page as Doc<'engagement_prediction_cache'>[]) {
      total++;
      riskSum += prediction.risk_score;

      if (prediction.predicted_status === 'engaged') {
        predictedEngaged++;
      } else if (prediction.predicted_status === 'moderate') {
        predictedModerate++;
      } else if (prediction.predicted_status === 'at_risk') {
        predictedAtRisk++;
      }

      if (prediction.current_status === 'engaged') {
        currentEngaged++;
      } else if (prediction.current_status === 'moderate') {
        currentModerate++;
      } else if (prediction.current_status === 'at_risk') {
        currentAtRisk++;
      }

      if (
        (prediction.current_status === 'engaged' || prediction.current_status === 'moderate') &&
        prediction.predicted_days_to_risk !== undefined
      ) {
        for (let week = 1; week <= forecastWeeks; week++) {
          if (prediction.predicted_days_to_risk <= week * 7) {
            atRiskByWeek[week - 1]++;
          }
        }
      }

      maybeTrackHighRisk(prediction);
    }

    cursor = page.isDone ? null : page.continueCursor;
  } while (cursor);

  const avgRiskScore = total > 0 ? Math.round(riskSum / total) : 0;
  const currentTotal = currentEngaged + currentModerate + currentAtRisk;
  const currentState = {
    engaged: currentEngaged,
    moderate: currentModerate,
    at_risk: currentAtRisk,
  };

  const forecast: Array<{
    week: number;
    engaged: number;
    moderate: number;
    at_risk: number;
  }> = [{ week: 0, ...currentState }];

  for (let week = 1; week <= forecastWeeks; week++) {
    const willBecomeAtRisk = atRiskByWeek[week - 1] || 0;
    const projectedAtRisk = Math.min(currentTotal, currentState.at_risk + willBecomeAtRisk);
    const projectedModerate = Math.max(
      0,
      currentState.moderate - Math.floor(willBecomeAtRisk * 0.6),
    );
    const projectedEngaged = currentTotal - projectedAtRisk - projectedModerate;

    forecast.push({
      week,
      engaged: Math.max(0, projectedEngaged),
      moderate: projectedModerate,
      at_risk: projectedAtRisk,
    });
  }

  return {
    university_id: universityId,
    computed_at: Date.now(),
    total,
    engaged: predictedEngaged,
    moderate: predictedModerate,
    at_risk: predictedAtRisk,
    avg_risk_score: avgRiskScore,
    forecast,
    current_total: currentTotal,
    high_risk_students: highRiskStudents,
  };
}

export const refreshUniversityPredictionCache = internalMutation({
  args: {
    universityId: v.id('universities'),
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? PREDICTION_BATCH_SIZE;

    const page = await ctx.db
      .query('users')
      .withIndex('by_university', (q: any) => q.eq('university_id', args.universityId))
      .filter((q) => q.or(q.eq(q.field('role'), 'student'), q.eq(q.field('role'), 'user')))
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    const now = Date.now();
    for (const student of page.page as Doc<'users'>[]) {
      if (!isUniversityStudent(student)) continue;

      const prediction = await computePredictionForStudent(ctx, student, DEFAULT_LOOKBACK_WEEKS);
      if (!prediction) continue;

      await upsertPredictionCache(ctx, {
        university_id: args.universityId,
        student_id: student._id,
        student_name: student.name || 'Unknown',
        student_email: student.email ?? undefined,
        current_status: prediction.current_status,
        predicted_status: prediction.predicted_status,
        confidence: prediction.confidence,
        risk_score: prediction.risk_score,
        predicted_days_to_risk: prediction.predicted_days_to_risk,
        factors: prediction.factors,
        recommendations: prediction.recommendations,
        computed_at: now,
      });
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.engagement_prediction.refreshUniversityPredictionCache,
        {
          universityId: args.universityId,
          cursor: page.continueCursor,
          batchSize,
        },
      );
    } else {
      const summary = await computePredictionSummaryFromCache(
        ctx,
        args.universityId,
        DEFAULT_FORECAST_WEEKS,
      );
      await upsertPredictionSummary(ctx, summary);
    }

    return { processed: page.page.length, hasMore: !page.isDone };
  },
});

export const refreshEngagementPredictionCacheJob = internalMutation({
  args: {},
  handler: async (ctx) => {
    const universities = await ctx.db
      .query('universities')
      .filter((q) => q.or(q.eq(q.field('status'), 'active'), q.eq(q.field('status'), 'trial')))
      .collect();

    for (const university of universities) {
      await ctx.scheduler.runAfter(
        0,
        internal.engagement_prediction.refreshUniversityPredictionCache,
        {
          universityId: university._id,
        },
      );
    }

    return { scheduled: universities.length };
  },
});

/**
 * Predict engagement for a single student
 */
export const predictStudentEngagement = query({
  args: {
    studentId: v.id('users'),
    lookbackWeeks: v.optional(v.number()), // Default 8 weeks
  },
  handler: async (ctx, args): Promise<EngagementPrediction | null> => {
    const { studentId, lookbackWeeks = DEFAULT_LOOKBACK_WEEKS } = args;
    if (lookbackWeeks <= 0) {
      throw new Error('lookbackWeeks must be >= 1');
    }
    // Prevent unbounded lookback queries (SIG-H1)
    if (lookbackWeeks > MAX_LOOKBACK_WEEKS) {
      throw new Error(`lookbackWeeks must be <= ${MAX_LOOKBACK_WEEKS}`);
    }

    const student = await ctx.db.get(studentId);
    if (!student) return null;

    // Guard against non-student IDs - predictions only make sense for students
    if (!isUniversityStudent(student)) {
      throw new Error('Predictions are only supported for student accounts');
    }

    // Authorization: Only advisors, admins, or super_admin can access predictions
    const sessionCtx = await getCurrentUser(ctx);
    const allowedRoles = ['super_admin', 'university_admin', 'advisor'];
    if (!allowedRoles.includes(sessionCtx.role)) {
      throw new Error(
        'Unauthorized: Only administrators and advisors can access engagement predictions',
      );
    }
    if (sessionCtx.role !== 'super_admin') {
      const userUniversityId = requireTenant(sessionCtx);
      if (!student.university_id || userUniversityId !== student.university_id) {
        throw new Error('Unauthorized: Cannot access predictions for another university');
      }
    }

    const cachedPrediction =
      lookbackWeeks === DEFAULT_LOOKBACK_WEEKS
        ? await ctx.db
            .query('engagement_prediction_cache')
            .withIndex('by_student', (q) => q.eq('student_id', student._id))
            .unique()
        : null;

    if (
      cachedPrediction &&
      cachedPrediction.computed_at > Date.now() - PREDICTION_CACHE_MAX_AGE_MS
    ) {
      return {
        current_status: cachedPrediction.current_status,
        predicted_status: cachedPrediction.predicted_status,
        confidence: cachedPrediction.confidence,
        risk_score: cachedPrediction.risk_score,
        factors: cachedPrediction.factors,
        recommendations: cachedPrediction.recommendations,
        predicted_days_to_risk: cachedPrediction.predicted_days_to_risk ?? undefined,
      };
    }

    return computePredictionForStudent(ctx, student, lookbackWeeks);
  },
});

/**
 * Get engagement predictions for all students in a university
 */
export const getUniversityEngagementPredictions = query({
  args: {
    universityId: v.id('universities'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { universityId, limit = 50 } = args;

    // Authorization: Only university_admin, advisor, or super_admin can access predictions
    const sessionCtx = await getCurrentUser(ctx);
    const allowedRoles = ['super_admin', 'university_admin', 'advisor'];
    if (!allowedRoles.includes(sessionCtx.role)) {
      throw new Error(
        'Unauthorized: Only administrators and advisors can access engagement predictions',
      );
    }
    if (sessionCtx.role !== 'super_admin') {
      const userUniversityId = requireTenant(sessionCtx);
      if (userUniversityId !== universityId) {
        throw new Error('Unauthorized: Cannot access predictions for another university');
      }
    }

    const cachedSummary = await ctx.db
      .query('engagement_prediction_summary')
      .withIndex('by_university', (q) => q.eq('university_id', universityId))
      .unique();

    const cachedPredictions = await ctx.db
      .query('engagement_prediction_cache')
      .withIndex('by_university_risk', (q) => q.eq('university_id', universityId))
      .order('desc')
      .take(limit);

    if (!cachedSummary && cachedPredictions.length === 0) {
      return {
        predictions: [],
        summary: { total: 0, at_risk: 0, moderate: 0, engaged: 0, avg_risk_score: 0 },
      };
    }

    const resolvedSummary =
      cachedSummary ?? (await computePredictionSummaryFromCache(ctx, universityId));

    return {
      predictions: cachedPredictions.map(mapPredictionCacheToResponse),
      summary: {
        total: resolvedSummary.total,
        at_risk: resolvedSummary.at_risk,
        moderate: resolvedSummary.moderate,
        engaged: resolvedSummary.engaged,
        avg_risk_score: resolvedSummary.avg_risk_score,
      },
    };
  },
});

/**
 * Get students predicted to become at-risk within N days
 */
export const getStudentsAtRiskSoon = query({
  args: {
    universityId: v.id('universities'),
    daysThreshold: v.optional(v.number()), // Default 14 days
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { universityId, daysThreshold = 14, limit = 20 } = args;

    // Authorization: Only university_admin, advisor, or super_admin can access at-risk data
    const sessionCtx = await getCurrentUser(ctx);
    const allowedRoles = ['super_admin', 'university_admin', 'advisor'];
    if (!allowedRoles.includes(sessionCtx.role)) {
      throw new Error(
        'Unauthorized: Only administrators and advisors can access at-risk predictions',
      );
    }
    if (sessionCtx.role !== 'super_admin') {
      const userUniversityId = requireTenant(sessionCtx);
      if (userUniversityId !== universityId) {
        throw new Error('Unauthorized: Cannot access predictions for another university');
      }
    }

    const atRiskSoon: Array<{
      student_id: Id<'users'>;
      student_name: string;
      student_email: string | null;
      prediction: EngagementPrediction;
    }> = [];

    const batchSize = Math.min(500, Math.max(100, limit * 10));
    let cursor: string | null = null;
    do {
      const page = await ctx.db
        .query('engagement_prediction_cache')
        .withIndex('by_university_risk', (q) => q.eq('university_id', universityId))
        .order('desc')
        .paginate({ cursor, numItems: batchSize });

      for (const prediction of page.page as Doc<'engagement_prediction_cache'>[]) {
        if (
          (prediction.current_status === 'engaged' || prediction.current_status === 'moderate') &&
          prediction.predicted_days_to_risk !== undefined &&
          prediction.predicted_days_to_risk <= daysThreshold
        ) {
          atRiskSoon.push(mapPredictionCacheToResponse(prediction));
        }

        if (atRiskSoon.length >= limit) break;
      }

      if (atRiskSoon.length >= limit || page.isDone) {
        cursor = null;
      } else {
        cursor = page.continueCursor;
      }
    } while (cursor);

    return {
      students: atRiskSoon,
      threshold_days: daysThreshold,
      count: atRiskSoon.length,
    };
  },
});

/**
 * Get engagement forecast for charting (weekly predictions)
 */
export const getEngagementForecast = query({
  args: {
    universityId: v.id('universities'),
    weeksAhead: v.optional(v.number()), // Default 4 weeks
  },
  handler: async (ctx, args) => {
    const { universityId, weeksAhead = DEFAULT_FORECAST_WEEKS } = args;

    // Authorization: Only university_admin, advisor, or super_admin can access forecasts
    const sessionCtx = await getCurrentUser(ctx);
    const allowedRoles = ['super_admin', 'university_admin', 'advisor'];
    if (!allowedRoles.includes(sessionCtx.role)) {
      throw new Error(
        'Unauthorized: Only administrators and advisors can access engagement forecasts',
      );
    }
    if (sessionCtx.role !== 'super_admin') {
      const userUniversityId = requireTenant(sessionCtx);
      if (userUniversityId !== universityId) {
        throw new Error('Unauthorized: Cannot access forecasts for another university');
      }
    }

    const forecastWeeks = Math.max(0, Math.min(weeksAhead, MAX_FORECAST_WEEKS));

    const cachedSummary = await ctx.db
      .query('engagement_prediction_summary')
      .withIndex('by_university', (q) => q.eq('university_id', universityId))
      .unique();

    if (cachedSummary) {
      const availableWeeks = Math.max(0, cachedSummary.forecast.length - 1);
      const weeksToReturn = Math.min(forecastWeeks, availableWeeks);

      return {
        forecast: cachedSummary.forecast.slice(0, weeksToReturn + 1),
        current_total: cachedSummary.current_total,
        high_risk_students: cachedSummary.high_risk_students,
      };
    }

    const summary = await computePredictionSummaryFromCache(ctx, universityId, forecastWeeks);

    return {
      forecast: summary.forecast,
      current_total: summary.current_total,
      high_risk_students: summary.high_risk_students,
    };
  },
});
