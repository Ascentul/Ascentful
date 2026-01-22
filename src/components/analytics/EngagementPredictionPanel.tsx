'use client';

import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Brain,
  Calendar,
  ChevronRight,
  Loader2,
  TrendingDown,
  TrendingUp,
  User,
} from 'lucide-react';
import Link from 'next/link';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface EngagementPredictionPanelProps {
  universityId: Id<'universities'>;
}

const STATUS_CONFIG = {
  engaged: {
    label: 'Engaged',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-200',
    chartColor: '#22c55e',
  },
  moderate: {
    label: 'Moderate',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-200',
    chartColor: '#eab308',
  },
  at_risk: {
    label: 'At Risk',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-200',
    chartColor: '#ef4444',
  },
};

export function EngagementPredictionPanel({ universityId }: EngagementPredictionPanelProps) {
  const predictions = useQuery(api.engagement_prediction.getUniversityEngagementPredictions, {
    universityId,
    limit: 50,
  });

  const forecast = useQuery(api.engagement_prediction.getEngagementForecast, {
    universityId,
    weeksAhead: 4,
  });

  const atRiskSoon = useQuery(api.engagement_prediction.getStudentsAtRiskSoon, {
    universityId,
    daysThreshold: 14,
    limit: 10,
  });

  if (!predictions || !forecast) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const { summary } = predictions;

  // Calculate trend from forecast
  const currentAtRisk = forecast.forecast[0]?.at_risk || 0;
  const projectedAtRisk = forecast.forecast[forecast.forecast.length - 1]?.at_risk || 0;
  const atRiskTrend = projectedAtRisk - currentAtRisk;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100">
          <Brain className="h-5 w-5 text-primary-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Engagement Predictions</h2>
          <p className="text-sm text-muted-foreground">
            AI-powered forecasting based on activity patterns
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Risk Score</p>
                <p className="text-3xl font-bold">{summary.avg_risk_score}</p>
              </div>
              <div
                className={cn(
                  'rounded-full p-3',
                  summary.avg_risk_score >= 50 ? 'bg-red-100' : 'bg-green-100',
                )}
              >
                {summary.avg_risk_score >= 50 ? (
                  <TrendingDown className="h-5 w-5 text-red-600" />
                ) : (
                  <TrendingUp className="h-5 w-5 text-green-600" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn('border', STATUS_CONFIG.engaged.borderColor)}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Predicted Engaged</p>
                <p className={cn('text-3xl font-bold', STATUS_CONFIG.engaged.color)}>
                  {summary.engaged}
                </p>
              </div>
              <Badge variant="outline" className={cn(STATUS_CONFIG.engaged.bgColor)}>
                {summary.total > 0 ? ((summary.engaged / summary.total) * 100).toFixed(0) : 0}%
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className={cn('border', STATUS_CONFIG.moderate.borderColor)}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Predicted Moderate</p>
                <p className={cn('text-3xl font-bold', STATUS_CONFIG.moderate.color)}>
                  {summary.moderate}
                </p>
              </div>
              <Badge variant="outline" className={cn(STATUS_CONFIG.moderate.bgColor)}>
                {summary.total > 0 ? ((summary.moderate / summary.total) * 100).toFixed(0) : 0}%
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className={cn('border', STATUS_CONFIG.at_risk.borderColor)}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Predicted At Risk</p>
                <p className={cn('text-3xl font-bold', STATUS_CONFIG.at_risk.color)}>
                  {summary.at_risk}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {atRiskTrend > 0 && (
                  <span className="flex items-center text-xs text-red-600">
                    <ArrowUp className="h-3 w-3" />+{atRiskTrend}
                  </span>
                )}
                <Badge variant="outline" className={cn(STATUS_CONFIG.at_risk.bgColor)}>
                  {summary.total > 0 ? ((summary.at_risk / summary.total) * 100).toFixed(0) : 0}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Forecast Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            4-Week Engagement Forecast
          </CardTitle>
          <CardDescription>
            Projected engagement distribution based on current trends
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecast.forecast}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="week"
                  tickFormatter={(w) => (w === 0 ? 'Now' : `Week ${w}`)}
                  className="text-xs"
                />
                <YAxis className="text-xs" />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    value,
                    name === 'at_risk' ? 'At Risk' : name.charAt(0).toUpperCase() + name.slice(1),
                  ]}
                  labelFormatter={(w) => (w === 0 ? 'Current' : `Week ${w}`)}
                />
                <Area
                  type="monotone"
                  dataKey="engaged"
                  stackId="1"
                  stroke={STATUS_CONFIG.engaged.chartColor}
                  fill={STATUS_CONFIG.engaged.chartColor}
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="moderate"
                  stackId="1"
                  stroke={STATUS_CONFIG.moderate.chartColor}
                  fill={STATUS_CONFIG.moderate.chartColor}
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="at_risk"
                  stackId="1"
                  stroke={STATUS_CONFIG.at_risk.chartColor}
                  fill={STATUS_CONFIG.at_risk.chartColor}
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex items-center justify-center gap-6">
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <div key={key} className="flex items-center gap-2">
                <div
                  className={cn('h-3 w-3 rounded-full')}
                  style={{ backgroundColor: config.chartColor }}
                />
                <span className="text-sm text-muted-foreground">{config.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Students At Risk Soon */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Predicted to Drop (14 days)
            </CardTitle>
            <CardDescription>
              Students currently engaged but trending toward at-risk status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!atRiskSoon || atRiskSoon.students.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No students predicted to drop within 14 days</p>
              </div>
            ) : (
              <div className="space-y-3">
                {atRiskSoon.students.map((student) => (
                  <div
                    key={student.student_id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{student.student_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Risk in ~{student.prediction.predicted_days_to_risk} days
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-sm font-medium text-amber-600">
                          {student.prediction.risk_score}%
                        </p>
                        <p className="text-xs text-muted-foreground">risk score</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* High Risk Students */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              Highest Risk Students
            </CardTitle>
            <CardDescription>
              Students with the highest predicted risk of disengagement
            </CardDescription>
          </CardHeader>
          <CardContent>
            {forecast.high_risk_students.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No high-risk students identified</p>
              </div>
            ) : (
              <div className="space-y-3">
                {forecast.high_risk_students.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50/50 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                        <User className="h-4 w-4 text-red-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{student.name}</p>
                        {student.predicted_days_to_risk != null && (
                          <p className="text-xs text-muted-foreground">
                            Critical in {student.predicted_days_to_risk} days
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-20">
                        <Progress value={student.risk_score} className="h-2" />
                      </div>
                      <span className="text-sm font-bold text-red-600">{student.risk_score}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Risk Factors Across All Students */}
      <Card>
        <CardHeader>
          <CardTitle>Common Risk Factors</CardTitle>
          <CardDescription>
            Most frequent factors contributing to disengagement risk
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {(() => {
              // Aggregate risk factors
              const factorCounts: Record<string, { negative: number; positive: number }> = {};
              predictions.predictions.forEach((p) => {
                p.prediction.factors.forEach((f) => {
                  if (!factorCounts[f.factor]) {
                    factorCounts[f.factor] = { negative: 0, positive: 0 };
                  }
                  if (f.impact === 'negative') {
                    factorCounts[f.factor].negative++;
                  } else if (f.impact === 'positive') {
                    factorCounts[f.factor].positive++;
                  }
                });
              });

              return Object.entries(factorCounts)
                .sort((a, b) => b[1].negative - a[1].negative)
                .slice(0, 3)
                .map(([factor, counts]) => (
                  <div key={factor} className="rounded-lg border p-4">
                    <h4 className="font-medium">{factor}</h4>
                    <div className="mt-2 flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <ArrowDown className="h-4 w-4 text-red-500" />
                        <span className="text-sm text-red-600">{counts.negative} negative</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <ArrowUp className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-600">{counts.positive} positive</span>
                      </div>
                    </div>
                  </div>
                ));
            })()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Individual student prediction card for student profile view
 */
interface StudentPredictionCardProps {
  studentId: Id<'users'>;
  compact?: boolean;
}

export function StudentPredictionCard({ studentId, compact = false }: StudentPredictionCardProps) {
  const prediction = useQuery(api.engagement_prediction.predictStudentEngagement, {
    studentId,
    lookbackWeeks: 8,
  });

  if (!prediction) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const currentConfig = STATUS_CONFIG[prediction.current_status];
  const predictedConfig = STATUS_CONFIG[prediction.predicted_status];
  const isWorsening =
    prediction.predicted_status !== prediction.current_status &&
    (prediction.current_status === 'engaged' || prediction.predicted_status === 'at_risk');

  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-lg border p-3">
        <Brain className="h-4 w-4 text-primary-500" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Badge className={cn(currentConfig.bgColor, currentConfig.color, 'text-xs')}>
              {currentConfig.label}
            </Badge>
            {isWorsening && (
              <>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <Badge className={cn(predictedConfig.bgColor, predictedConfig.color, 'text-xs')}>
                  {predictedConfig.label}
                </Badge>
              </>
            )}
          </div>
        </div>
        <div className="text-right">
          <p
            className={cn(
              'text-sm font-bold',
              prediction.risk_score >= 50 ? 'text-red-600' : 'text-green-600',
            )}
          >
            {prediction.risk_score}%
          </p>
          <p className="text-xs text-muted-foreground">risk</p>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-4 w-4 text-primary-500" />
          Engagement Prediction
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status transition */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Current</p>
            <Badge className={cn(currentConfig.bgColor, currentConfig.color)}>
              {currentConfig.label}
            </Badge>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
          <div className="space-y-1 text-right">
            <p className="text-xs text-muted-foreground">Predicted</p>
            <Badge className={cn(predictedConfig.bgColor, predictedConfig.color)}>
              {predictedConfig.label}
            </Badge>
          </div>
        </div>

        {/* Risk score */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted-foreground">Risk Score</span>
            <span
              className={cn(
                'font-bold',
                prediction.risk_score >= 50 ? 'text-red-600' : 'text-green-600',
              )}
            >
              {prediction.risk_score}%
            </span>
          </div>
          <Progress value={prediction.risk_score} className="h-2" />
        </div>

        {/* Days to risk */}
        {prediction.predicted_days_to_risk != null && (
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
            <p className="text-sm text-amber-800">
              <AlertTriangle className="inline h-4 w-4 mr-1" />
              Predicted to become at-risk in ~{prediction.predicted_days_to_risk} days
            </p>
          </div>
        )}

        {/* Factors */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Contributing Factors
          </p>
          {prediction.factors.slice(0, 4).map((factor, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              {factor.impact === 'negative' ? (
                <ArrowDown className="h-4 w-4 text-red-500 mt-0.5" />
              ) : factor.impact === 'positive' ? (
                <ArrowUp className="h-4 w-4 text-green-500 mt-0.5" />
              ) : (
                <ArrowRight className="h-4 w-4 text-muted-foreground mt-0.5" />
              )}
              <span className="text-muted-foreground">{factor.description}</span>
            </div>
          ))}
        </div>

        {/* Recommendations */}
        {prediction.recommendations.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Recommendations
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              {prediction.recommendations.slice(0, 3).map((rec, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary-500">•</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Confidence */}
        <p className="text-xs text-muted-foreground text-right">
          {prediction.confidence}% confidence
        </p>
      </CardContent>
    </Card>
  );
}
