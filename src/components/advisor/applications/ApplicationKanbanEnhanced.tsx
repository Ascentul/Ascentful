'use client';

/**
 * Enhanced Application Kanban Component
 *
 * Enterprise-grade kanban with:
 * - Need-action badges on cards
 * - Need-action count in column headers
 * - Visual priority indicators
 * - Quick actions menu
 * - Improved accessibility
 *
 * Integrates with:
 * - EnrichedApplication type with triage metadata
 * - Need-action visual system
 * - Stage transition modal
 */

import type { Id } from 'convex/_generated/dataModel';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Building2,
  Calendar,
  Clock,
  Edit2,
  ExternalLink,
  MoreVertical,
  Plus,
  RefreshCw,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import {
  ApplicationStage,
  EnrichedApplication,
} from '@/app/(dashboard)/advisor/applications/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, isValidHttpUrl } from '@/lib/utils';

import { StageTransitionModal } from './StageTransitionModal';

// ============================================================================
// Types
// ============================================================================

interface ApplicationKanbanEnhancedProps {
  applications: EnrichedApplication[];
  isLoading?: boolean;
  clerkId?: string;
  onRefresh?: (applicationId?: string, newStage?: string) => void;
  onEditNextStep?: (app: EnrichedApplication) => void;
}

const STAGE_COLORS: Record<string, string> = {
  Prospect: 'bg-gray-100 border-gray-300',
  Applied: 'bg-blue-100 border-blue-300',
  Interview: 'bg-purple-100 border-purple-300',
  Offer: 'bg-green-100 border-green-300',
  Accepted: 'bg-emerald-100 border-emerald-300',
  Rejected: 'bg-red-100 border-red-300',
  Withdrawn: 'bg-orange-100 border-orange-300',
};

const STAGE_ORDER: ApplicationStage[] = [
  'Prospect',
  'Applied',
  'Interview',
  'Offer',
  'Accepted',
  'Rejected',
  'Withdrawn',
];

// ============================================================================
// Main Component
// ============================================================================

