/**
 * Applications Header Component
 *
 * Enhanced header for the Advisor Applications page with:
 * - Scope selector (My Students / All Students)
 * - Clickable metrics that apply filters
 * - View mode toggle (Kanban / Table)
 * - Search and advanced filters toggle
 *
 * Design principles:
 * - Triage as default (Need Action metric is prominent and clickable)
 * - Clear visual hierarchy
 * - Responsive layout
 * - Accessible navigation
 */

'use client';

import {
  AlertCircle,
  Building2,
  CheckCircle,
  Filter,
  LayoutGrid,
  Search,
  Table as TableIcon,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import {
  ApplicationScope,
  ApplicationStats,
  ApplicationViewMode,
  NeedActionReason,
} from '../types';

// ============================================================================
// Types
// ============================================================================

export interface ApplicationsHeaderProps {
  // Stats
  stats?: ApplicationStats;

  // View state
  viewMode: ApplicationViewMode;
  onViewModeChange: (mode: ApplicationViewMode) => void;

  // Scope
  scope: ApplicationScope;
  onScopeChange: (scope: ApplicationScope) => void;
  canViewAllStudents?: boolean; // Only university_admin can see "All"

  // Filters
  searchQuery: string;
  onSearchChange: (query: string) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  hasActiveFilters: boolean;

  // Metric click handlers (apply filters)
  onFilterByActive: () => void;
  onFilterByOffers: () => void;
  onFilterByAccepted: () => void;
  onFilterByNeedAction: () => void;
  onFilterByNeedActionReason?: (reason: NeedActionReason) => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function ApplicationsHeader({
  stats,
  viewMode,
  onViewModeChange,
  scope,
  onScopeChange,
  canViewAllStudents = false,
  searchQuery,
  onSearchChange,
  showFilters,
  onToggleFilters,
  hasActiveFilters,
  onFilterByActive,
  onFilterByOffers,
  onFilterByAccepted,
  onFilterByNeedAction,
  onFilterByNeedActionReason,
}: ApplicationsHeaderProps) {
  return (
    <div className="space-y-6">
      {/* Title Row */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Title + Scope Selector */}
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Applications</h1>
            <p className="text-muted-foreground mt-1">Track student application pipelines</p>
          </div>

          {/* Scope Selector */}
          {canViewAllStudents && (
            <Select
              value={scope}
              onValueChange={(value) => onScopeChange(value as ApplicationScope)}
            >
              <SelectTrigger className="w-48" aria-label="Select student scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="my-students">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>My Students</span>
                  </div>
                </SelectItem>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span>All Students</span>
                  </div>
                </SelectItem>
                <SelectItem value="assigned-to-me">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    <span>Assigned to Me</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* View Mode Toggle */}
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'kanban' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewModeChange('kanban')}
            aria-pressed={viewMode === 'kanban'}
          >
            <LayoutGrid className="h-4 w-4 mr-2" aria-hidden="true" />
            Kanban
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewModeChange('table')}
            aria-pressed={viewMode === 'table'}
          >
            <TableIcon className="h-4 w-4 mr-2" aria-hidden="true" />
            Table
          </Button>
        </div>
      </div>

      {/* Search + Filters Bar */}
      <div className="flex gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Search by company, position, or student name..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
            aria-label="Search applications"
          />
        </div>

        {/* Advanced Filters Toggle */}
        <Button
          variant={showFilters || hasActiveFilters ? 'default' : 'outline'}
          size="default"
          onClick={onToggleFilters}
          className="gap-2"
          aria-pressed={showFilters}
        >
          <Filter className="h-4 w-4" aria-hidden="true" />
          Filters
          {hasActiveFilters && (
            <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
              Active
            </span>
          )}
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {/* Total */}
        <MetricCard
          title="Total"
          value={stats?.total ?? '-'}
          icon={<Target className="h-4 w-4 text-muted-foreground" />}
          description="All applications"
        />

        {/* Active - Clickable */}
        <MetricCard
          title="Active"
          value={stats?.active ?? '-'}
          icon={<TrendingUp className="h-4 w-4 text-blue-500" />}
          description="Prospect, Applied, Interview"
          onClick={onFilterByActive}
          clickable
          valueClassName="text-blue-600"
        />

        {/* Offers - Clickable */}
        <MetricCard
          title="Offers"
          value={stats?.offers ?? '-'}
          icon={<CheckCircle className="h-4 w-4 text-green-500" />}
          description="Pending offers"
          onClick={onFilterByOffers}
          clickable
          valueClassName="text-green-600"
        />

        {/* Accepted - Clickable */}
        <MetricCard
          title="Accepted"
          value={stats?.accepted ?? '-'}
          icon={<CheckCircle className="h-4 w-4 text-emerald-500" />}
          description="Offers accepted"
          onClick={onFilterByAccepted}
          clickable
          valueClassName="text-emerald-600"
        />

        {/* Need Action - Prominent + Clickable */}
        <NeedActionMetric
          value={stats?.needingAction ?? '-'}
          breakdown={stats?.needActionBreakdown}
          onClick={onFilterByNeedAction}
          onClickReason={onFilterByNeedActionReason}
        />

        {/* Conversion Rate */}
        <MetricCard
          title="Conv. Rate"
          value={stats?.conversionRate ? `${stats.conversionRate}%` : '-'}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          description="Offer/acceptance rate"
        />
      </div>
    </div>
  );
}

// ============================================================================
// Metric Card Component
// ============================================================================

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
  onClick?: () => void;
  clickable?: boolean;
  valueClassName?: string;
}

