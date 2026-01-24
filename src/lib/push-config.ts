/**
 * Web Push Configuration
 *
 * Shared VAPID configuration for push notification API routes.
 * Centralizes VAPID key setup to ensure consistent configuration.
 */

import webpush from 'web-push';

// VAPID (Voluntary Application Server Identification) configuration
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:support@ascentful.io';

/**
 * Whether push notifications are fully configured.
 * Both public and private VAPID keys are required.
 */
export const isPushConfigured = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

// Configure webpush with VAPID credentials if available
if (isPushConfigured) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else if (VAPID_PUBLIC_KEY || VAPID_PRIVATE_KEY) {
  console.warn('Push notifications partially configured - both VAPID keys required');
}

// Re-export configured webpush instance
export { webpush };

/**
 * Standard Web Push subscription format.
 * Used by both send and test routes.
 */
export interface PushSubscription {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}
