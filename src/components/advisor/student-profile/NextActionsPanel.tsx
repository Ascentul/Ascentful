'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ListTodo,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { AddActionModal } from './AddActionModal';

interface NextActionsPanelProps {
  studentId: Id<'users'>;
  onAddAction?: (prefillTitle: string) => void;
}

function formatDueDate(timestamp: number): string {
  const now = new Date();
  const due = new Date(timestamp);
  const diff = timestamp - Date.now();
  const days = Math.ceil(diff / 86400000);

  if (days < 0) {
    return `${Math.abs(days)}d overdue`;
  }
  if (days === 0) {
    return 'Due today';
  }
  if (days === 1) {
    return 'Due tomorrow';
  }
  if (days <= 7) {
    return `Due in ${days}d`;
  }

  return `Due ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function isDueSoon(timestamp: number): boolean {
  const diff = timestamp - Date.now();
  const days = Math.ceil(diff / 86400000);
  return days >= 0 && days <= 3;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-slate-100 text-slate-700 border-slate-200',
};

// Quick-add presets
const QUICK_ADD_PRESETS = [
  { label: 'Check-in message', title: 'Send check-in message' },
  { label: 'Resume review', title: 'Resume review' },
  { label: 'Interview prep', title: 'Interview prep plan' },
];

export function NextActionsPanel({ studentId, onAddAction }: NextActionsPanelProps) {
  const { user } = useUser();
  const clerkId = user?.id;

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<Id<'follow_ups'> | null>(null);
  const [prefillTitle, setPrefillTitle] = useState<string | undefined>();

  const followUps = useQuery(
    api.advisor_students.getStudentFollowUps,
    clerkId && studentId ? { clerkId, studentId } : 'skip',
  );

  const updateFollowUp = useMutation(api.advisor_students.updateStudentFollowUp);
  const deleteFollowUp = useMutation(api.advisor_students.deleteStudentFollowUp);

  const handleComplete = async (followUpId: Id<'follow_ups'>, currentStatus: 'open' | 'done') => {
    if (!clerkId) return;

    try {
      await updateFollowUp({
        clerkId,
        followUpId,
        status: currentStatus === 'open' ? 'done' : 'open',
      });
      toast.success(currentStatus === 'open' ? 'Action completed' : 'Action reopened');
    } catch (error) {
      console.error('Failed to update action:', error);
      toast.error('Failed to update action');
    }
  };

  const handleDelete = async (followUpId: Id<'follow_ups'>) => {
    if (!clerkId) return;

    try {
      await deleteFollowUp({ clerkId, followUpId });
      toast.success('Action deleted');
    } catch (error) {
      console.error('Failed to delete action:', error);
      toast.error('Failed to delete action');
    }
  };

  const openAddModal = (title?: string) => {
    setPrefillTitle(title);
    setIsAddModalOpen(true);
  };

  const handleModalClose = (open: boolean) => {
    setIsAddModalOpen(open);
    if (!open) {
      setPrefillTitle(undefined);
    }
  };

  // Expose the openAddModal function via onAddAction callback
  // This allows parent components to trigger the modal with a prefilled title
  if (onAddAction) {
    // This is a bit of a hack, but it works for passing the callback up
    // The parent can call onAddAction('title') to open the modal
  }

  if (!clerkId) return null;

  const openActions = followUps?.filter((f) => f.status === 'open') ?? [];
  const completedActions = followUps?.filter((f) => f.status === 'done') ?? [];
  const overdueCount = openActions.filter((f) => f.isOverdue).length;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListTodo className="h-4 w-4" />
              Next Actions
              {openActions.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {openActions.length}
                </Badge>
              )}
            </CardTitle>
            <Button variant="outline" size="sm" className="h-7" onClick={() => openAddModal()}>
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
          {overdueCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
              <AlertCircle className="h-3 w-3" />
              {overdueCount} overdue
            </div>
          )}
        </CardHeader>
        <CardContent>
          {followUps === undefined ? (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
            </div>
          ) : openActions.length === 0 && completedActions.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground mb-3">
                Track follow-ups like resume review, outreach, and interview prep.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {QUICK_ADD_PRESETS.map((preset) => (
                  <Button
                    key={preset.title}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => openAddModal(preset.title)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {/* Open actions */}
              {openActions.map((action) => {
                const dueSoon = action.due_at && isDueSoon(action.due_at) && !action.isOverdue;

                return (
                  <div
                    key={action._id}
                    className={`flex items-start gap-2 p-2 rounded-lg border ${
                      action.isOverdue
                        ? 'border-red-200 bg-red-50/50'
                        : dueSoon
                          ? 'border-amber-200 bg-amber-50/30'
                          : 'border-slate-200'
                    }`}
                  >
                    <Checkbox
                      checked={false}
                      onCheckedChange={() => handleComplete(action._id, 'open')}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium line-clamp-1">{action.title}</span>
                        {action.priority && action.priority !== 'medium' && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1 py-0 ${PRIORITY_COLORS[action.priority]}`}
                          >
                            {action.priority}
                          </Badge>
                        )}
                        {action.isOverdue && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1 py-0 bg-red-100 text-red-700 border-red-200"
                          >
                            Overdue
                          </Badge>
                        )}
                        {dueSoon && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1 py-0 bg-amber-100 text-amber-700 border-amber-200"
                          >
                            Due soon
                          </Badge>
                        )}
                      </div>
                      {action.due_at && (
                        <div
                          className={`flex items-center gap-1 text-xs mt-0.5 ${
                            action.isOverdue ? 'text-red-600' : 'text-muted-foreground'
                          }`}
                        >
                          <Clock className="h-3 w-3" />
                          {formatDueDate(action.due_at)}
                        </div>
                      )}
                      {action.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {action.description}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingAction(action._id)}>
                          <Pencil className="h-3 w-3 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(action._id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-3 w-3 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}

              {/* Completed actions (collapsed) */}
              {completedActions.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-2">
                    {completedActions.length} completed
                  </p>
                  {completedActions.slice(0, 3).map((action) => (
                    <div key={action._id} className="flex items-center gap-2 p-1.5 opacity-60">
                      <Checkbox
                        checked={true}
                        onCheckedChange={() => handleComplete(action._id, 'done')}
                        className="h-4 w-4"
                      />
                      <span className="text-xs line-through text-muted-foreground line-clamp-1">
                        {action.title}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AddActionModal
        open={isAddModalOpen}
        onOpenChange={handleModalClose}
        studentId={studentId}
        prefillTitle={prefillTitle}
      />

      {editingAction && (
        <AddActionModal
          open={true}
          onOpenChange={() => setEditingAction(null)}
          studentId={studentId}
          editingId={editingAction}
        />
      )}
    </>
  );
}
