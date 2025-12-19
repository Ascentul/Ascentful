'use client';

import { SlidersHorizontal, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { JobSearchFilters } from './JobSearchFilters';
import type { JobSearchFiltersState } from './types';

interface MobileFiltersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: JobSearchFiltersState;
  onFiltersChange: (filters: JobSearchFiltersState) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
}

export function MobileFiltersSheet({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  onReset,
  hasActiveFilters,
  activeFilterCount,
}: MobileFiltersSheetProps) {
  const handleApply = () => {
    onOpenChange(false);
  };

  return (
    <>
      {/* Trigger Button */}
      <Button variant="outline" onClick={() => onOpenChange(true)} className="gap-2">
        <SlidersHorizontal className="h-4 w-4" />
        Filters
        {activeFilterCount > 0 && (
          <Badge className="ml-1 bg-primary-500 text-white border-transparent h-5 min-w-5 px-1.5">
            {activeFilterCount}
          </Badge>
        )}
      </Button>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[400px] p-0">
          <DialogHeader className="p-4 pb-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold">Filters</DialogTitle>
              <DialogClose asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </DialogClose>
            </div>
          </DialogHeader>

          <div className="p-4 pt-2">
            {/* Reuse the same filters component but without the outer card styling */}
            <div className="space-y-5">
              <JobSearchFilters
                filters={filters}
                onFiltersChange={onFiltersChange}
                onReset={onReset}
                hasActiveFilters={hasActiveFilters}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-4 pt-2 border-t">
            {hasActiveFilters && (
              <Button variant="outline" onClick={onReset} className="flex-1">
                Reset All
              </Button>
            )}
            <Button onClick={handleApply} className="flex-1 bg-primary-500 hover:bg-primary-700">
              Apply Filters
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
