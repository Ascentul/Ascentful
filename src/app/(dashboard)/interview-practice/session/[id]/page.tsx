'use client';

import { useUser } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Keyboard,
  Loader2,
  Mic,
  MicOff,
  SkipForward,
  Square,
  Video,
  Volume2,
  X,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

// Ideal answer time range in seconds
const IDEAL_TIME_MIN = 60; // 1 minute
const IDEAL_TIME_MAX = 120; // 2 minutes
const MAX_TIME_WARNING = 180; // 3 minutes - warn user
const MIN_AUDIO_SIZE_BYTES = 1000; // Minimum 1KB to ensure valid audio

interface Turn {
  _id: string;
  turn_index: number;
  question_text: string;
  question_type: string;
  tts_audio_url?: string;
  transcript_text?: string;
  answered_at?: number;
}

type SessionState =
  | 'loading'
  | 'ready'
  | 'generating_tts'
  | 'playing_question'
  | 'recording'
  | 'processing'
  | 'complete';

type ProcessingStep = 'uploading' | 'transcribing' | 'saving' | 'loading_next';

export default function InterviewSessionPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const { user: clerkUser, isLoaded } = useUser();
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [sessionState, setSessionState] = useState<SessionState>('loading');
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('uploading');
  const [currentTurn, setCurrentTurn] = useState<Turn | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [ttsProgress, setTtsProgress] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [showKeyboardHints, setShowKeyboardHints] = useState(false);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastAutoPlayedTurnRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Session autosave key
  const sessionStorageKey = `interview-session-${sessionId}`;

  // Save session state to localStorage for crash recovery
  useEffect(() => {
    if (currentTurn && sessionState !== 'loading' && sessionState !== 'complete') {
      const savedState = {
        turnId: currentTurn._id,
        turnIndex: currentTurn.turn_index,
        recordingDuration,
        timestamp: Date.now(),
      };
      try {
        localStorage.setItem(sessionStorageKey, JSON.stringify(savedState));
      } catch (e) {
        console.warn('[InterviewSession] Failed to save session state:', e);
      }
    }
  }, [currentTurn, recordingDuration, sessionState, sessionStorageKey]);

  // Clear saved state when session completes
  useEffect(() => {
    if (sessionState === 'complete') {
      try {
        localStorage.removeItem(sessionStorageKey);
      } catch (e) {
        console.warn('[InterviewSession] Failed to clear session state:', e);
      }
    }
  }, [sessionState, sessionStorageKey]);

  // Fetch session data
  const {
    data: session,
    isLoading: isLoadingSession,
    refetch: refetchSession,
  } = useQuery({
    queryKey: ['/api/interview-practice/session', sessionId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/interview-practice/session?id=${sessionId}`);
      const data = await response.json();
      return data.session;
    },
    enabled: !!user?.clerkId && !!sessionId,
    refetchInterval: false,
  });

  // Start session mutation
  const startSessionMutation = useMutation({
    mutationFn: async () => {
      console.log('[InterviewSession] Starting session...');
      const response = await apiRequest(
        'POST',
        `/api/interview-practice/session/${sessionId}/start`,
      );
      const data = await response.json();
      console.log('[InterviewSession] Start session response:', data);
      return data;
    },
    onSuccess: (data) => {
      console.log('[InterviewSession] Start session success, turn:', data.turn);
      setCurrentTurn(data.turn);
      setSessionState('ready');
      refetchSession();
    },
    onError: (error) => {
      console.error('[InterviewSession] Start session error:', error);
      setSessionState('ready'); // Clear loading state on error
      toast({
        title: 'Error',
        description: (error as Error).message || 'Failed to start session',
        variant: 'destructive',
      });
    },
  });

  // Submit turn mutation
  const submitTurnMutation = useMutation({
    mutationFn: async (audioData: Blob) => {
      console.log('[InterviewSession] Submitting turn, turnId:', currentTurn?._id);
      const formData = new FormData();
      formData.append('audio', audioData, 'response.webm');
      formData.append('turnId', currentTurn!._id);
      formData.append('responseDurationMs', (recordingDuration * 1000).toString());

      const response = await fetch(`/api/interview-practice/session/${sessionId}/turn`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[InterviewSession] Turn submission error:', error);
        throw new Error(error.error || 'Failed to submit response');
      }

      const data = await response.json();
      console.log('[InterviewSession] Turn submitted successfully:', data);
      return data;
    },
    onSuccess: () => {
      setAudioBlob(null);
      setRecordingDuration(0);
      refetchSession();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: (error as Error).message || 'Failed to submit response',
        variant: 'destructive',
      });
      setSessionState('ready');
    },
  });

  // Get next question mutation
  const nextQuestionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        'POST',
        `/api/interview-practice/session/${sessionId}/next`,
      );
      return response.json();
    },
    onSuccess: (data) => {
      if (data.isComplete) {
        setSessionState('complete');
        refetchSession();
      } else {
        setCurrentTurn(data.turn);
        setSessionState('ready');
        refetchSession();
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: (error as Error).message || 'Failed to get next question',
        variant: 'destructive',
      });
    },
  });

  // Complete session mutation
  const completeSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        'POST',
        `/api/interview-practice/session/${sessionId}/complete`,
      );
      return response.json();
    },
    onSuccess: () => {
      router.push(`/interview-practice/session/${sessionId}/report`);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: (error as Error).message || 'Failed to complete session',
        variant: 'destructive',
      });
    },
  });

  // Initialize session on mount
  useEffect(() => {
    console.log('[InterviewSession] useEffect triggered', {
      session: session ? { status: session.status, _id: session._id } : null,
      sessionState,
      isPending: startSessionMutation.isPending,
    });

    if (
      session &&
      sessionState === 'loading' &&
      !startSessionMutation.isPending &&
      !nextQuestionMutation.isPending
    ) {
      if (session.status === 'setup') {
        console.log('[InterviewSession] Calling startSessionMutation.mutate()');
        startSessionMutation.mutate();
      } else if (session.status === 'completed') {
        router.replace(`/interview-practice/session/${sessionId}/report`);
      } else if (session.status === 'in_progress') {
        // Resume session - need to fetch current turn
        console.log('[InterviewSession] Calling nextQuestionMutation.mutate()');
        nextQuestionMutation.mutate();
      }
    }
  }, [session, sessionState, startSessionMutation.isPending, nextQuestionMutation.isPending]);

  // Setup camera stream
  useEffect(() => {
    if (session?.camera_enabled && videoRef.current && !streamRef.current) {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          console.error('Camera error:', err);
        });
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [session?.camera_enabled]);

  // Play TTS audio
  const playQuestionAudio = useCallback(async () => {
    if (!currentTurn) return;

    console.log('[InterviewSession] Playing question audio...');

    try {
      // Generate TTS if not already available
      let audioUrl = currentTurn.tts_audio_url;
      if (!audioUrl) {
        // Show TTS generation state
        setSessionState('generating_tts');
        setTtsProgress(0);

        // Simulate progress while generating
        const progressInterval = setInterval(() => {
          setTtsProgress((prev) => Math.min(prev + 15, 85));
        }, 200);

        console.log(
          '[InterviewSession] Generating TTS for:',
          currentTurn.question_text.substring(0, 50),
        );
        const response = await apiRequest('POST', '/api/interview-practice/tts', {
          text: currentTurn.question_text,
        });
        const data = await response.json();

        clearInterval(progressInterval);
        setTtsProgress(100);

        console.log(
          '[InterviewSession] TTS response received, audioUrl length:',
          data.audioUrl?.length,
        );
        audioUrl = data.audioUrl;
      }

      if (audioUrl) {
        setSessionState('playing_question');
        setIsPlayingAudio(true);

        console.log('[InterviewSession] Creating audio element...');
        const audio = new Audio(audioUrl);
        audioElementRef.current = audio;
        audio.onended = () => {
          console.log('[InterviewSession] Audio playback ended');
          setIsPlayingAudio(false);
          setSessionState('ready');
        };
        audio.onerror = (e) => {
          console.error('[InterviewSession] Audio error:', e);
          setIsPlayingAudio(false);
          setSessionState('ready');
          toast({
            title: 'Audio Error',
            description: 'Could not play question audio. You can still see the question above.',
            variant: 'destructive',
          });
        };
        await audio.play();
        console.log('[InterviewSession] Audio playing...');
      } else {
        console.warn('[InterviewSession] No audio URL available');
        setIsPlayingAudio(false);
        setSessionState('ready');
      }
    } catch (error) {
      console.error('[InterviewSession] TTS error:', error);
      setIsPlayingAudio(false);
      setSessionState('ready');
      toast({
        title: 'TTS Error',
        description: 'Could not generate question audio.',
        variant: 'destructive',
      });
    }
  }, [currentTurn, toast]);

  // Auto-play TTS when a new turn is loaded
  useEffect(() => {
    // Only auto-play if:
    // 1. We have a current turn
    // 2. Session is in ready state (not recording, processing, etc.)
    // 3. We haven't already auto-played this turn
    // 4. Not currently playing audio
    if (
      currentTurn &&
      sessionState === 'ready' &&
      lastAutoPlayedTurnRef.current !== currentTurn._id &&
      !isPlayingAudio
    ) {
      console.log('[InterviewSession] Auto-playing TTS for turn:', currentTurn._id);
      lastAutoPlayedTurnRef.current = currentTurn._id;
      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        playQuestionAudio();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentTurn, sessionState, isPlayingAudio, playQuestionAudio]);

  // Start recording with audio level visualization
  const startRecording = useCallback(async () => {
    console.log('[InterviewSession] Starting recording...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      console.log('[InterviewSession] Using mimeType:', mimeType);
      const mediaRecorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128000 });
      audioChunksRef.current = [];

      // Set up audio level analysis
      try {
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;

        // Start audio level monitoring
        const updateAudioLevel = () => {
          if (analyserRef.current) {
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            setAudioLevel(average / 255); // Normalize to 0-1
          }
          animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
        };
        updateAudioLevel();
      } catch (audioContextError) {
        console.warn('[InterviewSession] AudioContext not available:', audioContextError);
      }

      mediaRecorder.ondataavailable = (e) => {
        console.log('[InterviewSession] Data available:', e.data.size, 'bytes');
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('[InterviewSession] Recording stopped, chunks:', audioChunksRef.current.length);
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        console.log('[InterviewSession] Created blob:', blob.size, 'bytes');
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());

        // Clean up audio context
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        setAudioLevel(0);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      console.log('[InterviewSession] MediaRecorder started');
      setIsRecording(true);
      setRecordingDuration(0);
      setSessionState('recording');

      // Start recording timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      // Pre-fetch next question in background (only if not the last question)
      const isLastQuestion =
        (session?.current_question_index || 0) >= (session?.question_count_target || 0) - 1;
      if (!isLastQuestion) {
        console.log('[InterviewSession] Pre-fetching next question...');
        queryClient.prefetchQuery({
          queryKey: ['/api/interview-practice/session', sessionId, 'next'],
          queryFn: async () => {
            // This will warm up the cache for faster response later
            return null;
          },
          staleTime: 30000, // Keep fresh for 30 seconds
        });
      }
    } catch (error) {
      console.error('[InterviewSession] Start recording error:', error);
      toast({
        title: 'Microphone Error',
        description: 'Could not access microphone. Please check permissions.',
        variant: 'destructive',
      });
    }
  }, [toast, session, queryClient, sessionId]);

  // Stop recording
  const stopRecording = useCallback(() => {
    console.log('[InterviewSession] stopRecording called');
    console.log('[InterviewSession] mediaRecorderRef.current:', mediaRecorderRef.current);
    console.log('[InterviewSession] MediaRecorder state:', mediaRecorderRef.current?.state);

    if (!mediaRecorderRef.current) {
      console.error('[InterviewSession] mediaRecorderRef.current is null!');
      // Still update state to fix UI
      setIsRecording(false);
      setSessionState('ready');
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      return;
    }

    if (mediaRecorderRef.current.state === 'inactive') {
      console.warn('[InterviewSession] MediaRecorder already inactive');
      setIsRecording(false);
      setSessionState('ready');
      return;
    }

    try {
      console.log('[InterviewSession] Calling mediaRecorder.stop()...');
      mediaRecorderRef.current.stop();
      console.log('[InterviewSession] mediaRecorder.stop() called successfully');
    } catch (error) {
      console.error('[InterviewSession] Error stopping MediaRecorder:', error);
    }

    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setSessionState('ready');
    console.log('[InterviewSession] Recording stopped, sessionState set to ready');
  }, []);

  // Submit response with validation
  const submitResponse = useCallback(async () => {
    if (!audioBlob) return;

    // Validate minimum audio size
    if (audioBlob.size < MIN_AUDIO_SIZE_BYTES) {
      toast({
        title: 'Recording too short',
        description: 'Your recording seems too short. Please try again with a longer response.',
        variant: 'destructive',
      });
      return;
    }

    setSessionState('processing');
    setProcessingStep('uploading');

    // Simulate upload progress
    await new Promise((resolve) => setTimeout(resolve, 300));
    setProcessingStep('transcribing');

    await submitTurnMutation.mutateAsync(audioBlob);

    setProcessingStep('saving');
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Let nextQuestionMutation handle completion detection via data.isComplete
    setProcessingStep('loading_next');
    nextQuestionMutation.mutate();
  }, [audioBlob, session, submitTurnMutation, nextQuestionMutation, toast]);

  // Skip question (move to next without recording)
  const skipQuestion = useCallback(async () => {
    setShowSkipConfirm(false);
    setSessionState('processing');
    setProcessingStep('loading_next');

    // Let nextQuestionMutation handle completion detection via data.isComplete
    nextQuestionMutation.mutate();
  }, [nextQuestionMutation]);

  // Get time indicator color based on recording duration
  const getTimeIndicatorColor = useCallback((seconds: number) => {
    if (seconds < IDEAL_TIME_MIN) return 'text-amber-500'; // Too short
    if (seconds <= IDEAL_TIME_MAX) return 'text-green-600'; // Ideal
    if (seconds <= MAX_TIME_WARNING) return 'text-amber-500'; // Getting long
    return 'text-red-500'; // Too long
  }, []);

  // Get time guidance text
  const getTimeGuidance = useCallback((seconds: number) => {
    if (seconds < IDEAL_TIME_MIN) {
      const remaining = IDEAL_TIME_MIN - seconds;
      return `${remaining}s until ideal time`;
    }
    if (seconds <= IDEAL_TIME_MAX) {
      return 'Good length!';
    }
    if (seconds <= MAX_TIME_WARNING) {
      return 'Consider wrapping up';
    }
    return 'Try to finish soon';
  }, []);

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // End session early
  const endSessionEarly = () => {
    setShowEndConfirm(false);
    completeSessionMutation.mutate();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when in modal dialogs
      if (showEndConfirm || showSkipConfirm) return;

      // Don't trigger when typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (sessionState === 'ready' && !audioBlob && !isPlayingAudio) {
            startRecording();
          } else if (isRecording) {
            stopRecording();
          }
          break;
        case 'KeyR':
          if (audioBlob && !isRecording && sessionState !== 'processing') {
            e.preventDefault();
            setAudioBlob(null);
            setRecordingDuration(0);
          }
          break;
        case 'Enter':
          if (audioBlob && !isRecording && sessionState !== 'processing') {
            e.preventDefault();
            submitResponse();
          }
          break;
        case 'KeyS':
          if (sessionState === 'ready' && !isRecording && !audioBlob && !isPlayingAudio) {
            e.preventDefault();
            setShowSkipConfirm(true);
          }
          break;
        case 'Escape':
          if (isPlayingAudio && audioElementRef.current) {
            audioElementRef.current.pause();
            setIsPlayingAudio(false);
            setSessionState('ready');
          }
          break;
        case 'Slash':
          if (e.shiftKey) {
            e.preventDefault();
            setShowKeyboardHints((prev) => !prev);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    sessionState,
    isRecording,
    audioBlob,
    isPlayingAudio,
    showEndConfirm,
    showSkipConfirm,
    startRecording,
    stopRecording,
    submitResponse,
  ]);

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

  if (isLoadingSession || sessionState === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-100">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Preparing your interview...</p>
        </div>
      </div>
    );
  }

  if (sessionState === 'complete') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-100">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-8 pb-6 text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Interview Complete!</h2>
            <p className="text-muted-foreground mb-6">
              Great job! Your responses have been recorded. We&apos;re now generating your coaching
              report.
            </p>
            <Button
              onClick={() => completeSessionMutation.mutate()}
              disabled={completeSessionMutation.isPending}
              size="lg"
              className="w-full"
            >
              {completeSessionMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Report...
                </>
              ) : (
                <>
                  View Coaching Report
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progress =
    ((session?.current_question_index || 0) / (session?.question_count_target || 1)) * 100;

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-neutral-200 bg-white">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Mic className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-neutral-900 font-semibold">
              {session?.roleProfile?.job_title || 'Interview Practice'}
            </h1>
            {session?.roleProfile?.company_name && (
              <p className="text-muted-foreground text-sm">{session.roleProfile.company_name}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-muted-foreground text-sm">
              Question {(session?.current_question_index || 0) + 1} of{' '}
              {session?.question_count_target}
            </p>
            <Progress value={progress} className="w-32 h-1.5 mt-1" />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-neutral-900 hover:bg-neutral-100"
            onClick={() => setShowEndConfirm(true)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Video Preview (if enabled) */}
        {session?.camera_enabled && (
          <div className="absolute top-24 right-6 w-48 h-36 rounded-lg overflow-hidden bg-neutral-900 border border-neutral-200 shadow-lg">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Question Display */}
        <div className="max-w-2xl w-full text-center mb-12">
          <p className="text-muted-foreground text-sm uppercase tracking-wide mb-4">
            {currentTurn?.question_type?.replace('_', ' ')} Question
          </p>
          <h2 className="text-2xl md:text-3xl font-medium text-neutral-900 leading-relaxed">
            {currentTurn?.question_text || 'Loading question...'}
          </h2>
        </div>

        {/* Audio/Recording Controls */}
        <div className="flex flex-col items-center gap-6">
          {/* TTS Generation Progress */}
          {sessionState === 'generating_tts' && (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div className="w-48">
                <div className="flex justify-between text-xs mb-1">
                  <span>Generating audio...</span>
                  <span>{ttsProgress}%</span>
                </div>
                <Progress value={ttsProgress} className="h-2" />
              </div>
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {/* Play Question Button */}
          {sessionState === 'ready' && !isRecording && !audioBlob && (
            <Button variant="outline" size="lg" onClick={playQuestionAudio}>
              <Volume2 className="h-5 w-5 mr-2" />
              Play Question Audio
            </Button>
          )}

          {/* Playing Audio Indicator */}
          {isPlayingAudio && (
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="flex gap-1">
                <span className="w-1 h-4 bg-primary rounded animate-pulse" />
                <span className="w-1 h-6 bg-primary rounded animate-pulse delay-75" />
                <span className="w-1 h-3 bg-primary rounded animate-pulse delay-150" />
                <span className="w-1 h-5 bg-primary rounded animate-pulse delay-200" />
              </div>
              <span>Playing question...</span>
            </div>
          )}

          {/* Recording Button */}
          <div className="relative">
            {isRecording && (
              <div className="absolute inset-0 -m-4 rounded-full bg-red-500/20 animate-ping pointer-events-none" />
            )}
            <button
              onClick={() => {
                console.log('[InterviewSession] Record button clicked, isRecording:', isRecording);
                if (isRecording) {
                  stopRecording();
                } else {
                  startRecording();
                }
              }}
              disabled={isPlayingAudio || sessionState === 'processing'}
              className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg ${
                isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isRecording ? (
                <Square className="h-8 w-8 text-white" fill="white" />
              ) : (
                <Mic className="h-8 w-8 text-white" />
              )}
            </button>
          </div>

          {/* Recording Duration with Time Guidance and Waveform */}
          {isRecording && (
            <div className="flex flex-col items-center gap-3">
              {/* Real-time audio waveform */}
              <div className="flex items-center justify-center gap-0.5 h-10 px-4">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1 rounded-full bg-red-500 transition-all duration-75"
                    style={{
                      height: `${Math.max(4, Math.min(32, audioLevel * 60 * (0.5 + Math.sin(Date.now() / 100 + i) * 0.5)))}px`,
                    }}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2 text-red-500">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="font-mono text-xl font-semibold" aria-live="polite">
                  {formatDuration(recordingDuration)}
                </span>
              </div>
              {/* Time guidance indicator */}
              <div className="flex items-center gap-2">
                <Clock className={`h-4 w-4 ${getTimeIndicatorColor(recordingDuration)}`} />
                <span className={`text-sm font-medium ${getTimeIndicatorColor(recordingDuration)}`}>
                  {getTimeGuidance(recordingDuration)}
                </span>
              </div>
              {/* Visual progress bar for ideal time */}
              <div className="w-56 h-2 bg-neutral-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    recordingDuration < IDEAL_TIME_MIN
                      ? 'bg-amber-500'
                      : recordingDuration <= IDEAL_TIME_MAX
                        ? 'bg-green-500'
                        : recordingDuration <= MAX_TIME_WARNING
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                  }`}
                  style={{
                    width: `${Math.min((recordingDuration / IDEAL_TIME_MAX) * 100, 100)}%`,
                  }}
                />
              </div>
              <span className="text-muted-foreground text-xs">Ideal: 1-2 minutes</span>
            </div>
          )}

          {/* Recording Hint and Skip Option */}
          {sessionState === 'ready' && !isRecording && !audioBlob && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-muted-foreground text-sm">
                {isPlayingAudio
                  ? 'Wait for question to finish, then record your answer'
                  : 'Click the microphone to start recording your answer'}
              </p>
              {!isPlayingAudio && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSkipConfirm(true)}
                  className="text-muted-foreground hover:text-neutral-700"
                >
                  <SkipForward className="h-4 w-4 mr-2" />
                  Skip Question
                </Button>
              )}
            </div>
          )}

          {/* Audio Preview & Submit */}
          {audioBlob && !isRecording && sessionState !== 'processing' && (
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-3 text-muted-foreground bg-neutral-200 px-4 py-2 rounded-full">
                <span className="font-mono">{formatDuration(recordingDuration)}</span>
                <span>recorded</span>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setAudioBlob(null);
                    setRecordingDuration(0);
                  }}
                >
                  <MicOff className="h-4 w-4 mr-2" />
                  Re-record
                </Button>
                <Button onClick={submitResponse}>
                  Submit Answer
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Processing State with Steps */}
          {sessionState === 'processing' && (
            <div className="flex flex-col items-center gap-6 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="flex flex-col gap-3 min-w-[200px]">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      processingStep === 'uploading' ? 'bg-primary' : 'bg-green-500'
                    }`}
                  >
                    {processingStep === 'uploading' ? (
                      <Loader2 className="h-3 w-3 animate-spin text-white" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <span
                    className={
                      processingStep === 'uploading' ? 'text-neutral-900' : 'text-muted-foreground'
                    }
                  >
                    Uploading audio
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      processingStep === 'transcribing'
                        ? 'bg-primary'
                        : processingStep === 'uploading'
                          ? 'bg-neutral-300'
                          : 'bg-green-500'
                    }`}
                  >
                    {processingStep === 'transcribing' ? (
                      <Loader2 className="h-3 w-3 animate-spin text-white" />
                    ) : processingStep === 'uploading' ? null : (
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <span
                    className={
                      processingStep === 'transcribing'
                        ? 'text-neutral-900'
                        : processingStep === 'uploading'
                          ? 'text-neutral-400'
                          : 'text-muted-foreground'
                    }
                  >
                    Transcribing speech
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      processingStep === 'saving'
                        ? 'bg-primary'
                        : processingStep === 'loading_next'
                          ? 'bg-green-500'
                          : 'bg-neutral-300'
                    }`}
                  >
                    {processingStep === 'saving' ? (
                      <Loader2 className="h-3 w-3 animate-spin text-white" />
                    ) : processingStep === 'loading_next' ? (
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    ) : null}
                  </div>
                  <span
                    className={
                      processingStep === 'saving'
                        ? 'text-neutral-900'
                        : processingStep === 'loading_next'
                          ? 'text-muted-foreground'
                          : 'text-neutral-400'
                    }
                  >
                    Saving response
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      processingStep === 'loading_next' ? 'bg-primary' : 'bg-neutral-300'
                    }`}
                  >
                    {processingStep === 'loading_next' ? (
                      <Loader2 className="h-3 w-3 animate-spin text-white" />
                    ) : null}
                  </div>
                  <span
                    className={
                      processingStep === 'loading_next' ? 'text-neutral-900' : 'text-neutral-400'
                    }
                  >
                    Loading next question
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* End Session Confirmation */}
      {showEndConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-sm w-full mx-4">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="h-6 w-6 text-amber-500" />
                <h3 className="text-lg font-semibold">End Interview Early?</h3>
              </div>
              <p className="text-muted-foreground mb-6">
                You&apos;ve completed {session?.current_question_index} of{' '}
                {session?.question_count_target} questions. Ending now will generate a report with
                your completed responses.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowEndConfirm(false)}
                >
                  Continue
                </Button>
                <Button variant="destructive" className="flex-1" onClick={endSessionEarly}>
                  End Interview
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Skip Question Confirmation */}
      {showSkipConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-sm w-full mx-4">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <SkipForward className="h-6 w-6 text-amber-500" />
                <h3 className="text-lg font-semibold">Skip This Question?</h3>
              </div>
              <p className="text-muted-foreground mb-6">
                Skipping will move to the next question without recording an answer. This question
                won&apos;t be included in your coaching report.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowSkipConfirm(false)}
                >
                  Stay Here
                </Button>
                <Button variant="secondary" className="flex-1" onClick={skipQuestion}>
                  Skip Question
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Keyboard Shortcuts Panel */}
      {showKeyboardHints && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-white backdrop-blur border border-neutral-200 rounded-lg p-4 z-40 shadow-xl">
          <div className="flex items-center gap-2 mb-3">
            <Keyboard className="h-4 w-4 text-primary" />
            <span className="text-neutral-900 font-medium text-sm">Keyboard Shortcuts</span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-0.5 bg-neutral-100 border border-neutral-200 rounded text-neutral-700">
                Space
              </kbd>
              <span className="text-muted-foreground">Start/Stop recording</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-0.5 bg-neutral-100 border border-neutral-200 rounded text-neutral-700">
                R
              </kbd>
              <span className="text-muted-foreground">Re-record</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-0.5 bg-neutral-100 border border-neutral-200 rounded text-neutral-700">
                Enter
              </kbd>
              <span className="text-muted-foreground">Submit answer</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-0.5 bg-neutral-100 border border-neutral-200 rounded text-neutral-700">
                S
              </kbd>
              <span className="text-muted-foreground">Skip question</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-0.5 bg-neutral-100 border border-neutral-200 rounded text-neutral-700">
                Esc
              </kbd>
              <span className="text-muted-foreground">Stop audio playback</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-0.5 bg-neutral-100 border border-neutral-200 rounded text-neutral-700">
                ?
              </kbd>
              <span className="text-muted-foreground">Toggle this panel</span>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-neutral-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6 text-muted-foreground text-sm">
            <div className="flex items-center gap-2">
              {isRecording ? <Mic className="h-4 w-4 text-red-500" /> : <Mic className="h-4 w-4" />}
              <span className="hidden sm:inline">
                Microphone {isRecording ? 'Recording' : 'Ready'}
              </span>
            </div>
            {session?.camera_enabled && (
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4" />
                <span className="hidden sm:inline">Camera Active</span>
              </div>
            )}
            <div className="capitalize hidden sm:block">{session?.mode} Mode</div>
          </div>
          <button
            onClick={() => setShowKeyboardHints((prev) => !prev)}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-neutral-700 text-sm transition-colors"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="h-4 w-4" />
            <span className="hidden sm:inline">Shortcuts</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
