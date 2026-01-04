'use client';

/**
 * Student Advisor Messages - Real-time Messaging Page
 *
 * Provides a messaging interface for students to communicate with their advisor.
 * Messages are displayed in a thread format with real-time updates.
 */

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { AlertCircle, ArrowLeft, Loader2, MessageSquare, Send, User } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { StudentUniversityGate } from '@/components/StudentUniversityGate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

export default function StudentMessagesPage() {
  return (
    <StudentUniversityGate>
      <StudentMessagesContent />
    </StudentUniversityGate>
  );
}

function StudentMessagesContent() {
  const { user } = useUser();
  const clerkId = user?.id;

  // Fetch advisor info
  const advisor = useQuery(api.student_advisor_hub.getMyAdvisor, clerkId ? { clerkId } : 'skip');

  // Fetch messages
  const messages = useQuery(api.student_advisor_hub.getMyMessages, clerkId ? { clerkId } : 'skip');

  // Mutations
  const sendMessage = useMutation(api.student_advisor_hub_mutations.sendMessage);
  const markAsRead = useMutation(api.student_advisor_hub_mutations.markMessagesAsRead);

  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isLoading = messages === undefined || advisor === undefined;
  const hasAdvisor = advisor !== null;

  // Mark messages as read when viewing
  useEffect(() => {
    if (clerkId && messages && messages.some((m) => !m.isRead)) {
      markAsRead({ clerkId }).catch(console.error);
    }
  }, [clerkId, messages, markAsRead]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!messageText.trim() || !clerkId || isSending) return;

    setIsSending(true);
    setSendError(null);
    try {
      await sendMessage({
        clerkId,
        body: messageText.trim(),
      });
      setMessageText('');
    } catch (error) {
      console.error('Failed to send message:', error);
      setSendError('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="w-full gradient-border-bottom p-5 shadow-sm">
          <div className="flex items-center justify-center h-96">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  if (!hasAdvisor) {
    return (
      <div className="w-full">
        <div className="w-full gradient-border-bottom p-5 space-y-6 shadow-sm">
          <div className="flex items-center gap-4">
            <Link href="/student/advisor">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
              <p className="text-muted-foreground">Chat with your advisor</p>
            </div>
          </div>

          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Advisor Assigned</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                You need to be assigned an advisor before you can send messages. Contact your
                university career center to get connected.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="w-full gradient-border-bottom shadow-sm flex flex-col h-[calc(100vh-64px)]">
        {/* Header */}
        <div className="p-5 border-b">
          <div className="flex items-center gap-4">
            <Link href="/student/advisor">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3 flex-1">
              <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                <User className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <h1 className="font-semibold">{advisor.advisorName}</h1>
                <p className="text-sm text-muted-foreground">
                  {advisor.advisorTitle || 'Career Advisor'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages?.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Start a Conversation</h3>
                <p className="text-muted-foreground max-w-sm">
                  Send a message to your advisor to get started. They'll respond as soon as they
                  can.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Reverse to show oldest first */}
              {[...(messages ?? [])].reverse().map((message) => (
                <MessageBubble
                  key={message._id}
                  message={message}
                  advisorName={advisor.advisorName}
                />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Message Input */}
        <div className="p-4 border-t bg-white">
          {sendError && (
            <div className="flex items-center gap-2 text-red-600 text-sm mb-3 p-2 bg-red-50 rounded-lg">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{sendError}</span>
              <button
                onClick={() => setSendError(null)}
                className="ml-auto text-red-400 hover:text-red-600"
              >
                &times;
              </button>
            </div>
          )}
          <div className="flex items-end gap-3">
            <Textarea
              placeholder="Type a message..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="resize-none min-h-[44px] max-h-[120px]"
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={!messageText.trim() || isSending}
              size="icon"
              className="h-11 w-11 flex-shrink-0"
            >
              {isSending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Message Bubble Component
// ============================================================================

interface Message {
  _id: string;
  body: string;
  sender_type: 'student' | 'advisor';
  created_at: number;
  isRead: boolean;
}

function MessageBubble({ message, advisorName }: { message: Message; advisorName: string }) {
  const isFromStudent = message.sender_type === 'student';
  const date = new Date(message.created_at);

  const formatTime = (d: Date) => {
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    // Get start of current week (Sunday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const isThisWeek = d >= startOfWeek && d <= now;

    if (isToday) {
      return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
    } else if (isThisWeek) {
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
      });
    } else {
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
  };

  return (
    <div className={`flex ${isFromStudent ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] ${
          isFromStudent
            ? 'bg-primary-600 text-white rounded-2xl rounded-tr-sm'
            : 'bg-slate-100 text-slate-900 rounded-2xl rounded-tl-sm'
        } px-4 py-3`}
      >
        {!isFromStudent && <p className="text-xs font-medium mb-1 text-slate-600">{advisorName}</p>}
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <p className={`text-xs mt-1 ${isFromStudent ? 'text-primary-200' : 'text-slate-500'}`}>
          {formatTime(date)}
        </p>
      </div>
    </div>
  );
}
