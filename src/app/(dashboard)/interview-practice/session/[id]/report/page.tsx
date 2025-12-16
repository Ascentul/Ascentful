'use client';

import { useUser } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Award,
  Bookmark,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Lightbulb,
  Loader2,
  MessageSquare,
  Mic,
  Share2,
  Star,
  Target,
  ThumbsUp,
  TrendingUp,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface Turn {
  _id: string;
  turn_index: number;
  question_text: string;
  question_type: string;
  transcript_text?: string;
  response_duration_ms?: number;
  scores?: {
    communication?: number;
    specificity?: number;
    structure?: number;
    role_fit?: number;
    overall?: number;
  };
  strengths?: string[];
  improvements?: string[];
  ideal_answer?: string;
}

interface RoleSnapshot {
  job_title: string;
  company_name?: string;
}

interface Session {
  _id: string;
  status: string;
  mode: string;
  question_count_target: number;
  current_question_index: number;
  overall_score?: number;
  dimension_scores?: {
    communication?: number;
    relevance?: number;
    specificity?: number;
    structure?: number;
    confidence?: number;
  };
  coach_summary?: string;
  key_takeaways?: string[];
  hire_signal?: string;
  started_at?: number;
  ended_at?: number;
  role_profile_id?: string;
  role_snapshot?: RoleSnapshot;
  role_profile?: {
    _id?: string | null;
    job_title: string;
    company_name?: string;
  } | null;
}

function getScoreColor(score: number) {
  if (score >= 4) return 'text-green-600';
  if (score >= 3) return 'text-blue-600';
  if (score >= 2) return 'text-amber-600';
  return 'text-red-600';
}

function getScoreBg(score: number) {
  if (score >= 4) return 'bg-green-50';
  if (score >= 3) return 'bg-blue-50';
  if (score >= 2) return 'bg-amber-50';
  return 'bg-red-50';
}

