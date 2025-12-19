'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertCircle, ExternalLink } from 'lucide-react';
import { forwardRef, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

import { KanbanCardMenu } from './KanbanCardMenu';
import { KanbanCardNextStep } from './KanbanCardNextStep';
import type { ApplicationStatus, KanbanApplication } from './types';

interface KanbanCardProps {
  application: KanbanApplication;
  onClick?: () => void;
  onMoveTo?: (status: ApplicationStatus) => void;
  isDragOverlay?: boolean;
}

/**
 * Notion-style compact Kanban card for applications.
 * Entire card is draggable with enhanced visual feedback.
 */
export const KanbanCard = forwardRef<HTMLDivElement, KanbanCardProps>(
  ({ application, onClick, onMoveTo, isDragOverlay = false }, ref) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: application._id,
      disabled: isDragOverlay,
    });

    // Track if we started dragging to prevent click
    const [wasDragging, setWasDragging] = useState(false);

    useEffect(() => {
      if (isDragging) {
        setWasDragging(true);
      }
    }, [isDragging]);

    useEffect(() => {
      if (!isDragging && wasDragging) {
        const timeout = setTimeout(() => setWasDragging(false), 100);
        return () => clearTimeout(timeout);
      }
    }, [isDragging, wasDragging]);

    const handleClick = () => {
      if (wasDragging) {
        setWasDragging(false);
        return;
      }
      onClick?.();
    };

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

    const needsReview = application.review_status === 'needs_review';

    return (
      <div
        ref={isDragOverlay ? ref : setNodeRef}
        style={isDragOverlay ? undefined : style}
        className={cn(
          'bg-white rounded-lg border p-3 cursor-pointer group relative',
          'hover:border-primary-300 hover:shadow-sm transition-all duration-150',
          // Source card ghost effect during drag
          isDragging && 'opacity-30 border-dashed border-2 border-slate-300 bg-slate-50',
          // Drag overlay - floating card being dragged
          isDragOverlay && 'shadow-lg rotate-1 scale-[1.02] border-primary-300 cursor-grabbing',
          // Needs review highlight - amber border and subtle background
          needsReview && !isDragging && 'border-amber-400 border-2 bg-amber-50/50',
        )}
        onClick={isDragOverlay ? undefined : handleClick}
        onKeyDown={
          isDragOverlay
            ? undefined
            : (e) => {
                if (e.key === 'Enter' && !wasDragging) {
                  onClick?.();
                }
              }
        }
        role="button"
        tabIndex={isDragOverlay ? -1 : 0}
        aria-roledescription="Draggable application card"
        aria-describedby={isDragOverlay ? undefined : `card-instructions-${application._id}`}
        {...(isDragOverlay ? {} : { ...attributes, ...listeners })}
      >
        {/* Screen reader instructions */}
        {!isDragOverlay && (
          <span id={`card-instructions-${application._id}`} className="sr-only">
            Press space to pick up. Arrow keys to move. Space to drop. Escape to cancel.
          </span>
        )}

        {/* Move to menu - top right corner */}
        {!isDragOverlay && onMoveTo && (
          <div className="absolute top-2 right-2 z-10">
            <KanbanCardMenu currentStatus={application.status} onMoveTo={onMoveTo} />
          </div>
        )}

        {/* Content */}
        <div className="min-w-0 pr-6">
          {/* Company name - bold */}
          <div className="flex items-center gap-1.5">
            {needsReview && (
              <AlertCircle
                className="h-3.5 w-3.5 text-amber-500 flex-shrink-0"
                aria-label="Needs review"
              />
            )}
            <span className="font-medium text-sm text-slate-900 truncate">
              {application.company}
            </span>
          </div>

          {/* Role title - subtle */}
          <div className="text-xs text-slate-500 truncate mt-0.5">{application.job_title}</div>

          {/* Next step context */}
          <KanbanCardNextStep application={application} />

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
                aria-label="View job posting"
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
    );
  },
);

KanbanCard.displayName = 'KanbanCard';
