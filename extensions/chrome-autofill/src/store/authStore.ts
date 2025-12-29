/**
 * Auth Store
 *
 * Manages authentication state for the extension using Zustand.
 * Handles the OAuth-style flow with the Ascentul web app.
 */

import { create } from 'zustand';
import type { AuthState, User } from '~/types';
import { storage } from '~/lib/storage';

const APP_URL = process.env.PLASMO_PUBLIC_APP_URL || 'https://app.ascentful.io';

interface AuthStore extends AuthState {
  // Actions
  initialize: () => Promise<void>;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  setAuth: (auth: Partial<AuthState>) => void;
}

/**
 * Generate a signed state token for OAuth flow
 * Note: In production, this should be signed by the server
 */
function generateState(): string {
  const payload = {
    extensionId: chrome.runtime.id,
    timestamp: Date.now(),
    nonce: crypto.randomUUID(),
  };
  return btoa(JSON.stringify(payload));
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  // Initial state
  isAuthenticated: false,
  user: null,
  token: null,
  expiresAt: null,

  /**
   * Initialize auth state from storage
   */
  initialize: async () => {
    const auth = await storage.getAuth();

    if (auth?.token && auth.expiresAt) {
      // Check if token is expired
      if (Date.now() < auth.expiresAt) {
        set({
          isAuthenticated: true,
          user: auth.user,
          token: auth.token,
          expiresAt: auth.expiresAt,
        });

        // Schedule token refresh if needed
        const timeUntilExpiry = auth.expiresAt - Date.now();
        if (timeUntilExpiry < 10 * 60 * 1000) {
          // Less than 10 minutes
          get().refreshToken();
        }
      } else {
        // Token expired, try to refresh
        const refreshed = await get().refreshToken();
        if (!refreshed) {
          await storage.clearAuth();
          set({ isAuthenticated: false, user: null, token: null, expiresAt: null });
        }
      }
    }
  },

  /**
   * Initiate OAuth login flow
   */
  login: async () => {
    const state = generateState();
    const extensionId = chrome.runtime.id;
    const redirectUri = `https://${extensionId}.chromiumapp.org/callback`;

    const authUrl = new URL(`${APP_URL}/auth/extension-login`);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('redirect_uri', redirectUri);

    return new Promise<void>((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: authUrl.toString(),
          interactive: true,
        },
        async (callbackUrl) => {
          if (chrome.runtime.lastError) {
            console.error('[Ascentul] Auth error:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!callbackUrl) {
            reject(new Error('No callback URL received'));
            return;
          }

          try {
            const url = new URL(callbackUrl);
            const token = url.searchParams.get('token');
            const expiresAt = parseInt(url.searchParams.get('expires_at') || '0', 10);
            const returnedState = url.searchParams.get('state');

            // Verify state matches
            if (returnedState !== state) {
              reject(new Error('State mismatch - possible CSRF attack'));
              return;
            }

            if (!token || !expiresAt) {
              reject(new Error('Missing token in callback'));
              return;
            }

            // Update state
            const authState: AuthState = {
              isAuthenticated: true,
              user: null, // Will be fetched with profile
              token,
              expiresAt,
            };

            await storage.setAuth(authState);
            set(authState);

            resolve();
          } catch (error) {
            console.error('[Ascentul] Error parsing callback:', error);
            reject(error);
          }
        },
      );
    });
  },

  /**
   * Logout and clear all auth state
   */
  logout: async () => {
    await storage.clearAuth();
    await storage.clearProfile();
    set({
      isAuthenticated: false,
      user: null,
      token: null,
      expiresAt: null,
    });
  },

  /**
   * Refresh the auth token
   */
  refreshToken: async () => {
    const { token } = get();
    if (!token) return false;

    try {
      const response = await fetch(`${APP_URL}/api/extension/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return false;
      }

      const { token: newToken, expiresAt } = await response.json();

      const auth = await storage.getAuth();
      if (!auth) {
        // Auth was cleared during refresh (e.g., concurrent logout)
        return false;
      }
      const updatedAuth: AuthState = {
        ...auth,
        token: newToken,
        expiresAt,
      };

      await storage.setAuth(updatedAuth);
      set({ token: newToken, expiresAt });

      return true;
    } catch (error) {
      console.error('[Ascentul] Token refresh failed:', error);
      return false;
    }
  },

  /**
   * Update auth state
   */
  setAuth: (auth: Partial<AuthState>) => {
    set(auth);
  },
}));

export default useAuthStore;
