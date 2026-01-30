'use client';

import { Id } from 'convex/_generated/dataModel';
import {
  CalendarPlus,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  Pause,
  Phone,
  PlayCircle,
  User,
} from 'lucide-react';
import Link from 'next/link';
import React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type QueueItemPriority = 'P1' | 'P2' | 'P3';
type QueueItemStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

type MomentumSignal = 'green' | 'yellow' | 'red';
type JobBoardActivity = 'active' | 'moderate' | 'inactive';

interface QueueItemCardProps {
  item: {
    _id: Id<'queue_items'>;
    title: string;
    description?: string;
    priority: QueueItemPriority;
    status: QueueItemStatus;
    snoozed_until?: number;
    created_at: number;
    student: {
      _id: Id<'users'>;
      name: string;
      email: string;
      imageUrl?: string;
      // Momentum data
      momentumScore?: number;
      momentumSignal?: MomentumSignal;
      momentumReason?: string;
      jobBoardActivity?: JobBoardActivity;
      resumeAgeDays?: number | null;
    } | null;
    owner: {
      _id: Id<'users'>;
      name: string;
    } | null;
  };
  isLoading?: boolean;
  onResolve: (id: Id<'queue_items'>) => void;
  onSnooze: (id: Id<'queue_items'>) => void;
  onContacted: (id: Id<'queue_items'>) => void;
  onScheduled: (id: Id<'queue_items'>) => void;
  onUnsnooze: (id: Id<'queue_items'>) => void;
  onStartProgress: (id: Id<'queue_items'>) => void;
  onViewDetail: (id: Id<'queue_items'>) => void;
}

const priorityConfig: Record<QueueItemPriority, { label: string; className: string }> = {
  P1: { label: 'P1', className: 'bg-red-500 text-white hover:bg-red-600' },
  P2: { label: 'P2', className: 'bg-orange-500 text-white hover:bg-orange-600' },
  P3: { label: 'P3', className: 'bg-neutral-300 text-neutral-700 hover:bg-neutral-400' },
};

const statusConfig: Record<
  QueueItemStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  OPEN: { label: 'Open', variant: 'default' },
  IN_PROGRESS: { label: 'In Progress', variant: 'secondary' },
  RESOLVED: { label: 'Resolved', variant: 'outline' },
  CLOSED: { label: 'Closed', variant: 'outline' },
};

