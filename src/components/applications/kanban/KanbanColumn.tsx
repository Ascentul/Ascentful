'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { KanbanCard } from './KanbanCard';
import type { KanbanApplication, StatusConfig } from './types';

interface KanbanColumnProps {
  config: StatusConfig;
  applications: KanbanApplication[];
  onCardClick: (application: KanbanApplication) => void;
  onQuickAdd: (status: StatusConfig['id']) => void;
}

/**
 * A single column in the Kanban board representing an application status.
 * Uses @dnd-kit for drag-and-drop functionality.
 */
export function KanbanColumn({ config, applications, onCardClick, onQuickAdd }: KanbanColumnProps) {
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
        isOver && 'ring-2 ring-primary-500 ring-offset-2',
      )}
    >
      {/* Column Header */}
      <div className="p-3 border-b border-inherit flex items-center justify-between">
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
            <KanbanCard key={app._id} application={app} onClick={() => onCardClick(app)} />
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
