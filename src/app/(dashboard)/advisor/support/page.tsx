'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  HelpCircle,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { AdvisorGate } from '@/components/advisor/AdvisorGate';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface SupportTicket {
  _id: Id<'support_tickets'>;
  _creationTime: number;
  user_id: Id<'users'>;
  subject: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  department: string;
  contact_person?: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  ticket_type: string;
  assigned_to?: Id<'users'>;
  resolution?: string;
  resolved_at?: number;
  created_at: number;
  updated_at: number;
}

export default function AdvisorSupportPage() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const { toast } = useToast();

  // State
  const [activeTab, setActiveTab] = useState<
    'all' | 'open' | 'in_progress' | 'resolved' | 'closed'
  >('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketToDelete, setTicketToDelete] = useState<Id<'support_tickets'> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Form state
  const [formData, setFormData] = useState({
    subject: '',
    category: 'general',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    description: '',
  });

  const [responseText, setResponseText] = useState('');
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const responseEntries = useMemo(() => {
    if (!selectedTicket?.resolution) return [];
    try {
      return selectedTicket.resolution
        .split(/\n\n+/)
        .filter(Boolean)
        .map((entry) => {
          // Match format: [timestamp] author: message
          const match = entry.match(/^\s*\[([^\]]+)\]\s*([^:]+):\s*([\s\S]*)$/);
          if (match) {
            const ts = match[1];
            const author = match[2].trim();
            const message = match[3].trim();
            const parsedDate = new Date(ts);
            const timestamp = isNaN(parsedDate.getTime()) ? ts : parsedDate.toLocaleString();
            return { author, message, timestamp, raw: entry };
          }
          return { author: 'Response', message: entry.trim(), timestamp: null, raw: entry };
        });
    } catch {
      // Fallback: treat entire resolution as a single response blob
      return [
        {
          author: 'Response',
          message: selectedTicket.resolution,
          timestamp: null,
          raw: selectedTicket.resolution,
        },
      ];
    }
  }, [selectedTicket?.resolution]);

  // Queries
  const tickets = useQuery(
    api.support_tickets.listTickets,
    clerkUser?.id ? { clerkId: clerkUser.id } : 'skip',
  );

  // Mutations
  const createTicket = useMutation(api.support_tickets.createTicket);
  const updateTicketStatus = useMutation(api.support_tickets.updateTicketStatus);
  const addResponse = useMutation(api.support_tickets.addTicketResponse);
  const deleteTicket = useMutation(api.support_tickets.deleteTicket);

  // Sync selectedTicket with updated data from tickets query
  // This ensures the detail dialog shows fresh data after mutations
  // Note: We intentionally depend on selectedTicket._id only (not the full object)
  // to avoid infinite loops since we call setSelectedTicket in this effect
  React.useEffect(() => {
    if (selectedTicket && tickets) {
      const updated = tickets.find((t) => t._id === selectedTicket._id);
      if (updated) {
        setSelectedTicket(updated);
      } else {
        // Ticket was deleted externally - close dialog and clear state
        setSelectedTicket(null);
        setDetailDialogOpen(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets, selectedTicket?._id]);

  // Filter tickets
  const filteredTickets = useMemo(() => {
    if (!tickets) return [];

    let filtered = tickets;

    // Status filter
    if (activeTab !== 'all') {
      filtered = filtered.filter((t) => t.status === activeTab);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter((t) => t.priority === priorityFilter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((t) => t.category === categoryFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.subject?.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query) ||
          t.contact_person?.toLowerCase().includes(query),
      );
    }

    return filtered;
  }, [tickets, activeTab, priorityFilter, categoryFilter, searchQuery]);

  // Memoize ticket stats to avoid repeated array iterations
  const ticketStats = useMemo(() => {
    if (!tickets) return { total: 0, open: 0, inProgress: 0, resolved: 0 };
    return {
      total: tickets.length,
      open: tickets.filter((t) => t.status === 'open').length,
      inProgress: tickets.filter((t) => t.status === 'in_progress').length,
      resolved: tickets.filter((t) => t.status === 'resolved').length,
    };
  }, [tickets]);

  // Handle create ticket
  const handleCreateTicket = async () => {
    if (!clerkUser?.id || !formData.subject || !formData.description) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    if (isCreating) return;
    setIsCreating(true);

    try {
      await createTicket({
        clerkId: clerkUser.id,
        subject: formData.subject,
        category: formData.category,
        priority: formData.priority,
        description: formData.description,
      });

      toast({
        title: 'Ticket created',
        description: 'Your support ticket has been created successfully',
        variant: 'success',
      });

      setCreateDialogOpen(false);
      setFormData({
        subject: '',
        category: 'general',
        priority: 'medium',
        description: '',
      });
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: 'Failed to create ticket. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Handle update status
  const handleUpdateStatus = async (
    ticketId: Id<'support_tickets'>,
    newStatus: 'open' | 'in_progress' | 'resolved' | 'closed',
  ) => {
    if (!clerkUser?.id) return;

    // Capture current ticket state for rollback
    const ticketSnapshot = selectedTicket ? { ...selectedTicket } : null;
    const originalStatus = ticketSnapshot?.status;

    // Optimistic update for the detail dialog only.
    // Table rows rely on Convex reactivity (useQuery auto-updates after mutation).
    // This is intentional: the detail dialog is the primary interaction point.
    if (ticketSnapshot && ticketSnapshot._id === ticketId) {
      setSelectedTicket({ ...ticketSnapshot, status: newStatus });
    }

    try {
      await updateTicketStatus({
        clerkId: clerkUser.id,
        ticketId,
        status: newStatus,
      });

      toast({
        title: 'Status updated',
        description: `Ticket status changed to ${newStatus}`,
        variant: 'success',
      });
    } catch (error: unknown) {
      // Revert optimistic update on error
      if (ticketSnapshot && ticketSnapshot._id === ticketId && originalStatus) {
        setSelectedTicket({ ...ticketSnapshot, status: originalStatus });
      }
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  // Handle add response
  const handleAddResponse = async () => {
    if (!clerkUser?.id || !selectedTicket || !responseText.trim()) return;

    if (isSubmittingResponse) return;
    setIsSubmittingResponse(true);
    try {
      await addResponse({
        clerkId: clerkUser.id,
        ticketId: selectedTicket._id,
        message: responseText.trim(),
      });

      toast({
        title: 'Response added',
        description: 'Your response has been posted',
        variant: 'success',
      });

      setResponseText('');
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add response',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingResponse(false);
    }
  };

  // Handle delete ticket - opens confirmation dialog
  const handleDeleteTicket = (ticketId: Id<'support_tickets'>) => {
    setTicketToDelete(ticketId);
    setDeleteDialogOpen(true);
  };

  // Confirm delete ticket - executes the deletion
  const confirmDeleteTicket = async () => {
    if (!clerkUser?.id || !ticketToDelete) return;

    setIsDeleting(true);
    try {
      await deleteTicket({
        clerkId: clerkUser.id,
        ticketId: ticketToDelete,
      });

      toast({
        title: 'Ticket deleted',
        description: 'The ticket has been permanently deleted',
        variant: 'success',
      });

      setDeleteDialogOpen(false);
      setTicketToDelete(null);
      setDetailDialogOpen(false);
      setSelectedTicket(null);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete ticket',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return (
          <Badge variant="default" className="bg-blue-600">
            <Clock className="h-3 w-3 mr-1" />
            Open
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge variant="default" className="bg-amber-600">
            <AlertTriangle className="h-3 w-3 mr-1" />
            In Progress
          </Badge>
        );
      case 'resolved':
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Resolved
          </Badge>
        );
      case 'closed':
        return (
          <Badge variant="secondary">
            <XCircle className="h-3 w-3 mr-1" />
            Closed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Get priority badge
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="destructive">Urgent</Badge>;
      case 'high':
        return (
          <Badge variant="default" className="bg-orange-600">
            High
          </Badge>
        );
      case 'medium':
        return <Badge variant="secondary">Medium</Badge>;
      case 'low':
        return <Badge variant="outline">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  // Handle unauthenticated state (prevents infinite loading)
  if (!clerkLoaded) {
    return (
      <AdvisorGate requiredFlag="advisor.support">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </AdvisorGate>
    );
  }

  if (!clerkUser?.id) {
    return (
      <AdvisorGate requiredFlag="advisor.support">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Please sign in to view support tickets.</p>
          </div>
        </div>
      </AdvisorGate>
    );
  }

  if (!tickets) {
    return (
      <AdvisorGate requiredFlag="advisor.support">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </AdvisorGate>
    );
  }

  return (
    <AdvisorGate requiredFlag="advisor.support">
      <div className="w-full">
        <div className="w-full gradient-border-bottom p-5 space-y-6 shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1
                className="text-3xl font-bold tracking-tight flex items-center gap-2"
                style={{ color: '#0C29AB' }}
              >
                <HelpCircle className="h-7 w-7" />
                Support Tickets
              </h1>
              <p className="text-muted-foreground">Submit and track your support requests</p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Ticket
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{ticketStats.total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Open</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{ticketStats.open}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">{ticketStats.inProgress}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{ticketStats.resolved}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Search */}
          <Card>
            <CardHeader>
              <CardTitle>My Tickets</CardTitle>
              <CardDescription>View and manage your support tickets</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tabs for status filter */}
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="open">Open</TabsTrigger>
                  <TabsTrigger value="in_progress">In Progress</TabsTrigger>
                  <TabsTrigger value="resolved">Resolved</TabsTrigger>
                  <TabsTrigger value="closed">Closed</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Search and filters */}
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <label htmlFor="ticket-search" className="sr-only">
                      Search tickets
                    </label>
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="ticket-search"
                      placeholder="Search tickets..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="feature_request">Feature Request</SelectItem>
                    <SelectItem value="bug_report">Bug Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tickets Table */}
              {filteredTickets.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No tickets found</p>
                  <Button
                    onClick={() => setCreateDialogOpen(true)}
                    variant="outline"
                    className="mt-4"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create your first ticket
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTickets.map((ticket) => (
                      <TableRow
                        key={String(ticket._id)}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          setSelectedTicket(ticket);
                          setDetailDialogOpen(true);
                        }}
                      >
                        <TableCell className="font-medium">{ticket.subject}</TableCell>
                        <TableCell className="capitalize">
                          {ticket.category.replace(/_/g, ' ')}
                        </TableCell>
                        <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                        <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(ticket.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTicket(ticket);
                              setDetailDialogOpen(true);
                            }}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Create Ticket Dialog */}
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Support Ticket</DialogTitle>
                <DialogDescription>Submit a new support request</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="subject">Subject *</Label>
                  <Input
                    id="subject"
                    placeholder="Brief description of the issue"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="category-select">Category *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(v) => setFormData({ ...formData, category: v })}
                    >
                      <SelectTrigger id="category-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="technical">Technical</SelectItem>
                        <SelectItem value="billing">Billing</SelectItem>
                        <SelectItem value="feature_request">Feature Request</SelectItem>
                        <SelectItem value="bug_report">Bug Report</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="priority-select">Priority *</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(v) =>
                        setFormData({ ...formData, priority: v as typeof formData.priority })
                      }
                    >
                      <SelectTrigger id="priority-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Provide detailed information about your issue..."
                    rows={6}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTicket} disabled={isCreating}>
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Submit Ticket
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Ticket Detail Dialog */}
          <Dialog
            open={detailDialogOpen}
            onOpenChange={(open) => {
              setDetailDialogOpen(open);
              if (!open) setResponseText('');
            }}
          >
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
              {selectedTicket && (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      {selectedTicket.subject}
                    </DialogTitle>
                    <DialogDescription>
                      Ticket #{String(selectedTicket._id).slice(-6)}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    {/* Ticket Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Status</Label>
                        <div className="mt-1 flex items-center gap-2">
                          {getStatusBadge(selectedTicket.status)}
                          <Select
                            value={selectedTicket.status}
                            onValueChange={(value) =>
                              handleUpdateStatus(
                                selectedTicket._id,
                                value as 'open' | 'in_progress' | 'resolved' | 'closed',
                              )
                            }
                          >
                            <SelectTrigger className="w-[140px] h-8 text-xs">
                              <SelectValue placeholder="Change status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Priority</Label>
                        <div className="mt-1">{getPriorityBadge(selectedTicket.priority)}</div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Category</Label>
                        <div className="mt-1 capitalize">
                          {selectedTicket.category.replace(/_/g, ' ')}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Created</Label>
                        <div className="mt-1">
                          {new Date(selectedTicket.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <Label className="text-xs text-muted-foreground">Description</Label>
                      <Card className="mt-2">
                        <CardContent className="pt-4">
                          <p className="text-sm whitespace-pre-wrap">
                            {selectedTicket.description}
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Add Response */}
                    {responseEntries.length > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Responses</Label>
                        <Card className="mt-2">
                          <CardContent className="pt-4 space-y-3">
                            {responseEntries.map((entry, idx) => (
                              <div
                                key={idx}
                                className="text-sm border-b last:border-b-0 pb-2 last:pb-0 border-gray-200"
                              >
                                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                  <span className="font-medium text-gray-900">{entry.author}</span>
                                  {entry.timestamp && <span>{entry.timestamp}</span>}
                                </div>
                                <div className="whitespace-pre-wrap text-gray-800">
                                  {entry.message}
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    <div>
                      <Label htmlFor="response-textarea" className="text-xs text-muted-foreground">
                        Add Response
                      </Label>
                      <div className="mt-2 flex gap-2">
                        <Textarea
                          id="response-textarea"
                          placeholder="Type your response..."
                          value={responseText}
                          onChange={(e) => setResponseText(e.target.value)}
                          rows={3}
                          className="flex-1"
                          disabled={isSubmittingResponse}
                        />
                      </div>
                      <Button
                        onClick={handleAddResponse}
                        disabled={!responseText.trim() || isSubmittingResponse}
                        className="mt-2"
                        size="sm"
                      >
                        {isSubmittingResponse ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Send Response
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Dialog Footer with Delete Button */}
                  <DialogFooter className="flex justify-between sm:justify-between">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteTicket(selectedTicket._id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Ticket
                    </Button>
                    <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
                      Close
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Support Ticket</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this ticket? This action cannot be undone and the
                  ticket will be permanently removed from the system.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={() => {
                    setDeleteDialogOpen(false);
                    setTicketToDelete(null);
                  }}
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmDeleteTicket}
                  disabled={isDeleting}
                  className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Ticket'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </AdvisorGate>
  );
}
