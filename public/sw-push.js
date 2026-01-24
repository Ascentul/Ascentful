/**
 * Push Notification Service Worker
 *
 * Handles incoming push notifications and user interactions.
 */

/**
 * Convert a base64 URL-safe string to a Uint8Array.
 * Required for pushManager.subscribe applicationServerKey.
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

// Listen for push events
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('Push event but no data');
    return;
  }

  try {
    const payload = event.data.json();

    const options = {
      body: payload.body,
      icon: payload.icon || '/logo.png',
      badge: payload.badge || '/logo.png',
      tag: payload.tag || 'default',
      data: {
        url: payload.url || '/',
        ...payload.data,
      },
      vibrate: [100, 50, 100],
      requireInteraction: payload.requireInteraction || false,
      actions: payload.actions || [],
    };

    event.waitUntil(
      self.registration.showNotification(payload.title, options)
    );
  } catch (error) {
    console.error('Error parsing push payload:', error);
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Validate URL is same-origin to prevent navigation to malicious external sites
  let url = '/';
  try {
    const parsed = new URL(event.notification.data?.url || '/', self.location.origin);
    url = parsed.origin === self.location.origin ? parsed.href : '/';
  } catch {
    url = '/';
  }
  const action = event.action;

  // Handle action buttons
  if (action) {
    // Custom action handling
    switch (action) {
      case 'view':
        // Open the specified URL
        event.waitUntil(
          clients.openWindow(url)
        );
        break;
      case 'dismiss':
        // Just close the notification (already done above)
        break;
      case 'snooze':
        // Send a message to the main app to snooze
        event.waitUntil(
          clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Try to find an existing window to handle the snooze
            for (const client of windowClients) {
              if (client.url.startsWith(self.location.origin) && 'focus' in client) {
                client.postMessage({
                  type: 'SNOOZE_NOTIFICATION',
                  data: event.notification.data,
                });
                client.focus();
                return;
              }
            }
            // No client found - open a new window with snooze params so the app can handle it
            const snoozeUrl = new URL(url, self.location.origin);
            snoozeUrl.searchParams.set('snooze', 'true');
            if (event.notification.data?.signalId) {
              snoozeUrl.searchParams.set('signalId', event.notification.data.signalId);
            }
            return clients.openWindow(snoozeUrl.href);
          })
        );
        break;
      default:
        event.waitUntil(
          clients.openWindow(url)
        );
    }
  } else {
    // Default click behavior - open the URL
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        // Check if there's already a window open
        for (const client of windowClients) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            client.focus();
            client.postMessage({
              type: 'NOTIFICATION_CLICKED',
              url: url,
              data: event.notification.data,
            });
            return;
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
    );
  }
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  // Could track dismissals for analytics
  console.log('Notification closed:', event.notification.tag);
});

/**
 * Fetch VAPID public key from server.
 * Falls back to in-memory value if fetch fails.
 * This ensures the key is available even after SW restart.
 */
async function getVapidPublicKey() {
  // Try in-memory first (set via postMessage)
  if (self.VAPID_PUBLIC_KEY) {
    return self.VAPID_PUBLIC_KEY;
  }

  // Fetch from server endpoint
  try {
    const response = await fetch('/api/push/vapid-key');
    if (response.ok) {
      const data = await response.json();
      if (data.publicKey) {
        self.VAPID_PUBLIC_KEY = data.publicKey; // Cache in memory
        return data.publicKey;
      }
    }
  } catch (error) {
    console.error('Failed to fetch VAPID key:', error);
  }

  return null;
}

// Handle push subscription change (e.g., browser refreshes the subscription)
// Note: pushsubscriptionchange is best-effort and browser support is inconsistent.
// The main app should also check subscription status on startup via getSubscription().
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('Push subscription changed');

  event.waitUntil(
    getVapidPublicKey()
      .then((vapidKey) => {
        if (!vapidKey) {
          throw new Error('VAPID key not available');
        }

        return self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      })
      .then((subscription) => {
        // Send new subscription to server
        return fetch('/api/push/resubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldEndpoint: event.oldSubscription?.endpoint,
            newSubscription: subscription.toJSON(),
          }),
        }).then((response) => {
          if (!response.ok) {
            throw new Error(`Resubscribe failed: ${response.status}`);
          }
          return response;
        });
      })
      .catch((error) => {
        console.error('Failed to resubscribe:', error);
      })
  );
});

// Listen for messages from the main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_VAPID_KEY') {
    self.VAPID_PUBLIC_KEY = event.data.key;
  }
});
