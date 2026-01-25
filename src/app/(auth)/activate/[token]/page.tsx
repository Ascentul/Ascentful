'use client';

import { useSignIn } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { api } from '../../../../../convex/_generated/api';

interface PageProps {
  params: { token: string };
}

export default function ActivateAccountPage({ params }: PageProps) {
  const router = useRouter();
  const { signIn, setActive } = useSignIn();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  // Check if the token is valid
  const userWithToken = useQuery(api.admin_users.getUserByActivationToken, {
    token: params.token,
  });

  useEffect(() => {
    if (userWithToken !== undefined) {
      if (userWithToken) {
        setTokenValid(true);
        setEmail(userWithToken.email);
      } else {
        setTokenValid(false);
      }
    }
  }, [userWithToken]);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate passwords
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Call the backend API to create the Clerk user and activate the account
      const response = await fetch('/api/auth/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: params.token,
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to activate account. Please try again.');
        setIsLoading(false);
        return;
      }

      // If we got a sign-in token, use it to sign in immediately
      if (data.signInToken && signIn) {
        try {
          const signInResult = await signIn.create({
            strategy: 'ticket',
            ticket: data.signInToken,
          });

          if (signInResult.status === 'complete' && signInResult.createdSessionId) {
            await setActive({ session: signInResult.createdSessionId });

            // Show success message
            setSuccessMessage('Account activated successfully! Redirecting...');

            // Redirect based on user role
            const userRole = userWithToken?.role || data.role || 'individual';
            setTimeout(() => {
              switch (userRole) {
                case 'super_admin':
                  router.push('/admin');
                  break;
                case 'university_admin':
                  router.push('/university');
                  break;
                case 'advisor':
                  router.push('/advisor');
                  break;
                default:
                  router.push('/dashboard');
              }
            }, 1000);
            return;
          }
        } catch (signInError) {
          console.error('Sign-in error:', signInError);
          // Sign-in failed, but account is activated - redirect to sign-in
          setSuccessMessage('Account activated! Redirecting to sign in...');
          setTimeout(() => {
            router.push('/sign-in');
          }, 1500);
          return;
        }
      }

      // If requiresManualSignIn is true or no signInToken, redirect to sign-in
      if (data.requiresManualSignIn || !data.signInToken) {
        setSuccessMessage('Account activated! Redirecting to sign in...');
        setTimeout(() => {
          router.push('/sign-in');
        }, 1500);
        return;
      }
    } catch (err: any) {
      console.error('Activation error:', err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while checking token
  if (tokenValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-gray-600">Verifying activation link...</p>
        </div>
      </div>
    );
  }

  // Show error if token is invalid or expired
  if (tokenValid === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Invalid or Expired Link</CardTitle>
            <CardDescription>This activation link is invalid or has expired.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                Activation links expire after 24 hours. Please contact your administrator to receive
                a new activation email.
              </AlertDescription>
            </Alert>
            <div className="flex flex-col gap-2">
              <Button onClick={() => router.push('/sign-in')} variant="default" className="w-full">
                Go to Sign In
              </Button>
              <Button onClick={() => router.push('/contact')} variant="outline" className="w-full">
                Contact Support
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set Your Password</CardTitle>
          <CardDescription>Create a password to activate your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleActivate} className="space-y-4">
            {/* Email (readonly) */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} disabled className="bg-gray-50" />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Choose a strong password"
                  required
                  disabled={isLoading}
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500">Must be at least 8 characters long</p>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  required
                  disabled={isLoading}
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Success Alert */}
            {successMessage && (
              <Alert>
                <AlertDescription>{successMessage}</AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting Up Your Account...
                </>
              ) : (
                'Set Password & Activate'
              )}
            </Button>

            {/* Help Text */}
            <div className="text-center text-sm text-gray-500">
              <p>
                Having trouble?{' '}
                <a href="/contact" className="text-primary hover:underline">
                  Contact support
                </a>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
