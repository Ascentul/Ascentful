/**
 * useFeatureFlag Hook
 *
 * Client-side hook for checking feature flags with caching
 * Uses Convex's built-in caching and reactivity
 */

import { useAuth } from '@clerk/nextjs';
import { useQuery } from 'convex/react';

import { api } from '../../convex/_generated/api';

/**
 * Check if a single feature flag is enabled
 *
 * @param flag - Feature flag key (e.g., "advisor.dashboard")
 * @returns boolean | undefined - true if enabled, false if disabled, undefined if loading
 *
 * @example
 * const isEnabled = useFeatureFlag("advisor.dashboard");
 * if (isEnabled) {
 *   // Show advisor dashboard
 * }
 */
export function useFeatureFlag(flag: string): boolean | undefined {
  const { isLoaded, userId } = useAuth();
  const enabled = useQuery(
    api.feature_flags.getFeatureFlag,
    isLoaded && userId ? { flag } : 'skip',
  );
  return enabled;
}

/**
 * Check multiple feature flags at once
 *
 * @param flags - Array of feature flag keys
 * @returns Object mapping flag keys to boolean values, or undefined if loading
 *
 * @example
 * const flags = useFeatureFlags(["advisor.dashboard", "advisor.students"]);
 * if (flags?.["advisor.dashboard"]) {
 *   // Show dashboard
 * }
 */
export function useFeatureFlags(flags: string[]): Record<string, boolean> | undefined {
  const { isLoaded, userId } = useAuth();
  const result = useQuery(
    api.feature_flags.getFeatureFlags,
    isLoaded && userId ? { flags } : 'skip',
  );
  if (!result) return undefined;
  // Create defaults map to ensure all requested flags are present
  const defaults = Object.fromEntries(flags.map((flag) => [flag, false]));
  if (process.env.NODE_ENV === 'development') {
    const missingFlags = flags.filter((flag) => !(flag in result));
    if (missingFlags.length > 0) {
      console.warn('Feature flags not found in API response:', missingFlags);
    }
  }
  return { ...defaults, ...result };
}

/**
 * Advisor feature flags bundle
 * Optimized hook for all advisor-related flags
 *
 * @returns Object with advisor feature flags, or undefined if loading
 *
 * @example
 * const advisorFlags = useAdvisorFeatureFlags();
 * if (advisorFlags?.dashboard) {
 *   // Show advisor dashboard
 * }
 */
export function useAdvisorFeatureFlags():
  | {
      dashboard: boolean;
      students: boolean;
      advising: boolean;
      reviews: boolean;
      applications: boolean;
      analytics: boolean;
      support: boolean;
    }
  | undefined {
  const flags = useFeatureFlags([
    'advisor.dashboard',
    'advisor.students',
    'advisor.advising',
    'advisor.reviews',
    'advisor.applications',
    'advisor.analytics',
    'advisor.support',
  ]);

  if (!flags) return undefined;

  return {
    dashboard: flags['advisor.dashboard'],
    students: flags['advisor.students'],
    advising: flags['advisor.advising'],
    reviews: flags['advisor.reviews'],
    applications: flags['advisor.applications'],
    analytics: flags['advisor.analytics'],
    support: flags['advisor.support'],
  };
}