function MetricCard({
  title,
  value,
  icon,
  description,
  onClick,
  clickable = false,
  valueClassName = '',
}: MetricCardProps) {
  // Only apply interactive props when both clickable=true AND onClick handler exists
  const isInteractive = clickable && onClick;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card
            className={`py-5 px-5 ${isInteractive ? 'cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]' : ''}`}
            onClick={isInteractive ? onClick : undefined}
            onKeyDown={
              isInteractive
                ? (e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onClick();
                    }
                  }
                : undefined
            }
            role={isInteractive ? 'button' : undefined}
            tabIndex={isInteractive ? 0 : undefined}
            aria-label={isInteractive ? `Filter by ${title.toLowerCase()}` : undefined}
          >
            <div className="flex items-center gap-3">
              {icon}
              <p className={`text-xl font-semibold leading-none ${valueClassName}`}>{value}</p>
              <p className="text-xs text-muted-foreground">{title}</p>
            </div>
          </Card>
        </TooltipTrigger>
        {description && (
          <TooltipContent>
            <p>{description}</p>
            {clickable && <p className="text-xs text-muted-foreground mt-1">Click to filter</p>}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Need Action Metric (Special Treatment)
// ============================================================================

interface NeedActionMetricProps {
  value: string | number;
  breakdown?: {
    no_next_step: number;
    overdue: number;
    due_soon: number;
    stale: number;
  };
  onClick?: () => void;
  onClickReason?: (reason: NeedActionReason) => void;
}

function NeedActionMetric({ value, breakdown, onClick, onClickReason }: NeedActionMetricProps) {
  const hasIssues = typeof value === 'number' && value > 0;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && onClick) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card
            className={`py-5 px-5 ${hasIssues ? 'border-orange-200 bg-orange-50/50' : ''} ${onClick ? 'cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]' : ''}`}
            onClick={onClick}
            onKeyDown={onClick ? handleKeyDown : undefined}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            aria-label={onClick ? 'Filter applications needing action' : undefined}
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0" aria-hidden="true" />
              <p
                className={`text-xl font-semibold leading-none ${hasIssues ? 'text-orange-600' : ''}`}
              >
                {value}
              </p>
              <p className="text-xs text-muted-foreground">Need Action</p>
            </div>
          </Card>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-semibold mb-2">Applications needing attention</p>
          {breakdown && hasIssues ? (
            <div className="space-y-1.5">
              {breakdown.overdue > 0 && (
                <button
                  className="flex w-full justify-between items-center rounded px-2 py-1 hover:bg-red-100 transition-colors text-left text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClickReason?.('overdue');
                  }}
                  aria-label="Filter by overdue applications"
                >
                  <span>Overdue</span>
                  <span className="font-semibold text-red-600">{breakdown.overdue}</span>
                </button>
              )}
              {breakdown.due_soon > 0 && (
                <button
                  className="flex w-full justify-between items-center rounded px-2 py-1 hover:bg-orange-100 transition-colors text-left text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClickReason?.('due_soon');
                  }}
                  aria-label="Filter by applications due soon"
                >
                  <span>Due soon</span>
                  <span className="font-semibold text-orange-600">{breakdown.due_soon}</span>
                </button>
              )}
              {breakdown.no_next_step > 0 && (
                <button
                  className="flex w-full justify-between items-center rounded px-2 py-1 hover:bg-blue-100 transition-colors text-left text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClickReason?.('no_next_step');
                  }}
                  aria-label="Filter by applications with no next step"
                >
                  <span>No next step</span>
                  <span className="font-semibold">{breakdown.no_next_step}</span>
                </button>
              )}
              {breakdown.stale > 0 && (
                <button
                  className="flex w-full justify-between items-center rounded px-2 py-1 hover:bg-gray-100 transition-colors text-left text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClickReason?.('stale');
                  }}
                  aria-label="Filter by stale applications"
                >
                  <span>Stale (14+ days)</span>
                  <span className="font-semibold">{breakdown.stale}</span>
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No issues needing attention</p>
          )}
          {onClick && (
            <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
              Click card to filter all, or click a category above
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
