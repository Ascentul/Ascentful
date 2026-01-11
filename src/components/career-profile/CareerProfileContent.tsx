'use client';

import { useUser } from '@clerk/nextjs';

import { SharedProfileLayout } from '@/components/profile/SharedProfileLayout';
import { useAuth } from '@/contexts/ClerkAuthProvider';

export function CareerProfileContent() {
  const { user: clerkUser } = useUser();
  const { user: userProfile } = useAuth();

  const isLoading = !clerkUser || !userProfile;

  return (
    <SharedProfileLayout
      pageDescription="Manage your career profile information"
      showLoadingState={isLoading}
    />
  );
}
