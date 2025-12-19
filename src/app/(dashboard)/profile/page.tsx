'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Redirect to the unified Account page (Career Profile tab)
 * This page is kept for backwards compatibility with existing links
 */
export default function ProfileRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/account?tab=profile');
  }, [router]);

  return null;
}
