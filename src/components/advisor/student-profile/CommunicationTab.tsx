'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { ChevronRight, Lock, MessageSquare, Plus, Send, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

interface CommunicationTabProps {
  studentId: Id<'users'>;
  studentName: string;
}

type ThreadSubTab = 'student' | 'internal';

export function CommunicationTab({ studentId, studentName }: CommunicationTabProps) {
  const { user } = useUser();
  const router = useRouter();
  const clerkId = user?.id;

  const [subTab, setSubTab] = useState<ThreadSubTab>('student');
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false);
  const [isNewInternalOpen, setIsNewInternalOpen] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newBody, setNewBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch threads for this student
  const studentThreads = useQuery(
    api.inbox_threads.listStudentProfileThreads,
    clerkId ? { studentId, threadType: 'student' } : 'skip',
  );

  const internalThreads = useQuery(
    api.inbox_threads.listStudentProfileThreads,
    clerkId ? { studentId, threadType: 'internal' } : 'skip',
  );

  // Mutations
  const createThread = useMutation(api.inbox_threads_mutations.createThread);
  const createInternalThread = useMutation(api.inbox_threads_mutations.createInternalThread);

  const handleCreateStudentMessage = async () => {
    if (!newSubject.trim() || !newBody.trim() || !clerkId) return;

    setIsSubmitting(true);
    try {
      await createThread({
        studentId,
        subject: newSubject.trim(),
        body: newBody.trim(),
      });
      toast.success('Message sent successfully');
      setIsNewMessageOpen(false);
      setNewSubject('');
      setNewBody('');
    } catch (error) {
      console.error('Failed to create message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateInternalThread = async () => {
    if (!newSubject.trim() || !newBody.trim() || !clerkId) return;

    setIsSubmitting(true);
    try {
      await createInternalThread({
        subject: newSubject.trim(),
        body: newBody.trim(),
        referencedStudentId: studentId,
      });
      toast.success('Internal thread created');
      setIsNewInternalOpen(false);
      setNewSubject('');
      setNewBody('');
    } catch (error) {
      console.error('Failed to create internal thread:', error);
      toast.error('Failed to create internal thread');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatRelativeDate = (timestamp: number) => {
    const days = Math.floor((Date.now() - timestamp) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
      NEW: 'default',
      OPEN: 'secondary',
      IN_PROGRESS: 'secondary',
      WAITING_ON_STUDENT: 'outline',
      WAITING_ON_STAFF: 'destructive',
      RESOLVED: 'outline',
      ARCHIVED: 'outline',
    };
    return <Badge variant={variants[status] || 'outline'}>{status.replace(/_/g, ' ')}</Badge>;
  };

  const getChannelBadge = (channel: string) => {
    if (channel.startsWith('email_')) {
      return (
        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
          Email
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs">
        In-app
      </Badge>
    );
  };

  const renderThreadList = (threads: typeof studentThreads, isInternal: boolean) => {
    if (threads === undefined) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (threads.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>
            {isInternal
              ? 'No internal threads about this student'
              : 'No messages with this student'}
          </p>
          <p className="text-xs mt-1">
            {isInternal
              ? 'Create an internal thread to collaborate with colleagues'
              : 'Start a conversation with the student'}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {threads.map((thread) => (
          <div
            key={thread._id}
            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
            role="button"
            tabIndex={0}
            onClick={() => router.push(`/u/inbox?thread=${thread._id}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                router.push(`/u/inbox?thread=${thread._id}`);
              }
            }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {isInternal && <Lock className="h-3 w-3 text-amber-600 flex-shrink-0" />}
                <p className="font-medium truncate">{thread.subject}</p>
              </div>
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                {thread.snippet || 'No preview available'}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {getChannelBadge(thread.channel)}
                <span className="text-xs text-muted-foreground">
                  {formatRelativeDate(thread.last_message_at)}
                </span>
                {thread.messageCount !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    {thread.messageCount} message{thread.messageCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              {getStatusBadge(thread.status)}
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Communication
            </CardTitle>
            <CardDescription>Messages with {studentName} and internal discussions</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNewSubject('');
                setNewBody('');
                setIsNewInternalOpen(true);
              }}
            >
              <Users className="h-4 w-4 mr-1" />
              Internal Thread
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setNewSubject('');
                setNewBody('');
                setIsNewMessageOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              New Message
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={subTab} onValueChange={(v) => setSubTab(v as ThreadSubTab)}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="student" className="gap-2">
              <Send className="h-4 w-4" />
              Student
              {studentThreads && studentThreads.length > 0 && (
                <span className="ml-1 text-xs bg-muted px-1.5 rounded-full">
                  {studentThreads.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="internal" className="gap-2">
              <Lock className="h-4 w-4" />
              Internal
              {internalThreads && internalThreads.length > 0 && (
                <span className="ml-1 text-xs bg-amber-100 text-amber-800 px-1.5 rounded-full">
                  {internalThreads.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="student">{renderThreadList(studentThreads, false)}</TabsContent>

          <TabsContent value="internal">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 text-amber-800 text-sm">
                <Lock className="h-4 w-4" />
                <span className="font-medium">Internal threads are not visible to students</span>
              </div>
              <p className="text-xs text-amber-700 mt-1">
                Use internal threads for handoffs, case conferences, or supervisor escalations.
              </p>
            </div>
            {renderThreadList(internalThreads, true)}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* New Student Message Dialog */}
      <Dialog open={isNewMessageOpen} onOpenChange={setIsNewMessageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Message to {studentName}</DialogTitle>
            <DialogDescription>
              Send an in-app message to this student. They will be notified in their inbox.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="Enter subject..."
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Message</Label>
              <Textarea
                id="body"
                placeholder="Write your message..."
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewMessageOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateStudentMessage}
              disabled={!newSubject.trim() || !newBody.trim() || isSubmitting}
            >
              {isSubmitting ? 'Sending...' : 'Send Message'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Internal Thread Dialog */}
      <Dialog open={isNewInternalOpen} onOpenChange={setIsNewInternalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-600" />
              New Internal Thread
            </DialogTitle>
            <DialogDescription>
              Create an internal discussion about {studentName}. This will not be visible to the
              student.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-700">
                Internal threads are for advisor-to-advisor communication only. Use them for
                handoffs, case notes, or escalations.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="internal-subject">Subject</Label>
              <Input
                id="internal-subject"
                placeholder="e.g., Handoff: Student needs interview coaching"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="internal-body">Message</Label>
              <Textarea
                id="internal-body"
                placeholder="Describe the situation, what's been done, and what's needed next..."
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewInternalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateInternalThread}
              disabled={!newSubject.trim() || !newBody.trim() || isSubmitting}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isSubmitting ? 'Creating...' : 'Create Internal Thread'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
