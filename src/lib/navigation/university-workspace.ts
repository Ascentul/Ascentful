/**
 * University Workspace Navigation Configuration
 *
 * Data-driven navigation config for the unified /u/* workspace.
 * Combines all advisor and admin pages into a single sidebar.
 */

export interface UniversityNavItem {
  id: string;
  label: string;
  href: string;
  icon: string; // Icon name from lucide-react
  adminOnly?: boolean;
  children?: UniversityNavItem[];
}

/**
 * Complete navigation structure for the University Career Services workspace.
 * All items are visible in the sidebar (admin items marked with badge).
 * Route-level guards enforce actual access control.
 */
export const UNIVERSITY_WORKSPACE_NAV: UniversityNavItem[] = [
  // Home - entry point with smart redirect
  {
    id: 'home',
    label: 'Home',
    href: '/u/home',
    icon: 'Home',
  },

  // --- Advisor Section (visible to all university users) ---
  {
    id: 'students',
    label: 'My Students',
    href: '/u/students',
    icon: 'Users',
  },
  {
    id: 'advising',
    label: 'Advising',
    href: '/u/advising',
    icon: 'Calendar',
    children: [
      {
        id: 'today',
        label: 'Today',
        href: '/u/advising/today',
        icon: 'Clock',
      },
      {
        id: 'calendar',
        label: 'Calendar',
        href: '/u/advising/calendar',
        icon: 'Calendar',
      },
      {
        id: 'sessions',
        label: 'Sessions',
        href: '/u/advising/sessions',
        icon: 'Mic',
      },
      {
        id: 'reviews',
        label: 'Reviews',
        href: '/u/advising/reviews',
        icon: 'FileEdit',
      },
    ],
  },
  {
    id: 'applications',
    label: 'Applications',
    href: '/u/applications',
    icon: 'ClipboardList',
  },
  {
    id: 'insights',
    label: 'Insights',
    href: '/u/insights',
    icon: 'LineChart',
  },
  {
    id: 'outcomes',
    label: 'Outcomes',
    href: '/u/outcomes',
    icon: 'GraduationCap',
  },
  {
    id: 'support',
    label: 'Support',
    href: '/u/support',
    icon: 'HelpCircle',
  },

  // --- Admin Console Section (adminOnly: true) ---
  {
    id: 'admin',
    label: 'Admin Console',
    href: '/u/admin',
    icon: 'Settings',
    adminOnly: true,
    children: [
      {
        id: 'admin-dashboard',
        label: 'Dashboard',
        href: '/u/admin/dashboard',
        icon: 'LayoutDashboard',
        adminOnly: true,
      },
      {
        id: 'admin-students',
        label: 'All Students',
        href: '/u/admin/students',
        icon: 'UserCog',
        adminOnly: true,
      },
      {
        id: 'admin-departments',
        label: 'Departments',
        href: '/u/admin/departments',
        icon: 'Building',
        adminOnly: true,
      },
      {
        id: 'admin-courses',
        label: 'Courses',
        href: '/u/admin/courses',
        icon: 'BookOpen',
        adminOnly: true,
      },
      {
        id: 'admin-invite',
        label: 'Invitations',
        href: '/u/admin/invite',
        icon: 'Mail',
        adminOnly: true,
      },
      {
        id: 'admin-progress',
        label: 'Progress',
        href: '/u/admin/progress',
        icon: 'TrendingUp',
        adminOnly: true,
      },
      {
        id: 'admin-analytics',
        label: 'Platform Usage',
        href: '/u/admin/analytics',
        icon: 'BarChart',
        adminOnly: true,
      },
      {
        id: 'admin-settings',
        label: 'Settings',
        href: '/u/admin/settings',
        icon: 'Settings',
        adminOnly: true,
      },
    ],
  },
];

/**
 * Roles that have admin access in the university workspace
 */
export const UNIVERSITY_ADMIN_ROLES = ['university_admin', 'super_admin'] as const;

/**
 * Check if a role has admin access
 */
export function hasUniversityAdminAccess(role: string | undefined | null): boolean {
  if (!role) return false;
  return UNIVERSITY_ADMIN_ROLES.includes(role as (typeof UNIVERSITY_ADMIN_ROLES)[number]);
}

/**
 * Filter navigation items based on user role
 * (Currently returns all items - admin items are marked but visible)
 */
export function getVisibleNavItems(
  items: UniversityNavItem[],
  _isAdmin: boolean,
): UniversityNavItem[] {
  // For now, return all items - admin items will show lock badge
  // Route-level guards handle actual access control
  return items;
}
