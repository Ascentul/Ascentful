'use client';

import { useUser } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Calendar,
  ChevronRight,
  Loader2,
  Mic,
  MoreHorizontal,
  Play,
  PlayCircle,
  Plus,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { NewPracticeSessionModal } from '@/components/interview-practice/NewPracticeSessionModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface RoleProfile {
  _id: string;
  job_title: string;
  company_name?: string;
  role_summary?: string;
  created_at: number;
}

interface RoleSnapshot {
  job_title: string;
  company_name?: string;
}

interface PracticeSession {
  _id: string;
  role_profile_id?: string;
  role_snapshot?: RoleSnapshot;
  role_profile?: RoleProfile | RoleSnapshot | null;
  status: 'setup' | 'in_progress' | 'completed' | 'abandoned';
  mode: 'neutral' | 'supportive' | 'pressure';
  question_count_target: number;
  current_question_index: number;
  overall_score?: number;
  hire_signal?: 'strong_yes' | 'yes' | 'mixed' | 'no' | 'strong_no';
  started_at?: number;
  ended_at?: number;
  created_at: number;
}

function getHireSignalColor(signal?: string) {
  switch (signal) {
    case 'strong_yes':
      return 'bg-green-100 text-green-800';
    case 'yes':
      return 'bg-green-50 text-green-700';
    case 'mixed':
      return 'bg-yellow-50 text-yellow-700';
    case 'no':
      return 'bg-red-50 text-red-700';
    case 'strong_no':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function getHireSignalLabel(signal?: string) {
  switch (signal) {
    case 'strong_yes':
      return 'Strong Yes';
    case 'yes':
      return 'Yes';
    case 'mixed':
      return 'Mixed';
    case 'no':
      return 'No';
    case 'strong_no':
      return 'Strong No';
    default:
      return 'Pending';
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return { color: 'bg-green-100 text-green-800', label: 'Completed' };
    case 'in_progress':
      return { color: 'bg-blue-100 text-blue-800', label: 'In Progress' };
    case 'setup':
      return { color: 'bg-yellow-100 text-yellow-800', label: 'Setup' };
    case 'abandoned':
      return { color: 'bg-gray-100 text-gray-500', label: 'Abandoned' };
    default:
      return { color: 'bg-gray-100 text-gray-700', label: status };
  }
}

// Sort sessions: in_progress first, then setup, then completed (by date)
function sortSessions(sessions: PracticeSession[]) {
  const statusOrder: Record<string, number> = {
    in_progress: 0,
    setup: 1,
    completed: 2,
    abandoned: 3,
  };

  return [...sessions].sort((a, b) => {
    const orderA = statusOrder[a.status] ?? 4;
    const orderB = statusOrder[b.status] ?? 4;
    if (orderA !== orderB) return orderA - orderB;
    // Within same status, sort by date (most recent first)
    return (b.created_at ?? 0) - (a.created_at ?? 0);
  });
}

// Get role info from session (either from role_profile or role_snapshot)
function getSessionRoleInfo(session: PracticeSession) {
  if (session.role_profile) {
    return {
      job_title: session.role_profile.job_title,
      company_name: session.role_profile.company_name,
    };
  }
  if (session.role_snapshot) {
    return {
      job_title: session.role_snapshot.job_title,
      company_name: session.role_snapshot.company_name,
    };
  }
  return { job_title: 'Interview Session', company_name: undefined };
}

export default function InterviewPracticePage() {
  const { user: clerkUser, isLoaded } = useUser();
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [selectedRoleForSession, setSelectedRoleForSession] = useState<string | undefined>();

  // Fetch role profiles
  const { data: roleProfiles = [], isLoading: isLoadingProfiles } = useQuery({
    queryKey: ['/api/interview-practice/role-profile'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/interview-practice/role-profile');
      const data = await response.json();
      return data.roleProfiles || [];
    },
    enabled: !!user?.clerkId,
  });

  // Fetch sessions
  const { data: sessions = [], isLoading: isLoadingSessions } = useQuery({
    queryKey: ['/api/interview-practice/session'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/interview-practice/session');
      const data = await response.json();
      return data.sessions || [];
    },
    enabled: !!user?.clerkId,
  });

  // Delete role profile mutation
  const deleteProfileMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const response = await apiRequest(
        'DELETE',
        `/api/interview-practice/role-profile?id=${profileId}`,
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/interview-practice/role-profile'] });
      toast({
        title: 'Role Deleted',
        description: 'The saved role has been removed.',
        variant: 'success',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: (error as Error).message || 'Failed to delete role',
        variant: 'destructive',
      });
    },
  });

  const sortedSessions = sortSessions(sessions);
  const completedSessions = sessions.filter((s: PracticeSession) => s.status === 'completed');
  const inProgressSessions = sessions.filter((s: PracticeSession) => s.status === 'in_progress');
  const averageScore =
    completedSessions.length > 0
      ? completedSessions.reduce(
          (sum: number, s: PracticeSession) => sum + (s.overall_score || 0),
          0,
        ) / completedSessions.length
      : null;

  // Start practice with a saved role
  const handlePracticeWithRole = (roleId: string) => {
    setSelectedRoleForSession(roleId);
    setIsNewSessionModalOpen(true);
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

  const isLoading = isLoadingProfiles || isLoadingSessions;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Mic className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#0C29AB]">
                Interview Practice
              </h1>
              <p className="text-sm text-muted-foreground">
                Practice mock interviews with AI-powered feedback
              </p>
            </div>
          </div>
          <Button
            onClick={() => {
              setSelectedRoleForSession(undefined);
              setIsNewSessionModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Practice Session
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Sessions</p>
                <p className="text-2xl font-bold">{sessions.length}</p>
              </div>
              <Calendar className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{completedSessions.length}</p>
              </div>
              <Target className="h-8 w-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">{inProgressSessions.length}</p>
              </div>
              <PlayCircle className="h-8 w-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Score</p>
                <p className="text-2xl font-bold">
                  {averageScore !== null ? averageScore.toFixed(1) : '-'}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sessions Section (Main Content) */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Practice Sessions</CardTitle>
              <CardDescription>Your interview practice history</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : sortedSessions.length === 0 ? (
                <div className="text-center py-12">
                  <Mic className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                  <h3 className="text-lg font-medium mb-2">No practice sessions yet</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                    Start practicing your interview skills with AI-powered mock interviews. Get
                    real-time feedback and improve your performance.
                  </p>
                  <Button onClick={() => setIsNewSessionModalOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Start Your First Session
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedSessions.map((session: PracticeSession) => {
                    const roleInfo = getSessionRoleInfo(session);
                    const statusBadge = getStatusBadge(session.status);

                    return (
                      <div
                        key={session._id}
                        className="p-4 rounded-lg border hover:bg-gray-50 hover:border-gray-300 transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium truncate">{roleInfo.job_title}</p>
                              <Badge variant="secondary" className={statusBadge.color}>
                                {statusBadge.label}
                              </Badge>
                              {!session.role_profile_id && session.role_snapshot && (
                                <Badge variant="outline" className="text-xs">
                                  Unsaved Role
                                </Badge>
                              )}
                            </div>
                            {roleInfo.company_name && (
                              <p className="text-sm text-muted-foreground mb-1">
                                {roleInfo.company_name}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>
                                {session.current_question_index} / {session.question_count_target}{' '}
                                questions
                              </span>
                              <span className="capitalize">{session.mode} mode</span>
                              {session.started_at && (
                                <span>{new Date(session.started_at).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {session.status === 'completed' && (
                              <div className="text-right mr-2">
                                {session.overall_score && (
                                  <p className="text-lg font-bold text-primary">
                                    {session.overall_score.toFixed(1)}
                                  </p>
                                )}
                                <Badge
                                  variant="secondary"
                                  className={getHireSignalColor(session.hire_signal)}
                                >
                                  {getHireSignalLabel(session.hire_signal)}
                                </Badge>
                              </div>
                            )}

                            {/* Explicit Action Buttons Based on Status */}
                            {session.status === 'setup' && (
                              <Button size="sm" asChild>
                                <Link href={`/interview-practice/session/${session._id}`}>
                                  <Play className="h-3 w-3 mr-1" />
                                  Finish Setup
                                </Link>
                              </Button>
                            )}
                            {session.status === 'in_progress' && (
                              <Button size="sm" asChild>
                                <Link href={`/interview-practice/session/${session._id}`}>
                                  <ArrowRight className="h-3 w-3 mr-1" />
                                  Continue
                                </Link>
                              </Button>
                            )}
                            {session.status === 'completed' && (
                              <Button size="sm" variant="outline" asChild>
                                <Link href={`/interview-practice/session/${session._id}/report`}>
                                  <BookOpen className="h-3 w-3 mr-1" />
                                  Review
                                </Link>
                              </Button>
                            )}
                            {session.status === 'abandoned' && (
                              <Button size="sm" variant="ghost" asChild>
                                <Link href={`/interview-practice/session/${session._id}/report`}>
                                  <ChevronRight className="h-4 w-4" />
                                </Link>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Saved Roles Panel (Sidebar) */}
        <div className="lg:col-span-1">
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">Saved Roles</CardTitle>
                </div>
              </div>
              <CardDescription className="text-xs">
                Quick access to frequently practiced roles
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : roleProfiles.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-xs text-muted-foreground">
                    No saved roles yet. Roles you save during practice will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {roleProfiles.slice(0, 5).map((profile: RoleProfile) => (
                    <div
                      key={profile._id}
                      className="p-2 rounded-md border hover:bg-gray-50 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{profile.job_title}</p>
                          {profile.company_name && (
                            <p className="text-xs text-muted-foreground truncate">
                              {profile.company_name}
                            </p>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handlePracticeWithRole(profile._id)}>
                              <Play className="h-3 w-3 mr-2" />
                              Practice this role
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deleteProfileMutation.mutate(profile._id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-3 w-3 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full mt-1 h-7 text-xs"
                        onClick={() => handlePracticeWithRole(profile._id)}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Practice
                      </Button>
                    </div>
                  ))}
                  {roleProfiles.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      +{roleProfiles.length - 5} more saved roles
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Feature Highlights (only show when no sessions) */}
      {sessions.length === 0 && (
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center mb-4">
                <Mic className="h-6 w-6 text-violet-600" />
              </div>
              <h3 className="font-semibold mb-2">Voice-Based Practice</h3>
              <p className="text-sm text-muted-foreground">
                Speak your answers naturally while our AI transcribes and evaluates your responses
                in real-time.
              </p>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <Target className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold mb-2">Role-Specific Questions</h3>
              <p className="text-sm text-muted-foreground">
                Questions are tailored to the specific job and competencies you want to practice
                for.
              </p>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-semibold mb-2">Detailed Coaching</h3>
              <p className="text-sm text-muted-foreground">
                Get comprehensive feedback on each answer with suggestions for improvement and
                overall session coaching.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* New Practice Session Modal */}
      <NewPracticeSessionModal
        open={isNewSessionModalOpen}
        onOpenChange={setIsNewSessionModalOpen}
        defaultRoleProfileId={selectedRoleForSession}
      />
    </div>
  );
}
