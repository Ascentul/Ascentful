'use client';

import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { useCallback, useEffect, useState } from 'react';

/**
 * Hook for managing Web Push notifications
 *
 * Handles service worker registration, subscription management,
 * and permission requests.
 */

interface UsePushNotificationsOptions {
  userId?: Id<'users'>;
  onPermissionDenied?: () => void;
  onSubscriptionError?: (error: Error) => void;
}

interface PushNotificationState {
  isSupported: boolean;
  permission: NotificationPermission | 'unknown';
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
}

export function usePushNotifications(options: UsePushNotificationsOptions = {}) {
  const { userId, onPermissionDenied, onSubscriptionError } = options;

  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    permission: 'unknown',
    isSubscribed: false,
    isLoading: true,
    error: null,
  });

  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Convex mutations
  const subscribe = useMutation(api.push_subscriptions.subscribe);
  const unsubscribe = useMutation(api.push_subscriptions.unsubscribe);

  // Check if user has active subscription
  const hasActiveSubscription = useQuery(
    api.push_subscriptions.hasActiveSubscription,
    userId ? { userId } : 'skip',
  );

  // VAPID public key from environment
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  // Convert base64 VAPID key to Uint8Array for applicationServerKey
  const urlBase64ToUint8Array = useCallback((base64String: string): ArrayBuffer => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray.buffer;
  }, []);

  // Initialize push notifications
  useEffect(() => {
    const init = async () => {
      // Check browser support
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setState((prev) => ({
          ...prev,
          isSupported: false,
          isLoading: false,
          error: 'Push notifications not supported in this browser',
        }));
        return;
      }

      // Check if VAPID key is configured
      if (!vapidPublicKey) {
        setState((prev) => ({
          ...prev,
          isSupported: false,
          isLoading: false,
          error: 'Push notifications not configured',
        }));
        return;
      }

      try {
        // Register service worker
        const reg = await navigator.serviceWorker.register('/sw-push.js');
        setRegistration(reg);

        // Send VAPID key to service worker
        reg.active?.postMessage({
          type: 'SET_VAPID_KEY',
          key: urlBase64ToUint8Array(vapidPublicKey),
        });

        // Check current permission
        const permission = Notification.permission;

        // Check existing subscription
        const existingSubscription = await reg.pushManager.getSubscription();

        setState({
          isSupported: true,
          permission,
          isSubscribed: !!existingSubscription,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        console.error('Push notification initialization error:', error);
        setState((prev) => ({
          ...prev,
          isSupported: false,
          isLoading: false,
          error: 'Failed to initialize push notifications',
        }));
      }
    };

    init();
  }, [vapidPublicKey, urlBase64ToUint8Array]);

  // Request permission and subscribe
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported || !registration || !vapidPublicKey || !userId) {
      return false;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();

      if (permission === 'denied') {
        setState((prev) => ({
          ...prev,
          permission: 'denied',
          isLoading: false,
        }));
        onPermissionDenied?.();
        return false;
      }

      if (permission !== 'granted') {
        setState((prev) => ({
          ...prev,
          permission,
          isLoading: false,
        }));
        return false;
      }

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      // Save subscription to Convex
      const subscriptionJson = subscription.toJSON();
      await subscribe({
        userId,
        subscription: {
          endpoint: subscriptionJson.endpoint!,
          expirationTime: subscriptionJson.expirationTime ?? null,
          keys: {
            p256dh: subscriptionJson.keys!.p256dh,
            auth: subscriptionJson.keys!.auth,
          },
        },
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
        },
      });

      setState((prev) => ({
        ...prev,
        permission: 'granted',
        isSubscribed: true,
        isLoading: false,
      }));

      return true;
    } catch (error) {
      console.error('Push subscription error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to subscribe';
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      onSubscriptionError?.(error instanceof Error ? error : new Error(errorMessage));
      return false;
    }
  }, [
    state.isSupported,
    registration,
    vapidPublicKey,
    userId,
    urlBase64ToUint8Array,
    subscribe,
    onPermissionDenied,
    onSubscriptionError,
  ]);

  // Unsubscribe from push notifications
  const unsubscribeFromPush = useCallback(async (): Promise<boolean> => {
    if (!registration) {
      return false;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe();

        // Remove from Convex
        await unsubscribe({ endpoint: subscription.endpoint });
      }

      setState((prev) => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
      }));

      return true;
    } catch (error) {
      console.error('Push unsubscribe error:', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Failed to unsubscribe',
      }));
      return false;
    }
  }, [registration, unsubscribe]);

  // Sync subscription state with Convex
  useEffect(() => {
    if (hasActiveSubscription !== undefined) {
      setState((prev) => ({
        ...prev,
        isSubscribed: hasActiveSubscription,
      }));
    }
  }, [hasActiveSubscription]);

  return {
    ...state,
    requestPermission,
    unsubscribe: unsubscribeFromPush,
    canSubscribe: state.isSupported && state.permission !== 'denied' && !state.isSubscribed,
    canUnsubscribe: state.isSupported && state.isSubscribed,
  };
}
