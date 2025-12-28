'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronRight, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Map section labels to their singular forms for the "Add" button
const SINGULAR_LABELS: Record<string, string> = {
  Experience: 'experience',
  Education: 'education',
  Projects: 'project',
  Skills: 'skill',
  Achievements: 'achievement',
  Certifications: 'certification',
  Summary: 'summary',
};

function getSingularLabel(label: string): string {
  return SINGULAR_LABELS[label] ?? label.replace(/s$/, '').toLowerCase();
}

export interface SectionItem {
  id: string;
  label: string;
  sublabel?: string;
}

interface SectionOutlineItemProps {
  sectionId: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
  // For sections with multiple items (experience, education, projects)
  items?: SectionItem[];
  selectedItemId?: string | null;
  onSelectItem?: (itemId: string) => void;
  onAddItem?: () => void;
  onDeleteItem?: (itemId: string) => void;
  // Controlled expand state (lifted to parent for accordion behavior)
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function SectionOutlineItem({
  sectionId,
  label,
  selected,
  onSelect,
  items,
  selectedItemId,
  onSelectItem,
  onAddItem,
  onDeleteItem,
  isExpanded: controlledIsExpanded,
  onToggleExpand,
}: SectionOutlineItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sectionId,
  });

  // Use controlled state if provided, otherwise fall back to local state
  const [localIsExpanded, setLocalIsExpanded] = useState(false);
  const isExpanded = controlledIsExpanded !== undefined ? controlledIsExpanded : localIsExpanded;

  const hasItems = items && items.length > 0;
  const canExpand = hasItems || onAddItem;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canExpand) {
      if (onToggleExpand) {
        onToggleExpand();
      } else {
        setLocalIsExpanded(!localIsExpanded);
      }
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && 'opacity-50 shadow-lg bg-white z-50')}
    >
      {/* Section header */}
      <div
        className={cn(
          'flex items-center gap-1 p-2 rounded-lg cursor-pointer transition-all',
          'hover:bg-slate-50',
          selected && !selectedItemId && 'bg-primary-50 border border-primary-200',
        )}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect();
          }
        }}
        role="button"
        tabIndex={0}
      >
        {/* Drag handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className={cn(
            'cursor-grab active:cursor-grabbing p-1 -ml-1 rounded flex-shrink-0',
            'text-slate-400 hover:text-slate-600 hover:bg-slate-100',
            'focus:outline-none focus:ring-2 focus:ring-primary-500',
          )}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Drag to reorder ${label}`}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Expand/collapse button for sections with items */}
        {canExpand ? (
          <button
            type="button"
            onClick={handleToggleExpand}
            className="p-0.5 rounded text-slate-400 hover:text-slate-600 flex-shrink-0"
            aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <div className="w-4" /> // Spacer for alignment
        )}

        {/* Label */}
        <span className="flex-1 text-sm truncate text-slate-900 font-medium">{label}</span>

        {/* Item count badge */}
        {hasItems && (
          <span className="text-xs text-slate-400 px-1.5 py-0.5 bg-slate-100 rounded-full">
            {items.length}
          </span>
        )}
      </div>

      {/* Nested items */}
      {canExpand && isExpanded && (
        <div className="ml-6 mt-1 mb-2 space-y-1">
          {/* Existing items */}
          {items?.map((item) => (
            <div
              key={item.id}
              className={cn(
                'group flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-all',
                'hover:bg-slate-50',
                selectedItemId === item.id && 'bg-primary-50 border border-primary-200',
              )}
              onClick={(e) => {
                e.stopPropagation();
                onSelectItem?.(item.id);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectItem?.(item.id);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-700 truncate">{item.label || 'Untitled'}</div>
                {item.sublabel && (
                  <div className="text-xs text-slate-400 truncate">{item.sublabel}</div>
                )}
              </div>
              {/* Delete button */}
              {onDeleteItem && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteItem(item.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                  aria-label={`Delete ${item.label || 'item'}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}

          {/* Add item button */}
          {onAddItem && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-1.5 h-8 text-primary-600 hover:text-primary-700 hover:bg-primary-50"
              onClick={(e) => {
                e.stopPropagation();
                onAddItem();
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Add {getSingularLabel(label)}</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
