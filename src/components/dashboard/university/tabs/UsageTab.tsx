'use client';

import { api } from 'convex/_generated/api';
import { useQuery } from 'convex/react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

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

import type { Department, PlatformUsageData, UsageView } from '../types';

interface UsageTabProps {
  clerkId: string | undefined;
  departments: Department[];
  platformUsageData: PlatformUsageData[];
  onViewReport: (name: string, type: string) => void;
  onDownloadReport: (name: string, type: string) => void;
}

export function UsageTab({
  clerkId,
  departments,
  platformUsageData,
  onViewReport,
  onDownloadReport,
}: UsageTabProps) {
  const [usageTimeFilter, setUsageTimeFilter] = useState('Last month');
  const [usageProgramFilter, setUsageProgramFilter] = useState('All Programs');
  const [usageView, setUsageView] = useState<UsageView>('overview');

  // Map filter to API parameter
  const timeFilterParam = useMemo(() => {
    switch (usageTimeFilter) {
      case 'Last 3 months':
        return 'last_3_months';
      case 'Last 6 months':
        return 'last_6_months';
      default:
        return 'last_month';
    }
  }, [usageTimeFilter]);

  // Fetch usage metrics
  const usageMetrics = useQuery(
    api.university_analytics.getUsageMetrics,
    clerkId ? { clerkId, timeFilter: timeFilterParam } : 'skip',
  );

  return (
    <div className="space-y-6">
      {/* Platform Usage Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Platform Usage</CardTitle>
              <CardDescription>
                Monitor and analyze how students are using the Ascentful Career Development
                platform.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <select
                className="px-3 py-1 text-sm border rounded-md bg-white"
                value={usageTimeFilter}
                onChange={(e) => setUsageTimeFilter(e.target.value)}
              >
                <option>Last month</option>
                <option>Last 3 months</option>
                <option>Last 6 months</option>
              </select>
              <select
                className="px-3 py-1 text-sm border rounded-md bg-white opacity-50 cursor-not-allowed"
                value={usageProgramFilter}
                onChange={(e) => setUsageProgramFilter(e.target.value)}
                disabled
                title="Program filtering coming soon"
              >
                <option>All Programs</option>
                {departments?.map((dept) => (
                  <option key={dept._id as string} value={dept.name}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Total Logins */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Logins</p>
                    <p className="text-2xl font-bold">
                      {usageMetrics?.totalLogins?.toLocaleString() ?? '--'}
                    </p>
                    {usageMetrics?.loginTrend !== undefined && usageMetrics.loginTrend !== 0 && (
                      <p
                        className={`text-xs flex items-center gap-1 ${usageMetrics.loginTrend > 0 ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {usageMetrics.loginTrend > 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {usageMetrics.loginTrend > 0 ? '+' : ''}
                        {usageMetrics.loginTrend}% vs prev period
                      </p>
                    )}
                  </div>
                  <div className="text-green-600">
                    <svg
                      className="w-8 h-8"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Active Users */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Users (30d)</p>
                    <p className="text-2xl font-bold">
                      {usageMetrics?.activeUsers30d?.toLocaleString() ?? '--'}
                    </p>
                    {usageMetrics?.activeUsersTrend !== undefined &&
                      usageMetrics.activeUsersTrend !== 0 && (
                        <p
                          className={`text-xs flex items-center gap-1 ${usageMetrics.activeUsersTrend > 0 ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {usageMetrics.activeUsersTrend > 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {usageMetrics.activeUsersTrend > 0 ? '+' : ''}
                          {usageMetrics.activeUsersTrend}% vs prev period
                        </p>
                      )}
                  </div>
                  <div className="text-blue-600">
                    <svg
                      className="w-8 h-8"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Active Users 7d */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Users (7d)</p>
                    <p className="text-2xl font-bold">
                      {usageMetrics?.activeUsers7d?.toLocaleString() ?? '--'}
                    </p>
                    <p className="text-xs text-muted-foreground">Last 7 days</p>
                  </div>
                  <div className="text-purple-600">
                    <svg
                      className="w-8 h-8"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Feature Usage */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Feature Usage</p>
                    <p className="text-2xl font-bold">
                      {usageMetrics?.featureUsageCount?.toLocaleString() ?? '--'}
                    </p>
                    <p className="text-xs text-muted-foreground">Total actions</p>
                  </div>
                  <div className="text-orange-600">
                    <svg
                      className="w-8 h-8"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                    </svg>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-2 mb-4">
            <Button
              variant={usageView === 'overview' ? 'default' : 'outline'}
              size="sm"
              className={usageView === 'overview' ? 'bg-[#0C29AB]' : ''}
              onClick={() => setUsageView('overview')}
            >
              Overview
            </Button>
            <Button
              variant={usageView === 'features' ? 'default' : 'outline'}
              size="sm"
              className={usageView === 'features' ? 'bg-[#0C29AB]' : ''}
              onClick={() => setUsageView('features')}
            >
              Features
            </Button>
            <Button
              variant={usageView === 'programs' ? 'default' : 'outline'}
              size="sm"
              className={usageView === 'programs' ? 'bg-[#0C29AB]' : ''}
              onClick={() => setUsageView('programs')}
            >
              Programs
            </Button>
          </div>

          {/* Content based on selected view */}
          {usageView === 'overview' && (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={platformUsageData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
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
                    dataKey="goals"
                    stroke="#4F46E5"
                    strokeWidth={2}
                    name="Goals"
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
            </div>
          )}

          {usageView === 'features' && (
            <div className="h-80 flex items-center justify-center border border-dashed border-slate-300 rounded-lg bg-slate-50">
              <div className="text-center">
                <p className="text-slate-500 font-medium">Feature Usage Analytics</p>
                <p className="text-sm text-slate-400 mt-1">
                  Detailed breakdown by feature coming soon
                </p>
              </div>
            </div>
          )}

          {usageView === 'programs' && (
            <div className="h-80 flex items-center justify-center border border-dashed border-slate-300 rounded-lg bg-slate-50">
              <div className="text-center">
                <p className="text-slate-500 font-medium">Program Usage Analytics</p>
                <p className="text-sm text-slate-400 mt-1">
                  Usage breakdown by program coming soon
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Reports Section */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
          <CardDescription>
            Access and download previously generated reports. (Sample data shown)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Report Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Monthly Student Activity Report</TableCell>
                <TableCell>2024-01-15</TableCell>
                <TableCell>Student Analytics</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onViewReport('Monthly Student Activity Report', 'Student Analytics')
                      }
                    >
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onDownloadReport('Monthly Student Activity Report', 'Student Analytics')
                      }
                    >
                      Download
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Department Usage Summary</TableCell>
                <TableCell>2024-01-10</TableCell>
                <TableCell>Department Analytics</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onViewReport('Department Usage Summary', 'Department Analytics')
                      }
                    >
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onDownloadReport('Department Usage Summary', 'Department Analytics')
                      }
                    >
                      Download
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Career Tool Usage Report</TableCell>
                <TableCell>2024-01-05</TableCell>
                <TableCell>Career Platform Analytics</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onViewReport('Career Tool Usage Report', 'Career Platform Analytics')
                      }
                    >
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onDownloadReport('Career Tool Usage Report', 'Career Platform Analytics')
                      }
                    >
                      Download
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