export function ApplicationKanbanEnhanced({
  applications,
  isLoading,
  clerkId,
  onRefresh,
  onEditNextStep,
}: ApplicationKanbanEnhancedProps) {
  const [selectedApplication, setSelectedApplication] = useState<EnrichedApplication | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Group applications by stage
  const applicationsByStage = useMemo(() => {
    const grouped: Record<ApplicationStage, EnrichedApplication[]> = {
      Prospect: [],
      Applied: [],
      Interview: [],
      Offer: [],
      Accepted: [],
      Rejected: [],
      Withdrawn: [],
      Archived: [],
    };

    applications.forEach((app) => {
      if (app.stage !== 'Archived') {
        // Exclude archived from kanban view; guard against unknown stages
        if (grouped[app.stage]) {
          grouped[app.stage].push(app);
        } else {
          console.warn(`Unknown application stage: ${app.stage}`);
        }
      }
    });

    return grouped;
  }, [applications]);

  // Calculate need-action counts per stage
  const needActionCountsByStage = useMemo(() => {
    const counts: Record<ApplicationStage, number> = {
      Prospect: 0,
      Applied: 0,
      Interview: 0,
      Offer: 0,
      Accepted: 0,
      Rejected: 0,
      Withdrawn: 0,
      Archived: 0,
    };

    applications.forEach((app) => {
      // Guard against unknown stages (consistent with applicationsByStage grouping)
      if (app.needsAction && app.stage !== 'Archived' && counts[app.stage] !== undefined) {
        counts[app.stage]++;
      }
    });

    return counts;
  }, [applications]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleStageChange = (app: EnrichedApplication) => {
    setSelectedApplication(app);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedApplication(null);
  };

  const handleSuccess = (applicationId: Id<'applications'>, newStage: ApplicationStage) => {
    handleModalClose();
    if (onRefresh) {
      onRefresh(applicationId as string, newStage as string);
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading applications...</p>
        </div>
      </div>
    );
  }

  const totalApps = applications.length;

  if (totalApps === 0) {
    return (
      <div className="border rounded-lg p-12 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground mb-2">No applications yet</p>
        <p className="text-sm text-muted-foreground">Student applications will appear here</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-4 pb-4 min-w-max">
        {STAGE_ORDER.map((stage) => {
          const stageApps = applicationsByStage[stage] || [];
          const needActionCount = needActionCountsByStage[stage] || 0;

          return (
            <div key={stage} className="flex-shrink-0 w-80 min-w-[320px]">
              <Card className={STAGE_COLORS[stage]}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{stage}</span>
                    <div className="flex items-center gap-2">
                      {/* Need-action indicator in header */}
                      {needActionCount > 0 && (
                        <Badge
                          variant="destructive"
                          className="bg-orange-500 hover:bg-orange-600 gap-1"
                        >
                          <AlertCircle className="h-3 w-3" aria-hidden="true" />
                          {needActionCount}
                        </Badge>
                      )}
                      {/* Total count */}
                      <Badge variant="secondary">{stageApps.length}</Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 max-h-[600px] overflow-y-auto no-scrollbar">
                  {stageApps.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No applications
                    </div>
                  ) : (
                    stageApps.map((app) => (
                      <ApplicationCard
                        key={app._id}
                        app={app}
                        clerkId={clerkId}
                        onStageChange={() => handleStageChange(app)}
                        onEditNextStep={onEditNextStep}
                      />
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Stage Transition Modal */}
      {selectedApplication && clerkId && (
        <StageTransitionModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          application={{
            _id: selectedApplication._id as Id<'applications'>,
            company_name: selectedApplication.company_name,
            position_title: selectedApplication.position_title,
            student_name: selectedApplication.student_name,
            stage: selectedApplication.stage,
          }}
          clerkId={clerkId}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}

// ============================================================================
// Application Card Component
// ============================================================================

interface ApplicationCardProps {
  app: EnrichedApplication;
  clerkId?: string;
  onStageChange: () => void;
  onEditNextStep?: (app: EnrichedApplication) => void;
}

function ApplicationCard({ app, clerkId, onStageChange, onEditNextStep }: ApplicationCardProps) {
  return (
    <Card
      className={cn(
        'hover:shadow-md transition-all',
        app.needsAction && 'border-orange-400 bg-orange-50/50 ring-1 ring-orange-200',
      )}
    >
      <CardContent className="p-4 space-y-3">
        {/* Need-Action Badge & Last Activity */}
        <div className="flex items-center justify-between gap-2 text-xs">
          {app.needsAction ? (
            <Badge
              variant="destructive"
              className={cn(
                'gap-1 font-semibold',
                app.isOverdue ? 'bg-red-500 hover:bg-red-600' : 'bg-orange-500 hover:bg-orange-600',
              )}
            >
              <AlertCircle className="h-3 w-3" aria-hidden="true" />
              {app.isOverdue ? 'Overdue' : app.isDueSoon ? 'Due Soon' : 'Needs Action'}
            </Badge>
          ) : (
            <div />
          )}
          {/* Last Activity */}
          <div className="flex items-center gap-1 text-muted-foreground">
            <Activity
              className={cn('h-3 w-3', app.isStale ? 'text-gray-400' : 'text-muted-foreground')}
              aria-hidden="true"
            />
            <span className={cn(app.isStale && 'font-medium text-gray-500')}>
              {app.daysSinceUpdate == null
                ? '-'
                : app.daysSinceUpdate === 0
                  ? 'Today'
                  : app.daysSinceUpdate === 1
                    ? '1d'
                    : `${app.daysSinceUpdate}d`}
            </span>
          </div>
        </div>

        {/* Company & Position */}
        <div>
          <div className="flex items-start gap-2 mb-1">
            <Building2
              className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0"
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm truncate">{app.company_name}</h4>
              <p className="text-xs text-muted-foreground truncate">{app.position_title}</p>
            </div>
            {/* Quick Actions Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEditNextStep && (
                  <>
                    <DropdownMenuItem onClick={() => onEditNextStep(app)}>
                      <Edit2 className="h-4 w-4 mr-2" aria-hidden="true" />
                      Edit Next Step
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem asChild>
                  <Link href={`/advisor/students/${app.user_id}`}>
                    <User className="h-4 w-4 mr-2" aria-hidden="true" />
                    View Student
                  </Link>
                </DropdownMenuItem>
                {app.application_url && isValidHttpUrl(app.application_url) && (
                  <DropdownMenuItem asChild>
                    <a href={app.application_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" aria-hidden="true" />
                      Open Application
                    </a>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Student */}
        <div className="flex items-center gap-2 text-xs">
          <User className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground truncate">{app.student_name}</span>
          {app.student_graduation_year && (
            <span className="text-muted-foreground">
              '{String(app.student_graduation_year).slice(-2)}
            </span>
          )}
        </div>

        {/* Applied Date */}
        {app.applied_date && !isNaN(new Date(app.applied_date).getTime()) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" aria-hidden="true" />
            Applied {format(new Date(app.applied_date), 'MMM d')}
          </div>
        )}

        {/* Next Step */}
        {app.next_step ? (
          <div
            className={cn(
              'text-xs p-2 rounded-md border',
              app.isOverdue
                ? 'bg-red-50 border-red-200 text-red-800'
                : app.isDueSoon
                  ? 'bg-orange-50 border-orange-200 text-orange-800'
                  : 'bg-blue-50 border-blue-200 text-blue-800',
            )}
          >
            <div className="flex items-center gap-1 mb-1">
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
              <span className="font-semibold">Next:</span>
            </div>
            <div className="truncate">{app.next_step}</div>
            {app.next_step_date && !isNaN(new Date(app.next_step_date).getTime()) && (
              <div className="flex items-center gap-1 mt-1 font-medium">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {format(new Date(app.next_step_date), 'MMM d')}
                {app.isOverdue && ' (Overdue)'}
                {!app.isOverdue && (
                  <span className="text-muted-foreground font-normal">
                    ({formatDistanceToNow(new Date(app.next_step_date), { addSuffix: true })})
                  </span>
                )}
              </div>
            )}
          </div>
        ) : app.needsAction && app.needActionReasons?.includes('no_next_step') && onEditNextStep ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEditNextStep(app)}
            className="w-full text-xs gap-1 text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            Add next step
          </Button>
        ) : null}

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-2 border-t">
          <div className="flex gap-2">
            <Link href={`/advisor/students/${app.user_id}`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full text-xs">
                View Student
              </Button>
            </Link>
            {app.application_url && isValidHttpUrl(app.application_url) && (
              <a href={app.application_url} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="px-2">
                  <ExternalLink className="h-4 w-4" />
                  <span className="sr-only">Open application URL</span>
                </Button>
              </a>
            )}
          </div>
          {clerkId && (
            <Button
              variant="secondary"
              size="sm"
              className="w-full text-xs"
              onClick={onStageChange}
            >
              <RefreshCw className="h-3 w-3 mr-1" aria-hidden="true" />
              Change Stage
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
