'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useQuery } from 'convex/react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Building2,
  GraduationCap,
  Loader2,
  Minus,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  UserX,
} from 'lucide-react';
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

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function AdminEngagementPage() {
  const { user: clerkUser, isLoaded } = useUser();

  // Check if user is super admin before running queries
  const userRole = clerkUser?.publicMetadata?.role as string | undefined;
  const isSuperAdmin = userRole === 'super_admin';
  const shouldQuery = isLoaded && isSuperAdmin;

  const crossUniversityData = useQuery(
    api.admin_engagement_analytics.getCrossUniversityEngagement,
    shouldQuery ? { limit: 50 } : 'skip',
  );
  const rankings = useQuery(
    api.admin_engagement_analytics.getUniversityEngagementRanking,
    shouldQuery ? { sortBy: 'engaged_percent', order: 'desc', limit: 10 } : 'skip',
  );
  const signalAnalytics = useQuery(
    api.admin_engagement_analytics.getCrossUniversitySignalAnalytics,
    shouldQuery ? {} : 'skip',
  );
  const trends = useQuery(
    api.admin_engagement_analytics.getCrossUniversityTrends,
    shouldQuery ? { days: 30 } : 'skip',
  );

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle>Unauthorized</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              You don't have permission to view this page. Super admin access is required.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLoading = !crossUniversityData || !rankings || !signalAnalytics;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Platform Engagement Analytics</h1>
          <p className="text-muted-foreground">
            Cross-university engagement comparison and insights
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          <Building2 className="h-3 w-3 mr-1" />
          {crossUniversityData.summary.totalUniversities} Universities
        </Badge>
      </div>

      {/* Platform Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-blue-600" />
              Total Students
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {crossUniversityData.summary.totalStudents.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground mt-1">Across all universities</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-green-600" />
              Engaged Students
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {crossUniversityData.summary.avgEngagedPercent}%
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {crossUniversityData.summary.totalEngaged.toLocaleString()} students
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
              {crossUniversityData.summary.avgAtRiskPercent}%
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {crossUniversityData.summary.totalAtRisk.toLocaleString()} need attention
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
              {crossUniversityData.summary.totalActiveSignals.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground mt-1">Platform-wide</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-purple-600" />
              Resolution Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">
              {signalAnalytics.resolutionRate}%
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {signalAnalytics.avgResolutionHours !== null
                ? `Avg ${signalAnalytics.avgResolutionHours}h to resolve`
                : 'Signals resolved'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* University Ranking Table */}
      <Card>
        <CardHeader>
          <CardTitle>University Engagement Ranking</CardTitle>
          <CardDescription>Universities ranked by student engagement percentage</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Rank</TableHead>
                <TableHead>University</TableHead>
                <TableHead className="text-right">Students</TableHead>
                <TableHead className="text-right">Engaged %</TableHead>
                <TableHead className="text-right">At-Risk %</TableHead>
                <TableHead className="text-right">Avg Score</TableHead>
                <TableHead className="text-right">Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankings.map((uni) => (
                <TableRow key={uni.universityId}>
                  <TableCell className="font-medium">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                      {uni.rank}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{uni.universityName}</div>
                  </TableCell>
                  <TableCell className="text-right">{uni.totalStudents.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={
                        uni.engagedPercent >= 70
                          ? 'default'
                          : uni.engagedPercent >= 50
                            ? 'secondary'
                            : 'destructive'
                      }
                    >
                      {uni.engagedPercent}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={uni.atRiskPercent > 30 ? 'text-red-600 font-medium' : ''}>
                      {uni.atRiskPercent}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{uni.avgScore}</TableCell>
                  <TableCell className="text-right">
                    {uni.trend === 'up' ? (
                      <TrendingUp className="h-4 w-4 text-green-500 inline" />
                    ) : uni.trend === 'down' ? (
                      <TrendingDown className="h-4 w-4 text-red-500 inline" />
                    ) : (
                      <Minus className="h-4 w-4 text-muted-foreground inline" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Engagement Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Engagement Distribution</CardTitle>
            <CardDescription>Student engagement levels across all universities</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {(() => {
              const engagementDistributionData = [
                {
                  name: 'Engaged',
                  value: crossUniversityData.summary.totalEngaged,
                  color: '#10B981',
                },
                {
                  name: 'Moderate',
                  value: Math.max(
                    0,
                    crossUniversityData.summary.totalStudents -
                      crossUniversityData.summary.totalEngaged -
                      crossUniversityData.summary.totalAtRisk,
                  ),
                  color: '#3B82F6',
                },
                {
                  name: 'At Risk',
                  value: crossUniversityData.summary.totalAtRisk,
                  color: '#F59E0B',
                },
              ];
              return (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={engagementDistributionData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, value, percent }) =>
                        `${name}: ${value.toLocaleString()} (${(percent * 100).toFixed(0)}%)`
                      }
                      labelLine
                    >
                      {engagementDistributionData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
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

        {/* Signal Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Signal Status Distribution</CardTitle>
            <CardDescription>Platform-wide signal breakdown by status</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              {(() => {
                const statusData = [
                  {
                    status: 'Active',
                    count: signalAnalytics.statusCounts.active,
                    color: '#EF4444',
                  },
                  {
                    status: 'Snoozed',
                    count: signalAnalytics.statusCounts.snoozed,
                    color: '#F59E0B',
                  },
                  {
                    status: 'Resolved',
                    count: signalAnalytics.statusCounts.resolved,
                    color: '#10B981',
                  },
                  {
                    status: 'Dismissed',
                    count: signalAnalytics.statusCounts.dismissed,
                    color: '#6B7280',
                  },
                ];
                return (
                  <BarChart data={statusData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="status" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" name="Signals">
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                );
              })()}
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Signal Trends */}
      {trends && (
        <Card>
          <CardHeader>
            <CardTitle>Signal Trends (Last 30 Days)</CardTitle>
            <CardDescription>
              Daily signal creation and resolution activity platform-wide
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trends.dailyTrend}
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
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="signalsCreated"
                  stroke="#EF4444"
                  strokeWidth={2}
                  name="Signals Created"
                  dot={{ fill: '#EF4444', r: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="signalsResolved"
                  stroke="#10B981"
                  strokeWidth={2}
                  name="Signals Resolved"
                  dot={{ fill: '#10B981', r: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* University Comparison Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>University Engagement Comparison</CardTitle>
          <CardDescription>Engagement rates across universities</CardDescription>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={crossUniversityData.universities.slice(0, 10)}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <YAxis dataKey="universityName" type="category" width={90} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number) => [`${value}%`, '']} />
              <Legend />
              <Bar dataKey="engagedPercent" name="Engaged %" fill="#10B981" radius={[0, 4, 4, 0]} />
              <Bar dataKey="atRiskPercent" name="At-Risk %" fill="#F59E0B" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Priority Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Signal Priority Breakdown</CardTitle>
            <CardDescription>Active signals by priority level</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <div className="grid grid-cols-4 gap-4 h-full items-center">
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">
                  {signalAnalytics.priorityCounts.urgent}
                </div>
                <div className="text-sm text-muted-foreground">Urgent</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-500">
                  {signalAnalytics.priorityCounts.high}
                </div>
                <div className="text-sm text-muted-foreground">High</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-amber-500">
                  {signalAnalytics.priorityCounts.medium}
                </div>
                <div className="text-sm text-muted-foreground">Medium</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-500">
                  {signalAnalytics.priorityCounts.low}
                </div>
                <div className="text-sm text-muted-foreground">Low</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Signal Source Breakdown</CardTitle>
            <CardDescription>How signals are generated</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <div className="grid grid-cols-3 gap-4 h-full items-center">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {signalAnalytics.sourceCounts.rule}
                </div>
                <div className="text-sm text-muted-foreground">Rule-Based</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">
                  {signalAnalytics.sourceCounts.manual}
                </div>
                <div className="text-sm text-muted-foreground">Manual</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {signalAnalytics.sourceCounts.system}
                </div>
                <div className="text-sm text-muted-foreground">System</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
