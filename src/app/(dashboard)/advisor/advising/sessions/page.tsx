'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { endOfDay, format, startOfDay } from 'date-fns';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  User,
  Video,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { AdvisorGate } from '@/components/advisor/AdvisorGate';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { hasAdvisorAccess } from '@/lib/constants/roles';
import { isValidHttpUrl } from '@/lib/utils';

// Session type labels
const SESSION_TYPE_LABELS: Record<string, string> = {
  career_planning: 'Career Planning',
  resume_review: 'Resume Review',
  mock_interview: 'Mock Interview',
  application_strategy: 'Application Strategy',
  general_advising: 'General Advising',
  other: 'Other',
};

// Status badge variants
const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  scheduled: 'default',
  completed: 'secondary',
  cancelled: 'destructive',
  no_show: 'outline',
};

// Status icons
const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'scheduled':
      return <Clock className="h-3 w-3" />;
    case 'completed':
      return <CheckCircle className="h-3 w-3" />;
    case 'cancelled':
      return <XCircle className="h-3 w-3" />;
    case 'no_show':
      return <AlertCircle className="h-3 w-3" />;
    default:
      return null;
  }
};

export default function AdvisorSessionsPage() {
  const { user: clerkUser } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Check advisor access to prevent query errors before AdvisorGate renders
  const userRole = clerkUser?.publicMetadata?.role as string | undefined;
  const isAdvisor = hasAdvisorAccess(userRole);
  const canQuery = clerkUser?.id && isAdvisor;

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [studentFilter, setStudentFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'all' | 'past' | 'upcoming' | 'today'>('all');

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // New session form state
  const [newSession, setNewSession] = useState({
    student_id: '',
    title: '',
    session_type: 'general_advising',
    date: '',
    time: '',
    duration_minutes: '60',
    location: '',
    meeting_url: '',
    notes: '',
    visibility: 'advisor_only',
  });

  // Queries - only run if user has advisor access
  const sessions = useQuery(api.advisor_sessions.getSessions, canQuery ? {} : 'skip');

  const caseload = useQuery(
    api.advisor_students.getMyCaseload,
    canQuery ? { clerkId: clerkUser.id } : 'skip',
  );

  // Open create dialog if ?action=new is in URL, and pre-fill studentId if provided
  useEffect(() => {
    const action = searchParams.get('action');
    const studentId = searchParams.get('studentId');

    // Wait for caseload to load before processing URL params with studentId
    if (action === 'new' && studentId && caseload === undefined) {
      return; // Wait for caseload to load
    }

    if (action === 'new') {
      setCreateDialogOpen(true);
      // Only pre-fill if studentId is in advisor's caseload
      if (studentId && caseload?.some((s) => s._id === studentId)) {
        setNewSession((prev) => ({ ...prev, student_id: studentId }));
      }
      // Clear URL params to prevent dialog reopening on refresh
      // Use current pathname to preserve /u/ or /advisor/ route context
      router.replace(pathname, { scroll: false });
    }
  }, [searchParams, router, caseload, pathname]);

  // Mutations
  const createSession = useMutation(api.advisor_sessions_mutations.createSession);
  const cancelSession = useMutation(api.advisor_sessions_mutations.cancelSession);

  // Build student map for quick lookup
  const studentMap = useMemo(() => {
    if (!caseload) return new Map();
    return new Map(caseload.map((s) => [s._id, s]));
  }, [caseload]);

  // Filter sessions
  const filteredSessions = useMemo(() => {
    if (!sessions) return [];

    let filtered = [...sessions];

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((s) => s.status === statusFilter);
    }

    // Student filter
    if (studentFilter !== 'all') {
      filtered = filtered.filter((s) => s.student_id === studentFilter);
    }

    // Date range filter
    const now = Date.now();
    const todayStart = startOfDay(new Date()).getTime();
    const todayEnd = endOfDay(new Date()).getTime();

    if (dateRange === 'today') {
      filtered = filtered.filter((s) => {
        const sessionDate = s.scheduled_at ?? s.start_at;
        return sessionDate >= todayStart && sessionDate <= todayEnd;
      });
    } else if (dateRange === 'upcoming') {
      filtered = filtered.filter((s) => {
        const sessionDate = s.scheduled_at ?? s.start_at;
        return sessionDate > now;
      });
    } else if (dateRange === 'past') {
      filtered = filtered.filter((s) => {
        const sessionDate = s.scheduled_at ?? s.start_at;
        return sessionDate < now;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((s) => {
        const student = studentMap.get(s.student_id);
        const studentName = student?.name?.toLowerCase() || '';
        return (
          s.title.toLowerCase().includes(query) ||
          studentName.includes(query) ||
          SESSION_TYPE_LABELS[s.session_type || '']?.toLowerCase().includes(query)
        );
      });
    }

    // Sort by date (newest first for past, soonest first for upcoming)
    filtered.sort((a, b) => {
      const dateA = a.scheduled_at ?? a.start_at;
      const dateB = b.scheduled_at ?? b.start_at;
      return dateRange === 'past' ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  }, [sessions, statusFilter, studentFilter, dateRange, searchQuery, studentMap]);

  // Stats
  const stats = useMemo(() => {
    if (!sessions) return { total: 0, scheduled: 0, completed: 0, cancelled: 0 };
    return {
      total: sessions.length,
      scheduled: sessions.filter((s) => s.status === 'scheduled').length,
      completed: sessions.filter((s) => s.status === 'completed').length,
      cancelled: sessions.filter((s) => s.status === 'cancelled' || s.status === 'no_show').length,
    };
  }, [sessions]);

  // Handle create session
  const handleCreateSession = async () => {
    if (
      !clerkUser?.id ||
      !newSession.student_id ||
      !newSession.title ||
      !newSession.date ||
      !newSession.time
    ) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);

    try {
      // Parse date and time
      // Parse as local time explicitly (ISO 8601 without timezone treats as local)
      const [year, month, day] = newSession.date.split('-').map(Number);
      const [hour, minute] = newSession.time.split(':').map(Number);
      const dateTime = new Date(year, month - 1, day, hour, minute);
      if (isNaN(dateTime.getTime())) {
        throw new Error('Invalid date or time');
      }

      await createSession({
        clerkId: clerkUser.id,
        student_id: newSession.student_id as Id<'users'>,
        title: newSession.title,
        session_type: newSession.session_type as
          | 'career_planning'
          | 'resume_review'
          | 'mock_interview'
          | 'application_strategy'
          | 'general_advising'
          | 'other',
        start_at: dateTime.getTime(),
        duration_minutes: parseInt(newSession.duration_minutes, 10),
        location: newSession.location || undefined,
        meeting_url: newSession.meeting_url || undefined,
        notes: newSession.notes || undefined,
        visibility: newSession.visibility as 'shared' | 'advisor_only',
      });

      toast({
        title: 'Session created',
        description: 'The advising session has been scheduled',
      });

      // Reset form and close dialog
      setNewSession({
        student_id: '',
        title: '',
        session_type: 'general_advising',
        date: '',
        time: '',
        duration_minutes: '60',
        location: '',
        meeting_url: '',
        notes: '',
        visibility: 'advisor_only',
      });
      setCreateDialogOpen(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create session';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Handle cancel session
  const handleCancelSession = async (sessionId: Id<'advisor_sessions'>) => {
    if (!clerkUser?.id) return;

    const confirmCancel =
      typeof window === 'undefined'
        ? true
        : window.confirm('Are you sure you want to cancel this session?');
    if (!confirmCancel) return;

    try {
      await cancelSession({ clerkId: clerkUser.id, session_id: sessionId });
      toast({
        title: 'Session cancelled',
        description: 'The session has been cancelled',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to cancel session';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const isLoading = sessions === undefined;

  return (
    <ErrorBoundary>
      <AdvisorGate requiredFlag="advisor.advising">
        <div className="w-full">
          <div className="w-full gradient-border-bottom p-5 space-y-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Sessions</h1>
                <p className="text-muted-foreground mt-1">Track and manage advising sessions</p>
              </div>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Session
              </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="py-5 px-5">
                <div className="flex items-center gap-3">
                  <p className="text-xl font-semibold leading-none">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Sessions</p>
                </div>
              </Card>
              <Card className="py-5 px-5">
                <div className="flex items-center gap-3">
                  <p className="text-xl font-semibold leading-none text-blue-600">
                    {stats.scheduled}
                  </p>
                  <p className="text-xs text-muted-foreground">Scheduled</p>
                </div>
              </Card>
              <Card className="py-5 px-5">
                <div className="flex items-center gap-3">
                  <p className="text-xl font-semibold leading-none text-green-600">
                    {stats.completed}
                  </p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
              </Card>
              <Card className="py-5 px-5">
                <div className="flex items-center gap-3">
                  <p className="text-xl font-semibold leading-none text-gray-500">
                    {stats.cancelled}
                  </p>
                  <p className="text-xs text-muted-foreground">Cancelled/No-Show</p>
                </div>
              </Card>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-4">
                  {/* Search */}
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <label htmlFor="session-search" className="sr-only">
                        Search sessions
                      </label>
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="session-search"
                        placeholder="Search sessions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Date Range */}
                  <Select
                    value={dateRange}
                    onValueChange={(v) => setDateRange(v as 'all' | 'past' | 'upcoming' | 'today')}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Date range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="past">Past</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Status Filter */}
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="no_show">No-Show</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Student Filter */}
                  <Select value={studentFilter} onValueChange={setStudentFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="All Students" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Students</SelectItem>
                      {caseload?.map((student) => (
                        <SelectItem key={student._id} value={student._id}>
                          {student.name || student.email || 'Unknown Student'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Sessions Table */}
            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredSessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-lg font-medium">No sessions found</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      {sessions?.length === 0
                        ? "You haven't scheduled any advising sessions yet"
                        : 'No sessions match your current filters'}
                    </p>
                    <Button onClick={() => setCreateDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Schedule Session
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSessions.map((session) => {
                        const student = studentMap.get(session.student_id);
                        const sessionDate = session.scheduled_at ?? session.start_at;

                        return (
                          <TableRow key={session._id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {format(new Date(sessionDate), 'MMM d, yyyy')}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {format(new Date(sessionDate), 'h:mm a')}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span>{student?.name || 'Unknown'}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="max-w-[200px] truncate" title={session.title}>
                                {session.title}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">
                                {SESSION_TYPE_LABELS[session.session_type || ''] ||
                                  session.session_type}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {session.duration_minutes || 60} min
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={STATUS_VARIANTS[session.status || 'scheduled']}
                                className="gap-1"
                              >
                                <StatusIcon status={session.status || 'scheduled'} />
                                {session.status || 'scheduled'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <span className="sr-only">Session actions</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem asChild>
                                    <Link href={`${pathname}/${session._id}`}>
                                      <ExternalLink className="h-4 w-4 mr-2" />
                                      View Details
                                    </Link>
                                  </DropdownMenuItem>
                                  {session.meeting_url && isValidHttpUrl(session.meeting_url) && (
                                    <DropdownMenuItem asChild>
                                      <a
                                        href={session.meeting_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <Video className="h-4 w-4 mr-2" />
                                        Join Meeting
                                      </a>
                                    </DropdownMenuItem>
                                  )}
                                  {session.status === 'scheduled' && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={() => handleCancelSession(session._id)}
                                      >
                                        <XCircle className="h-4 w-4 mr-2" />
                                        Cancel Session
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Create Session Dialog */}
          <Dialog
            open={createDialogOpen}
            onOpenChange={(open) => {
              setCreateDialogOpen(open);
              if (!open) {
                // Reset form when dialog closes to avoid stale data
                setNewSession({
                  student_id: '',
                  title: '',
                  session_type: 'general_advising',
                  date: '',
                  time: '',
                  duration_minutes: '60',
                  location: '',
                  meeting_url: '',
                  notes: '',
                  visibility: 'advisor_only',
                });
              }
            }}
          >
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Schedule New Session</DialogTitle>
                <DialogDescription>Create a new advising session with a student</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                {/* Student Selection */}
                <div className="grid gap-2">
                  <Label htmlFor="student">Student *</Label>
                  <Select
                    value={newSession.student_id}
                    onValueChange={(v) => setNewSession({ ...newSession, student_id: v })}
                  >
                    <SelectTrigger id="student">
                      <SelectValue placeholder="Select a student" />
                    </SelectTrigger>
                    <SelectContent>
                      {caseload?.map((student) => (
                        <SelectItem key={student._id} value={student._id}>
                          {student.name || student.email || 'Unknown Student'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Title */}
                <div className="grid gap-2">
                  <Label htmlFor="title">Session Title *</Label>
                  <Input
                    id="title"
                    value={newSession.title}
                    onChange={(e) => setNewSession({ ...newSession, title: e.target.value })}
                    placeholder="e.g., Career Planning Discussion"
                  />
                </div>

                {/* Session Type */}
                <div className="grid gap-2">
                  <Label htmlFor="type">Session Type</Label>
                  <Select
                    value={newSession.session_type}
                    onValueChange={(v) => setNewSession({ ...newSession, session_type: v })}
                  >
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SESSION_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date and Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="date">Date *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={newSession.date}
                      onChange={(e) => setNewSession({ ...newSession, date: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="time">Time *</Label>
                    <Input
                      id="time"
                      type="time"
                      value={newSession.time}
                      onChange={(e) => setNewSession({ ...newSession, time: e.target.value })}
                    />
                  </div>
                </div>

                {/* Duration */}
                <div className="grid gap-2">
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Select
                    value={newSession.duration_minutes}
                    onValueChange={(v) => setNewSession({ ...newSession, duration_minutes: v })}
                  >
                    <SelectTrigger id="duration">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">60 minutes</SelectItem>
                      <SelectItem value="90">90 minutes</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Location and Meeting URL */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={newSession.location}
                      onChange={(e) => setNewSession({ ...newSession, location: e.target.value })}
                      placeholder="e.g., Room 305"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="meeting_url">Meeting URL</Label>
                    <Input
                      id="meeting_url"
                      type="url"
                      value={newSession.meeting_url}
                      onChange={(e) =>
                        setNewSession({ ...newSession, meeting_url: e.target.value })
                      }
                      placeholder="https://zoom.us/..."
                    />
                  </div>
                </div>

                {/* Visibility */}
                <div className="grid gap-2">
                  <Label htmlFor="visibility">Visibility</Label>
                  <Select
                    value={newSession.visibility}
                    onValueChange={(v) => setNewSession({ ...newSession, visibility: v })}
                  >
                    <SelectTrigger id="visibility">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="advisor_only">Advisor Only</SelectItem>
                      <SelectItem value="shared">Shared with Student</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Notes */}
                <div className="grid gap-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={newSession.notes}
                    onChange={(e) => setNewSession({ ...newSession, notes: e.target.value })}
                    placeholder="Add any preparation notes..."
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateSession} disabled={isCreating}>
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Session
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </AdvisorGate>
    </ErrorBoundary>
  );
}
