'use client';

import { useMemo } from 'react';

import type {
  ChartDataPoint,
  FeatureEngagementByRisk,
  FeatureUsageData,
  RiskSegmentData,
} from '../types';

interface AnalyticsTransformParams {
  overview:
    | {
        departmentDistribution?: Array<{ name: string; count: number; percentage: number }>;
        unassignedStudents?: number;
        totalStudents?: number;
      }
    | null
    | undefined;
  studentMetrics:
    | {
        totalResumes?: number;
        totalGoals?: number;
        totalApplications?: number;
        totalCoverLetters?: number;
        totalProjects?: number;
      }
    | null
    | undefined;
  studentProgress:
    | Array<{
        completion: number;
        resumes?: number;
        applications?: number;
        goals?: number;
        projects?: number;
      }>
    | null
    | undefined;
  // Platform usage data from Convex - tracks feature usage over time
  platformUsageData:
    | Array<{
        month: string;
        goals: number;
        applications: number;
        resumes: number;
        coverLetters: number;
      }>
    | null
    | undefined;
  usageTimeFilter: string;
}

export function useAnalyticsTransforms({
  overview,
  studentMetrics,
  studentProgress,
  platformUsageData,
  usageTimeFilter,
}: AnalyticsTransformParams) {
  // Department distribution pie chart data
  const departmentDistributionData = useMemo((): ChartDataPoint[] => {
    if (!overview?.departmentDistribution) return [];

    const data = overview.departmentDistribution
      .filter((d) => d.count > 0)
      .map((d) => ({
        name: d.name,
        value: d.percentage,
        count: d.count,
      }));

    // Add unassigned students
    if ((overview.unassignedStudents ?? 0) > 0) {
      const total = overview.totalStudents ?? 0;
      data.push({
        name: 'Not Assigned',
        value: total > 0 ? Math.round((overview.unassignedStudents! / total) * 100) : 0,
        count: overview.unassignedStudents!,
      });
    }

    return data;
  }, [overview]);

  // Top features bar chart data
  const topFeaturesData = useMemo((): FeatureUsageData[] => {
    if (!studentMetrics) return [];

    return [
      { feature: 'Resume Builder', usage: studentMetrics.totalResumes ?? 0 },
      { feature: 'Goal Setting', usage: studentMetrics.totalGoals ?? 0 },
      { feature: 'Job Applications', usage: studentMetrics.totalApplications ?? 0 },
      { feature: 'Cover Letters', usage: studentMetrics.totalCoverLetters ?? 0 },
      { feature: 'Projects', usage: studentMetrics.totalProjects ?? 0 },
    ].sort((a, b) => b.usage - a.usage);
  }, [studentMetrics]);

  // Progress completion pie chart data
  const progressCompletionData = useMemo((): ChartDataPoint[] => {
    if (!studentProgress || studentProgress.length === 0) return [];

    const completed = studentProgress.filter((s) => s.completion >= 80).length;
    const inProgress = studentProgress.filter((s) => s.completion > 20 && s.completion < 80).length;
    const notStarted = studentProgress.filter((s) => s.completion <= 20).length;
    const total = studentProgress.length;

    return [
      { name: 'Completed', value: Math.round((completed / total) * 100), count: completed },
      { name: 'In Progress', value: Math.round((inProgress / total) * 100), count: inProgress },
      { name: 'Not Started', value: Math.round((notStarted / total) * 100), count: notStarted },
    ];
  }, [studentProgress]);

  // At-risk students bar chart data
  const atRiskStudentsData = useMemo((): RiskSegmentData[] => {
    if (!studentProgress || studentProgress.length === 0) return [];

    const highRisk = studentProgress.filter((s) => s.completion < 20).length;
    const mediumRisk = studentProgress.filter(
      (s) => s.completion >= 20 && s.completion < 50,
    ).length;
    const lowRisk = studentProgress.filter((s) => s.completion >= 50).length;

    return [
      { segment: 'High Risk', count: highRisk, color: '#EF4444' },
      { segment: 'Medium Risk', count: mediumRisk, color: '#F59E0B' },
      { segment: 'Low Risk', count: lowRisk, color: '#10B981' },
    ];
  }, [studentProgress]);

  // Feature engagement by risk level - stacked bar chart data
  const featureEngagementByRisk = useMemo((): FeatureEngagementByRisk[] => {
    if (!studentProgress || studentProgress.length === 0) {
      return [
        { feature: 'Resume Builder', highRisk: 0, mediumRisk: 0, lowRisk: 0 },
        { feature: 'Applications', highRisk: 0, mediumRisk: 0, lowRisk: 0 },
        { feature: 'Goals', highRisk: 0, mediumRisk: 0, lowRisk: 0 },
        { feature: 'Projects', highRisk: 0, mediumRisk: 0, lowRisk: 0 },
      ];
    }

    // Categorize students by risk level
    const highRiskStudents = studentProgress.filter((s) => s.completion < 20);
    const mediumRiskStudents = studentProgress.filter(
      (s) => s.completion >= 20 && s.completion < 50,
    );
    const lowRiskStudents = studentProgress.filter((s) => s.completion >= 50);

    // Helper to calculate average, returning 0 if no students
    const avg = (
      students: typeof studentProgress,
      key: 'resumes' | 'applications' | 'goals' | 'projects',
    ) => {
      if (students.length === 0) return 0;
      const sum = students.reduce((acc, s) => acc + (s[key] ?? 0), 0);
      return Math.round((sum / students.length) * 10) / 10;
    };

    return [
      {
        feature: 'Resume Builder',
        highRisk: avg(highRiskStudents, 'resumes'),
        mediumRisk: avg(mediumRiskStudents, 'resumes'),
        lowRisk: avg(lowRiskStudents, 'resumes'),
      },
      {
        feature: 'Applications',
        highRisk: avg(highRiskStudents, 'applications'),
        mediumRisk: avg(mediumRiskStudents, 'applications'),
        lowRisk: avg(lowRiskStudents, 'applications'),
      },
      {
        feature: 'Goals',
        highRisk: avg(highRiskStudents, 'goals'),
        mediumRisk: avg(mediumRiskStudents, 'goals'),
        lowRisk: avg(lowRiskStudents, 'goals'),
      },
      {
        feature: 'Projects',
        highRisk: avg(highRiskStudents, 'projects'),
        mediumRisk: avg(mediumRiskStudents, 'projects'),
        lowRisk: avg(lowRiskStudents, 'projects'),
      },
    ];
  }, [studentProgress]);

  // Platform usage data filtered by time
  const filteredPlatformUsageData = useMemo(() => {
    if (!platformUsageData) return [];

    switch (usageTimeFilter) {
      case 'Last month':
        return platformUsageData.slice(-1);
      case 'Last 3 months':
        return platformUsageData.slice(-3);
      case 'Last 6 months':
        return platformUsageData.slice(-6);
      default:
        return platformUsageData;
    }
  }, [platformUsageData, usageTimeFilter]);

  return {
    departmentDistributionData,
    topFeaturesData,
    progressCompletionData,
    atRiskStudentsData,
    featureEngagementByRisk,
    filteredPlatformUsageData,
  };
}

export type AnalyticsTransformsResult = ReturnType<typeof useAnalyticsTransforms>;
