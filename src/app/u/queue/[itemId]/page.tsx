'use client';

/**
 * Queue Item Detail Page
 *
 * Shows full context for a queue item including:
 * - Student information
 * - Related signal
 * - Recent activity
 * - Action history
 */

import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import {
  ArrowLeft,
  CalendarPlus,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Pause,
  Phone,
  PlayCircle,
  RefreshCw,
  User,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { QuickActionDialog, ResolveDialog, SnoozeDialog } from '@/components/queue';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type QuickActionType = 'contacted' | 'scheduled_appointment';

const priorityConfig = {
  P1: { label: 'P1 - Urgent', className: 'bg-red-500 text-white' },
  P2: { label: 'P2 - Normal', className: 'bg-orange-500 text-white' },
  P3: { label: 'P3 - Low', className: 'bg-neutral-300 text-neutral-700' },
};

const statusConfig = {
  OPEN: { label: 'Open', className: 'bg-yellow-100 text-yellow-800' },
  IN_PROGRESS: { label: 'In Progress', className: 'bg-blue-100 text-blue-800' },
  RESOLVED: { label: 'Resolved', className: 'bg-green-100 text-green-800' },
  CLOSED: { label: 'Closed', className: 'bg-neutral-100 text-neutral-800' },
};

const actionTypeLabels: Record<string, string> = {
  created: 'Created',
  assigned: 'Assigned',
  reassigned: 'Reassigned',
  status_changed: 'Status Changed',
  contacted: 'Contacted Student',
  scheduled_appointment: 'Scheduled Appointment',
  snoozed: 'Snoozed',
  unsnoozed: 'Unsnoozed',
  resolved: 'Resolved',
  closed: 'Closed',
  reopened: 'Reopened',
  note_added: 'Note Added',
  playbook_applied: 'Playbook Applied',
};

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

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

export default function QueueItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const itemId = params.itemId as Id<'queue_items'> | undefined;

  // Dialog state - hooks must be called unconditionally
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const [isSnoozeDialogOpen, setIsSnoozeDialogOpen] = useState(false);
  const [isQuickActionDialogOpen, setIsQuickActionDialogOpen] = useState(false);
  const [quickActionType, setQuickActionType] = useState<QuickActionType>('contacted');
  const [isLoading, setIsLoading] = useState(false);

  // Queries - skip if itemId is invalid
  const itemDetail = useQuery(
    api.queue_items.getQueueItemDetail,
    itemId ? { queueItemId: itemId } : 'skip',
  );
  const actionHistory = useQuery(
    api.queue_items.getQueueItemActions,
    itemId ? { queueItemId: itemId, limit: 20 } : 'skip',
  );

  // Mutations
  const resolveItem = useMutation(api.queue_items.resolveQueueItem);
  const snoozeItem = useMutation(api.queue_items.snoozeQueueItem);
  const unsnoozeItem = useMutation(api.queue_items.unsnoozeQueueItem);
  const reopenItem = useMutation(api.queue_items.reopenQueueItem);
  const updateStatus = useMutation(api.queue_items.updateQueueItemStatus);
  const logQuickAction = useMutation(api.queue_items.logQuickAction);

  // Early return if itemId is invalid (after hooks)
  if (!itemId) {
    return (
      <div className="container mx-auto py-6">
        <p className="text-red-500">Invalid queue item ID</p>
        <Button variant="ghost" onClick={() => router.push('/u/queue')}>
          Back to Queue
        </Button>
      </div>
    );
  }

  // Handlers
  const handleConfirmResolve = async (closedReason: string, notes?: string) => {
    setIsLoading(true);
    try {
      await resolveItem({
        queueItemId: itemId,
        closedReason,
        notes,
      });
      toast({
        title: 'Item Resolved',
        description: 'The queue item has been marked as resolved.',
      });
      setIsResolveDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to resolve item.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSnooze = async (snoozeUntil: number, notes?: string) => {
    setIsLoading(true);
    try {
      await snoozeItem({
        queueItemId: itemId,
        snoozeUntil,
        notes,
      });
      toast({
        title: 'Item Snoozed',
        description: 'The item will reappear after the snooze period.',
      });
      setIsSnoozeDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to snooze item.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsnooze = async () => {
    setIsLoading(true);
    try {
      await unsnoozeItem({ queueItemId: itemId });
      toast({
        title: 'Item Unsnoozed',
        description: 'The item is now active again.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to unsnooze item.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReopen = async () => {
    setIsLoading(true);
    try {
      await reopenItem({ queueItemId: itemId });
      toast({
        title: 'Item Reopened',
        description: 'The item has been reopened.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reopen item.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartProgress = async () => {
    setIsLoading(true);
    try {
      await updateStatus({
        queueItemId: itemId,
        status: 'IN_PROGRESS',
      });
      toast({
        title: 'Started Working',
        description: 'Item marked as in progress.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update status.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmQuickAction = async (notes?: string) => {
    setIsLoading(true);
    try {
      await logQuickAction({
        queueItemId: itemId,
        actionType: quickActionType,
        notes,
      });
      toast({
        title: quickActionType === 'contacted' ? 'Contact Logged' : 'Appointment Scheduled',
        description: 'Action has been recorded.',
      });
      setIsQuickActionDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to log action.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!itemDetail) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  const isActiveItem = itemDetail.status === 'OPEN' || itemDetail.status === 'IN_PROGRESS';
  const isSnoozed = itemDetail.snoozed_until && itemDetail.snoozed_until > Date.now();
  const studentName = itemDetail.student?.name || itemDetail.student?.email || 'Unknown Student';

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* Back button */}
      <Button variant="ghost" className="gap-2" onClick={() => router.push('/u/queue')}>
        <ArrowLeft className="h-4 w-4" />
        Back to Queue
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Badge className={cn('text-sm', priorityConfig[itemDetail.priority].className)}>
              {priorityConfig[itemDetail.priority].label}
            </Badge>
            <Badge className={statusConfig[itemDetail.status].className}>
              {statusConfig[itemDetail.status].label}
            </Badge>
            {isSnoozed && (
              <Badge variant="outline">
                <Pause className="mr-1 h-3 w-3" />
                Snoozed until {formatDateTime(itemDetail.snoozed_until!)}
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold">{itemDetail.title}</h1>
          {itemDetail.description && <p className="text-neutral-600">{itemDetail.description}</p>}
          <p className="text-sm text-neutral-500">
            Created {formatDateTime(itemDetail.created_at)} ({formatTimeAgo(itemDetail.created_at)})
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {isActiveItem && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setQuickActionType('contacted');
                  setIsQuickActionDialogOpen(true);
                }}
                disabled={isLoading}
              >
                <Phone className="mr-2 h-4 w-4" />
                Log Contact
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setQuickActionType('scheduled_appointment');
                  setIsQuickActionDialogOpen(true);
                }}
                disabled={isLoading}
              >
                <CalendarPlus className="mr-2 h-4 w-4" />
                Schedule
              </Button>
              {itemDetail.status === 'OPEN' && (
                <Button variant="outline" onClick={handleStartProgress} disabled={isLoading}>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Start Working
                </Button>
              )}
              {isSnoozed ? (
                <Button variant="outline" onClick={handleUnsnooze} disabled={isLoading}>
                  <Clock className="mr-2 h-4 w-4" />
                  Unsnooze
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setIsSnoozeDialogOpen(true)}
                  disabled={isLoading}
                >
                  <Pause className="mr-2 h-4 w-4" />
                  Snooze
                </Button>
              )}
              <Button onClick={() => setIsResolveDialogOpen(true)} disabled={isLoading}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Resolve
              </Button>
            </>
          )}
          {(itemDetail.status === 'RESOLVED' || itemDetail.status === 'CLOSED') && (
            <Button variant="outline" onClick={handleReopen} disabled={isLoading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reopen
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Student Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Student
              </CardTitle>
            </CardHeader>
            <CardContent>
              {itemDetail.student ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={itemDetail.student.imageUrl} />
                      <AvatarFallback>
                        {itemDetail.student.name
                          ?.split(' ')
                          .map((n: string) => n.charAt(0))
                          .slice(0, 2)
                          .join('') || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{studentName}</p>
                      <p className="text-sm text-neutral-500">{itemDetail.student.email}</p>
                      {itemDetail.student.last_login_at && (
                        <p className="text-xs text-neutral-400">
                          Last active: {formatTimeAgo(itemDetail.student.last_login_at)}
                        </p>
                      )}
                    </div>
                  </div>
                  <Link href={`/u/students/${itemDetail.student._id}`}>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View Profile
                    </Button>
                  </Link>
                </div>
              ) : (
                <p className="text-neutral-500">Student not found</p>
              )}
            </CardContent>
          </Card>

          {/* Related Signal */}
          {itemDetail.signal && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Related Signal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{itemDetail.signal.signal_type}</Badge>
                    <Badge variant="secondary">{itemDetail.signal.priority}</Badge>
                    <Badge variant="outline">{itemDetail.signal.status}</Badge>
                  </div>
                  <p className="font-medium">{itemDetail.signal.title}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Student Signals */}
          {itemDetail.recentSignals && itemDetail.recentSignals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Recent signals for this student</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {itemDetail.recentSignals.map((signal) => (
                    <div
                      key={signal._id}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {signal.signal_type}
                        </Badge>
                        <span className="text-sm">{signal.title}</span>
                      </div>
                      <span className="text-xs text-neutral-500">
                        {formatTimeAgo(signal.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Closure Info */}
          {itemDetail.closed_reason && (
            <Card>
              <CardHeader>
                <CardTitle>Resolution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="font-medium">Reason:</p>
                  <p className="text-neutral-600">{itemDetail.closed_reason}</p>
                  {itemDetail.closedByUser && (
                    <p className="text-sm text-neutral-500">
                      Resolved by {itemDetail.closedByUser.name}
                      {itemDetail.closed_at && ` on ${formatDateTime(itemDetail.closed_at)}`}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Owner */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Assigned To
              </CardTitle>
            </CardHeader>
            <CardContent>
              {itemDetail.owner ? (
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {itemDetail.owner.name
                        ?.split(' ')
                        .map((n: string) => n.charAt(0))
                        .slice(0, 2)
                        .join('') || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">{itemDetail.owner.name}</p>
                    <p className="text-xs text-neutral-500">{itemDetail.owner.email}</p>
                  </div>
                </div>
              ) : (
                <p className="text-neutral-500 text-sm">Unassigned</p>
              )}
            </CardContent>
          </Card>

          {/* Action History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Action History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {actionHistory && actionHistory.length > 0 ? (
                <div className="space-y-4">
                  {actionHistory.map((action) => (
                    <div
                      key={action._id}
                      className="relative pl-4 pb-4 border-l border-neutral-200 last:pb-0"
                    >
                      <div className="absolute -left-1.5 top-0 h-3 w-3 rounded-full bg-neutral-300" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          {actionTypeLabels[action.action_type] || action.action_type}
                        </p>
                        {action.notes && <p className="text-sm text-neutral-600">{action.notes}</p>}
                        <p className="text-xs text-neutral-500">
                          {action.actor?.name || 'System'}
                          {' · '}
                          {formatTimeAgo(action.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-neutral-500 text-sm">No actions recorded yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <ResolveDialog
        open={isResolveDialogOpen}
        onOpenChange={setIsResolveDialogOpen}
        onConfirm={handleConfirmResolve}
        isLoading={isLoading}
      />

      <SnoozeDialog
        open={isSnoozeDialogOpen}
        onOpenChange={setIsSnoozeDialogOpen}
        onConfirm={handleConfirmSnooze}
        isLoading={isLoading}
      />

      <QuickActionDialog
        open={isQuickActionDialogOpen}
        onOpenChange={setIsQuickActionDialogOpen}
        actionType={quickActionType}
        onConfirm={handleConfirmQuickAction}
        isLoading={isLoading}
      />
    </div>
  );
}
