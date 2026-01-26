'use client';

/**
 * Action Queue Page
 *
 * Displays prioritized queue items for advisor workflow.
 * Queue items are "owned commitments" that may reference signals
 * but have their own lifecycle.
 */

import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { Filter, Inbox, Plus, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  QueueItemCard,
  QueueStats,
  QuickActionDialog,
  ResolveDialog,
  SnoozeDialog,
} from '@/components/queue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

type StatusFilter = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'ALL';
type PriorityFilter = 'P1' | 'P2' | 'P3' | 'ALL';
type QuickActionType = 'contacted' | 'scheduled_appointment';

export default function QueuePage() {
  const router = useRouter();
  const { toast } = useToast();

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('OPEN');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('ALL');
  const [includeSnoozed, setIncludeSnoozed] = useState(false);

  // Dialog state
  const [selectedItemId, setSelectedItemId] = useState<Id<'queue_items'> | null>(null);
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const [isSnoozeDialogOpen, setIsSnoozeDialogOpen] = useState(false);
  const [isQuickActionDialogOpen, setIsQuickActionDialogOpen] = useState(false);
  const [quickActionType, setQuickActionType] = useState<QuickActionType>('contacted');
  const [isLoading, setIsLoading] = useState(false);

  // Queries
  const queueItems = useQuery(api.queue_items.getMyQueue, {
    status: statusFilter === 'ALL' ? 'ALL' : statusFilter,
    priority: priorityFilter === 'ALL' ? undefined : priorityFilter,
    includeSnoozed,
  });

  const stats = useQuery(api.queue_items.getQueueStats, {});

  // Mutations
  const resolveItem = useMutation(api.queue_items.resolveQueueItem);
  const snoozeItem = useMutation(api.queue_items.snoozeQueueItem);
  const unsnoozeItem = useMutation(api.queue_items.unsnoozeQueueItem);
  const updateStatus = useMutation(api.queue_items.updateQueueItemStatus);
  const logQuickAction = useMutation(api.queue_items.logQuickAction);

  // Handlers
  const handleResolve = (id: Id<'queue_items'>) => {
    setSelectedItemId(id);
    setIsResolveDialogOpen(true);
  };

  const handleConfirmResolve = async (closedReason: string, notes?: string) => {
    if (!selectedItemId) return;
    setIsLoading(true);
    try {
      await resolveItem({
        queueItemId: selectedItemId,
        closedReason,
        notes,
      });
      toast({
        title: 'Item Resolved',
        description: 'The queue item has been marked as resolved.',
      });
      setIsResolveDialogOpen(false);
      setSelectedItemId(null);
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

  const handleSnooze = (id: Id<'queue_items'>) => {
    setSelectedItemId(id);
    setIsSnoozeDialogOpen(true);
  };

  const handleConfirmSnooze = async (snoozeUntil: number, notes?: string) => {
    if (!selectedItemId) return;
    setIsLoading(true);
    try {
      await snoozeItem({
        queueItemId: selectedItemId,
        snoozeUntil,
        notes,
      });
      toast({
        title: 'Item Snoozed',
        description: 'The item will reappear after the snooze period.',
      });
      setIsSnoozeDialogOpen(false);
      setSelectedItemId(null);
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

  const handleUnsnooze = async (id: Id<'queue_items'>) => {
    setIsLoading(true);
    try {
      await unsnoozeItem({ queueItemId: id });
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

  const handleContacted = (id: Id<'queue_items'>) => {
    setSelectedItemId(id);
    setQuickActionType('contacted');
    setIsQuickActionDialogOpen(true);
  };

  const handleScheduled = (id: Id<'queue_items'>) => {
    setSelectedItemId(id);
    setQuickActionType('scheduled_appointment');
    setIsQuickActionDialogOpen(true);
  };

  const handleConfirmQuickAction = async (notes?: string) => {
    if (!selectedItemId) return;
    setIsLoading(true);
    try {
      await logQuickAction({
        queueItemId: selectedItemId,
        actionType: quickActionType,
        notes,
      });
      toast({
        title: quickActionType === 'contacted' ? 'Contact Logged' : 'Appointment Scheduled',
        description: 'Action has been recorded.',
      });
      setIsQuickActionDialogOpen(false);
      setSelectedItemId(null);
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

  const handleStartProgress = async (id: Id<'queue_items'>) => {
    setIsLoading(true);
    try {
      await updateStatus({
        queueItemId: id,
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

  const handleViewDetail = (id: Id<'queue_items'>) => {
    router.push(`/u/queue/${id}`);
  };

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Action Queue</h1>
          <p className="text-neutral-500">Prioritized items requiring advisor attention.</p>
        </div>
      </div>

      {/* Stats */}
      <QueueStats stats={stats ?? null} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <Tabs
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          className="w-auto"
        >
          <TabsList>
            <TabsTrigger value="OPEN">
              Open
              {stats?.open ? (
                <Badge variant="secondary" className="ml-2">
                  {stats.open}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="IN_PROGRESS">
              In Progress
              {stats?.inProgress ? (
                <Badge variant="secondary" className="ml-2">
                  {stats.inProgress}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="RESOLVED">Resolved</TabsTrigger>
            <TabsTrigger value="ALL">All</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select
          value={priorityFilter}
          onValueChange={(v) => setPriorityFilter(v as PriorityFilter)}
        >
          <SelectTrigger className="w-[150px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="All Priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Priorities</SelectItem>
            <SelectItem value="P1">P1 (Urgent)</SelectItem>
            <SelectItem value="P2">P2 (Normal)</SelectItem>
            <SelectItem value="P3">P3 (Low)</SelectItem>
          </SelectContent>
        </Select>

        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={includeSnoozed}
            onChange={(e) => setIncludeSnoozed(e.target.checked)}
            className="rounded border-neutral-300"
          />
          Show Snoozed
        </label>
      </div>

      {/* Queue Items List */}
      {!queueItems ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      ) : queueItems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Inbox className="mb-4 h-12 w-12 text-neutral-400" />
            <h3 className="mb-2 text-lg font-semibold">Queue Empty</h3>
            <p className="text-center text-neutral-500">
              {statusFilter === 'OPEN'
                ? 'No open items requiring attention.'
                : statusFilter === 'IN_PROGRESS'
                  ? 'No items in progress.'
                  : statusFilter === 'RESOLVED'
                    ? 'No resolved items.'
                    : 'No queue items found.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {queueItems.map((item) => (
            <QueueItemCard
              key={item._id}
              item={item}
              isLoading={isLoading}
              onResolve={handleResolve}
              onSnooze={handleSnooze}
              onContacted={handleContacted}
              onScheduled={handleScheduled}
              onUnsnooze={handleUnsnooze}
              onStartProgress={handleStartProgress}
              onViewDetail={handleViewDetail}
            />
          ))}
        </div>
      )}

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
