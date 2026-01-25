'use client';

import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { useCallback, useEffect, useRef, useState } from 'react';

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

  // Track when local mutation just happened to prevent server sync from overwriting optimistic state
  const skipServerSyncRef = useRef(false);

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

        // Wait for service worker to be ready before sending message
        // Send base64 string (not ArrayBuffer) so SW can use it for pushsubscriptionchange
        await navigator.serviceWorker.ready;
        if (reg.active) {
          reg.active.postMessage({
            type: 'SET_VAPID_KEY',
            key: vapidPublicKey,
          });
        } else {
          // Wait for the worker to activate before posting
          navigator.serviceWorker.addEventListener(
            'controllerchange',
            () => {
              navigator.serviceWorker.controller?.postMessage({
                type: 'SET_VAPID_KEY',
                key: vapidPublicKey,
              });
            },
            { once: true },
          );
        }

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
  }, [vapidPublicKey]);

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

      // Validate subscription data (toJSON() may return incomplete data on some browsers)
      if (
        !subscriptionJson.endpoint ||
        !subscriptionJson.keys?.p256dh ||
        !subscriptionJson.keys?.auth
      ) {
        throw new Error('Invalid push subscription data received from browser');
      }

      await subscribe({
        userId,
        subscription: {
          endpoint: subscriptionJson.endpoint,
          expirationTime: subscriptionJson.expirationTime ?? null,
          keys: {
            p256dh: subscriptionJson.keys.p256dh,
            auth: subscriptionJson.keys.auth,
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

      // Skip server sync briefly to prevent overwriting optimistic state
      skipServerSyncRef.current = true;
      setTimeout(() => {
        skipServerSyncRef.current = false;
      }, 2000);

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
        // Unsubscribe from browser first - this is the source of truth for notifications
        await subscription.unsubscribe();

        // Then remove from Convex - if this fails, scheduled cleanup will handle stale records
        try {
          await unsubscribe({ endpoint: subscription.endpoint });
        } catch (convexError) {
          console.warn(
            'Failed to remove subscription from server, will be cleaned up by scheduled job:',
            convexError,
          );
        }
      }

      setState((prev) => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
      }));

      // Skip server sync briefly to prevent overwriting optimistic state
      skipServerSyncRef.current = true;
      setTimeout(() => {
        skipServerSyncRef.current = false;
      }, 2000);

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

  // Sync subscription state with Convex (skip briefly after local mutations to prevent flicker)
  useEffect(() => {
    if (hasActiveSubscription !== undefined && !skipServerSyncRef.current && !state.isLoading) {
      setState((prev) => ({
        ...prev,
        isSubscribed: hasActiveSubscription,
      }));
    }
  }, [hasActiveSubscription, state.isLoading]);

  return {
    ...state,
    requestPermission,
    unsubscribe: unsubscribeFromPush,
    canSubscribe:
      state.isSupported &&
      state.permission !== 'denied' &&
      !state.isSubscribed &&
      !!userId &&
      !!registration &&
      !!vapidPublicKey,
    canUnsubscribe: state.isSupported && state.isSubscribed,
  };
}
