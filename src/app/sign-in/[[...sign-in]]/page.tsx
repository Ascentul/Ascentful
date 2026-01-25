'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { Check, KeyRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

import { AuthLayout } from '@/components/auth/AuthLayout';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { SignInForm } from '@/components/auth/SignInForm';

/**
 * Get the appropriate redirect path based on user role.
 * Eliminates redirect chains by sending users directly to their home.
 */
function getRedirectPath(role: string | undefined): string {
  switch (role) {
    case 'advisor':
    case 'university_admin':
      return '/u/home';
    case 'super_admin':
      return '/admin';
    default:
      return '/dashboard';
  }
}

export default function Page() {
  const router = useRouter();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();

  const [step, setStep] = useState<'signin' | 'forgot' | 'reset'>('signin');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Clear any cached authentication data on component mount
  useEffect(() => {
    // Clear localStorage and sessionStorage to prevent cached auth issues
    if (typeof window !== 'undefined') {
      localStorage.clear();
      sessionStorage.clear();
    }
  }, []);

  // If a session already exists, redirect based on role to avoid redirect chains
  useEffect(() => {
    if (authLoaded && userLoaded && isSignedIn && user) {
      const role = user.publicMetadata?.role as string | undefined;
      router.replace(getRedirectPath(role));
    }
  }, [authLoaded, userLoaded, isSignedIn, user, router]);

  // Show loading state while checking authentication
  if (!authLoaded || !userLoaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  // Show loading state during redirect after sign-in
  if (isSignedIn) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent mx-auto mb-4" />
          <p className="text-neutral-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  const handleForgotPassword = () => {
    setStep('forgot');
    setSuccessMessage(null);
  };

  const handleBackToSignIn = () => {
    setStep('signin');
    setSuccessMessage(null);
  };

  const handleForgotPasswordSuccess = (userEmail: string) => {
    setStep('reset');
    setSuccessMessage(`We've sent a password reset code to ${userEmail}`);
  };

  const handleBackToForgot = () => {
    setStep('forgot');
    setSuccessMessage(null);
  };

  // Render based on current step
  if (step === 'forgot') {
    return (
      <AuthLayout
        marketingTitle="Forgot your password?"
        marketingContent={
          <>
            <p className="text-white/95 mb-6">
              No worries! We'll help you reset it quickly and securely so you can get back to your
              career journey.
            </p>
            <div className="flex items-center gap-3">
              <KeyRound className="h-5 w-5" />
              <span className="text-white/95">Secure password reset process</span>
            </div>
          </>
        }
      >
        <ForgotPasswordForm onBack={handleBackToSignIn} onSuccess={handleForgotPasswordSuccess} />
      </AuthLayout>
    );
  }

  if (step === 'reset') {
    return (
      <AuthLayout
        marketingTitle="Almost there!"
        marketingContent={
          <>
            <p className="text-white/95 mb-6">
              Enter the code we sent to your email and create a new secure password.
            </p>
            <div className="flex items-center gap-3">
              <KeyRound className="h-5 w-5" />
              <span className="text-white/95">Your account security is our priority</span>
            </div>
          </>
        }
      >
        <ResetPasswordForm
          successMessage={successMessage ?? undefined}
          onBack={handleBackToForgot}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      marketingTitle={
        <>
          Take Control of
          <br />
          Your Career Growth
        </>
      }
      marketingContent={
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Check className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <span className="text-white/95">Get AI coaching that adapts to your goals</span>
          </div>
          <div className="flex items-start gap-3">
            <Check className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <span className="text-white/95">Build standout resumes and cover letters fast</span>
          </div>
          <div className="flex items-start gap-3">
            <Check className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <span className="text-white/95">Track goals and see your progress clearly</span>
          </div>
          <div className="flex items-start gap-3">
            <Check className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <span className="text-white/95">Discover opportunities that match your path</span>
          </div>
          <div className="flex items-start gap-3">
            <Check className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <span className="text-white/95">Keep all your career details in one place</span>
          </div>
        </div>
      }
    >
      <SignInForm onForgotPassword={handleForgotPassword} />
    </AuthLayout>
  );
}
