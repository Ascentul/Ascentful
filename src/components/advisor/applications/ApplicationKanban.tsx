'use client';

import type { Id } from 'convex/_generated/dataModel';
import { format } from 'date-fns';
import { ArrowRight, Building2, Calendar, ExternalLink, RefreshCw, User } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ACTIVE_STAGES, ALL_STAGES, type ApplicationStage } from '@/lib/advisor/stages';
import { cn, isValidHttpUrl } from '@/lib/utils';

import { StageTransitionModal } from './StageTransitionModal';

interface Application {
  _id: string;
  user_id: string;
  student_name: string;
  student_email: string;
  company_name: string;
  position_title: string;
  stage: ApplicationStage;
  status?: string;
  application_url?: string;
  applied_date?: number;
  next_step?: string;
  next_step_date?: number;
  notes?: string;
  created_at: number;
  updated_at: number;
}

interface ApplicationKanbanProps {
  applicationsByStage: Record<ApplicationStage, Application[]>;
  isLoading?: boolean;
  clerkId?: string;
  onRefresh?: (applicationId?: string, newStage?: ApplicationStage) => void;
}

const STAGE_COLORS: Record<string, string> = {
  Prospect: 'bg-gray-100 border-gray-300',
  Applied: 'bg-blue-100 border-blue-300',
  Interview: 'bg-purple-100 border-purple-300',
  Offer: 'bg-green-100 border-green-300',
  Accepted: 'bg-emerald-100 border-emerald-300',
  Rejected: 'bg-red-100 border-red-300',
  Withdrawn: 'bg-orange-100 border-orange-300',
  Archived: 'bg-slate-100 border-slate-300',
};

// Kanban view excludes 'Archived' stage from display
const STAGE_ORDER = ALL_STAGES.filter((stage) => stage !== 'Archived');

export function ApplicationKanban({
  applicationsByStage,
  isLoading,
  clerkId,
  onRefresh,
}: ApplicationKanbanProps) {
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleStageChange = (app: Application) => {
    setSelectedApplication(app);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedApplication(null);
  };

  const handleSuccess = (applicationId: string, newStage: ApplicationStage) => {
    handleModalClose();
    if (onRefresh) {
      onRefresh(applicationId, newStage);
    }
  };

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

  const totalApps = Object.values(applicationsByStage).reduce((sum, apps) => sum + apps.length, 0);

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
          const applications = applicationsByStage[stage] || [];
          const isActive = ACTIVE_STAGES.includes(stage as ApplicationStage);
          const now = Date.now();

          return (
            <div key={stage} className="flex-shrink-0 w-80 min-w-[320px]">
              <Card className={STAGE_COLORS[stage]}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{stage}</span>
                    <Badge variant="secondary" className="ml-2">
                      {applications.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 max-h-[600px] overflow-y-auto no-scrollbar">
                  {applications.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No applications
                    </div>
                  ) : (
                    applications.map((app) => {
                      const isOverdue = isActive && app.next_step_date && app.next_step_date < now;

                      return (
                        <Card
                          key={app._id}
                          className={cn(
                            'hover:shadow-md transition-shadow',
                            isOverdue && 'border-orange-400 bg-orange-50',
                          )}
                        >
                          <CardContent className="p-4 space-y-3">
                            {/* Company & Position */}
                            <div>
                              <div className="flex items-start gap-2 mb-1">
                                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-sm truncate">
                                    {app.company_name}
                                  </h4>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {app.position_title}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Student */}
                            <div className="flex items-center gap-2 text-xs">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground truncate">
                                {app.student_name}
                              </span>
                            </div>

                            {/* Applied Date */}
                            {app.applied_date && !isNaN(new Date(app.applied_date).getTime()) && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                Applied {format(new Date(app.applied_date), 'MMM d')}
                              </div>
                            )}

                            {/* Next Step */}
                            {app.next_step && isActive && (
                              <div
                                className={cn(
                                  'text-xs p-2 rounded',
                                  isOverdue
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-blue-50 text-blue-700',
                                )}
                              >
                                <div className="flex items-center gap-1 mb-1">
                                  <ArrowRight className="h-3 w-3" />
                                  <span className="font-medium">Next:</span>
                                </div>
                                <div className="truncate">{app.next_step}</div>
                                {app.next_step_date &&
                                  !isNaN(new Date(app.next_step_date).getTime()) && (
                                    <div className="text-xs mt-1">
                                      {format(new Date(app.next_step_date), 'MMM d')}
                                      {isOverdue && ' (Overdue)'}
                                    </div>
                                  )}
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex flex-col gap-2 pt-2 border-t">
                              <div className="flex gap-2">
                                <Link href={`/advisor/students/${app.user_id}`} className="flex-1">
                                  <Button variant="outline" size="sm" className="w-full">
                                    View Student
                                  </Button>
                                </Link>
                                {app.application_url && isValidHttpUrl(app.application_url) && (
                                  <a
                                    href={app.application_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={`Open application for ${app.company_name} in new tab`}
                                  >
                                    <Button variant="ghost" size="sm">
                                      <ExternalLink className="h-4 w-4" />
                                      <span className="sr-only">Open application</span>
                                    </Button>
                                  </a>
                                )}
                              </div>
                              {clerkId && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="w-full"
                                  onClick={() => handleStageChange(app)}
                                >
                                  <RefreshCw className="h-3 w-3 mr-1" />
                                  Change Stage
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
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
