'use client';

import { useCallback, useRef } from 'react';
import { toast } from 'sonner';

import { type ApplicationStatus, STATUS_CONFIGS } from '@/components/applications/kanban/types';

interface MoveState {
  applicationId: string;
  company: string;
  fromStatus: ApplicationStatus;
  toStatus: ApplicationStatus;
}

interface UseKanbanUndoOptions {
  onUndo: (applicationId: string, status: ApplicationStatus) => Promise<void>;
  undoTimeout?: number;
}

// Helper to get status label for toast messages
function getStatusLabel(status: ApplicationStatus): string {
  return STATUS_CONFIGS.find((s) => s.id === status)?.label || status;
}

/**
 * Hook for managing undo functionality for Kanban card moves.
 * Shows a toast notification with an undo button after each move.
 */
export function useKanbanUndo({ onUndo, undoTimeout = 6000 }: UseKanbanUndoOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const recordMove = useCallback(
    (move: MoveState) => {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Show toast with undo action
      toast(`Moved ${move.company} to ${getStatusLabel(move.toStatus)}`, {
        duration: undoTimeout,
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await onUndo(move.applicationId, move.fromStatus);
              toast.success(`Moved ${move.company} back to ${getStatusLabel(move.fromStatus)}`);
            } catch {
              toast.error('Failed to undo move');
            }
          },
        },
      });

      // Auto-clear after timeout
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
      }, undoTimeout);
    },
    [onUndo, undoTimeout],
  );

  return { recordMove };
}
