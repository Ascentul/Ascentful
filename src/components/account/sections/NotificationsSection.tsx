'use client';

import { Id } from 'convex/_generated/dataModel';

import { PushNotificationSettings } from '@/components/settings/PushNotificationSettings';
import { useAuth } from '@/contexts/ClerkAuthProvider';

/**
 * NotificationsSection - Account settings for push notifications
 *
 * Allows users to manage their push notification preferences and subscriptions.
 */
export function NotificationsSection() {
  const { user } = useAuth();

  if (!user?._id) {
    return (
      <div className="text-center py-8 text-muted-foreground">Loading user information...</div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Notification Preferences</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage how and when you receive notifications from Ascentul.
        </p>
      </div>

      <PushNotificationSettings userId={user._id as Id<'users'>} />
    </div>
  );
}
