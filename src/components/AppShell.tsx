'use client';

import { ChevronRight } from 'lucide-react';
import { ReactNode } from 'react';

import { NotificationButtons } from '@/components/layout/NotificationButtons';
import { useSidebarOptional } from '@/contexts/SidebarContext';
import { SIDEBAR_EXPAND_BUTTON_LEFT } from '@/lib/constants/sidebar';

interface AppShellProps {
  sidebar: ReactNode;
  children: ReactNode;
}

/**
 * AppShell - Modern rounded dashboard shell component
 *
 * Creates a floating card design with:
 * - Full-width layout with sidebar as part of background card
 * - Main content area floats on top of the sidebar area
 * - Light neutral background for the entire viewport
 *
 * This component wraps all authenticated pages to provide consistent
 * modern SaaS styling inspired by Finovia design patterns.
 */
export function AppShell({ sidebar, children }: AppShellProps) {
  const sidebarContext = useSidebarOptional();
  const isExpanded = sidebarContext?.isExpanded ?? true;

  return (
    <div className="flex min-h-screen gap-3 bg-[#F1F3F9]">
      {/* Sidebar - lives on grey background, sticky position */}
      <aside className="sticky top-0 hidden h-screen md:block overflow-visible">{sidebar}</aside>

      {/* Main Content Area - white card floating on top of grey background, scrollable */}
      <main className="min-h-screen flex-1 pl-0 pr-6 pt-[20px] pb-6 transition-all duration-300 ease-in-out">
        {/* Notification buttons - fixed position in top right of main content area */}
        <div className="fixed top-6 right-12 z-10">
          <NotificationButtons />
        </div>

        <div className="mx-auto rounded-3xl bg-white p-6 shadow-sm">{children}</div>
      </main>

      {/* Expand button - rendered LAST and outside flex flow to ensure visibility */}
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
    </div>
  );
}
