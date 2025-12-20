// @ts-nocheck
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMutation, useQuery } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AICoachPage from '@/app/(dashboard)/career-coach/page';
import { AICareerCoach } from '@/components/AICareerCoach';

// Mock the hooks
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQuery: jest.fn(),
  useMutation: jest.fn(),
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
  }),
}));

jest.mock('@/contexts/ClerkAuthProvider', () => ({
  useAuth: () => ({
    user: {
      clerkId: 'test-user-id',
      role: 'user',
    },
  }),
}));

jest.mock('@/hooks/use-toast', () => {
  const useToast = jest.fn().mockReturnValue({ toast: jest.fn() });
  return { __esModule: true, useToast };
});

const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>;
const mockUseMutation = useMutation as jest.MockedFunction<typeof useMutation>;

// Create a wrapper component for React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  TestWrapper.displayName = 'TestWrapper';
  return TestWrapper;
};

describe('AI Coach Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    mockUseMutation.mockReturnValue({
      mutate: jest.fn(),
      mutateAsync: jest.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      error: null,
    } as any);
  });

  describe('AICareerCoach Component', () => {
    it('renders the AI career coach widget', () => {
      render(<AICareerCoach />, { wrapper: createWrapper() });

      expect(screen.getByText('AI Career Coach')).toBeInTheDocument();
      expect(screen.getByText('Get personalized career advice')).toBeInTheDocument();
      expect(screen.getByPlaceholderText("What's your career question?")).toBeInTheDocument();
    });

    it('displays empty state when no conversations exist', () => {
      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      } as any);

      render(<AICareerCoach />, { wrapper: createWrapper() });

      expect(screen.getByText('No conversations yet')).toBeInTheDocument();
      expect(screen.getByText('Start chatting with your AI career coach')).toBeInTheDocument();
    });

    it('displays recent conversation when conversations exist', () => {
      const mockConversations = [
        {
          id: '1',
          title: 'How to prepare for interviews?',
          createdAt: '2024-01-01T00:00:00Z',
          messageCount: 5,
        },
      ];

      mockUseQuery.mockReturnValue({
        data: mockConversations,
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      } as any);

      render(<AICareerCoach />, { wrapper: createWrapper() });

      expect(screen.getByText('How to prepare for interviews?')).toBeInTheDocument();
      expect(screen.getByText('5 messages')).toBeInTheDocument();
    });

    it('handles quick question submission', async () => {
      const user = userEvent.setup();
      const mockMutateAsync = jest.fn().mockResolvedValue({
        id: 'new-conversation-id',
        title: 'Test question',
      });

      mockUseMutation.mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
        isError: false,
        isSuccess: false,
        error: null,
      } as any);

      render(<AICareerCoach />, { wrapper: createWrapper() });

      const textarea = screen.getByPlaceholderText("What's your career question?");
      const sendButton = screen.getByRole('button', { name: /send/i });

      await user.type(textarea, 'How do I negotiate salary?');
      await user.click(sendButton);

      expect(mockMutateAsync).toHaveBeenCalledWith('How do I negotiate salary?');
    });

    it('displays loading state during submission', async () => {
      const user = userEvent.setup();

      mockUseMutation.mockReturnValue({
        mutateAsync: jest.fn().mockImplementation(() => new Promise(() => {})),
        isPending: true,
        isError: false,
        isSuccess: false,
        error: null,
      } as any);

      render(<AICareerCoach />, { wrapper: createWrapper() });

      const textarea = screen.getByPlaceholderText("What's your career question?");
      const sendButton = screen.getByRole('button', { name: /send/i });

      await user.type(textarea, 'Test question');
      await user.click(sendButton);

      expect(sendButton).toBeDisabled();
    });
  });

  describe('AI Coach Page', () => {
    it('renders the main AI coach page', () => {
      // Mock a conversation so the page renders fully (not the auto-creating state)
      mockUseQuery.mockImplementation((options: any) => {
        if (options.queryKey[0] === '/api/ai-coach/conversations') {
          return {
            data: [{ id: 'conv-1', title: 'Test', createdAt: '2024-01-01T00:00:00Z' }],
            isLoading: false,
            error: null,
            refetch: jest.fn(),
          };
        }
        return { data: [], isLoading: false, error: null, refetch: jest.fn() };
      });

      render(<AICoachPage />, { wrapper: createWrapper() });

      expect(screen.getByText('Career Coach')).toBeInTheDocument();
      expect(
        screen.getByText('Get personalized career guidance powered by AI'),
      ).toBeInTheDocument();
    });

    it('shows conversations in sidebar when toggled', async () => {
      const user = userEvent.setup();
      const mockConversations = [
        {
          id: '1',
          title: 'Career change advice',
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          id: '2',
          title: 'Resume feedback',
          createdAt: '2024-01-02T00:00:00Z',
        },
      ];

      // Mock conversations query
      mockUseQuery.mockImplementation((options: any) => {
        if (options.queryKey[0] === '/api/ai-coach/conversations') {
          return {
            data: mockConversations,
            isLoading: false,
            error: null,
            refetch: jest.fn(),
          };
        }
        return {
          data: [],
          isLoading: false,
          error: null,
          refetch: jest.fn(),
        };
      });

      render(<AICoachPage />, { wrapper: createWrapper() });

      // Sidebar is hidden by default, click "Show History" to reveal it
      const showHistoryButton = screen.getByText('Show History');
      await user.click(showHistoryButton);

      expect(screen.getByText('Career change advice')).toBeInTheDocument();
      expect(screen.getByText('Resume feedback')).toBeInTheDocument();
    });

    it('handles new conversation creation', async () => {
      const user = userEvent.setup();
      const mockMutate = jest.fn();

      // Mock a conversation so the page renders fully
      mockUseQuery.mockImplementation((options: any) => {
        if (options.queryKey[0] === '/api/ai-coach/conversations') {
          return {
            data: [{ id: 'conv-1', title: 'Test', createdAt: '2024-01-01T00:00:00Z' }],
            isLoading: false,
            error: null,
            refetch: jest.fn(),
          };
        }
        return { data: [], isLoading: false, error: null, refetch: jest.fn() };
      });

      mockUseMutation.mockReturnValue({
        mutate: mockMutate,
        isPending: false,
        isError: false,
        isSuccess: false,
        error: null,
      } as any);

      render(<AICoachPage />, { wrapper: createWrapper() });

      const newConversationButton = screen.getByText('New Chat');
      await user.click(newConversationButton);

      expect(mockMutate).toHaveBeenCalledWith('New Conversation');
    });
  });

  describe('Message Handling', () => {
    it('displays messages in conversation', () => {
      const mockMessages = [
        {
          id: '1',
          conversationId: 'conv-1',
          isUser: true,
          message: 'How do I improve my resume?',
          timestamp: '2024-01-01T00:00:00Z',
        },
        {
          id: '2',
          conversationId: 'conv-1',
          isUser: false,
          message: 'Here are some tips to improve your resume...',
          timestamp: '2024-01-01T00:01:00Z',
        },
      ];

      // Mock both conversations and messages
      mockUseQuery.mockImplementation((options: any) => {
        if (options.queryKey[0] === '/api/ai-coach/conversations') {
          return {
            data: [{ id: 'conv-1', title: 'Resume help', createdAt: '2024-01-01T00:00:00Z' }],
            isLoading: false,
            error: null,
            refetch: jest.fn(),
          };
        }
        if (options.queryKey[0] === '/api/ai-coach/messages') {
          return {
            data: mockMessages,
            isLoading: false,
            error: null,
            refetch: jest.fn(),
          };
        }
        return { data: [], isLoading: false, error: null, refetch: jest.fn() };
      });

      render(<AICoachPage />, { wrapper: createWrapper() });

      // The conversation should be selected automatically
      expect(screen.getByText('How do I improve my resume?')).toBeInTheDocument();
      expect(screen.getByText('Here are some tips to improve your resume...')).toBeInTheDocument();
    });

    it('handles message sending', async () => {
      const user = userEvent.setup();
      const mockMutateAsync = jest.fn().mockResolvedValue([
        { id: '3', isUser: true, message: 'New message', timestamp: '2024-01-01T00:02:00Z' },
        { id: '4', isUser: false, message: 'AI response', timestamp: '2024-01-01T00:03:00Z' },
      ]);

      // Mock conversation selection
      mockUseQuery.mockImplementation((options: any) => {
        if (options.queryKey[0] === '/api/ai-coach/conversations') {
          return {
            data: [{ id: 'conv-1', title: 'Test', createdAt: '2024-01-01T00:00:00Z' }],
            isLoading: false,
            error: null,
            refetch: jest.fn(),
          };
        }
        return { data: [], isLoading: false, error: null, refetch: jest.fn() };
      });

      mockUseMutation.mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
        isError: false,
        isSuccess: false,
        error: null,
      } as any);

      render(<AICoachPage />, { wrapper: createWrapper() });

      const textarea = screen.getByPlaceholderText('Message Career Coach...');
      const sendButton = screen.getByRole('button', { name: /send/i });

      await user.type(textarea, 'What skills should I develop?');
      await user.click(sendButton);

      expect(mockMutateAsync).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        content: 'What skills should I develop?',
      });
    });
  });

  describe('Error Handling', () => {
    it('handles conversation loading errors gracefully', () => {
      // Mock with empty array to avoid auto-creation loading state
      mockUseQuery.mockImplementation((options: any) => {
        if (options.queryKey[0] === '/api/ai-coach/conversations') {
          return {
            data: [{ id: 'conv-1', title: 'Test', createdAt: '2024-01-01T00:00:00Z' }],
            isLoading: false,
            error: new Error('Failed to load conversations'),
            refetch: jest.fn(),
          };
        }
        return { data: [], isLoading: false, error: null, refetch: jest.fn() };
      });

      render(<AICoachPage />, { wrapper: createWrapper() });

      // Should still render the page structure
      expect(screen.getByText('Career Coach')).toBeInTheDocument();
    });

    it('handles message sending errors', async () => {
      const user = userEvent.setup();
      const mockToast = jest.fn();

      jest.mocked(require('@/hooks/use-toast').useToast).mockReturnValue({
        toast: mockToast,
      });

      mockUseMutation.mockReturnValue({
        mutateAsync: jest.fn().mockRejectedValue(new Error('Network error')),
        isPending: false,
        isError: true,
        isSuccess: false,
        error: new Error('Network error'),
      } as any);

      mockUseQuery.mockImplementation((options: any) => {
        if (options.queryKey[0] === '/api/ai-coach/conversations') {
          return {
            data: [{ id: 'conv-1', title: 'Test', createdAt: '2024-01-01T00:00:00Z' }],
            isLoading: false,
            error: null,
            refetch: jest.fn(),
          };
        }
        return { data: [], isLoading: false, error: null, refetch: jest.fn() };
      });

      render(<AICoachPage />, { wrapper: createWrapper() });

      const textarea = screen.getByPlaceholderText('Message Career Coach...');
      const sendButton = screen.getByRole('button', { name: /send/i });

      await user.type(textarea, 'Test message');
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Failed to send message',
            variant: 'destructive',
          }),
        );
      });
    });
  });
});
