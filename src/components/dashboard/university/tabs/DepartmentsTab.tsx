'use client';

import { api } from 'convex/_generated/api';
import { useQuery } from 'convex/react';
import { Award, BarChart as BarChartIcon, BarChart3, GraduationCap, Users } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

import type { Department, Student, StudentProgress, UniversityOverview } from '../types';

interface DepartmentsTabProps {
  clerkId: string | undefined;
  departments: Department[];
  students: Student[];
  studentProgress: StudentProgress[];
  overview: UniversityOverview;
}

export function DepartmentsTab({
  clerkId,
  departments,
  students,
  studentProgress,
  overview,
}: DepartmentsTabProps) {
  // Fetch department activity data
  const departmentActivity = useQuery(
    api.university_analytics.getDepartmentActivity,
    clerkId ? { clerkId } : 'skip',
  );

  // Helper to get department students and calculate metrics
  const getDepartmentMetrics = (deptId: string) => {
    const deptStudents = students.filter((s) => s.department_id === deptId);
    const deptProgress = (studentProgress || []).filter((p) =>
      students.some((s) => s._id === (p.studentId || p.userId) && s.department_id === deptId),
    );
    const avgProgress =
      deptProgress.length > 0
        ? Math.round(deptProgress.reduce((sum, p) => sum + p.completion, 0) / deptProgress.length)
        : 0;
    const activeStudents = deptProgress.filter((p) => p.completion > 0).length;
    const utilization =
      deptStudents.length > 0 ? Math.round((activeStudents / deptStudents.length) * 100) : 0;

    return { deptStudents, avgProgress, utilization };
  };

  // Calculate average completion for students with departments
  const getAvgCompletion = () => {
    const studentsWithDepts = students.filter((s) => s.department_id);
    if (studentsWithDepts.length === 0) return '0%';

    const totalCompletion = studentsWithDepts.reduce((sum, student) => {
      const progress = (studentProgress || []).find(
        (p) => (p.studentId || p.userId) === student._id,
      );
      return sum + (progress?.completion || 0);
    }, 0);

    return Math.round(totalCompletion / studentsWithDepts.length) + '%';
  };

  // Find highest enrollment department
  const getHighestEnrollment = () => {
    const dists = overview?.departmentDistribution ?? [];
    if (dists.length === 0) return { name: 'N/A', count: 0 };
    return dists.reduce((max, d) => (d.count > max.count ? d : max), { name: 'N/A', count: 0 });
  };

  const highest = getHighestEnrollment();

  return (
    <div className="space-y-6">
      {/* Department Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Total Departments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <GraduationCap className="h-5 w-5 text-muted-foreground mr-2" />
              <div className="text-2xl font-bold">{departments.length}</div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">Academic departments</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Average Students/Dept</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Users className="h-5 w-5 text-muted-foreground mr-2" />
              <div className="text-2xl font-bold">
                {(overview?.departments ?? 0) > 0
                  ? Math.round(
                      ((overview?.totalStudents ?? 0) - (overview?.unassignedStudents ?? 0)) /
                        (overview?.departments ?? 1),
                    )
                  : 0}
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {(overview?.unassignedStudents ?? 0) > 0 && (
                <span className="text-amber-600">
                  {overview?.unassignedStudents ?? 0} unassigned
                </span>
              )}
              {(overview?.unassignedStudents ?? 0) === 0 && 'Student distribution'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Highest Enrollment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Award className="h-5 w-5 text-muted-foreground mr-2" />
              <div className="text-lg font-bold">{highest.count > 0 ? highest.name : 'N/A'}</div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {highest.count > 0 ? `${highest.count} students` : 'No students assigned'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Avg Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <BarChartIcon className="h-5 w-5 text-muted-foreground mr-2" />
              <div className="text-2xl font-bold">{getAvgCompletion()}</div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">Avg career assets completion</div>
          </CardContent>
        </Card>
      </div>

      {/* Department Usage Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Student Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Student Distribution by Department</CardTitle>
            <CardDescription>Enrollment breakdown across academic departments</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={departments.map((d, index) => {
                    const deptStudents = students.filter((s) => s.department_id === d._id);
                    const percentage =
                      departments.length > 0 && students.length > 0
                        ? Math.round((deptStudents.length / students.length) * 100)
                        : 0;
                    return {
                      name: d.name,
                      value: percentage,
                      students: deptStudents.length,
                      color: ['#4F46E5', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4'][
                        index % 6
                      ],
                    };
                  })}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ value }) => `${value}%`}
                  labelLine={true}
                >
                  {departments.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        ['#4F46E5', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4'][
                          index % 6
                        ]
                      }
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value}%`, name]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Department Utilization Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Department Utilization Trends</CardTitle>
            <CardDescription>Student engagement and activity by department</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {!departments || departments.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <p className="text-sm">No department data available</p>
                  <p className="text-xs mt-2">Create departments to see utilization trends</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={departments.map((d) => {
                    const { deptStudents, avgProgress, utilization } = getDepartmentMetrics(
                      d._id as string,
                    );
                    return {
                      name: d.code || d.name.substring(0, 15),
                      students: deptStudents.length,
                      utilization,
                      avgProgress,
                    };
                  })}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="students" fill="#4F46E5" name="Students">
                    <LabelList dataKey="students" position="top" />
                  </Bar>
                  <Bar dataKey="utilization" fill="#10B981" name="Utilization %">
                    <LabelList
                      dataKey="utilization"
                      position="top"
                      formatter={(value: number) => `${value}%`}
                    />
                  </Bar>
                  <Bar dataKey="avgProgress" fill="#F59E0B" name="Avg Progress %">
                    <LabelList
                      dataKey="avgProgress"
                      position="top"
                      formatter={(value: number) => `${value}%`}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Department Activity Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Department Activity Overview</CardTitle>
          <CardDescription>Activity metrics by department (last 30 days)</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          {!departmentActivity?.departments || departmentActivity.departments.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" aria-hidden="true" />
                <p className="text-sm">No department activity data available</p>
                <p className="text-xs mt-1">Activity will appear as students use the platform</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={departmentActivity.departments.slice(0, 8)}
                layout="vertical"
                margin={{ left: 20, right: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis
                  dataKey="departmentName"
                  type="category"
                  width={120}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'Avg Events/Student') return value.toFixed(1);
                    return value;
                  }}
                />
                <Legend />
                <Bar dataKey="totalStudents" fill="#6366F1" name="Students" />
                <Bar dataKey="activeStudents" fill="#10B981" name="Active Students" />
                <Bar dataKey="avgEventsPerStudent" fill="#F59E0B" name="Avg Events/Student" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Detailed Department List */}
      <Card>
        <CardHeader>
          <CardTitle>Department Details</CardTitle>
          <CardDescription>Comprehensive overview of all academic departments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((d) => {
              const { deptStudents, avgProgress, utilization } = getDepartmentMetrics(
                d._id as string,
              );

              return (
                <Card key={String(d._id)} className="relative">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-lg">{d.name}</CardTitle>
                      {d.code && <Badge variant="outline">{d.code}</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Students</span>
                        <span className="font-medium">{deptStudents.length}</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Utilization</span>
                          <span className="font-medium">{utilization}%</span>
                        </div>
                        <Progress value={utilization} className="h-2" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Avg Progress</span>
                          <span className="font-medium">{avgProgress}%</span>
                        </div>
                        <Progress value={avgProgress} className="h-2" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          Active
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
