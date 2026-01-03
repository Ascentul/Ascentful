'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  MapPin,
  User,
  Video,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import { AdvisorGate } from '@/components/advisor/AdvisorGate';
import { CommentButton } from '@/components/advisor/comments';
import { SessionEditor } from '@/components/advisor/sessions/SessionEditor';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isValidConvexId } from '@/lib/convex-ids';
import { isValidHttpUrl } from '@/lib/utils';

// Session type labels
const SESSION_TYPE_LABELS: Record<string, string> = {
  career_planning: 'Career Planning',
  resume_review: 'Resume Review',
  mock_interview: 'Mock Interview',
  application_strategy: 'Application Strategy',
  general_advising: 'General Advising',
  other: 'Other',
};

// Status badge variants
const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  scheduled: 'default',
  completed: 'secondary',
  cancelled: 'destructive',
  no_show: 'outline',
};

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user: clerkUser, isLoaded: isUserLoaded } = useUser();

  const rawSessionId = Array.isArray(params.id) ? params.id[0] : params.id;
  const sessionId = rawSessionId?.trim() ?? '';
  const isValidSessionId = isValidConvexId(sessionId);

  // Fetch session details
  const session = useQuery(
    api.advisor_sessions.getSessionById,
    clerkUser?.id && sessionId && isValidSessionId
      ? { sessionId: sessionId as Id<'advisor_sessions'> }
      : 'skip',
  );

  // Fetch student info
  const caseload = useQuery(
    api.advisor_students.getMyCaseload,
    clerkUser?.id ? { clerkId: clerkUser.id } : 'skip',
  );

  // Find student in caseload
  const student = caseload?.find((s) => s._id === session?.student_id);

  // Only show loading if we have a valid ID and are waiting for data
  // Also show loading while Clerk user is still loading
  const isLoading =
    !isUserLoaded || (isValidSessionId && (session === undefined || caseload === undefined));

  // If the session ID is invalid (e.g., "new"), show not found immediately
  if (!isValidSessionId) {
    return (
      <ErrorBoundary>
        <AdvisorGate requiredFlag="advisor.advising">
          <div className="container mx-auto p-6">
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h2 className="text-lg font-medium">Session not found</h2>
              <p className="text-sm text-muted-foreground mb-4">
                The session you&apos;re looking for doesn&apos;t exist or you don&apos;t have access
                to it.
              </p>
              <Button asChild>
                <Link href="/advisor/advising/sessions">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Sessions
                </Link>
              </Button>
            </div>
          </div>
        </AdvisorGate>
      </ErrorBoundary>
    );
  }

  if (isLoading) {
    return (
      <ErrorBoundary>
        <AdvisorGate requiredFlag="advisor.advising">
          <div className="container mx-auto p-6">
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </div>
        </AdvisorGate>
      </ErrorBoundary>
    );
  }

  if (!session) {
    return (
      <ErrorBoundary>
        <AdvisorGate requiredFlag="advisor.advising">
          <div className="container mx-auto p-6">
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h2 className="text-lg font-medium">Session not found</h2>
              <p className="text-sm text-muted-foreground mb-4">
                The session you're looking for doesn't exist or you don't have access to it.
              </p>
              <Button asChild>
                <Link href="/advisor/advising/sessions">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Sessions
                </Link>
              </Button>
            </div>
          </div>
        </AdvisorGate>
      </ErrorBoundary>
    );
  }

  const sessionDate = session.scheduled_at ?? session.start_at ?? null;

  return (
    <ErrorBoundary>
      <AdvisorGate requiredFlag="advisor.advising">
        <div className="w-full">
          <div className="w-full gradient-border-bottom p-5 space-y-6 shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight">{session.title}</h1>
                    <Badge variant={STATUS_VARIANTS[session.status || 'scheduled']}>
                      {session.status || 'scheduled'}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    {SESSION_TYPE_LABELS[session.session_type || ''] || session.session_type}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Main Content - Session Editor */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Edit Session</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {clerkUser?.id && (
                      <SessionEditor
                        session={{
                          _id: session._id,
                          student_id: session.student_id,
                          title: session.title || '',
                          session_type: session.session_type || 'general_advising',
                          start_at: session.start_at || Date.now(),
                          duration_minutes: session.duration_minutes || 60,
                          location: session.location,
                          meeting_url: session.meeting_url,
                          notes: session.notes,
                          visibility: session.visibility || 'advisor_only',
                          status: session.status,
                          version: session.version || 1,
                        }}
                      />
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar - Session Info */}
              <div className="space-y-6">
                {/* Student Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Student
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {student ? (
                      <div className="space-y-2">
                        <p className="font-medium">{student.name}</p>
                        {student.email && (
                          <p className="text-sm text-muted-foreground">{student.email}</p>
                        )}
                        <Button variant="outline" size="sm" asChild className="w-full mt-2">
                          <Link href={`/advisor/students/${student._id}`}>View Profile</Link>
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Student not found</p>
                    )}
                  </CardContent>
                </Card>

                {/* Session Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Session Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Date & Time */}
                    {sessionDate ? (
                      <div className="flex items-start gap-3">
                        <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">
                            {format(new Date(sessionDate), 'EEEE, MMMM d, yyyy')}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(sessionDate), 'h:mm a')}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Date not scheduled</p>
                    )}

                    {/* Duration */}
                    <div className="flex items-start gap-3">
                      <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{session.duration_minutes || 60} minutes</p>
                        <p className="text-sm text-muted-foreground">Duration</p>
                      </div>
                    </div>

                    {/* Location */}
                    {session.location && (
                      <div className="flex items-start gap-3">
                        <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{session.location}</p>
                          <p className="text-sm text-muted-foreground">Location</p>
                        </div>
                      </div>
                    )}

                    {/* Meeting URL */}
                    {session.meeting_url && isValidHttpUrl(session.meeting_url) && (
                      <div className="flex items-start gap-3">
                        <Video className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <a
                            href={session.meeting_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-600 hover:underline"
                          >
                            Join Meeting
                          </a>
                          <p className="text-sm text-muted-foreground">Virtual Meeting</p>
                        </div>
                      </div>
                    )}

                    {/* Visibility */}
                    <div className="flex items-start gap-3">
                      {session.visibility === 'shared' ? (
                        <Eye className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      ) : (
                        <EyeOff className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium">
                          {session.visibility === 'shared' ? 'Shared' : 'Advisor Only'}
                        </p>
                        <p className="text-sm text-muted-foreground">Visibility</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Comments */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Comments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CommentButton
                      targetType="session"
                      targetId={session._id}
                      studentId={session.student_id}
                      section="general"
                    />
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button variant="outline" size="sm" asChild className="w-full">
                      <Link href="/advisor/advising/sessions">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Sessions
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild className="w-full">
                      <Link href="/advisor/advising/calendar">
                        <Calendar className="h-4 w-4 mr-2" />
                        View Calendar
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </AdvisorGate>
    </ErrorBoundary>
  );
}
