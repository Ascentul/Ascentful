'use client';

import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import { useMemo } from 'react';

interface UseUniversityDataParams {
  clerkUserId: string | undefined;
  universityId: Id<'universities'> | undefined;
  usageProgramFilter?: string;
}

export function useUniversityData({
  clerkUserId,
  universityId,
  usageProgramFilter = 'All Programs',
}: UseUniversityDataParams) {
  // Core data queries
  const overview = useQuery(
    api.university_admin.getOverview,
    clerkUserId ? { clerkId: clerkUserId } : 'skip',
  );

  const students = useQuery(
    api.university_admin.listStudents,
    clerkUserId ? { clerkId: clerkUserId, limit: 500 } : 'skip',
  );

  const departments = useQuery(
    api.university_admin.listDepartments,
    clerkUserId ? { clerkId: clerkUserId } : 'skip',
  );

  // Compute department ID for analytics filter
  const usageDepartmentId = useMemo(() => {
    if (usageProgramFilter === 'All Programs' || !departments) return undefined;
    const dept = departments.find((d) => d.name === usageProgramFilter);
    return dept?._id;
  }, [usageProgramFilter, departments]);

  const analytics = useQuery(
    api.university_admin.getUniversityAnalytics,
    clerkUserId
      ? {
          clerkId: clerkUserId,
          departmentId: usageDepartmentId,
        }
      : 'skip',
  );

  const studentMetrics = useQuery(
    api.university_admin.getStudentMetrics,
    clerkUserId ? { clerkId: clerkUserId } : 'skip',
  );

  const studentProgress = useQuery(
    api.university_admin.getStudentProgress,
    clerkUserId ? { clerkId: clerkUserId } : 'skip',
  );

  // Real student funnel data
  const studentFunnel = useQuery(
    api.analytics.getUniversityStudentFunnel,
    universityId ? { universityId } : 'skip',
  );

  // Real active users data for engagement view
  const activeUsersData = useQuery(
    api.analytics.getUniversityActiveUsersOverTime,
    universityId ? { universityId, timeRange: 'daily' as const } : 'skip',
  );

  // Momentum distribution for student health metrics
  const momentumDistribution = useQuery(
    api.momentum.getMomentumDistribution,
    universityId ? { universityId } : 'skip',
  );

  // Loading state
  const isLoading = !!clerkUserId && (!overview || !students || !departments);

  // Derived data from analytics
  const studentGrowthData = analytics?.studentGrowthData || [];
  const activityData = analytics?.activityData || [];
  const departmentStats = analytics?.departmentStats || [];

  return {
    // Core data
    overview,
    students,
    departments,
    analytics,
    studentMetrics,
    studentProgress,
    studentFunnel,
    activeUsersData,
    momentumDistribution,

    // Derived data
    studentGrowthData,
    activityData,
    departmentStats,

    // State
    isLoading,
    usageDepartmentId,
  };
}

export type UniversityDataResult = ReturnType<typeof useUniversityData>;
