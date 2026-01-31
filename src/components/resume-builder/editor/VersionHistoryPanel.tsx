'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { format, isToday, isYesterday } from 'date-fns';
import { MoreVertical, RotateCcw, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type VersionTrigger =
  | 'creation'
  | 'ai_edit'
  | 'manual_save'
  | 'section_change'
  | 'restoration'
  | 'auto_checkpoint';

// Interface matches the resume_versions table schema in convex/schema.ts
interface ResumeVersion {
  _id: Id<'resume_versions'>;
  _creationTime: number; // Convex built-in field
  resume_id: Id<'resumes'>;
  user_id: Id<'users'>;
  university_id?: Id<'universities'>;
  version_number: number;
  version_label?: string;
  content_snapshot: unknown; // Full resume content at this point
  trigger: VersionTrigger;
  created_at: number;
}

interface VersionHistoryPanelProps {
  resumeId: Id<'resumes'>;
  isOpen: boolean;
  onClose: () => void;
  currentVersionNumber?: number;
}

type FilterType = 'all' | 'manual_save' | 'ai_edit' | 'auto';

export function VersionHistoryPanel({
  resumeId,
  isOpen,
  onClose,
  currentVersionNumber,
}: VersionHistoryPanelProps) {
  const { user: clerkUser } = useUser();
  const { toast } = useToast();
  const clerkId = clerkUser?.id;

  const [filter, setFilter] = useState<FilterType>('all');
  const [isRestoring, setIsRestoring] = useState(false);

  // Fetch versions
  const versions = useQuery(
    api.resumes.getResumeVersions,
    clerkId ? { clerkId, resumeId } : 'skip',
  ) as ResumeVersion[] | undefined;

  const restoreVersionMutation = useMutation(api.resumes.restoreResumeVersion);

  // Filter versions based on selected filter
  const filteredVersions = useMemo(() => {
    if (!versions) return [];

    if (filter === 'all') return versions;
    if (filter === 'manual_save') return versions.filter((v) => v.trigger === 'manual_save');
    if (filter === 'ai_edit') return versions.filter((v) => v.trigger === 'ai_edit');
    if (filter === 'auto')
      return versions.filter(
        (v) =>
          v.trigger === 'section_change' ||
          v.trigger === 'creation' ||
          v.trigger === 'auto_checkpoint',
      );

    return versions;
  }, [versions, filter]);

  // Group versions by date
  const groupedVersions = useMemo(() => {
    const groups: Record<string, ResumeVersion[]> = {};

    for (const version of filteredVersions) {
      const date = new Date(version.created_at);
      let dateKey: string;

      if (isToday(date)) {
        dateKey = 'Today';
      } else if (isYesterday(date)) {
        dateKey = 'Yesterday';
      } else {
        dateKey = format(date, 'MMMM d, yyyy');
      }

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(version);
    }

    return groups;
  }, [filteredVersions]);

  const handleRestore = async (versionNumber: number) => {
    if (!clerkId) return;

    setIsRestoring(true);
    try {
      await restoreVersionMutation({
        resumeId,
        versionNumber,
      });
      toast({
        title: 'Version restored',
        description: `Restored to version ${versionNumber}`,
        variant: 'success',
      });
      onClose();
    } catch (error) {
      console.error('Failed to restore version:', error);
      toast({
        title: 'Restore failed',
        description: 'Could not restore this version. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const getTriggerLabel = (trigger: VersionTrigger): string => {
    switch (trigger) {
      case 'creation':
        return 'Initial version';
      case 'ai_edit':
        return 'AI edit';
      case 'manual_save':
        return 'Saved';
      case 'section_change':
        return 'Section edit';
      case 'restoration':
        return 'Restored version';
      case 'auto_checkpoint':
        return 'Auto-saved';
      default:
        return 'Edit';
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity"
        onClick={onClose}
        role="presentation"
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-[380px] bg-white shadow-xl z-50',
          'transform transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Version history</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-900"
            aria-label="Close version history"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Filter dropdown */}
        <div className="px-5 py-3 border-b border-slate-100">
          <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All versions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All versions</SelectItem>
              <SelectItem value="manual_save">Manual saves</SelectItem>
              <SelectItem value="ai_edit">AI edits</SelectItem>
              <SelectItem value="auto">Auto-saves</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Version list */}
        <div
          className="flex-1 overflow-y-auto px-5 py-3"
          style={{ maxHeight: 'calc(100vh - 180px)' }}
        >
          {!versions && (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-slate-300 border-t-primary-500 rounded-full animate-spin" />
            </div>
          )}

          {versions && filteredVersions.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <p>No versions found</p>
              <p className="text-sm mt-1">Changes will be saved as versions automatically</p>
            </div>
          )}

          {Object.entries(groupedVersions).map(([dateLabel, dateVersions]) => (
            <div key={dateLabel} className="mb-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                {dateLabel}
              </h3>
              <div className="space-y-2">
                {dateVersions.map((version) => {
                  const isCurrent = version.version_number === currentVersionNumber;
                  return (
                    <VersionItem
                      key={version._id}
                      version={version}
                      isCurrent={isCurrent}
                      onRestore={() => handleRestore(version.version_number)}
                      isRestoring={isRestoring}
                      getTriggerLabel={getTriggerLabel}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Version Item Component
// ============================================================================

interface VersionItemProps {
  version: ResumeVersion;
  isCurrent: boolean;
  onRestore: () => void;
  isRestoring: boolean;
  getTriggerLabel: (trigger: VersionTrigger) => string;
}

function VersionItem({
  version,
  isCurrent,
  onRestore,
  isRestoring,
  getTriggerLabel,
}: VersionItemProps) {
  return (
    <div
      className={cn(
        'p-3 rounded-lg transition-colors',
        isCurrent
          ? 'bg-white border-2 border-slate-300 shadow-sm'
          : 'bg-slate-50 hover:bg-slate-100 border border-transparent',
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="font-medium text-sm text-slate-900">
            {format(new Date(version.created_at), 'MMMM d, h:mm a')}
          </p>
          {isCurrent && (
            <p className="text-xs text-primary-600 font-medium mt-0.5">Current version</p>
          )}
          {version.version_label && !isCurrent && (
            <p className="text-xs text-slate-500 mt-0.5">{version.version_label}</p>
          )}
          {!version.version_label && !isCurrent && (
            <p className="text-xs text-slate-500 mt-0.5">{getTriggerLabel(version.trigger)}</p>
          )}
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-slate-500">Ascentul</span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-slate-600"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onRestore} disabled={isCurrent || isRestoring}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Restore this version
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
