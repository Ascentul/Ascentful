'use client';

import { useUser } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Mic,
  MicOff,
  Pause,
  Play,
  Square,
  Video,
  VideoOff,
  Volume2,
  X,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface Turn {
  _id: string;
  turn_index: number;
  question_text: string;
  question_type: string;
  tts_audio_url?: string;
  transcript_text?: string;
  answered_at?: number;
}

interface Session {
  _id: string;
  status: 'setup' | 'in_progress' | 'completed' | 'abandoned';
  mode: 'neutral' | 'supportive' | 'pressure';
  question_count_target: number;
  current_question_index: number;
  camera_enabled: boolean;
  roleProfile?: {
    job_title: string;
    company_name?: string;
  };
}

type SessionState =
  | 'loading'
  | 'ready'
  | 'playing_question'
  | 'recording'
  | 'processing'
  | 'complete';

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
  const [currentTurn, setCurrentTurn] = useState<Turn | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
      const response = await apiRequest(
        'POST',
        `/api/interview-practice/session/${sessionId}/start`,
      );
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentTurn(data.turn);
      setSessionState('ready');
      refetchSession();
    },
    onError: (error) => {
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
      const formData = new FormData();
      formData.append('audio', audioData, 'response.webm');
      formData.append('turn_id', currentTurn!._id);
      formData.append('duration_ms', (recordingDuration * 1000).toString());

      const response = await fetch(`/api/interview-practice/session/${sessionId}/turn`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit response');
      }

      return response.json();
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
    if (session && sessionState === 'loading') {
      if (session.status === 'setup') {
        startSessionMutation.mutate();
      } else if (session.status === 'completed') {
        router.replace(`/interview-practice/session/${sessionId}/report`);
      } else if (session.status === 'in_progress') {
        // Resume session - need to fetch current turn
        nextQuestionMutation.mutate();
      }
    }
  }, [session, sessionState]);

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

    setSessionState('playing_question');
    setIsPlayingAudio(true);

    try {
      // Generate TTS if not already available
      let audioUrl = currentTurn.tts_audio_url;
      if (!audioUrl) {
        const response = await apiRequest('POST', '/api/interview-practice/tts', {
          text: currentTurn.question_text,
          session_id: sessionId,
        });
        const data = await response.json();
        audioUrl = data.audioUrl;
      }

      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audioElementRef.current = audio;
        audio.onended = () => {
          setIsPlayingAudio(false);
          setSessionState('ready');
        };
        audio.onerror = () => {
          setIsPlayingAudio(false);
          setSessionState('ready');
          toast({
            title: 'Audio Error',
            description: 'Could not play question audio. You can still see the question above.',
            variant: 'destructive',
          });
        };
        await audio.play();
      } else {
        setIsPlayingAudio(false);
        setSessionState('ready');
      }
    } catch (error) {
      setIsPlayingAudio(false);
      setSessionState('ready');
    }
  }, [currentTurn, sessionId, toast]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const mediaRecorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128000 });
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingDuration(0);
      setSessionState('recording');

      // Start recording timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      toast({
        title: 'Microphone Error',
        description: 'Could not access microphone. Please check permissions.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      setSessionState('ready');
    }
  }, []);

  // Submit response
  const submitResponse = useCallback(async () => {
    if (!audioBlob) return;

    setSessionState('processing');
    await submitTurnMutation.mutateAsync(audioBlob);

    // Check if session is complete
    if ((session?.current_question_index || 0) >= (session?.question_count_target || 0) - 1) {
      setSessionState('complete');
    } else {
      nextQuestionMutation.mutate();
    }
  }, [audioBlob, session, submitTurnMutation, nextQuestionMutation]);

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
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-white" />
          <p className="text-white/70">Preparing your interview...</p>
        </div>
      </div>
    );
  }

  if (sessionState === 'complete') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
            <Mic className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-white font-semibold">
              {session?.roleProfile?.job_title || 'Interview Practice'}
            </h1>
            {session?.roleProfile?.company_name && (
              <p className="text-white/60 text-sm">{session.roleProfile.company_name}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-white/60 text-sm">
              Question {(session?.current_question_index || 0) + 1} of{' '}
              {session?.question_count_target}
            </p>
            <Progress value={progress} className="w-32 h-1.5 mt-1" />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-white/60 hover:text-white hover:bg-white/10"
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
          <div className="absolute top-24 right-6 w-48 h-36 rounded-lg overflow-hidden bg-black/50 border border-white/10">
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
          <p className="text-white/40 text-sm uppercase tracking-wide mb-4">
            {currentTurn?.question_type?.replace('_', ' ')} Question
          </p>
          <h2 className="text-2xl md:text-3xl font-medium text-white leading-relaxed">
            {currentTurn?.question_text || 'Loading question...'}
          </h2>
        </div>

        {/* Audio/Recording Controls */}
        <div className="flex flex-col items-center gap-6">
          {/* Play Question Button */}
          {sessionState === 'ready' && !isRecording && !audioBlob && (
            <Button
              variant="outline"
              size="lg"
              onClick={playQuestionAudio}
              className="bg-white/5 border-white/20 text-white hover:bg-white/10"
            >
              <Volume2 className="h-5 w-5 mr-2" />
              Play Question Audio
            </Button>
          )}

          {/* Playing Audio Indicator */}
          {isPlayingAudio && (
            <div className="flex items-center gap-3 text-white/70">
              <div className="flex gap-1">
                <span className="w-1 h-4 bg-violet-400 rounded animate-pulse" />
                <span className="w-1 h-6 bg-violet-400 rounded animate-pulse delay-75" />
                <span className="w-1 h-3 bg-violet-400 rounded animate-pulse delay-150" />
                <span className="w-1 h-5 bg-violet-400 rounded animate-pulse delay-200" />
              </div>
              <span>Playing question...</span>
            </div>
          )}

          {/* Recording Button */}
          <div className="relative">
            {isRecording && (
              <div className="absolute inset-0 -m-4 rounded-full bg-red-500/20 animate-ping" />
            )}
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isPlayingAudio || sessionState === 'processing'}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-violet-500 hover:bg-violet-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isRecording ? (
                <Square className="h-8 w-8 text-white" fill="white" />
              ) : (
                <Mic className="h-8 w-8 text-white" />
              )}
            </button>
          </div>

          {/* Recording Duration */}
          {isRecording && (
            <div className="flex items-center gap-2 text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="font-mono text-lg">{formatDuration(recordingDuration)}</span>
            </div>
          )}

          {/* Recording Hint */}
          {sessionState === 'ready' && !isRecording && !audioBlob && (
            <p className="text-white/40 text-sm">
              {isPlayingAudio
                ? 'Wait for question to finish, then record your answer'
                : 'Click the microphone to start recording your answer'}
            </p>
          )}

          {/* Audio Preview & Submit */}
          {audioBlob && !isRecording && sessionState !== 'processing' && (
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-3 text-white/70 bg-white/5 px-4 py-2 rounded-full">
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
                  className="bg-white/5 border-white/20 text-white hover:bg-white/10"
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

          {/* Processing State */}
          {sessionState === 'processing' && (
            <div className="flex flex-col items-center gap-4 text-white/70">
              <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
              <p>Processing your response...</p>
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

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-white/10">
        <div className="flex items-center justify-center gap-6 text-white/40 text-sm">
          <div className="flex items-center gap-2">
            {isRecording ? <Mic className="h-4 w-4 text-red-400" /> : <Mic className="h-4 w-4" />}
            <span>Microphone {isRecording ? 'Recording' : 'Ready'}</span>
          </div>
          {session?.camera_enabled && (
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              <span>Camera Active</span>
            </div>
          )}
          <div className="capitalize">{session?.mode} Mode</div>
        </div>
      </footer>
    </div>
  );
}
