'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useQuery } from 'convex/react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { ApplicationsJourney } from '@/components/ApplicationsJourney';
import { CareerGoalsSummary } from '@/components/CareerGoalsSummary';
import { CareerTimeline } from '@/components/CareerTimeline';
import { DashboardHeader } from '@/components/DashboardHeader';
import { InterviewsAndFollowUpsCard } from '@/components/InterviewsAndFollowUpsCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { OnboardingGuard } from '@/components/OnboardingGuard';
import { TodaysRecommendations } from '@/components/TodaysRecommendations';
import { UpcomingSection } from '@/components/UpcomingSection';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import {
  hasAdvisorAccess,
  hasPlatformAdminAccess,
  hasUniversityAdminAccess,
} from '@/lib/constants/roles';

export default function DashboardPage() {
  const { user: clerkUser, isLoaded } = useUser();
  const { user } = useAuth();
  const { impersonation, getEffectiveRole } = useImpersonation();
  const router = useRouter();

  // Get effective role (respects impersonation)
  const effectiveRole = getEffectiveRole();

  // Get real dashboard analytics from database - must be called before any returns
  const dashboardData = useQuery(
    api.analytics.getUserDashboardAnalytics,
    clerkUser?.id ? { clerkId: clerkUser.id } : 'skip',
  );

  // Redirect admin users immediately to prevent flash of dashboard content
  // Skip redirect if impersonating a non-admin role
  useEffect(() => {
    // If impersonating, don't redirect based on real role
    if (impersonation.isImpersonating) {
      // If impersonating university_admin, redirect to university dashboard
      if (effectiveRole === 'university_admin') {
        router.replace('/university');
        return;
      }
      // If impersonating super_admin, redirect to admin dashboard
      if (effectiveRole === 'super_admin') {
        router.replace('/admin');
        return;
      }
      // If impersonating advisor, redirect to advisor dashboard
      if (effectiveRole === 'advisor') {
        router.replace('/advisor');
        return;
      }
      // Otherwise stay on this page (student, individual, staff)
      return;
    }

    // Not impersonating - use real role
    if (user?.role === 'advisor') {
      router.replace('/advisor');
      return;
    }
    if (hasUniversityAdminAccess(user?.role) && user?.role !== 'super_admin') {
      router.replace('/university');
      return;
    }
    if (hasPlatformAdminAccess(user?.role)) {
      router.replace('/admin');
      return;
    }
  }, [user, router, impersonation.isImpersonating, effectiveRole]);

  if (!isLoaded) {
    return <LoadingSpinner />;
  }

  if (!clerkUser || !user) {
    return null;
  }

  // Prevent rendering for admin users while redirect is happening
  // But allow rendering if impersonating a non-admin role
  const shouldRedirectToAdmin = !impersonation.isImpersonating && hasAdvisorAccess(user?.role);

  if (shouldRedirectToAdmin) {
    let message = 'Redirecting to admin portal...';
    if (user?.role === 'advisor') {
      message = 'Redirecting to advisor dashboard...';
    } else if (user?.role === 'university_admin') {
      message = 'Redirecting to university dashboard...';
    }
    return <LoadingSpinner message={message} />;
  }

  // Show dashboard for students and individual users only
  const showStudentDashboard =
    effectiveRole === 'student' ||
    effectiveRole === 'individual' ||
    effectiveRole === 'user' ||
    user?.role === 'student' ||
    user?.role === 'individual' ||
    user?.role === 'user';

  // Use real data or fallback to default values
  const stats = {
    nextInterview: dashboardData?.nextInterview || 'No Interviews',
    activeApplications: dashboardData?.applicationStats?.total || 0,
    pendingTasks: dashboardData?.pendingTasks || 0,
    activeGoals: dashboardData?.activeGoals || 0,
    upcomingInterviews: dashboardData?.upcomingInterviews || 0,
    interviewRate: dashboardData?.interviewRate || 0,
    thisWeekActions: dashboardData?.thisWeek?.totalActions || 0,
    applicationsThisWeek: dashboardData?.thisWeek?.applicationsAdded || 0,
    overdueFollowups: dashboardData?.overdueFollowups || 0,
  };

  const fadeIn = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
  };

  const subtleUp = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
      },
    },
  };

  const cardAnimation = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
      },
    },
  };

  const staggeredContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1,
      },
    },
  };

  // Calculate nextInterviewDays from nextInterviewDetails (null if interview is in the past)
  const nextInterviewDays = dashboardData?.nextInterviewDetails?.date
    ? (() => {
        const days = Math.ceil(
          (dashboardData.nextInterviewDetails.date - Date.now()) / (1000 * 60 * 60 * 24),
        );
        return days >= 0 ? days : null;
      })()
    : null;

  return (
    <OnboardingGuard>
      <motion.div className="space-y-6" initial="hidden" animate="visible" variants={fadeIn}>
        {/* Row 1-3: Dashboard Header with Greeting, Stage Tabs, and Hero Card */}
        {showStudentDashboard && (
          <motion.div variants={subtleUp}>
            <DashboardHeader
              userName={user.name?.split(' ')[0]}
              thisWeekActions={stats.thisWeekActions}
              journeyProgress={dashboardData?.journeyProgress}
              resumeScore={
                dashboardData?.usageData?.usage?.resumes?.count
                  ? Math.min(dashboardData.usageData.usage.resumes.count * 16, 100)
                  : 16
              }
              activeApplications={stats.activeApplications}
              upcomingInterviews={stats.upcomingInterviews}
              nextInterviewDays={nextInterviewDays}
              careerPathsCount={dashboardData?.onboardingProgress?.userProfile?.skills?.length || 0}
              resumesCount={dashboardData?.usageData?.usage?.resumes?.count || 0}
              coverLettersCount={dashboardData?.usageData?.usage?.cover_letters?.count || 0}
              goalsCount={stats.activeGoals}
              skillsCount={dashboardData?.onboardingProgress?.userProfile?.skills?.length || 0}
            />
          </motion.div>
        )}

        {/* Row 3: Interviews & Follow-ups + Upcoming (2-column grid) */}
        <motion.div className="grid grid-cols-1 lg:grid-cols-3 gap-6" variants={staggeredContainer}>
          <motion.div variants={cardAnimation} className="lg:col-span-2">
            <InterviewsAndFollowUpsCard />
          </motion.div>

          <motion.div variants={cardAnimation}>
            <UpcomingSection />
          </motion.div>
        </motion.div>

        {/* Row 4: Applications Journey */}
        <motion.div variants={cardAnimation}>
          <ApplicationsJourney />
        </motion.div>

        {/* Row 5: Goals Summary + Smart Recommendations (2-column grid) */}
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch"
          variants={staggeredContainer}
        >
          <motion.div variants={cardAnimation} className="h-full">
            <CareerGoalsSummary />
          </motion.div>

          <motion.div variants={cardAnimation} id="recommendations" className="h-full">
            <TodaysRecommendations />
          </motion.div>
        </motion.div>

        {/* Row 6: Career Timeline */}
        <motion.div variants={cardAnimation}>
          <CareerTimeline />
        </motion.div>
      </motion.div>
    </OnboardingGuard>
  );
}
