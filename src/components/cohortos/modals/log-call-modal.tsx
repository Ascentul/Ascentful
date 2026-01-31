'use client';

import { AlertTriangle, Loader2, Phone } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { type Status, STATUS_CONFIG, type Student } from '@/lib/cohortos/types';
import { cn } from '@/lib/utils';

interface LogCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
}

type CallType = 'scheduled' | 'quick-checkin' | 'voicemail' | 'no-answer';

const callTypeOptions: { value: CallType; label: string }[] = [
  { value: 'scheduled', label: 'Scheduled Coaching' },
  { value: 'quick-checkin', label: 'Quick Check-in' },
  { value: 'voicemail', label: 'Voicemail Left' },
  { value: 'no-answer', label: 'No Answer' },
];

const durationOptions = [
  { value: 5, label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '60 minutes' },
];

const statusOptions: { value: Status; label: string }[] = [
  { value: 'searching', label: 'Searching' },
  { value: 'applying', label: 'Applying' },
  { value: 'interviewing', label: 'Interviewing' },
  { value: 'offered', label: 'Offered' },
  { value: 'placed', label: 'Placed' },
];

export function LogCallModal({ isOpen, onClose, student }: LogCallModalProps) {
  // State
  const [callType, setCallType] = useState<CallType>('scheduled');
  const [duration, setDuration] = useState<number>(15);
  const [notes, setNotes] = useState('');
  const [updateStatus, setUpdateStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<Status>(student.status);
  const [flagBlocker, setFlagBlocker] = useState(false);
  const [blockerNote, setBlockerNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setCallType('scheduled');
      setDuration(15);
      setNotes('');
      setUpdateStatus(false);
      setNewStatus(student.status);
      setFlagBlocker(false);
      setBlockerNote('');
      setSaving(false);
    }
  }, [isOpen, student.status]);

  const handleSave = async () => {
    setSaving(true);

    // Log payload
    console.log('Logging call:', {
      student: { id: student.id, name: student.name },
      callType,
      duration,
      notes,
      updateStatus: updateStatus ? newStatus : null,
      flagBlocker: flagBlocker ? blockerNote : null,
    });

    // Simulate saving
    await new Promise((r) => setTimeout(r, 1000));

    toast.success(`Call logged for ${student.name}`);

    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Log Call
          </DialogTitle>
          <DialogDescription>Record a phone call with {student.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Phone Number */}
          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
            <Phone className="h-4 w-4 text-slate-500" />
            <a href={`tel:${student.phone}`} className="text-sm text-primary-600 hover:underline">
              {student.phone}
            </a>
            <span className="text-xs text-slate-400">Click to call</span>
          </div>

          {/* Call Type */}
          <div className="space-y-2">
            <Label>Call Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {callTypeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setCallType(opt.value)}
                  className={cn(
                    'px-3 py-2 text-sm rounded-lg border transition-colors',
                    callType === opt.value
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-slate-200 hover:bg-slate-50',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="duration">Duration</Label>
            <select
              id="duration"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {durationOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              placeholder="What was discussed? Any follow-up actions?"
            />
          </div>

          {/* Update Status */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={updateStatus}
                onChange={(e) => setUpdateStatus(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-700">Update student status</span>
            </label>
            {updateStatus && (
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as Status)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Flag Blocker */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={flagBlocker}
                onChange={(e) => setFlagBlocker(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm text-slate-700 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Flag as blocker
              </span>
            </label>
            {flagBlocker && (
              <textarea
                value={blockerNote}
                onChange={(e) => setBlockerNote(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
                placeholder="Describe the blocker..."
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Phone className="h-4 w-4 mr-2" />
                Log Call
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
