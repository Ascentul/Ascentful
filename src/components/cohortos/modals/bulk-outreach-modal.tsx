'use client';

import { ChevronDown, ChevronUp, Loader2, Mail, MessageSquare, Send, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { type Student } from '@/lib/cohortos/types';
import { cn } from '@/lib/utils';

import {
  type EmailTemplateKey,
  emailTemplateOptions,
  emailTemplates,
  personalizeMessage,
  type SmsTemplateKey,
  smsTemplateOptions,
  smsTemplates,
} from './message-templates';

interface BulkOutreachModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
}

type Channel = 'email' | 'sms';

export function BulkOutreachModal({ isOpen, onClose, students }: BulkOutreachModalProps) {
  // State
  const [channel, setChannel] = useState<Channel>('email');
  const [emailTemplate, setEmailTemplate] = useState<EmailTemplateKey>('quick-checkin');
  const [smsTemplate, setSmsTemplate] = useState<SmsTemplateKey>('quick-checkin');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [logToTimeline, setLogToTimeline] = useState(true);
  const [showAllRecipients, setShowAllRecipients] = useState(false);
  const [sending, setSending] = useState(false);

  // Initialize content based on channel and template
  useEffect(() => {
    if (channel === 'email' && emailTemplate !== 'custom' && emailTemplates[emailTemplate]) {
      setSubject(emailTemplates[emailTemplate].subject);
      setMessage(emailTemplates[emailTemplate].body);
    } else if (channel === 'sms' && smsTemplate !== 'custom' && smsTemplates[smsTemplate]) {
      setMessage(smsTemplates[smsTemplate]);
    }
  }, [channel, emailTemplate, smsTemplate]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setChannel('email');
      setEmailTemplate('quick-checkin');
      setSmsTemplate('quick-checkin');
      setShowAllRecipients(false);
      setSending(false);
      setLogToTimeline(true);
      if (emailTemplates['quick-checkin']) {
        setSubject(emailTemplates['quick-checkin'].subject);
        setMessage(emailTemplates['quick-checkin'].body);
      }
    }
  }, [isOpen]);

  const handleChannelChange = (newChannel: Channel) => {
    setChannel(newChannel);
    if (newChannel === 'email' && emailTemplate !== 'custom' && emailTemplates[emailTemplate]) {
      setSubject(emailTemplates[emailTemplate].subject);
      setMessage(emailTemplates[emailTemplate].body);
    } else if (newChannel === 'sms' && smsTemplate !== 'custom' && smsTemplates[smsTemplate]) {
      setMessage(smsTemplates[smsTemplate]);
      setSubject('');
    }
  };

  const handleTemplateChange = (value: string) => {
    if (channel === 'email') {
      const templateKey = value as EmailTemplateKey;
      setEmailTemplate(templateKey);
      if (templateKey !== 'custom' && emailTemplates[templateKey]) {
        setSubject(emailTemplates[templateKey].subject);
        setMessage(emailTemplates[templateKey].body);
      }
    } else {
      const templateKey = value as SmsTemplateKey;
      setSmsTemplate(templateKey);
      if (templateKey !== 'custom' && smsTemplates[templateKey]) {
        setMessage(smsTemplates[templateKey]);
      }
    }
  };

  const handleSend = async () => {
    setSending(true);

    console.log(`Sending bulk ${channel}:`, {
      recipients: students.map((s) => ({
        name: s.name,
        email: s.email,
        phone: s.phone,
      })),
      channel,
      subject: channel === 'email' ? subject : undefined,
      message,
      logToTimeline,
    });

    // Simulate sending with progress
    await new Promise((r) => setTimeout(r, 1500));

    toast.success(`${channel === 'email' ? 'Email' : 'SMS'} sent to ${students.length} students`);

    setSending(false);
    onClose();
  };

  const visibleRecipients = showAllRecipients ? students : students.slice(0, 5);
  const hiddenCount = students.length - 5;

  // Preview for first student
  const previewStudent = students[0];
  const previewMessage = previewStudent
    ? personalizeMessage(message, previewStudent.name.split(' ')[0])
    : message;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Send to {students.length} Students
          </DialogTitle>
          <DialogDescription>
            This message will be personalized and sent to each student.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Recipients List */}
          <div className="space-y-2">
            <Label>Recipients</Label>
            <div className="bg-slate-50 rounded-lg p-3 space-y-1 max-h-40 overflow-y-auto">
              {visibleRecipients.map((student) => (
                <div key={student.id} className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-slate-900">{student.name}</span>
                  <span className="text-slate-400">
                    {channel === 'email' ? student.email : student.phone}
                  </span>
                </div>
              ))}
              {hiddenCount > 0 && !showAllRecipients && (
                <button
                  onClick={() => setShowAllRecipients(true)}
                  className="flex items-center gap-1 text-sm text-primary-600 hover:underline"
                >
                  <ChevronDown className="h-4 w-4" />
                  Show {hiddenCount} more
                </button>
              )}
              {showAllRecipients && students.length > 5 && (
                <button
                  onClick={() => setShowAllRecipients(false)}
                  className="flex items-center gap-1 text-sm text-primary-600 hover:underline"
                >
                  <ChevronUp className="h-4 w-4" />
                  Show less
                </button>
              )}
            </div>
          </div>

          {/* Channel Toggle */}
          <div className="space-y-2">
            <Label>Channel</Label>
            <div className="flex gap-2">
              <button
                onClick={() => handleChannelChange('email')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-colors',
                  channel === 'email'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-slate-200 hover:bg-slate-50',
                )}
              >
                <Mail className="h-4 w-4" />
                Email
              </button>
              <button
                onClick={() => handleChannelChange('sms')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-colors',
                  channel === 'sms'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-slate-200 hover:bg-slate-50',
                )}
              >
                <MessageSquare className="h-4 w-4" />
                SMS
              </button>
            </div>
          </div>

          {/* Template Selection */}
          <div className="space-y-2">
            <Label htmlFor="template">Template</Label>
            <select
              id="template"
              value={channel === 'email' ? emailTemplate : smsTemplate}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {(channel === 'email' ? emailTemplateOptions : smsTemplateOptions).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Subject (email only) */}
          {channel === 'email' && (
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <input
                id="subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Email subject..."
              />
            </div>
          )}

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={channel === 'email' ? 6 : 4}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              placeholder="Write your message..."
            />
            <p className="text-xs text-slate-500">
              Use {'{{first_name}}'} to personalize the message
            </p>
          </div>

          {/* Preview */}
          {previewStudent && (
            <div className="space-y-2">
              <Label>Preview (for {previewStudent.name.split(' ')[0]})</Label>
              <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 border border-slate-200 max-h-32 overflow-y-auto">
                {channel === 'email' && <p className="font-medium mb-2">Subject: {subject}</p>}
                <div className="whitespace-pre-line">{previewMessage}</div>
              </div>
            </div>
          )}

          {/* Log to Timeline */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={logToTimeline}
              onChange={(e) => setLogToTimeline(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-slate-700">Log to each student's timeline</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !message.trim() || (channel === 'email' && !subject.trim())}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending to {students.length}...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send to {students.length} Students
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
