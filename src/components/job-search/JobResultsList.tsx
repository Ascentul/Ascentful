'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { JobResultCard } from './JobResultCard';
import { JobSearchEmptyState } from './JobSearchEmptyState';
import { JobSearchSkeleton } from './JobSearchSkeleton';
import { type JobResult, SORT_OPTIONS, type SortOption } from './types';

interface JobResultsListProps {
  results: JobResult[];
  total: number | null;
  loading: boolean;
  hasSearched: boolean;
  onQuickAdd: (job: JobResult) => Promise<void>;
  page: number;
  totalPages: number | null;
  onPageChange: (page: number) => void;
  onExampleSearch: (query: string, location?: string) => void;
  onResetFilters: () => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
}

export function JobResultsList({
  results,
  total,
  loading,
  hasSearched,
  onQuickAdd,
  page,
  totalPages,
  onPageChange,
  onExampleSearch,
  onResetFilters,
  sortBy,
  onSortChange,
}: JobResultsListProps) {
  const canPrev = page > 1;
  const canNext = totalPages ? page < totalPages : false;

  // Loading state
  if (loading) {
    return <JobSearchSkeleton count={4} />;
  }

  // Before first search
  if (!hasSearched) {
    return <JobSearchEmptyState variant="initial" onExampleSearch={onExampleSearch} />;
  }

  // No results after search
  if (results.length === 0) {
    return (
      <JobSearchEmptyState
        variant="no-results"
        onExampleSearch={onExampleSearch}
        onResetFilters={onResetFilters}
      />
    );
  }

  // Has results
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-900">
            {total?.toLocaleString() ?? results.length}
          </span>{' '}
          results
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="sort-select" className="text-sm text-slate-500">
            Sort by:
          </label>
          <Select value={sortBy} onValueChange={(v) => onSortChange(v as SortOption)}>
            <SelectTrigger id="sort-select" className="w-40 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results List */}
      <div className="space-y-3">
        {results.map((job) => (
          <JobResultCard key={job.id} job={job} onQuickAdd={onQuickAdd} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={!canPrev || loading}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <span className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!canNext || loading}
            onClick={() => onPageChange(page + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
