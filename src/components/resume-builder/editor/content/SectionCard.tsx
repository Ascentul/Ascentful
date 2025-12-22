'use client';

import { ChevronDown, ChevronUp, GripVertical, Trash2 } from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SectionCardProps {
  title: string;
  children: React.ReactNode;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  isEmpty?: boolean;
  dragHandleProps?: ComponentPropsWithoutRef<'div'>;
}

export function SectionCard({
  title,
  children,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
  isEmpty = false,
  dragHandleProps,
}: SectionCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div
      className={cn(
        'bg-white rounded-lg border transition-colors',
        isEmpty ? 'border-dashed border-slate-300' : 'border-slate-200',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        {/* Drag handle */}
        <div
          {...dragHandleProps}
          className="cursor-grab text-slate-400 hover:text-slate-600 active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Title */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <span className="font-medium text-slate-900">{title}</span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </button>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {onMoveUp && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              className="h-7 w-7 text-slate-400 hover:text-slate-600"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          )}
          {onMoveDown && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              className="h-7 w-7 text-slate-400 hover:text-slate-600"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="h-7 w-7 text-slate-400 hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && <div className="p-4">{children}</div>}
    </div>
  );
}
