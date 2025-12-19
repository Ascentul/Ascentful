'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface SidebarContextValue {
  isExpanded: boolean;
  setExpanded: (expanded: boolean) => void;
  collapse: () => void;
  expand: () => void;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // Initialize to true to match server render and avoid hydration mismatch
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [isHydrated, setIsHydrated] = useState(false);

  // Read from localStorage after hydration to avoid mismatch
  useEffect(() => {
    const stored = localStorage.getItem('sidebarExpanded');
    if (stored === 'false') {
      setIsExpanded(false);
    }
    setIsHydrated(true);
  }, []);

  // Sync to localStorage when state changes (only after hydration)
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem('sidebarExpanded', isExpanded.toString());
    }
  }, [isExpanded, isHydrated]);

  const setExpanded = useCallback((expanded: boolean) => {
    setIsExpanded(expanded);
  }, []);

  const collapse = useCallback(() => {
    setIsExpanded(false);
  }, []);

  const expand = useCallback(() => {
    setIsExpanded(true);
  }, []);

  const toggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        isExpanded,
        setExpanded,
        collapse,
        expand,
        toggle,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}

// Optional hook that doesn't throw if used outside provider
export function useSidebarOptional() {
  return useContext(SidebarContext);
}
