'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ExternalLink, GripVertical } from 'lucide-react';
import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

import type { KanbanApplication } from './types';

interface KanbanCardProps {
  application: KanbanApplication;
  onClick?: () => void;
  isDragOverlay?: boolean;
}

/**
 * Notion-style compact Kanban card for applications.
 * Clean, minimal design with company name, role, and metadata.
 */
export const KanbanCard = forwardRef<HTMLDivElement, KanbanCardProps>(
  ({ application, onClick, isDragOverlay = false }, ref) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: application._id,
      disabled: isDragOverlay,
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    // Format date for display
    const formatDate = (timestamp: number) => {
      return new Date(timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    };

    return (
      <div
        ref={isDragOverlay ? ref : setNodeRef}
        style={isDragOverlay ? undefined : style}
        className={cn(
          'bg-white rounded-lg border p-3 cursor-pointer group',
          'hover:border-primary-300 hover:shadow-sm transition-all duration-150',
          isDragging && 'opacity-50 shadow-lg ring-2 ring-primary-500',
          isDragOverlay && 'shadow-xl rotate-2 scale-105 border-primary-400',
        )}
        onClick={isDragOverlay ? undefined : onClick}
        {...(isDragOverlay ? {} : attributes)}
      >
        <div className="flex items-start gap-2">
          {/* Drag handle */}
          <div
            className={cn(
              'flex-shrink-0 mt-0.5 cursor-grab active:cursor-grabbing',
              'opacity-0 group-hover:opacity-100 transition-opacity',
              isDragOverlay && 'opacity-100',
            )}
            {...(isDragOverlay ? {} : listeners)}
          >
            <GripVertical className="h-4 w-4 text-slate-400" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Company name - bold */}
            <div className="font-medium text-sm text-slate-900 truncate">{application.company}</div>

            {/* Role title - subtle */}
            <div className="text-xs text-slate-500 truncate mt-0.5">{application.job_title}</div>

            {/* Metadata row */}
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
              {/* External link */}
              {application.url && (
                <a
                  href={application.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-primary-500 transition-colors"
                  title="View job posting"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}

              {/* Location if available */}
              {application.location && (
                <span className="truncate max-w-[100px]">{application.location}</span>
              )}

              {/* Date */}
              <span className="ml-auto">{formatDate(application.updated_at)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

KanbanCard.displayName = 'KanbanCard';
