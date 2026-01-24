import { v } from 'convex/values';

import { query, QueryCtx } from './_generated/server';
import { Id, Doc } from './_generated/dataModel';
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

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
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
 * Pre-fetched data for batch prediction computation
 */
interface BatchPredictionData {
  activityEventsByUser: Map<string, Doc<'activity_events'>[]>;
  applicationsByUser: Map<string, Doc<'applications'>[]>;
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
 * This function contains the core prediction logic used by both:
 * - computePredictionWithData (batch operations with pre-fetched data)
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
  let riskScore = 30; // Base risk
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
 * Internal helper to compute prediction for a student using pre-fetched data.
 * This avoids N+1 queries when processing multiple students.
 */
function computePredictionWithData(
  student: Doc<'users'>,
  lookbackWeeks: number,
  batchData: BatchPredictionData,
): EngagementPrediction | null {
  // Get pre-fetched data for this student
  const activityEvents = batchData.activityEventsByUser.get(student._id) || [];
  const applications = batchData.applicationsByUser.get(student._id) || [];

  // Prepare and compute using shared algorithm
  const scoringData = prepareScoringData(student, activityEvents, applications, lookbackWeeks);
  return computePredictionFromScoringData(scoringData);
}

/**
 * Internal helper to compute prediction for a single student (makes DB queries).
 * Use computePredictionWithData for batch operations.
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

/**
 * Internal helper to get predictions for all students in a university.
 * Uses batch fetching for O(3) queries instead of O(n*2) queries.
 */
async function computeUniversityPredictions(
  ctx: QueryCtx,
  universityId: Id<'universities'>,
  limit: number,
) {
  // Get all students for the university (only students, not other user types)
  const students = await ctx.db
    .query('users')
    .withIndex('by_university', (q) => q.eq('university_id', universityId))
    .filter((q) => q.eq(q.field('role'), 'student'))
    .take(limit);

  if (students.length === 0) {
    return {
      predictions: [],
      summary: { total: 0, at_risk: 0, moderate: 0, engaged: 0, avg_risk_score: 0 },
    };
  }

  // Calculate lookback period to filter data at query time (avoid loading years of history)
  const lookbackWeeks = 8;
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const startTime = Date.now() - lookbackWeeks * msPerWeek;

  // Batch fetch: Get activity events within the lookback period
  // This is O(1) query instead of O(n) queries, filtered to avoid loading all historical data
  const studentIds = new Set(students.map((s) => s._id));
  const allActivityEvents = await ctx.db
    .query('activity_events')
    .withIndex('by_university', (q) => q.eq('university_id', universityId))
    .filter((q) => q.gte(q.field('occurred_at'), startTime))
    .collect();

  // Batch fetch: Get all applications (no date filter - applications have long lifecycles)
  // An application created months ago may still be in an active stage like "Interview"
  const allApplications = await ctx.db
    .query('applications')
    .withIndex('by_university', (q) => q.eq('university_id', universityId))
    .collect();

  // Group data by user_id for efficient lookup
  const activityEventsByUser = new Map<string, Doc<'activity_events'>[]>();
  for (const event of allActivityEvents) {
    if (studentIds.has(event.user_id)) {
      const existing = activityEventsByUser.get(event.user_id) || [];
      existing.push(event);
      activityEventsByUser.set(event.user_id, existing);
    }
  }

  const applicationsByUser = new Map<string, Doc<'applications'>[]>();
  for (const app of allApplications) {
    if (studentIds.has(app.user_id)) {
      const existing = applicationsByUser.get(app.user_id) || [];
      existing.push(app);
      applicationsByUser.set(app.user_id, existing);
    }
  }

  const batchData: BatchPredictionData = { activityEventsByUser, applicationsByUser };

  const predictions: Array<{
    student_id: Id<'users'>;
    student_name: string;
    student_email: string | null;
    prediction: EngagementPrediction;
  }> = [];

  // Compute predictions using pre-fetched data (no additional DB queries)
  for (const student of students) {
    const prediction = computePredictionWithData(student, 8, batchData);

    if (prediction) {
      predictions.push({
        student_id: student._id,
        student_name: student.name || 'Unknown',
        student_email: student.email || null,
        prediction,
      });
    }
  }

  // Sort by risk score (highest first)
  predictions.sort((a, b) => b.prediction.risk_score - a.prediction.risk_score);

  // Calculate summary stats
  const atRiskCount = predictions.filter((p) => p.prediction.predicted_status === 'at_risk').length;
  const moderateCount = predictions.filter(
    (p) => p.prediction.predicted_status === 'moderate',
  ).length;
  const engagedCount = predictions.filter(
    (p) => p.prediction.predicted_status === 'engaged',
  ).length;

  const avgRiskScore =
    predictions.length > 0
      ? predictions.reduce((sum, p) => sum + p.prediction.risk_score, 0) / predictions.length
      : 0;

  return {
    predictions,
    summary: {
      total: predictions.length,
      at_risk: atRiskCount,
      moderate: moderateCount,
      engaged: engagedCount,
      avg_risk_score: Math.round(avgRiskScore),
    },
  };
}

/**
 * Predict engagement for a single student
 */
export const predictStudentEngagement = query({
  args: {
    studentId: v.id('users'),
    lookbackWeeks: v.optional(v.number()), // Default 8 weeks
  },
  handler: async (ctx, args): Promise<EngagementPrediction | null> => {
    const { studentId, lookbackWeeks = 8 } = args;
    if (lookbackWeeks <= 0) {
      throw new Error('lookbackWeeks must be >= 1');
    }

    const student = await ctx.db.get(studentId);
    if (!student) return null;

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

    return computeUniversityPredictions(ctx, universityId, limit);
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

    // Fetch more students than requested since we filter down after prediction
    // Use a higher multiplier to ensure we don't miss at-risk students
    const fetchLimit = Math.max(200, limit * 10);
    const { predictions } = await computeUniversityPredictions(ctx, universityId, fetchLimit);

    // Filter to students currently engaged/moderate but predicted to drop
    const atRiskSoon = predictions
      .filter((p) => {
        const pred = p.prediction;
        return (
          (pred.current_status === 'engaged' || pred.current_status === 'moderate') &&
          pred.predicted_days_to_risk !== undefined &&
          pred.predicted_days_to_risk <= daysThreshold
        );
      })
      .slice(0, limit);

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
    const { universityId, weeksAhead = 4 } = args;

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

    // Get accurate current state from cached engagement status (scales to any university size)
    const allStudents = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', universityId))
      .filter((q) => q.eq(q.field('role'), 'student'))
      .collect();

    const actualTotal = allStudents.length;
    const actualEngaged = allStudents.filter((s) => s.engagement_status === 'engaged').length;
    const actualAtRisk = allStudents.filter((s) => s.engagement_status === 'at_risk').length;
    const actualModerate = actualTotal - actualEngaged - actualAtRisk;

    // Get sampled predictions for transition rate estimation (capped for performance)
    const sampleLimit = Math.min(500, actualTotal);
    const { predictions } = await computeUniversityPredictions(ctx, universityId, sampleLimit);
    const sampleSize = predictions.length;

    // Current state (accurate from cached data)
    const currentState = {
      engaged: actualEngaged,
      moderate: actualModerate,
      at_risk: actualAtRisk,
    };

    // Project future states based on predicted_days_to_risk
    const forecast: Array<{
      week: number;
      engaged: number;
      moderate: number;
      at_risk: number;
    }> = [{ week: 0, ...currentState }];

    for (let week = 1; week <= weeksAhead; week++) {
      const daysCutoff = week * 7;

      // Count how many in sample will become at-risk by this week
      const sampleWillBecomeAtRisk = predictions.filter((p) => {
        const pred = p.prediction;
        return (
          pred.predicted_status !== 'at_risk' &&
          pred.predicted_days_to_risk !== undefined &&
          pred.predicted_days_to_risk <= daysCutoff
        );
      }).length;

      // Scale to full population (if sample < total)
      const scaleFactor = sampleSize > 0 ? actualTotal / sampleSize : 1;
      const willBecomeAtRisk = Math.round(sampleWillBecomeAtRisk * scaleFactor);

      // Estimate state changes
      const projectedAtRisk = Math.min(actualTotal, currentState.at_risk + willBecomeAtRisk);
      const projectedModerate = Math.max(
        0,
        currentState.moderate - Math.floor(willBecomeAtRisk * 0.6),
      );
      const projectedEngaged = actualTotal - projectedAtRisk - projectedModerate;

      forecast.push({
        week,
        engaged: Math.max(0, projectedEngaged),
        moderate: projectedModerate,
        at_risk: projectedAtRisk,
      });
    }

    return {
      forecast,
      current_total: actualTotal,
      high_risk_students: predictions
        .filter((p) => p.prediction.risk_score >= 70)
        .slice(0, 10)
        .map((p) => ({
          id: p.student_id,
          name: p.student_name,
          risk_score: p.prediction.risk_score,
          predicted_days_to_risk: p.prediction.predicted_days_to_risk,
        })),
    };
  },
});
