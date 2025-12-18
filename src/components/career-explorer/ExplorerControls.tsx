'use client';

import { Filter, Search, X } from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

export type FilterMode = 'recommended' | 'all';

export interface RoleCategory {
  id: string;
  name: string;
  count: number;
}

interface ExplorerControlsProps {
  onSearch: (query: string) => void;
  searchQuery?: string;
  filterMode: FilterMode;
  onFilterModeChange: (mode: FilterMode) => void;
  categories?: RoleCategory[];
  selectedCategories?: string[];
  onCategoryToggle?: (categoryId: string) => void;
  onClearFilters?: () => void;
  totalRoles?: number;
  filteredRoles?: number;
}

export function ExplorerControls({
  onSearch,
  searchQuery = '',
  filterMode,
  onFilterModeChange,
  categories = [],
  selectedCategories = [],
  onCategoryToggle,
  onClearFilters,
  totalRoles = 0,
  filteredRoles,
}: ExplorerControlsProps) {
  // Use prop directly (controlled component) to stay in sync with parent state
  const currentQuery = searchQuery ?? '';

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearch(e.target.value);
  };

  const handleClearSearch = () => {
    onSearch('');
  };

  const hasActiveFilters = selectedCategories.length > 0 || currentQuery.length > 0;
  const displayCount = filteredRoles !== undefined ? filteredRoles : totalRoles;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white rounded-lg p-4 border border-neutral-200 shadow-sm">
      {/* Search input */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <Input
          type="text"
          placeholder="Search any role..."
          value={currentQuery}
          onChange={handleSearchChange}
          className="pl-9 pr-9"
        />
        {currentQuery && (
          <button
            onClick={handleClearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Category filter dropdown */}
        {categories.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="w-4 h-4" />
                Categories
                {selectedCategories.length > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                    {selectedCategories.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Filter by category</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {categories.map((category) => (
                <DropdownMenuCheckboxItem
                  key={category.id}
                  checked={selectedCategories.includes(category.id)}
                  onCheckedChange={() => onCategoryToggle?.(category.id)}
                >
                  <span className="flex-1">{category.name}</span>
                  <span className="text-xs text-neutral-400">{category.count}</span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Mode toggle */}
        <div className="flex items-center rounded-lg border border-neutral-200 p-0.5">
          <button
            onClick={() => onFilterModeChange('recommended')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filterMode === 'recommended'
                ? 'bg-primary-500 text-white'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
            }`}
          >
            Recommended
          </button>
          <button
            onClick={() => onFilterModeChange('all')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filterMode === 'all'
                ? 'bg-primary-500 text-white'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
            }`}
          >
            All Roles
          </button>
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-neutral-500">
            Clear
          </Button>
        )}
      </div>

      {/* Results count */}
      <div className="text-sm text-neutral-500 sm:ml-2">
        {displayCount} {displayCount === 1 ? 'role' : 'roles'}
      </div>
    </div>
  );
}
