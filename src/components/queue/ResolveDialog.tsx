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
import { Textarea } from '@/components/ui/textarea';

interface ResolveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (closedReason: string, notes?: string) => Promise<void>;
  isLoading?: boolean;
}

export function ResolveDialog({ open, onOpenChange, onConfirm, isLoading }: ResolveDialogProps) {
  const [closedReason, setClosedReason] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (!closedReason.trim()) {
      setError('Please provide a closure reason');
      return;
    }
    setError('');
    try {
      await onConfirm(closedReason, notes || undefined);
      setClosedReason('');
      setNotes('');
    } catch {
      // Preserve form state on failure
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setClosedReason('');
      setNotes('');
      setError('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve Queue Item</DialogTitle>
          <DialogDescription>
            Mark this item as resolved. A closure reason is required for audit compliance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="closedReason">
              Closure Reason <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="closedReason"
              value={closedReason}
              onChange={(e) => {
                setClosedReason(e.target.value);
                if (e.target.value.trim()) setError('');
              }}
              placeholder="e.g., Student contacted and scheduled follow-up appointment"
              rows={2}
              maxLength={500}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <p className="text-xs text-neutral-500">{closedReason.length}/500 characters</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional details about the resolution..."
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
          <Button onClick={handleConfirm} disabled={isLoading || !closedReason.trim()}>
            {isLoading ? 'Resolving...' : 'Resolve Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
