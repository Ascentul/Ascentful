/**
 * Advisor Today Page - Daily Cockpit
 *
 * This page renders the AdvisorTodayDashboard component.
 * The actual UI implementation is in @/components/dashboard/AdvisorTodayDashboard.tsx
 * to allow reuse across different routes (e.g., /u/home).
 */

import { AdvisorTodayDashboard } from '@/components/dashboard/AdvisorTodayDashboard';

export default function AdvisorTodayPage() {
  return <AdvisorTodayDashboard />;
}
