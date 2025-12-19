'use client';

import { DragOverlay } from '@dnd-kit/core';

import { KanbanCard } from './KanbanCard';
import type { KanbanApplication } from './types';

interface KanbanDragOverlayProps {
  activeApplication: KanbanApplication | null;
}

/**
 * Drag overlay component that shows a preview of the card being dragged.
 * Uses a portal to render above all other content with smooth drop animation.
 */
export function KanbanDragOverlay({ activeApplication }: KanbanDragOverlayProps) {
  return (
    <DragOverlay
      dropAnimation={{
        duration: 200,
        easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
      }}
    >
      {activeApplication ? (
        <div className="w-64">
          <KanbanCard application={activeApplication} isDragOverlay />
        </div>
      ) : null}
    </DragOverlay>
  );
}
