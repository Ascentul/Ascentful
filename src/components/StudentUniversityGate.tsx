'use client';

/**
 * StudentUniversityGate Component
 *
 * Protects student advisor hub routes with role and university checks.
 * Requires BOTH: role === 'student' AND user.university_id exists.
 * Redirects unauthorized users to /dashboard.
 */

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useQuery } from 'convex/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { isUniversityStudent } from '@/lib/constants/roles';

interface StudentUniversityGateProps {
  children: React.ReactNode;
  /**
   * Fallback component to show while loading
   */
  loadingFallback?: React.ReactNode;
}

export function StudentUniversityGate({ children, loadingFallback }: StudentUniversityGateProps) {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  // Get viewer data to check university_id
  const viewer = useQuery(api.viewer.getViewer, user ? {} : 'skip');
  const isViewerLoading = viewer === undefined;

  const userRole = user?.publicMetadata?.role as string | undefined;
  const universityId = viewer?.university?.universityId as string | undefined;
  const isAuthorized = isUniversityStudent(userRole, universityId);

  useEffect(() => {
    if (!isLoaded || isViewerLoading) return;

    // Not signed in - Clerk middleware should have caught this
    if (!user) {
      router.push('/sign-in');
      return;
    }

    // Check role + university authorization
    if (!isAuthorized) {
      // User is not a university student - redirect to dashboard
      router.push('/dashboard');
      return;
    }
  }, [isLoaded, user, isViewerLoading, isAuthorized, router]);

  // Loading state
  if (!isLoaded || isViewerLoading) {
    return (
      loadingFallback || (
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
            <p className="mt-4 text-sm text-gray-500">Loading...</p>
          </div>
        </div>
      )
    );
  }

  // Not authorized - render nothing (redirect in useEffect)
  if (!isAuthorized) {
    return null;
  }

  // Authorized
  return <>{children}</>;
}
