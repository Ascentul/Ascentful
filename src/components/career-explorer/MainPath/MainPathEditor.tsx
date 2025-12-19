'use client';

import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Id } from 'convex/_generated/dataModel';
import {
  Check,
  ChevronRight,
  Edit2,
  GripVertical,
  History,
  Plus,
  Redo2,
  Target,
  Undo2,
  Upload,
} from 'lucide-react';
import React, { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type {
  MainPath,
  MainPathStep as MainPathStepType,
  StepDetails,
  StepTimeframe,
  StepType,
} from '@/lib/career-explorer/types';

import { MainPathStep } from './MainPathStep';
import { StepEditor } from './StepEditor';

// Sortable step wrapper for @dnd-kit
interface SortableStepProps {
  step: MainPathStepType;
  index: number;
  isEditing: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onConvertToGoal?: () => void;
  readOnly: boolean;
  isLast: boolean;
}

function SortableStep({
  step,
  index,
  isEditing,
  onEdit,
  onDelete,
  onConvertToGoal,
  readOnly,
  isLast,
}: SortableStepProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step._id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative pl-12">
      {/* Timeline dot */}
      <div className="absolute left-[18px] top-4 w-4 h-4 rounded-full bg-primary-500 border-4 border-white shadow-sm z-10" />

      {/* Arrow to next */}
      {!isLast && (
        <div className="absolute left-[22px] top-[72px] z-10">
          <ChevronRight className="w-4 h-4 text-primary-400 rotate-90" />
        </div>
      )}

      {/* Drag handle */}
      {!readOnly && (
        <div
          {...attributes}
          {...listeners}
          className="absolute left-0 top-4 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-neutral-100"
        >
          <GripVertical className="w-4 h-4 text-neutral-400" />
        </div>
      )}

      <MainPathStep
        step={step}
        index={index}
        isEditing={isEditing}
        onEdit={onEdit}
        onDelete={onDelete}
        onConvertToGoal={onConvertToGoal}
        readOnly={readOnly}
      />
    </div>
  );
}

interface MainPathEditorProps {
  path?: MainPath;
  steps: MainPathStepType[];
  onUpdateTitle?: (title: string) => void;
  onAddStep?: (data: {
    title: string;
    step_type: StepType;
    timeframe: StepTimeframe;
    role_id?: string;
    details: StepDetails;
    notes?: string;
  }) => void;
  onUpdateStep?: (
    stepId: Id<'career_main_path_steps'>,
    data: {
      title: string;
      step_type: StepType;
      timeframe: StepTimeframe;
      role_id?: string;
      details: StepDetails;
      notes?: string;
    },
  ) => void;
  onDeleteStep?: (stepId: Id<'career_main_path_steps'>) => void;
  onReorderSteps?: (orderedIds: Id<'career_main_path_steps'>[]) => void;
  onConvertStepToGoal?: (stepId: Id<'career_main_path_steps'>) => void;
  onPublish?: () => void;
  onViewHistory?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  readOnly?: boolean;
  isLoading?: boolean;
}

