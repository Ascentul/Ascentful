'use client';

/**
 * University Workspace Layout
 *
 * Root layout for the unified /u/* workspace.
 * Enforces role-based access (university_admin, advisor, super_admin)
 * and renders the unified workspace shell.
 */

import type { ReactNode } from 'react';

import { RequireRole } from '@/components/auth';
import { UniversityWorkspaceLayout } from '@/components/university/UniversityWorkspaceLayout';

export default function ULayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole
      allowedRoles={['university_admin', 'advisor', 'super_admin']}
      redirectTo="/dashboard"
    >
      <UniversityWorkspaceLayout>{children}</UniversityWorkspaceLayout>
    </RequireRole>
  );
}
