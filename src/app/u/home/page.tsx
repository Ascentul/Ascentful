'use client';

/**
 * University Workspace Home
 *
 * Smart redirect based on user role:
 * - Advisors: redirect to /u/advising/today (daily workflow)
 * - Admins: redirect to /u/admin/dashboard (admin dashboard)
 */

import { useUser } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function UniversityHomePage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    const role = user?.publicMetadata?.role as string | undefined;

    // Advisors go to their daily workflow
    if (role === 'advisor') {
      router.replace('/u/advising/today');
      return;
    }

    // University admins and super admins go to admin dashboard
    if (role === 'university_admin' || role === 'super_admin') {
      router.replace('/u/admin/dashboard');
      return;
    }

    // Fallback - go to advising/today as default
    router.replace('/u/advising/today');
  }, [isLoaded, user, router]);

  return (
    <div className="flex h-[50vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        <p className="text-sm text-neutral-600">Loading your workspace...</p>
      </div>
    </div>
  );
}
