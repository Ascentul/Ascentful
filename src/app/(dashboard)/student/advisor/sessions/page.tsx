'use client';

/**
 * Student Advisor Sessions - Sessions List Page
 *
 * Shows a student their upcoming and past advising sessions.
 * Sessions are filtered to only show those where the student is a participant.
 * Private advisor notes are never shown - only shared notes are visible.
 */

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useQuery } from 'convex/react';
import { ArrowLeft, Calendar, CalendarDays, Clock, Loader2, MapPin, Video } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { StudentUniversityGate } from '@/components/StudentUniversityGate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function StudentSessionsPage() {
  return (
    <StudentUniversityGate>
      <StudentSessionsContent />
    </StudentUniversityGate>
  );
}

function StudentSessionsContent() {
  const { user } = useUser();
  const clerkId = user?.id;

  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  // Fetch sessions based on filter
  const sessions = useQuery(
    api.student_advisor_hub.getMySessions,
    clerkId ? { clerkId, filter: activeTab } : 'skip',
  );

  // Fetch bookings to show pending requests
  const bookings = useQuery(
    api.student_advisor_hub.getMyBookings,
    clerkId ? { clerkId, filter: 'pending' } : 'skip',
  );

  const isLoading = sessions === undefined;
  const hasPendingBookings = (bookings?.length ?? 0) > 0;

  return (
    <div className="w-full">
      <div className="w-full gradient-border-bottom p-5 space-y-6 shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/student/advisor">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">My Sessions</h1>
            <p className="text-muted-foreground">View your upcoming and past advising sessions</p>
          </div>
          <Link href="/student/advisor/sessions/book">
            <Button>
              <CalendarDays className="h-4 w-4 mr-2" />
              Book Session
            </Button>
          </Link>
        </div>

        {/* Pending Bookings Notice */}
        {hasPendingBookings && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-orange-900">
                    {bookings?.length} Pending Booking Request{bookings?.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-orange-700">Waiting for your advisor to confirm</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'upcoming' | 'past')}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-6">
            {isLoading ? (
              <LoadingState />
            ) : sessions?.length === 0 ? (
              <EmptyState type="upcoming" />
            ) : (
              <SessionsList sessions={sessions ?? []} type="upcoming" />
            )}
          </TabsContent>

          <TabsContent value="past" className="mt-6">
            {isLoading ? (
              <LoadingState />
            ) : sessions?.length === 0 ? (
              <EmptyState type="past" />
            ) : (
              <SessionsList sessions={sessions ?? []} type="past" />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ============================================================================
// Sessions List Component
// ============================================================================

// Manual type definition matching the Convex query return shape
type Session = {
  _id: any;
  title: string;
  start_at: number;
  end_at?: number;
  session_type?:
    | 'career_planning'
    | 'resume_review'
    | 'mock_interview'
    | 'application_strategy'
    | 'general_advising'
    | 'other';
  status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  location?: string;
  meeting_url?: string;
  duration_minutes?: number;
  created_at: number;
};

function SessionsList({ sessions, type }: { sessions: Session[]; type: 'upcoming' | 'past' }) {
  return (
    <div className="space-y-4">
      {sessions.map((session) => (
        <SessionCard key={session._id} session={session} isPast={type === 'past'} />
      ))}
    </div>
  );
}

function SessionCard({ session, isPast }: { session: Session; isPast: boolean }) {
  const startDate = new Date(session.start_at);
  const endDate = session.end_at ? new Date(session.end_at) : null;

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
    <Card className={`transition-shadow hover:shadow-md ${isPast ? 'opacity-80' : ''}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Date Box */}
            <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-primary-50 flex flex-col items-center justify-center text-primary-700">
              <span className="text-2xl font-bold">{startDate.getDate()}</span>
              <span className="text-xs uppercase">
                {startDate.toLocaleString('en-US', { month: 'short' })}
              </span>
            </div>

            {/* Session Info */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">
                  {session.title || getSessionTypeLabel(session.session_type)}
                </h3>
                {getStatusBadge(session.status)}
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>
                    {formatTime(startDate)}
                    {endDate && ` - ${formatTime(endDate)}`}
                    {session.duration_minutes && !endDate && ` (${session.duration_minutes} min)`}
                  </span>
                </div>

                {session.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    <span>{session.location}</span>
                  </div>
                )}
              </div>

              <p className="text-sm text-muted-foreground">{formatDate(startDate)}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {session.meeting_url && !isPast && (
              <a href={session.meeting_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <Video className="h-4 w-4 mr-2" />
                  Join
                </Button>
              </a>
            )}
            <Link href={`/student/advisor/sessions/${session._id}`}>
              <Button variant="ghost" size="sm">
                View Details
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Empty & Loading States
// ============================================================================

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function EmptyState({ type }: { type: 'upcoming' | 'past' }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-12 text-center">
        <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">
          {type === 'upcoming' ? 'No Upcoming Sessions' : 'No Past Sessions'}
        </h3>
        <p className="text-muted-foreground max-w-md mx-auto mb-6">
          {type === 'upcoming'
            ? "You don't have any upcoming sessions scheduled. Book a session with your advisor to get career guidance."
            : "You haven't had any sessions with your advisor yet."}
        </p>
        {type === 'upcoming' && (
          <Link href="/student/advisor/sessions/book">
            <Button>
              <CalendarDays className="h-4 w-4 mr-2" />
              Book a Session
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
