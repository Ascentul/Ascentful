'use client';

import { differenceInCalendarDays, format } from 'date-fns';
import { motion } from 'framer-motion';
import { Calendar as CalendarIcon, Check, ListTodo, Pencil, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// Types for follow-up data
export interface Followup {
  _id: string;
  description?: string;
  title?: string;
  due_at?: number | null;
  status: 'open' | 'done';
}

export interface EditingFollowup {
  _id: string;
  description: string;
  due_date?: Date;
}

// Format due date for follow-ups
const formatDueDate = (timestamp: number, isOverdue: boolean): string => {
  if (isOverdue) return 'Overdue';
  const days = differenceInCalendarDays(new Date(timestamp), new Date());
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};

interface FollowupTimelineItemProps {
  followup: Followup;
  itemId: string;
  motionProps: Record<string, unknown>;
  isSelected: boolean;
  isEditing: boolean;
  editingFollowup: EditingFollowup | null;
  editCalendarOpen: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditChange: (updates: Partial<EditingFollowup>) => void;
  onEditCalendarOpenChange: (open: boolean) => void;
}

export function FollowupTimelineItem({
  followup,
  itemId,
  motionProps,
  isSelected,
  isEditing,
  editingFollowup,
  editCalendarOpen,
  onSelect,
  onDeselect,
  onEdit,
  onDelete,
  onToggle,
  onSaveEdit,
  onCancelEdit,
  onEditChange,
  onEditCalendarOpenChange,
}: FollowupTimelineItemProps) {
  const isCompleted = followup.status === 'done';
  const isOverdue = followup.due_at && followup.due_at < Date.now() && !isCompleted;

  if (isEditing && editingFollowup) {
    return (
      <motion.div key={itemId} {...motionProps} className="flex gap-3">
        {/* Timeline dot */}
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 border-2 border-amber-500 flex items-center justify-center z-10">
          <ListTodo className="h-3 w-3 text-amber-600" />
        </div>
        {/* Edit form */}
        <div className="flex-1 border rounded-lg p-3 bg-slate-50 space-y-2">
          <Input
            placeholder="Follow-up description"
            value={editingFollowup.description}
            onChange={(e) => onEditChange({ description: e.target.value })}
            className="h-8 text-sm"
          />
          <div className="flex gap-2">
            <Popover open={editCalendarOpen} onOpenChange={onEditCalendarOpenChange}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'h-8 w-[140px] justify-start text-left font-normal text-sm',
                    !editingFollowup.due_date && 'text-muted-foreground',
                  )}
                >
                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                  {editingFollowup.due_date
                    ? format(editingFollowup.due_date, 'MMM d, yyyy')
                    : 'Due date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={editingFollowup.due_date}
                  onSelect={(date) => {
                    if (!date) {
                      onEditChange({ due_date: undefined });
                      onEditCalendarOpenChange(false);
                      return;
                    }

                    const selectedDate = new Date(date);
                    if (followup.due_at) {
                      const originalTime = new Date(followup.due_at);
                      selectedDate.setHours(originalTime.getHours(), originalTime.getMinutes());
                    }

                    onEditChange({ due_date: selectedDate });
                    onEditCalendarOpenChange(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancelEdit}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={onSaveEdit}
              disabled={!editingFollowup.description.trim()}
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
        <div className="flex items-center gap-3">
          {/* Timeline dot - purple if completed, amber if pending - clickable for toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
            className={cn(
              'flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 transition-colors',
              isCompleted
                ? 'bg-primary-500 border-primary-500 hover:bg-primary-600'
                : 'bg-white border-amber-500 hover:bg-amber-50',
            )}
          >
            {isCompleted && <Check className="h-3 w-3 text-white" />}
          </button>
          {/* Content - clickable for popup */}
          <PopoverTrigger asChild>
            <div
              className={cn(
                'flex-1 border rounded-lg pl-3 pr-4 py-3 transition-colors min-h-[56px] flex items-center cursor-pointer',
                isCompleted ? 'bg-slate-50/50' : 'hover:bg-slate-50',
              )}
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
              <div className="flex items-center justify-between w-full gap-3">
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      'text-sm font-medium',
                      isCompleted
                        ? 'text-slate-400 line-through'
                        : isOverdue
                          ? 'text-red-600'
                          : 'text-slate-900',
                    )}
                  >
                    {followup.description || followup.title}
                  </div>
                  <div
                    className={cn(
                      'text-xs mt-0.5',
                      isCompleted
                        ? 'text-slate-400'
                        : isOverdue
                          ? 'text-red-500 font-medium'
                          : 'text-slate-400',
                    )}
                  >
                    {followup.due_at
                      ? isCompleted
                        ? format(new Date(followup.due_at), 'MMM d')
                        : formatDueDate(followup.due_at, !!isOverdue)
                      : 'No due date'}
                  </div>
                </div>
                <div className="flex-shrink-0 flex items-center">
                  {!isCompleted && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggle();
                      }}
                      className="h-5 w-5 rounded border border-primary-500 flex items-center justify-center hover:bg-primary-50 transition-colors mr-5"
                      title="Mark as complete"
                      aria-label="Mark as complete"
                    />
                  )}
                </div>
              </div>
            </div>
          </PopoverTrigger>
        </div>
        <PopoverContent className="w-64 p-3" align="end">
          <div className="space-y-3">
            <div className="text-sm font-medium text-slate-900">
              {followup.description || followup.title}
            </div>
            <div className="text-xs text-slate-500">
              {followup.due_at
                ? `Due ${format(new Date(followup.due_at), 'MMM d, yyyy')}`
                : 'No due date'}
              {isCompleted && ' · Completed'}
              {isOverdue && ' · Overdue'}
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
