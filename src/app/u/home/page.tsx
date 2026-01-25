'use client';

/**
 * University Workspace Home
 *
 * Renders the appropriate dashboard based on user role:
 * - Advisors: Today's schedule view (daily workflow)
 * - Admins: University admin dashboard
 *
 * No redirects - renders content directly for clean UX.
 */

import { useUser } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';

import { AdvisorTodayDashboard } from '@/components/dashboard/AdvisorTodayDashboard';
import { UniversityDashboard } from '@/components/dashboard/UniversityDashboard';

export default function UniversityHomePage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
          <p className="text-sm text-neutral-600">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  // Fallback if user is not authenticated (should be caught by middleware)
  if (!user) {
    return null;
  }

  const role = user.publicMetadata?.role as
    | 'university_admin'
    | 'super_admin'
    | 'advisor'
    | undefined;

  // University admins and super admins see admin dashboard
  if (role === 'university_admin' || role === 'super_admin') {
    return <UniversityDashboard />;
  }

  // Advisors (and any other role that passes the parent layout's RequireRole guard)
  // see Today's schedule view. The /u layout restricts access to university_admin,
  // advisor, and super_admin roles, so unexpected roles cannot reach this fallback.
  return <AdvisorTodayDashboard />;
}
