'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SECTION_CONFIGS, type SuggestionCounts } from '@/types/resume-editor';

import { SectionOutlineItem } from './SectionOutlineItem';

interface OutlinePanelProps {
  sectionOrder: string[];
  enabledSections: string[];
  selectedSectionId: string | null;
  suggestionCounts: SuggestionCounts;
  onSelectSection: (sectionId: string) => void;
  onReorderSections: (newOrder: string[]) => void;
  onToggleSection: (sectionId: string, enabled: boolean) => void;
  onAddSection: (sectionId: string) => void;
}

export function OutlinePanel({
  sectionOrder,
  enabledSections,
  selectedSectionId,
  suggestionCounts,
  onSelectSection,
  onReorderSections,
  onToggleSection,
  onAddSection,
}: OutlinePanelProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sectionOrder.indexOf(active.id as string);
      const newIndex = sectionOrder.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;
      const newOrder = arrayMove(sectionOrder, oldIndex, newIndex);
      onReorderSections(newOrder);
    }
  };

  // Get available sections that can be added
  const availableSections = Object.values(SECTION_CONFIGS).filter(
    (config) => !enabledSections.includes(config.id) && config.id !== 'contact',
  );

  return (
    <div className="w-64 bg-white border-r border-slate-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <h2 className="font-semibold text-slate-900 text-sm">Sections</h2>
        <p className="text-xs text-slate-500 mt-1">Drag to reorder, toggle to show/hide</p>
      </div>

      {/* Section list */}
      <div className="flex-1 overflow-y-auto p-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
            {sectionOrder.map((sectionId) => {
              const config = Object.values(SECTION_CONFIGS).find((value) => value.id === sectionId);
              if (!config) return null;
              const suggestionCount =
                Object.entries(suggestionCounts).find(([key]) => key === sectionId)?.[1] ?? 0;

              return (
                <SectionOutlineItem
                  key={sectionId}
                  sectionId={sectionId}
                  label={config.label}
                  selected={sectionId === selectedSectionId}
                  enabled={enabledSections.includes(sectionId)}
                  suggestionCount={suggestionCount}
                  required={config.required}
                  onSelect={() => onSelectSection(sectionId)}
                  onToggle={(enabled) => onToggleSection(sectionId, enabled)}
                />
              );
            })}
          </SortableContext>
        </DndContext>
      </div>

      {/* Add section button */}
      {availableSections.length > 0 && (
        <div className="p-3 border-t border-slate-200">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-slate-600 hover:text-slate-900"
              >
                <Plus className="h-4 w-4" />
                <span>Add Section</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {availableSections.map((config) => (
                <DropdownMenuItem key={config.id} onClick={() => onAddSection(config.id)}>
                  {config.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
