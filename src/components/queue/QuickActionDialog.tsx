'use client';

import { CalendarPlus, Phone } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type QuickActionType = 'contacted' | 'scheduled_appointment';

interface QuickActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionType: QuickActionType;
  onConfirm: (notes?: string) => Promise<void>;
  isLoading?: boolean;
}

const actionConfig: Record<
  QuickActionType,
  { title: string; description: string; icon: React.ReactNode }
> = {
  contacted: {
    title: 'Log Contact',
    description: 'Record that you contacted this student.',
    icon: <Phone className="h-5 w-5" />,
  },
  scheduled_appointment: {
    title: 'Schedule Appointment',
    description: 'Record that you scheduled an appointment with this student.',
    icon: <CalendarPlus className="h-5 w-5" />,
  },
};

export function QuickActionDialog({
  open,
  onOpenChange,
  actionType,
  onConfirm,
  isLoading,
}: QuickActionDialogProps) {
  const [notes, setNotes] = useState('');
  const config = actionConfig[actionType];

  const handleConfirm = async () => {
    try {
      await onConfirm(notes || undefined);
      setNotes('');
    } catch {
      // Preserve notes on failure so user doesn't lose input
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setNotes('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {config.icon}
            {config.title}
          </DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                actionType === 'contacted'
                  ? 'e.g., Called student, left voicemail...'
                  : 'e.g., Scheduled for Tuesday at 2pm...'
              }
              rows={3}
              maxLength={2000}
            />
            <p className="text-xs text-neutral-500">{notes.length}/2000 characters</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
