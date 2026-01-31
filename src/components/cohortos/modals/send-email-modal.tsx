'use client';

import { Check, Loader2, Mail } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type Student } from '@/lib/cohortos/types';

import {
  type EmailTemplateKey,
  emailTemplateOptions,
  emailTemplates,
  personalizeMessage,
} from './message-templates';

interface SendEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipients: Student | Student[];
  defaultTemplate?: EmailTemplateKey;
}

export function SendEmailModal({
  isOpen,
  onClose,
  recipients,
  defaultTemplate = 'quick-checkin',
}: SendEmailModalProps) {
  const recipientsList = Array.isArray(recipients) ? recipients : [recipients];
  const isBulk = recipientsList.length > 1;

  // State
  const [template, setTemplate] = useState<EmailTemplateKey>(defaultTemplate);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [logToTimeline, setLogToTimeline] = useState(true);
  const [sending, setSending] = useState(false);

  // Initialize with template content
  useEffect(() => {
    if (template !== 'custom' && emailTemplates[template]) {
      setSubject(emailTemplates[template].subject);
      setBody(emailTemplates[template].body);
    }
  }, [template]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setTemplate(defaultTemplate);
      setSending(false);
      if (defaultTemplate !== 'custom' && emailTemplates[defaultTemplate]) {
        setSubject(emailTemplates[defaultTemplate].subject);
        setBody(emailTemplates[defaultTemplate].body);
      }
    }
  }, [isOpen, defaultTemplate]);

  const handleTemplateChange = (value: string) => {
    const templateKey = value as EmailTemplateKey;
    setTemplate(templateKey);
    if (templateKey !== 'custom' && emailTemplates[templateKey]) {
      setSubject(emailTemplates[templateKey].subject);
      setBody(emailTemplates[templateKey].body);
    }
  };

  const handleSend = async () => {
    setSending(true);

    // Log payload
    console.log('Sending email:', {
      recipients: recipientsList.map((r) => ({ name: r.name, email: r.email })),
      subject,
      body,
      logToTimeline,
    });

    // Simulate sending
    await new Promise((r) => setTimeout(r, 1000));

    toast.success(
      isBulk
        ? `Email sent to ${recipientsList.length} students`
        : `Email sent to ${recipientsList[0].name}`,
    );

    setSending(false);
    onClose();
  };

  // Display recipients
  const displayTo = isBulk
    ? `${recipientsList.length} students selected`
    : `${recipientsList[0].name} <${recipientsList[0].email}>`;

  // Preview personalized message for first recipient
  const previewBody = personalizeMessage(body, recipientsList[0].name.split(' ')[0]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {isBulk ? `Send Email to ${recipientsList.length} Students` : 'Send Email'}
          </DialogTitle>
          <DialogDescription>
            {isBulk
              ? 'This email will be personalized and sent to each student.'
              : `Send an email to ${recipientsList[0].name}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* To Field */}
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input id="to" value={displayTo} readOnly className="bg-slate-50" />
          </div>

          {/* Template Selection */}
          <div className="space-y-2">
            <Label htmlFor="template">Template</Label>
            <select
              id="template"
              value={template}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {emailTemplateOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
            />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
            <textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              placeholder="Write your message..."
            />
            <p className="text-xs text-slate-500">
              Use {'{{first_name}}'} to personalize the message
            </p>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview (for {recipientsList[0].name.split(' ')[0]})</Label>
            <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 border border-slate-200 max-h-32 overflow-y-auto whitespace-pre-wrap">
              {previewBody}
            </div>
          </div>

          {/* Log to Timeline */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={logToTimeline}
              onChange={(e) => setLogToTimeline(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-slate-700">Log to student timeline</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || !subject.trim() || !body.trim()}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
