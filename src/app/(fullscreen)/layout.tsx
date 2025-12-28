import { ReactNode } from 'react';

/**
 * Fullscreen layout - no sidebar, no app shell
 * Used for immersive experiences like the Resume Builder
 */
export default function FullscreenLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