function getHireSignalColor(signal?: string) {
  switch (signal) {
    case 'strong_yes':
      return 'bg-green-500 text-white';
    case 'yes':
      return 'bg-green-100 text-green-800';
    case 'mixed':
      return 'bg-amber-100 text-amber-800';
    case 'no':
      return 'bg-red-100 text-red-800';
    case 'strong_no':
      return 'bg-red-500 text-white';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getHireSignalLabel(signal?: string) {
  switch (signal) {
    case 'strong_yes':
      return 'Strong Hire';
    case 'yes':
      return 'Hire';
    case 'mixed':
      return 'Mixed Signals';
    case 'no':
      return 'Not Ready';
    case 'strong_no':
      return 'Needs Work';
    default:
      return 'Pending';
  }
}

function ScoreRing({
  score,
  size = 'md',
  maxScore = 5,
}: {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  maxScore?: number;
}) {
  // Normalize score to 0-100 percentage
  const percentage = maxScore === 100 ? score : (score / maxScore) * 100;
  // Display score (if maxScore is 100, show as percentage)
  const displayScore = maxScore === 100 ? Math.round(score) : score.toFixed(1);
  const sizeClasses = {
    sm: 'w-20 h-20 text-lg',
    md: 'w-28 h-28 text-2xl',
    lg: 'w-36 h-36 text-3xl',
  };
  const strokeWidth = size === 'lg' ? 8 : size === 'md' ? 6 : 4;
  // Use fixed viewBox size and calculate radius accordingly
  const viewBoxSize = 100;
  const radius = (viewBoxSize - strokeWidth * 2) / 2;
  const center = viewBoxSize / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={`relative ${sizeClasses[size]} flex items-center justify-center flex-shrink-0`}>
      <svg
        className="w-full h-full -rotate-90"
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        style={{ overflow: 'visible' }}
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={
            percentage >= 80
              ? '#22c55e'
              : percentage >= 60
                ? '#3b82f6'
                : percentage >= 40
                  ? '#f59e0b'
                  : '#ef4444'
          }
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <span
        className={`absolute font-bold ${percentage >= 80 ? 'text-green-600' : percentage >= 60 ? 'text-blue-600' : percentage >= 40 ? 'text-amber-600' : 'text-red-600'}`}
      >
        {displayScore}
        {maxScore === 100 && <span className="text-xs">%</span>}
      </span>
    </div>
  );
}

function TurnCard({ turn, index }: { turn: Turn; index: number }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">
                Q{index + 1}
              </Badge>
              <Badge variant="secondary" className="text-xs capitalize">
                {turn.question_type?.replace('_', ' ')}
              </Badge>
            </div>
            <CardTitle className="text-base font-medium">{turn.question_text}</CardTitle>
          </div>
          <div className="flex items-center gap-3 ml-4">
            {turn.scores?.overall && (
              <div className={`text-lg font-bold ${getScoreColor(turn.scores.overall)}`}>
                {turn.scores.overall.toFixed(1)}
              </div>
            )}
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 space-y-6">
          {/* Your Response */}
          {turn.transcript_text && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Your Response
              </h4>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm leading-relaxed">{turn.transcript_text}</p>
                {turn.response_duration_ms && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{Math.round(turn.response_duration_ms / 1000)} seconds</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Scores Breakdown */}
          {turn.scores && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Score Breakdown</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(turn.scores)
                  .filter(([key]) => key !== 'overall')
                  .map(([key, value]) => (
                    <div key={key} className={`p-3 rounded-lg ${getScoreBg(value as number)}`}>
                      <p className="text-xs text-muted-foreground capitalize mb-1">
                        {key.replace('_', ' ')}
                      </p>
                      <p className={`text-lg font-bold ${getScoreColor(value as number)}`}>
                        {(value as number).toFixed(1)}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Strengths */}
          {turn.strengths && turn.strengths.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <ThumbsUp className="h-4 w-4 text-green-500" />
                Strengths
              </h4>
              <ul className="space-y-1">
                {turn.strengths.map((strength, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Areas for Improvement */}
          {turn.improvements && turn.improvements.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-amber-500" />
                Areas for Improvement
              </h4>
              <ul className="space-y-1">
                {turn.improvements.map((improvement, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>{improvement}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Ideal Answer */}
          {turn.ideal_answer && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <Star className="h-4 w-4 text-primary" />
                Sample Strong Answer
              </h4>
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <p className="text-sm leading-relaxed italic">{turn.ideal_answer}</p>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function InterviewReportPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const { user: clerkUser, isLoaded } = useUser();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [saveRolePromptDismissed, setSaveRolePromptDismissed] = useState(false);

  // Fetch session with turns
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['/api/interview-practice/session/report', sessionId],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        `/api/interview-practice/session?id=${sessionId}&includeTurns=true`,
      );
      const data = await response.json();
      return {
        session: data.session,
        turns: data.turns || [],
      };
    },
    enabled: !!user?.clerkId && !!sessionId,
  });

  // Save role mutation
  const saveRoleMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        'POST',
        `/api/interview-practice/session/${sessionId}/save-role`,
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/interview-practice/role-profile'] });
      refetch(); // Refresh session to update role_profile_id
      toast({
        title: 'Role Saved',
        description: 'This role has been saved for future practice sessions.',
        variant: 'success',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: (error as Error).message || 'Failed to save role',
        variant: 'destructive',
      });
    },
  });

  const session = data?.session as Session | undefined;
  const turns = (data?.turns || []) as Turn[];

  // Check if session has an unsaved role
  const hasUnsavedRole = session && !session.role_profile_id && session.role_snapshot;

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading your coaching report...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Session not found</p>
            <Button asChild className="mt-4">
              <Link href="/interview-practice">Back to Interview Practice</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sessionDuration =
    session.started_at && session.ended_at
      ? Math.round((session.ended_at - session.started_at) / 60000)
      : null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/interview-practice">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Interview Practice
          </Link>
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary-500 mb-2">
              Coaching Report
            </h1>
            <p className="text-muted-foreground">
              {session.role_profile?.job_title}
              {session.role_profile?.company_name && ` at ${session.role_profile.company_name}`}
            </p>
            {session.started_at && (
              <p className="text-sm text-muted-foreground mt-1">
                {new Date(session.started_at).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled title="Coming soon">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button variant="outline" size="sm" disabled title="Coming soon">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
        </div>
      </div>

      {/* Save Role Prompt (for unsaved roles) */}
      {hasUnsavedRole && !saveRolePromptDismissed && (
        <Alert className="mb-6 border-primary/30 bg-primary/5">
          <Bookmark className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary">Save this role for later?</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span className="text-muted-foreground">
              Save &quot;{session.role_snapshot?.job_title}&quot;
              {session.role_snapshot?.company_name &&
                ` at ${session.role_snapshot.company_name}`}{' '}
              to practice with again.
            </span>
            <div className="flex gap-2 ml-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSaveRolePromptDismissed(true)}
                disabled={saveRoleMutation.isPending}
              >
                <X className="h-3 w-3 mr-1" />
                Dismiss
              </Button>
              <Button
                size="sm"
                onClick={() => saveRoleMutation.mutate()}
                disabled={saveRoleMutation.isPending}
              >
                {saveRoleMutation.isPending ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Bookmark className="h-3 w-3 mr-1" />
                )}
                Save Role
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {/* Overall Score */}
        <Card className="md:col-span-2">
          <CardContent className="pt-6">
            <div className="flex items-center gap-6">
              <ScoreRing score={session.overall_score || 0} size="lg" maxScore={100} />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Overall Performance</p>
                <Badge className={`${getHireSignalColor(session.hire_signal)} text-sm`}>
                  {getHireSignalLabel(session.hire_signal)}
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">
                  Based on {turns.length} questions answered
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                <Mic className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{turns.length}</p>
                <p className="text-sm text-muted-foreground">Questions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{sessionDuration || '-'}</p>
                <p className="text-sm text-muted-foreground">Minutes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dimension Scores */}
      {session.dimension_scores && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5" />
              Performance Breakdown
            </CardTitle>
            <CardDescription>Scores across key interview dimensions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              {Object.entries(session.dimension_scores).map(([key, value]) => (
                <div key={key} className="text-center">
                  <ScoreRing score={value || 0} size="sm" maxScore={100} />
                  <p className="text-sm font-medium capitalize mt-2">{key}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coach Summary */}
      {session.coach_summary && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Coach&apos;s Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">{session.coach_summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Key Takeaways */}
      {session.key_takeaways && session.key_takeaways.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5" />
              Key Takeaways
            </CardTitle>
            <CardDescription>Focus on these areas for your next practice session</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {session.key_takeaways.map((takeaway, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10"
                >
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary">{i + 1}</span>
                  </div>
                  <p className="text-sm">{takeaway}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Question-by-Question Breakdown */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Question-by-Question Breakdown</h2>
        <div className="space-y-4">
          {turns.map((turn, index) => (
            <TurnCard key={turn._id} turn={turn} index={index} />
          ))}
        </div>
      </div>

      {/* Practice Again CTA */}
      <Card className="bg-gradient-to-r from-violet-500 to-purple-600 border-0">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between text-white">
            <div>
              <h3 className="text-lg font-semibold mb-1">Ready to improve?</h3>
              <p className="text-white/80 text-sm">
                Practice makes perfect. Start another session to work on your interview skills.
              </p>
            </div>
            <Button variant="secondary" asChild>
              <Link href="/interview-practice/new">
                Practice Again
                <Mic className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
