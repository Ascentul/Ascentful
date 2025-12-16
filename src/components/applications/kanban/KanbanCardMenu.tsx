'use client';

import { MoreVertical } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

import { type ApplicationStatus, STATUS_CONFIGS } from './types';

interface KanbanCardMenuProps {
  currentStatus: ApplicationStatus;
  onMoveTo: (status: ApplicationStatus) => void;
}

/**
 * Dropdown menu for moving an application card to a different column.
 * Provides accessibility fallback for users who prefer not to drag.
 */
export function KanbanCardMenu({ currentStatus, onMoveTo }: KanbanCardMenuProps) {
  const otherStatuses = STATUS_CONFIGS.filter((s) => s.id !== currentStatus);

  // Map background colors to dot colors
  const getDotColor = (bgColor: string): string => {
    const colorMap: Record<string, string> = {
      'bg-slate-50': 'bg-slate-400',
      'bg-blue-50': 'bg-blue-400',
      'bg-amber-50': 'bg-amber-400',
      'bg-green-50': 'bg-green-400',
      'bg-red-50': 'bg-red-400',
    };
    return colorMap[bgColor] || 'bg-slate-400';
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4 text-slate-400" />
          <span className="sr-only">Move application</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel>Move to</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {otherStatuses.map((status) => (
          <DropdownMenuItem
            key={status.id}
            onClick={(e) => {
              e.stopPropagation();
              onMoveTo(status.id);
            }}
            className="cursor-pointer"
          >
            <span className={cn('w-2 h-2 rounded-full mr-2', getDotColor(status.color))} />
            {status.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
