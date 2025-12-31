'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useQuery } from 'convex/react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart,
  Bell,
  BookOpen,
  Bot,
  Briefcase,
  Building,
  Calendar,
  ChevronRight,
  ChevronsLeft,
  ClipboardList,
  Clock,
  Compass,
  FileEdit,
  FileText,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  LineChart,
  Linkedin,
  LogOut,
  Mail,
  Menu,
  Mic,
  PanelLeft,
  PanelRight,
  School,
  Search,
  Settings,
  ShieldCheck,
  Target,
  Trophy,
  User as UserIcon,
  UserRound,
  Zap,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useSidebarOptional } from '@/contexts/SidebarContext';
import { useToast } from '@/hooks/use-toast';
import { hasUniversityAdminAccess } from '@/lib/constants/roles';
import { SIDEBAR_WIDTH_COLLAPSED, SIDEBAR_WIDTH_EXPANDED } from '@/lib/constants/sidebar';

// Sidebar section types
type SidebarSection = {
  id: string;
  title: string;
  icon: React.ReactNode;
  items?: SidebarItem[];
  href?: string;
  onClick?: () => void;
  pro?: boolean;
  alsoActiveFor?: string[]; // Additional paths that should highlight this section
};

type SidebarItem = {
  href: string;
  icon: React.ReactNode;
  label: string;
  pro?: boolean;
};

interface SidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

