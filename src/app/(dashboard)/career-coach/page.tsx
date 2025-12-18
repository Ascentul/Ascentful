'use client';

import { useUser } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, Loader2, MessageSquare, Plus, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface Conversation {
  id: string | number;
  title: string;
  createdAt: string;
  userId: string;
}

interface Message {
  id: string | number;
  conversationId: string | number;
  isUser: boolean;
  message: string;
  timestamp: string;
}

export default function AICoachPage() {
  const { user: clerkUser, isLoaded } = useUser();
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [selectedConversationId, setSelectedConversationId] = useState<string | number | null>(
    null,
  );
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch conversations
  const { data: conversations = [] } = useQuery({
    queryKey: ['/api/ai-coach/conversations'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/ai-coach/conversations');
      return await response.json();
    },
    enabled: !!user?.clerkId,
  });

  // Fetch messages for selected conversation
  const { data: messages = [] } = useQuery({
    queryKey: ['/api/ai-coach/messages', selectedConversationId],
    queryFn: async () => {
      if (!selectedConversationId) return [];
      const response = await apiRequest(
        'GET',
        `/api/ai-coach/conversations/${selectedConversationId}/messages`,
      );
      return await response.json();
    },
    enabled: !!selectedConversationId && !!user?.clerkId,
  });

  // Auto-select the most recent conversation when list loads
  useEffect(() => {
    if (
      selectedConversationId === null &&
      Array.isArray(conversations) &&
      conversations.length > 0
    ) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Create new conversation
  const createConversationMutation = useMutation({
    mutationFn: async (title: string) => {
      const response = await apiRequest('POST', '/api/ai-coach/conversations', {
        title,
      });
      return await response.json();
    },
    onSuccess: (newConversation) => {
      queryClient.invalidateQueries({
        queryKey: ['/api/ai-coach/conversations'],
      });
      setSelectedConversationId(newConversation.id);
      toast({
        title: 'New conversation created',
        description: 'Start chatting with your AI career coach!',
        variant: 'success',
      });
    },
  });

  // Send message
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { conversationId: string | number; content: string }) => {
      const response = await apiRequest(
        'POST',
        `/api/ai-coach/conversations/${data.conversationId}/messages`,
        {
          content: data.content,
        },
      );
      const result = await response.json();
      return result;
    },
    onSuccess: (newMessages) => {
      if (Array.isArray(newMessages)) {
        queryClient.invalidateQueries({
          queryKey: ['/api/ai-coach/messages', selectedConversationId],
        });
        queryClient.invalidateQueries({
          queryKey: ['/api/ai-coach/conversations'],
        });
      } else {
        toast({
          title: 'Error',
          description: 'Unexpected response format from server',
          variant: 'destructive',
        });
      }
    },
  });

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedConversationId) return;

    setIsLoading(true);
    try {
      await sendMessageMutation.mutateAsync({
        conversationId: selectedConversationId,
        content: message.trim(),
      });
      setMessage('');
    } catch (error) {
      // Error handling centralized here - no onError callback to avoid duplicate toasts
      toast({
        title: 'Failed to send message',
        description: (error as any)?.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateConversation = () => {
    createConversationMutation.mutate('New Conversation');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isLoaded || !clerkUser || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect university admins to the University dashboard
  if (user.role === 'university_admin') {
    router.replace('/university');
    return null;
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="w-full rounded-3xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Career Coach</h1>
            <p className="text-muted-foreground">Get personalized career guidance powered by AI</p>
          </div>
          <Button
            onClick={handleCreateConversation}
            disabled={createConversationMutation.isPending}
            className="bg-primary-500 hover:bg-primary-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex gap-4 min-h-0 mt-4">
        {/* Conversations sidebar */}
        <div className="w-72 flex flex-col bg-neutral-50 rounded-xl border border-neutral-200">
          <div className="p-4 border-b border-neutral-200">
            <h2 className="font-medium text-sm text-neutral-600">Conversations</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {conversations.length === 0 ? (
              <div className="text-center py-12 px-4">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 text-neutral-300" />
                <p className="text-sm text-neutral-500">No conversations yet</p>
                <p className="text-xs text-neutral-400 mt-1">Start a new chat to begin</p>
              </div>
            ) : (
              <div className="space-y-1">
                {conversations.map((conversation: Conversation) => (
                  <button
                    key={conversation.id}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      selectedConversationId === conversation.id
                        ? 'bg-white shadow-sm border border-neutral-200'
                        : 'hover:bg-white/60'
                    }`}
                    onClick={() => setSelectedConversationId(conversation.id)}
                  >
                    <p className="text-sm font-medium text-neutral-800 truncate">
                      {conversation.title}
                    </p>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {new Date(conversation.createdAt).toLocaleDateString()}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-neutral-200 overflow-hidden">
          {selectedConversationId ? (
            <>
              {/* Messages area */}
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto py-8 px-6">
                  {messages.length === 0 ? (
                    <div className="text-center py-20">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 mb-6">
                        <Sparkles className="h-8 w-8 text-primary-600" />
                      </div>
                      <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                        How can I help you today?
                      </h3>
                      <p className="text-neutral-500 max-w-sm mx-auto">
                        Ask me about career advice, resume tips, interview prep, job search
                        strategies, or professional development.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {messages.map((msg: Message) => (
                        <div key={msg.id} className={msg.isUser ? 'flex justify-end' : ''}>
                          {msg.isUser ? (
                            // User message - right aligned, styled bubble
                            <div className="max-w-[85%]">
                              <div className="bg-primary-500 text-white rounded-2xl rounded-br-md px-4 py-3">
                                <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                                  {msg.message}
                                </p>
                              </div>
                              <p className="text-xs text-neutral-400 mt-1.5 text-right">
                                {new Date(msg.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          ) : (
                            // AI message - left aligned, clean style
                            <div className="max-w-[85%]">
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                                  <Sparkles className="h-4 w-4 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-primary-600 mb-1">
                                    Career Coach
                                  </p>
                                  <div className="text-[15px] leading-relaxed text-neutral-800 whitespace-pre-wrap">
                                    {msg.message}
                                  </div>
                                  <p className="text-xs text-neutral-400 mt-2">
                                    {new Date(msg.timestamp).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Loading indicator */}
                      {(sendMessageMutation.isPending || isLoading) && (
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                            <Sparkles className="h-4 w-4 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-medium text-primary-600 mb-1">
                              Career Coach
                            </p>
                            <div className="flex items-center gap-1 py-2">
                              <div className="w-2 h-2 bg-neutral-300 rounded-full animate-bounce" />
                              <div
                                className="w-2 h-2 bg-neutral-300 rounded-full animate-bounce"
                                style={{ animationDelay: '0.15s' }}
                              />
                              <div
                                className="w-2 h-2 bg-neutral-300 rounded-full animate-bounce"
                                style={{ animationDelay: '0.3s' }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input area - modern Claude-like style */}
              <div className="border-t border-neutral-100 p-4 bg-neutral-50/50">
                <div className="max-w-3xl mx-auto">
                  <div className="relative bg-white rounded-xl border border-neutral-200 shadow-sm focus-within:border-primary-300 focus-within:ring-2 focus-within:ring-primary-100 transition-all">
                    <textarea
                      placeholder="Message Career Coach..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="w-full resize-none border-0 bg-transparent px-4 py-3 pr-14 text-[15px] placeholder:text-neutral-400 focus:outline-none focus:ring-0 min-h-[52px] max-h-[200px]"
                      rows={1}
                      style={{ height: 'auto' }}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = Math.min(target.scrollHeight, 200) + 'px';
                      }}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!message.trim() || isLoading}
                      aria-label={isLoading ? 'Sending message' : 'Send message'}
                      className="absolute right-2 bottom-2 w-8 h-8 rounded-lg bg-primary-500 hover:bg-primary-600 disabled:bg-neutral-200 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 text-neutral-400 animate-spin" />
                      ) : (
                        <ArrowUp
                          className={`h-4 w-4 ${!message.trim() ? 'text-neutral-400' : 'text-white'}`}
                        />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-neutral-400 mt-2 text-center">
                    AI responses may not always be accurate. Use your judgment.
                  </p>
                </div>
              </div>
            </>
          ) : (
            // Empty state - no conversation selected
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="text-center max-w-md">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 mb-6">
                  <Sparkles className="h-10 w-10 text-primary-600" />
                </div>
                <h3 className="text-2xl font-semibold text-neutral-900 mb-3">
                  Welcome to Career Coach
                </h3>
                <p className="text-neutral-500 mb-8">
                  Select an existing conversation or start a new one to get personalized career
                  guidance.
                </p>
                <Button
                  onClick={handleCreateConversation}
                  size="lg"
                  className="bg-primary-500 hover:bg-primary-600"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Start New Chat
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
