'use client';

/**
 * UniversityWorkspaceSidebar
 *
 * Unified sidebar for the /u/* workspace showing all advisor and admin pages.
 * Follows the same styling patterns as the main Sidebar component.
 */

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useQuery } from 'convex/react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart,
  BookOpen,
  Building,
  Calendar,
  ChevronRight,
  ClipboardList,
  Clock,
  FileEdit,
  GraduationCap,
  HelpCircle,
  Home,
  LayoutDashboard,
  LineChart,
  Lock,
  Mail,
  Mic,
  Settings,
  TrendingUp,
  UserCog,
  Users,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useSidebarOptional } from '@/contexts/SidebarContext';
import { SIDEBAR_WIDTH_COLLAPSED, SIDEBAR_WIDTH_EXPANDED } from '@/lib/constants/sidebar';
import {
  hasUniversityAdminAccess,
  UNIVERSITY_WORKSPACE_NAV,
  type UniversityNavItem,
} from '@/lib/navigation/university-workspace';

// Icon mapping from string names to components
const ICON_MAP: Record<string, React.ReactNode> = {
  Home: <Home className="h-5 w-5" />,
  Users: <Users className="h-5 w-5" />,
  Calendar: <Calendar className="h-5 w-5" />,
  Clock: <Clock className="h-4 w-4" />,
  Mic: <Mic className="h-4 w-4" />,
  FileEdit: <FileEdit className="h-4 w-4" />,
  ClipboardList: <ClipboardList className="h-5 w-5" />,
  LineChart: <LineChart className="h-5 w-5" />,
  GraduationCap: <GraduationCap className="h-5 w-5" />,
  HelpCircle: <HelpCircle className="h-5 w-5" />,
  Settings: <Settings className="h-5 w-5" />,
  LayoutDashboard: <LayoutDashboard className="h-4 w-4" />,
  UserCog: <UserCog className="h-4 w-4" />,
  Building: <Building className="h-4 w-4" />,
  BookOpen: <BookOpen className="h-4 w-4" />,
  Mail: <Mail className="h-4 w-4" />,
  TrendingUp: <TrendingUp className="h-4 w-4" />,
  BarChart: <BarChart className="h-4 w-4" />,
};

// Get icon component from string name
function getIcon(iconName: string, isChild = false): React.ReactNode {
  const icon = ICON_MAP[iconName];
  if (!icon) {
    return isChild ? <div className="h-4 w-4" /> : <div className="h-5 w-5" />;
  }
  return icon;
}

interface UniversityWorkspaceSidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

