'use client';

import { api } from 'convex/_generated/api';
import { useQuery } from 'convex/react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Award,
  BarChart3,
  Briefcase,
  FileText,
  GraduationCap,
  Heart,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
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

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type {
  ActivityData,
  ChartDataPoint,
  Department,
  FeatureUsageData,
  PlatformUsageData,
  RiskSegmentData,
  Student,
  StudentMetrics,
  StudentProgress,
  UniversityOverview,
} from '../types';

interface MomentumDistribution {
  green: number;
  yellow: number;
  red: number;
  unknown: number;
  total: number;
}

interface OverviewTabProps {
  clerkId: string | undefined;
  overview: UniversityOverview;
  studentMetrics: StudentMetrics | undefined;
  students: Student[];
  departments: Department[];
  studentProgress: StudentProgress[];
  platformUsageData: PlatformUsageData[];
  activityData: ActivityData[];
  departmentDistributionData: ChartDataPoint[];
  progressCompletionData: ChartDataPoint[];
  topFeaturesData: FeatureUsageData[];
  atRiskStudentsData: RiskSegmentData[];
  momentumDistribution: MomentumDistribution | undefined;
  isUniversityAdmin: boolean;
  onStudentClick: (clerkId: string) => void;
}

export function OverviewTab({
  clerkId,
  overview,
  studentMetrics,
  students,
  departments,
  studentProgress,
  platformUsageData,
  activityData,
  departmentDistributionData,
  progressCompletionData,
  topFeaturesData,
  atRiskStudentsData,
  momentumDistribution,
  isUniversityAdmin,
  onStudentClick,
}: OverviewTabProps) {
  // Fetch activity trends for charts
  const activityTrends = useQuery(
    api.university_analytics.getActivityTrends,
    clerkId ? { clerkId } : 'skip',
  );

  // Fetch asset completion stats
  const assetStats = useQuery(
    api.university_analytics.getAssetCompletionStats,
    clerkId ? { clerkId } : 'skip',
  );

  const atRiskCount = studentProgress?.filter((s) => s.completion < 30).length || 0;
  const atRiskPercent =
    (overview?.totalStudents ?? 0) > 0
      ? Math.round((atRiskCount / (overview?.totalStudents ?? 1)) * 100)
      : 0;

  // Calculate Health Score (weighted average of key metrics)
  const healthScore = (() => {
    if (!momentumDistribution || momentumDistribution.total === 0) return null;
    const greenPercent = (momentumDistribution.green / momentumDistribution.total) * 100;
    const yellowPercent = (momentumDistribution.yellow / momentumDistribution.total) * 100;
    // Weight: green = 100%, yellow = 50%, red = 0%
    return Math.round(greenPercent + yellowPercent * 0.5);
  })();

  return (
    <>
      {isUniversityAdmin && (
        <Card className="border-dashed bg-white/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Admin Shortcuts</CardTitle>
            <CardDescription>Quick access to configuration screens.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/u/admin/departments">Departments</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/u/admin/courses">Courses</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/u/admin/invite">Invitations</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/u/admin/settings">Settings</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Health Score Hero Section */}
      {healthScore !== null && (
        <Card className="bg-gradient-to-r from-primary-50 via-white to-emerald-50 border-primary-200">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="p-4 bg-white rounded-2xl shadow-sm">
                  <Heart className="h-8 w-8 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-primary-700 uppercase tracking-wide">
                    Student Health Score
                  </p>
                  <div className="flex items-baseline gap-3 mt-1">
                    <span className="text-5xl font-bold text-primary-900">{healthScore}</span>
                    <span className="text-2xl text-primary-600">/100</span>
                    {healthScore >= 70 ? (
                      <span className="flex items-center text-emerald-600 font-medium">
                        <ArrowUp className="h-4 w-4 mr-1" />
                        Healthy
                      </span>
                    ) : healthScore >= 40 ? (
                      <span className="flex items-center text-amber-600 font-medium">
                        <Activity className="h-4 w-4 mr-1" />
                        Moderate
                      </span>
                    ) : (
                      <span className="flex items-center text-red-600 font-medium">
                        <ArrowDown className="h-4 w-4 mr-1" />
                        Needs Attention
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-primary-600 mt-2">
                    Based on student momentum signals and engagement patterns
                  </p>
                </div>
              </div>
              {momentumDistribution && (
                <div className="hidden md:flex gap-6">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      <span className="text-2xl font-bold text-emerald-700">
                        {momentumDistribution.green}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">On Track</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <span className="text-2xl font-bold text-amber-700">
                        {momentumDistribution.yellow}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Slipping</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-2xl font-bold text-red-700">
                        {momentumDistribution.red}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Stalled</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stat Cards Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Active Students This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Users className="h-5 w-5 text-muted-foreground mr-2" />
              <div className="text-2xl font-bold">{overview?.activeStudents ?? 0}</div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">Unique students who engaged</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Average Asset Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Target className="h-5 w-5 text-muted-foreground mr-2" />
              <div className="text-2xl font-bold">{studentMetrics?.avgCareerCompletion || 0}%</div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">Career assets completed</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Total Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Briefcase className="h-5 w-5 text-muted-foreground mr-2" />
              <div className="text-2xl font-bold">{studentMetrics?.totalApplications || 0}</div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">Job applications submitted</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">At-Risk Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-muted-foreground mr-2" />
              <div className="text-2xl font-bold">{atRiskCount}</div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {atRiskPercent}% of total students
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="space-y-6">
        {/* Stat Cards Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.totalStudents}</div>
              {overview.studentGrowthPercent !== undefined &&
                overview.studentGrowthPercent !== 0 && (
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                    <TrendingUp
                      className={`h-3 w-3 ${overview.studentGrowthPercent > 0 ? 'text-green-500' : 'text-red-500'}`}
                    />
                    <span
                      className={
                        overview.studentGrowthPercent > 0 ? 'text-green-500' : 'text-red-500'
                      }
                    >
                      {overview.studentGrowthPercent > 0 ? '+' : ''}
                      {overview.studentGrowthPercent}%
                    </span>
                    <span>from last month</span>
                  </div>
                )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">License Usage</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {overview.activeLicenses} / {overview.licenseCapacity}
              </div>
              <Progress
                value={
                  overview.licenseCapacity
                    ? (overview.activeLicenses / overview.licenseCapacity) * 100
                    : 0
                }
                className="mt-2 h-2"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Active Students</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Users className="h-5 w-5 text-muted-foreground mr-2" />
                <div className="text-2xl font-bold">{overview.activeStudents ?? 0}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">This month</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Applications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Award className="h-5 w-5 text-muted-foreground mr-2" />
                <div className="text-2xl font-bold">{studentMetrics?.totalApplications || 0}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Tracked this semester</div>
            </CardContent>
          </Card>
        </div>

        {/* Platform Usage & Weekly Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Platform Usage</CardTitle>
              <CardDescription>
                Monthly feature adoption and student engagement over the last 6 months
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={platformUsageData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="goals"
                    stroke="#4F46E5"
                    strokeWidth={2}
                    name="Goals Set"
                  />
                  <Line
                    type="monotone"
                    dataKey="applications"
                    stroke="#10B981"
                    strokeWidth={2}
                    name="Applications"
                  />
                  <Line
                    type="monotone"
                    dataKey="resumes"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    name="Resumes"
                  />
                  <Line
                    type="monotone"
                    dataKey="coverLetters"
                    stroke="#EF4444"
                    strokeWidth={2}
                    name="Cover Letters"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Weekly Activity</CardTitle>
              <CardDescription>Daily logins and assignment submissions</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="logins" fill="#4F46E5" name="Logins">
                    <LabelList dataKey="logins" position="top" />
                  </Bar>
                  <Bar dataKey="assignments" fill="#10B981" name="Assignments">
                    <LabelList dataKey="assignments" position="top" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Student Activity Trends & Asset Completion */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Weekly Activity Trends Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Student Activity Trends</CardTitle>
              <CardDescription>
                Weekly student engagement and feature usage patterns
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {!activityTrends?.weeklyTrends || activityTrends.weeklyTrends.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" aria-hidden="true" />
                    <p className="text-sm">No activity data available yet</p>
                    <p className="text-xs mt-1">
                      Activity will appear as students use the platform
                    </p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activityTrends.weeklyTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="events" fill="#6366F1" name="Total Events">
                      <LabelList dataKey="events" position="top" />
                    </Bar>
                    <Bar dataKey="uniqueUsers" fill="#10B981" name="Active Students">
                      <LabelList dataKey="uniqueUsers" position="top" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Asset Completion Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Asset Completion Breakdown</CardTitle>
              <CardDescription>Average assets per student across categories</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {!assetStats || assetStats.totalStudents === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" aria-hidden="true" />
                    <p className="text-sm">No asset data available</p>
                    <p className="text-xs mt-1">Data appears as students create content</p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      {
                        name: 'Resumes',
                        avg: assetStats.avgResumes,
                        students: assetStats.studentsWithResume,
                      },
                      {
                        name: 'Cover Letters',
                        avg: assetStats.avgCoverLetters,
                        students: assetStats.studentsWithCoverLetter,
                      },
                      {
                        name: 'Goals',
                        avg: assetStats.avgGoals,
                        students: assetStats.studentsWithGoals,
                      },
                      {
                        name: 'Applications',
                        avg: assetStats.avgApplications,
                        students: assetStats.studentsWithApplications,
                      },
                    ]}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        if (name === 'Avg per Student') return value.toFixed(1);
                        return value;
                      }}
                    />
                    <Legend />
                    <Bar dataKey="avg" fill="#8B5CF6" name="Avg per Student" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Category Usage Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Feature Category Breakdown</CardTitle>
            <CardDescription>Activity breakdown by feature category (last 4 weeks)</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {!activityTrends?.categoryBreakdown || activityTrends.categoryBreakdown.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" aria-hidden="true" />
                  <p className="text-sm">No category data available</p>
                  <p className="text-xs mt-1">
                    Usage data will appear as students interact with features
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={activityTrends.categoryBreakdown.filter((c) => c.count > 0)}
                      dataKey="count"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ category, percent }) =>
                        `${category}: ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {activityTrends.categoryBreakdown.map((entry, index) => (
                        <Cell
                          key={entry.category}
                          fill={['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][index % 5]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col justify-center space-y-3">
                  {activityTrends.categoryBreakdown.map((category, index) => (
                    <div key={category.category} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor: [
                              '#6366F1',
                              '#10B981',
                              '#F59E0B',
                              '#EF4444',
                              '#8B5CF6',
                            ][index % 5],
                          }}
                        />
                        <span className="text-sm">{category.category}</span>
                      </div>
                      <span className="text-sm font-medium">{category.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Student Distribution & Progress Completion */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Student Distribution by Department</CardTitle>
              <CardDescription>Enrollment breakdown across academic departments</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {departmentDistributionData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <p className="text-sm">No student data available</p>
                    <p className="text-xs mt-2">
                      {!departments || departments.length === 0
                        ? 'Create departments first'
                        : !students || students.length === 0
                          ? 'Invite students to see distribution'
                          : 'Assign students to departments'}
                    </p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={departmentDistributionData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ value }) => `${value}%`}
                      labelLine={true}
                    >
                      {departmentDistributionData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            ['#4F46E5', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#EF4444'][
                              index % 6
                            ]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name, props) => [
                        `${value}% (${props.payload.count} students)`,
                        'Enrollment',
                      ]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Overall Progress Completion Rate</CardTitle>
              <CardDescription>
                Percentage of students who have completed core career assets
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={progressCompletionData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={({ value }) => `${value}%`}
                    labelLine={true}
                  >
                    {progressCompletionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#10B981', '#F59E0B', '#EF4444'][index]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name, props) => [
                      `${value}% (${props.payload.count} students)`,
                      'Students',
                    ]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Top Features */}
        <Card>
          <CardHeader>
            <CardTitle>Top Features Used</CardTitle>
            <CardDescription>
              Ranked bar chart of the most frequently accessed tools
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topFeaturesData}
                margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="feature" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="usage" fill="#4F46E5" name="Total Count">
                  <LabelList dataKey="usage" position="top" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* At-Risk Students Segment */}
        <Card>
          <CardHeader>
            <CardTitle>At-Risk Students Segment</CardTitle>
            <CardDescription>Students with both low progress and low usage</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={atRiskStudentsData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="segment" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#4F46E5" name="Student Count">
                  <LabelList dataKey="count" position="top" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Students */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Students</CardTitle>
          <CardDescription>Latest users in your institution</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students
                .filter((s) => s.role === 'user' || s.role === 'student')
                .slice(0, 8)
                .map((s) => (
                  <TableRow
                    key={s._id as string}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => s.clerkId && onStudentClick(s.clerkId)}
                  >
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.email}</TableCell>
                    <TableCell className="uppercase text-xs text-muted-foreground">
                      {s.role}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          Showing{' '}
          {Math.min(8, students.filter((s) => s.role === 'user' || s.role === 'student').length)} of{' '}
          {students.filter((s) => s.role === 'user' || s.role === 'student').length}
        </CardFooter>
      </Card>
    </>
  );
}
