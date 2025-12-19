'use client';

import { Loader2, Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface JobSearchBarProps {
  query: string;
  location: string;
  onQueryChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onSearch: () => void;
  onReset: () => void;
  loading: boolean;
  hasSearched: boolean;
  disabled?: boolean;
}

export function JobSearchBar({
  query,
  location,
  onQueryChange,
  onLocationChange,
  onSearch,
  onReset,
  loading,
  hasSearched,
  disabled = false,
}: JobSearchBarProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim() && !loading && !disabled) {
      onSearch();
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="flex-1">
        <label htmlFor="search-query" className="sr-only">
          Job title or keywords
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            id="search-query"
            type="text"
            placeholder="Software Engineer, Product Manager..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || loading}
            className="pl-10"
          />
        </div>
      </div>

      <div className="w-full sm:w-48">
        <label htmlFor="search-location" className="sr-only">
          Location
        </label>
        <Input
          id="search-location"
          type="text"
          placeholder="City or Remote"
          value={location}
          onChange={(e) => onLocationChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || loading}
        />
      </div>

      <div className="flex gap-2">
        <Button
          onClick={onSearch}
          disabled={!query.trim() || loading || disabled}
          className="bg-primary-500 hover:bg-primary-700 whitespace-nowrap"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Search
            </>
          )}
        </Button>

        {hasSearched && (
          <Button
            variant="ghost"
            onClick={onReset}
            disabled={loading || disabled}
            className="text-slate-500 hover:text-slate-700"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
