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
 * Admin-only items are hidden for non-admin users; route guards enforce access.
 */
export const UNIVERSITY_WORKSPACE_NAV: UniversityNavItem[] = [
  {
    id: 'home',
    label: 'Home',
    href: '/u/home',
    icon: 'Home',
  },
  {
    id: 'students',
    label: 'My Students',
    href: '/u/students',
    icon: 'Users',
  },
  {
    id: 'queue',
    label: 'Action Queue',
    href: '/u/queue',
    icon: 'ClipboardList',
  },
  {
    id: 'inbox',
    label: 'Inbox',
    href: '/u/inbox',
    icon: 'MessageSquare',
  },
  {
    id: 'calendar',
    label: 'Calendar',
    href: '/u/advising/calendar',
    icon: 'Calendar',
  },
  {
    id: 'appointments',
    label: 'Appointments',
    href: '/u/advising/sessions',
    icon: 'Clock',
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
  {
    id: 'admin',
    label: 'Admin Console',
    href: '/u/admin',
    icon: 'Settings',
    adminOnly: true,
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
 * Filter navigation items based on user role.
 * Currently returns all items - route-level guards handle actual access control
 * and admin items display a lock badge in the UI.
 */
export function getVisibleNavItems(items: UniversityNavItem[]): UniversityNavItem[] {
  return items;
}
