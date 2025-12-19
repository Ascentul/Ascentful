'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { KanbanCard } from './KanbanCard';
import type { ApplicationStatus, KanbanApplication, StatusConfig } from './types';

interface KanbanColumnProps {
  config: StatusConfig;
  applications: KanbanApplication[];
  onCardClick: (application: KanbanApplication) => void;
  onQuickAdd: (status: StatusConfig['id']) => void;
  onMoveTo?: (applicationId: string, status: ApplicationStatus) => void;
  onCompleteFollowup?: (followupId: string) => Promise<void>;
}

/**
 * A single column in the Kanban board representing an application status.
 * Features sticky header and enhanced drop feedback.
 */
export function KanbanColumn({
  config,
  applications,
  onCardClick,
  onQuickAdd,
  onMoveTo,
  onCompleteFollowup,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${config.id}`,
    data: {
      type: 'column',
      status: config.id,
    },
  });

  return (
    <div
      className={cn(
        'flex-shrink-0 w-72 rounded-xl border flex flex-col',
        config.color,
        config.borderColor,
        // Enhanced hover state when dragging over
        isOver && 'bg-primary-50/30 ring-1 ring-primary-200',
      )}
    >
      {/* Sticky Column Header */}
      <div className="sticky top-0 z-10 p-3 border-b border-inherit bg-inherit backdrop-blur-sm flex items-center justify-between rounded-t-xl">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-slate-700">{config.label}</span>
          <span className="text-xs text-slate-500 bg-white/80 px-2 py-0.5 rounded-full border border-slate-200">
            {applications.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-white/50"
          onClick={() => onQuickAdd(config.id)}
          title={`Add application to ${config.label}`}
          aria-label={`Add application to ${config.label}`}
        >
          <Plus className="h-4 w-4 text-slate-500" />
        </Button>
      </div>

      {/* Cards Container - Scrollable */}
      <div
        ref={setNodeRef}
        className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px] max-h-[calc(100vh-320px)]"
      >
        <SortableContext
          items={applications.map((app) => app._id)}
          strategy={verticalListSortingStrategy}
        >
          {applications.map((app) => (
            <KanbanCard
              key={app._id}
              application={app}
              onClick={() => onCardClick(app)}
              onMoveTo={onMoveTo ? (status) => onMoveTo(String(app._id), status) : undefined}
              onCompleteFollowup={onCompleteFollowup}
            />
          ))}
        </SortableContext>

        {/* Empty State */}
        {applications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-slate-400 mb-2">No applications</p>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => onQuickAdd(config.id)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add one
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
