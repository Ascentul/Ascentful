/**
 * Push Notification Service Worker
 *
 * Handles incoming push notifications and user interactions.
 */

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

  const url = event.notification.data?.url || '/';
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
          clients.matchAll({ type: 'window' }).then((windowClients) => {
            for (const client of windowClients) {
              if ('focus' in client) {
                client.postMessage({
                  type: 'SNOOZE_NOTIFICATION',
                  data: event.notification.data,
                });
                return;
              }
            }
            // No client found to handle snooze - log for debugging
            console.warn('Snooze action: No window client available to receive message');
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
          if (client.url.includes(self.location.origin) && 'focus' in client) {
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

// Handle push subscription change (e.g., browser refreshes the subscription)
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('Push subscription changed');

  if (!self.VAPID_PUBLIC_KEY) {
    console.error('VAPID key not set, cannot resubscribe');
    return;
  }

  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: self.VAPID_PUBLIC_KEY,
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
