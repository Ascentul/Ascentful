'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useQuery } from 'convex/react';
import {
  Activity,
  Building2,
  FileText,
  FolderKanban,
  Loader2,
  Mail,
  MessageCircle,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import React, { useMemo } from 'react';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/ClerkAuthProvider';

type UserGrowthPoint = { month: string; users: number };
type SubscriptionEntry = { name: string; value: number; color: string };
type ActivityPoint = { day: string; logins: number; registrations: number };
type FeatureUsage = { name: string; users: number; total: number; percentage: number };
type FeatureUsageData = { totalUsers: number; features: FeatureUsage[] };

function AdminAnalyticsPage() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const { user: convexUser } = useAuth();

  // Check permissions using CLERK directly (source of truth for roles)
  const clerkRole = useMemo(
    () => (clerkUser?.publicMetadata as any)?.role as string | undefined,
    [clerkUser?.publicMetadata],
  );
  const canAccess = useMemo(() => clerkRole === 'super_admin', [clerkRole]);

  // OPTIMIZED: Use multiple lightweight queries instead of one monolithic query
  const shouldQuery = clerkLoaded && canAccess && clerkUser?.id;

  const systemStats = useQuery(
    api.analytics.getSystemStatsOptimized,
    shouldQuery ? { clerkId: clerkUser!.id } : 'skip',
  );

  const userGrowth = useQuery(
    api.analytics.getUserGrowthOptimized,
    shouldQuery ? { clerkId: clerkUser!.id, monthsBack: 12 } : 'skip',
  ) as UserGrowthPoint[] | undefined;

  const subscriptionData = useQuery(
    api.analytics.getSubscriptionDistributionOptimized,
    shouldQuery ? { clerkId: clerkUser!.id } : 'skip',
  ) as SubscriptionEntry[] | undefined;

  const activityData = useQuery(
    api.analytics.getActivityDataOptimized,
    shouldQuery ? { clerkId: clerkUser!.id } : 'skip',
  ) as ActivityPoint[] | undefined;

  const universityData = useQuery(
    api.analytics.getTopUniversitiesOptimized,
    shouldQuery ? { clerkId: clerkUser!.id } : 'skip',
  );

  const investorMetrics = useQuery(
    api.investor_metrics.getUserMetrics,
    shouldQuery ? { clerkId: clerkUser!.id } : 'skip',
  );

  const featureUsageData = useQuery(
    api.analytics.getPlatformFeatureUsage,
    shouldQuery ? { clerkId: clerkUser!.id } : 'skip',
  ) as FeatureUsageData | undefined;

  // Memoize derived calculations BEFORE any early returns (Rules of Hooks)
  const totalUsers = useMemo(() => systemStats?.totalUsers ?? 0, [systemStats]);
  const activeUsers = useMemo(() => systemStats?.activeUsers ?? 0, [systemStats]);
  const totalUniversities = useMemo(() => systemStats?.totalUniversities ?? 0, [systemStats]);
  const newUsersThisMonth = useMemo(() => {
    if (!userGrowth || userGrowth.length === 0) return 0;
    return userGrowth[userGrowth.length - 1]?.users ?? 0;
  }, [userGrowth]);
  const last6Months = useMemo<UserGrowthPoint[]>(() => userGrowth?.slice(-6) ?? [], [userGrowth]);

  // Combined loading state - show loading if critical data isn't ready
  // Include investorMetrics to ensure complete page render for business-critical data
  const isLoading = !systemStats || !userGrowth || !subscriptionData || !investorMetrics;

  if (!canAccess) {
    return (
      <div className="space-y-4 min-w-0">
        <div className="w-full min-w-0 rounded-3xl bg-white p-6 shadow-sm">
          <Card>
            <CardHeader>
              <CardTitle>Unauthorized</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">You do not have access to admin analytics.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4 min-w-0">
        <div className="w-full min-w-0 rounded-3xl bg-white p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <ShieldCheck className="h-7 w-7" />
                Admin Analytics
              </h1>
              <p className="text-muted-foreground">Platform analytics and insights</p>
            </div>
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading critical analytics...</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 min-w-0">
      <div className="w-full min-w-0 rounded-3xl bg-white p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <ShieldCheck className="h-7 w-7" />
              Admin Analytics
            </h1>
            <p className="text-muted-foreground">Platform analytics and insights</p>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{newUsersThisMonth} new this month</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeUsers.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0}% of total
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Universities</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUniversities.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Institutional partners</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Health</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{systemStats?.systemHealth ?? 0}%</div>
              <p className="text-xs text-muted-foreground">
                {systemStats?.supportTickets ?? 0} open tickets
              </p>
            </CardContent>
          </Card>
        </div>

        {/* User Growth & Activity */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>User Growth (Last 6 Months)</CardTitle>
              <CardDescription>New user registrations by month</CardDescription>
            </CardHeader>
            <CardContent>
              {!userGrowth ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2">
                  {last6Months.map((data) => (
                    <div key={data.month} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{data.month}</span>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 bg-primary rounded-full"
                          style={{ width: `${Math.min(data.users * 10, 100)}px` }}
                        ></div>
                        <span className="text-sm font-medium w-12 text-right">{data.users}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Subscription Distribution</CardTitle>
              <CardDescription>Users by subscription plan</CardDescription>
            </CardHeader>
            <CardContent>
              {!subscriptionData ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  {subscriptionData.map((sub) => (
                    <div key={sub.name} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{sub.name}</span>
                        <span className="text-muted-foreground">{sub.value.toLocaleString()}</span>
                      </div>
                      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${totalUsers > 0 ? (sub.value / totalUsers) * 100 : 0}%`,
                            backgroundColor: sub.color,
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Feature Usage Analytics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Feature Usage
            </CardTitle>
            <CardDescription>Percentage of users who have used each feature</CardDescription>
          </CardHeader>
          <CardContent>
            {!featureUsageData ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {featureUsageData.features.map((feature) => (
                  <div key={feature.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{feature.name}</span>
                      <span className="text-muted-foreground">
                        {feature.users.toLocaleString()} users ({feature.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${feature.percentage}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {feature.total.toLocaleString()} total items created
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t text-sm text-muted-foreground">
                  Total platform users: {featureUsageData.totalUsers.toLocaleString()}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Activity (Last 7 Days)</CardTitle>
            <CardDescription>Daily registrations and logins</CardDescription>
          </CardHeader>
          <CardContent>
            {!activityData ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2">
                {activityData.map((data) => (
                  <div key={data.day} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground w-12">{data.day}</span>
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs text-muted-foreground w-20">Registrations:</span>
                        <div
                          className="h-2 bg-blue-500 rounded-full"
                          style={{ width: `${Math.min((data.registrations ?? 0) * 20, 100)}px` }}
                        ></div>
                        <span className="text-sm font-medium w-8">{data.registrations ?? 0}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs text-muted-foreground w-20">Logins:</span>
                        <div
                          className="h-2 bg-green-500 rounded-full"
                          style={{ width: `${Math.min((data.logins ?? 0) / 2, 100)}px` }}
                        ></div>
                        <span className="text-sm font-medium w-8">{data.logins ?? 0}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* University Data */}
        {universityData && universityData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Top Universities</CardTitle>
              <CardDescription>Universities by user count</CardDescription>
            </CardHeader>
            <CardContent>
              {!universityData ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-3">
                  {universityData.map((uni) => (
                    <div
                      key={uni.name}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{uni.name}</div>
                          <div className="text-sm text-muted-foreground">{uni.status}</div>
                        </div>
                      </div>
                      <div className="text-sm font-medium">{uni.users ?? 0} users</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Investor Metrics */}
        {investorMetrics && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                Investor Metrics
              </CardTitle>
              <CardDescription>
                Accurate user counts for investor reporting (excludes test users)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Key Metrics Grid */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 bg-white rounded-lg border">
                  <div className="text-sm text-muted-foreground">Active Real Users</div>
                  <div className="text-3xl font-bold text-blue-600">
                    {investorMetrics.active_users.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {investorMetrics.growth.new_users_last_30_days} new in last 30 days (
                    {investorMetrics.growth.growth_rate_30d})
                  </div>
                </div>
                <div className="p-4 bg-white rounded-lg border">
                  <div className="text-sm text-muted-foreground">Monthly Recurring Revenue</div>
                  <div className="text-3xl font-bold text-green-600">
                    ${investorMetrics.revenue.mrr.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    ARR: ${investorMetrics.revenue.arr.toLocaleString()}
                  </div>
                </div>
                <div className="p-4 bg-white rounded-lg border">
                  <div className="text-sm text-muted-foreground">Paying Users</div>
                  <div className="text-3xl font-bold text-purple-600">
                    {investorMetrics.revenue.paying_users.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Premium subscribers</div>
                </div>
              </div>

              {/* User Breakdown */}
              <div className="space-y-3">
                <div className="font-medium text-sm">User Breakdown by Plan</div>
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="flex items-center justify-between p-3 bg-white rounded border">
                    <span className="text-sm">Free Users</span>
                    <span className="font-semibold">{investorMetrics.by_plan.free}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded border">
                    <span className="text-sm">Premium Users</span>
                    <span className="font-semibold text-green-600">
                      {investorMetrics.by_plan.premium}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded border">
                    <span className="text-sm">University Users</span>
                    <span className="font-semibold text-blue-600">
                      {investorMetrics.by_plan.university}
                    </span>
                  </div>
                </div>
              </div>

              {/* Account Status */}
              <div className="space-y-3">
                <div className="font-medium text-sm">Account Status (Real Users Only)</div>
                <div className="grid gap-2 md:grid-cols-4">
                  <div className="flex items-center justify-between p-3 bg-white rounded border">
                    <span className="text-sm">Active</span>
                    <span className="font-semibold text-green-600">
                      {investorMetrics.active_users}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded border">
                    <span className="text-sm">Pending</span>
                    <span className="font-semibold text-yellow-600">
                      {investorMetrics.pending_users}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded border">
                    <span className="text-sm">Suspended</span>
                    <span className="font-semibold text-orange-600">
                      {investorMetrics.suspended_users}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded border">
                    <span className="text-sm">Deleted</span>
                    <span className="font-semibold text-red-600">
                      {investorMetrics.deleted_users}
                    </span>
                  </div>
                </div>
              </div>

              {/* Test Users Note */}
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="text-sm text-yellow-800">
                  <strong>Note:</strong> Test users ({investorMetrics.test_users}) are excluded from
                  all metrics above. Total database users:{' '}
                  {investorMetrics.total_real_users + investorMetrics.test_users}
                </div>
              </div>

              <div className="text-xs text-muted-foreground text-right">
                Generated: {new Date(investorMetrics.generated_at).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Wrap the page with Error Boundary to catch Convex query errors
export default function AdminAnalyticsPageWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <AdminAnalyticsPage />
    </ErrorBoundary>
  );
}
