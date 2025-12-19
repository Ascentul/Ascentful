'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Redirect to the unified Resume Studio page
 * This page is kept for backwards compatibility with existing links
 */
export default function ResumesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/resume-studio?tab=resumes');
  }, [router]);

  return null;
}
