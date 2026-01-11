'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { Bell, MessageCircle, Search, Settings, User as UserIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { GlobalSearch, useGlobalSearch } from '@/components/GlobalSearch';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useSidebarOptional } from '@/contexts/SidebarContext';
import { SIDEBAR_WIDTH_COLLAPSED, SIDEBAR_WIDTH_EXPANDED } from '@/lib/constants/sidebar';
import { cn } from '@/lib/utils';

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  hasUnread?: boolean;
  isActive?: boolean;
};

function IconButton({ hasUnread, isActive, className = '', children, ...rest }: IconButtonProps) {
  return (
    <button
      {...rest}
      className={cn(
        'relative flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm text-slate-500 transition-colors',
        isActive
          ? 'ring-2 ring-primary-500/30 text-slate-700'
          : 'hover:bg-slate-50 hover:text-slate-700',
        className,
      )}
    >
      {children}
      {hasUnread && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />}
    </button>
  );
}

export default function AppTopBar() {
  const router = useRouter();
  const { user, subscription, isAdmin } = useAuth();
  const { user: clerkUser } = useUser();
  const { impersonation, getEffectiveRole, getEffectivePlan } = useImpersonation();
  const globalSearch = useGlobalSearch();
  const sidebarContext = useSidebarOptional();
  const isSidebarExpanded = sidebarContext?.isExpanded ?? true;

  // Get effective role/plan for badge display
  const effectiveRole = getEffectiveRole();
  const effectivePlan = getEffectivePlan();
  const effectiveIsAdmin = effectiveRole === 'super_admin';

  // Fetch viewer data to get student context (university name)
  const viewer = useQuery(api.viewer.getViewer, clerkUser ? {} : 'skip');

  // Check if user is university-affiliated (they have a dedicated badge in sidebar)
  const isUniversityAffiliated = viewer?.university != null;

  // Compute badge text - only for non-university users (university users have sidebar badge)
  // Free plan users don't need badge here since it's shown in sidebar bottom left
  const badgeText =
    effectiveIsAdmin || isUniversityAffiliated
      ? null
      : impersonation.isImpersonating
        ? effectivePlan || effectiveRole
        : subscription.isPremium
          ? subscription.planName
          : null;
  const [openPanel, setOpenPanel] = useState<
    null | 'search' | 'messages' | 'notifications' | 'profile'
  >(null);
  const [unreadMessages, setUnreadMessages] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch notification count from Convex
  const unreadCount = useQuery(api.notifications.getUnreadCount, user ? {} : 'skip');

  // Fetch notifications
  const notifications = useQuery(
    api.notifications.getNotifications,
    openPanel === 'notifications' && user ? { unreadOnly: false } : 'skip',
  );

  // Mark notification as read mutation
  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsReadMutation = useMutation(api.notifications.markAllAsRead);

  const hasUnreadNotifications = (unreadCount ?? 0) > 0;

  const togglePanel = (panel: 'search' | 'messages' | 'notifications' | 'profile') => {
    setOpenPanel((prev) => {
      const next = prev === panel ? null : panel;
      if (next === 'messages') {
        setUnreadMessages(false);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!openPanel) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpenPanel(null);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [openPanel]);

  return (
    <header className="relative z-20">
      <div className="relative flex w-full items-center justify-end gap-3 px-4 md:px-6 h-[74px] bg-[#f0f2f5]">
        {/* Centered Search Bar - anchored to center of content area (adjusts with sidebar) */}
        <button
          onClick={globalSearch.open}
          className="hidden md:flex items-center gap-3 w-full max-w-md rounded-full border border-slate-200/80 bg-white/90 backdrop-blur-sm px-4 py-2.5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300 group fixed -translate-x-1/2 -translate-y-1/2 top-[38px] cursor-pointer"
          style={{
            left: `calc((100vw + ${isSidebarExpanded ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_COLLAPSED}px) / 2)`,
          }}
        >
          <Search className="h-4 w-4 text-slate-400 group-hover:text-slate-500 transition-colors" />
          <span className="flex-1 text-left text-sm text-slate-400 group-hover:text-slate-500 transition-colors">
            Search applications, resumes, goals...
          </span>
          <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border border-slate-200 bg-slate-100 px-1.5 font-mono text-[10px] font-medium text-slate-500">
            ⌘K
          </kbd>
        </button>

        {/* Right side icons */}
        <div className="flex items-center gap-2.5 mt-[1px]" ref={panelRef}>
          {/* Plan/University Badge */}
          {badgeText && (
            <span className="hidden md:inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
              {badgeText}
            </span>
          )}
          <IconButton
            aria-label="Messages"
            hasUnread={unreadMessages}
            isActive={openPanel === 'messages'}
            onClick={() => togglePanel('messages')}
          >
            <MessageCircle className="h-4 w-4" />
          </IconButton>
          <IconButton
            aria-label="Notifications"
            hasUnread={hasUnreadNotifications}
            isActive={openPanel === 'notifications'}
            onClick={() => togglePanel('notifications')}
          >
            <Bell className="h-4 w-4" />
          </IconButton>

          {/* Profile Avatar */}
          {clerkUser && (
            <button
              onClick={() => togglePanel('profile')}
              className="flex-shrink-0"
              aria-label="Profile menu"
            >
              <div
                className={cn(
                  'relative h-10 w-10 rounded-full ring-2 transition-all overflow-hidden shadow-sm cursor-pointer',
                  openPanel === 'profile'
                    ? 'ring-primary-500'
                    : 'ring-primary-500/50 hover:ring-primary-500',
                )}
              >
                <Image
                  src={
                    user?.profile_image ||
                    clerkUser.imageUrl ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(clerkUser.firstName || user?.name || 'User')}&background=5371FF&color=fff`
                  }
                  alt="Profile"
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                />
              </div>
            </button>
          )}
        </div>

        {openPanel === 'messages' && (
          <div className="absolute right-4 top-[calc(100%+8px)] w-full max-w-xs rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
            <p className="mb-2 text-xs font-semibold text-slate-500">Messages</p>
            <p className="text-sm text-slate-600">No new messages.</p>
          </div>
        )}

        {openPanel === 'notifications' && (
          <div className="absolute right-4 top-[calc(100%+8px)] w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-900">Notifications</p>
              {hasUnreadNotifications && (
                <button
                  onClick={async () => {
                    try {
                      await markAllAsReadMutation({});
                      router.refresh();
                    } catch (err) {
                      console.error('Failed to mark all notifications as read:', err);
                      toast.error('Failed to mark notifications as read. Please try again.');
                    }
                  }}
                  className="text-xs text-[#4257FF] hover:text-[#3f5dde] transition-colors"
                >
                  Mark all as read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {!notifications || notifications.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-sm text-slate-600">You are all caught up.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {notifications.map((notification) => (
                    <div
                      key={notification._id}
                      className={cn(
                        'p-3 hover:bg-slate-50 transition-colors cursor-pointer',
                        !notification.read && 'bg-blue-50/50',
                      )}
                      onClick={() => {
                        if (!notification.read) {
                          markAsRead({ notificationId: notification._id }).catch((err) => {
                            console.error('Failed to mark notification as read:', err);
                            toast.error('Failed to update notification.');
                          });
                        }
                        if (notification.link) {
                          router.push(notification.link);
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900">{notification.title}</p>
                          <p className="text-xs text-slate-600 mt-0.5">{notification.message}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {new Date(notification.created_at).toLocaleString()}
                          </p>
                        </div>
                        {!notification.read && (
                          <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {openPanel === 'profile' && (
          <div className="absolute right-4 top-[calc(100%+8px)] w-64 rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden z-50">
            <Link
              href="/account"
              onClick={() => setOpenPanel(null)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-100"
            >
              <Settings className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-900">Account Settings</span>
            </Link>
            <Link
              href="/profile"
              onClick={() => setOpenPanel(null)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
            >
              <UserIcon className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-900">Career Profile</span>
            </Link>
          </div>
        )}
      </div>

      {/* Global Search Modal */}
      <GlobalSearch isOpen={globalSearch.isOpen} onClose={globalSearch.close} />
    </header>
  );
}
