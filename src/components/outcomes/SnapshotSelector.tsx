'use client';

import { Calendar, Camera, ChevronDown, Clock, Plus, Trash2 } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export interface Snapshot {
  _id: string;
  name: string;
  description?: string;
  snapshot_date: number;
  created_by_name?: string;
  metrics: {
    total_students: number;
    known_outcomes: number;
    knowledge_rate: number;
    employment_rate: number;
  };
}

interface SnapshotSelectorProps {
  snapshots: Snapshot[];
  selectedSnapshotId?: string | null;
  onSelectSnapshot: (snapshotId: string | null) => void;
  onCreateSnapshot: (name: string, description?: string) => Promise<void>;
  onDeleteSnapshot?: (snapshotId: string) => Promise<void>;
  isCreating?: boolean;
  className?: string;
}

export function SnapshotSelector({
  snapshots,
  selectedSnapshotId,
  onSelectSnapshot,
  onCreateSnapshot,
  onDeleteSnapshot,
  isCreating = false,
  className,
}: SnapshotSelectorProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotDescription, setSnapshotDescription] = useState('');

  const selectedSnapshot = selectedSnapshotId
    ? snapshots.find((s) => s._id === selectedSnapshotId)
    : null;

  const handleCreateSnapshot = async () => {
    if (!snapshotName.trim()) return;

    try {
      await onCreateSnapshot(snapshotName.trim(), snapshotDescription.trim() || undefined);
      setSnapshotName('');
      setSnapshotDescription('');
      setIsCreateDialogOpen(false);
    } catch {
      // Error handling (e.g., toast) is delegated to parent; keep dialog open for retry
    }
  };

  const handleSelectLive = () => {
    onSelectSnapshot(null);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className={cn('gap-2', className)}>
            {selectedSnapshot ? (
              <>
                <Camera className="h-4 w-4" />
                <span className="max-w-[200px] truncate">{selectedSnapshot.name}</span>
              </>
            ) : (
              <>
                <Clock className="h-4 w-4" />
                <span>Live Data</span>
              </>
            )}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          {/* Live Data Option */}
          <DropdownMenuItem
            onClick={handleSelectLive}
            className={cn(!selectedSnapshotId && 'bg-primary-50')}
          >
            <Clock className="mr-2 h-4 w-4" />
            <div className="flex flex-col">
              <span className="font-medium">Live Data</span>
              <span className="text-xs text-neutral-500">Real-time analytics</span>
            </div>
          </DropdownMenuItem>

          {snapshots.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs font-medium text-neutral-500">
                Saved Snapshots
              </div>
            </>
          )}

          {/* Snapshot Options */}
          {snapshots.map((snapshot) => (
            <DropdownMenuItem
              key={snapshot._id}
              onClick={() => onSelectSnapshot(snapshot._id)}
              className={cn(
                'flex items-start justify-between',
                selectedSnapshotId === snapshot._id && 'bg-primary-50',
              )}
            >
              <div className="flex items-start gap-2">
                <Camera className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-medium">{snapshot.name}</span>
                  <span className="text-xs text-neutral-500">
                    <Calendar className="mr-1 inline h-3 w-3" />
                    {new Date(snapshot.snapshot_date).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  {snapshot.description && (
                    <span className="mt-0.5 text-xs text-neutral-400 line-clamp-1">
                      {snapshot.description}
                    </span>
                  )}
                </div>
              </div>
              {onDeleteSnapshot && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-neutral-400 hover:text-red-500"
                  aria-label={`Delete snapshot ${snapshot.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (
                      window.confirm(`Delete snapshot "${snapshot.name}"? This cannot be undone.`)
                    ) {
                      // Error handling delegated to parent via onDeleteSnapshot
                      onDeleteSnapshot(snapshot._id);
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          {/* Create New Snapshot */}
          <DropdownMenuItem onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            <span>Save Current as Snapshot</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Snapshot Dialog */}
      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            setSnapshotName('');
            setSnapshotDescription('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Snapshot</DialogTitle>
            <DialogDescription>
              Create a point-in-time snapshot of the current outcomes data with applied filters.
            </DialogDescription>
          </DialogHeader>

          <form
            id="create-snapshot-form"
            className="space-y-4 py-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (isCreating) return;
              await handleCreateSnapshot();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="snapshot-name">Snapshot Name</Label>
              <Input
                id="snapshot-name"
                placeholder="e.g., Q4 2024 Report"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="snapshot-description">Description (optional)</Label>
              <Textarea
                id="snapshot-description"
                placeholder="Add notes about this snapshot..."
                value={snapshotDescription}
                onChange={(e) => setSnapshotDescription(e.target.value)}
                rows={3}
              />
            </div>
          </form>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-snapshot-form"
              disabled={!snapshotName.trim() || isCreating}
            >
              {isCreating ? 'Saving...' : 'Save Snapshot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Snapshot Banner for when viewing a snapshot
interface SnapshotBannerProps {
  snapshot: Snapshot;
  onViewLive: () => void;
  className?: string;
}

export function SnapshotBanner({ snapshot, onViewLive, className }: SnapshotBannerProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-card bg-amber-50 px-4 py-3',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Camera className="h-5 w-5 text-amber-600" />
        <div>
          <p className="text-sm font-medium text-amber-800">Viewing snapshot: {snapshot.name}</p>
          <p className="text-xs text-amber-600">
            Captured on{' '}
            {new Date(snapshot.snapshot_date).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}{' '}
            by {snapshot.created_by_name || 'Unknown'}
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onViewLive}
        className="border-amber-300 bg-white text-amber-700 hover:bg-amber-100"
      >
        <Clock className="mr-1.5 h-4 w-4" />
        View Live Data
      </Button>
    </div>
  );
}
