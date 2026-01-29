'use client';

import { useUser } from '@clerk/nextjs';
import { ChevronRight, Loader2, Menu } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';

import AppTopBar from '@/components/layout/AppTopBar';
import Sidebar from '@/components/Sidebar';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { Button } from '@/components/ui/button';
import { SidebarProvider, useSidebarOptional } from '@/contexts/SidebarContext';
import { SIDEBAR_EXPAND_BUTTON_LEFT } from '@/lib/constants/sidebar';

interface LayoutProps {
  children: ReactNode;
}

// Inner component that can access the SidebarContext
function LayoutContent({ children }: { children: ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const sidebarContext = useSidebarOptional();
  const isExpanded = sidebarContext?.isExpanded ?? true;

  const toggleMobileSidebar = () => {
    setMobileSidebarOpen(!mobileSidebarOpen);
  };

  return (
    <>
      {/* Mobile menu toggle (floating) - only visible on mobile */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Button
          variant="ghost"
          className="shadow-lg bg-white"
          aria-label="Open sidebar menu"
          onClick={toggleMobileSidebar}
        >
          <Menu className="h-6 w-6" />
        </Button>
      </div>

      {/* Mobile overlay backdrop - only visible when mobile sidebar is open */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 md:hidden"
          onClick={toggleMobileSidebar}
          aria-hidden="true"
        />
      )}

      {/* Mobile Sidebar (drawer) - only on mobile */}
      <div className="md:hidden">
        <Sidebar isOpen={mobileSidebarOpen} onToggle={toggleMobileSidebar} />
      </div>

      {/* Aurora background - fixed behind everything */}
      <AuroraBackground />

      {/* Desktop & main layout */}
      <div className="relative flex min-h-screen">
        {/* Sidebar - desktop */}
        <aside className="hidden md:sticky md:top-0 md:h-screen md:block">
          <Sidebar />
        </aside>

        {/* Main column with top bar and content */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden bg-[#f0f2f5]">
          <AppTopBar />
          <main className="flex-1 overflow-y-auto min-w-0">
            <div className="px-4 pt-2 pb-4 md:px-6">
              {/* Content card */}
              <div className="w-full rounded-[32px] bg-white p-5 overflow-hidden shadow-sm">
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Expand sidebar button - only visible when sidebar is collapsed on desktop */}
      {/* Positioned to align with logo center: top-[22px] centers a 24px button on the 28px logo (py-5 + half logo) */}
      {!isExpanded && (
        <button
          type="button"
          onClick={() => sidebarContext?.expand()}
          className="hidden md:flex items-center justify-center fixed top-5 z-40 h-8 w-8 bg-white hover:bg-slate-100 shadow-md border border-slate-200 rounded-full cursor-pointer"
          style={{ left: SIDEBAR_EXPAND_BUTTON_LEFT }}
          aria-label="Expand sidebar"
        >
          <ChevronRight className="h-4 w-4 text-slate-600" />
        </button>
      )}
    </>
  );
}

export function Layout({ children }: LayoutProps) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [shouldRedirect, setShouldRedirect] = useState<boolean | null>(null);

  // Redirect university users (advisor, university_admin) to unified workspace
  // Note: Shared pages like /account and /profile are in the (shared) route group
  useEffect(() => {
    if (!isLoaded) return;

    const role = user?.publicMetadata?.role as string | undefined;
    if (role === 'advisor' || role === 'university_admin') {
      router.replace('/u/home');
      setShouldRedirect(true);
    } else {
      setShouldRedirect(false);
    }
  }, [isLoaded, user, router]);

  // Show loading spinner during initial load, redirect determination, or active redirect
  if (!isLoaded || shouldRedirect === null || shouldRedirect) {
    return (
      <>
        <AuroraBackground />
        <div className="relative flex h-screen items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary-500" />
        </div>
      </>
    );
  }

  return (
    <SidebarProvider>
      <LayoutContent>{children}</LayoutContent>
    </SidebarProvider>
  );
}
