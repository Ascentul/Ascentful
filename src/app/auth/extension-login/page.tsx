'use client';

import { SignIn, useAuth, useUser } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type AuthStatus =
  | 'loading'
  | 'authenticating'
  | 'generating-token'
  | 'redirecting'
  | 'success'
  | 'error';

/**
 * Extension Login Page
 *
 * This page handles the OAuth-style authentication flow for the Chrome extension.
 * Flow:
 * 1. Extension redirects user here with state and redirect_uri params
 * 2. User signs in via Clerk (if not already signed in)
 * 3. Page verifies state, generates session token
 * 4. Redirects back to extension with token
 */
export default function ExtensionLoginPage() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user } = useUser();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const state = searchParams.get('state');
  const redirectUri = searchParams.get('redirect_uri');

  useEffect(() => {
    async function handleExtensionAuth() {
      // Wait for Clerk to load
      if (!isLoaded) {
        setStatus('loading');
        return;
      }

      // If not signed in, show sign-in form
      if (!isSignedIn || !user) {
        setStatus('authenticating');
        return;
      }

      // Validate required params
      if (!state || !redirectUri) {
        setStatus('error');
        setErrorMessage(
          'Missing required parameters. Please try signing in from the extension again.',
        );
        return;
      }

      // Validate redirect URI (must be a Chrome extension URL)
      if (!redirectUri.includes('.chromiumapp.org')) {
        setStatus('error');
        setErrorMessage('Invalid redirect URI. Please try signing in from the extension again.');
        return;
      }

      setStatus('generating-token');

      try {
        // Call API to verify state and generate session token
        const response = await fetch('/api/extension/auth/create-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ state }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create session');
        }

        const { token, expiresAt } = await response.json();

        setStatus('redirecting');

        // Build callback URL for extension
        const callbackUrl = new URL(redirectUri);
        callbackUrl.searchParams.set('token', token);
        callbackUrl.searchParams.set('expires_at', String(expiresAt));
        callbackUrl.searchParams.set('state', state);

        // Small delay to show success message
        setTimeout(() => {
          window.location.href = callbackUrl.toString();
        }, 500);

        setStatus('success');
      } catch (error) {
        setStatus('error');
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred. Please try again.',
        );
      }
    }

    handleExtensionAuth();
  }, [isLoaded, isSignedIn, user, state, redirectUri, getToken]);

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show Clerk sign-in if not authenticated
  if (status === 'authenticating') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-100 p-4">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Sign in to Ascentul</h1>
          <p className="text-neutral-600">Connect your Ascentul account to the extension</p>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'shadow-card rounded-card',
            },
          }}
          redirectUrl={`/auth/extension-login?state=${state}&redirect_uri=${encodeURIComponent(redirectUri || '')}`}
        />
      </div>
    );
  }

  // Generating token
  if (status === 'generating-token') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100">
        <div className="bg-white rounded-card shadow-card p-8 text-center max-w-md">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-neutral-900 mb-2">Setting up your session</h2>
          <p className="text-neutral-600">Please wait while we connect your account...</p>
        </div>
      </div>
    );
  }

  // Redirecting back to extension
  if (status === 'redirecting' || status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100">
        <div className="bg-white rounded-card shadow-card p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-success-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-success-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-2">Connected!</h2>
          <p className="text-neutral-600">Redirecting you back to the extension...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100">
        <div className="bg-white rounded-card shadow-card p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-danger-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-danger-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-2">Connection Failed</h2>
          <p className="text-neutral-600 mb-4">{errorMessage}</p>
          <button
            onClick={() => window.close()}
            className="px-6 py-2 bg-primary-500 text-white rounded-control hover:bg-primary-700 transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  return null;
}
