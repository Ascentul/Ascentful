'use client';

import { Id } from 'convex/_generated/dataModel';
import { Check, ChevronRight, Edit2, History, Plus, Save, Target, Upload } from 'lucide-react';
import React, { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type {
  MainPath,
  MainPathStep as MainPathStepType,
  StepDetails,
  StepTimeframe,
  StepType,
} from '@/lib/career-explorer/types';

import { MainPathStep } from './MainPathStep';
import { StepEditor } from './StepEditor';

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
  onPublish?: () => void;
  onViewHistory?: () => void;
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
  onPublish,
  onViewHistory,
  readOnly = false,
  isLoading,
}: MainPathEditorProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(path?.title || '');
  const [isStepEditorOpen, setIsStepEditorOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<MainPathStepType | undefined>();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

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

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    // Visual feedback would go here
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex || !onReorderSteps) return;

    const newSteps = [...steps];
    const [removed] = newSteps.splice(draggedIndex, 1);
    newSteps.splice(dropIndex, 0, removed);

    onReorderSteps(newSteps.map((s) => s._id));
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const sortedSteps = [...steps].sort((a, b) => a.index - b.index);

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

      {/* Timeline */}
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
            sortedSteps.map((step, index) => (
              <div
                key={step._id}
                className="relative pl-12"
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
              >
                {/* Timeline dot */}
                <div className="absolute left-[18px] top-4 w-4 h-4 rounded-full bg-primary-500 border-4 border-white shadow-sm z-10" />

                {/* Arrow to next */}
                {index < sortedSteps.length - 1 && (
                  <div className="absolute left-[22px] top-[72px] z-10">
                    <ChevronRight className="w-4 h-4 text-primary-400 rotate-90" />
                  </div>
                )}

                <MainPathStep
                  step={step}
                  index={index}
                  isEditing={editingStep?._id === step._id}
                  onEdit={() => handleEditStep(step)}
                  onDelete={() => onDeleteStep?.(step._id)}
                  onDragStart={() => handleDragStart(index)}
                  onDragEnd={handleDragEnd}
                  readOnly={readOnly}
                />
              </div>
            ))
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
