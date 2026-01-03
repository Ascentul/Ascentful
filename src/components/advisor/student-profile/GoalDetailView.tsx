'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { Calendar, CheckCircle2, Clock, Loader2, Save, Target } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { CommentButton } from '@/components/advisor/comments/CommentButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';

interface GoalDetailViewProps {
  goalId: Id<'goals'>;
  studentId: Id<'users'>;
}

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not Started', color: 'bg-slate-100 text-slate-700' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  { value: 'active', label: 'Active', color: 'bg-purple-100 text-purple-700' },
  { value: 'completed', label: 'Completed', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'paused', label: 'Paused', color: 'bg-amber-100 text-amber-700' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-700' },
];

function getStatusColor(status: string): string {
  return STATUS_OPTIONS.find((s) => s.value === status)?.color || 'bg-slate-100 text-slate-700';
}

function formatDate(timestamp?: number | null): string {
  if (!timestamp) return 'Not set';
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function GoalDetailView({ goalId, studentId }: GoalDetailViewProps) {
  const { user } = useUser();
  const clerkId = user?.id;

  const [isEditing, setIsEditing] = useState(false);
  const [editedStatus, setEditedStatus] = useState<string | null>(null);
  const [editedProgress, setEditedProgress] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch goal details
  const goal = useQuery(
    api.advisor_students.getStudentGoal,
    clerkId ? { clerkId, studentId, goalId } : 'skip',
  );

  // Mutation for updating goal
  const updateGoal = useMutation(api.advisor_students.updateStudentGoal);

  const handleSave = async () => {
    if (!clerkId || !goal) return;

    setIsSaving(true);
    try {
      await updateGoal({
        clerkId,
        studentId,
        goalId,
        status: editedStatus || undefined,
        progress: editedProgress !== null ? editedProgress : undefined,
      });
      toast.success('Goal updated');
      setIsEditing(false);
      setEditedStatus(null);
      setEditedProgress(null);
    } catch (error) {
      console.error('Failed to update goal:', error);
      toast.error('Failed to update goal');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedStatus(null);
    setEditedProgress(null);
  };

  const startEditing = () => {
    setEditedStatus(goal?.status ?? null);
    setEditedProgress(goal?.progress ?? 0);
    setIsEditing(true);
  };

  if (!clerkId) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Please sign in to view goal details.</p>
      </div>
    );
  }

  if (goal === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (goal === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Goal not found.</p>
      </div>
    );
  }

  const currentStatus = isEditing && editedStatus ? editedStatus : goal.status;
  const currentProgress = isEditing && editedProgress !== null ? editedProgress : goal.progress;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
            <Target className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{goal.title}</h3>
            {goal.category && <p className="text-sm text-muted-foreground">{goal.category}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CommentButton
            targetType="goal"
            targetId={goalId}
            studentId={studentId}
            variant="default"
          />
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={startEditing}>
              Edit
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      <Separator />

      {/* Status */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Status</Label>
        {isEditing ? (
          <Select value={currentStatus} onValueChange={setEditedStatus}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${option.color.split(' ')[0]}`} />
                    {option.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge className={getStatusColor(currentStatus)}>{currentStatus.replace('_', ' ')}</Badge>
        )}
      </div>

      {/* Progress */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Progress</Label>
          <span className="text-sm text-muted-foreground">{currentProgress}%</span>
        </div>
        {isEditing ? (
          <Slider
            value={[currentProgress]}
            onValueChange={([value]) => setEditedProgress(value)}
            max={100}
            step={5}
            className="w-full"
          />
        ) : (
          <Progress value={currentProgress} className="h-2" />
        )}
      </div>

      {/* Description */}
      {goal.description && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label className="text-sm font-medium">Description</Label>
            <p className="text-sm bg-muted/50 rounded-lg p-3">{goal.description}</p>
          </div>
        </>
      )}

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Target Date
          </Label>
          <p className="text-sm">{formatDate(goal.target_date)}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Created
          </Label>
          <p className="text-sm">{formatDate(goal.created_at)}</p>
        </div>
        {goal.completed_at && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Completed
            </Label>
            <p className="text-sm">{formatDate(goal.completed_at)}</p>
          </div>
        )}
      </div>

      {/* Checklist */}
      {goal.checklist && goal.checklist.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Checklist ({goal.checklist.filter((i) => i.completed).length}/{goal.checklist.length})
            </Label>
            <div className="space-y-2">
              {goal.checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <Checkbox checked={item.completed} disabled className="h-4 w-4" />
                  <span
                    className={`text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}
                  >
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
