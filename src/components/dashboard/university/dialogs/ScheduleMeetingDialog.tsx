'use client';

import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { Calendar, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface ScheduleMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: Id<'users'>;
}

const MEETING_TYPES = [
  { value: 'career_advising', label: 'Career Advising Session' },
  { value: 'resume_review', label: 'Resume Review' },
  { value: 'interview_prep', label: 'Interview Preparation' },
  { value: 'job_search', label: 'Job Search Strategy' },
  { value: 'networking', label: 'Networking & Professional Development' },
  { value: 'other', label: 'Other' },
];

const DEFAULT_SUBJECT = "Let's schedule a meeting";

function getDefaultBody(meetingType: string, studentName: string): string {
  const name = studentName || 'there';
  switch (meetingType) {
    case 'career_advising':
      return `Hi ${name},

I'd like to schedule a career advising session with you to discuss your career goals and how I can help you achieve them.

Please let me know your availability for a meeting this week or next, and I'll send you a calendar invite.

Looking forward to connecting!`;
    case 'resume_review':
      return `Hi ${name},

I'd like to schedule a time to review your resume together. I've noticed some opportunities for improvement that could help strengthen your job applications.

Please share your availability and I'll set up a meeting.

Best regards`;
    case 'interview_prep':
      return `Hi ${name},

I'd like to schedule an interview preparation session with you. We can practice common questions and work on your presentation skills.

Let me know when you're free to meet.

Best regards`;
    case 'job_search':
      return `Hi ${name},

I'd like to meet with you to discuss your job search strategy. We can review your approach and identify new opportunities together.

Please share your availability.

Best regards`;
    case 'networking':
      return `Hi ${name},

I'd like to schedule a meeting to discuss networking strategies and professional development opportunities that could benefit your career.

When are you available to meet?

Best regards`;
    default:
      return `Hi ${name},

I'd like to schedule a meeting with you. Please let me know your availability.

Best regards`;
  }
}

export function ScheduleMeetingDialog({
  open,
  onOpenChange,
  studentId,
}: ScheduleMeetingDialogProps) {
  const { toast } = useToast();
  const [meetingType, setMeetingType] = useState('career_advising');
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Fetch student info
  const student = useQuery(api.users.getUserById, { userId: studentId });

  const createThread = useMutation(api.inbox_threads_mutations.createThread);

  // Update body when meeting type changes or student loads
  const updateBody = (type: string) => {
    setMeetingType(type);
    const typeLabel = MEETING_TYPES.find((t) => t.value === type)?.label || 'Meeting';
    setSubject(`Meeting Request: ${typeLabel}`);
    setBody(getDefaultBody(type, student?.name || ''));
  };

  // Initialize body when student data loads
  useEffect(() => {
    if (student && !body) {
      setBody(getDefaultBody(meetingType, student.name || ''));
    }
  }, [student, body, meetingType]);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Please enter both a subject and message body.',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    try {
      await createThread({
        studentId,
        subject: subject.trim(),
        body: body.trim(),
        priority: 'P2', // Medium priority for meeting requests
        channel: 'in_app',
      });

      toast({
        title: 'Meeting request sent',
        description: `Message sent to ${student?.name || student?.email || 'student'}`,
      });

      onOpenChange(false);
      // Reset for next use
      setMeetingType('career_advising');
      setSubject(DEFAULT_SUBJECT);
      setBody('');
    } catch (error) {
      console.error('Failed to send meeting request:', error);
      toast({
        title: 'Failed to send',
        description: error instanceof Error ? error.message : 'Could not send the meeting request.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule Meeting
          </DialogTitle>
          <DialogDescription>
            Send a meeting request to {student?.name || 'the student'}. They will receive this
            message in their inbox.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="meeting-type">Meeting Type</Label>
            <Select value={meetingType} onValueChange={updateBody}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select meeting type" />
              </SelectTrigger>
              <SelectContent>
                {MEETING_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="meeting-subject">Subject</Label>
            <Input
              id="meeting-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter message subject"
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="meeting-body">Message</Label>
            <Textarea
              id="meeting-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter your message..."
              rows={8}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Tip: Include your availability or a link to your scheduling tool.
            </p>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isSending}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleSend} disabled={isSending || !student}>
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Calendar className="h-4 w-4 mr-2" />
                Send Request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
