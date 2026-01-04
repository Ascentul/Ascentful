'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { Calendar, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface AddActionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: Id<'users'>;
  editingId?: Id<'follow_ups'>;
  prefillTitle?: string;
  onSuccess?: () => void;
}

export function AddActionModal({
  open,
  onOpenChange,
  studentId,
  editingId,
  prefillTitle,
  onSuccess,
}: AddActionModalProps) {
  const { user } = useUser();
  const clerkId = user?.id;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createFollowUp = useMutation(api.advisor_students.createStudentFollowUp);
  const updateFollowUp = useMutation(api.advisor_students.updateStudentFollowUp);

  // If editing, fetch the existing follow-up data
  const existingFollowUps = useQuery(
    api.advisor_students.getStudentFollowUps,
    clerkId && studentId && editingId ? { clerkId, studentId } : 'skip',
  );

  const editingAction = editingId ? existingFollowUps?.find((f) => f._id === editingId) : undefined;

  // Populate form when editing or when prefillTitle is provided
  useEffect(() => {
    if (editingAction) {
      setTitle(editingAction.title || '');
      setDescription(editingAction.description || '');
      if (editingAction.due_at) {
        const date = new Date(editingAction.due_at);
        setDueDate(date.toISOString().split('T')[0]);
      } else {
        setDueDate('');
      }
      setPriority((editingAction.priority as typeof priority) || 'medium');
    } else if (open && prefillTitle && !editingId) {
      // Apply prefillTitle only when opening for new action
      setTitle(prefillTitle);
      setDescription('');
      setDueDate('');
      setPriority('medium');
    } else if (!open) {
      // Reset form when closed
      setTitle('');
      setDescription('');
      setDueDate('');
      setPriority('medium');
    }
  }, [editingAction, open, prefillTitle, editingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clerkId || !title.trim()) return;

    setIsSubmitting(true);
    try {
      // Parse date as local midnight to avoid timezone off-by-one issues
      // (new Date("2026-01-15") interprets as UTC, which can shift the day in western timezones)
      const dueTimestamp = dueDate
        ? (() => {
            const [year, month, day] = dueDate.split('-').map(Number);
            return new Date(year, month - 1, day).getTime();
          })()
        : undefined;

      if (editingId) {
        await updateFollowUp({
          clerkId,
          followUpId: editingId,
          title: title.trim(),
          description: description.trim() || undefined,
          due_at: dueTimestamp,
          priority,
        });
        toast.success('Action updated');
      } else {
        await createFollowUp({
          clerkId,
          studentId,
          title: title.trim(),
          description: description.trim() || undefined,
          due_at: dueTimestamp,
          priority,
        });
        toast.success('Action created');
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to save action:', error);
      toast.error('Failed to save action');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{editingId ? 'Edit Action' : 'Add Action'}</DialogTitle>
          <DialogDescription>
            {editingId
              ? 'Update the follow-up action for this student.'
              : 'Create a follow-up action for this student.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Follow up on resume feedback"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Add more details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="due-date">Due Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="due-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                  <SelectTrigger id="priority">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
