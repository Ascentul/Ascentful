'use client';

/**
 * Student Advisor Session Detail - View Session Page
 *
 * Shows details of a specific advising session.
 * Only shared notes are displayed - private advisor notes are never shown.
 */

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  MessageSquare,
  User,
  Video,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { StudentUniversityGate } from '@/components/StudentUniversityGate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SessionDetailPage() {
  return (
    <StudentUniversityGate>
      <SessionDetailContent />
    </StudentUniversityGate>
  );
}

function SessionDetailContent() {
  const { user } = useUser();
  const params = useParams();
  const clerkId = user?.id;
  const sessionId = params.id as string;

  const session = useQuery(
    api.student_advisor_hub.getMySessionDetail,
    clerkId && sessionId ? { clerkId, sessionId: sessionId as Id<'advisor_sessions'> } : 'skip',
  );

  const isLoading = session === undefined;

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

  if (!session) {
    return (
      <div className="w-full">
        <div className="w-full gradient-border-bottom p-5 space-y-6 shadow-sm">
          <div className="flex items-center gap-4">
            <Link href="/student/advisor/sessions">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Session Details</h1>
          </div>

          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Session Not Found</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                This session doesn't exist or you don't have access to view it.
              </p>
              <Link href="/student/advisor/sessions" className="mt-4 inline-block">
                <Button variant="outline">Back to Sessions</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const startDate = new Date(session.start_at);
  const endDate = session.end_at ? new Date(session.end_at) : null;
  const now = Date.now();

  // Calculate session end time, accounting for duration if end_at is not set
  const sessionEndTime = endDate
    ? endDate.getTime()
    : session.duration_minutes
      ? startDate.getTime() + session.duration_minutes * 60 * 1000
      : startDate.getTime() + 60 * 60 * 1000; // Default 1 hour if no duration

  // Add 15 min buffer after session ends to allow for sessions running over
  const joinableUntil = sessionEndTime + 15 * 60 * 1000;
  const isJoinable =
    now < joinableUntil && session.status !== 'cancelled' && session.status !== 'completed';
  const isPast = now > sessionEndTime;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getSessionTypeLabel = (type?: string) => {
    const labels: Record<string, string> = {
      career_planning: 'Career Planning',
      resume_review: 'Resume Review',
      mock_interview: 'Mock Interview',
      application_strategy: 'Application Strategy',
      general_advising: 'General Advising',
      other: 'Other',
    };
    return labels[type || 'general_advising'] || 'Advising Session';
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Completed
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            Cancelled
          </Badge>
        );
      case 'scheduled':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            Scheduled
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full">
      <div className="w-full gradient-border-bottom p-5 space-y-6 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/student/advisor/sessions">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  {session.title || getSessionTypeLabel(session.session_type)}
                </h1>
                {getStatusBadge(session.status)}
              </div>
              <p className="text-muted-foreground">{formatDate(startDate)}</p>
            </div>
          </div>

          {session.meeting_url && isJoinable && (
            <a href={session.meeting_url} target="_blank" rel="noopener noreferrer">
              <Button>
                <Video className="h-4 w-4 mr-2" />
                Join Meeting
              </Button>
            </a>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Session Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Session Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                      <Clock className="h-5 w-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Time</p>
                      <p className="font-medium">
                        {formatTime(startDate)}
                        {endDate && ` - ${formatTime(endDate)}`}
                        {session.duration_minutes && !endDate && (
                          <span className="text-muted-foreground">
                            {' '}
                            ({session.duration_minutes} min)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Type</p>
                      <p className="font-medium">{getSessionTypeLabel(session.session_type)}</p>
                    </div>
                  </div>

                  {session.location && (
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                        <MapPin className="h-5 w-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Location</p>
                        <p className="font-medium">{session.location}</p>
                      </div>
                    </div>
                  )}

                  {session.meeting_url && (
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                        <Video className="h-5 w-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Meeting Link</p>
                        <a
                          href={session.meeting_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-primary-600 hover:underline flex items-center gap-1"
                        >
                          Join Meeting
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Shared Notes */}
            {session.sharedNotes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Session Notes
                  </CardTitle>
                  <CardDescription>Notes shared by your advisor from this session</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap">{session.sharedNotes}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* No Notes State */}
            {!session.sharedNotes && isPast && (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    No notes have been shared from this session yet.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Advisor Card */}
            {session.advisor && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Your Advisor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary-600" />
                    </div>
                    <div>
                      <p className="font-semibold">{session.advisor.name}</p>
                      <p className="text-sm text-muted-foreground">{session.advisor.email}</p>
                    </div>
                  </div>
                  <Link href="/student/advisor/messages" className="mt-4 block">
                    <Button variant="outline" className="w-full">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Send Message
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/student/advisor/sessions/book">
                  <Button variant="outline" className="w-full justify-start">
                    <Calendar className="h-4 w-4 mr-2" />
                    Book Another Session
                  </Button>
                </Link>
                <Link href="/student/advisor/reviews/new">
                  <Button variant="outline" className="w-full justify-start">
                    <FileText className="h-4 w-4 mr-2" />
                    Request Document Review
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
