'use client';

import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { Bell, Loader2, MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { formatRelativeTime } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

function IconButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { hasUnread?: boolean },
) {
  const { hasUnread, children, className = '', ...rest } = props;

  return (
    <button
      type="button"
      {...rest}
      className={cn(
        'relative flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors',
        className,
      )}
    >
      {children}
      {hasUnread && (
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
      )}
    </button>
  );
}

export interface NotificationButtonsProps {
  /** Whether there are unread messages */
  hasUnreadMessages?: boolean;
  /** Whether there are unread notifications */
  hasUnreadNotifications?: boolean;
  /** Click handler for messages button */
  onMessagesClick?: () => void;
}

/**
 * NotificationButtons component
 *
 * Displays message and notification buttons with optional unread indicators.
 * For advisors/university_admins, shows signal notifications in a dropdown.
 *
 * @example
 * ```tsx
 * <NotificationButtons
 *   hasUnreadMessages={unreadCount > 0}
 *   hasUnreadNotifications={notificationCount > 0}
 *   onMessagesClick={() => router.push('/messages')}
 * />
 * ```
 */
export function NotificationButtons({
  hasUnreadMessages = false,
  hasUnreadNotifications: hasUnreadNotificationsProp = false,
  onMessagesClick,
}: NotificationButtonsProps) {
  const router = useRouter();
  const { user } = useAuth();

  // Check if user is advisor or university admin
  const isAdvisorOrAdmin = user?.role === 'advisor' || user?.role === 'university_admin';
  const userId = user?._id;

  // Query notifications - endpoint uses auth context internally, skip until auth loads
  const notifications = useQuery(api.notifications.getNotifications, userId ? {} : 'skip');

  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);

  // Count unread notifications
  const unreadCount = useMemo(() => {
    if (!notifications) return 0;
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const hasUnreadNotifications = hasUnreadNotificationsProp || unreadCount > 0;

  // Handle notification click
  const handleNotificationClick = useCallback(
    (notificationId: Id<'notifications'>, link?: string) => {
      // Fire-and-forget for instant navigation UX
      markAsRead({ notificationId }).catch(() => {
        // Silent fail is acceptable - navigation takes priority
      });
      if (link) {
        router.push(link);
      }
    },
    [markAsRead, router],
  );

  // Handle mark all as read
  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllAsRead({});
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
    }
  }, [markAllAsRead]);

  return (
    <div className="flex items-center gap-2">
      <IconButton aria-label="Messages" hasUnread={hasUnreadMessages} onClick={onMessagesClick}>
        <MessageCircle className="h-4 w-4" />
      </IconButton>

      {/* Enhanced Notification Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton aria-label="Notifications" hasUnread={hasUnreadNotifications}>
            <Bell className="h-4 w-4" />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkAllAsRead();
                }}
                className="text-xs text-primary-500 hover:underline"
              >
                Mark all read
              </button>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {!notifications ? (
            <div className="p-4 text-center">
              <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No notifications</div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {notifications.slice(0, 10).map((notification) => (
                <DropdownMenuItem
                  key={notification._id}
                  onClick={() => handleNotificationClick(notification._id, notification.link)}
                  className={cn(
                    'flex flex-col items-start gap-1 p-3 cursor-pointer',
                    !notification.read && 'bg-primary-50/50',
                  )}
                >
                  <div className="flex items-start justify-between w-full gap-2">
                    <span className="font-medium text-sm line-clamp-1">
                      {!notification.read && <span className="sr-only">Unread: </span>}
                      {notification.title}
                    </span>
                    {!notification.read && (
                      <span
                        className="h-2 w-2 rounded-full bg-primary-500 shrink-0 mt-1"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground line-clamp-2">
                    {notification.message}
                  </span>
                  <span className="text-xs text-muted-foreground/70">
                    {formatRelativeTime(notification.created_at)}
                  </span>
                </DropdownMenuItem>
              ))}
              {notifications.length > 10 && (
                <div className="p-2 text-center text-xs text-muted-foreground border-t">
                  +{notifications.length - 10} more notifications
                </div>
              )}
            </div>
          )}

          {isAdvisorOrAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push('/advisor/queue')}
                className="text-center justify-center text-sm text-primary-600"
              >
                View Signal Queue
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
