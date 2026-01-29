'use client';

import { Id } from 'convex/_generated/dataModel';
import { Mail } from 'lucide-react';
import { useState } from 'react';
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

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { SendReminderDialog } from '../dialogs';
import type {
  ActiveUsersData,
  ActivityData,
  AnalyticsView,
  FeatureEngagementByRisk,
  FeatureUsageData,
  RiskSegmentData,
  Student,
  StudentFunnelResponse,
  UniversityOverview,
} from '../types';

interface AnalyticsTabProps {
  overview: UniversityOverview;
  students: Student[];
  activeUsersData: ActiveUsersData | undefined;
  studentFunnel: StudentFunnelResponse | undefined;
  activityData: ActivityData[];
  topFeaturesData: FeatureUsageData[];
  atRiskStudentsData: RiskSegmentData[];
  featureEngagementByRisk: FeatureEngagementByRisk[];
}

export function AnalyticsTab({
  overview,
  students,
  activeUsersData,
  studentFunnel,
  activityData,
  topFeaturesData,
  atRiskStudentsData,
  featureEngagementByRisk,
}: AnalyticsTabProps) {
  const [analyticsView, setAnalyticsView] = useState<AnalyticsView>('engagement');
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<{
    _id: Id<'users'>;
    name: string | undefined;
    email: string;
  } | null>(null);

  const handleSendReminder = (student: Student) => {
    setSelectedStudent({
      _id: student._id as Id<'users'>,
      name: student.name,
      email: student.email,
    });
    setReminderDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Analytics Sub-Toggles */}
      <div className="flex flex-wrap gap-2 bg-gray-50 p-3 rounded-lg">
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
          Career Tool Usage
        </Button>
        <Button
          size="sm"
          variant={analyticsView === 'risk' ? 'default' : 'outline'}
          onClick={() => setAnalyticsView('risk')}
          className={analyticsView === 'risk' ? 'bg-[#0C29AB]' : ''}
        >
          At-Risk Analysis
        </Button>
      </div>

      {/* Analytics: Engagement */}
      {analyticsView === 'engagement' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Daily Active Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {activeUsersData?.data?.slice(-1)?.[0]?.students ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  of{' '}
                  {activeUsersData?.totalStudents ??
                    overview?.totalStudents ??
                    students?.length ??
                    0}{' '}
                  total students
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Total Students</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {activeUsersData?.totalStudents ?? overview?.totalStudents ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Registered students</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Total Advisors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeUsersData?.totalAdvisors ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Registered advisors</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Peak Daily Active (7d)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {activeUsersData?.data
                    ?.slice(-7)
                    ?.reduce((sum, d) => Math.max(sum, d.students), 0) ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Peak daily active in the last 7 days
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Student Activity Trends</CardTitle>
              <CardDescription>
                Daily active students and advisors over the last 30 days
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activeUsersData?.data || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="students"
                    stroke="#4F46E5"
                    strokeWidth={2}
                    name="Active Students"
                  />
                  <Line
                    type="monotone"
                    dataKey="advisors"
                    stroke="#10B981"
                    strokeWidth={2}
                    name="Active Advisors"
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
      )}

      {/* Analytics: Career Tool Usage */}
      {analyticsView === 'features' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Asset Completion Breakdown by Category</CardTitle>
                <CardDescription>Total counts of student-created career assets</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topFeaturesData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="feature" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="usage" fill="#4F46E5" name="Total Count">
                      <LabelList dataKey="usage" position="top" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

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
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Career Outcomes Funnel</CardTitle>
              <CardDescription>
                Student progression through career development stages
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={
                    studentFunnel?.funnel?.length
                      ? studentFunnel.funnel.map((item) => ({
                          stage: item.stage,
                          count: item.count,
                          percentage: item.percent,
                        }))
                      : [
                          {
                            stage: 'Active Students',
                            count: activeUsersData?.totalStudents ?? overview?.totalStudents ?? 0,
                            percentage: 100,
                          },
                        ]
                  }
                  margin={{ top: 20, right: 30, left: 120, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="stage" type="category" width={110} />
                  <Tooltip
                    formatter={(value, name, props) => [
                      `${value} students (${props.payload.percentage}%)`,
                      'Count',
                    ]}
                  />
                  <Bar dataKey="count" fill="#4F46E5" name="Students">
                    <LabelList
                      dataKey="percentage"
                      position="right"
                      formatter={(value: number) => `${value}%`}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analytics: At-Risk */}
      {analyticsView === 'risk' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-red-600">High Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {atRiskStudentsData.find((d) => d.segment === 'High Risk')?.count || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Career completion below 20%</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-orange-600">Medium Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {atRiskStudentsData.find((d) => d.segment === 'Medium Risk')?.count || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Career completion 20-50%</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-green-600">Low Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {atRiskStudentsData.find((d) => d.segment === 'Low Risk')?.count || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Career completion above 50%</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>At-Risk Students Segment</CardTitle>
                <CardDescription>Distribution of students by risk level</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={atRiskStudentsData}
                      dataKey="count"
                      nameKey="segment"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ value, percent }) => `${value} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={true}
                    >
                      {atRiskStudentsData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={['#EF4444', '#F59E0B', '#10B981'][index]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Feature Engagement by Risk Level</CardTitle>
                <CardDescription>Average feature usage for at-risk students</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={featureEngagementByRisk}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="feature" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="highRisk" fill="#EF4444" name="High Risk" />
                    <Bar dataKey="mediumRisk" fill="#F59E0B" name="Medium Risk" />
                    <Bar dataKey="lowRisk" fill="#10B981" name="Low Risk" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>At-Risk Students List</CardTitle>
              <CardDescription>Students requiring immediate attention</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students
                    .filter(
                      (s) =>
                        s.engagement_status === 'at_risk' || s.engagement_status === 'moderate',
                    )
                    .slice(0, 5)
                    .map((s) => {
                      const riskLevel = s.engagement_status === 'at_risk' ? 'high' : 'medium';
                      const daysAgo = s.last_active
                        ? Math.floor((Date.now() - s.last_active) / (1000 * 60 * 60 * 24))
                        : null;
                      return (
                        <TableRow key={s._id as string}>
                          <TableCell className="font-medium">{s.name || 'Unknown'}</TableCell>
                          <TableCell>{s.email}</TableCell>
                          <TableCell>
                            <Badge
                              variant={riskLevel === 'high' ? 'destructive' : 'default'}
                              className={riskLevel === 'medium' ? 'bg-orange-600' : ''}
                            >
                              {riskLevel.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {daysAgo !== null ? `${daysAgo} days ago` : 'Never'}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSendReminder(s)}
                            >
                              <Mail className="h-3 w-3 mr-1" />
                              Send Reminder
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Send Reminder Dialog */}
      {selectedStudent && (
        <SendReminderDialog
          open={reminderDialogOpen}
          onOpenChange={setReminderDialogOpen}
          student={selectedStudent}
        />
      )}
    </div>
  );
}