const Sidebar = React.memo(function Sidebar({ isOpen, onToggle }: SidebarProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const { user, signOut, isAdmin, subscription, hasPremium } = useAuth();
  const { impersonation, getEffectiveRole, getEffectivePlan } = useImpersonation();
  const { toast } = useToast();
  const sidebarContext = useSidebarOptional();

  // Get the effective role (impersonated or real)
  const effectiveRole = getEffectiveRole();
  const effectivePlan = getEffectivePlan();

  // Determine admin status based on effective role (for impersonation)
  const effectiveIsAdmin = effectiveRole === 'super_admin';
  const effectiveIsUniAdmin = effectiveRole === 'university_admin';

  // Fetch viewer data to get student context (university name)
  const viewer = useQuery(api.viewer.getViewer, clerkUser ? {} : 'skip');

  // Check if user is on free plan and not a university admin or premium user
  // When impersonating, use the effective plan/role
  const isFreeUser = useMemo(() => {
    if (impersonation.isImpersonating) {
      // When impersonating, use effective plan
      return effectivePlan === 'free';
    }
    return !hasPremium && user?.role !== 'university_admin' && !isAdmin;
  }, [impersonation.isImpersonating, effectivePlan, hasPremium, user?.role, isAdmin]);

  const isUniversityUser = useMemo(() => {
    if (impersonation.isImpersonating) {
      return effectivePlan === 'university' || hasUniversityAdminAccess(effectiveRole);
    }
    return hasUniversityAdminAccess(user?.role) || subscription.isUniversity;
  }, [
    impersonation.isImpersonating,
    effectivePlan,
    effectiveRole,
    user?.role,
    subscription.isUniversity,
  ]);

  // Fetch usage data ONLY for free users (optimization: skip query for premium/university users)
  const usageData = useQuery(
    api.usage.getUserUsage,
    user?.clerkId && isFreeUser ? { clerkId: user.clerkId } : 'skip',
  );

  const sidebarRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [hoverSection, setHoverSection] = useState<string | null>(null);
  // Use context state if available, otherwise fall back to local state
  const [localExpanded, setLocalExpanded] = useState<boolean>(
    typeof window !== 'undefined' ? localStorage.getItem('sidebarExpanded') !== 'false' : true,
  );
  // Prefer context state, fall back to local state
  const expanded = sidebarContext?.isExpanded ?? localExpanded;
  const setExpanded = sidebarContext?.setExpanded ?? setLocalExpanded;
  const [menuPositions, setMenuPositions] = useState<Record<string, number>>({});
  // Persisted collapsed state per section id
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('sidebarCollapsedSections');
        return saved ? JSON.parse(saved) : {};
      } catch {}
    }
    return {};
  });

  // Support ticket related state
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [issueType, setIssueType] = useState('Other');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Upsell modal for Pro-only features
  const [showUpsellModal, setShowUpsellModal] = useState(false);

  // Memoize sidebar sections - Grouped navigation structure
  const sidebarSections: SidebarSection[] = useMemo(
    () => [
      {
        id: 'dashboard',
        title: 'Dashboard',
        icon: <LayoutDashboard className="h-5 w-5" />,
        href: '/dashboard',
      },
      {
        id: 'applications',
        title: 'Applications',
        icon: <ClipboardList className="h-5 w-5" />,
        href: '/applications',
        alsoActiveFor: ['/job-search'],
      },
      {
        id: 'resume-studio',
        title: 'Resume Studio',
        icon: <FileText className="h-5 w-5" />,
        href: '/resume-studio',
      },
      {
        id: 'interview-practice',
        title: 'Interview Practice',
        icon: <Mic className="h-5 w-5" />,
        href: '/interview-practice',
        pro: true,
      },
      {
        id: 'career-explorer',
        title: 'Career Explorer',
        icon: <Compass className="h-5 w-5" />,
        href: '/career-explorer',
      },
      {
        id: 'career-coach',
        title: 'Career Coach',
        icon: <Bot className="h-5 w-5" />,
        href: '/career-coach',
        pro: true,
      },
      {
        id: 'network-hub',
        title: 'Network Hub',
        icon: <UserRound className="h-5 w-5" />,
        href: '/contacts',
      },
      {
        id: 'goals',
        title: 'Goals',
        icon: <Target className="h-5 w-5" />,
        href: '/goals',
      },
    ],
    [],
  );

  // Admin sections (top-level for super admins) - flattened for direct access
  const adminSections: SidebarSection[] = useMemo(
    () => [
      {
        id: 'admin-dashboard',
        title: 'Admin Dashboard',
        icon: <ShieldCheck className="h-5 w-5" />,
        href: '/admin',
      },
      {
        id: 'admin-users',
        title: 'User Management',
        icon: <UserIcon className="h-5 w-5" />,
        href: '/admin/users',
      },
      {
        id: 'admin-universities',
        title: 'Universities',
        icon: <School className="h-5 w-5" />,
        href: '/admin/universities',
      },
      {
        id: 'admin-analytics',
        title: 'Analytics',
        icon: <BarChart className="h-5 w-5" />,
        href: '/admin/analytics',
      },
      {
        id: 'admin-support',
        title: 'Support Tickets',
        icon: <HelpCircle className="h-5 w-5" />,
        href: '/admin/support',
      },
      {
        id: 'admin-settings',
        title: 'Settings',
        icon: <Settings className="h-5 w-5" />,
        href: '/admin/settings',
      },
    ],
    [],
  );

  // University sections - streamlined for University Admins
  const universitySections: SidebarSection[] = useMemo(
    () => [
      {
        id: 'university-dashboard',
        title: 'Dashboard',
        icon: <School className="h-5 w-5" />,
        href: '/university',
      },
      {
        id: 'university-students',
        title: 'Students',
        icon: <UserIcon className="h-5 w-5" />,
        href: '/university/students',
      },
      {
        id: 'university-departments',
        title: 'Departments',
        icon: <Building className="h-5 w-5" />,
        href: '/university/departments',
      },
      {
        id: 'university-analytics',
        title: 'Analytics',
        icon: <BarChart className="h-5 w-5" />,
        href: '/university/analytics',
      },
      {
        id: 'university-support',
        title: 'Support',
        icon: <HelpCircle className="h-5 w-5" />,
        href: '/support',
      },
    ],
    [],
  );

  // Advisor sections - for career advisors
  const advisorSections: SidebarSection[] = useMemo(
    () => [
      {
        id: 'advisor-dashboard',
        title: 'Dashboard',
        icon: <LayoutDashboard className="h-5 w-5" />,
        href: '/advisor',
      },
      {
        id: 'advisor-students',
        title: 'Students',
        icon: <UserIcon className="h-5 w-5" />,
        href: '/advisor/students',
      },
      {
        id: 'advisor-advising',
        title: 'Advising',
        icon: <Calendar className="h-5 w-5" />,
        items: [
          {
            href: '/advisor/advising/today',
            icon: <Clock className="h-4 w-4" />,
            label: 'Today',
          },
          {
            href: '/advisor/advising/calendar',
            icon: <Calendar className="h-4 w-4" />,
            label: 'Calendar',
          },
          {
            href: '/advisor/advising/sessions',
            icon: <Mic className="h-4 w-4" />,
            label: 'Sessions',
          },
          {
            href: '/advisor/advising/reviews',
            icon: <FileEdit className="h-4 w-4" />,
            label: 'Reviews',
          },
        ],
      },
      {
        id: 'advisor-applications',
        title: 'Applications',
        icon: <ClipboardList className="h-5 w-5" />,
        href: '/advisor/applications',
      },
      {
        id: 'advisor-analytics',
        title: 'Analytics',
        icon: <LineChart className="h-5 w-5" />,
        href: '/advisor/analytics',
      },
      {
        id: 'advisor-support',
        title: 'Support',
        icon: <HelpCircle className="h-5 w-5" />,
        href: '/advisor/support',
      },
    ],
    [],
  );

  // Check if user is advisor (supports impersonation)
  const effectiveIsAdvisor = useMemo(() => effectiveRole === 'advisor', [effectiveRole]);

  // Determine which sections to show based on effective role (supports impersonation)
  const allSections: SidebarSection[] = useMemo(() => {
    if (effectiveIsAdvisor) {
      return advisorSections;
    } else if (effectiveIsUniAdmin) {
      return universitySections;
    } else if (effectiveIsAdmin) {
      return adminSections;
    } else {
      return sidebarSections;
    }
  }, [
    effectiveIsAdvisor,
    effectiveIsUniAdmin,
    effectiveIsAdmin,
    advisorSections,
    universitySections,
    adminSections,
    sidebarSections,
  ]);

  // Memoize isActive function
  const isActive = useCallback(
    (href: string, exact?: boolean) => {
      if (exact) return pathname === href;
      // For non-exact matches, use prefix matching to handle nested routes
      return pathname === href || pathname.startsWith(href + '/');
    },
    [pathname],
  );

  // Determine active section by matching current pathname - memoized
  const getActiveSectionId = useCallback(() => {
    for (const s of allSections) {
      if (s.href && isActive(s.href)) return s.id;
      if (s.items) {
        for (const it of s.items) {
          // Use exact matching for admin dashboard items to avoid conflicts
          const shouldUseExact = s.id === 'admin-dashboard' && it.href === '/admin';
          if (isActive(it.href, shouldUseExact)) return s.id;
        }
      }
    }
    return null;
  }, [allSections, isActive]);

  // On first load, default all sections with items to collapsed, but auto-expand the active one
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const initialized = localStorage.getItem('sidebarCollapsedInitialized');
      if (!initialized) {
        const next: Record<string, boolean> = {};
        for (const s of allSections) {
          if (s.items && s.items.length > 0) next[s.id] = true; // collapsed by default
        }
        const activeId = getActiveSectionId();
        if (activeId) next[activeId] = false; // expand active section
        setCollapsedSections(next);
        localStorage.setItem('sidebarCollapsedSections', JSON.stringify(next));
        localStorage.setItem('sidebarCollapsedInitialized', 'true');
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  // Always ensure the currently active section is expanded when route changes
  useEffect(() => {
    const activeId = getActiveSectionId();
    if (!activeId) return;
    setCollapsedSections((prev) => {
      if (prev && prev[activeId] === false) return prev;
      const next = { ...prev, [activeId]: false };
      try {
        localStorage.setItem('sidebarCollapsedSections', JSON.stringify(next));
      } catch {}
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut();
      router.push('/sign-in');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [signOut, router]);

  const handleSupportSubmit = useCallback(async () => {
    if (!subject.trim() || !description.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject,
          description,
          issueType,
          source: 'sidebar',
        }),
      });

      if (response.ok) {
        setShowSupportModal(false);
        setSubject('');
        setDescription('');
        setIssueType('Other');
      }
    } catch (error) {
      console.error('Error submitting support ticket:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [subject, description, issueType]);

  const toggleExpanded = useCallback(() => {
    if (sidebarContext) {
      // Use context toggle which handles localStorage
      sidebarContext.toggle();
    } else {
      // Fall back to local state management
      const newExpanded = !localExpanded;
      setLocalExpanded(newExpanded);
      if (typeof window !== 'undefined') {
        localStorage.setItem('sidebarExpanded', newExpanded.toString());
      }
    }
  }, [sidebarContext, localExpanded]);

  const renderSidebarItem = useCallback(
    (item: SidebarItem, sectionId?: string, forceExact?: boolean) => {
      // Use exact matching for the main admin dashboard item to avoid highlighting conflicts
      // when on sub-pages like /admin/analytics - only highlight the specific item, not the parent
      const shouldUseExact =
        forceExact || (sectionId === 'admin-dashboard' && item.href === '/admin');
      const active = isActive(item.href, shouldUseExact);
      const disabled = item.pro && isFreeUser;

      return (
        <Link
          key={item.href}
          href={disabled ? '#' : item.href}
          className={`
          flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-all duration-200 border border-transparent min-h-[40px] px-3
          ${
            active
              ? 'bg-white text-slate-900 shadow-sm border-slate-200'
              : disabled
                ? 'cursor-not-allowed text-slate-400'
                : 'text-[#576879] hover:text-slate-800 hover:bg-white/50'
          }
          `}
          onClick={
            disabled
              ? (e) => {
                  e.preventDefault();
                  setShowUpsellModal(true);
                }
              : undefined
          }
        >
          <span className="flex-shrink-0 w-5 h-5 min-w-[20px] flex items-center justify-center scale-[0.95] ml-[1px]">
            {item.icon}
          </span>
          {expanded && (
            <>
              <span className="flex-1 whitespace-nowrap overflow-hidden">{item.label}</span>
              {item.pro && isFreeUser && <Zap className="h-3 w-3 text-warning-500 flex-shrink-0" />}
            </>
          )}
        </Link>
      );
    },
    [isActive, isFreeUser, expanded],
  );

  const renderSection = useCallback(
    (section: SidebarSection) => {
      const hasItems = section.items && section.items.length > 0;
      // Use exact matching for sections with href to avoid highlighting parent when on child routes
      // Also check alsoActiveFor paths (e.g., /job-search should highlight Applications)
      const sectionActive = section.href
        ? isActive(section.href, true) ||
          (section.alsoActiveFor?.some((path) => pathname.startsWith(path)) ?? false)
        : false;
      const isCollapsed = !!collapsedSections[section.id];

      // Check if any child items are active (but not the first item in admin sections to avoid double-highlighting)
      const hasActiveItem =
        hasItems &&
        section.items?.some((item) => {
          const shouldUseExact = section.id === 'admin-dashboard' && item.href === '/admin';
          return isActive(item.href, shouldUseExact);
        });

      // Check if this is a pro feature
      const isPro = 'pro' in section && section.pro;
      const disabled = isPro && isFreeUser;

      if (!hasItems && section.onClick) {
        // Single item section with onClick handler (e.g., Support)
        return (
          <button
            key={section.id}
            onClick={section.onClick}
            className={`
            w-full flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-colors min-h-[40px] px-3
            ${
              disabled
                ? 'cursor-not-allowed text-slate-400'
                : 'text-[#576879] hover:text-slate-800 hover:bg-white/50'
            }
          `}
          >
            <span className="flex-shrink-0 w-5 h-5 min-w-[20px] flex items-center justify-center scale-[0.95] ml-[1px]">
              {section.icon}
            </span>
            {expanded && (
              <>
                <span className="flex-1 whitespace-nowrap overflow-hidden">{section.title}</span>
                {isPro && isFreeUser && <Zap className="h-3 w-3 text-warning-500 flex-shrink-0" />}
              </>
            )}
          </button>
        );
      }

      if (!hasItems && section.href) {
        // Single item section - new flat structure
        return (
          <Link
            key={section.id}
            href={disabled ? '#' : section.href}
            className={`
            flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-all duration-200 border border-transparent min-h-[40px] px-3
            ${
              sectionActive || hasActiveItem
                ? 'bg-white text-slate-900 shadow-sm border-slate-200'
                : disabled
                  ? 'cursor-not-allowed text-slate-400'
                  : 'text-[#576879] hover:text-slate-800 hover:bg-white/50'
            }
          `}
            onClick={
              disabled
                ? (e) => {
                    e.preventDefault();
                    setShowUpsellModal(true);
                  }
                : undefined
            }
          >
            <span className="flex-shrink-0 w-5 h-5 min-w-[20px] flex items-center justify-center scale-[0.95] ml-[1px]">
              {section.icon}
            </span>
            {expanded && (
              <>
                <span className="flex-1 whitespace-nowrap overflow-hidden">{section.title}</span>
                {isPro && isFreeUser && <Zap className="h-3 w-3 text-warning-500 flex-shrink-0" />}
              </>
            )}
          </Link>
        );
      }

      // Section with items (collapsible)
      const toggleSectionItems = () => {
        setCollapsedSections((prev) => {
          const next = { ...prev, [section.id]: !prev[section.id] };
          try {
            localStorage.setItem('sidebarCollapsedSections', JSON.stringify(next));
          } catch {}
          return next;
        });
      };

      return (
        <div key={section.id} className="space-y-1">
          <div
            className="flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium cursor-pointer select-none transition-colors text-[#576879] hover:bg-white/50 hover:text-slate-800 min-h-[40px] px-3"
            role="button"
            aria-expanded={!isCollapsed}
            onClick={toggleSectionItems}
          >
            <span className="flex-shrink-0 w-5 h-5 min-w-[20px] flex items-center justify-center scale-[0.95] ml-[1px]">
              {section.icon}
            </span>
            {expanded && (
              <span className="flex-1 whitespace-nowrap overflow-hidden">{section.title}</span>
            )}
            {expanded && (
              <ChevronRight
                className={`h-4 w-4 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
              />
            )}
          </div>
          <AnimatePresence initial={false}>
            {hasItems && !isCollapsed && (
              <motion.div
                key={`${section.id}-items`}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                style={{ overflow: 'hidden' }}
                className="ml-4 space-y-1"
              >
                {section.items?.map((it) => renderSidebarItem(it, section.id))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    },
    [isActive, collapsedSections, expanded, isFreeUser, renderSidebarItem, pathname],
  );

  return (
    <div className="relative h-full">
      <motion.div
        ref={sidebarRef}
        initial={false}
        animate={{ width: expanded ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_COLLAPSED }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className={`
          z-30
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
          fixed inset-y-0 left-0 md:relative md:inset-0 flex flex-col
          bg-transparent
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
          <nav className="flex-1 space-y-2 mb-4 w-full mt-[13px]">
            {allSections.map(renderSection)}
          </nav>

          {/* Free Plan Tile near footer */}
          {isFreeUser && expanded && (
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-[0_6px_18px_rgba(0,0,0,0.05)]">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-semibold text-slate-900">Free Plan</span>
                {usageData ? (
                  <span>
                    {usageData.stepsCompleted}/{usageData.totalSteps} steps
                  </span>
                ) : (
                  <span>Loading...</span>
                )}
              </div>
              <div className="mt-2">
                <Progress
                  value={usageData ? (usageData.stepsCompleted / usageData.totalSteps) * 100 : 0}
                  className="h-2"
                />
              </div>
              <Link href="/pricing" className="mt-3 block w-full">
                <Button size="sm" className="w-full bg-primary-500 hover:bg-primary-700 text-white">
                  Upgrade to Pro
                </Button>
              </Link>
            </div>
          )}

          {/* University Badge - for university-affiliated users */}
          {viewer?.university && (
            <div
              className={`mb-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm ${expanded ? '' : 'flex justify-center'}`}
            >
              <div className={`flex items-center ${expanded ? 'gap-3' : ''}`}>
                {viewer.university.universityLogo ? (
                  <Image
                    src={viewer.university.universityLogo}
                    alt={viewer.university.universityName}
                    width={expanded ? 36 : 32}
                    height={expanded ? 36 : 32}
                    className="rounded-lg object-contain"
                  />
                ) : (
                  <div
                    className={`flex items-center justify-center rounded-lg bg-primary-100 ${expanded ? 'h-9 w-9' : 'h-8 w-8'}`}
                  >
                    <School className={`text-primary-500 ${expanded ? 'h-5 w-5' : 'h-4 w-4'}`} />
                  </div>
                )}
                {expanded && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {viewer.university.universityName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {effectiveRole === 'university_admin'
                        ? 'Administrator'
                        : effectiveRole === 'advisor'
                          ? 'Advisor'
                          : 'Student'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer - Account actions */}
          <div className="space-y-1">
            {/* Pro Upsell Modal */}
            <Dialog open={showUpsellModal} onOpenChange={setShowUpsellModal}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Unlock Pro Features</DialogTitle>
                  <DialogDescription>
                    This feature is available on the Pro plan. Upgrade to access LinkedIn
                    Integration and other premium tools.
                  </DialogDescription>
                </DialogHeader>
                <div className="text-sm text-neutral-600">
                  • Save time with LinkedIn job search shortcuts and history
                  <br />• Advanced career tools and automations
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Maybe later</Button>
                  </DialogClose>
                  <Button
                    onClick={async () => {
                      setShowUpsellModal(false);
                      try {
                        const response = await fetch('/api/stripe/checkout', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            plan: 'premium',
                            interval: 'monthly',
                          }),
                        });
                        const data = await response.json();
                        if (data.url) {
                          window.location.href = data.url;
                        } else {
                          toast({
                            title: 'Checkout failed',
                            description: 'Unable to initiate checkout. Please try again.',
                            variant: 'destructive',
                          });
                        }
                      } catch (error) {
                        console.error('Checkout error:', error);
                        toast({
                          title: 'Checkout failed',
                          description: 'Unable to initiate checkout. Please try again.',
                          variant: 'destructive',
                        });
                      }
                    }}
                  >
                    Upgrade Now
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </motion.div>
    </div>
  );
});

export default Sidebar;
