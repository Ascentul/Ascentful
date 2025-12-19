'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Redirect to the unified Resume Studio page (Cover Letters tab)
 * This page is kept for backwards compatibility with existing links
 */
export default function CoverLettersRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/resume-studio?tab=cover-letters');
  }, [router]);

  return null;
}
