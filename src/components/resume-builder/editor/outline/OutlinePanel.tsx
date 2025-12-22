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

import type {
  Education,
  Experience,
  Project,
  ResumeData,
} from '@/components/resume/ResumeDocument';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SECTION_CONFIGS } from '@/types/resume-editor';

import { type SectionItem, SectionOutlineItem } from './SectionOutlineItem';

interface OutlinePanelProps {
  sectionOrder: string[];
  enabledSections: string[];
  selectedSectionId: string | null;
  selectedItemId: string | null;
  resumeData: ResumeData;
  onSelectSection: (sectionId: string) => void;
  onSelectItem: (sectionId: string, itemId: string) => void;
  onReorderSections: (newOrder: string[]) => void;
  onAddSection: (sectionId: string) => void;
  onAddExperience: () => void;
  onDeleteExperience: (id: string) => void;
  onAddEducation: () => void;
  onDeleteEducation: (id: string) => void;
  onAddProject: () => void;
  onDeleteProject: (id: string) => void;
}

// Helper to get section items
function getSectionItems(sectionId: string, resumeData: ResumeData): SectionItem[] | undefined {
  switch (sectionId) {
    case 'experience':
      return resumeData.experience?.map((exp: Experience) => ({
        id: exp.id,
        label: exp.title || 'Untitled Position',
        sublabel: exp.company || undefined,
      }));
    case 'education':
      return resumeData.education?.map((edu: Education) => ({
        id: edu.id,
        label: edu.school || 'Untitled School',
        sublabel: edu.degree ? `${edu.degree}${edu.field ? ` in ${edu.field}` : ''}` : undefined,
      }));
    case 'projects':
      return resumeData.projects?.map((proj: Project) => ({
        id: proj.id,
        label: proj.name || 'Untitled Project',
        sublabel: proj.role || undefined,
      }));
    default:
      return undefined;
  }
}

// Check if section supports multiple items
function sectionHasItems(sectionId: string): boolean {
  return ['experience', 'education', 'projects'].includes(sectionId);
}

export function OutlinePanel({
  sectionOrder,
  enabledSections,
  selectedSectionId,
  selectedItemId,
  resumeData,
  onSelectSection,
  onSelectItem,
  onReorderSections,
  onAddSection,
  onAddExperience,
  onDeleteExperience,
  onAddEducation,
  onDeleteEducation,
  onAddProject,
  onDeleteProject,
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

  // Only show enabled sections in the order they appear in sectionOrder
  const visibleSections = sectionOrder.filter((id) => enabledSections.includes(id));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = visibleSections.indexOf(active.id as string);
      const newIndex = visibleSections.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;
      const newVisibleOrder = arrayMove(visibleSections, oldIndex, newIndex);
      // Rebuild full section order: keep disabled sections at their positions, reorder visible ones
      const disabledSections = sectionOrder.filter((id) => !enabledSections.includes(id));
      onReorderSections([...newVisibleOrder, ...disabledSections]);
    }
  };

  // Get available sections that can be added
  const availableSections = Object.values(SECTION_CONFIGS).filter(
    (config) => !enabledSections.includes(config.id) && config.id !== 'contact',
  );

  // Get handlers for adding/deleting items based on section
  const getItemHandlers = (sectionId: string) => {
    switch (sectionId) {
      case 'experience':
        return {
          onAddItem: onAddExperience,
          onDeleteItem: onDeleteExperience,
        };
      case 'education':
        return {
          onAddItem: onAddEducation,
          onDeleteItem: onDeleteEducation,
        };
      case 'projects':
        return {
          onAddItem: onAddProject,
          onDeleteItem: onDeleteProject,
        };
      default:
        return {};
    }
  };

  return (
    <div className="flex flex-col h-full overflow-x-hidden">
      {/* Hint text */}
      <div className="px-3 py-2">
        <p className="text-xs text-slate-500">Drag to reorder sections</p>
      </div>

      {/* Section list */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar px-2 pb-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleSections} strategy={verticalListSortingStrategy}>
            {visibleSections.map((sectionId) => {
              const config = Object.values(SECTION_CONFIGS).find((value) => value.id === sectionId);
              if (!config) return null;

              const items = getSectionItems(sectionId, resumeData);
              const handlers = sectionHasItems(sectionId) ? getItemHandlers(sectionId) : {};

              return (
                <SectionOutlineItem
                  key={sectionId}
                  sectionId={sectionId}
                  label={config.label}
                  selected={sectionId === selectedSectionId}
                  onSelect={() => onSelectSection(sectionId)}
                  items={items}
                  selectedItemId={selectedSectionId === sectionId ? selectedItemId : null}
                  onSelectItem={(itemId) => onSelectItem(sectionId, itemId)}
                  {...handlers}
                />
              );
            })}
          </SortableContext>
        </DndContext>
      </div>

      {/* Add section button */}
      {availableSections.length > 0 && (
        <div className="px-3 py-2 border-t border-slate-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-slate-600 hover:text-slate-900"
              >
                <Plus className="h-4 w-4" />
                <span>Add Section</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
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
