'use client';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface SnoozeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (snoozeUntil: number, notes?: string) => Promise<void>;
  isLoading?: boolean;
}

const SNOOZE_OPTIONS = [
  { value: '1', label: '1 day' },
  { value: '3', label: '3 days' },
  { value: '7', label: '1 week' },
  { value: '14', label: '2 weeks' },
  { value: '30', label: '1 month' },
];

export function SnoozeDialog({ open, onOpenChange, onConfirm, isLoading }: SnoozeDialogProps) {
  const [snoozeDays, setSnoozeDays] = useState('3');
  const [notes, setNotes] = useState('');

  const handleConfirm = async () => {
    const days = parseInt(snoozeDays, 10);
    const snoozeUntil = Date.now() + days * 24 * 60 * 60 * 1000;
    try {
      await onConfirm(snoozeUntil, notes || undefined);
      setSnoozeDays('3');
      setNotes('');
    } catch {
      // Preserve state on failure
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSnoozeDays('3');
      setNotes('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Snooze Queue Item</DialogTitle>
          <DialogDescription>
            Temporarily hide this item. It will reappear after the snooze period.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="snoozeDays">Snooze Duration</Label>
            <Select value={snoozeDays} onValueChange={setSnoozeDays}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SNOOZE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for snoozing..."
              rows={2}
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? 'Snoozing...' : 'Snooze'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
