'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { AdvisorGate } from '@/components/advisor/AdvisorGate';
import { ApplicationKanbanEnhanced } from '@/components/advisor/applications/ApplicationKanbanEnhanced';
import { ApplicationTableEnhanced } from '@/components/advisor/applications/ApplicationTableEnhanced';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

import { ActiveFiltersChips } from './components/ActiveFiltersChips';
import { AdvancedFiltersPanel } from './components/AdvancedFiltersPanel';
import { ApplicationsHeader } from './components/ApplicationsHeader';
import { BulkActionBar } from './components/BulkActionBar';
import { CompactFilterBar } from './components/CompactFilterBar';
import { ApplicationsLoadingSkeleton, EmptyState } from './components/EmptyStates';
import { QuickFilterPills } from './components/QuickFilterPills';
import { useApplicationFilters, useAvailableCohorts } from './hooks/useApplicationFilters';
import { useApplicationSelection } from './hooks/useApplicationSelection';
import { enrichApplicationsWithNeedAction } from './hooks/useNeedActionRules';
import {
  ApplicationScope,
  ApplicationViewMode,
  BaseEnrichedApplication,
  EnrichedApplication,
} from './types';

export default function AdvisorApplicationsPage() {
  const { user } = useUser();
  const clerkId = user?.id;
  const userRole = user?.publicMetadata?.role as string | undefined;
  const { toast } = useToast();
  const router = useRouter();

  // ============================================================================
  // View State
  // ============================================================================

  const [viewMode, setViewMode] = useState<ApplicationViewMode>('table');
  const [scope, setScope] = useState<ApplicationScope>('my-students');
  const [showFilters, setShowFilters] = useState(false);

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const applications = useQuery(
    api.advisor_applications.getApplicationsForCaseload,
    clerkId ? { clerkId } : 'skip',
  );

  const stats = useQuery(
    api.advisor_applications.getApplicationStats,
    clerkId ? { clerkId } : 'skip',
  );

  // ============================================================================
  // Mutations
  // ============================================================================

  const bulkUpdateStageMutation = useMutation(api.advisor_applications.bulkUpdateApplicationStage);
  const bulkArchiveMutation = useMutation(api.advisor_applications.bulkArchiveApplications);
  const bulkUpdateNextStepMutation = useMutation(api.advisor_applications.bulkUpdateNextStep);
  const bulkMarkReviewedMutation = useMutation(api.advisor_applications.bulkMarkReviewed);

  // ============================================================================
  // Filter & Selection State
  // ============================================================================

  const filterHook = useApplicationFilters();
  const { applyFilters } = filterHook;
  const selectionHook = useApplicationSelection();

  // ============================================================================
  // Data Enrichment & Filtering
  // ============================================================================

  // Enrich applications with need-action metadata
  // Data flow: Convex query → BaseEnrichedApplication → enrichApplicationsWithNeedAction → EnrichedApplication
  const enrichedApplications = useMemo((): EnrichedApplication[] => {
    if (!applications) return [];

    // Filter out applications without a valid stage
    // The Convex query returns stage as string | undefined, but we need ApplicationStage
    // After filtering, we cast the type since the filter ensures stage exists
    type QueryApp = NonNullable<typeof applications>[number];
    const appsWithStage = applications.filter(
      (app: QueryApp) => app.stage !== undefined && app.stage !== null,
    );

    // Map to BaseEnrichedApplication (backend data shape without computed fields)
    const mappedApps: BaseEnrichedApplication[] = appsWithStage.map((app: QueryApp) => ({
      ...app,
      stage: app.stage as BaseEnrichedApplication['stage'],
    }));

    // Add computed triage fields to produce EnrichedApplication
    return enrichApplicationsWithNeedAction(mappedApps);
  }, [applications]);

  // Apply filters
  const filteredApplications = useMemo(() => {
    return applyFilters(enrichedApplications);
  }, [enrichedApplications, applyFilters]);

  // Get available cohorts for filter UI
  const availableCohorts = useAvailableCohorts(enrichedApplications);

  // ============================================================================
  // Metric Click Handlers (Apply Filters)
  // ============================================================================

  const handleFilterByActive = () => {
    filterHook.setActiveOnly(true);
    filterHook.setStages([]);
  };

  const handleFilterByOffers = () => {
    filterHook.setStages(['Offer']);
    filterHook.setActiveOnly(false);
  };

  const handleFilterByAccepted = () => {
    filterHook.setStages(['Accepted']);
    filterHook.setActiveOnly(false);
  };

  const handleFilterByNeedAction = () => {
    filterHook.setNeedsAction(true);
    filterHook.setActiveOnly(false);
  };

  const handleFilterByNeedActionReason = (
    reason: EnrichedApplication['needActionReasons'][number],
  ) => {
    filterHook.setNeedActionReason(reason);
  };

  // ============================================================================
  // Bulk Actions
  // ============================================================================

  const handleBulkChangeStage = async (
    newStage: EnrichedApplication['stage'],
    notes?: string,
    reasonCode?: string,
  ) => {
    if (!clerkId) return;

    const selectedIds = selectionHook.getSelectedIds();

    try {
      const result = await bulkUpdateStageMutation({
        clerkId,
        applicationIds: selectedIds,
        newStage,
        notes,
        reason_code: reasonCode,
      });

      // Show success/error feedback
      if (result.success > 0) {
        toast({
          title: 'Stage updated',
          description: `Successfully updated ${result.success} application${result.success !== 1 ? 's' : ''}.`,
        });
      }
      if (result.failed > 0) {
        toast({
          title: 'Some updates failed',
          description: `Failed to update ${result.failed} application${result.failed !== 1 ? 's' : ''}.`,
          variant: 'destructive',
        });
      }

      // Clear selection after bulk action
      selectionHook.clearSelection();
    } catch (error) {
      console.error('Bulk update failed:', error);
      toast({
        title: 'Update failed',
        description: 'Failed to update applications. Please try again.',
        variant: 'destructive',
      });
      // Clear selection on error to prevent stale state
      selectionHook.clearSelection();
    }
  };

  const handleBulkArchive = async (reason: string) => {
    if (!clerkId) return;

    const selectedIds = selectionHook.getSelectedIds();

    try {
      const result = await bulkArchiveMutation({
        clerkId,
        applicationIds: selectedIds,
        reason,
      });

      if (result.success > 0) {
        toast({
          title: 'Applications archived',
          description: `Successfully archived ${result.success} application${result.success !== 1 ? 's' : ''}.`,
        });
      }
      if (result.failed > 0) {
        toast({
          title: 'Some archives failed',
          description: `Failed to archive ${result.failed} application${result.failed !== 1 ? 's' : ''}.`,
          variant: 'destructive',
        });
      }

      selectionHook.clearSelection();
    } catch (error) {
      console.error('Bulk archive failed:', error);
      toast({
        title: 'Archive failed',
        description: 'Failed to archive applications. Please try again.',
        variant: 'destructive',
      });
      // Clear selection on error to prevent stale state
      selectionHook.clearSelection();
    }
  };

  const handleBulkUpdateNextStep = async (nextStep: string, dueDate?: number) => {
    if (!clerkId) return;

    const selectedIds = selectionHook.getSelectedIds();

    try {
      const result = await bulkUpdateNextStepMutation({
        clerkId,
        applicationIds: selectedIds,
        nextStep,
        dueDate,
      });

      if (result.success > 0) {
        toast({
          title: 'Next steps updated',
          description: `Successfully updated ${result.success} application${result.success !== 1 ? 's' : ''}.`,
        });
      }
      if (result.failed > 0) {
        toast({
          title: 'Some updates failed',
          description: `Failed to update ${result.failed} application${result.failed !== 1 ? 's' : ''}.`,
          variant: 'destructive',
        });
      }

      selectionHook.clearSelection();
    } catch (error) {
      console.error('Bulk update next step failed:', error);
      toast({
        title: 'Update failed',
        description: 'Failed to update next steps. Please try again.',
        variant: 'destructive',
      });
      // Clear selection on error to prevent stale state
      selectionHook.clearSelection();
    }
  };

  const handleBulkMarkReviewed = async () => {
    if (!clerkId) return;

    const selectedIds = selectionHook.getSelectedIds();

    try {
      const result = await bulkMarkReviewedMutation({
        clerkId,
        applicationIds: selectedIds,
      });

      if (result.success > 0) {
        toast({
          title: 'Marked as reviewed',
          description: `Successfully marked ${result.success} application${result.success !== 1 ? 's' : ''} as reviewed.`,
        });
      }
      if (result.failed > 0) {
        toast({
          title: 'Some updates failed',
          description: `Failed to mark ${result.failed} application${result.failed !== 1 ? 's' : ''} as reviewed.`,
          variant: 'destructive',
        });
      }

      selectionHook.clearSelection();
    } catch (error) {
      console.error('Bulk mark reviewed failed:', error);
      toast({
        title: 'Update failed',
        description: 'Failed to mark applications as reviewed. Please try again.',
        variant: 'destructive',
      });
      // Clear selection on error to prevent stale state
      selectionHook.clearSelection();
    }
  };

  // ============================================================================
  // Empty State Detection
  // ============================================================================

  const isEmpty = enrichedApplications.length === 0;
  const hasNoResults = !isEmpty && filteredApplications.length === 0;
  // Only show "no action needed" state when needsAction is the only active filter
  const hasNoActionNeeded =
    filterHook.filters.needsAction &&
    filteredApplications.length === 0 &&
    filterHook.filters.stages.length === 0 &&
    filterHook.filters.cohorts.length === 0 &&
    !filterHook.filters.search &&
    !filterHook.filters.activeOnly &&
    filterHook.filters.timeWindow === 'all';

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <AdvisorGate requiredFlag="advisor.applications">
      <ErrorBoundary
        fallback={
          <div className="container mx-auto p-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error Loading Applications</AlertTitle>
              <AlertDescription>
                There was an error loading application data. Please try refreshing the page. If the
                problem persists, contact support.
              </AlertDescription>
            </Alert>
          </div>
        }
      >
        <div className="w-full">
          <div className="w-full gradient-border-bottom p-5 space-y-6 shadow-sm">
            {/* Loading State */}
            {applications === undefined && <ApplicationsLoadingSkeleton viewMode={viewMode} />}

            {/* Only show UI when data is loaded */}
            {applications !== undefined && (
              <>
                {/* Header with Metrics */}
                <ApplicationsHeader
                  stats={stats}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  scope={scope}
                  onScopeChange={setScope}
                  canViewAllStudents={userRole === 'university_admin' || userRole === 'super_admin'}
                  searchQuery={filterHook.filters.search}
                  onSearchChange={filterHook.setSearch}
                  showFilters={showFilters}
                  onToggleFilters={() => setShowFilters(!showFilters)}
                  hasActiveFilters={filterHook.hasActiveFilters}
                  onFilterByActive={handleFilterByActive}
                  onFilterByOffers={handleFilterByOffers}
                  onFilterByAccepted={handleFilterByAccepted}
                  onFilterByNeedAction={handleFilterByNeedAction}
                  onFilterByNeedActionReason={handleFilterByNeedActionReason}
                />

                {/* Quick Filter Pills (shown when there are need-action apps) */}
                <QuickFilterPills
                  stats={stats}
                  activeReason={filterHook.filters.needActionReason}
                  onFilterByReason={handleFilterByNeedActionReason}
                />

                {/* Compact Filter Bar for Inbox Mode */}
                <CompactFilterBar
                  needsAction={filterHook.filters.needsAction}
                  selectedStages={filterHook.filters.stages}
                  timeWindow={filterHook.filters.timeWindow}
                  scope={scope}
                  onNeedsActionChange={filterHook.setNeedsAction}
                  onStagesChange={filterHook.setStages}
                  onTimeWindowChange={filterHook.setTimeWindow}
                  onScopeChange={setScope}
                  onOpenAdvancedFilters={() => setShowFilters(true)}
                  canViewAllStudents={userRole === 'university_admin' || userRole === 'super_admin'}
                  hasActiveFilters={filterHook.hasActiveFilters}
                />

                {/* Active Filter Chips */}
                <ActiveFiltersChips
                  filters={filterHook.filters}
                  onRemoveStage={(stage) => {
                    filterHook.setStages(filterHook.filters.stages.filter((s) => s !== stage));
                  }}
                  onRemoveCohort={(cohort) => {
                    filterHook.setCohorts(filterHook.filters.cohorts.filter((c) => c !== cohort));
                  }}
                  onRemoveNeedsAction={() => filterHook.setNeedsAction(false)}
                  onRemoveNeedActionReason={() => filterHook.setNeedActionReason(undefined)}
                  onRemoveActiveOnly={() => filterHook.setActiveOnly(false)}
                  onRemoveTimeWindow={() => filterHook.setTimeWindow('all')}
                  onClearAll={filterHook.clearFilters}
                />

                {/* Advanced Filters Panel (Collapsible) */}
                {showFilters && (
                  <AdvancedFiltersPanel
                    filters={filterHook.filters}
                    availableCohorts={availableCohorts}
                    onToggleStage={filterHook.toggleStage}
                    onSetStages={filterHook.setStages}
                    onToggleCohort={filterHook.toggleCohort}
                    onSetActiveOnly={filterHook.setActiveOnly}
                    onClearFilters={filterHook.clearFilters}
                    onSetDateRange={filterHook.setAppliedDateRange}
                  />
                )}
              </>
            )}

            {/* Main Content */}
            {applications !== undefined && (
              <Card>
                <CardContent className="p-6">
                  {/* Empty State: No Applications */}
                  {isEmpty && (
                    <EmptyState
                      type="no-apps"
                      onViewAllStudents={() => {
                        router.push('/advisor/advising/students');
                      }}
                    />
                  )}

                  {/* Empty State: No Action Needed (Positive!) */}
                  {!isEmpty && hasNoActionNeeded && <EmptyState type="no-action-needed" />}

                  {/* Empty State: No Results from Filters */}
                  {!isEmpty && hasNoResults && !hasNoActionNeeded && (
                    <EmptyState type="no-results" onClearFilters={filterHook.clearFilters} />
                  )}

                  {/* Kanban View */}
                  {!isEmpty && !hasNoResults && viewMode === 'kanban' && (
                    <ApplicationKanbanEnhanced
                      applications={filteredApplications}
                      isLoading={false}
                      clerkId={clerkId}
                      onRefresh={() => {
                        // Convex will automatically refetch when data changes
                        // No manual refresh needed
                      }}
                    />
                  )}

                  {/* Table View */}
                  {!isEmpty && !hasNoResults && viewMode === 'table' && (
                    <ApplicationTableEnhanced
                      applications={filteredApplications}
                      isLoading={false}
                      clerkId={clerkId}
                      selectionHook={selectionHook}
                    />
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Bulk Action Bar (Floating) */}
        <BulkActionBar
          selectedCount={selectionHook.selectedCount}
          onClearSelection={selectionHook.clearSelection}
          onChangeStage={handleBulkChangeStage}
          onArchive={handleBulkArchive}
          onUpdateNextStep={handleBulkUpdateNextStep}
          onMarkReviewed={handleBulkMarkReviewed}
        />
      </ErrorBoundary>
    </AdvisorGate>
  );
}
