'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useCallback, useState } from 'react';
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
}

/**
 * Main Kanban board component with drag-and-drop functionality.
 * Handles drag events and coordinates with the backend.
 */
export function ApplicationKanbanBoard({
  applications,
  onMove,
  onCardClick,
  onQuickAdd,
}: ApplicationKanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Configure sensors for pointer and keyboard interaction
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum drag distance before activation
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Find the active application being dragged
  const activeApplication = activeId
    ? (Object.values(applications)
        .flat()
        .find((app) => app._id === activeId) ?? null)
    : null;

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  // Handle drag over (for visual feedback)
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    setOverId((over?.id as string) ?? null);
  }, []);

  // Handle drag end (actual move)
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      setActiveId(null);
      setOverId(null);

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
        // Adjust target index if source comes before target
        const adjustedTargetIndex = sourceIndex < targetIndex ? targetIndex : targetIndex;

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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[400px]">
        {STATUS_CONFIGS.map((config) => (
          <KanbanColumn
            key={config.id}
            config={config}
            applications={applications[config.id] || []}
            onCardClick={onCardClick}
            onQuickAdd={onQuickAdd}
          />
        ))}
      </div>

      <KanbanDragOverlay activeApplication={activeApplication} />
    </DndContext>
  );
}
