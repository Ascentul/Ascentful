'use client';

import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { AlertTriangle, Bell, Check, Loader2, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Notification {
  _id: Id<'notifications'>;
  type: string;
  title: string;
  message: string;
  link?: string;
  related_id?: string;
  read: boolean;
  created_at: number;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function SignalNotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewNotification, setHasNewNotification] = useState(false);
  const prevUnreadCountRef = useRef<number>(0);

  const notifications = useQuery(api.notifications.getNotifications, { unreadOnly: false });
  const unreadCount = useQuery(api.notifications.getUnreadCount);
  const markAsRead = useMutation(api.notifications.markAsRead);

  // Filter to only signal notifications
  const signalNotifications =
    notifications?.filter((n) => n.type === 'signal' || n.type === 'signal_urgent') || [];

  const unreadSignalCount = signalNotifications.filter((n) => !n.read).length;

  // Animate bell only when new notifications arrive (count increases)
  useEffect(() => {
    if (unreadSignalCount > prevUnreadCountRef.current) {
      setHasNewNotification(true);
      const timer = setTimeout(() => setHasNewNotification(false), 3000);
      prevUnreadCountRef.current = unreadSignalCount;
      return () => clearTimeout(timer);
    }
    prevUnreadCountRef.current = unreadSignalCount;
  }, [unreadSignalCount]);

  const handleMarkAsRead = useCallback(
    async (notificationId: Id<'notifications'>) => {
      try {
        await markAsRead({ notificationId });
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    },
    [markAsRead],
  );

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      // Only mark signal notifications as read, not all notification types
      const unreadSignals = signalNotifications.filter((n) => !n.read);
      await Promise.all(unreadSignals.map((n) => markAsRead({ notificationId: n._id })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }, [markAsRead, signalNotifications]);

  if (!notifications) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <Loader2 className="h-5 w-5 animate-spin" />
      </Button>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Signal notifications"
          className={`relative ${hasNewNotification ? 'animate-pulse' : ''}`}
        >
          <Bell className="h-5 w-5" />
          {unreadSignalCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadSignalCount > 9 ? '9+' : unreadSignalCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Signal Notifications
          </span>
          {unreadSignalCount > 0 && (
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleMarkAllAsRead}>
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {signalNotifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No signal notifications</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            {signalNotifications.slice(0, 20).map((notification) => (
              <DropdownMenuItem
                key={notification._id}
                className={`flex flex-col items-start gap-1 p-3 cursor-pointer ${
                  !notification.read ? 'bg-amber-50' : ''
                }`}
                onClick={() => {
                  if (!notification.read) {
                    handleMarkAsRead(notification._id);
                  }
                }}
              >
                <div className="flex items-start justify-between w-full gap-2">
                  <div className="flex items-center gap-2">
                    {notification.type === 'signal_urgent' && (
                      <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    )}
                    <span
                      className={`text-sm font-medium ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}
                    >
                      {notification.title}
                    </span>
                  </div>
                  {!notification.read && (
                    <div className="h-2 w-2 bg-amber-500 rounded-full flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
                <div className="flex items-center justify-between w-full mt-1">
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(notification.created_at)}
                  </span>
                  {notification.link && (
                    <Link
                      href={notification.link}
                      className="text-xs text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View →
                    </Link>
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </ScrollArea>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/advisor/queue" className="w-full text-center text-sm font-medium">
            View All Signals
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Real-time signal toast notifications.
 * Shows a toast when new urgent/high signals arrive.
 */
export function useSignalNotificationToast() {
  const notifications = useQuery(api.notifications.getNotifications, { unreadOnly: true });
  const [lastSeenCount, setLastSeenCount] = useState<number | null>(null);

  useEffect(() => {
    if (!notifications) return;

    const signalNotifications = notifications.filter(
      (n) => (n.type === 'signal' || n.type === 'signal_urgent') && !n.read,
    );

    if (lastSeenCount !== null && signalNotifications.length > lastSeenCount) {
      // New notification arrived - could trigger toast here
      const newNotification = signalNotifications[0];
      if (newNotification) {
        // In a real implementation, this would use the toast system
        console.log('[Signal] New notification:', newNotification.title);
      }
    }

    setLastSeenCount(signalNotifications.length);
  }, [notifications, lastSeenCount]);

  return {
    unreadCount:
      notifications?.filter((n) => (n.type === 'signal' || n.type === 'signal_urgent') && !n.read)
        .length || 0,
  };
}
