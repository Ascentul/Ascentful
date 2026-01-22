'use client';

import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { Bell, BellOff, BellRing, Check, Loader2, Smartphone, Volume2, X } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { cn } from '@/lib/utils';

interface PushNotificationSettingsProps {
  userId: Id<'users'>;
}

export function PushNotificationSettings({ userId }: PushNotificationSettingsProps) {
  const { toast } = useToast();
  const [isTestingNotification, setIsTestingNotification] = useState(false);

  // Push notification hook
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    requestPermission,
    unsubscribe,
    canSubscribe,
    canUnsubscribe,
  } = usePushNotifications({
    userId,
    onPermissionDenied: () => {
      toast({
        title: 'Permission Denied',
        description:
          'Push notifications were blocked. You can enable them in your browser settings.',
        variant: 'destructive',
      });
    },
    onSubscriptionError: (error) => {
      toast({
        title: 'Subscription Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Get and update preferences
  const preferences = useQuery(api.push_subscriptions.getPushPreferences, { userId });
  const updatePreferences = useMutation(api.push_subscriptions.updatePushPreferences);

  const handleSubscribe = async () => {
    const success = await requestPermission();
    if (success) {
      toast({
        title: 'Notifications Enabled',
        description: 'You will now receive push notifications.',
      });
    }
  };

  const handleUnsubscribe = async () => {
    const success = await unsubscribe();
    if (success) {
      toast({
        title: 'Notifications Disabled',
        description: 'You will no longer receive push notifications on this device.',
      });
    }
  };

  const handlePreferenceChange = async (
    key: keyof NonNullable<typeof preferences>,
    value: boolean,
  ) => {
    try {
      await updatePreferences({
        userId,
        preferences: { [key]: value },
      });
      toast({
        title: 'Preference Updated',
        description: 'Your notification preferences have been saved.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update preferences.',
        variant: 'destructive',
      });
    }
  };

  const handleTestNotification = async () => {
    if (!isSubscribed) return;

    setIsTestingNotification(true);
    try {
      // Get the current subscription from the browser's PushManager
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        throw new Error('No active subscription found');
      }

      const subscriptionJson = subscription.toJSON();

      // Send a test notification through the API with the actual subscription
      const response = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptions: [
            {
              endpoint: subscriptionJson.endpoint,
              expirationTime: subscriptionJson.expirationTime,
              keys: subscriptionJson.keys,
            },
          ],
          payload: {
            title: 'Test Notification',
            body: 'Push notifications are working correctly!',
            url: '/account/settings',
            tag: 'test-notification',
          },
        }),
      });

      if (response.ok) {
        toast({
          title: 'Test Sent',
          description: 'Check your device for the test notification.',
        });
      } else {
        throw new Error('Failed to send test notification');
      }
    } catch (error) {
      toast({
        title: 'Test Failed',
        description: 'Could not send test notification.',
        variant: 'destructive',
      });
    } finally {
      setIsTestingNotification(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Receive instant notifications on your device for important updates.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Support status */}
        {!isSupported && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <BellOff className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">Not Supported</p>
                <p className="text-sm text-amber-700 mt-1">
                  {error ||
                    'Push notifications are not supported in this browser. Try using Chrome, Firefox, or Safari.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Permission denied */}
        {isSupported && permission === 'denied' && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <X className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">Permission Blocked</p>
                <p className="text-sm text-red-700 mt-1">
                  Push notifications are blocked. To enable them, click the lock icon in your
                  browser&apos;s address bar and allow notifications.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Enable/Disable toggle */}
        {isSupported && permission !== 'denied' && (
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              {isSubscribed ? (
                <BellRing className="h-5 w-5 text-green-600" />
              ) : (
                <Bell className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium">
                  {isSubscribed ? 'Notifications Enabled' : 'Enable Notifications'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isSubscribed
                    ? 'You will receive push notifications on this device'
                    : 'Get notified about signals and important updates'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isSubscribed ? (
                <Button variant="outline" size="sm" onClick={handleUnsubscribe}>
                  Disable
                </Button>
              ) : (
                <Button size="sm" onClick={handleSubscribe}>
                  Enable
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Notification preferences (only show if subscribed) */}
        {isSubscribed && preferences && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Volume2 className="h-4 w-4" />
              Notification Types
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Badge
                    variant="destructive"
                    className="h-6 w-6 rounded-full p-0 flex items-center justify-center"
                  >
                    !
                  </Badge>
                  <div>
                    <Label className="font-medium">Urgent Signals</Label>
                    <p className="text-xs text-muted-foreground">
                      Critical issues requiring immediate attention
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.signals_urgent ?? true}
                  onCheckedChange={(checked) => handlePreferenceChange('signals_urgent', checked)}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Badge
                    variant="default"
                    className="h-6 w-6 rounded-full p-0 flex items-center justify-center bg-orange-500"
                  >
                    H
                  </Badge>
                  <div>
                    <Label className="font-medium">High Priority Signals</Label>
                    <p className="text-xs text-muted-foreground">
                      Important issues needing prompt attention
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.signals_high ?? true}
                  onCheckedChange={(checked) => handlePreferenceChange('signals_high', checked)}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className="h-6 w-6 rounded-full p-0 flex items-center justify-center"
                  >
                    M
                  </Badge>
                  <div>
                    <Label className="font-medium">Medium Priority Signals</Label>
                    <p className="text-xs text-muted-foreground">
                      Regular updates about student activity
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.signals_medium ?? true}
                  onCheckedChange={(checked) => handlePreferenceChange('signals_medium', checked)}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label className="font-medium">Application Updates</Label>
                    <p className="text-xs text-muted-foreground">
                      When students update their applications
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.application_updates ?? true}
                  onCheckedChange={(checked) =>
                    handlePreferenceChange('application_updates', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label className="font-medium">Goal Reminders</Label>
                    <p className="text-xs text-muted-foreground">
                      Reminders about upcoming goal deadlines
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.goal_reminders ?? true}
                  onCheckedChange={(checked) => handlePreferenceChange('goal_reminders', checked)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Test notification button */}
        {isSubscribed && (
          <Button
            variant="outline"
            className="w-full"
            onClick={handleTestNotification}
            disabled={isTestingNotification}
          >
            {isTestingNotification ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Bell className="h-4 w-4 mr-2" />
            )}
            Send Test Notification
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
