'use client';

/**
 * Admin Sub-Layout
 *
 * Additional layout for /u/admin/* routes.
 * Enforces university_admin or super_admin role.
 * Advisors without admin access will be redirected.
 */

import type { ReactNode } from 'react';

import { RequireUniversityAdmin } from '@/components/auth';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <RequireUniversityAdmin redirectTo="/u/home">{children}</RequireUniversityAdmin>;
}
