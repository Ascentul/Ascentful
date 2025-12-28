/**
 * PopupAuth Component
 *
 * Shown when user is not authenticated.
 * Initiates the OAuth flow to the Ascentul web app.
 */

import { useState } from 'react';
import { useAuthStore } from '~/store/authStore';

export function PopupAuth() {
  const { login } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await login();
      // After successful login, the popup will re-render with authenticated state
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-[360px] bg-white">
      {/* Header */}
      <div className="px-6 pt-8 pb-6 text-center">
        <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-neutral-900 mb-1">Ascentul Autofill</h1>
        <p className="text-sm text-neutral-500">
          Fill job applications with one click
        </p>
      </div>

      {/* Features */}
      <div className="px-6 pb-6">
        <div className="space-y-3">
          <Feature
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            }
            title="One-Click Autofill"
            description="Fill applications instantly on 8+ major job platforms"
          />
          <Feature
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            }
            title="Track Applications"
            description="Automatically log every application you submit"
          />
          <Feature
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            }
            title="Secure & Private"
            description="Your data stays in your Ascentul account"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-6 mb-4 p-3 bg-danger-500/10 border border-danger-500/20 rounded-lg">
          <p className="text-sm text-danger-500">{error}</p>
        </div>
      )}

      {/* Sign In Button */}
      <div className="px-6 pb-8">
        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full py-3 px-4 bg-primary-500 text-white font-medium rounded-control
                     hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <span>Sign in with Ascentul</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-8 h-8 bg-primary-50 text-primary-500 rounded-lg flex items-center justify-center">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-medium text-neutral-900">{title}</h3>
        <p className="text-xs text-neutral-500">{description}</p>
      </div>
    </div>
  );
}

export default PopupAuth;
