'use client';

/**
 * Student Messages - Thread List
 *
 * Shows all message threads for the student with:
 * - Status indicators (Waiting on Career Services / Waiting on you / Resolved)
 * - Category badges
 * - Unread indicators
 * - New message creation modal
 */

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import {
  Briefcase,
  Calendar,
  FileText,
  HelpCircle,
  Loader2,
  MessageSquare,
  Mic,
  Plus,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { StudentUniversityGate } from '@/components/StudentUniversityGate';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { formatRelativeTime } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

// Category configuration
const CATEGORIES = [
  {
    value: 'resume_review' as const,
    label: 'Resume Review',
    icon: FileText,
    description: 'Get feedback on your resume or CV',
  },
  {
    value: 'interview_help' as const,
    label: 'Interview Help',
    icon: Mic,
    description: 'Mock interviews and interview preparation',
  },
  {
    value: 'job_search' as const,
    label: 'Job Search',
    icon: Search,
    description: 'Help finding opportunities and strategies',
  },
  {
    value: 'appointment' as const,
    label: 'Appointment Request',
    icon: Calendar,
    description: 'Schedule a meeting with your advisor',
  },
  {
    value: 'general' as const,
    label: 'General Question',
    icon: HelpCircle,
    description: 'Any other career-related questions',
  },
  {
    value: 'other' as const,
    label: 'Other',
    icon: Briefcase,
    description: 'Something else',
  },
];

type CategoryValue = (typeof CATEGORIES)[number]['value'];

export default function StudentMessagesPage() {
  return (
    <StudentUniversityGate>
      <StudentMessagesContent />
    </StudentUniversityGate>
  );
}

function StudentMessagesContent() {
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const clerkId = user?.id;

  const [showNewThreadModal, setShowNewThreadModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryValue | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch threads
  const threads = useQuery(
    api.inbox_student.listMyThreads,
    clerkId ? { clerkId, status: 'active' } : 'skip',
  );

  const createThread = useMutation(api.inbox_student.createThread);

  const isLoading = threads === undefined;

  // Filter threads by search
  const filteredThreads = threads?.filter(
    (thread) =>
      !searchQuery ||
      thread.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      thread.snippet?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleCreateThread = async () => {
    if (!clerkId || !selectedCategory || !subject.trim() || !message.trim()) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createThread({
        clerkId,
        category: selectedCategory,
        subject: subject.trim(),
        body: message.trim(),
      });

      toast({
        title: 'Message sent',
        description: 'Your message has been sent to Career Services',
      });

      setShowNewThreadModal(false);
      setSelectedCategory(null);
      setSubject('');
      setMessage('');

      // Navigate to the new thread
      router.push(`/student/messages/${result.threadId}`);
    } catch (error) {
      console.error('Error creating thread:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="w-full gradient-border-bottom p-5 space-y-6 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
            <p className="text-muted-foreground mt-1">
              Message Career Services for help with resumes, interviews, job search, and more
            </p>
          </div>
          <Button onClick={() => setShowNewThreadModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Message
          </Button>
        </div>

        {/* Search */}
        {threads && threads.length > 0 && (
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        )}

        {/* Thread List */}
        {!threads || threads.length === 0 ? (
          <Card className="border-dashed border-2 bg-muted/30">
            <CardContent className="py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">
                Start a conversation with Career Services to get help with your job search, resume
                review, interview preparation, and more.
              </p>
              <Button onClick={() => setShowNewThreadModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Send Your First Message
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredThreads?.map((thread) => (
              <ThreadCard key={thread._id} thread={thread} />
            ))}
            {filteredThreads?.length === 0 && searchQuery && (
              <div className="text-center py-8 text-muted-foreground">
                No messages found matching "{searchQuery}"
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Thread Modal */}
      <Dialog open={showNewThreadModal} onOpenChange={setShowNewThreadModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Message Career Services</DialogTitle>
            <DialogDescription>
              Select a topic and describe what you need help with
            </DialogDescription>
          </DialogHeader>

          {!selectedCategory ? (
            <div className="grid grid-cols-2 gap-3 py-4">
              {CATEGORIES.map((category) => {
                const Icon = category.icon;
                return (
                  <button
                    key={category.value}
                    onClick={() => setSelectedCategory(category.value)}
                    className="flex items-start gap-3 p-4 rounded-lg border hover:border-primary-500 hover:bg-primary-50 transition-colors text-left"
                  >
                    <div className="h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-5 w-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="font-medium">{category.label}</p>
                      <p className="text-sm text-muted-foreground">{category.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                  className="p-0 h-auto"
                >
                  ← Back
                </Button>
                <span>·</span>
                <span>{CATEGORIES.find((c) => c.value === selectedCategory)?.label}</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  placeholder="Brief summary of your request"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Describe what you need help with..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewThreadModal(false)}>
              Cancel
            </Button>
            {selectedCategory && (
              <Button
                onClick={handleCreateThread}
                disabled={isSubmitting || !subject.trim() || !message.trim()}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Message'
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Thread Card Component
interface ThreadCardProps {
  thread: {
    _id: string;
    subject: string;
    snippet?: string;
    status: string;
    statusLabel: string;
    category?: string;
    categoryLabel?: string;
    assignee: { _id: string; name: string; imageUrl?: string } | null;
    message_count: number;
    last_message_at: number;
    last_message_sender_type: string;
    hasUnread: boolean;
    created_at: number;
  };
}

function ThreadCard({ thread }: ThreadCardProps) {
  const getStatusBadgeClassName = (status: string) => {
    switch (status) {
      case 'WAITING_ON_STUDENT':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'RESOLVED':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <Link href={`/student/messages/${thread._id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Unread indicator */}
            <div className="flex-shrink-0 pt-1">
              {thread.hasUnread ? (
                <div className="h-2.5 w-2.5 rounded-full bg-primary-500" />
              ) : (
                <div className="h-2.5 w-2.5 rounded-full bg-transparent" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3
                  className={`font-medium truncate ${thread.hasUnread ? 'text-slate-900' : 'text-slate-700'}`}
                >
                  {thread.subject}
                </h3>
                {thread.categoryLabel && (
                  <Badge variant="outline" className="flex-shrink-0 text-xs">
                    {thread.categoryLabel}
                  </Badge>
                )}
              </div>

              {thread.snippet && (
                <p className="text-sm text-muted-foreground truncate mb-2">{thread.snippet}</p>
              )}

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <Badge className={getStatusBadgeClassName(thread.status)}>
                  {thread.statusLabel}
                </Badge>
                <span>·</span>
                <span>{formatRelativeTime(thread.last_message_at)}</span>
                {thread.assignee && (
                  <>
                    <span>·</span>
                    <span>Assigned to {thread.assignee.name}</span>
                  </>
                )}
              </div>
            </div>

            {/* Message count */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
              <MessageSquare className="h-3.5 w-3.5" />
              <span>{thread.message_count}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
