'use client';

import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Calendar as CalendarIcon, Check, Pencil, Trash2, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDateWithTime } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

// Types for interview stage data
export interface InterviewStage {
  _id: string;
  title: string;
  scheduled_at?: number | null;
  location?: string | null;
  notes?: string | null;
  outcome: 'pending' | 'scheduled' | 'passed' | 'failed';
}

export interface EditingStage extends InterviewStage {
  scheduled_date?: Date;
  scheduled_time?: string;
}

interface InterviewTimelineItemProps {
  stage: InterviewStage;
  itemId: string;
  motionProps: Record<string, unknown>;
  isSelected: boolean;
  isEditing: boolean;
  editingStage: EditingStage | null;
  editCalendarOpen: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditChange: (updates: Partial<EditingStage>) => void;
  onEditCalendarOpenChange: (open: boolean) => void;
  getStatusBubble: (stageId: string, outcome: string) => React.ReactNode;
}

export function InterviewTimelineItem({
  stage,
  itemId,
  motionProps,
  isSelected,
  isEditing,
  editingStage,
  editCalendarOpen,
  onSelect,
  onDeselect,
  onEdit,
  onDelete,
  onSaveEdit,
  onCancelEdit,
  onEditChange,
  onEditCalendarOpenChange,
  getStatusBubble,
}: InterviewTimelineItemProps) {
  if (isEditing && editingStage) {
    return (
      <motion.div key={itemId} {...motionProps} className="flex gap-3">
        {/* Timeline dot */}
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 border-2 border-blue-500 flex items-center justify-center z-10">
          <Users className="h-3 w-3 text-blue-600" />
        </div>
        {/* Edit form */}
        <div className="flex-1 border rounded-lg p-3 bg-slate-50 space-y-2">
          <Input
            placeholder="Stage title"
            value={editingStage.title}
            onChange={(e) => onEditChange({ title: e.target.value })}
            className="h-8 text-sm"
          />
          <div className="flex gap-2">
            <Popover open={editCalendarOpen} onOpenChange={onEditCalendarOpenChange}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'h-8 w-[120px] justify-start text-left font-normal text-sm',
                    !editingStage.scheduled_date && 'text-muted-foreground',
                  )}
                >
                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                  {editingStage.scheduled_date
                    ? format(editingStage.scheduled_date, 'MMM d')
                    : 'Date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={editingStage.scheduled_date}
                  onSelect={(date) => {
                    onEditChange({ scheduled_date: date || undefined });
                    onEditCalendarOpenChange(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Input
              type="time"
              className="h-8 text-sm w-[85px]"
              value={editingStage.scheduled_time || ''}
              onChange={(e) => onEditChange({ scheduled_time: e.target.value })}
            />
            <Input
              placeholder="Location"
              value={editingStage.location || ''}
              onChange={(e) => onEditChange({ location: e.target.value })}
              className="h-8 text-sm flex-1"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancelEdit}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={onSaveEdit}
              disabled={!editingStage.title.trim()}
            >
              Save
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div key={itemId} {...motionProps}>
      <Popover
        open={isSelected}
        onOpenChange={(open) => {
          if (!open) onDeselect();
        }}
      >
        <PopoverTrigger asChild>
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={onSelect}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect();
              }
            }}
            role="button"
            tabIndex={0}
          >
            {/* Timeline dot - purple checkmark if passed, otherwise blue outline */}
            <div
              className={cn(
                'flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10',
                stage.outcome === 'passed'
                  ? 'bg-primary-500 border-primary-500'
                  : 'bg-white border-blue-500',
              )}
            >
              {stage.outcome === 'passed' && <Check className="h-3 w-3 text-white" />}
            </div>
            {/* Content */}
            <div className="flex-1 border rounded-lg pl-3 pr-4 py-3 hover:bg-slate-50 transition-colors min-h-[56px] flex items-center">
              <div className="flex items-center justify-between w-full gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-slate-900">{stage.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {stage.scheduled_at ? formatDateWithTime(stage.scheduled_at) : 'No date set'}
                  </div>
                  {stage.location && (
                    <div className="text-xs text-slate-400 mt-0.5 truncate">
                      📍 {stage.location}
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 flex items-center">
                  {getStatusBubble(stage._id, stage.outcome)}
                </div>
              </div>
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="end">
          <div className="space-y-3">
            <div className="text-sm font-medium text-slate-900">{stage.title}</div>
            <div className="text-xs text-slate-500">
              {stage.scheduled_at ? formatDateWithTime(stage.scheduled_at) : 'No date set'}
              {stage.location && ` · ${stage.location}`}
            </div>
            <div className="flex gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs gap-1.5"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
              >
                <Pencil className="h-3 w-3" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </motion.div>
  );
}
