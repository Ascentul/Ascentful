'use client';

/**
 * Advisor Today Dashboard - Daily Cockpit
 *
 * Redesigned to answer three questions:
 * 1. What is on my calendar today?
 * 2. What follow-ups and tasks must I complete today (or are overdue)?
 * 3. What's coming in the near future so I can prepare?
 *
 * Layout:
 * - Header with date and quick actions
 * - Clickable metric cards
 * - Two-column layout: Schedule (left) | Panels (right)
 */

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { format } from 'date-fns';
import { AlertCircle, Calendar, CheckCircle2, Clock, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { AdvisorGate } from '@/components/advisor/AdvisorGate';
import { AddActionModal } from '@/components/advisor/student-profile/AddActionModal';
// New components
import {
  ComingUpPanel,
  DocumentationPanel,
  EnhancedSessionCard,
  FollowUpPanel,
  MetricCard,
  SnoozeDialog,
} from '@/components/advisor/today';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export function AdvisorTodayDashboard() {
  const { user } = useUser();
  const clerkId = user?.id;
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  // Determine route prefix based on current path context
  // Component can be rendered at /u/home or /advisor/advising/today
  const routePrefix = pathname?.startsWith('/u') ? '/u' : '/advisor';

  // State for follow-up tab
  const [followUpTab, setFollowUpTab] = useState<'overdue' | 'today' | 'upcoming'>('today');

  // State for snooze dialog
  const [snoozeDialogOpen, setSnoozeDialogOpen] = useState(false);
  const [snoozeFollowUpId, setSnoozeFollowUpId] = useState<Id<'follow_ups'> | null>(null);
  const [snoozeFollowUpTitle, setSnoozeFollowUpTitle] = useState<string | undefined>(undefined);

  // State for add follow-up modal
  const [addFollowUpOpen, setAddFollowUpOpen] = useState(false);
  const [addFollowUpStudentId, setAddFollowUpStudentId] = useState<Id<'users'> | null>(null);
  const [addFollowUpPrefillTitle, setAddFollowUpPrefillTitle] = useState<string | undefined>(
    undefined,
  );

  // Refs for scroll targets
  const scheduleRef = useRef<HTMLDivElement>(null);
  const followUpsRef = useRef<HTMLDivElement>(null);

  // Get user's timezone offset for accurate "today" calculation
  const timezoneOffset = new Date().getTimezoneOffset();

  // Use V2 query for enhanced data
  const todayData = useQuery(
    api.advisor_today.getTodayOverviewV2,
    clerkId ? { clerkId, timezoneOffset } : 'skip',
  );

  const updateFollowup = useMutation(api.followups.updateFollowup);

  const isLoading = todayData === undefined;

  // Scroll helper
  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Metric card click handlers
  const handleTotalClick = () => {
    scrollToSection(scheduleRef);
  };

  const handleCompletedClick = () => {
    scrollToSection(scheduleRef);
    // Could add filter state for completed sessions
  };

  const handleUpcomingClick = () => {
    scrollToSection(scheduleRef);
    // Could add filter state for upcoming sessions
  };

  const handleOverdueClick = () => {
    setFollowUpTab('overdue');
    scrollToSection(followUpsRef);
  };

  // Follow-up actions
  const handleCompleteFollowUp = async (followUpId: Id<'follow_ups'>) => {
    if (!clerkId) return;

    try {
      await updateFollowup({ followupId: followUpId, updates: { status: 'done' } });
      toast({ title: 'Follow-up marked as complete' });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to complete follow-up',
        variant: 'destructive',
      });
    }
  };

  const handleSnoozeFollowUp = (followUpId: Id<'follow_ups'>, title?: string) => {
    // Title is passed directly from the caller to avoid accessing followUps before definition
    setSnoozeFollowUpId(followUpId);
    setSnoozeFollowUpTitle(title);
    setSnoozeDialogOpen(true);
  };

  const handleSnoozeConfirm = async (followUpId: Id<'follow_ups'>, newDate: number) => {
    if (!clerkId) return;

    try {
      await updateFollowup({ followupId: followUpId, updates: { due_at: newDate } });
      toast({ title: 'Follow-up snoozed successfully' });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to snooze follow-up',
        variant: 'destructive',
      });
      throw error; // Re-throw so dialog knows to stay open
    }
  };

  // Session quick actions
  const handleAddNote = (sessionId: Id<'advisor_sessions'>) => {
    router.push(`${routePrefix}/advising/sessions/${sessionId}?edit=notes`);
  };

  const handleAddFollowUp = (studentId: Id<'users'>, sessionTitle?: string) => {
    setAddFollowUpStudentId(studentId);
    setAddFollowUpPrefillTitle(sessionTitle ? `Follow-up: ${sessionTitle}` : undefined);
    setAddFollowUpOpen(true);
  };

  const handleFollowUpSuccess = () => {
    setAddFollowUpOpen(false);
    setAddFollowUpStudentId(null);
    setAddFollowUpPrefillTitle(undefined);
    toast({ title: 'Follow-up created successfully' });
  };

  // Default empty data for loading states
  const stats = todayData?.stats ?? {
    totalSessions: 0,
    completedSessions: 0,
    upcomingSessions: 0,
    overdueFollowUps: 0,
  };

  const followUps = todayData?.followUps ?? {
    overdue: [],
    today: [],
    upcoming: [],
  };

  return (
    <AdvisorGate requiredFlag="advisor.advising">
      <div className="w-full">
        <div className="w-full gradient-border-bottom p-5 space-y-6 shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Today</h1>
              <p className="text-muted-foreground mt-1">
                {format(new Date(), 'EEEE, MMMM d, yyyy')}
              </p>
            </div>
            <div className="flex gap-2">
              <Link href={`${routePrefix}/advising/sessions?action=new`}>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule Session
                </Button>
              </Link>
              <Link href={`${routePrefix}/advising/calendar`}>
                <Button variant="outline">
                  <Calendar className="h-4 w-4 mr-2" />
                  View Calendar
                </Button>
              </Link>
            </div>
          </div>

          {/* Clickable Metric Cards */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <MetricCard
              label="Total Sessions"
              value={stats.totalSessions}
              icon={Calendar}
              variant="default"
              onClick={handleTotalClick}
              isLoading={isLoading}
            />
            <MetricCard
              label="Completed"
              value={stats.completedSessions}
              icon={CheckCircle2}
              variant="success"
              onClick={handleCompletedClick}
              isLoading={isLoading}
            />
            <MetricCard
              label="Upcoming"
              value={stats.upcomingSessions}
              icon={Clock}
              variant="default"
              onClick={handleUpcomingClick}
              isLoading={isLoading}
            />
            <MetricCard
              label="Overdue Follow-ups"
              value={stats.overdueFollowUps}
              icon={AlertCircle}
              variant={stats.overdueFollowUps > 0 ? 'danger' : 'default'}
              onClick={handleOverdueClick}
              isLoading={isLoading}
            />
          </div>

          {/* Two-Column Layout */}
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Left Column: Today's Schedule (wider) */}
            <div className="lg:col-span-3 space-y-4" ref={scheduleRef}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Today's Schedule
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-32 bg-slate-100 rounded-lg animate-pulse" />
                      ))}
                    </div>
                  ) : !todayData?.sessions || todayData.sessions.length === 0 ? (
                    <div className="border rounded-lg p-12 text-center">
                      <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">No sessions scheduled for today</p>
                      <Link href={`${routePrefix}/advising/sessions?action=new`}>
                        <Button variant="outline" size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Schedule Session
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {todayData.sessions.map((session) => (
                        <EnhancedSessionCard
                          key={session._id}
                          session={session}
                          onAddNote={handleAddNote}
                          onAddFollowUp={handleAddFollowUp}
                          routePrefix={routePrefix}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Panels */}
            <div className="lg:col-span-2 space-y-4">
              {/* Follow-ups Panel */}
              <div ref={followUpsRef}>
                <FollowUpPanel
                  followUps={followUps}
                  activeTab={followUpTab}
                  onTabChange={setFollowUpTab}
                  onComplete={handleCompleteFollowUp}
                  onSnooze={handleSnoozeFollowUp}
                  isLoading={isLoading}
                  routePrefix={routePrefix}
                />
              </div>

              {/* Coming Up Panel */}
              <ComingUpPanel
                days={todayData?.comingUp ?? []}
                isLoading={isLoading}
                routePrefix={routePrefix}
              />

              {/* Documentation Panel */}
              <DocumentationPanel
                sessions={todayData?.documentation ?? []}
                onAddNote={handleAddNote}
                isLoading={isLoading}
              />
            </div>
          </div>
        </div>

        {/* Snooze Dialog */}
        <SnoozeDialog
          open={snoozeDialogOpen}
          onOpenChange={setSnoozeDialogOpen}
          followUpId={snoozeFollowUpId}
          followUpTitle={snoozeFollowUpTitle}
          onSnooze={handleSnoozeConfirm}
        />

        {/* Add Follow-up Modal */}
        {addFollowUpStudentId && (
          <AddActionModal
            open={addFollowUpOpen}
            onOpenChange={setAddFollowUpOpen}
            studentId={addFollowUpStudentId}
            prefillTitle={addFollowUpPrefillTitle}
            onSuccess={handleFollowUpSuccess}
          />
        )}
      </div>
    </AdvisorGate>
  );
}
