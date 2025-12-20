'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertCircle, CheckSquare, ChevronDown, ChevronUp, Square } from 'lucide-react';
import { forwardRef, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

import { KanbanCardMenu } from './KanbanCardMenu';
import { KanbanCardMeta } from './KanbanCardMeta';
import type { ApplicationStatus, KanbanApplication } from './types';

interface KanbanCardProps {
  application: KanbanApplication;
  onClick?: () => void;
  onMoveTo?: (status: ApplicationStatus) => void;
  onCompleteFollowup?: (followupId: string) => Promise<void>;
  isDragOverlay?: boolean;
}

// Helper: format due label for follow-up preview
function formatDueLabel(dueAt: number, isOverdue: boolean): string {
  if (isOverdue) return 'Overdue';
  const now = Date.now();
  const diff = dueAt - now;
  // Guard against stale data where dueAt is past but isOverdue wasn't updated
  if (diff < 0) return 'Overdue';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

// Props for FollowupPreview component
interface FollowupPreviewProps {
  actionSummary: NonNullable<KanbanApplication['actionSummary']>;
  followupsExpanded: boolean;
  onToggleExpanded: () => void;
  completingFollowup: string | null;
  onCompleteFollowup?: (actionId: string) => Promise<void>;
}

/**
 * Renders the follow-up actions preview section of a Kanban card.
 * Extracted for readability and single responsibility.
 */
function FollowupPreview({
  actionSummary,
  followupsExpanded,
  onToggleExpanded,
  completingFollowup,
  onCompleteFollowup,
}: FollowupPreviewProps) {
  const allActions = actionSummary.allActions || [];
  const actionsToShow = followupsExpanded
    ? allActions
    : actionSummary.preview
      ? [actionSummary.preview]
      : [];
  const hasMore = allActions.length > 1;

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <div className="space-y-2">
        {actionsToShow.map((action) => (
          <div key={action.id} className="flex items-start gap-2">
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                if (!onCompleteFollowup || completingFollowup) return;
                await onCompleteFollowup(action.id);
              }}
              disabled={!!completingFollowup}
              className={cn(
                'flex-shrink-0 mt-0.5 transition-colors',
                completingFollowup === action.id
                  ? 'text-green-500'
                  : 'text-slate-400 hover:text-green-500',
              )}
              title="Mark as complete"
              aria-label="Mark follow-up as complete"
            >
              {completingFollowup === action.id ? (
                <CheckSquare className="h-3.5 w-3.5" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  'text-xs truncate',
                  action.isOverdue ? 'text-red-600 font-medium' : 'text-slate-600',
                )}
              >
                {action.title}
              </div>
              {action.dueAt && (
                <div
                  className={cn(
                    'text-[10px] mt-0.5',
                    action.isOverdue ? 'text-red-500' : 'text-slate-400',
                  )}
                >
                  {formatDueLabel(action.dueAt, action.isOverdue)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpanded();
          }}
          className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 mt-1.5 ml-5 transition-colors"
        >
          {followupsExpanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />+{allActions.length - 1} more
            </>
          )}
        </button>
      )}
    </div>
  );
}

/**
 * Notion-style compact Kanban card for applications.
 * Entire card is draggable with enhanced visual feedback.
 */
export const KanbanCard = forwardRef<HTMLDivElement, KanbanCardProps>(
  ({ application, onClick, onMoveTo, onCompleteFollowup, isDragOverlay = false }, ref) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: application._id,
      disabled: isDragOverlay,
    });

    // Track if we started dragging to prevent click
    const [wasDragging, setWasDragging] = useState(false);
    // Track completing state for optimistic UI
    const [completingFollowup, setCompletingFollowup] = useState<string | null>(null);
    // Track expanded state for follow-ups
    const [followupsExpanded, setFollowupsExpanded] = useState(false);

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

    const needsReview = application.review_status === 'needs_review';

    return (
      <div
        ref={isDragOverlay ? ref : setNodeRef}
        style={isDragOverlay ? undefined : style}
        className={cn(
          'bg-white rounded-xl border border-slate-200 px-4 py-3.5 cursor-pointer group relative',
          'hover:border-slate-300 hover:shadow-sm transition-all duration-150',
          // Source card ghost effect during drag
          isDragging && 'opacity-30 border-dashed border-2 border-slate-300 bg-slate-50',
          // Drag overlay - floating card being dragged
          isDragOverlay && 'shadow-lg rotate-1 scale-[1.02] border-slate-300 cursor-grabbing',
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
          <div className="absolute top-3 right-3 z-10">
            <KanbanCardMenu currentStatus={application.status} onMoveTo={onMoveTo} />
          </div>
        )}

        {/* Content */}
        <div className="min-w-0 pr-7">
          {/* Company name - bold */}
          <div className="flex items-center gap-1.5">
            {needsReview && (
              <AlertCircle
                className="h-3.5 w-3.5 text-amber-500 flex-shrink-0"
                aria-label="Needs review"
              />
            )}
            <span className="font-semibold text-sm text-slate-900 truncate">
              {application.company}
            </span>
          </div>

          {/* Role title - subtle */}
          <div className="text-xs text-slate-500 truncate mt-1">{application.job_title}</div>

          {/* Interview stages - shows all scheduled interviews with dates */}
          {application.interviewSummary?.stages &&
            application.interviewSummary.stages.length > 0 && (
              <div className="mt-3">
                <KanbanCardMeta interviewSummary={application.interviewSummary} />
              </div>
            )}

          {/* Follow-up preview - shows incomplete follow-up actions */}
          {application.actionSummary?.preview && (
            <FollowupPreview
              actionSummary={application.actionSummary}
              followupsExpanded={followupsExpanded}
              onToggleExpanded={() => setFollowupsExpanded(!followupsExpanded)}
              completingFollowup={completingFollowup}
              onCompleteFollowup={
                onCompleteFollowup
                  ? async (actionId) => {
                      setCompletingFollowup(actionId);
                      try {
                        await onCompleteFollowup(actionId);
                      } finally {
                        setCompletingFollowup(null);
                      }
                    }
                  : undefined
              }
            />
          )}
        </div>
      </div>
    );
  },
);

KanbanCard.displayName = 'KanbanCard';
