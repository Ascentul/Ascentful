'use client';

/**
 * Student Messages - Thread Detail
 *
 * Shows a single thread with:
 * - Message history
 * - Reply composer
 * - Status indicator
 * - Resolve/Reopen actions
 */

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import {
  ArrowLeft,
  CheckCircle,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { StudentUniversityGate } from '@/components/StudentUniversityGate';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { formatRelativeTime } from '@/lib/date-utils';
import { sanitizeUserHtml } from '@/lib/sanitize-html';
import { cn } from '@/lib/utils';

export default function StudentThreadDetailPage() {
  return (
    <StudentUniversityGate>
      <ThreadDetailContent />
    </StudentUniversityGate>
  );
}

function ThreadDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const { toast } = useToast();
  const clerkId = user?.id;
  const threadId = params.threadId as string;

  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isReopening, setIsReopening] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch thread with messages
  const threadData = useQuery(
    api.inbox_student.getMyThread,
    clerkId && threadId ? { clerkId, threadId: threadId as Id<'inbox_threads'> } : 'skip',
  );

  const sendMessage = useMutation(api.inbox_student.sendMessage);
  const markAsRead = useMutation(api.inbox_student.markAsRead);
  const markResolved = useMutation(api.inbox_student.markResolved);
  const reopenThread = useMutation(api.inbox_student.reopenThread);

  // Mark as read when viewing
  useEffect(() => {
    if (clerkId && threadId) {
      markAsRead({ clerkId, threadId: threadId as Id<'inbox_threads'> }).catch(() => {
        // Silently fail
      });
    }
  }, [clerkId, threadId, markAsRead]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [threadData?.messages?.length]);

  const handleSend = async () => {
    if (!clerkId || !threadId || !replyText.trim()) return;

    setIsSending(true);
    try {
      await sendMessage({
        clerkId,
        threadId: threadId as Id<'inbox_threads'>,
        body: replyText.trim(),
      });

      setReplyText('');
      toast({
        title: 'Message sent',
        description: 'Your reply has been sent',
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleResolve = async () => {
    if (!clerkId || !threadId) return;

    setIsResolving(true);
    try {
      await markResolved({
        clerkId,
        threadId: threadId as Id<'inbox_threads'>,
      });

      toast({
        title: 'Thread resolved',
        description: 'This conversation has been marked as resolved',
      });
    } catch (error) {
      console.error('Error resolving thread:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to resolve thread',
        variant: 'destructive',
      });
    } finally {
      setIsResolving(false);
    }
  };

  const handleReopen = async () => {
    if (!clerkId || !threadId) return;

    setIsReopening(true);
    try {
      await reopenThread({
        clerkId,
        threadId: threadId as Id<'inbox_threads'>,
      });

      toast({
        title: 'Thread reopened',
        description: 'This conversation has been reopened',
      });
    } catch (error) {
      console.error('Error reopening thread:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reopen thread',
        variant: 'destructive',
      });
    } finally {
      setIsReopening(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isSending) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!threadData) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { thread, messages } = threadData;
  const isResolved = thread.status === 'RESOLVED';
  const isArchived = thread.status === 'ARCHIVED';

  return (
    <div className="w-full">
      <div className="w-full gradient-border-bottom p-5 space-y-4 shadow-sm">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Link href="/student/messages">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{thread.subject}</h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                <Badge
                  className={cn(
                    isResolved
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                      : thread.status === 'WAITING_ON_STUDENT'
                        ? 'bg-orange-100 text-orange-700 border-orange-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200',
                  )}
                >
                  {thread.statusLabel}
                </Badge>
                {thread.categoryLabel && (
                  <>
                    <span>·</span>
                    <span>{thread.categoryLabel}</span>
                  </>
                )}
                {thread.assignee && (
                  <>
                    <span>·</span>
                    <span>Assigned to {thread.assignee.name}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {isResolved && !isArchived && (
              <Button variant="outline" onClick={handleReopen} disabled={isReopening}>
                {isReopening ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Reopen
              </Button>
            )}
            {!isResolved && !isArchived && (
              <Button variant="outline" onClick={handleResolve} disabled={isResolving}>
                {isResolving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Mark Resolved
              </Button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="space-y-4 max-h-[60vh] overflow-y-auto py-4">
          {messages.map((message) => (
            <MessageBubble
              key={message._id}
              message={message}
              isStudent={message.sender_type === 'student'}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply Composer */}
        {!isArchived && (
          <Card>
            <CardContent className="p-4">
              {isResolved ? (
                <div className="text-center text-muted-foreground py-2">
                  <p>This conversation has been resolved.</p>
                  <p className="text-sm">Reopen it to send more messages.</p>
                </div>
              ) : (
                <div className="flex gap-3">
                  <Textarea
                    placeholder="Type your reply... (Press Enter to send, Shift+Enter for new line)"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={3}
                    className="resize-none"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={isSending || !replyText.trim()}
                    className="self-end"
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Message Bubble Component
interface MessageBubbleProps {
  message: {
    _id: string;
    body: string;
    body_html?: string;
    sender_type: string;
    senderUser: { _id: string; name: string; imageUrl?: string } | null;
    attachments?: Array<{
      id: string;
      name: string;
      size: number;
      mime_type: string;
      url?: string;
    }>;
    created_at: number;
  };
  isStudent: boolean;
}

function MessageBubble({ message, isStudent }: MessageBubbleProps) {
  const senderName = isStudent ? 'You' : message.senderUser?.name || 'Career Services';

  return (
    <div className={cn('flex gap-3', isStudent && 'flex-row-reverse')}>
      <Avatar className="h-8 w-8 flex-shrink-0">
        {message.senderUser?.imageUrl ? (
          <AvatarImage src={message.senderUser.imageUrl} alt={senderName} />
        ) : null}
        <AvatarFallback>
          {isStudent ? <User className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      <div className={cn('flex-1 max-w-[75%]', isStudent && 'flex flex-col items-end')}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">{senderName}</span>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(message.created_at)}
          </span>
        </div>

        <div
          className={cn(
            'rounded-lg p-3 text-sm',
            isStudent
              ? 'bg-primary-500 text-white rounded-br-none'
              : 'bg-slate-100 text-slate-900 rounded-bl-none',
          )}
        >
          {message.body_html ? (
            <div dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(message.body_html) }} />
          ) : (
            <p className="whitespace-pre-wrap">{message.body}</p>
          )}
        </div>

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.attachments.map((att) => (
              <a
                key={att.id}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-primary-600 hover:underline"
              >
                <span>📎</span>
                <span>{att.name}</span>
                <span className="text-muted-foreground">({Math.round(att.size / 1024)}KB)</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
