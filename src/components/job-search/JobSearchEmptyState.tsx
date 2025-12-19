'use client';

import { Frown, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { type EmptyStateVariant, EXAMPLE_SEARCHES } from './types';

interface JobSearchEmptyStateProps {
  variant: EmptyStateVariant;
  onExampleSearch?: (query: string, location?: string) => void;
  onResetFilters?: () => void;
}

export function JobSearchEmptyState({
  variant,
  onExampleSearch,
  onResetFilters,
}: JobSearchEmptyStateProps) {
  if (variant === 'initial') {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-primary-100 p-4 mb-4">
          <Search className="h-8 w-8 text-primary-500" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">
          Search for roles to add to your tracker
        </h3>
        <p className="text-sm text-slate-500 mt-2 max-w-md">
          Enter keywords above or try one of these popular searches
        </p>

        {onExampleSearch && (
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {EXAMPLE_SEARCHES.map((example) => (
              <Button
                key={example.query}
                variant="outline"
                size="sm"
                onClick={() => onExampleSearch(example.query, example.location)}
                className="text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              >
                {example.query}
              </Button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // variant === 'no-results'
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-amber-100 p-4 mb-4">
        <Frown className="h-8 w-8 text-amber-600" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900">No jobs found</h3>
      <p className="text-sm text-slate-500 mt-2 max-w-md">
        Try adjusting your search terms or filters to find more results
      </p>

      {onResetFilters && (
        <Button
          variant="outline"
          onClick={onResetFilters}
          className="mt-6 text-slate-600 hover:text-slate-900"
        >
          Reset Filters
        </Button>
      )}

      {onExampleSearch && (
        <div className="mt-6">
          <p className="text-xs text-slate-400 mb-3">Or try a popular search:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {EXAMPLE_SEARCHES.slice(0, 3).map((example) => (
              <Button
                key={example.query}
                variant="ghost"
                size="sm"
                onClick={() => onExampleSearch(example.query, example.location)}
                className="text-primary-500 hover:text-primary-700"
              >
                {example.query}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
