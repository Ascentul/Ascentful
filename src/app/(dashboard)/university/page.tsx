/**
 * University Dashboard Page
 *
 * This page renders the UniversityDashboard component.
 * The actual UI implementation is in @/components/dashboard/UniversityDashboard.tsx
 * to allow reuse across different routes (e.g., /u/home).
 */

import { UniversityDashboard } from '@/components/dashboard/UniversityDashboard';

export default function UniversityDashboardPage() {
  return <UniversityDashboard />;
}
