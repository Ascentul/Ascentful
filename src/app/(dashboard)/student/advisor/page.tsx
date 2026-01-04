'use client';

/**
 * Student Advisor Hub - Main Overview Page
 *
 * Central hub for university students to access all advisor collaboration features:
 * - View assigned advisor
 * - See upcoming sessions
 * - Check pending reviews
 * - Track action items
 * - Message advisor
 *
 * Protected by StudentUniversityGate component.
 */

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useQuery } from 'convex/react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  Loader2,
  MessageSquare,
  Target,
  User,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';

import { StudentUniversityGate } from '@/components/StudentUniversityGate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function StudentAdvisorHubPage() {
  return (
    <StudentUniversityGate>
      <StudentAdvisorHubContent />
    </StudentUniversityGate>
  );
}

function StudentAdvisorHubContent() {
  const { user } = useUser();
  const clerkId = user?.id;

  // Fetch hub overview data
  const hubOverview = useQuery(
    api.student_advisor_hub.getHubOverview,
    clerkId ? { clerkId } : 'skip',
  );

  const isLoading = hubOverview === undefined;

  // Format next session display
  const formatNextSession = () => {
    if (!hubOverview?.nextSession) return 'Not scheduled';
    const date = new Date(hubOverview.nextSession.startAt);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="w-full gradient-border-bottom p-5 space-y-6 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Advisor Hub</h1>
            <p className="text-muted-foreground mt-1">
              Connect with your career advisor and track your progress
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <SummaryCard
            label="Next Session"
            value={formatNextSession()}
            icon={Calendar}
            variant={hubOverview?.nextSession ? 'success' : 'default'}
            href="/student/advisor/sessions"
          />
          <SummaryCard
            label="Pending Reviews"
            value={hubOverview?.pendingReviews ?? 0}
            icon={FileText}
            variant={hubOverview?.pendingReviews ? 'warning' : 'default'}
            href="/student/advisor/reviews"
          />
          <SummaryCard
            label="Action Items"
            value={hubOverview?.openActionItems ?? 0}
            icon={Target}
            variant={hubOverview?.openActionItems ? 'warning' : 'default'}
            href="/student/advisor/actions"
          />
          <SummaryCard
            label="Messages"
            value={hubOverview?.unreadMessages ?? 0}
            icon={MessageSquare}
            variant={hubOverview?.unreadMessages ? 'warning' : 'default'}
            href="/student/advisor/messages"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: Advisor Card */}
          <div className="lg:col-span-1">
            <AdvisorInfoCard advisor={hubOverview?.advisor ?? null} />
          </div>

          {/* Right: Quick Actions */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
                <CardDescription>Get started with your advisor collaboration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <QuickActionRow
                  icon={Calendar}
                  title="Book a Session"
                  description="Schedule time with your advisor"
                  href="/student/advisor/sessions/book"
                  buttonLabel="Book Now"
                  disabled={!hubOverview?.advisor}
                />
                <QuickActionRow
                  icon={FileText}
                  title="Request a Review"
                  description="Get feedback on your resume or cover letter"
                  href="/student/advisor/reviews/new"
                  buttonLabel="Submit"
                  disabled={!hubOverview?.advisor}
                />
                <QuickActionRow
                  icon={MessageSquare}
                  title="Send a Message"
                  description="Ask a quick question or share an update"
                  href="/student/advisor/messages"
                  buttonLabel="Message"
                  disabled={!hubOverview?.advisor}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Coming Soon Notice - Only show when no advisor assigned */}
        {!hubOverview?.advisor && (
          <Card className="border-dashed border-2 bg-muted/30">
            <CardContent className="py-8 text-center">
              <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Connect with Your Advisor</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Once you're assigned an advisor, you'll be able to book sessions, request document
                reviews, and message directly from this hub.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Summary Card Component
// ============================================================================

interface SummaryCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  variant: 'default' | 'success' | 'warning' | 'danger';
  href?: string;
}

function SummaryCard({ label, value, icon: Icon, variant, href }: SummaryCardProps) {
  const variantClasses = {
    default: 'border-slate-200',
    success: 'border-emerald-200 bg-emerald-50',
    warning: 'border-orange-200 bg-orange-50',
    danger: 'border-red-200 bg-red-50',
  };

  const content = (
    <Card className={`cursor-pointer hover:shadow-md transition-shadow ${variantClasses[variant]}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
            <Icon className="h-5 w-5 text-slate-600" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

// ============================================================================
// Advisor Info Card Component
// ============================================================================

interface AdvisorInfoCardProps {
  advisor: {
    advisorId: string;
    advisorName: string;
    advisorEmail: string;
    advisorTitle?: string;
    hasAvailability: boolean;
  } | null;
}

function AdvisorInfoCard({ advisor }: AdvisorInfoCardProps) {
  if (!advisor) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            Your Advisor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <User className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-muted-foreground mb-4">No advisor assigned yet</p>
            <p className="text-sm text-muted-foreground">
              Contact your university career center to get connected with an advisor.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <User className="h-5 w-5" />
          Your Advisor
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center">
            <User className="h-6 w-6 text-primary-600" />
          </div>
          <div>
            <p className="font-semibold">{advisor.advisorName}</p>
            <p className="text-sm text-muted-foreground">
              {advisor.advisorTitle || 'Career Advisor'}
            </p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MessageSquare className="h-4 w-4" />
            <span>{advisor.advisorEmail}</span>
          </div>
          {advisor.hasAvailability ? (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-muted-foreground">Available for sessions</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <XCircle className="h-4 w-4 text-slate-400" />
              <span className="text-muted-foreground">No availability set</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Quick Action Row Component
// ============================================================================

interface QuickActionRowProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: string;
  buttonLabel: string;
  disabled?: boolean;
}

function QuickActionRow({
  icon: Icon,
  title,
  description,
  href,
  buttonLabel,
  disabled,
}: QuickActionRowProps) {
  return (
    <div
      className={`flex items-center justify-between gap-4 p-4 rounded-lg border transition-colors ${
        disabled ? 'bg-slate-50 opacity-60' : 'bg-white hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`h-10 w-10 rounded-lg flex items-center justify-center ${
            disabled ? 'bg-slate-100' : 'bg-primary-100'
          }`}
        >
          <Icon className={`h-5 w-5 ${disabled ? 'text-slate-400' : 'text-primary-600'}`} />
        </div>
        <div>
          <p className={`font-medium ${disabled ? 'text-muted-foreground' : ''}`}>{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {disabled ? (
        <Button variant="outline" size="sm" disabled>
          {buttonLabel}
        </Button>
      ) : (
        <Link href={href}>
          <Button variant="outline" size="sm">
            {buttonLabel}
          </Button>
        </Link>
      )}
    </div>
  );
}
