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
import { useState } from 'react';

import type {
  Achievement,
  Certification,
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
  onAddAchievement?: () => void;
  onDeleteAchievement?: (id: string) => void;
  onAddCertification?: () => void;
  onDeleteCertification?: (id: string) => void;
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
    case 'achievements':
      return resumeData.achievements?.map((ach: Achievement) => ({
        id: ach.id,
        label: ach.title || 'Untitled Achievement',
        sublabel: ach.date || undefined,
      }));
    case 'certifications':
      return resumeData.certifications?.map((cert: Certification) => ({
        id: cert.id,
        label: cert.name || 'Untitled Certification',
        sublabel: cert.issuer || undefined,
      }));
    default:
      return undefined;
  }
}

// Check if section supports multiple items
function sectionHasItems(sectionId: string): boolean {
  return ['experience', 'education', 'projects', 'achievements', 'certifications'].includes(
    sectionId,
  );
}

const SECTION_CONFIG_MAP = Object.fromEntries(
  Object.values(SECTION_CONFIGS).map((config) => [config.id, config]),
);

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
  onAddAchievement,
  onDeleteAchievement,
  onAddCertification,
  onDeleteCertification,
}: OutlinePanelProps) {
  // Track which section is expanded (accordion behavior - only one at a time)
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);

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
      // Rebuild full section order while preserving disabled section positions.
      const result: string[] = [];
      let visibleIdx = 0;
      for (const id of sectionOrder) {
        if (enabledSections.includes(id)) {
          result.push(newVisibleOrder[visibleIdx]);
          visibleIdx += 1;
        } else {
          result.push(id);
        }
      }
      onReorderSections(result);
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
      case 'achievements':
        return {
          onAddItem: onAddAchievement,
          onDeleteItem: onDeleteAchievement,
        };
      case 'certifications':
        return {
          onAddItem: onAddCertification,
          onDeleteItem: onDeleteCertification,
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
              const config = SECTION_CONFIG_MAP[sectionId];
              if (!config) return null;

              const items = getSectionItems(sectionId, resumeData);
              const handlers = sectionHasItems(sectionId) ? getItemHandlers(sectionId) : {};

              const canExpand = sectionHasItems(sectionId);

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
                  isExpanded={canExpand ? expandedSectionId === sectionId : undefined}
                  onToggleExpand={
                    canExpand
                      ? () =>
                          setExpandedSectionId(expandedSectionId === sectionId ? null : sectionId)
                      : undefined
                  }
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
