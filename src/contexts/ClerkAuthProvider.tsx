'use client';

import { useAuth as useClerkAuth, useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useToast } from '@/hooks/use-toast';
import { type SubscriptionInfo, useSubscription } from '@/hooks/useSubscription';
import { hasAdvisorAccess } from '@/lib/constants/roles';

interface UserProfile {
  _id: string;
  clerkId: string;
  email: string;
  name: string;
  username?: string;
  role: string;
  // Subscription fields removed - now managed by Clerk Billing via useSubscription hook
  university_id?: string;
  profile_image?: string | null;
  cover_image?: string;
  linkedin_url?: string;
  github_url?: string;
  bio?: string;
  job_title?: string;
  company?: string;
  location?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  street_address?: string;
  phone_number?: string;
  website?: string;
  skills?: string;
  current_position?: string;
  current_company?: string;
  years_of_experience?: string;
  // Work Authorization
  work_authorization?: string;
  requires_sponsorship?: boolean;
  // Job Preferences
  desired_salary?: string;
  available_start_date?: string;
  education?: string;
  education_history?: {
    id: string;
    school?: string;
    degree?: string;
    field_of_study?: string;
    start_year?: string;
    end_year?: string;
    is_current?: boolean;
    description?: string;
  }[];
  work_history?: {
    id: string;
    role?: string;
    company?: string;
    start_date?: string;
    end_date?: string;
    is_current?: boolean;
    location?: string;
    summary?: string;
  }[];
  university_name?: string;
  major?: string;
  graduation_year?: string;
  dream_job?: string;
  career_goals?: string;
  experience_level?: string;
  industry?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  onboarding_completed?: boolean;
  completed_tasks?: string[];
  account_status?: string;
  activation_token?: string;
  activation_expires_at?: number;
  temp_password?: string;
  created_by_admin?: boolean;
  password_reset_token?: string;
  password_reset_expires_at?: number;
  created_at: number;
  updated_at: number;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isSignedIn: boolean;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  subscription: SubscriptionInfo; // Subscription info from Clerk Billing
  hasPremium: boolean; // Helper for quick premium access check
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function ClerkAuthProvider({ children }: { children: React.ReactNode }) {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const { signOut: clerkSignOut } = useClerkAuth();
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Get subscription info from Clerk Billing
  const subscription = useSubscription();

  // Get user profile from Convex (for profile data, not subscription)
  const userProfile = useQuery(
    api.users.getUserByClerkId,
    clerkUser?.id ? { clerkId: clerkUser.id } : 'skip',
  );

  // Initialize user profile mutation (client-callable, unlike createUser which is webhook-only)
  const initializeUserProfile = useMutation(api.users.initializeUserProfile);

  // Record login for engagement tracking
  const recordLogin = useMutation(api.users.recordLogin);

  useEffect(() => {
    const initializeUser = async () => {
      if (!clerkLoaded) return;

      // Check account status if user profile exists
      if (clerkUser && userProfile) {
        // Block deleted users
        if (userProfile.account_status === 'deleted') {
          toast({
            title: 'Account Deleted',
            description:
              'Your account has been deleted. Please contact support if you believe this is an error.',
            variant: 'destructive',
          });
          await clerkSignOut();
          return;
        }

        // Block suspended users
        if (userProfile.account_status === 'suspended') {
          toast({
            title: 'Account Suspended',
            description: 'Your account has been suspended. Please contact support for assistance.',
            variant: 'destructive',
          });
          await clerkSignOut();
          return;
        }
      }

      if (clerkUser && !userProfile) {
        // Create user profile in Convex if it doesn't exist
        try {
          // Derive initial role from Clerk public metadata if present and valid
          const allowedRoles = [
            'individual',
            'user',
            'student',
            'staff',
            'university_admin',
            'advisor',
            'super_admin',
          ] as const;
          const metaRole = (clerkUser.publicMetadata as any)?.role as string | undefined;
          const normalizedMetaRole = metaRole === 'admin' ? 'super_admin' : metaRole;
          const initialRole =
            normalizedMetaRole && (allowedRoles as readonly string[]).includes(normalizedMetaRole)
              ? (normalizedMetaRole as any)
              : undefined;

          // Get university_id from Clerk public metadata if present
          const metaUniversityId = (clerkUser.publicMetadata as any)?.university_id as
            | string
            | undefined;

          await initializeUserProfile({
            clerkId: clerkUser.id,
            email: clerkUser.emailAddresses[0]?.emailAddress || '',
            name: clerkUser.fullName || clerkUser.firstName || 'User',
            username: clerkUser.username || undefined,
            role: initialRole,
            university_id: metaUniversityId as any, // Pass university_id from Clerk metadata
          });
        } catch (error) {
          console.error('Error creating user profile:', error);
          toast({
            title: 'Error',
            description: 'Failed to create user profile',
            variant: 'destructive',
          });
        }
      }

      setIsLoading(false);
    };

    initializeUser();
  }, [clerkUser, clerkLoaded, userProfile, initializeUserProfile, toast, clerkSignOut]);

  // Clerk publicMetadata.role should be the source of truth; Convex should mirror it.
  // If they diverge, log for investigation rather than silently overriding either side.
  useEffect(() => {
    if (!clerkLoaded || !clerkUser || !userProfile) return;
    const metaRole = (clerkUser.publicMetadata as any)?.role as string | undefined;
    if (metaRole && userProfile.role !== metaRole) {
      console.warn('[ClerkAuthProvider] Role mismatch detected (Convex is authoritative):', {
        convexRole: userProfile.role,
        clerkRole: metaRole,
      });
    }
  }, [clerkLoaded, clerkUser, userProfile]);

  // Track login activity for engagement predictions
  useEffect(() => {
    if (!clerkLoaded || !clerkUser || !userProfile) return;

    // Record the login (mutation handles deduplication for sessions < 1 hour)
    recordLogin({ clerkId: clerkUser.id }).catch((err) => {
      // Silently fail - login tracking should not block the app
      console.warn('[ClerkAuthProvider] Failed to record login:', err);
    });
  }, [clerkLoaded, clerkUser?.id, userProfile?._id, recordLogin]);

  const signOut = useCallback(async () => {
    try {
      await clerkSignOut();
      toast({
        title: 'Logged out',
        description: 'You have been successfully logged out',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Logout failed';
      toast({
        title: 'Logout failed',
        description: message,
        variant: 'destructive',
      });
      throw error;
    }
  }, [clerkSignOut, toast]);

  // Check if user is admin (memoized)
  const isAdmin = useMemo(() => hasAdvisorAccess(userProfile?.role), [userProfile?.role]);

  // Helper for quick premium access check
  const hasPremium = useMemo(() => subscription.isPremium, [subscription.isPremium]);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      user: userProfile || null,
      isLoading: isLoading || !clerkLoaded,
      isSignedIn: !!clerkUser,
      signOut,
      isAdmin,
      subscription, // Subscription info from Clerk Billing
      hasPremium, // Quick access helper
    }),
    [userProfile, isLoading, clerkLoaded, clerkUser, signOut, isAdmin, subscription, hasPremium],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within a ClerkAuthProvider');
  }
  return context;
}
