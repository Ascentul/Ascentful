'use client';

import { X } from 'lucide-react';
import { useCallback } from 'react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface OutcomesFilters {
  cohortIds?: string[];
  degreeLevels?: string[];
  programs?: string[];
  graduationYear?: number;
}

interface CohortOption {
  id: string;
  label: string;
}

interface ProgramOption {
  id: string;
  name: string;
}

interface OutcomesFilterBarProps {
  filters: OutcomesFilters;
  onFiltersChange: (filters: OutcomesFilters) => void;
  cohortOptions: CohortOption[];
  programOptions: ProgramOption[];
  yearOptions: number[];
  className?: string;
}

const DEGREE_LEVELS = [
  { value: 'certificate', label: 'Certificate' },
  { value: 'associate', label: 'Associate' },
  { value: 'bachelor', label: 'Bachelor' },
  { value: 'master', label: 'Master' },
  { value: 'doctoral', label: 'Doctoral' },
  { value: 'professional', label: 'Professional' },
];

export function OutcomesFilterBar({
  filters,
  onFiltersChange,
  cohortOptions,
  programOptions,
  yearOptions,
  className,
}: OutcomesFilterBarProps) {
  const handleCohortChange = useCallback(
    (value: string) => {
      if (value === 'all') {
        onFiltersChange({ ...filters, cohortIds: undefined });
      } else {
        onFiltersChange({ ...filters, cohortIds: [value] });
      }
    },
    [filters, onFiltersChange],
  );

  const handleProgramChange = useCallback(
    (value: string) => {
      if (value === 'all') {
        onFiltersChange({ ...filters, programs: undefined });
      } else {
        onFiltersChange({ ...filters, programs: [value] });
      }
    },
    [filters, onFiltersChange],
  );

  const handleDegreeLevelChange = useCallback(
    (value: string) => {
      if (value === 'all') {
        onFiltersChange({ ...filters, degreeLevels: undefined });
      } else {
        onFiltersChange({ ...filters, degreeLevels: [value] });
      }
    },
    [filters, onFiltersChange],
  );

  const handleYearChange = useCallback(
    (value: string) => {
      if (value === 'all') {
        onFiltersChange({ ...filters, graduationYear: undefined });
      } else {
        onFiltersChange({ ...filters, graduationYear: parseInt(value, 10) });
      }
    },
    [filters, onFiltersChange],
  );

  const handleClearFilters = useCallback(() => {
    onFiltersChange({});
  }, [onFiltersChange]);

  const hasActiveFilters =
    filters.cohortIds?.length ||
    filters.degreeLevels?.length ||
    filters.programs?.length ||
    filters.graduationYear;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-card bg-white p-4 shadow-card',
        className,
      )}
    >
      <span className="text-sm font-medium text-neutral-600">Filters:</span>

      {/* Cohort Filter */}
      <Select value={filters.cohortIds?.[0] || 'all'} onValueChange={handleCohortChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Cohorts" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Cohorts</SelectItem>
          {cohortOptions.map((cohort) => (
            <SelectItem key={cohort.id} value={cohort.id}>
              {cohort.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Program Filter */}
      <Select value={filters.programs?.[0] || 'all'} onValueChange={handleProgramChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Programs" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Programs</SelectItem>
          {programOptions.map((program) => (
            <SelectItem key={program.id} value={program.id}>
              {program.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Degree Level Filter */}
      <Select value={filters.degreeLevels?.[0] || 'all'} onValueChange={handleDegreeLevelChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All Degrees" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Degrees</SelectItem>
          {DEGREE_LEVELS.map((level) => (
            <SelectItem key={level.value} value={level.value}>
              {level.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Year Filter */}
      <Select value={filters.graduationYear?.toString() || 'all'} onValueChange={handleYearChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="All Years" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Years</SelectItem>
          {yearOptions.map((year) => (
            <SelectItem key={year} value={year.toString()}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearFilters}
          className="text-neutral-500 hover:text-neutral-700"
        >
          <X className="mr-1 h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
