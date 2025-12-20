'use client';

import { BarChart3, Briefcase, Globe } from 'lucide-react';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';

import {
  EXPERIENCE_OPTIONS,
  type ExperienceLevel,
  JOB_TYPE_OPTIONS,
  type JobSearchFiltersState,
  type JobType,
} from './types';

interface JobSearchFiltersProps {
  filters: JobSearchFiltersState;
  onFiltersChange: (filters: JobSearchFiltersState) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
  disabled?: boolean;
}

export function JobSearchFilters({
  filters,
  onFiltersChange,
  onReset,
  hasActiveFilters,
  disabled = false,
}: JobSearchFiltersProps) {
  const handleRemoteChange = (checked: boolean) => {
    onFiltersChange({ ...filters, remoteOnly: checked });
  };

  const handleJobTypeChange = (value: JobType) => {
    onFiltersChange({ ...filters, jobType: value });
  };

  const handleExperienceChange = (value: ExperienceLevel) => {
    onFiltersChange({ ...filters, experience: value });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Filters</h3>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-primary-500 hover:text-primary-700 font-medium"
            disabled={disabled}
          >
            Reset
          </button>
        )}
      </div>

      <div className="space-y-5">
        {/* Remote Only */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-blue-600" aria-hidden="true" />
            <Label className="text-sm font-medium text-slate-700">Location</Label>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="remote-toggle" className="text-sm text-slate-600 cursor-pointer">
              Remote only
            </Label>
            <Switch
              id="remote-toggle"
              checked={filters.remoteOnly}
              onCheckedChange={handleRemoteChange}
              disabled={disabled}
            />
          </div>
        </div>

        <Separator />

        {/* Job Type */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-purple-600" aria-hidden="true" />
            <Label htmlFor="job-type" className="text-sm font-medium text-slate-700">
              Job Type
            </Label>
          </div>
          <Select
            value={filters.jobType}
            onValueChange={(v) => handleJobTypeChange(v as JobType)}
            disabled={disabled}
          >
            <SelectTrigger id="job-type" className="w-full">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              {JOB_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Experience Level */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-amber-600" aria-hidden="true" />
            <Label htmlFor="experience-level" className="text-sm font-medium text-slate-700">
              Experience Level
            </Label>
          </div>
          <Select
            value={filters.experience}
            onValueChange={(v) => handleExperienceChange(v as ExperienceLevel)}
            disabled={disabled}
          >
            <SelectTrigger id="experience-level" className="w-full">
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent>
              {EXPERIENCE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
