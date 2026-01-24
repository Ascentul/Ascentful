'use client';

import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  Bell,
  CheckCircle2,
  Clock,
  Loader2,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
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

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/ClerkAuthProvider';

const PRIORITY_COLORS = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#9ca3af',
};

const STATUS_COLORS = {
  active: '#3b82f6',
  snoozed: '#a855f7',
  resolved: '#22c55e',
  dismissed: '#6b7280',
};

const TYPE_COLORS = {
  needs_outreach: '#3b82f6',
  application_support: '#8b5cf6',
  document_review: '#06b6d4',
  milestone_check: '#10b981',
  custom: '#f59e0b',
};

const TYPE_LABELS: Record<string, string> = {
  needs_outreach: 'Needs Outreach',
  application_support: 'Application Support',
  document_review: 'Document Review',
  milestone_check: 'Milestone Check',
  custom: 'Custom',
};

export default function SignalAnalyticsPage() {
  const { user } = useAuth();
  const universityId = user?.university_id as Id<'universities'> | undefined;

  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');

  // Calculate date range
  const now = Date.now();
  const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
  const start = now - daysMap[dateRange] * 24 * 60 * 60 * 1000;

  // Queries
  const analytics = useQuery(
    api.signals.getSignalAnalytics,
    universityId ? { universityId, dateRange: { start, end: now } } : 'skip',
  );

  const ruleEffectiveness = useQuery(
    api.signals.getRuleEffectiveness,
    universityId ? { universityId } : 'skip',
  );

  if (!universityId) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">No university access.</p>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  // Prepare chart data
  const priorityData = Object.entries(analytics.priorityCounts).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    fill: PRIORITY_COLORS[name as keyof typeof PRIORITY_COLORS],
  }));

  const typeData = Object.entries(analytics.typeCounts).map(([name, value]) => ({
    name: TYPE_LABELS[name] || name,
    value,
    fill: TYPE_COLORS[name as keyof typeof TYPE_COLORS],
  }));

  const sourceData = [
    { name: 'Rule-based', value: analytics.sourceCounts.rule ?? 0, fill: '#3b82f6' },
    { name: 'Manual', value: analytics.sourceCounts.manual ?? 0, fill: '#8b5cf6' },
    { name: 'System', value: analytics.sourceCounts.system ?? 0, fill: '#10b981' },
  ];

  const statusData = Object.entries(analytics.statusCounts).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    fill: STATUS_COLORS[name as keyof typeof STATUS_COLORS],
  }));

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/u/insights">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Signal Analytics</h1>
            <p className="text-muted-foreground">
              Insights into engagement signals and advisor actions.
            </p>
          </div>
        </div>
        <Select value={dateRange} onValueChange={(v) => setDateRange(v as typeof dateRange)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-full bg-blue-100 p-3">
              <Zap className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{analytics.summary.totalSignals}</p>
              <p className="text-sm text-muted-foreground">Total Signals</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-full bg-orange-100 p-3">
              <Bell className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{analytics.summary.activeSignals}</p>
              <p className="text-sm text-muted-foreground">Active Now</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-full bg-purple-100 p-3">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{analytics.summary.signalsInPeriod}</p>
              <p className="text-sm text-muted-foreground">In Period</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{analytics.summary.resolvedInPeriod}</p>
              <p className="text-sm text-muted-foreground">Resolved</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-full bg-cyan-100 p-3">
              <Clock className="h-5 w-5 text-cyan-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {analytics.summary.avgResolutionTimeHours !== null
                  ? `${analytics.summary.avgResolutionTimeHours}h`
                  : '-'}
              </p>
              <p className="text-sm text-muted-foreground">Avg Resolution</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rules">Rule Effectiveness</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Signal Trend Chart */}
            <Card>
              <CardHeader>
                <CardTitle>{`Signal Trend (${daysMap[dateRange]} Days)`}</CardTitle>
                <CardDescription>Daily signals created vs resolved</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) =>
                        new Date(value).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })
                      }
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString()} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="created"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      name="Created"
                    />
                    <Line
                      type="monotone"
                      dataKey="resolved"
                      stroke="#22c55e"
                      strokeWidth={2}
                      name="Resolved"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Current Status */}
            <Card>
              <CardHeader>
                <CardTitle>Current Status</CardTitle>
                <CardDescription>All signals by status</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Priority Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Active by Priority</CardTitle>
                <CardDescription>Currently active signals</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={priorityData} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={60} />
                    <Tooltip />
                    <Bar dataKey="value" radius={4}>
                      {priorityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Signal Types */}
            <Card>
              <CardHeader>
                <CardTitle>Signal Types</CardTitle>
                <CardDescription>Distribution by type</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={typeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      dataKey="value"
                    >
                      {typeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Signal Source */}
            <Card>
              <CardHeader>
                <CardTitle>Signal Sources</CardTitle>
                <CardDescription>How signals are created</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={sourceData}>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" radius={4}>
                      {sourceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Top Rules */}
          {analytics.topRules.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top Triggering Rules</CardTitle>
                <CardDescription>Rules generating the most signals in this period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.topRules.map((rule, index) => (
                    <div key={rule.ruleId} className="flex items-center gap-4">
                      <span className="w-6 text-center font-bold text-muted-foreground">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium">{rule.name}</p>
                      </div>
                      <Badge variant="secondary">{rule.signalCount} signals</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Rule Effectiveness Tab */}
        <TabsContent value="rules" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Rule Effectiveness</CardTitle>
              <CardDescription>
                How often signals from each rule lead to meaningful action
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ruleEffectiveness === undefined ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
                </div>
              ) : ruleEffectiveness.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">No rule data available yet.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-center">Active</TableHead>
                      <TableHead className="text-center">Action Taken</TableHead>
                      <TableHead className="text-center">No Action</TableHead>
                      <TableHead className="text-center">Dismissed</TableHead>
                      <TableHead className="text-center">Avg Resolution</TableHead>
                      <TableHead>Effectiveness</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ruleEffectiveness?.map((rule) => (
                      <TableRow key={rule.ruleId}>
                        <TableCell className="font-medium">{rule.name}</TableCell>
                        <TableCell>
                          <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                            {rule.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{rule.totalSignals}</TableCell>
                        <TableCell className="text-center">
                          <span className="text-blue-600">{rule.activeSignals}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-green-600">{rule.resolvedWithAction}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-neutral-500">{rule.resolvedNoAction}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-red-600">{rule.dismissedCount}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          {rule.avgResolutionHours !== null ? `${rule.avgResolutionHours}h` : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={rule.effectivenessRate} className="w-20" />
                            <span
                              className={`text-sm font-medium ${
                                rule.effectivenessRate >= 70
                                  ? 'text-green-600'
                                  : rule.effectivenessRate >= 40
                                    ? 'text-yellow-600'
                                    : 'text-red-600'
                              }`}
                            >
                              {rule.effectivenessRate}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Students Tab */}
        <TabsContent value="students" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Students with Most Active Signals</CardTitle>
              <CardDescription>
                Students who may need the most attention based on active signals
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.topStudents.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-center">Active Signals</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.topStudents.map((student, index) => (
                      <TableRow key={student.studentId}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {index === 0 && <AlertTriangle className="h-4 w-4 text-red-500" />}
                            {index === 1 && <ArrowUp className="h-4 w-4 text-orange-500" />}
                            {index === 2 && <ArrowUp className="h-4 w-4 text-yellow-500" />}
                            <span className="font-medium">#{index + 1}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{student.name}</TableCell>
                        <TableCell className="text-muted-foreground">{student.email}</TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={
                              student.activeSignals >= 5
                                ? 'destructive'
                                : student.activeSignals >= 3
                                  ? 'default'
                                  : 'secondary'
                            }
                          >
                            {student.activeSignals}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Link href={`/u/students/${student.studentId}`}>
                            <Button variant="outline" size="sm">
                              View Profile
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <Users className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">No students with active signals.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
