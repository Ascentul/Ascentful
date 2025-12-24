'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import React from 'react';

interface PageCounterProps {
  currentPage: number;
  totalPages: number;
  onPageChange?: (page: number) => void;
  className?: string;
}

export function PageCounter({
  currentPage,
  totalPages,
  onPageChange,
  className = '',
}: PageCounterProps) {
  if (totalPages <= 0) {
    return null;
  }
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <div
      className={`inline-flex items-center gap-1 bg-slate-900 text-white rounded-full px-3 py-1.5 ${className}`}
    >
      <button
        type="button"
        onClick={() => canGoPrev && onPageChange?.(currentPage - 1)}
        disabled={!canGoPrev}
        className={`p-0.5 rounded-full ${canGoPrev ? 'hover:bg-white/20' : 'opacity-30'}`}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-sm font-medium min-w-[40px] text-center">
        {currentPage} / {totalPages}
      </span>
      <button
        type="button"
        onClick={() => canGoNext && onPageChange?.(currentPage + 1)}
        disabled={!canGoNext}
        className={`p-0.5 rounded-full ${canGoNext ? 'hover:bg-white/20' : 'opacity-30'}`}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
