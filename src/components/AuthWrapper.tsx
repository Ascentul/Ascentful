'use client';

import { useAuth as useClerkAuth, useUser } from '@clerk/nextjs';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

import { useAuth } from '@/contexts/ClerkAuthProvider';

// Routes that should bypass role-based redirects (e.g., isolated demo prototypes)
const BYPASS_REDIRECT_ROUTES = ['/cohortos'];

interface AuthWrapperProps {
  children: React.ReactNode;
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const { isLoaded: authLoaded } = useClerkAuth();
  const { user: userProfile } = useAuth(); // Use context instead of separate query
  const router = useRouter();
  const pathname = usePathname();
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  useEffect(() => {
    // Wait for all auth states to be loaded
    if (!clerkLoaded || !authLoaded) return;

    // Skip redirect for bypass routes (isolated demos, etc.)
    const shouldBypass = BYPASS_REDIRECT_ROUTES.some((route) => pathname?.startsWith(route));
    if (shouldBypass) return;

    // If we have a user profile, determine the correct redirect
    if (clerkUser && userProfile) {
      const userRole = userProfile.role;
      let targetPath = '/dashboard';

      // Determine the correct dashboard based on role
      if (userRole === 'super_admin') {
        targetPath = '/admin';
      } else if (userRole === 'university_admin' || userRole === 'advisor') {
        targetPath = '/university';
      }

      setRedirectPath(targetPath);
    }
  }, [clerkUser, userProfile, clerkLoaded, authLoaded, pathname]);

  // If we need to redirect, do it now
  useEffect(() => {
    if (redirectPath && window.location.pathname !== redirectPath) {
      router.push(redirectPath);
    }
  }, [redirectPath, router]);

  // Show loading while determining redirect
  if (!clerkLoaded || !authLoaded || (clerkUser && !userProfile)) {
    // Debug info to help diagnose loading issues (development only)
    if (process.env.NODE_ENV === 'development') {
      console.log('[AuthWrapper] Waiting for auth:', {
        clerkLoaded,
        authLoaded,
        hasClerkUser: !!clerkUser,
        hasUserProfile: !!userProfile,
      });
    }

    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
          {process.env.NODE_ENV === 'development' && (
            <p className="text-xs text-muted-foreground mt-2">
              Clerk: {clerkLoaded ? '✓' : '...'} | Auth: {authLoaded ? '✓' : '...'} | User:{' '}
              {clerkUser ? '✓' : '-'} | Profile: {userProfile ? '✓' : '...'}
            </p>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
