'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface SectionOutlineItemProps {
  sectionId: string;
  label: string;
  selected: boolean;
  enabled: boolean;
  suggestionCount: number;
  required?: boolean;
  onSelect: () => void;
  onToggle: (enabled: boolean) => void;
}

export function SectionOutlineItem({
  sectionId,
  label,
  selected,
  enabled,
  suggestionCount,
  required,
  onSelect,
  onToggle,
}: SectionOutlineItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sectionId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all',
        'hover:bg-slate-50',
        selected && 'bg-primary-50 border border-primary-200',
        isDragging && 'opacity-50 shadow-lg bg-white z-50',
        !enabled && 'opacity-60',
      )}
      onClick={onSelect}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className={cn(
          'cursor-grab active:cursor-grabbing p-1 -ml-1 rounded',
          'text-slate-400 hover:text-slate-600 hover:bg-slate-100',
          'focus:outline-none focus:ring-2 focus:ring-primary-500',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Label */}
      <span
        className={cn('flex-1 text-sm truncate', enabled ? 'text-slate-900' : 'text-slate-400')}
      >
        {label}
      </span>

      {/* Suggestion count badge */}
      {suggestionCount > 0 && enabled && (
        <Badge
          variant="secondary"
          className="bg-amber-100 text-amber-700 hover:bg-amber-100 px-1.5 py-0 h-5 text-xs"
        >
          {suggestionCount}
        </Badge>
      )}

      {/* Toggle switch */}
      {!required && (
        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          className="scale-75"
        />
      )}
    </div>
  );
}
