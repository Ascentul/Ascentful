'use client';

/**
 * Advisor Inbox Page
 *
 * Threaded messaging interface for advisor-student communication.
 * Supports status workflow, SLA tracking, and queue integration.
 */

import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import {
  AlertCircle,
  Clock,
  Filter,
  Inbox,
  MessageSquare,
  Plus,
  Search,
  UserX,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type StatusFilter =
  | 'ALL_ACTIVE'
  | 'NEW'
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_ON_STUDENT'
  | 'RESOLVED';

type AssignmentFilter = 'me' | 'unassigned' | 'all';

const priorityConfig = {
  P1: { label: 'P1', className: 'bg-red-500 text-white' },
  P2: { label: 'P2', className: 'bg-orange-500 text-white' },
  P3: { label: 'P3', className: 'bg-neutral-300 text-neutral-700' },
};

const statusConfig = {
  NEW: { label: 'New', className: 'bg-blue-500 text-white' },
  OPEN: { label: 'Open', className: 'bg-green-500 text-white' },
  IN_PROGRESS: { label: 'In Progress', className: 'bg-yellow-500 text-white' },
  WAITING_ON_STUDENT: { label: 'Waiting', className: 'bg-purple-500 text-white' },
  WAITING_ON_STAFF: { label: 'Waiting Staff', className: 'bg-orange-500 text-white' },
  RESOLVED: { label: 'Resolved', className: 'bg-neutral-400 text-white' },
  ARCHIVED: { label: 'Archived', className: 'bg-neutral-300 text-neutral-500' },
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

function formatSLARemaining(
  slaDueAt: number | undefined,
  slaBreached: boolean | undefined,
): string {
  if (!slaDueAt) return '';
  if (slaBreached) return 'Overdue';

  const remaining = slaDueAt - Date.now();
  if (remaining < 0) return 'Overdue';

  const hours = Math.floor(remaining / (60 * 60 * 1000));
  if (hours < 1) {
    const minutes = Math.floor(remaining / (60 * 1000));
    return `${minutes}m left`;
  }
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  return `${days}d left`;
}

export default function InboxPage() {
  const { toast } = useToast();

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL_ACTIVE');
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>('me');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState<Id<'inbox_threads'> | null>(null);

  // Queries
  const threads = useQuery(api.inbox_threads.listThreads, {
    status: statusFilter,
    assignedTo: assignmentFilter === 'all' ? undefined : assignmentFilter,
    search: searchQuery || undefined,
    sortBy: 'newest',
    limit: 50,
  });

  const unreadCounts = useQuery(api.inbox_threads.getUnreadCounts, {});

  const selectedThread = useQuery(
    api.inbox_threads.getThreadDetail,
    selectedThreadId ? { threadId: selectedThreadId } : 'skip',
  );

  // Mutations
  const markAsRead = useMutation(api.inbox_threads_mutations.markAsRead);
  const updateStatus = useMutation(api.inbox_threads_mutations.updateStatus);
  const addMessage = useMutation(api.inbox_messages.addMessage);
  const addInternalNote = useMutation(api.inbox_messages.addInternalNote);
  const createQueueItem = useMutation(api.inbox_queue_integration.createQueueItemFromThread);

  const handleSelectThread = async (threadId: Id<'inbox_threads'>) => {
    setSelectedThreadId(threadId);
    try {
      await markAsRead({ threadId });
    } catch (error) {
      // Silently fail for read state
    }
  };

  const isLoading = threads === undefined;

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Header */}
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Inbox className="h-6 w-6 text-primary-500" />
            <h1 className="text-2xl font-semibold">Inbox</h1>
            {unreadCounts && unreadCounts.totalUnread > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCounts.totalUnread} unread
              </Badge>
            )}
          </div>
          <Button disabled title="Coming soon">
            <Plus className="mr-2 h-4 w-4" />
            New Message
          </Button>
        </div>

        {/* Stats */}
        {unreadCounts && (
          <div className="mt-4 flex gap-4">
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <MessageSquare className="h-4 w-4" />
              <span>{unreadCounts.totalActive} active</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                {unreadCounts.newThreads} new
              </Badge>
            </div>
            {unreadCounts.slaBreach > 0 && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span>{unreadCounts.slaBreach} overdue</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <UserX className="h-4 w-4" />
              <span>{unreadCounts.unassigned} unassigned</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Content - Split View */}
      <div className="flex flex-1 overflow-hidden">
        {/* Thread List */}
        <div className="w-[400px] flex-shrink-0 border-r bg-white">
          {/* Filters */}
          <div className="border-b p-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  placeholder="Search threads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as StatusFilter)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_ACTIVE">All Active</SelectItem>
                  <SelectItem value="NEW">New</SelectItem>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="WAITING_ON_STUDENT">Waiting</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Tabs
              value={assignmentFilter}
              onValueChange={(v) => setAssignmentFilter(v as AssignmentFilter)}
              className="mt-3"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="me">My Inbox</TabsTrigger>
                <TabsTrigger value="unassigned">Unassigned</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Thread List */}
          <div className="overflow-y-auto" style={{ height: 'calc(100% - 130px)' }}>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
              </div>
            ) : threads?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
                <Inbox className="mb-3 h-12 w-12 opacity-50" />
                <p>No threads found</p>
              </div>
            ) : (
              threads?.map((thread) => (
                <div
                  key={thread._id}
                  onClick={() => handleSelectThread(thread._id)}
                  className={cn(
                    'cursor-pointer border-b px-4 py-3 transition-colors hover:bg-neutral-50',
                    selectedThreadId === thread._id &&
                      'bg-primary-50 border-l-2 border-l-primary-500',
                    thread.hasUnread && 'bg-blue-50/50',
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Priority Badge */}
                    <Badge
                      className={cn(
                        'mt-1 min-w-[28px] justify-center text-xs',
                        priorityConfig[thread.priority].className,
                      )}
                    >
                      {thread.priority}
                    </Badge>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {thread.student ? (
                          <span className="font-medium truncate">
                            {thread.student.name || thread.student.email}
                          </span>
                        ) : thread.external_sender_email ? (
                          <span className="font-medium text-orange-600 truncate">
                            {thread.external_sender_name || thread.external_sender_email}
                          </span>
                        ) : (
                          <span className="font-medium text-neutral-500">Unknown</span>
                        )}
                        {thread.hasUnread && <div className="h-2 w-2 rounded-full bg-blue-500" />}
                      </div>

                      <p className="text-sm font-medium truncate">{thread.subject}</p>

                      {thread.snippet && (
                        <p className="text-xs text-neutral-500 truncate mt-0.5">{thread.snippet}</p>
                      )}

                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge
                          variant="outline"
                          className={cn('text-xs', statusConfig[thread.status].className)}
                        >
                          {statusConfig[thread.status].label}
                        </Badge>
                        <span className="text-xs text-neutral-400">
                          {formatTimeAgo(thread.last_message_at)}
                        </span>
                        {thread.sla_due_at && !['RESOLVED', 'ARCHIVED'].includes(thread.status) && (
                          <span
                            className={cn(
                              'text-xs',
                              thread.sla_breached || thread.sla_due_at < Date.now()
                                ? 'text-red-500 font-medium'
                                : 'text-neutral-400',
                            )}
                          >
                            {formatSLARemaining(thread.sla_due_at, thread.sla_breached)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Thread Detail */}
        <div className="flex-1 bg-neutral-50">
          {selectedThread ? (
            <ThreadDetailView
              thread={selectedThread.thread}
              messages={selectedThread.messages}
              actions={selectedThread.actions}
              onAddMessage={async (body, isInternal) => {
                try {
                  if (isInternal) {
                    await addInternalNote({ threadId: selectedThread.thread._id, body });
                  } else {
                    await addMessage({ threadId: selectedThread.thread._id, body });
                  }
                  toast({
                    title: isInternal ? 'Note added' : 'Message sent',
                    description: isInternal
                      ? 'Internal note has been added.'
                      : 'Your message has been sent.',
                  });
                } catch (error) {
                  toast({
                    title: 'Error',
                    description: 'Failed to send message. Please try again.',
                    variant: 'destructive',
                  });
                  throw error;
                }
              }}
              onUpdateStatus={async (status) => {
                await updateStatus({
                  threadId: selectedThread.thread._id,
                  status: status as
                    | 'NEW'
                    | 'OPEN'
                    | 'IN_PROGRESS'
                    | 'WAITING_ON_STUDENT'
                    | 'WAITING_ON_STAFF'
                    | 'RESOLVED'
                    | 'ARCHIVED',
                });
                toast({
                  title: 'Status updated',
                  description: `Thread status changed to ${status.replace(/_/g, ' ').toLowerCase()}.`,
                });
              }}
              onCreateQueueItem={async () => {
                await createQueueItem({
                  threadId: selectedThread.thread._id,
                });
                toast({
                  title: 'Queue item created',
                  description: 'A new queue item has been linked to this thread.',
                });
              }}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-neutral-500">
              <MessageSquare className="mb-3 h-16 w-16 opacity-30" />
              <p className="text-lg">Select a thread to view</p>
              <p className="text-sm">Choose a conversation from the list</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Thread Detail Component (inline for now)
interface ThreadDetailViewProps {
  thread: {
    _id: Id<'inbox_threads'>;
    subject: string;
    status: string;
    priority: string;
    student: {
      _id: Id<'users'>;
      name: string;
      email: string;
      imageUrl?: string;
    } | null;
    assignee: {
      _id: Id<'users'>;
      name: string;
      email: string;
    } | null;
    linkedQueueItem: {
      _id: Id<'queue_items'>;
      title: string;
      status: string;
      priority: string;
    } | null;
    external_sender_email?: string;
    external_sender_name?: string;
    identity_status: string;
    sla_due_at?: number;
    sla_breached?: boolean;
    created_at: number;
  };
  messages: Array<{
    _id: Id<'inbox_messages'>;
    body: string;
    body_html?: string;
    sender_type: string;
    sender_user_id?: Id<'users'>;
    senderUser: {
      _id: Id<'users'>;
      name: string;
      email: string;
      imageUrl?: string;
    } | null;
    is_internal: boolean;
    created_at: number;
  }>;
  actions: Array<{
    _id: Id<'inbox_thread_actions'>;
    action_type: string;
    actor: {
      _id: Id<'users'>;
      name: string;
      email: string;
    } | null;
    notes?: string;
    created_at: number;
  }>;
  onAddMessage: (body: string, isInternal: boolean) => Promise<void>;
  onUpdateStatus: (
    status:
      | 'NEW'
      | 'OPEN'
      | 'IN_PROGRESS'
      | 'WAITING_ON_STUDENT'
      | 'WAITING_ON_STAFF'
      | 'RESOLVED'
      | 'ARCHIVED',
  ) => Promise<void>;
  onCreateQueueItem: () => Promise<void>;
}

function ThreadDetailView({
  thread,
  messages,
  actions,
  onAddMessage,
  onUpdateStatus,
  onCreateQueueItem,
}: ThreadDetailViewProps) {
  const [newMessage, setNewMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCreatingQueueItem, setIsCreatingQueueItem] = useState(false);

  const handleCreateQueueItem = async () => {
    setIsCreatingQueueItem(true);
    try {
      await onCreateQueueItem();
    } finally {
      setIsCreatingQueueItem(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    setIsSending(true);
    try {
      await onAddMessage(newMessage, isInternal);
      setNewMessage('');
    } catch {
      // Error toast shown by parent, message field preserved for retry
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Thread Header */}
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">{thread.subject}</h2>
            <div className="mt-1 flex items-center gap-3">
              {thread.student ? (
                <Link
                  href={`/u/students/${thread.student._id}`}
                  className="flex items-center gap-2 hover:underline"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={thread.student.imageUrl} />
                    <AvatarFallback className="text-xs">
                      {thread.student.name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{thread.student.name || thread.student.email}</span>
                </Link>
              ) : thread.external_sender_email ? (
                <div className="flex items-center gap-2 text-orange-600">
                  <UserX className="h-4 w-4" />
                  <span className="text-sm">
                    {thread.external_sender_name || thread.external_sender_email}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    Unmatched
                  </Badge>
                </div>
              ) : null}

              <Badge
                className={cn(
                  'text-xs',
                  priorityConfig[thread.priority as keyof typeof priorityConfig].className,
                )}
              >
                {thread.priority}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  'text-xs',
                  statusConfig[thread.status as keyof typeof statusConfig].className,
                )}
              >
                {statusConfig[thread.status as keyof typeof statusConfig].label}
              </Badge>

              {thread.sla_due_at && !['RESOLVED', 'ARCHIVED'].includes(thread.status) && (
                <div
                  className={cn(
                    'flex items-center gap-1 text-xs',
                    thread.sla_breached || thread.sla_due_at < Date.now()
                      ? 'text-red-500'
                      : 'text-neutral-500',
                  )}
                >
                  <Clock className="h-3 w-3" />
                  {formatSLARemaining(thread.sla_due_at, thread.sla_breached)}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {thread.linkedQueueItem ? (
              <Link href={`/u/queue/${thread.linkedQueueItem._id}`}>
                <Button variant="outline" size="sm">
                  View Queue Item
                </Button>
              </Link>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateQueueItem}
                disabled={isCreatingQueueItem || !thread.student}
              >
                {isCreatingQueueItem ? 'Creating...' : 'Create Queue Item'}
              </Button>
            )}

            <Select
              value={thread.status}
              onValueChange={(v) =>
                onUpdateStatus(
                  v as
                    | 'NEW'
                    | 'OPEN'
                    | 'IN_PROGRESS'
                    | 'WAITING_ON_STUDENT'
                    | 'WAITING_ON_STAFF'
                    | 'RESOLVED'
                    | 'ARCHIVED',
                )
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="WAITING_ON_STUDENT">Waiting on Student</SelectItem>
                <SelectItem value="WAITING_ON_STAFF">Waiting on Staff</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message) => (
          <div
            key={message._id}
            className={cn(
              'flex',
              message.sender_type === 'advisor' || message.sender_type === 'system'
                ? 'justify-end'
                : 'justify-start',
            )}
          >
            <div
              className={cn(
                'max-w-[70%] rounded-lg px-4 py-2',
                message.is_internal
                  ? 'bg-yellow-100 border border-yellow-300'
                  : message.sender_type === 'advisor' || message.sender_type === 'system'
                    ? 'bg-primary-500 text-white'
                    : 'bg-white border',
              )}
            >
              {message.is_internal && (
                <div className="text-xs font-medium text-yellow-700 mb-1">Internal Note</div>
              )}
              <p className="text-sm whitespace-pre-wrap">{message.body}</p>
              <div
                className={cn(
                  'text-xs mt-1',
                  message.is_internal
                    ? 'text-yellow-600'
                    : message.sender_type === 'advisor' || message.sender_type === 'system'
                      ? 'text-primary-200'
                      : 'text-neutral-400',
                )}
              >
                {message.senderUser?.name || 'System'} - {formatTimeAgo(message.created_at)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Compose */}
      <div className="border-t bg-white p-4">
        <div className="flex items-center gap-2 mb-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="rounded border-neutral-300"
            />
            <span className={isInternal ? 'text-yellow-700 font-medium' : 'text-neutral-600'}>
              Internal Note (not visible to student)
            </span>
          </label>
        </div>
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={isInternal ? 'Add an internal note...' : 'Type your reply...'}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className={isInternal ? 'border-yellow-300 bg-yellow-50' : ''}
          />
          <Button onClick={handleSend} disabled={isSending || !newMessage.trim()}>
            {isSending ? 'Sending...' : isInternal ? 'Add Note' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}
