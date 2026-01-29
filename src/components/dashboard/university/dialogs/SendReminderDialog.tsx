'use client';

import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import { Loader2, Mail } from 'lucide-react';
import { useState } from 'react';

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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface SendReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: {
    _id: Id<'users'>;
    name: string | undefined;
    email: string;
  };
}

const DEFAULT_SUBJECT = 'Check in: How can we help with your career journey?';
const DEFAULT_BODY = `Hi there,

We noticed you haven't been active on the platform recently and wanted to check in. Our career services team is here to help you succeed!

Here are some things you can do:
• Update your resume with our AI-powered builder
• Track your job applications
• Set career goals and milestones
• Reach out if you need any guidance

Don't hesitate to reply to this message if you have questions or need support.

Best regards,
Your Career Services Team`;

export function SendReminderDialog({ open, onOpenChange, student }: SendReminderDialogProps) {
  const { toast } = useToast();
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [isSending, setIsSending] = useState(false);

  const createThread = useMutation(api.inbox_threads_mutations.createThread);

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
        studentId: student._id,
        subject: subject.trim(),
        body: body.trim(),
        priority: 'P3',
        channel: 'in_app',
      });

      toast({
        title: 'Reminder sent',
        description: `Message sent to ${student.name || student.email}`,
      });

      onOpenChange(false);
      // Reset to defaults for next use
      setSubject(DEFAULT_SUBJECT);
      setBody(DEFAULT_BODY);
    } catch (error) {
      console.error('Failed to send reminder:', error);
      toast({
        title: 'Failed to send',
        description:
          error instanceof Error ? error.message : 'Could not send the reminder message.',
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
            <Mail className="h-5 w-5" />
            Send Engagement Reminder
          </DialogTitle>
          <DialogDescription>
            Send a message to {student.name || student.email} to encourage platform engagement.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="reminder-subject">Subject</Label>
            <Input
              id="reminder-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter message subject"
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="reminder-body">Message</Label>
            <Textarea
              id="reminder-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter your message..."
              rows={10}
              className="mt-2"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isSending}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleSend} disabled={isSending}>
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send Message
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
