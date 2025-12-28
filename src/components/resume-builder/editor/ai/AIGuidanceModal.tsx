'use client';

import { CheckCircle, Loader2, Send, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ResumeData } from '@/components/resume/ResumeDocument';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  isUser: boolean;
  message: string;
  timestamp: Date;
  resumeContent?: {
    field: string;
    value: string;
    action: 'set' | 'append';
  } | null;
}

interface AIGuidanceModalProps {
  open: boolean;
  onClose: () => void;
  section: string;
  sectionLabel: string;
  currentResumeData: Partial<ResumeData>;
  onApplyContent: (field: string, value: string, action: 'set' | 'append') => void;
}

const SECTION_ICONS: Record<string, string> = {
  contact: '👤',
  summary: '📝',
  experience: '💼',
  education: '🎓',
  skills: '🛠️',
};

export function AIGuidanceModal({
  open,
  onClose,
  section,
  sectionLabel,
  currentResumeData,
  onApplyContent,
}: AIGuidanceModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset when section changes
  useEffect(() => {
    // Cancel any pending request
    abortControllerRef.current?.abort();
    setMessages([]);
    setSuggestions([]);
    setInitialized(false);
  }, [section]);

  // Cancel any pending request on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const initializeConversation = useCallback(async () => {
    abortControllerRef.current = new AbortController();
    setIsLoading(true);
    try {
      const response = await fetch('/api/ai/resume-guidance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section,
          isInitial: true,
          currentResumeData,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) throw new Error('Failed to initialize');

      const data = await response.json();

      setMessages([
        {
          id: 'initial',
          isUser: false,
          message: data.response,
          timestamp: new Date(),
        },
      ]);
      setSuggestions(data.suggestions || []);
      setInitialized(true);
    } catch (error) {
      // Ignore abort errors - they're expected when section changes
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('Failed to initialize conversation:', error);
      setMessages([
        {
          id: 'error',
          isUser: false,
          message: "I'm having trouble connecting. Please try again.",
          timestamp: new Date(),
        },
      ]);
      // Prevent infinite re-init loop on persistent failures
      setInitialized(true);
    } finally {
      setIsLoading(false);
    }
  }, [section, currentResumeData]);

  // Initialize conversation when modal opens
  useEffect(() => {
    if (open && !initialized) {
      initializeConversation();
    }
  }, [open, initialized, initializeConversation]);

  const sendMessage = useCallback(
    async (messageText: string) => {
      if (!messageText.trim() || isLoading) return;

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        isUser: true,
        message: messageText,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputValue('');
      setSuggestions([]);
      setIsLoading(true);

      try {
        // Abort any existing request before starting a new one
        abortControllerRef.current?.abort();
        abortControllerRef.current = new AbortController();
        const conversationHistory = [...messages, userMessage].map((m) => ({
          isUser: m.isUser,
          message: m.message,
        }));

        const response = await fetch('/api/ai/resume-guidance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            section,
            message: messageText,
            conversationHistory,
            currentResumeData,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) throw new Error('Failed to send message');

        const data = await response.json();

        const aiMessage: Message = {
          id: `ai-${Date.now()}`,
          isUser: false,
          message: data.response,
          timestamp: new Date(),
          resumeContent: data.resumeContent,
        };

        setMessages((prev) => [...prev, aiMessage]);
        setSuggestions(data.suggestions || []);
      } catch (error) {
        // Ignore abort errors - they're expected when section changes
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error('Failed to send message:', error);
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            isUser: false,
            message: "I'm having trouble responding. Please try again.",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
        inputRef.current?.focus();
      }
    },
    [messages, isLoading, section, currentResumeData],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion);
  };

  const handleApplyContent = (content: Message['resumeContent']) => {
    if (content) {
      onApplyContent(content.field, content.value, content.action);
      // Add confirmation message
      setMessages((prev) => [
        ...prev,
        {
          id: `applied-${Date.now()}`,
          isUser: false,
          message:
            "✅ Content applied to your resume! Is there anything else you'd like to add or modify?",
          timestamp: new Date(),
        },
      ]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b border-slate-200 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <span>{SECTION_ICONS[section] || '📄'}</span>
            <span>AI Help: {sectionLabel}</span>
            <span className="ml-auto">
              <Sparkles className="h-4 w-4 text-primary-500" />
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={cn('flex', msg.isUser ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-2.5',
                  msg.isUser
                    ? 'bg-primary-500 text-white rounded-br-md'
                    : 'bg-slate-100 text-slate-900 rounded-bl-md',
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.message}</p>

                {/* Apply content button */}
                {msg.resumeContent && (
                  <button
                    type="button"
                    onClick={() => handleApplyContent(msg.resumeContent)}
                    className={cn(
                      'mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium',
                      'bg-green-500 text-white hover:bg-green-600 transition-colors',
                    )}
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Apply to Resume
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && !isLoading && (
          <div className="px-4 pb-2 flex-shrink-0">
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleSuggestionClick(suggestion)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium',
                    'bg-slate-100 text-slate-700 hover:bg-slate-200',
                    'border border-slate-200 transition-colors',
                  )}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading}
              className={cn(
                'flex-1 px-4 py-2.5 rounded-full text-sm',
                'bg-slate-100 border-0 focus:ring-2 focus:ring-primary-300',
                'placeholder:text-slate-400',
              )}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!inputValue.trim() || isLoading}
              className="rounded-full h-10 w-10"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
