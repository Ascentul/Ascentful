'use client';

import { CalendarClock, ChevronDown, Clock, PenSquare, ThumbsUp, X } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type ApplicationStatusLabel =
  | 'Not Started'
  | 'In Progress'
  | 'Applied'
  | 'Interviewing'
  | 'Offer'
  | 'Rejected';

interface ApplicationStatusBadgeProps {
  status: ApplicationStatusLabel | string;
  size?: 'sm' | 'default';
  className?: string;
  showIcon?: boolean;
  onStatusChange?: (status: ApplicationStatusLabel) => void;
  clickable?: boolean;
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label?: string }> = {
  'Not Started': {
    color: 'bg-slate-100 text-slate-800 border-slate-200',
    icon: <PenSquare className="h-3 w-3 mr-1" />,
  },
  'In Progress': {
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: <PenSquare className="h-3 w-3 mr-1" />,
  },
  Applied: {
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: <Clock className="h-3 w-3 mr-1" />,
  },
  Interviewing: {
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: <CalendarClock className="h-3 w-3 mr-1" />,
  },
  Offer: {
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: <ThumbsUp className="h-3 w-3 mr-1" />,
  },
  Rejected: {
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: <X className="h-3 w-3 mr-1" />,
  },
  default: {
    color: 'bg-slate-100 text-slate-800 border-slate-200',
    icon: <PenSquare className="h-3 w-3 mr-1" />,
  },
};

const allStatuses: ApplicationStatusLabel[] = [
  'In Progress',
  'Applied',
  'Interviewing',
  'Offer',
  'Rejected',
];

export function ApplicationStatusBadge({
  status,
  size = 'default',
  className,
  showIcon = true,
  onStatusChange,
  clickable = false,
}: ApplicationStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.default;

  if (!onStatusChange && !clickable) {
    return (
      <Badge
        variant="outline"
        className={cn(
          config.color,
          size === 'sm' ? 'text-xs h-6 px-2' : '',
          'flex items-center',
          className,
        )}
      >
        {showIcon && config.icon}
        <span>{config.label || status}</span>
      </Badge>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-1 rounded-control border font-medium transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500',
            config.color,
            size === 'sm' ? 'text-xs h-6 px-2' : 'text-xs h-7 px-3',
            className,
          )}
        >
          {showIcon && config.icon}
          <span>{config.label || status}</span>
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {allStatuses.map((statusOption) => {
          const optionConfig = statusConfig[statusOption];
          return (
            <DropdownMenuItem
              key={statusOption}
              onClick={() => onStatusChange?.(statusOption)}
              className="flex items-center gap-2"
            >
              {showIcon && optionConfig.icon}
              <span>{statusOption}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
