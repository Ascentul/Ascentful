'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { format } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  ListTodo,
  Loader2,
  Pencil,
  Plus,
  Square,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { ApplicationStatusBadge } from './ApplicationStatusBadge';

export type DBApplication = {
  id: string | number;
  company: string;
  job_title: string;
  status: 'saved' | 'applied' | 'interview' | 'offer' | 'rejected';
  url?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  resume_id?: string | null;
  cover_letter_id?: string | null;
};

function statusLabel(s: DBApplication['status']): string {
  switch (s) {
    case 'saved':
      return 'In Progress';
    case 'applied':
      return 'Applied';
    case 'interview':
      return 'Interviewing';
    case 'offer':
      return 'Offer';
    case 'rejected':
      return 'Rejected';
    default:
      return 'In Progress';
  }
}

// Format date for interview display
const formatInterviewDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const interviewDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (interviewDate.getTime() === today.getTime()) {
    return `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  }
  if (interviewDate.getTime() === tomorrow.getTime()) {
    return `Tomorrow, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

// Format due date for follow-ups
const formatDueDate = (timestamp: number, isOverdue: boolean): string => {
  if (isOverdue) return 'Overdue';
  const now = Date.now();
  const diff = timestamp - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

export function ApplicationDetails({
  open,
  onOpenChange,
  application,
  onChanged,
  saveFn,
  deleteFn,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: DBApplication;
  onChanged?: (updated: DBApplication | null) => void;
  saveFn?: (id: string | number, values: Partial<DBApplication>) => Promise<DBApplication>;
  deleteFn?: (id: string | number) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [local, setLocal] = useState<DBApplication>(application);
  const { user } = useUser();
  const clerkId = user?.id;
  const { toast } = useToast();

  // Convex data
  const stages = useQuery(
    api.interviews.getStagesForApplication,
    clerkId ? { clerkId, applicationId: local.id as any } : 'skip',
  );
  const followups = useQuery(
    api.followups.getFollowupsForApplication,
    clerkId ? { applicationId: local.id as any } : 'skip',
  );
  const resumes = useQuery(api.resumes.getUserResumes, clerkId ? { clerkId } : 'skip');
  const coverLetters = useQuery(
    api.cover_letters.getUserCoverLetters,
    clerkId ? { clerkId } : 'skip',
  );
  // Mutations
  const createStage = useMutation(api.interviews.createStage);
  const updateStage = useMutation(api.interviews.updateStage);
  const deleteStage = useMutation(api.interviews.deleteStage);
  const createFollowup = useMutation(api.followups.createFollowup);
  const updateFollowup = useMutation(api.followups.updateFollowup);
  const deleteFollowup = useMutation(api.followups.deleteFollowup);
  const updateApplication = useMutation(api.applications.updateApplication);
  const deleteApplicationMutation = useMutation(api.applications.deleteApplication);

  useEffect(() => setLocal(application), [application]);

  const save = async () => {
    setSaving(true);
    try {
      if (saveFn) {
        const updated = await saveFn(application.id, {
          status: local.status,
          notes: local.notes,
          company: local.company,
          job_title: local.job_title,
          url: local.url || undefined,
        });
        onChanged?.(updated);
        onOpenChange(false);
      } else {
        if (!clerkId) return;
        await updateApplication({
          clerkId,
          applicationId: application.id as any,
          updates: {
            status: local.status,
            notes: local.notes,
            company: local.company,
            job_title: local.job_title,
            url: local.url || undefined,
          } as any,
        } as any);
        onChanged?.({ ...local });
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this application? This action cannot be undone.'))
      return;
    setDeleting(true);
    try {
      if (deleteFn) {
        await deleteFn(application.id);
        onChanged?.(null);
      } else {
        if (!clerkId) return;
        await deleteApplicationMutation({
          clerkId,
          applicationId: application.id as any,
        });
        onChanged?.(null);
      }
      onOpenChange(false);
      toast({
        title: 'Application deleted',
        description: 'The application has been removed.',
      });
    } catch (e) {
      console.error(e);
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to delete application',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  // Handle status change - auto-save immediately
  const handleStatusChange = async (newStatusLabel: string) => {
    const statusMap: Record<string, DBApplication['status']> = {
      'In Progress': 'saved',
      Applied: 'applied',
      Interviewing: 'interview',
      Offer: 'offer',
      Rejected: 'rejected',
    };
    const newStatus = statusMap[newStatusLabel];
    if (newStatus) {
      const updatedLocal = { ...local, status: newStatus };
      setLocal(updatedLocal);

      try {
        if (saveFn) {
          const updated = await saveFn(application.id, { status: newStatus });
          onChanged?.(updated);
        } else if (clerkId) {
          await updateApplication({
            clerkId,
            applicationId: application.id as any,
            updates: { status: newStatus } as any,
          } as any);
          onChanged?.(updatedLocal);
        }
      } catch (error) {
        console.error('Failed to update status:', error);
        setLocal(local);
      }
    }
  };

  // Interview form state
  const [stageForm, setStageForm] = useState({
    title: '',
    scheduled_date: undefined as Date | undefined,
    scheduled_time: '',
    location: '',
    notes: '',
  });
  const [addingStage, setAddingStage] = useState(false);
  const [editingStage, setEditingStage] = useState<any>(null);
  const [stageCalendarOpen, setStageCalendarOpen] = useState(false);
  const [editStageCalendarOpen, setEditStageCalendarOpen] = useState(false);

  const addStage = async () => {
    if (!clerkId || !stageForm.title.trim() || addingStage) return;
    setAddingStage(true);
    try {
      let scheduled: number | undefined;
      if (stageForm.scheduled_date) {
        const date = new Date(stageForm.scheduled_date);
        if (stageForm.scheduled_time) {
          const [hours, minutes] = stageForm.scheduled_time.split(':').map(Number);
          date.setHours(hours, minutes, 0, 0);
        } else {
          date.setHours(9, 0, 0, 0); // Default to 9 AM if no time specified
        }
        scheduled = date.getTime();
      }
      await createStage({
        clerkId,
        applicationId: local.id as any,
        title: stageForm.title,
        scheduled_at: scheduled,
        location: stageForm.location || undefined,
        notes: stageForm.notes || undefined,
      } as any);
      setStageForm({
        title: '',
        scheduled_date: undefined,
        scheduled_time: '',
        location: '',
        notes: '',
      });
    } finally {
      setAddingStage(false);
    }
  };

  const setStageOutcome = async (
    stageId: any,
    outcome: 'pending' | 'scheduled' | 'passed' | 'failed',
  ) => {
    if (!clerkId) return;
    await updateStage({ clerkId, stageId, updates: { outcome } } as any);
  };

  const removeStage = async (stageId: any) => {
    if (!clerkId) return;
    if (!confirm('Delete this interview stage?')) return;
    await deleteStage({ clerkId, stageId } as any);
  };

  const saveStageEdit = async () => {
    if (!clerkId || !editingStage) return;
    let scheduled: number | undefined;
    if (editingStage.scheduled_date) {
      const date = new Date(editingStage.scheduled_date);
      if (editingStage.scheduled_time) {
        const [hours, minutes] = editingStage.scheduled_time.split(':').map(Number);
        date.setHours(hours, minutes, 0, 0);
      } else {
        date.setHours(9, 0, 0, 0);
      }
      scheduled = date.getTime();
    }
    await updateStage({
      clerkId,
      stageId: editingStage._id,
      updates: {
        title: editingStage.title,
        scheduled_at: scheduled,
        location: editingStage.location,
        notes: editingStage.notes,
      },
    } as any);
    setEditingStage(null);
  };

  // Status bubble with click to cycle
  const getStatusBubble = (stageId: any, outcome: string) => {
    const cycleStatus = () => {
      const statusOrder = ['pending', 'scheduled', 'passed', 'failed'];
      const currentIndex = statusOrder.indexOf(outcome);
      const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
      setStageOutcome(stageId, nextStatus as any);
    };

    const baseClass =
      'flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity font-medium';

    switch (outcome) {
      case 'passed':
        return (
          <div onClick={cycleStatus} className={`${baseClass} bg-green-100 text-green-700`}>
            <Check className="h-3 w-3" /> Passed
          </div>
        );
      case 'failed':
        return (
          <div onClick={cycleStatus} className={`${baseClass} bg-red-100 text-red-700`}>
            <X className="h-3 w-3" /> Rejected
          </div>
        );
      case 'scheduled':
        return (
          <div onClick={cycleStatus} className={`${baseClass} bg-blue-100 text-blue-700`}>
            <CalendarIcon className="h-3 w-3" /> Scheduled
          </div>
        );
      default:
        return (
          <div onClick={cycleStatus} className={`${baseClass} bg-amber-100 text-amber-700`}>
            <Clock className="h-3 w-3" /> Pending
          </div>
        );
    }
  };

  // Follow-up form state
  const [followForm, setFollowForm] = useState({
    description: '',
    due_date: undefined as Date | undefined,
  });
  const [addingFollowup, setAddingFollowup] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [followupCalendarOpen, setFollowupCalendarOpen] = useState(false);
  const [editingFollowup, setEditingFollowup] = useState<{
    _id: any;
    description: string;
    due_date: Date | undefined;
  } | null>(null);
  const [editFollowupCalendarOpen, setEditFollowupCalendarOpen] = useState(false);

  const addFollowup = async () => {
    if (!clerkId || !followForm.description.trim() || addingFollowup) return;
    setAddingFollowup(true);
    try {
      let due: number | undefined;
      if (followForm.due_date) {
        const date = new Date(followForm.due_date);
        date.setHours(23, 59, 59, 0); // Set to end of day for due dates
        due = date.getTime();
      }
      await createFollowup({
        applicationId: local.id as any,
        description: followForm.description,
        due_at: due,
      } as any);
      setFollowForm({ description: '', due_date: undefined });
    } finally {
      setAddingFollowup(false);
    }
  };

  const toggleFollowup = async (followupId: any, currentStatus: string) => {
    if (!clerkId) return;
    await updateFollowup({
      followupId,
      updates: { status: currentStatus === 'done' ? 'open' : 'done' },
    } as any);
  };

  const removeFollowup = async (followupId: any) => {
    if (!clerkId) return;
    if (!confirm('Delete this follow-up action?')) return;
    await deleteFollowup({ followupId } as any);
  };

  const saveFollowupEdit = async () => {
    if (!clerkId || !editingFollowup) return;
    let due: number | undefined;
    if (editingFollowup.due_date) {
      const date = new Date(editingFollowup.due_date);
      date.setHours(23, 59, 59, 0);
      due = date.getTime();
    }
    await updateFollowup({
      followupId: editingFollowup._id,
      updates: {
        description: editingFollowup.description,
        due_at: due,
      },
    } as any);
    setEditingFollowup(null);
  };

  // Split follow-ups into open and completed
  const openFollowups = useMemo(
    () => (followups || []).filter((f: any) => f.status !== 'done'),
    [followups],
  );
  const completedFollowups = useMemo(
    () => (followups || []).filter((f: any) => f.status === 'done'),
    [followups],
  );

  // Timeline item type
  type TimelineItem =
    | { type: 'interview'; data: any; sortDate: number }
    | { type: 'followup'; data: any; sortDate: number };

  // Helper to check if item is completed
  const isItemCompleted = (item: TimelineItem): boolean => {
    if (item.type === 'interview') {
      return item.data.outcome === 'passed';
    }
    return item.data.status === 'done';
  };

  // Split timeline into completed and incomplete sections, each sorted by date
  const { completedItems, incompleteItems, totalItems } = useMemo(() => {
    const items: TimelineItem[] = [];

    // Add interviews
    (stages || []).forEach((s: any) => {
      items.push({
        type: 'interview',
        data: s,
        sortDate: s.scheduled_at || s.created_at || 0,
      });
    });

    // Add ALL follow-ups (both open and completed) to show full timeline
    (followups || []).forEach((f: any) => {
      items.push({
        type: 'followup',
        data: f,
        sortDate: f.due_at || f.created_at || 0,
      });
    });

    // Split into groups and sort each by date
    const completed = items.filter(isItemCompleted).sort((a, b) => a.sortDate - b.sortDate);
    const incomplete = items
      .filter((i) => !isItemCompleted(i))
      .sort((a, b) => a.sortDate - b.sortDate);

    return { completedItems: completed, incompleteItems: incomplete, totalItems: items.length };
  }, [stages, followups]);

  // Respect user's reduced motion preference for accessibility
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Animation variants for list items - disabled when user prefers reduced motion
  const itemVariants = prefersReducedMotion
    ? {
        initial: {},
        animate: {},
        exit: {},
      }
    : {
        initial: { opacity: 0, y: 20, scale: 0.95 },
        animate: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.25, ease: 'easeOut' },
        },
        exit: {
          opacity: 0,
          y: -20,
          scale: 0.95,
          transition: { duration: 0.2, ease: 'easeIn' },
        },
      };

  // Helper to get motion props with reduced motion support
  const getMotionProps = (itemId: string) => ({
    key: itemId,
    variants: itemVariants,
    initial: prefersReducedMotion ? false : 'initial',
    animate: 'animate',
    exit: prefersReducedMotion ? undefined : 'exit',
    layout: !prefersReducedMotion,
    layoutId: prefersReducedMotion ? undefined : itemId,
  });

  // State for which add form is visible
  const [addFormType, setAddFormType] = useState<'interview' | 'followup' | null>(null);

  // State for showing edit section
  const [showEditSection, setShowEditSection] = useState(false);

  // State for selected item popup (interview or followup)
  const [selectedItem, setSelectedItem] = useState<{
    type: 'interview' | 'followup';
    data: any;
  } | null>(null);

  // Materials selection
  const [selectedResumeId, setSelectedResumeId] = useState<string>(local.resume_id || 'none');
  const [selectedCoverId, setSelectedCoverId] = useState<string>(local.cover_letter_id || 'none');

  useEffect(() => {
    setSelectedResumeId(local.resume_id || 'none');
    setSelectedCoverId(local.cover_letter_id || 'none');
  }, [local.resume_id, local.cover_letter_id, open]);

  const saveMaterials = async () => {
    if (!clerkId) return;
    const resumeValue = selectedResumeId !== 'none' ? (selectedResumeId as any) : undefined;
    const coverValue = selectedCoverId !== 'none' ? (selectedCoverId as any) : undefined;

    if (saveFn) {
      const updated = await saveFn(application.id, {
        resume_id: resumeValue,
        cover_letter_id: coverValue,
      });
      setLocal(updated);
      onChanged?.(updated);
      onOpenChange(false);
      return;
    }

    await updateApplication({
      clerkId,
      applicationId: local.id as any,
      updates: {
        resume_id: resumeValue,
        cover_letter_id: coverValue,
      },
    } as any);
    const updated = {
      ...local,
      resume_id: resumeValue ?? null,
      cover_letter_id: coverValue ?? null,
    };
    setLocal(updated);
    onChanged?.(updated);
    onOpenChange(false);
  };

  // Secondary tabs state - no default tab selected
  const [secondaryTab, setSecondaryTab] = useState<string>('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header Section */}
        <DialogHeader className="pb-4 border-b">
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-2xl font-bold text-slate-900">
              {local.job_title || 'Untitled Role'}
            </DialogTitle>
            <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
              <span>{local.company || 'Company'}</span>
              {local.created_at && (
                <>
                  <span>·</span>
                  <span>
                    Applied{' '}
                    {new Date(local.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </>
              )}
            </div>
            <div className="mt-6 flex items-center justify-between">
              <ApplicationStatusBadge
                status={statusLabel(local.status)}
                onStatusChange={handleStatusChange}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="h-7 px-3 text-xs font-medium rounded-lg bg-black text-white inline-flex items-center gap-1 hover:bg-slate-800 transition-colors"
                  onClick={() => setAddFormType(addFormType === 'interview' ? null : 'interview')}
                >
                  <Users className="h-3 w-3" />
                  Add Interview
                </button>
                <button
                  type="button"
                  className="h-7 px-3 text-xs font-medium rounded-lg bg-black text-white inline-flex items-center gap-1 hover:bg-slate-800 transition-colors"
                  onClick={() => setAddFormType(addFormType === 'followup' ? null : 'followup')}
                >
                  <ListTodo className="h-3 w-3" />
                  Add Follow-up
                </button>
              </div>
            </div>
          </div>
          {local.url && (
            <div className="mt-3">
              <a
                href={local.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View Job Posting
              </a>
            </div>
          )}
        </DialogHeader>

        {/* Interview Process Timeline */}
        <div className="py-5 space-y-4">
          {/* Header */}
          <h3 className="text-sm font-semibold text-slate-900">
            Interview Process
            <span className="ml-2 text-xs font-normal text-slate-500">({totalItems} items)</span>
          </h3>

          {/* Add Interview Form */}
          {addFormType === 'interview' && (
            <div className="border rounded-lg p-3 bg-blue-50/50 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-blue-700 mb-2">
                <Users className="h-3.5 w-3.5" />
                New Interview
              </div>
              <div className="flex gap-2 items-end">
                <Input
                  placeholder="Stage name (e.g., Phone Screen)"
                  className="h-8 text-sm flex-1"
                  value={stageForm.title}
                  onChange={(e) => setStageForm({ ...stageForm, title: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && stageForm.title.trim()) {
                      addStage();
                      setAddFormType(null);
                    }
                  }}
                  autoFocus
                />
                <Popover open={stageCalendarOpen} onOpenChange={setStageCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        'h-8 w-[120px] justify-start text-left font-normal text-sm',
                        !stageForm.scheduled_date && 'text-muted-foreground',
                      )}
                    >
                      <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                      {stageForm.scheduled_date
                        ? format(stageForm.scheduled_date, 'MMM d')
                        : 'Date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={stageForm.scheduled_date}
                      onSelect={(date) => {
                        setStageForm({ ...stageForm, scheduled_date: date });
                        setStageCalendarOpen(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Input
                  type="time"
                  className="h-8 text-sm w-[85px]"
                  value={stageForm.scheduled_time}
                  onChange={(e) => setStageForm({ ...stageForm, scheduled_time: e.target.value })}
                />
                <Button
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => {
                    addStage();
                    setAddFormType(null);
                  }}
                  disabled={!stageForm.title.trim() || addingStage}
                >
                  {addingStage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => setAddFormType(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Add Follow-up Form */}
          {addFormType === 'followup' && (
            <div className="border rounded-lg p-3 bg-amber-50/50 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-amber-700 mb-2">
                <ListTodo className="h-3.5 w-3.5" />
                New Follow-up
              </div>
              <div className="flex gap-2 items-end">
                <Input
                  placeholder="Follow-up action (e.g., Send thank you email)"
                  className="h-8 text-sm flex-1"
                  value={followForm.description}
                  onChange={(e) => setFollowForm({ ...followForm, description: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && followForm.description.trim()) {
                      addFollowup();
                      setAddFormType(null);
                    }
                  }}
                  autoFocus
                />
                <Popover open={followupCalendarOpen} onOpenChange={setFollowupCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        'h-8 w-[120px] justify-start text-left font-normal text-sm',
                        !followForm.due_date && 'text-muted-foreground',
                      )}
                    >
                      <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                      {followForm.due_date ? format(followForm.due_date, 'MMM d') : 'Due date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={followForm.due_date}
                      onSelect={(date) => {
                        setFollowForm({ ...followForm, due_date: date });
                        setFollowupCalendarOpen(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Button
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => {
                    addFollowup();
                    setAddFormType(null);
                  }}
                  disabled={!followForm.description.trim() || addingFollowup}
                >
                  {addingFollowup ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => setAddFormType(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="relative">
            {completedItems.length === 0 && incompleteItems.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-slate-400 text-sm">No interviews or follow-ups yet</div>
                <div className="text-slate-400 text-xs mt-1">
                  Click the buttons above to add your first item
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Completed Section */}
                {completedItems.length > 0 && (
                  <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                      {completedItems.map((item) => {
                        const itemId =
                          item.type === 'interview'
                            ? `interview-${item.data._id}`
                            : `followup-${item.data._id}`;

                        if (item.type === 'interview') {
                          const s = item.data;
                          const isEditing = editingStage && editingStage._id === s._id;

                          if (isEditing) {
                            return (
                              <motion.div
                                key={itemId}
                                {...getMotionProps(itemId)}
                                className="flex gap-3"
                              >
                                {/* Timeline dot */}
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 border-2 border-blue-500 flex items-center justify-center z-10">
                                  <Users className="h-3 w-3 text-blue-600" />
                                </div>
                                {/* Edit form */}
                                <div className="flex-1 border rounded-lg p-3 bg-slate-50 space-y-2">
                                  <Input
                                    placeholder="Stage title"
                                    value={editingStage.title}
                                    onChange={(e) =>
                                      setEditingStage({ ...editingStage, title: e.target.value })
                                    }
                                    className="h-8 text-sm"
                                  />
                                  <div className="flex gap-2">
                                    <Popover
                                      open={editStageCalendarOpen}
                                      onOpenChange={setEditStageCalendarOpen}
                                    >
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className={cn(
                                            'h-8 w-[120px] justify-start text-left font-normal text-sm',
                                            !editingStage.scheduled_date && 'text-muted-foreground',
                                          )}
                                        >
                                          <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                                          {editingStage.scheduled_date
                                            ? format(editingStage.scheduled_date, 'MMM d')
                                            : 'Date'}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                          mode="single"
                                          selected={editingStage.scheduled_date}
                                          onSelect={(date) => {
                                            setEditingStage({
                                              ...editingStage,
                                              scheduled_date: date,
                                            });
                                            setEditStageCalendarOpen(false);
                                          }}
                                          initialFocus
                                        />
                                      </PopoverContent>
                                    </Popover>
                                    <Input
                                      type="time"
                                      className="h-8 text-sm w-[85px]"
                                      value={editingStage.scheduled_time || ''}
                                      onChange={(e) =>
                                        setEditingStage({
                                          ...editingStage,
                                          scheduled_time: e.target.value,
                                        })
                                      }
                                    />
                                    <Input
                                      placeholder="Location"
                                      value={editingStage.location || ''}
                                      onChange={(e) =>
                                        setEditingStage({
                                          ...editingStage,
                                          location: e.target.value,
                                        })
                                      }
                                      className="h-8 text-sm flex-1"
                                    />
                                  </div>
                                  <div className="flex gap-2 justify-end">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs"
                                      onClick={() => setEditingStage(null)}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={saveStageEdit}
                                    >
                                      Save
                                    </Button>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          }

                          return (
                            <motion.div key={itemId} {...getMotionProps(itemId)}>
                              <Popover
                                open={
                                  selectedItem?.type === 'interview' &&
                                  selectedItem?.data._id === s._id
                                }
                                onOpenChange={(open) => {
                                  if (!open) setSelectedItem(null);
                                }}
                              >
                                <PopoverTrigger asChild>
                                  <div
                                    className="flex items-center gap-3 cursor-pointer"
                                    onClick={() => setSelectedItem({ type: 'interview', data: s })}
                                  >
                                    {/* Timeline dot - purple checkmark if passed, otherwise blue outline */}
                                    <div
                                      className={cn(
                                        'flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10',
                                        s.outcome === 'passed'
                                          ? 'bg-primary-500 border-primary-500'
                                          : 'bg-white border-blue-500',
                                      )}
                                    >
                                      {s.outcome === 'passed' && (
                                        <Check className="h-3 w-3 text-white" />
                                      )}
                                    </div>
                                    {/* Content */}
                                    <div className="flex-1 border rounded-lg pl-3 pr-4 py-3 hover:bg-slate-50 transition-colors min-h-[56px] flex items-center">
                                      <div className="flex items-center justify-between w-full gap-3">
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium text-sm text-slate-900">
                                            {s.title}
                                          </div>
                                          <div className="text-xs text-slate-500 mt-0.5">
                                            {s.scheduled_at
                                              ? formatInterviewDate(s.scheduled_at)
                                              : 'No date set'}
                                          </div>
                                          {s.location && (
                                            <div className="text-xs text-slate-400 mt-0.5 truncate">
                                              📍 {s.location}
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex-shrink-0 flex items-center">
                                          {getStatusBubble(s._id, s.outcome)}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-3" align="end">
                                  <div className="space-y-3">
                                    <div className="text-sm font-medium text-slate-900">
                                      {s.title}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {s.scheduled_at
                                        ? formatInterviewDate(s.scheduled_at)
                                        : 'No date set'}
                                      {s.location && ` · ${s.location}`}
                                    </div>
                                    <div className="flex gap-2 pt-2 border-t">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 h-8 text-xs gap-1.5"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          let scheduled_date: Date | undefined;
                                          let scheduled_time = '';
                                          if (s.scheduled_at) {
                                            const date = new Date(s.scheduled_at);
                                            scheduled_date = date;
                                            scheduled_time = format(date, 'HH:mm');
                                          }
                                          setEditingStage({
                                            ...s,
                                            scheduled_date,
                                            scheduled_time,
                                          });
                                          setSelectedItem(null);
                                        }}
                                      >
                                        <Pencil className="h-3 w-3" />
                                        Edit
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 h-8 text-xs gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedItem(null);
                                          removeStage(s._id);
                                        }}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                        Delete
                                      </Button>
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </motion.div>
                          );
                        } else {
                          // Follow-up item
                          const f = item.data;
                          const isCompleted = f.status === 'done';
                          const isOverdue = f.due_at && f.due_at < Date.now() && !isCompleted;
                          const isEditingFollowupItem =
                            editingFollowup && editingFollowup._id === f._id;

                          if (isEditingFollowupItem) {
                            return (
                              <motion.div
                                key={itemId}
                                {...getMotionProps(itemId)}
                                className="flex gap-3"
                              >
                                {/* Timeline dot */}
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 border-2 border-amber-500 flex items-center justify-center z-10">
                                  <ListTodo className="h-3 w-3 text-amber-600" />
                                </div>
                                {/* Edit form */}
                                <div className="flex-1 border rounded-lg p-3 bg-slate-50 space-y-2">
                                  <Input
                                    placeholder="Follow-up description"
                                    value={editingFollowup.description}
                                    onChange={(e) =>
                                      setEditingFollowup({
                                        ...editingFollowup,
                                        description: e.target.value,
                                      })
                                    }
                                    className="h-8 text-sm"
                                  />
                                  <div className="flex gap-2">
                                    <Popover
                                      open={editFollowupCalendarOpen}
                                      onOpenChange={setEditFollowupCalendarOpen}
                                    >
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className={cn(
                                            'h-8 w-[140px] justify-start text-left font-normal text-sm',
                                            !editingFollowup.due_date && 'text-muted-foreground',
                                          )}
                                        >
                                          <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                                          {editingFollowup.due_date
                                            ? format(editingFollowup.due_date, 'MMM d, yyyy')
                                            : 'Due date'}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                          mode="single"
                                          selected={editingFollowup.due_date}
                                          onSelect={(date) => {
                                            setEditingFollowup({
                                              ...editingFollowup,
                                              due_date: date,
                                            });
                                            setEditFollowupCalendarOpen(false);
                                          }}
                                          initialFocus
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                  <div className="flex gap-2 justify-end">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs"
                                      onClick={() => setEditingFollowup(null)}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={saveFollowupEdit}
                                    >
                                      Save
                                    </Button>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          }

                          return (
                            <motion.div key={itemId} {...getMotionProps(itemId)}>
                              <Popover
                                open={
                                  selectedItem?.type === 'followup' &&
                                  selectedItem?.data._id === f._id
                                }
                                onOpenChange={(open) => {
                                  if (!open) setSelectedItem(null);
                                }}
                              >
                                <div className="flex items-center gap-3">
                                  {/* Timeline dot - purple if completed, amber if pending - clickable for toggle */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleFollowup(f._id, f.status);
                                    }}
                                    className={cn(
                                      'flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 transition-colors',
                                      isCompleted
                                        ? 'bg-primary-500 border-primary-500 hover:bg-primary-600'
                                        : 'bg-white border-amber-500 hover:bg-amber-50',
                                    )}
                                  >
                                    {isCompleted && <Check className="h-3 w-3 text-white" />}
                                  </button>
                                  {/* Content - clickable for popup */}
                                  <PopoverTrigger asChild>
                                    <div
                                      className={cn(
                                        'flex-1 border rounded-lg pl-3 pr-4 py-3 transition-colors min-h-[56px] flex items-center cursor-pointer',
                                        isCompleted ? 'bg-slate-50/50' : 'hover:bg-slate-50',
                                      )}
                                      onClick={() => setSelectedItem({ type: 'followup', data: f })}
                                    >
                                      <div className="flex items-center justify-between w-full gap-3">
                                        <div className="flex-1 min-w-0">
                                          <div
                                            className={cn(
                                              'text-sm font-medium',
                                              isCompleted
                                                ? 'text-slate-400 line-through'
                                                : isOverdue
                                                  ? 'text-red-600'
                                                  : 'text-slate-900',
                                            )}
                                          >
                                            {f.description || f.title}
                                          </div>
                                          <div
                                            className={cn(
                                              'text-xs mt-0.5',
                                              isCompleted
                                                ? 'text-slate-400'
                                                : isOverdue
                                                  ? 'text-red-500 font-medium'
                                                  : 'text-slate-400',
                                            )}
                                          >
                                            {f.due_at
                                              ? isCompleted
                                                ? format(new Date(f.due_at), 'MMM d')
                                                : formatDueDate(f.due_at, isOverdue)
                                              : 'No due date'}
                                          </div>
                                        </div>
                                        <div className="flex-shrink-0 flex items-center">
                                          {!isCompleted && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                toggleFollowup(f._id, f.status);
                                              }}
                                              className="h-5 w-5 rounded border border-primary-500 flex items-center justify-center hover:bg-primary-50 transition-colors mr-5"
                                              title="Mark as complete"
                                            />
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </PopoverTrigger>
                                </div>
                                <PopoverContent className="w-64 p-3" align="end">
                                  <div className="space-y-3">
                                    <div className="text-sm font-medium text-slate-900">
                                      {f.description || f.title}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {f.due_at
                                        ? `Due ${format(new Date(f.due_at), 'MMM d, yyyy')}`
                                        : 'No due date'}
                                      {isCompleted && ' · Completed'}
                                      {isOverdue && ' · Overdue'}
                                    </div>
                                    <div className="flex gap-2 pt-2 border-t">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 h-8 text-xs gap-1.5"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedItem(null);
                                          setEditingFollowup({
                                            _id: f._id,
                                            description: f.description || f.title || '',
                                            due_date: f.due_at ? new Date(f.due_at) : undefined,
                                          });
                                        }}
                                      >
                                        <Pencil className="h-3 w-3" />
                                        Edit
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 h-8 text-xs gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedItem(null);
                                          removeFollowup(f._id);
                                        }}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                        Delete
                                      </Button>
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </motion.div>
                          );
                        }
                      })}
                    </AnimatePresence>
                  </div>
                )}

                {/* Grey Divider - only show if both sections have items */}
                {completedItems.length > 0 && incompleteItems.length > 0 && (
                  <div className="flex items-center gap-3 py-2">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-xs text-slate-400 font-medium">Upcoming</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                )}

                {/* Incomplete Section */}
                {incompleteItems.length > 0 && (
                  <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                      {incompleteItems.map((item) => {
                        const itemId =
                          item.type === 'interview'
                            ? `interview-${item.data._id}`
                            : `followup-${item.data._id}`;

                        if (item.type === 'interview') {
                          const s = item.data;
                          const isEditing = editingStage && editingStage._id === s._id;

                          if (isEditing) {
                            return (
                              <motion.div
                                key={itemId}
                                {...getMotionProps(itemId)}
                                className="flex gap-3"
                              >
                                {/* Timeline dot */}
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 border-2 border-blue-500 flex items-center justify-center z-10">
                                  <Users className="h-3 w-3 text-blue-600" />
                                </div>
                                {/* Edit form */}
                                <div className="flex-1 border rounded-lg p-3 bg-slate-50 space-y-2">
                                  <Input
                                    placeholder="Stage title"
                                    value={editingStage.title}
                                    onChange={(e) =>
                                      setEditingStage({ ...editingStage, title: e.target.value })
                                    }
                                    className="h-8 text-sm"
                                  />
                                  <div className="flex gap-2">
                                    <Popover
                                      open={editStageCalendarOpen}
                                      onOpenChange={setEditStageCalendarOpen}
                                    >
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className={cn(
                                            'h-8 w-[120px] justify-start text-left font-normal text-sm',
                                            !editingStage.scheduled_date && 'text-muted-foreground',
                                          )}
                                        >
                                          <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                                          {editingStage.scheduled_date
                                            ? format(editingStage.scheduled_date, 'MMM d')
                                            : 'Date'}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                          mode="single"
                                          selected={editingStage.scheduled_date}
                                          onSelect={(date) => {
                                            setEditingStage({
                                              ...editingStage,
                                              scheduled_date: date,
                                            });
                                            setEditStageCalendarOpen(false);
                                          }}
                                          initialFocus
                                        />
                                      </PopoverContent>
                                    </Popover>
                                    <Input
                                      type="time"
                                      className="h-8 text-sm w-[85px]"
                                      value={editingStage.scheduled_time || ''}
                                      onChange={(e) =>
                                        setEditingStage({
                                          ...editingStage,
                                          scheduled_time: e.target.value,
                                        })
                                      }
                                    />
                                    <Input
                                      placeholder="Location"
                                      value={editingStage.location || ''}
                                      onChange={(e) =>
                                        setEditingStage({
                                          ...editingStage,
                                          location: e.target.value,
                                        })
                                      }
                                      className="h-8 text-sm flex-1"
                                    />
                                  </div>
                                  <div className="flex gap-2 justify-end">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs"
                                      onClick={() => setEditingStage(null)}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={saveStageEdit}
                                    >
                                      Save
                                    </Button>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          }

                          return (
                            <motion.div key={itemId} {...getMotionProps(itemId)}>
                              <Popover
                                open={
                                  selectedItem?.type === 'interview' &&
                                  selectedItem?.data._id === s._id
                                }
                                onOpenChange={(open) => {
                                  if (!open) setSelectedItem(null);
                                }}
                              >
                                <PopoverTrigger asChild>
                                  <div
                                    className="flex items-center gap-3 cursor-pointer"
                                    onClick={() => setSelectedItem({ type: 'interview', data: s })}
                                  >
                                    {/* Timeline dot - purple checkmark if passed, otherwise blue outline */}
                                    <div
                                      className={cn(
                                        'flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10',
                                        s.outcome === 'passed'
                                          ? 'bg-primary-500 border-primary-500'
                                          : 'bg-white border-blue-500',
                                      )}
                                    >
                                      {s.outcome === 'passed' && (
                                        <Check className="h-3 w-3 text-white" />
                                      )}
                                    </div>
                                    {/* Content */}
                                    <div className="flex-1 border rounded-lg pl-3 pr-4 py-3 hover:bg-slate-50 transition-colors min-h-[56px] flex items-center">
                                      <div className="flex items-center justify-between w-full gap-3">
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium text-sm text-slate-900">
                                            {s.title}
                                          </div>
                                          <div className="text-xs text-slate-500 mt-0.5">
                                            {s.scheduled_at
                                              ? formatInterviewDate(s.scheduled_at)
                                              : 'No date set'}
                                          </div>
                                          {s.location && (
                                            <div className="text-xs text-slate-400 mt-0.5 truncate">
                                              📍 {s.location}
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex-shrink-0 flex items-center">
                                          {getStatusBubble(s._id, s.outcome)}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-3" align="end">
                                  <div className="space-y-3">
                                    <div className="text-sm font-medium text-slate-900">
                                      {s.title}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {s.scheduled_at
                                        ? formatInterviewDate(s.scheduled_at)
                                        : 'No date set'}
                                      {s.location && ` · ${s.location}`}
                                    </div>
                                    <div className="flex gap-2 pt-2 border-t">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 h-8 text-xs gap-1.5"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          let scheduled_date: Date | undefined;
                                          let scheduled_time = '';
                                          if (s.scheduled_at) {
                                            const date = new Date(s.scheduled_at);
                                            scheduled_date = date;
                                            scheduled_time = format(date, 'HH:mm');
                                          }
                                          setEditingStage({
                                            ...s,
                                            scheduled_date,
                                            scheduled_time,
                                          });
                                          setSelectedItem(null);
                                        }}
                                      >
                                        <Pencil className="h-3 w-3" />
                                        Edit
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 h-8 text-xs gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedItem(null);
                                          removeStage(s._id);
                                        }}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                        Delete
                                      </Button>
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </motion.div>
                          );
                        } else {
                          // Follow-up item
                          const f = item.data;
                          const isCompleted = f.status === 'done';
                          const isOverdue = f.due_at && f.due_at < Date.now() && !isCompleted;
                          const isEditingFollowupItem =
                            editingFollowup && editingFollowup._id === f._id;

                          if (isEditingFollowupItem) {
                            return (
                              <motion.div
                                key={itemId}
                                {...getMotionProps(itemId)}
                                className="flex gap-3"
                              >
                                {/* Timeline dot */}
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 border-2 border-amber-500 flex items-center justify-center z-10">
                                  <ListTodo className="h-3 w-3 text-amber-600" />
                                </div>
                                {/* Edit form */}
                                <div className="flex-1 border rounded-lg p-3 bg-slate-50 space-y-2">
                                  <Input
                                    placeholder="Follow-up description"
                                    value={editingFollowup.description}
                                    onChange={(e) =>
                                      setEditingFollowup({
                                        ...editingFollowup,
                                        description: e.target.value,
                                      })
                                    }
                                    className="h-8 text-sm"
                                  />
                                  <div className="flex gap-2">
                                    <Popover
                                      open={editFollowupCalendarOpen}
                                      onOpenChange={setEditFollowupCalendarOpen}
                                    >
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className={cn(
                                            'h-8 w-[140px] justify-start text-left font-normal text-sm',
                                            !editingFollowup.due_date && 'text-muted-foreground',
                                          )}
                                        >
                                          <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                                          {editingFollowup.due_date
                                            ? format(editingFollowup.due_date, 'MMM d, yyyy')
                                            : 'Due date'}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                          mode="single"
                                          selected={editingFollowup.due_date}
                                          onSelect={(date) => {
                                            setEditingFollowup({
                                              ...editingFollowup,
                                              due_date: date,
                                            });
                                            setEditFollowupCalendarOpen(false);
                                          }}
                                          initialFocus
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                  <div className="flex gap-2 justify-end">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs"
                                      onClick={() => setEditingFollowup(null)}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={saveFollowupEdit}
                                    >
                                      Save
                                    </Button>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          }

                          return (
                            <motion.div key={itemId} {...getMotionProps(itemId)}>
                              <Popover
                                open={
                                  selectedItem?.type === 'followup' &&
                                  selectedItem?.data._id === f._id
                                }
                                onOpenChange={(open) => {
                                  if (!open) setSelectedItem(null);
                                }}
                              >
                                <div className="flex items-center gap-3">
                                  {/* Timeline dot - purple if completed, amber if pending - clickable for toggle */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleFollowup(f._id, f.status);
                                    }}
                                    className={cn(
                                      'flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 transition-colors',
                                      isCompleted
                                        ? 'bg-primary-500 border-primary-500 hover:bg-primary-600'
                                        : 'bg-white border-amber-500 hover:bg-amber-50',
                                    )}
                                  >
                                    {isCompleted && <Check className="h-3 w-3 text-white" />}
                                  </button>
                                  {/* Content - clickable for popup */}
                                  <PopoverTrigger asChild>
                                    <div
                                      className={cn(
                                        'flex-1 border rounded-lg pl-3 pr-4 py-3 transition-colors min-h-[56px] flex items-center cursor-pointer',
                                        isCompleted ? 'bg-slate-50/50' : 'hover:bg-slate-50',
                                      )}
                                      onClick={() => setSelectedItem({ type: 'followup', data: f })}
                                    >
                                      <div className="flex items-center justify-between w-full gap-3">
                                        <div className="flex-1 min-w-0">
                                          <div
                                            className={cn(
                                              'text-sm font-medium',
                                              isCompleted
                                                ? 'text-slate-400 line-through'
                                                : isOverdue
                                                  ? 'text-red-600'
                                                  : 'text-slate-900',
                                            )}
                                          >
                                            {f.description || f.title}
                                          </div>
                                          <div
                                            className={cn(
                                              'text-xs mt-0.5',
                                              isCompleted
                                                ? 'text-slate-400'
                                                : isOverdue
                                                  ? 'text-red-500 font-medium'
                                                  : 'text-slate-400',
                                            )}
                                          >
                                            {f.due_at
                                              ? isCompleted
                                                ? format(new Date(f.due_at), 'MMM d')
                                                : formatDueDate(f.due_at, isOverdue)
                                              : 'No due date'}
                                          </div>
                                        </div>
                                        <div className="flex-shrink-0 flex items-center">
                                          {!isCompleted && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                toggleFollowup(f._id, f.status);
                                              }}
                                              className="h-5 w-5 rounded border border-primary-500 flex items-center justify-center hover:bg-primary-50 transition-colors mr-5"
                                              title="Mark as complete"
                                            />
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </PopoverTrigger>
                                </div>
                                <PopoverContent className="w-64 p-3" align="end">
                                  <div className="space-y-3">
                                    <div className="text-sm font-medium text-slate-900">
                                      {f.description || f.title}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {f.due_at
                                        ? `Due ${format(new Date(f.due_at), 'MMM d, yyyy')}`
                                        : 'No due date'}
                                      {isCompleted && ' · Completed'}
                                      {isOverdue && ' · Overdue'}
                                    </div>
                                    <div className="flex gap-2 pt-2 border-t">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 h-8 text-xs gap-1.5"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedItem(null);
                                          setEditingFollowup({
                                            _id: f._id,
                                            description: f.description || f.title || '',
                                            due_date: f.due_at ? new Date(f.due_at) : undefined,
                                          });
                                        }}
                                      >
                                        <Pencil className="h-3 w-3" />
                                        Edit
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 h-8 text-xs gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedItem(null);
                                          removeFollowup(f._id);
                                        }}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                        Delete
                                      </Button>
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </motion.div>
                          );
                        }
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Edit Button */}
        <div className="border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setShowEditSection(!showEditSection)}
          >
            <Pencil className="h-3.5 w-3.5" />
            {showEditSection ? 'Hide Details' : 'Edit Details'}
          </Button>

          {/* Secondary Content - Shown when Edit is clicked */}
          {showEditSection && (
            <Tabs value={secondaryTab} onValueChange={setSecondaryTab} className="mt-4">
              <TabsList className="h-8 p-0.5 bg-slate-100 rounded-lg w-fit">
                <TabsTrigger value="details" className="text-xs h-7 px-3 rounded-md">
                  Details
                </TabsTrigger>
                <TabsTrigger value="materials" className="text-xs h-7 px-3 rounded-md">
                  Materials
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="mt-4 space-y-4">
                <div className="space-y-3 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">Job Title</Label>
                    <Input
                      value={local.job_title}
                      onChange={(e) => setLocal({ ...local, job_title: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Company</Label>
                    <Input
                      value={local.company}
                      onChange={(e) => setLocal({ ...local, company: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Job Posting URL</Label>
                    <Input
                      value={local.url || ''}
                      onChange={(e) => setLocal({ ...local, url: e.target.value })}
                      placeholder="https://..."
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select
                      value={local.status}
                      onValueChange={(v) =>
                        setLocal((p) => ({
                          ...p,
                          status: v as DBApplication['status'],
                        }))
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="saved">In Progress</SelectItem>
                        <SelectItem value="applied">Applied</SelectItem>
                        <SelectItem value="interview">Interviewing</SelectItem>
                        <SelectItem value="offer">Offer</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="notes" className="text-xs text-muted-foreground">
                      Notes
                    </Label>
                    <Textarea
                      id="notes"
                      className="mt-1 min-h-[100px]"
                      value={local.notes ?? ''}
                      onChange={(e) => setLocal({ ...local, notes: e.target.value })}
                      placeholder="Add notes about this application..."
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 pt-3 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-destructive border-destructive hover:bg-destructive/10"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Delete Application
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                      Close
                    </Button>
                    <Button size="sm" onClick={save} disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving...
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="materials" className="mt-4 space-y-4">
                <div>
                  <Label className="text-sm">Resume used</Label>
                  <Select value={selectedResumeId} onValueChange={(v) => setSelectedResumeId(v)}>
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Select resume" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {(resumes || []).map((r: any) => (
                        <SelectItem key={r._id} value={r._id}>
                          {r.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Cover Letter used</Label>
                  <Select value={selectedCoverId} onValueChange={(v) => setSelectedCoverId(v)}>
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Select cover letter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {(coverLetters || []).map((c: any) => (
                        <SelectItem key={c._id} value={c._id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end pt-2">
                  <Button size="sm" onClick={saveMaterials}>
                    Save Materials
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
