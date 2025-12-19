'use client';

import { useAuth as useClerkAuth, useUser } from '@clerk/nextjs';
import { useMemo } from 'react';

import { ClerkPublicMetadata } from '@/types/clerk';

export interface SubscriptionInfo {
  isPremium: boolean;
  isActive: boolean;
  isUniversity: boolean;
  planType: 'free' | 'premium_monthly' | 'premium_annual' | 'university';
  planName: string;
  isLoading: boolean;
}

/**
 * Hook to check user's subscription status via Clerk Billing
 *
 * Clerk Billing uses the has() method server-side to check subscriptions.
 * For client components, we check the user's subscription metadata that
 * Clerk automatically syncs after payment.
 *
 * Note: In production, Clerk automatically updates user metadata when
 * subscriptions change. Plan slugs should match those in Clerk Dashboard.
 *
 * Usage:
 * ```tsx
 * const { isPremium, planType, isLoading } = useSubscription()
 * if (isPremium && !isLoading) {
 *   // Show premium features
 * }
 * ```
 */
export function useSubscription(): SubscriptionInfo {
  const { user, isLoaded } = useUser();
  const { has } = useClerkAuth();

  return useMemo(() => {
    if (!isLoaded || !user) {
      return {
        isPremium: false,
        isActive: false,
        isUniversity: false,
        planType: 'free',
        planName: 'Free',
        isLoading: !isLoaded,
      };
    }

    const metadata = user.publicMetadata as ClerkPublicMetadata;

    // Check if user is part of a university (legacy/admin-assigned)
    const isUniversity = metadata?.role === 'student' || Boolean(metadata?.university_id);

    // Use Clerk's built-in has() method to check subscription plans
    // This is the official way to check Clerk Billing subscriptions
    // Note: "premium_monthly" plan includes both monthly AND annual billing options
    const hasPremium = has?.({ plan: 'premium_monthly' }) ?? false;

    // Check for admin-granted premium access (set via super admin in /admin/users)
    // This allows super admins to grant pro access without going through Clerk Billing
    const hasAdminGrantedPremium =
      metadata?.admin_granted_subscription?.plan === 'premium_monthly' &&
      metadata?.admin_granted_subscription?.status === 'active';

    // Also check the billing metadata we set (fallback for admin grants)
    const hasBillingPremium =
      metadata?.billing?.plan === 'premium_monthly' && metadata?.billing?.status === 'active';

    const isPremium = hasPremium || hasAdminGrantedPremium || hasBillingPremium || isUniversity;

    // Determine specific plan type
    let planType: SubscriptionInfo['planType'] = 'free';
    let planName = 'Free';

    if (isUniversity) {
      planType = 'university';
      planName = 'University';
    } else if (hasPremium || hasAdminGrantedPremium || hasBillingPremium) {
      // We can't distinguish monthly vs annual from has() alone
      // Both are under the same plan key "premium_monthly"
      // Admin-granted subscriptions also use this plan type
      planType = 'premium_monthly';
      planName = 'Premium';
    }

    // DEBUG: Log subscription check results
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log('[useSubscription] Plan check:', {
        hasPremium,
        isPremium,
        planType,
        metadata,
      });
    }

    return {
      isPremium,
      isActive: isPremium,
      isUniversity,
      planType,
      planName,
      isLoading: false,
    };
  }, [user, isLoaded, has]);
}

/**
 * Server-side helpers moved to src/lib/subscription-server.ts
 *
 * Import server-side helpers like this:
 * ```tsx
 * import { checkPremiumAccess, checkPlan, checkFeature } from '@/lib/subscription-server'
 * ```
 */
