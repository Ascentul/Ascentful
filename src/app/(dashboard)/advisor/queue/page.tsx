'use client';

import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock,
  Filter,
  Inbox,
  MoreHorizontal,
  Pause,
  User,
  X,
} from 'lucide-react';
import Link from 'next/link';
import React, { useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { useToast } from '@/hooks/use-toast';

type SignalType =
  | 'needs_outreach'
  | 'application_support'
  | 'document_review'
  | 'milestone_check'
  | 'custom';
type Priority = 'low' | 'medium' | 'high' | 'urgent';
type Status = 'active' | 'snoozed' | 'resolved' | 'dismissed';

const signalTypeLabels: Record<SignalType, string> = {
  needs_outreach: 'Needs Outreach',
  application_support: 'Application Support',
  document_review: 'Document Review',
  milestone_check: 'Milestone Check',
  custom: 'Custom',
};

const signalTypeIcons: Record<SignalType, React.ReactNode> = {
  needs_outreach: <Bell className="h-4 w-4" />,
  application_support: <AlertTriangle className="h-4 w-4" />,
  document_review: <Inbox className="h-4 w-4" />,
  milestone_check: <CheckCircle2 className="h-4 w-4" />,
  custom: <Bell className="h-4 w-4" />,
};

const priorityColors: Record<Priority, string> = {
  urgent: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-gray-200 text-gray-700',
};

export default function AdvisorQueuePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const universityId = user?.university_id as Id<'universities'> | undefined;

  // State
  const [statusFilter, setStatusFilter] = useState<Status>('active');
  const [typeFilter, setTypeFilter] = useState<SignalType | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [selectedSignal, setSelectedSignal] = useState<Id<'signals'> | null>(null);
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const [isSnoozeDialogOpen, setIsSnoozeDialogOpen] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [snoozeDays, setSnoozeDays] = useState(3);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // Reset page when filters change
  const handleStatusFilterChange = (value: Status) => {
    setStatusFilter(value);
    setPage(1);
  };
  const handleTypeFilterChange = (value: SignalType | 'all') => {
    setTypeFilter(value);
    setPage(1);
  };
  const handlePriorityFilterChange = (value: Priority | 'all') => {
    setPriorityFilter(value);
    setPage(1);
  };

  // Queries
  const queueData = useQuery(
    api.signals.getAdvisorQueue,
    universityId
      ? {
          universityId,
          status: statusFilter,
          signalType: typeFilter === 'all' ? undefined : typeFilter,
          priority: priorityFilter === 'all' ? undefined : priorityFilter,
          limit: PAGE_SIZE * page,
        }
      : 'skip',
  );

  const stats = useQuery(api.signals.getQueueStats, universityId ? { universityId } : 'skip');

  // Mutations
  const resolveSignal = useMutation(api.signals.resolveSignal);
  const dismissSignal = useMutation(api.signals.dismissSignal);
  const snoozeSignal = useMutation(api.signals.snoozeSignal);
  const unsnoozeSignal = useMutation(api.signals.unsnoozeSignal);

  const handleResolve = async (resolutionType: 'action_taken' | 'no_action_needed') => {
    if (!selectedSignal) return;

    setLoading(true);
    try {
      await resolveSignal({
        signalId: selectedSignal,
        resolutionType,
        resolutionNotes: resolutionNotes || undefined,
      });
      toast({
        title: 'Signal Resolved',
        description: 'The signal has been marked as resolved.',
      });
      setIsResolveDialogOpen(false);
      setSelectedSignal(null);
      setResolutionNotes('');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to resolve signal.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (signalId: Id<'signals'>) => {
    try {
      await dismissSignal({
        signalId,
      });
      toast({
        title: 'Signal Dismissed',
        description: 'The signal has been dismissed.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to dismiss signal.',
        variant: 'destructive',
      });
    }
  };

  const handleSnooze = async () => {
    if (!selectedSignal) return;

    setLoading(true);
    try {
      await snoozeSignal({
        signalId: selectedSignal,
        snoozeDays,
      });
      toast({
        title: 'Signal Snoozed',
        description: `The signal will reappear in ${snoozeDays} days.`,
      });
      setIsSnoozeDialogOpen(false);
      setSelectedSignal(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to snooze signal.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnsnooze = async (signalId: Id<'signals'>) => {
    try {
      await unsnoozeSignal({
        signalId,
      });
      toast({
        title: 'Signal Unsnoozed',
        description: 'The signal is now active again.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to unsnooze signal.',
        variant: 'destructive',
      });
    }
  };

  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (!universityId) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">No university access.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Action Queue</h1>
        <p className="text-muted-foreground">Prioritized signals requiring advisor attention.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Signals</p>
                <p className="text-3xl font-bold">{stats?.total ?? 0}</p>
              </div>
              <Bell className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700">Urgent</p>
                <p className="text-3xl font-bold text-red-700">{stats?.byPriority.urgent ?? 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-700">High Priority</p>
                <p className="text-3xl font-bold text-orange-700">{stats?.byPriority.high ?? 0}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Snoozed</p>
                <p className="text-3xl font-bold">{stats?.snoozed ?? 0}</p>
              </div>
              <Pause className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <Tabs
          value={statusFilter}
          onValueChange={(v) => handleStatusFilterChange(v as Status)}
          className="w-auto"
        >
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="snoozed">Snoozed</TabsTrigger>
            <TabsTrigger value="resolved">Resolved</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select
          value={typeFilter}
          onValueChange={(v) => handleTypeFilterChange(v as SignalType | 'all')}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="needs_outreach">Needs Outreach</SelectItem>
            <SelectItem value="application_support">Application Support</SelectItem>
            <SelectItem value="document_review">Document Review</SelectItem>
            <SelectItem value="milestone_check">Milestone Check</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={priorityFilter}
          onValueChange={(v) => handlePriorityFilterChange(v as Priority | 'all')}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Signals List */}
      {!queueData ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      ) : queueData.signals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Inbox className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">Queue Empty</h3>
            <p className="text-center text-muted-foreground">
              {statusFilter === 'active'
                ? 'No active signals requiring attention.'
                : statusFilter === 'snoozed'
                  ? 'No snoozed signals.'
                  : 'No resolved signals.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {queueData.signals.map((signal) => (
            <Card key={signal._id} className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-center gap-4 py-4">
                {/* Priority Indicator */}
                <Badge className={priorityColors[signal.priority]}>
                  {signal.priority.charAt(0).toUpperCase()}
                </Badge>

                {/* Signal Type Icon */}
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  {signalTypeIcons[signal.signal_type]}
                </div>

                {/* Student Info */}
                <Link
                  href={`/advisor/students/${signal.student_id}`}
                  className="flex items-center gap-3 hover:underline"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={signal.student?.profileImage} />
                    <AvatarFallback>
                      {signal.student?.name?.charAt(0) || <User className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{signal.student?.name || 'Unknown Student'}</p>
                    <p className="text-sm text-muted-foreground">{signal.student?.email}</p>
                  </div>
                </Link>

                {/* Signal Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{signal.title}</p>
                    <Badge variant="outline">{signalTypeLabels[signal.signal_type]}</Badge>
                  </div>
                  {signal.description && (
                    <p className="text-sm text-muted-foreground">{signal.description}</p>
                  )}
                </div>

                {/* Time */}
                <div className="text-sm text-muted-foreground">
                  {formatTimeAgo(signal.triggered_at)}
                </div>

                {/* Actions */}
                {statusFilter === 'active' && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedSignal(signal._id);
                        setIsResolveDialogOpen(true);
                      }}
                    >
                      <CheckCircle2 className="mr-1 h-4 w-4" />
                      Resolve
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedSignal(signal._id);
                            setIsSnoozeDialogOpen(true);
                          }}
                        >
                          <Pause className="mr-2 h-4 w-4" />
                          Snooze
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handleDismiss(signal._id)}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Dismiss
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}

                {statusFilter === 'snoozed' && (
                  <Button size="sm" variant="outline" onClick={() => handleUnsnooze(signal._id)}>
                    Unsnooze
                  </Button>
                )}

                {statusFilter === 'resolved' && (
                  <Badge variant="secondary">
                    {signal.resolution_type?.replace(/_/g, ' ') || 'Resolved'}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}

          {queueData.hasMore && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" onClick={() => setPage((p) => p + 1)}>
                Load More
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Resolve Dialog */}
      <Dialog open={isResolveDialogOpen} onOpenChange={setIsResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Signal</DialogTitle>
            <DialogDescription>
              Mark this signal as resolved. You can add optional notes about the action taken.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Describe the action taken or outcome..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setIsResolveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleResolve('no_action_needed')}
              disabled={loading}
            >
              No Action Needed
            </Button>
            <Button onClick={() => handleResolve('action_taken')} disabled={loading}>
              {loading ? 'Saving...' : 'Action Taken'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Snooze Dialog */}
      <Dialog open={isSnoozeDialogOpen} onOpenChange={setIsSnoozeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Snooze Signal</DialogTitle>
            <DialogDescription>
              Temporarily hide this signal. It will reappear after the snooze period.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="snoozeDays">Snooze for</Label>
              <Select value={String(snoozeDays)} onValueChange={(v) => setSnoozeDays(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 day</SelectItem>
                  <SelectItem value="3">3 days</SelectItem>
                  <SelectItem value="7">1 week</SelectItem>
                  <SelectItem value="14">2 weeks</SelectItem>
                  <SelectItem value="30">1 month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSnoozeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSnooze} disabled={loading}>
              {loading ? 'Snoozing...' : 'Snooze'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