export function MainPathEditor({
  path,
  steps,
  onUpdateTitle,
  onAddStep,
  onUpdateStep,
  onDeleteStep,
  onReorderSteps,
  onConvertStepToGoal,
  onPublish,
  onViewHistory,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  readOnly = false,
  isLoading,
}: MainPathEditorProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(path?.title || '');
  const [isStepEditorOpen, setIsStepEditorOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<MainPathStepType | undefined>();
  const [activeId, setActiveId] = useState<string | null>(null);

  // @dnd-kit sensors for pointer and keyboard support
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement to start drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const sortedSteps = [...steps].sort((a, b) => a.index - b.index);
  const activeStep = activeId ? sortedSteps.find((s) => s._id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && onReorderSteps) {
      const oldIndex = sortedSteps.findIndex((s) => s._id === active.id);
      const newIndex = sortedSteps.findIndex((s) => s._id === over.id);

      const newOrder = arrayMove(sortedSteps, oldIndex, newIndex);
      onReorderSteps(newOrder.map((s) => s._id));
    }

    setActiveId(null);
  };

  const handleTitleSave = () => {
    if (titleValue.trim() && onUpdateTitle) {
      onUpdateTitle(titleValue.trim());
    }
    setIsEditingTitle(false);
  };

  const handleAddStep = () => {
    setEditingStep(undefined);
    setIsStepEditorOpen(true);
  };

  const handleEditStep = (step: MainPathStepType) => {
    setEditingStep(step);
    setIsStepEditorOpen(true);
  };

  const handleStepSave = (data: {
    title: string;
    step_type: StepType;
    timeframe: StepTimeframe;
    role_id?: string;
    details: StepDetails;
    notes?: string;
  }) => {
    if (editingStep && onUpdateStep) {
      onUpdateStep(editingStep._id, data);
    } else if (onAddStep) {
      onAddStep(data);
    }
    setIsStepEditorOpen(false);
    setEditingStep(undefined);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              {isEditingTitle && !readOnly ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={titleValue}
                    onChange={(e) => setTitleValue(e.target.value)}
                    className="text-xl font-bold max-w-md"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleTitleSave();
                      if (e.key === 'Escape') setIsEditingTitle(false);
                    }}
                  />
                  <Button size="sm" onClick={handleTitleSave}>
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl">{path?.title || 'My Career Path'}</CardTitle>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => {
                        setTitleValue(path?.title || '');
                        setIsEditingTitle(true);
                      }}
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )}
              <CardDescription className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {path?.status || 'draft'}
                </Badge>
                {path?.version && (
                  <span className="text-xs text-neutral-400">Version {path.version}</span>
                )}
                {path?.source && (
                  <Badge variant="secondary" className="capitalize text-xs">
                    From {path.source}
                  </Badge>
                )}
              </CardDescription>
            </div>

            {/* Actions */}
            {!readOnly && (
              <div className="flex items-center gap-2">
                {/* Undo/Redo */}
                {(onUndo || onRedo) && (
                  <TooltipProvider>
                    <div className="flex items-center gap-1 mr-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={onUndo}
                            disabled={!canUndo}
                          >
                            <Undo2 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Undo (Cmd+Z)</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={onRedo}
                            disabled={!canRedo}
                          >
                            <Redo2 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Redo (Cmd+Shift+Z)</TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                )}

                {onViewHistory && (
                  <Button variant="outline" size="sm" onClick={onViewHistory}>
                    <History className="w-4 h-4 mr-1" />
                    History
                  </Button>
                )}
                {onPublish && path?.status === 'draft' && (
                  <Button size="sm" onClick={onPublish} disabled={isLoading}>
                    <Upload className="w-4 h-4 mr-1" />
                    Publish
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Timeline with DnD */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="relative">
          {/* Connection line */}
          {sortedSteps.length > 0 && (
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary-500 via-primary-300 to-neutral-200" />
          )}

          {/* Steps */}
          <div className="space-y-4 relative">
            {sortedSteps.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Target className="w-12 h-12 text-neutral-300 mb-4" />
                  <h3 className="font-medium text-neutral-600 mb-1">No steps yet</h3>
                  <p className="text-sm text-neutral-400 mb-4">
                    Add steps to build your career path timeline
                  </p>
                  {!readOnly && (
                    <Button onClick={handleAddStep}>
                      <Plus className="w-4 h-4 mr-1" />
                      Add First Step
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <SortableContext
                items={sortedSteps.map((s) => s._id)}
                strategy={verticalListSortingStrategy}
              >
                {sortedSteps.map((step, index) => (
                  <SortableStep
                    key={step._id}
                    step={step}
                    index={index}
                    isEditing={editingStep?._id === step._id}
                    onEdit={() => handleEditStep(step)}
                    onDelete={() => onDeleteStep?.(step._id)}
                    onConvertToGoal={
                      onConvertStepToGoal ? () => onConvertStepToGoal(step._id) : undefined
                    }
                    readOnly={readOnly}
                    isLast={index === sortedSteps.length - 1}
                  />
                ))}
              </SortableContext>
            )}

            {/* Add Step Button */}
            {!readOnly && sortedSteps.length > 0 && (
              <div className="relative pl-12">
                <div className="absolute left-[18px] top-4 w-4 h-4 rounded-full bg-neutral-200 border-4 border-white shadow-sm z-10" />
                <Button variant="outline" className="w-full border-dashed" onClick={handleAddStep}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Step
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Drag Overlay for smooth animations */}
        <DragOverlay>
          {activeStep && (
            <div className="relative pl-12 opacity-90">
              <div className="absolute left-[18px] top-4 w-4 h-4 rounded-full bg-primary-500 border-4 border-white shadow-sm z-10" />
              <MainPathStep
                step={activeStep}
                index={sortedSteps.findIndex((s) => s._id === activeStep._id)}
                isEditing={false}
                onEdit={() => {}}
                onDelete={() => {}}
                readOnly={true}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Step Editor Dialog */}
      <StepEditor
        step={editingStep}
        isOpen={isStepEditorOpen}
        onClose={() => {
          setIsStepEditorOpen(false);
          setEditingStep(undefined);
        }}
        onSave={handleStepSave}
        isLoading={isLoading}
      />
    </div>
  );
}
