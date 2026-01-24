'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import {
  AlertTriangle,
  Calendar,
  ClipboardList,
  Clock,
  FileText,
  GraduationCap,
  LogIn,
  Mail,
  MousePointer,
  RefreshCw,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  UserX,
} from 'lucide-react';
import React, { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { EngagementPredictionPanel } from '@/components/analytics/EngagementPredictionPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/ClerkAuthProvider';

export default function UniversityAnalyticsPage() {
  const { user: clerkUser } = useUser();
  const { user, isAdmin, subscription } = useAuth();
  const [analyticsView, setAnalyticsView] = useState<
    'engagement' | 'features' | 'risk' | 'predictions'
  >('engagement');
  const [activeUsersTimeRange, setActiveUsersTimeRange] = useState<'daily' | 'weekly' | 'monthly'>(
    'weekly',
  );

  // Type university_id once at the top for all queries
  const universityId = user?.university_id as Id<'universities'> | undefined;

  // Access control: Only university_admin, advisor, or super_admin can access
  // subscription.isUniversity is NOT sufficient - it includes regular students
  const canAccess =
    !!user && (isAdmin || user.role === 'university_admin' || user.role === 'advisor');

  const overview = useQuery(
    api.university_admin.getOverview,
    clerkUser?.id ? { clerkId: clerkUser.id } : 'skip',
  );
  const students = useQuery(
    api.university_admin.listStudents,
    clerkUser?.id ? { clerkId: clerkUser.id, limit: 200 } : 'skip',
  );
  const departments = useQuery(
    api.university_admin.listDepartments,
    clerkUser?.id ? { clerkId: clerkUser.id } : 'skip',
  );

  // Engagement stats from the new engagement engine
  const engagementStats = useQuery(
    api.engagement_definitions.getUniqueEngagedStats,
    universityId ? { universityId } : 'skip',
  );

  // Signal analytics for active signals count
  const signalAnalytics = useQuery(
    api.signals.getSignalAnalytics,
    universityId ? { universityId } : 'skip',
  );

  // Real active users over time data
  const activeUsersData = useQuery(
    api.analytics.getUniversityActiveUsersOverTime,
    universityId ? { universityId, timeRange: activeUsersTimeRange } : 'skip',
  );

  // Real feature usage data (networking, AI coach)
  const featureUsage = useQuery(
    api.analytics.getUniversityFeatureUsage,
    universityId ? { universityId } : 'skip',
  );

  // Real department analytics
  const departmentAnalytics = useQuery(
    api.analytics.getUniversityDepartmentAnalytics,
    universityId ? { universityId } : 'skip',
  );

  if (!canAccess) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle>Unauthorized</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">You do not have access to University Analytics.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!overview || !students || !departments) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  // Calculate real analytics data from actual student data
  // Since we don't have calculated counts in the basic user query, we'll show 0s for new users
  // This is better than showing fake inflated numbers
  const analyticsData = {
    goals: {
      inProgress: 0, // Will be calculated when we have real goals data
      completed: 0, // Will be calculated when we have real goals data
      total: 0, // Will be calculated when we have real goals data
    },
    applications: {
      inProgress: 0, // Will be calculated when we have real application data
      submitted: 0, // Will be calculated when we have real application data
      interviewing: 0, // Will be calculated when we have real application data
      offers: 0, // Will be calculated when we have real application data
      total: 0, // Will be calculated when we have real application data
    },
    documents: {
      resumes: 0, // Will be calculated when we have real resume data
      coverLetters: 0, // Will be calculated when we have real cover letter data
      total: 0, // Will be calculated when we have real document data
    },
  };

  return (
    <div className="max-w-screen-2xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#0C29AB]">Usage Analytics</h1>
          <p className="text-muted-foreground">
            Detailed insights into student engagement and platform usage.
          </p>
        </div>
      </div>

      {/* Analytics View Toggles */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={analyticsView === 'engagement' ? 'default' : 'outline'}
          onClick={() => setAnalyticsView('engagement')}
          className={analyticsView === 'engagement' ? 'bg-[#0C29AB]' : ''}
        >
          Student Engagement
        </Button>
        <Button
          size="sm"
          variant={analyticsView === 'features' ? 'default' : 'outline'}
          onClick={() => setAnalyticsView('features')}
          className={analyticsView === 'features' ? 'bg-[#0C29AB]' : ''}
        >
          Feature Adoption
        </Button>
        <Button
          size="sm"
          variant={analyticsView === 'risk' ? 'default' : 'outline'}
          onClick={() => setAnalyticsView('risk')}
          className={analyticsView === 'risk' ? 'bg-[#0C29AB]' : ''}
        >
          At-Risk Analysis
        </Button>
        <Button
          size="sm"
          variant={analyticsView === 'predictions' ? 'default' : 'outline'}
          onClick={() => setAnalyticsView('predictions')}
          className={analyticsView === 'predictions' ? 'bg-[#0C29AB]' : ''}
        >
          AI Predictions
        </Button>
      </div>

      {/* Student Engagement View */}
      {analyticsView === 'engagement' && (
        <>
          {/* Primary Engagement KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-green-600" />
                  Unique Engaged
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {engagementStats?.engaged_percent ?? 0}%
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {engagementStats?.engaged_students ?? 0} of {engagementStats?.total_students ?? 0}{' '}
                  students
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <UserX className="h-4 w-4 text-amber-600" />
                  At-Risk Students
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-600">
                  {engagementStats?.at_risk_percent ?? 0}%
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {engagementStats?.at_risk_students ?? 0} need attention
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  Active Signals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">
                  {signalAnalytics?.statusCounts?.active ?? 0}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {signalAnalytics?.priorityCounts?.urgent ?? 0} urgent,{' '}
                  {signalAnalytics?.priorityCounts?.high ?? 0} high priority
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  Moderate Engagement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {engagementStats?.breakdown_by_status?.moderate ?? 0}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Students with average activity</p>
              </CardContent>
            </Card>
          </div>

          {/* Signal Type Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Needs Outreach</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <Mail className="h-5 w-5 text-amber-500 mr-2" />
                  <div className="text-2xl font-bold">
                    {signalAnalytics?.typeCounts?.needs_outreach ?? 0}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">Students requiring contact</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Application Support</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <ClipboardList className="h-5 w-5 text-blue-500 mr-2" />
                  <div className="text-2xl font-bold">
                    {signalAnalytics?.typeCounts?.application_support ?? 0}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">Need application help</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Signals Resolved</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <Target className="h-5 w-5 text-green-500 mr-2" />
                  <div className="text-2xl font-bold">
                    {signalAnalytics?.statusCounts?.resolved ?? 0}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {signalAnalytics?.summary?.avgResolutionTimeHours
                    ? `Avg ${signalAnalytics.summary.avgResolutionTimeHours}h to resolve`
                    : 'Resolution metrics'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Total Students</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <GraduationCap className="h-5 w-5 text-purple-500 mr-2" />
                  <div className="text-2xl font-bold">
                    {engagementStats?.total_students ?? students.length}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">Active in your institution</div>
              </CardContent>
            </Card>
          </div>

          {/* Active Users Over Time Chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Active Users Over Time</CardTitle>
                  <CardDescription>Students vs Advisors engagement trends</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={activeUsersTimeRange === 'daily' ? 'default' : 'outline'}
                    onClick={() => setActiveUsersTimeRange('daily')}
                    className={activeUsersTimeRange === 'daily' ? 'bg-[#0C29AB]' : ''}
                  >
                    Daily
                  </Button>
                  <Button
                    size="sm"
                    variant={activeUsersTimeRange === 'weekly' ? 'default' : 'outline'}
                    onClick={() => setActiveUsersTimeRange('weekly')}
                    className={activeUsersTimeRange === 'weekly' ? 'bg-[#0C29AB]' : ''}
                  >
                    Weekly
                  </Button>
                  <Button
                    size="sm"
                    variant={activeUsersTimeRange === 'monthly' ? 'default' : 'outline'}
                    onClick={() => setActiveUsersTimeRange('monthly')}
                    className={activeUsersTimeRange === 'monthly' ? 'bg-[#0C29AB]' : ''}
                  >
                    Monthly
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart
                  data={activeUsersData?.data || []}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    angle={activeUsersTimeRange === 'daily' ? -45 : 0}
                    textAnchor={activeUsersTimeRange === 'daily' ? 'end' : 'middle'}
                    height={activeUsersTimeRange === 'daily' ? 70 : 30}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="line" />
                  <Line
                    type="monotone"
                    dataKey="students"
                    stroke="#0C29AB"
                    strokeWidth={2}
                    name="Students"
                    dot={{ fill: '#0C29AB', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="advisors"
                    stroke="#10B981"
                    strokeWidth={2}
                    name="Advisors"
                    dot={{ fill: '#10B981', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Engagement by Program Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Engagement by Department/Program</CardTitle>
              <CardDescription>Student engagement percentage across programs</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {engagementStats?.by_program && Object.keys(engagementStats.by_program).length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(() => {
                      // Get department names for the program IDs
                      const programData = Object.entries(engagementStats.by_program)
                        .filter(([key]) => key !== 'unknown')
                        .map(([programId, stats]) => {
                          const dept = departments.find((d) => d._id === programId);
                          return {
                            name: dept?.name || 'Unknown Program',
                            engaged: stats.engaged,
                            total: stats.total,
                            percent: stats.percent,
                          };
                        })
                        .sort((a, b) => b.percent - a.percent)
                        .slice(0, 8); // Top 8 programs
                      return programData;
                    })()}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number, name: string, props: any) => [
                        `${value}% (${props.payload.engaged}/${props.payload.total})`,
                        'Engaged',
                      ]}
                    />
                    <Bar dataKey="percent" fill="#10B981" name="Engaged %" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No program engagement data available yet
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Data will appear as students become active
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Student Engagement Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Engagement Status Distribution</CardTitle>
                <CardDescription>Current breakdown of student engagement levels</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                {engagementStats?.total_students && engagementStats.total_students > 0 ? (
                  (() => {
                    const engagementData = [
                      {
                        name: 'Engaged',
                        value: engagementStats.breakdown_by_status?.engaged ?? 0,
                        color: '#10B981',
                      },
                      {
                        name: 'Moderate',
                        value: engagementStats.breakdown_by_status?.moderate ?? 0,
                        color: '#3B82F6',
                      },
                      {
                        name: 'At Risk',
                        value: engagementStats.breakdown_by_status?.at_risk ?? 0,
                        color: '#F59E0B',
                      },
                    ];
                    return (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={engagementData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ name, value, percent }) =>
                              `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                            }
                            labelLine
                          >
                            {engagementData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    );
                  })()
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">No engagement data yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Signal Types Distribution</CardTitle>
                <CardDescription>Active signals by category</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                {signalAnalytics &&
                signalAnalytics.typeCounts.needs_outreach +
                  signalAnalytics.typeCounts.application_support +
                  signalAnalytics.typeCounts.document_review +
                  signalAnalytics.typeCounts.milestone_check +
                  signalAnalytics.typeCounts.custom >
                  0 ? (
                  (() => {
                    const signalBarData = [
                      {
                        type: 'Needs Outreach',
                        count: signalAnalytics.typeCounts.needs_outreach,
                        color: '#F59E0B',
                      },
                      {
                        type: 'App Support',
                        count: signalAnalytics.typeCounts.application_support,
                        color: '#3B82F6',
                      },
                      {
                        type: 'Doc Review',
                        count: signalAnalytics.typeCounts.document_review,
                        color: '#8B5CF6',
                      },
                      {
                        type: 'Milestone',
                        count: signalAnalytics.typeCounts.milestone_check,
                        color: '#10B981',
                      },
                      {
                        type: 'Custom',
                        count: signalAnalytics.typeCounts.custom,
                        color: '#6B7280',
                      },
                    ].filter((d) => d.count > 0);
                    return (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={signalBarData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="type" tick={{ fontSize: 11 }} />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" name="Signals">
                            {signalBarData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    );
                  })()
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <AlertTriangle className="h-12 w-12 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">No active signals yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Signals will appear when conditions are triggered
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Feature Adoption View */}
      {analyticsView === 'features' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Goals Set</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <Target className="h-5 w-5 text-muted-foreground mr-2" />
                  <div className="text-2xl font-bold">{analyticsData.goals.total}</div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {analyticsData.goals.completed} completed
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Applications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <ClipboardList className="h-5 w-5 text-muted-foreground mr-2" />
                  <div className="text-2xl font-bold">{analyticsData.applications.total}</div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {analyticsData.applications.submitted} submitted
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <FileText className="h-5 w-5 text-muted-foreground mr-2" />
                  <div className="text-2xl font-bold">{analyticsData.documents.total}</div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">Resumes & Cover Letters</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Engagement Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <TrendingUp className="h-5 w-5 text-muted-foreground mr-2" />
                  <div className="text-2xl font-bold">
                    {students.length > 0
                      ? Math.round(
                          ((analyticsData.goals.total +
                            analyticsData.applications.total +
                            analyticsData.documents.total) /
                            students.length) *
                            100,
                        ) / 100
                      : 0}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">Avg activities per student</div>
              </CardContent>
            </Card>
          </div>

          {/* Feature Adoption Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Feature Usage Distribution</CardTitle>
                <CardDescription>Platform features adoption by students</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                {(() => {
                  // Only include features with real data sources
                  // Applications, Goals, Documents are currently placeholders (always 0)
                  // and will be added when their queries are implemented
                  const featureData = [
                    {
                      name: 'Networking',
                      value: featureUsage?.networkingContacts ?? 0,
                      color: '#EC4899',
                    },
                    {
                      name: 'AI Coach',
                      value: featureUsage?.aiCoachConversations ?? 0,
                      color: '#8B5CF6',
                    },
                  ].filter((f) => f.value > 0); // Only show features with usage
                  const total = featureData.reduce((sum, f) => sum + f.value, 0);
                  if (total === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <TrendingUp className="h-12 w-12 text-muted-foreground/30 mb-3" />
                        <p className="text-sm text-muted-foreground">No feature usage data yet</p>
                      </div>
                    );
                  }
                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={featureData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine
                        >
                          {featureData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  );
                })()}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Feature Adoption Over Time</CardTitle>
                <CardDescription>Monthly new users per feature</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                {/* Monthly trends tracking coming soon */}
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <TrendingUp className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Monthly activity trends coming soon
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Track applications, goals, and documents over time
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Goals Progress</CardTitle>
              <CardDescription>Career goals completion status</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    {
                      name: 'Goals',
                      inProgress: analyticsData.goals.inProgress,
                      completed: analyticsData.goals.completed,
                    },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="inProgress" fill="#4F46E5" name="In Progress" />
                  <Bar dataKey="completed" fill="#10B981" name="Completed" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}

      {/* At-Risk Analysis View */}
      {analyticsView === 'risk' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">At-Risk Students</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">
                  {engagementStats?.at_risk_students ?? 0}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {engagementStats?.at_risk_percent ?? 0}% of total students
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Active Signals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-600">
                  {signalAnalytics?.statusCounts?.active ?? 0}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {signalAnalytics?.statusCounts?.snoozed ?? 0} snoozed
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Urgent Signals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">
                  {signalAnalytics?.priorityCounts?.urgent ?? 0}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {signalAnalytics?.priorityCounts?.high ?? 0} high priority
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Signals Resolved</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {signalAnalytics?.statusCounts?.resolved ?? 0}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {signalAnalytics?.summary?.avgResolutionTimeHours
                    ? `Avg ${signalAnalytics.summary.avgResolutionTimeHours}h resolution`
                    : 'All time'}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* At-Risk Analysis Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Signal Type Breakdown</CardTitle>
                <CardDescription>Categories of signals requiring attention</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                {signalAnalytics &&
                signalAnalytics.typeCounts.needs_outreach +
                  signalAnalytics.typeCounts.application_support +
                  signalAnalytics.typeCounts.document_review +
                  signalAnalytics.typeCounts.milestone_check +
                  signalAnalytics.typeCounts.custom >
                  0 ? (
                  (() => {
                    const signalTypeData = [
                      {
                        name: 'Needs Outreach',
                        value: signalAnalytics.typeCounts.needs_outreach,
                        color: '#F97316',
                      },
                      {
                        name: 'Application Support',
                        value: signalAnalytics.typeCounts.application_support,
                        color: '#3B82F6',
                      },
                      {
                        name: 'Document Review',
                        value: signalAnalytics.typeCounts.document_review,
                        color: '#8B5CF6',
                      },
                      {
                        name: 'Milestone Check',
                        value: signalAnalytics.typeCounts.milestone_check,
                        color: '#10B981',
                      },
                      {
                        name: 'Custom',
                        value: signalAnalytics.typeCounts.custom,
                        color: '#6B7280',
                      },
                    ].filter((d) => d.value > 0);
                    return (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={signalTypeData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ name, value }) => `${name}: ${value}`}
                            labelLine
                          >
                            {signalTypeData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    );
                  })()
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <AlertTriangle className="h-12 w-12 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">No active signals</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      All students are on track
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Signal Resolution Outcomes</CardTitle>
                <CardDescription>How signals were resolved</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                {signalAnalytics && signalAnalytics.statusCounts.resolved > 0 ? (
                  (() => {
                    const resolutionData = [
                      {
                        status: 'Action Taken',
                        count: signalAnalytics.resolutionCounts.action_taken,
                        color: '#10B981',
                      },
                      {
                        status: 'Auto-Resolved',
                        count: signalAnalytics.resolutionCounts.auto_resolved,
                        color: '#3B82F6',
                      },
                      {
                        status: 'No Action Needed',
                        count: signalAnalytics.resolutionCounts.no_action_needed,
                        color: '#F59E0B',
                      },
                      {
                        status: 'Dismissed',
                        count: signalAnalytics.resolutionCounts.dismissed,
                        color: '#6B7280',
                      },
                    ].filter((d) => d.count > 0);
                    return (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={resolutionData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" name="Signals">
                            {resolutionData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    );
                  })()
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <Target className="h-12 w-12 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">No resolved signals yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Resolution data will appear here
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Signal Trends (Last 30 Days)</CardTitle>
              <CardDescription>Daily signal creation and resolution activity</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {signalAnalytics?.dailyTrend && signalAnalytics.dailyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={signalAnalytics.dailyTrend}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    <Line
                      type="monotone"
                      dataKey="created"
                      stroke="#EF4444"
                      strokeWidth={2}
                      name="Signals Created"
                      dot={{ fill: '#EF4444', r: 2 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="resolved"
                      stroke="#10B981"
                      strokeWidth={2}
                      name="Signals Resolved"
                      dot={{ fill: '#10B981', r: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <TrendingUp className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No signal trend data yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Trends will appear as signals are created
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Application Pipeline</CardTitle>
              <CardDescription>Applications by stage</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    {
                      name: 'Applications',
                      inProgress: analyticsData.applications.inProgress,
                      submitted: analyticsData.applications.submitted,
                      interviewing: analyticsData.applications.interviewing,
                      offers: analyticsData.applications.offers,
                    },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="inProgress" fill="#4F46E5" name="In Progress" />
                  <Bar dataKey="submitted" fill="#F59E0B" name="Submitted" />
                  <Bar dataKey="interviewing" fill="#EF4444" name="Interviewing" />
                  <Bar dataKey="offers" fill="#8B5CF6" name="Offers" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}

      {/* AI Predictions View */}
      {analyticsView === 'predictions' &&
        (universityId ? (
          <EngagementPredictionPanel universityId={universityId} />
        ) : (
          <Card>
            <CardContent className="flex items-center gap-3 py-6">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span className="text-muted-foreground">
                University context required for AI predictions.
              </span>
            </CardContent>
          </Card>
        ))}

      {/* Department Performance - Shared Across All Views */}
      <Card>
        <CardHeader>
          <CardTitle>Department Performance</CardTitle>
          <CardDescription>Usage metrics by academic department</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(departmentAnalytics || []).map((dept) => (
              <Card key={dept.departmentId}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-lg">{dept.departmentName}</CardTitle>
                    {dept.departmentCode && (
                      <span className="text-xs text-muted-foreground">{dept.departmentCode}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Students</span>
                      <span className="font-medium">{dept.studentCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Goals Set</span>
                      <span className="font-medium">{dept.goalsCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Applications</span>
                      <span className="font-medium">{dept.applicationsCount}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!departmentAnalytics || departmentAnalytics.length === 0) && (
              <div className="col-span-full text-center text-muted-foreground py-8">
                No departments configured yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
