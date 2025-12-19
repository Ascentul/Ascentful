'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Redirect to the Career Profile page (Projects section)
 * This page is kept for backwards compatibility with existing links
 */
export default function ProjectsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/profile');
  }, [router]);

  return null;
}