export const UniversityWorkspaceSidebar = React.memo(function UniversityWorkspaceSidebar({
  isOpen,
  onToggle,
}: UniversityWorkspaceSidebarProps) {
  const pathname = usePathname();
  const { user } = useUser();
  const sidebarContext = useSidebarOptional();

  // Fetch viewer data to get university name
  const viewer = useQuery(api.viewer.getViewer, user ? {} : 'skip');

  // Get user role from Clerk metadata
  const userRole = user?.publicMetadata?.role as string | undefined;
  const isAdmin = hasUniversityAdminAccess(userRole);

  // Sidebar expanded/collapsed state - initialize with default to avoid hydration mismatch
  const [localExpanded, setLocalExpanded] = useState<boolean>(true);
  const expanded = sidebarContext?.isExpanded ?? localExpanded;
  const setExpanded = sidebarContext?.setExpanded ?? setLocalExpanded;

  // Collapsed sections state - initialize with default to avoid hydration mismatch
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Sync from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    const savedExpanded = localStorage.getItem('universitySidebarExpanded');
    if (savedExpanded !== null) {
      setLocalExpanded(savedExpanded !== 'false');
    }

    try {
      const savedCollapsed = localStorage.getItem('universitySidebarCollapsed');
      if (savedCollapsed) {
        setCollapsedSections(JSON.parse(savedCollapsed));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Check if a path is active
  const isActive = useCallback(
    (href: string, exact = false) => {
      if (exact) return pathname === href;
      return pathname === href || pathname.startsWith(href + '/');
    },
    [pathname],
  );

  // Get active section ID
  const getActiveSectionId = useCallback(() => {
    for (const item of UNIVERSITY_WORKSPACE_NAV) {
      if (item.href && isActive(item.href, !item.children)) return item.id;
      if (item.children) {
        for (const child of item.children) {
          if (isActive(child.href)) return item.id;
        }
      }
    }
    return null;
  }, [isActive]);

  // Auto-expand active section on route change
  useEffect(() => {
    const activeId = getActiveSectionId();
    if (!activeId) return;

    setCollapsedSections((prev) => {
      const next: Record<string, boolean> = {};
      for (const item of UNIVERSITY_WORKSPACE_NAV) {
        if (item.children && item.children.length > 0) {
          next[item.id] = item.id !== activeId;
        }
      }
      const hasChange =
        Object.keys(next).some((key) => prev[key] !== next[key]) ||
        Object.keys(prev).some((key) => !(key in next));
      if (!hasChange) return prev;
      try {
        localStorage.setItem('universitySidebarCollapsed', JSON.stringify(next));
      } catch {
        // Ignore localStorage errors
      }
      return next;
    });
  }, [pathname, getActiveSectionId]);

  // Toggle sidebar expanded state
  const toggleExpanded = useCallback(() => {
    if (sidebarContext) {
      sidebarContext.toggle();
    } else {
      const newExpanded = !localExpanded;
      setLocalExpanded(newExpanded);
      if (typeof window !== 'undefined') {
        localStorage.setItem('universitySidebarExpanded', newExpanded.toString());
      }
    }
  }, [sidebarContext, localExpanded]);

  // Toggle section collapsed state
  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = { ...prev, [sectionId]: !prev[sectionId] };
      try {
        localStorage.setItem('universitySidebarCollapsed', JSON.stringify(next));
      } catch {
        // Ignore localStorage errors
      }
      return next;
    });
  }, []);

  // Render a single nav item (no children)
  const renderNavItem = useCallback(
    (item: UniversityNavItem, isChild = false) => {
      const active = isActive(item.href, true);
      const showLock = item.adminOnly && !isAdmin;

      return (
        <Link
          key={item.id}
          href={item.href}
          className={`
            flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-all duration-200 border border-transparent min-h-[40px] px-3
            ${isChild ? 'ml-4' : ''}
            ${
              active
                ? 'bg-white text-slate-900 shadow-sm border-slate-200'
                : 'text-[#576879] hover:text-slate-800 hover:bg-white/50'
            }
          `}
        >
          <span className="flex-shrink-0 w-5 h-5 min-w-[20px] flex items-center justify-center scale-[0.95] ml-[1px]">
            {getIcon(item.icon, isChild)}
          </span>
          {expanded && (
            <>
              <span className="flex-1 whitespace-nowrap overflow-hidden">{item.label}</span>
              {showLock && <Lock className="h-3 w-3 text-slate-400 flex-shrink-0" />}
            </>
          )}
        </Link>
      );
    },
    [isActive, isAdmin, expanded],
  );

  // Render a collapsible section
  const renderCollapsibleSection = useCallback(
    (item: UniversityNavItem) => {
      const isCollapsed = !!collapsedSections[item.id];
      const showLock = item.adminOnly && !isAdmin;
      const hasActiveChild = item.children?.some((child) => isActive(child.href));

      return (
        <div key={item.id} className="space-y-1">
          <div
            className={`
              flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium cursor-pointer select-none transition-colors min-h-[40px] px-3
              ${hasActiveChild ? 'text-slate-900' : 'text-[#576879] hover:bg-white/50 hover:text-slate-800'}
            `}
            role="button"
            aria-expanded={!isCollapsed}
            onClick={() => toggleSection(item.id)}
          >
            <span className="flex-shrink-0 w-5 h-5 min-w-[20px] flex items-center justify-center scale-[0.95] ml-[1px]">
              {getIcon(item.icon)}
            </span>
            {expanded && (
              <>
                <span className="flex-1 whitespace-nowrap overflow-hidden">{item.label}</span>
                {showLock && <Lock className="h-3 w-3 text-slate-400 flex-shrink-0 mr-1" />}
                <ChevronRight
                  className={`h-4 w-4 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                />
              </>
            )}
          </div>
          <AnimatePresence initial={false}>
            {!isCollapsed && item.children && (
              <motion.div
                key={`${item.id}-items`}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                style={{ overflow: 'hidden' }}
                className="space-y-1"
              >
                {item.children.map((child) => renderNavItem(child, true))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    },
    [collapsedSections, isAdmin, expanded, toggleSection, renderNavItem, isActive],
  );

  // Render navigation items
  const renderNavItems = useMemo(() => {
    return UNIVERSITY_WORKSPACE_NAV.map((item) => {
      if (item.children && item.children.length > 0) {
        return renderCollapsibleSection(item);
      }
      return renderNavItem(item);
    });
  }, [renderNavItem, renderCollapsibleSection]);

  return (
    <motion.div
      initial={false}
      animate={{ width: expanded ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_COLLAPSED }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={`
        z-30
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
        fixed inset-y-0 left-0 md:relative md:inset-0 flex flex-col
        bg-[#f0f2f5]
        pl-6 pr-3 py-5 h-full overflow-y-auto no-scrollbar
        transition-transform duration-300
      `}
    >
      <div className="flex h-full w-full flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pl-[10px] pr-2 mt-[4px]">
          <Image
            src="/logo.png"
            alt="Ascentful logo"
            width={28}
            height={28}
            className="flex-shrink-0 h-7 w-7 rounded-[4px] object-contain"
          />
          <AnimatePresence mode="wait">
            {expanded && (
              <motion.h1
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                className="text-[22px] font-semibold text-primary-500 whitespace-nowrap overflow-hidden leading-7"
              >
                Ascentful
              </motion.h1>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {expanded && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                type="button"
                onClick={toggleExpanded}
                className="hidden md:flex flex-col items-center justify-center gap-[3px] flex-shrink-0 ml-auto h-6 w-6 cursor-pointer hover:opacity-70 transition-opacity"
                aria-label="Collapse sidebar"
              >
                <span className="w-3.5 h-[2px] bg-slate-400 rounded-full" />
                <span className="w-3.5 h-[2px] bg-slate-400 rounded-full" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2 mb-4 w-full mt-[13px]">{renderNavItems}</nav>

        {/* Footer - University Badge */}
        {expanded && (
          <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center rounded-lg bg-primary-100 h-9 w-9">
                <GraduationCap className="h-5 w-5 text-primary-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {viewer?.university?.universityName || 'University Workspace'}
                </p>
                <p className="text-xs text-slate-500">{isAdmin ? 'Administrator' : 'Advisor'}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
});

export default UniversityWorkspaceSidebar;