const momentumConfig: Record<MomentumSignal, { label: string; className: string }> = {
  green: { label: 'On Track', className: 'bg-green-100 text-green-700 border-green-200' },
  yellow: { label: 'Needs Attention', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  red: { label: 'Stalled', className: 'bg-red-100 text-red-700 border-red-200' },
};

const jobBoardConfig: Record<JobBoardActivity, { label: string; className: string }> = {
  active: { label: 'Active', className: 'text-green-600' },
  moderate: { label: 'Moderate', className: 'text-amber-600' },
  inactive: { label: 'Inactive', className: 'text-neutral-400' },
};

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function QueueItemCard({
  item,
  isLoading,
  onResolve,
  onSnooze,
  onContacted,
  onScheduled,
  onUnsnooze,
  onStartProgress,
  onViewDetail,
}: QueueItemCardProps) {
  const studentName = item.student?.name || item.student?.email || 'Unknown Student';

  const studentInitials = item.student?.name
    ? item.student.name
        .split(' ')
        .map((n) => n.charAt(0))
        .slice(0, 2)
        .join('')
    : '?';

  const isSnoozed = item.snoozed_until && item.snoozed_until > Date.now();
  const isActiveItem = item.status === 'OPEN' || item.status === 'IN_PROGRESS';

  return (
    <Card
      className={cn(
        'hover:shadow-md transition-shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
        isSnoozed && 'opacity-60 bg-neutral-50',
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onViewDetail(item._id);
        }
      }}
      onClick={() => onViewDetail(item._id)}
    >
      <CardContent className="flex items-center gap-4 py-4">
        {/* Priority Badge */}
        <Badge
          className={cn('min-w-[32px] justify-center', priorityConfig[item.priority].className)}
        >
          {priorityConfig[item.priority].label}
        </Badge>

        {/* Student Avatar */}
        {item.student ? (
          <Link
            href={`/u/students/${item.student._id}`}
            className="flex items-center gap-3 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={item.student.imageUrl} />
              <AvatarFallback>{studentInitials}</AvatarFallback>
            </Avatar>
            <div className="min-w-[120px]">
              <p className="font-medium text-sm">{studentName}</p>
              {item.student.email && (
                <p className="text-xs text-neutral-500 truncate max-w-[150px]">
                  {item.student.email}
                </p>
              )}
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback>
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-[120px]">
              <p className="font-medium text-sm">{studentName}</p>
            </div>
          </div>
        )}

        {/* Momentum Signal */}
        {item.student?.momentumSignal && (
          <div className="flex flex-col items-center gap-1 min-w-[80px]">
            <Badge
              variant="outline"
              className={cn(
                'text-xs font-medium',
                momentumConfig[item.student.momentumSignal].className,
              )}
            >
              {momentumConfig[item.student.momentumSignal].label}
            </Badge>
            {item.student.momentumReason && (
              <span className="text-[10px] text-neutral-500">{item.student.momentumReason}</span>
            )}
          </div>
        )}

        {/* Resume Age & Job Board */}
        <div className="flex flex-col gap-1 min-w-[100px] text-xs">
          {item.student?.resumeAgeDays !== undefined && item.student?.resumeAgeDays !== null && (
            <div className="flex items-center gap-1 text-neutral-500">
              <span className={item.student.resumeAgeDays > 30 ? 'text-amber-600 font-medium' : ''}>
                Resume: {item.student.resumeAgeDays}d
              </span>
            </div>
          )}
          {item.student?.jobBoardActivity && (
            <div className="flex items-center gap-1">
              <span className="text-neutral-400">Job Board:</span>
              <span className={jobBoardConfig[item.student.jobBoardActivity].className}>
                {jobBoardConfig[item.student.jobBoardActivity].label}
              </span>
            </div>
          )}
        </div>

        {/* Item Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium truncate">{item.title}</p>
            {item.status === 'IN_PROGRESS' && (
              <Badge variant="secondary" className="text-xs">
                <PlayCircle className="h-3 w-3 mr-1" />
                In Progress
              </Badge>
            )}
            {isSnoozed && (
              <Badge variant="outline" className="text-xs">
                <Pause className="h-3 w-3 mr-1" />
                Snoozed
              </Badge>
            )}
          </div>
          {item.description && (
            <p className="text-sm text-neutral-500 truncate">{item.description}</p>
          )}
        </div>

        {/* Time */}
        <div className="text-sm text-neutral-500 whitespace-nowrap">
          <Clock className="h-3 w-3 inline mr-1" />
          {formatTimeAgo(item.created_at)}
        </div>

        {/* Actions */}
        {isActiveItem && (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              disabled={isLoading}
              onClick={() => onResolve(item._id)}
              className="gap-1"
            >
              <CheckCircle2 className="h-4 w-4" />
              Resolve
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onContacted(item._id)}>
                  <Phone className="mr-2 h-4 w-4" />
                  Log Contact
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onScheduled(item._id)}>
                  <CalendarPlus className="mr-2 h-4 w-4" />
                  Schedule Appointment
                </DropdownMenuItem>
                {item.status === 'OPEN' && (
                  <DropdownMenuItem onClick={() => onStartProgress(item._id)}>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Start Working
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {isSnoozed ? (
                  <DropdownMenuItem onClick={() => onUnsnooze(item._id)}>
                    <Clock className="mr-2 h-4 w-4" />
                    Unsnooze
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onSnooze(item._id)}>
                    <Pause className="mr-2 h-4 w-4" />
                    Snooze
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {!isActiveItem && (
          <Badge variant={statusConfig[item.status].variant} className="whitespace-nowrap">
            {statusConfig[item.status].label}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
