'use client';

import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { KanbanColumn } from './KanbanColumn';
import { KanbanDragOverlay } from './KanbanDragOverlay';
import type { ApplicationStatus, KanbanApplication } from './types';
import { STATUS_CONFIGS } from './types';

interface ApplicationKanbanBoardProps {
  applications: Record<ApplicationStatus, KanbanApplication[]>;
  onMove: (
    applicationId: string,
    newStatus: ApplicationStatus,
    beforeId?: string,
    afterId?: string,
  ) => Promise<void>;
  onCardClick: (application: KanbanApplication) => void;
  onQuickAdd: (status: ApplicationStatus) => void;
  onCompleteFollowup?: (followupId: string) => Promise<void>;
}

// Helper to get status label for announcements
function getStatusLabel(status: ApplicationStatus): string {
  return STATUS_CONFIGS.find((s) => s.id === status)?.label || status;
}

/**
 * Main Kanban board component with drag-and-drop functionality.
 * Features touch support, accessibility announcements, and keyboard navigation.
 */
export function ApplicationKanbanBoard({
  applications,
  onMove,
  onCardClick,
  onQuickAdd,
  onCompleteFollowup,
}: ApplicationKanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // Configure sensors for mouse, touch, and keyboard interaction
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 8, // Minimum drag distance before activation
    },
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 300, // Long-press delay for touch devices
      tolerance: 5, // Allow small movement during delay
    },
  });

  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });

  const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor);

  // Find the active application being dragged
  const activeApplication = activeId
    ? (Object.values(applications)
        .flat()
        .find((app) => app._id === activeId) ?? null)
    : null;

  // Helper to find an application by ID
  const findApplication = useCallback(
    (id: string): { app: KanbanApplication; status: ApplicationStatus } | undefined => {
      for (const [status, apps] of Object.entries(applications)) {
        const app = apps.find((a) => a._id === id);
        if (app) return { app, status: status as ApplicationStatus };
      }
      return undefined;
    },
    [applications],
  );

  // Accessibility announcements for screen readers
  const announcements: Announcements = useMemo(
    () => ({
      onDragStart({ active }) {
        const found = findApplication(active.id as string);
        if (!found) return;
        return `Picked up ${found.app.company}. Current column: ${getStatusLabel(found.status)}. Use arrow keys to move.`;
      },
      onDragOver({ active, over }) {
        const found = findApplication(active.id as string);
        if (!found || !over) return;

        const overId = over.id as string;
        if (overId.startsWith('column-')) {
          const status = overId.replace('column-', '') as ApplicationStatus;
          return `${found.app.company} is over ${getStatusLabel(status)} column.`;
        }
        return undefined;
      },
      onDragEnd({ active, over }) {
        const found = findApplication(active.id as string);
        if (!found) return;

        if (!over) {
          return `${found.app.company} was dropped. Movement cancelled.`;
        }

        const overId = over.id as string;
        let targetStatus: ApplicationStatus = found.status;
        if (overId.startsWith('column-')) {
          targetStatus = overId.replace('column-', '') as ApplicationStatus;
        } else {
          // Find which column the target card is in
          const targetFound = findApplication(overId);
          if (targetFound) {
            targetStatus = targetFound.status;
          }
        }

        if (targetStatus === found.status) {
          return `${found.app.company} was reordered within ${getStatusLabel(found.status)}.`;
        }
        return `${found.app.company} was moved to ${getStatusLabel(targetStatus)}.`;
      },
      onDragCancel({ active }) {
        const found = findApplication(active.id as string);
        if (!found) return;
        return `Movement cancelled. ${found.app.company} returned to ${getStatusLabel(found.status)}.`;
      },
    }),
    [findApplication],
  );

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  // Handle drag over - no-op, kept for potential future enhancements
  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // Visual feedback is handled by @dnd-kit's built-in styling
  }, []);

  // Handle drag end (actual move)
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      setActiveId(null);

      if (!over) return;

      const activeAppId = active.id as string;
      const overId = over.id as string;

      // Determine target status from drop location
      let targetStatus: ApplicationStatus | null = null;
      let targetIndex = -1;

      // Check if dropped on a column
      if (overId.startsWith('column-')) {
        targetStatus = overId.replace('column-', '') as ApplicationStatus;
        // Dropped on column = add at end
        targetIndex = applications[targetStatus]?.length ?? 0;
      } else {
        // Dropped on another card - find which column it's in
        for (const [status, apps] of Object.entries(applications)) {
          const index = apps.findIndex((app) => app._id === overId);
          if (index !== -1) {
            targetStatus = status as ApplicationStatus;
            targetIndex = index;
            break;
          }
        }
      }

      if (!targetStatus) return;

      // Find the source application
      let sourceStatus: ApplicationStatus | null = null;
      let sourceIndex = -1;
      for (const [status, apps] of Object.entries(applications)) {
        const index = apps.findIndex((app) => app._id === activeAppId);
        if (index !== -1) {
          sourceStatus = status as ApplicationStatus;
          sourceIndex = index;
          break;
        }
      }

      if (!sourceStatus) return;

      // If same position, do nothing
      if (sourceStatus === targetStatus && sourceIndex === targetIndex) return;

      // Calculate beforeId and afterId for ordering
      const targetApps = applications[targetStatus];
      let beforeId: string | undefined;
      let afterId: string | undefined;

      // If moving within the same column, account for the item being removed
      if (sourceStatus === targetStatus) {
        // Adjust target index if source comes before target so removal shifts indexing
        const adjustedTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;

        // Get neighbors at the target position
        const filteredApps = targetApps.filter((app) => app._id !== activeAppId);
        if (adjustedTargetIndex > 0) {
          beforeId = filteredApps[adjustedTargetIndex - 1]?._id;
        }
        if (adjustedTargetIndex < filteredApps.length) {
          afterId = filteredApps[adjustedTargetIndex]?._id;
        }
      } else {
        // Moving to a different column
        if (targetIndex > 0) {
          beforeId = targetApps[targetIndex - 1]?._id;
        }
        if (targetIndex < targetApps.length) {
          afterId = targetApps[targetIndex]?._id;
        }
      }

      try {
        await onMove(activeAppId, targetStatus, beforeId, afterId);
      } catch (error) {
        console.error('Failed to move application:', error);
        toast.error('Failed to move application. Please try again.');
      }
    },
    [applications, onMove],
  );

  // Handle menu-based moves (Move to dropdown)
  const handleMenuMove = useCallback(
    async (applicationId: string, newStatus: ApplicationStatus) => {
      try {
        // Move to end of target column
        const targetApps = applications[newStatus] || [];
        const lastApp = targetApps[targetApps.length - 1];
        await onMove(applicationId, newStatus, lastApp?._id, undefined);
      } catch (error) {
        console.error('Failed to move application:', error);
        toast.error('Failed to move application. Please try again.');
      }
    },
    [applications, onMove],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      accessibility={{ announcements }}
    >
      {/* Outer container constrains width, inner container scrolls horizontally */}
      <div className="w-full overflow-hidden">
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[400px] no-scrollbar">
          {STATUS_CONFIGS.map((config) => (
            <KanbanColumn
              key={config.id}
              config={config}
              applications={applications[config.id] || []}
              onCardClick={onCardClick}
              onQuickAdd={onQuickAdd}
              onMoveTo={handleMenuMove}
              onCompleteFollowup={onCompleteFollowup}
            />
          ))}
        </div>
      </div>

      <KanbanDragOverlay activeApplication={activeApplication} />
    </DndContext>
  );
}
