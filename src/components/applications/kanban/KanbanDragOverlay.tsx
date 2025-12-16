'use client';

import { DragOverlay } from '@dnd-kit/core';

import { KanbanCard } from './KanbanCard';
import type { KanbanApplication } from './types';

interface KanbanDragOverlayProps {
  activeApplication: KanbanApplication | null;
}

/**
 * Drag overlay component that shows a preview of the card being dragged.
 * Uses a portal to render above all other content.
 */
export function KanbanDragOverlay({ activeApplication }: KanbanDragOverlayProps) {
  return (
    <DragOverlay dropAnimation={null}>
      {activeApplication ? (
        <div className="w-64">
          <KanbanCard application={activeApplication} isDragOverlay />
        </div>
      ) : null}
    </DragOverlay>
  );
}
