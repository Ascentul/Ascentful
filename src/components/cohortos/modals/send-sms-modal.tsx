'use client';

import { Loader2, MessageSquare } from 'lucide-react';
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
import { cn } from '@/lib/utils';

import {
  personalizeMessage,
  type SmsTemplateKey,
  smsTemplateOptions,
  smsTemplates,
} from './message-templates';

interface SendSmsModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipients: Student | Student[];
  defaultTemplate?: SmsTemplateKey;
}

const MAX_SMS_LENGTH = 160;

export function SendSmsModal({
  isOpen,
  onClose,
  recipients,
  defaultTemplate = 'quick-checkin',
}: SendSmsModalProps) {
  const recipientsList = Array.isArray(recipients) ? recipients : [recipients];
  const isBulk = recipientsList.length > 1;

  // State
  const [template, setTemplate] = useState<SmsTemplateKey>(defaultTemplate);
  const [message, setMessage] = useState('');
  const [logToTimeline, setLogToTimeline] = useState(true);
  const [sending, setSending] = useState(false);

  // Initialize with template content
  useEffect(() => {
    if (template !== 'custom' && smsTemplates[template]) {
      setMessage(smsTemplates[template]);
    }
  }, [template]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setTemplate(defaultTemplate);
      setSending(false);
      if (defaultTemplate !== 'custom' && smsTemplates[defaultTemplate]) {
        setMessage(smsTemplates[defaultTemplate]);
      }
    }
  }, [isOpen, defaultTemplate]);

  const handleTemplateChange = (value: string) => {
    const templateKey = value as SmsTemplateKey;
    setTemplate(templateKey);
    if (templateKey !== 'custom' && smsTemplates[templateKey]) {
      setMessage(smsTemplates[templateKey]);
    }
  };

  const handleSend = async () => {
    setSending(true);

    // Log payload
    console.log('Sending SMS:', {
      recipients: recipientsList.map((r) => ({ name: r.name, phone: r.phone })),
      message,
      logToTimeline,
    });

    // Simulate sending
    await new Promise((r) => setTimeout(r, 1000));

    toast.success(
      isBulk
        ? `SMS sent to ${recipientsList.length} students`
        : `SMS sent to ${recipientsList[0].name}`,
    );

    setSending(false);
    onClose();
  };

  // Display recipients
  const displayTo = isBulk
    ? `${recipientsList.length} students selected`
    : `${recipientsList[0].name} (${recipientsList[0].phone})`;

  // Preview personalized message for first recipient
  const previewMessage = personalizeMessage(message, recipientsList[0].name.split(' ')[0]);
  const charCount = previewMessage.length;
  const isOverLimit = charCount > MAX_SMS_LENGTH;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {isBulk ? `Send SMS to ${recipientsList.length} Students` : 'Send SMS'}
          </DialogTitle>
          <DialogDescription>
            {isBulk
              ? 'This message will be personalized and sent to each student.'
              : `Send an SMS to ${recipientsList[0].name}`}
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
              {smsTemplateOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="message">Message</Label>
              <span
                className={cn(
                  'text-xs',
                  isOverLimit ? 'text-red-600 font-medium' : 'text-slate-500',
                )}
              >
                {charCount}/{MAX_SMS_LENGTH}
              </span>
            </div>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className={cn(
                'w-full px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:border-primary-500 resize-none',
                isOverLimit
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-slate-200 focus:ring-primary-500',
              )}
              placeholder="Write your message..."
            />
            <p className="text-xs text-slate-500">
              Use {'{{first_name}}'} to personalize. Standard SMS is 160 characters.
            </p>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview (for {recipientsList[0].name.split(' ')[0]})</Label>
            <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 border border-slate-200">
              {previewMessage}
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
          <Button onClick={handleSend} disabled={sending || !message.trim() || isOverLimit}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <MessageSquare className="h-4 w-4 mr-2" />
                Send SMS
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
