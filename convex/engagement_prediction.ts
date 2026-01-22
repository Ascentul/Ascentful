import { v } from 'convex/values';

import { query, QueryCtx } from './_generated/server';
import { Id, Doc } from './_generated/dataModel';

/**
 * Engagement Prediction Engine
 *
 * Analyzes historical engagement patterns to predict future engagement levels
 * and identify students at risk of disengagement.
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
 * Internal helper to compute prediction for a student
 */
async function computePredictionForStudent(
  ctx: QueryCtx,
  student: Doc<'users'>,
  lookbackWeeks: number,
): Promise<EngagementPrediction | null> {
  const now = Date.now();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const lookbackMs = lookbackWeeks * msPerWeek;
  const startTime = now - lookbackMs;

  // Get activity events for the lookback period
  const activityEvents = await ctx.db
    .query('activity_events')
    .withIndex('by_user', (q) => q.eq('user_id', student._id))
    .filter((q) => q.gte(q.field('created_at'), startTime))
    .collect();

  // Group by week
  const weeklyActivityCounts: number[] = Array(lookbackWeeks).fill(0);
  for (const event of activityEvents) {
    const weekIndex = Math.floor((now - event.created_at) / msPerWeek);
    if (weekIndex >= 0 && weekIndex < lookbackWeeks) {
      weeklyActivityCounts[lookbackWeeks - 1 - weekIndex]++; // Oldest first
    }
  }

  const trend = calculateTrend(weeklyActivityCounts);

  // Get application data
  const applications = await ctx.db
    .query('applications')
    .withIndex('by_user', (q) => q.eq('user_id', student._id))
    .collect();

  const activeApplications = applications.filter(
    (app) => !['rejected', 'withdrawn', 'accepted'].includes(app.status),
  );
  const recentApplications = applications.filter(
    (app) => app.created_at && app.created_at > startTime,
  );

  // Calculate days since last activity
  const lastActivityAt = student.last_login_at || student._creationTime;
  const daysSinceActivity = Math.floor((now - lastActivityAt) / (24 * 60 * 60 * 1000));

  // Determine current status based on activity
  let currentStatus: 'engaged' | 'moderate' | 'at_risk';
  const recentWeekActivity = weeklyActivityCounts[weeklyActivityCounts.length - 1] || 0;
  const avgActivity = weeklyActivityCounts.reduce((a, b) => a + b, 0) / weeklyActivityCounts.length;

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
  if (activityEvents.length > 20) confidence += 15;
  if (activityEvents.length > 50) confidence += 10;
  if (weeklyActivityCounts.filter((c) => c > 0).length >= 4) confidence += 10;
  if (applications.length > 0) confidence += 5;
  confidence = Math.min(95, confidence);

  // Calculate days to risk if decreasing
  let predictedDaysToRisk: number | undefined;
  if (trend.trend === 'decreasing' && currentStatus !== 'at_risk') {
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
 * Internal helper to get predictions for all students in a university
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

  const predictions: Array<{
    student_id: Id<'users'>;
    student_name: string;
    student_email: string | null;
    prediction: EngagementPrediction;
  }> = [];

  for (const student of students) {
    const prediction = await computePredictionForStudent(ctx, student, 8);

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

    const student = await ctx.db.get(studentId);
    if (!student) return null;

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

    const { predictions, summary } = await computeUniversityPredictions(ctx, universityId, 200);

    // Current state
    const currentState = {
      engaged: summary.engaged,
      moderate: summary.moderate,
      at_risk: summary.at_risk,
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

      // Count how many will become at-risk by this week
      const willBecomeAtRisk = predictions.filter((p) => {
        const pred = p.prediction;
        return (
          pred.predicted_status !== 'at_risk' &&
          pred.predicted_days_to_risk !== undefined &&
          pred.predicted_days_to_risk <= daysCutoff
        );
      }).length;

      // Estimate state changes
      const projectedAtRisk = Math.min(summary.total, currentState.at_risk + willBecomeAtRisk);
      const projectedModerate = Math.max(
        0,
        currentState.moderate - Math.floor(willBecomeAtRisk * 0.6),
      );
      const projectedEngaged = summary.total - projectedAtRisk - projectedModerate;

      forecast.push({
        week,
        engaged: Math.max(0, projectedEngaged),
        moderate: projectedModerate,
        at_risk: projectedAtRisk,
      });
    }

    return {
      forecast,
      current_total: summary.total,
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
