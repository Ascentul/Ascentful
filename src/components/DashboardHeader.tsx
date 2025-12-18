'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Calendar,
  Check,
  ClipboardList,
  Compass,
  FileText,
  GraduationCap,
  Lightbulb,
  Mail,
  Send,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

type StageId =
  | 'career-exploration'
  | 'resume-building'
  | 'job-search'
  | 'interview-prep'
  | 'learning';

interface SubTask {
  id: string;
  label: string;
  icon: LucideIcon;
  getProgress: (metrics: StageMetrics) => { value: number; max?: number; percentage?: number };
}

interface HeroContent {
  chipLabel: string;
  headline: string;
  description: string;
  ctaText: string;
  ctaHref: string;
}

interface StageConfig {
  id: StageId;
  label: string;
  icon: LucideIcon;
  subtasks: SubTask[];
  hero: HeroContent | ((metrics: StageMetrics) => HeroContent);
  stat: {
    label: string;
    getValue: (metrics: StageMetrics) => string | number;
    suffix?: string;
  };
}

interface StageMetrics {
  // Career exploration
  careerPathsExplored: number;
  directionsChosen: number;
  targetCompanies: number;
  goalsCreated: number;
  pathClarity: number;
  // Resume building
  resumeScore: number;
  resumesCreated: number;
  resumesTailored: number;
  coverLettersCreated: number;
  hasAnyResume: boolean;
  hasAiTailoredResume: boolean;
  hasAnyCoverLetter: boolean;
  firstResumeId: string | null;
  // Job search
  rolesSaved: number;
  applicationsSubmitted: number;
  interviewsLogged: number;
  followUpsCompleted: number;
  activeApplications: number;
  // Interview prep
  questionsAnswered: number;
  storiesPrepared: number;
  mockInterviewsScheduled: number;
  nextInterviewDays: number | null;
  // Learning
  skillsAdded: number;
  modulesCompleted: number;
  reflectionsLogged: number;
  skillsInProgress: number;
}

interface JourneyProgress {
  careerExploration: { isComplete: boolean; count: number };
  resumeBuilding: { isComplete: boolean; count: number };
  jobSearch: { isComplete: boolean; count: number };
  advising: { isComplete: boolean; count: number; completedCount?: number };
  completedSteps: number;
  totalSteps: number;
}

interface DashboardHeaderProps {
  userName?: string;
  thisWeekActions: number;
  journeyProgress?: JourneyProgress;
  // Metrics for stats and progress
  resumeScore?: number;
  activeApplications?: number;
  upcomingInterviews?: number;
  nextInterviewDays?: number | null;
  careerPathsCount?: number;
  resumesCount?: number;
  coverLettersCount?: number;
  goalsCount?: number;
  skillsCount?: number;
  // Resume building progress
  hasAnyResume?: boolean;
  hasAiTailoredResume?: boolean;
  firstResumeId?: string | null;
  hasAnyCoverLetter?: boolean;
}

// =============================================================================
// Stage Configuration
// =============================================================================

const stageConfigs: StageConfig[] = [
  {
    id: 'career-exploration',
    label: 'Career Exploration',
    icon: Compass,
    subtasks: [
      {
        id: 'discover-paths',
        label: 'Discover paths',
        icon: Compass,
        getProgress: (m) => ({
          value: m.careerPathsExplored,
          percentage: Math.min(m.careerPathsExplored * 25, 100),
        }),
      },
      {
        id: 'choose-direction',
        label: 'Choose a direction',
        icon: Target,
        getProgress: (m) => ({
          value: m.directionsChosen,
          percentage: m.directionsChosen > 0 ? 100 : 0,
        }),
      },
      {
        id: 'create-goal',
        label: 'Create your first career goal',
        icon: Lightbulb,
        getProgress: (m) => ({ value: m.goalsCreated, percentage: m.goalsCreated > 0 ? 100 : 0 }),
      },
      {
        id: 'target-companies',
        label: 'Add one target company list',
        icon: Briefcase,
        getProgress: (m) => ({
          value: m.targetCompanies,
          percentage: m.targetCompanies > 0 ? 100 : 0,
        }),
      },
    ],
    hero: {
      chipLabel: 'Career exploration',
      headline: 'Find 3 roles that fit you in 5 minutes',
      description: 'Discover career paths aligned with your interests, skills, and goals.',
      ctaText: 'Explore careers',
      ctaHref: '/career-explorer',
    },
    stat: {
      label: 'Path clarity',
      getValue: (m) => `${m.pathClarity}%`,
    },
  },
  {
    id: 'resume-building',
    label: 'Resume Building',
    icon: FileText,
    subtasks: [
      {
        id: 'resume-building',
        label: 'Resume Building',
        icon: FileText,
        getProgress: (m) => ({
          value: m.hasAnyResume ? 1 : 0,
          percentage: m.hasAnyResume ? 100 : 0,
        }),
      },
      {
        id: 'resume-tailoring',
        label: 'Resume Tailoring',
        icon: ClipboardList,
        getProgress: (m) => ({
          value: m.hasAiTailoredResume ? 1 : 0,
          percentage: m.hasAiTailoredResume ? 100 : 0,
        }),
      },
      {
        id: 'cover-letter',
        label: 'Cover Letter Crafting',
        icon: Mail,
        getProgress: (m) => ({
          value: m.hasAnyCoverLetter ? 1 : 0,
          percentage: m.hasAnyCoverLetter ? 100 : 0,
        }),
      },
    ],
    hero: (m: StageMetrics): HeroContent => {
      // Determine the next action based on progress
      if (!m.hasAnyResume) {
        // No resume yet - prompt to create one
        return {
          chipLabel: 'Resume building',
          headline: 'Create your first resume',
          description:
            'Build a professional resume that highlights your skills and experience. Our AI-powered tools make it easy.',
          ctaText: 'Create resume',
          ctaHref: '/resume-studio',
        };
      } else if (!m.hasAiTailoredResume) {
        // Has resume but not tailored - prompt to tailor it
        const editHref = m.firstResumeId
          ? `/resume-studio?resumeId=${m.firstResumeId}`
          : '/resume-studio';
        return {
          chipLabel: 'Resume building',
          headline: 'Tailor your resume for a job',
          description:
            'Use AI to optimize your resume for specific job descriptions. Tailored resumes get more interviews.',
          ctaText: 'Tailor resume',
          ctaHref: editHref,
        };
      } else if (!m.hasAnyCoverLetter) {
        // Has tailored resume but no cover letter - prompt to create one
        return {
          chipLabel: 'Resume building',
          headline: 'Add a cover letter',
          description:
            'Complete your application package with a compelling cover letter that tells your story.',
          ctaText: 'Create cover letter',
          ctaHref: '/resume-studio?tab=cover-letters',
        };
      } else {
        // All done - encourage maintaining/updating
        const editHref = m.firstResumeId
          ? `/resume-studio?resumeId=${m.firstResumeId}`
          : '/resume-studio';
        return {
          chipLabel: 'Resume building',
          headline: 'Keep your resume updated',
          description:
            'Great job! You have a complete resume and cover letter. Keep them updated as you gain new experiences.',
          ctaText: 'Edit resume',
          ctaHref: editHref,
        };
      }
    },
    stat: {
      label: 'Completed',
      getValue: (m) => {
        const completed = [m.hasAnyResume, m.hasAiTailoredResume, m.hasAnyCoverLetter].filter(
          Boolean,
        ).length;
        return `${completed}/3`;
      },
    },
  },
  {
    id: 'job-search',
    label: 'Job Search',
    icon: Briefcase,
    subtasks: [
      {
        id: 'save-roles',
        label: 'Save roles',
        icon: Briefcase,
        getProgress: (m) => ({ value: m.rolesSaved, percentage: Math.min(m.rolesSaved * 10, 100) }),
      },
      {
        id: 'apply-roles',
        label: 'Apply to roles',
        icon: Send,
        getProgress: (m) => ({
          value: m.applicationsSubmitted,
          percentage: Math.min(m.applicationsSubmitted * 10, 100),
        }),
      },
      {
        id: 'log-interviews',
        label: 'Log interviews',
        icon: Calendar,
        getProgress: (m) => ({
          value: m.interviewsLogged,
          percentage: Math.min(m.interviewsLogged * 25, 100),
        }),
      },
      {
        id: 'follow-up',
        label: 'Follow up',
        icon: Mail,
        getProgress: (m) => ({
          value: m.followUpsCompleted,
          percentage: Math.min(m.followUpsCompleted * 25, 100),
        }),
      },
    ],
    hero: {
      chipLabel: 'Job search',
      headline: 'Apply to a great role this week',
      description: 'Track your applications and stay organized throughout your job search journey.',
      ctaText: 'View roles to apply',
      ctaHref: '/applications',
    },
    stat: {
      label: 'Active applications',
      getValue: (m) => m.activeApplications,
    },
  },
  {
    id: 'interview-prep',
    label: 'Interview Prep',
    icon: GraduationCap,
    subtasks: [
      {
        id: 'practice-questions',
        label: 'Practice common questions',
        icon: Lightbulb,
        getProgress: (m) => ({
          value: m.questionsAnswered,
          percentage: Math.min(m.questionsAnswered * 10, 100),
        }),
      },
      {
        id: 'prepare-stories',
        label: 'Prepare stories',
        icon: BookOpen,
        getProgress: (m) => ({
          value: m.storiesPrepared,
          percentage: Math.min(m.storiesPrepared * 20, 100),
        }),
      },
      {
        id: 'mock-interview',
        label: 'Schedule a mock interview',
        icon: Users,
        getProgress: (m) => ({
          value: m.mockInterviewsScheduled,
          percentage: m.mockInterviewsScheduled > 0 ? 100 : 0,
        }),
      },
    ],
    hero: {
      chipLabel: 'Interview prep',
      headline: 'Get ready for your next interview',
      description: 'Practice makes perfect. Prepare your stories and ace your interviews.',
      ctaText: 'Start interview practice',
      ctaHref: '/interview-practice',
    },
    stat: {
      label: 'Next interview',
      getValue: (m) =>
        m.nextInterviewDays !== null ? `in ${m.nextInterviewDays} days` : 'None scheduled',
    },
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

function getInitialStageIndex(progress?: JourneyProgress, hasResume?: boolean): number {
  if (!progress) {
    return hasResume ? 1 : 0;
  }

  if (!progress.careerExploration.isComplete) return 0;
  if (!progress.resumeBuilding.isComplete) return 1;
  if (!progress.jobSearch.isComplete) return 2;
  // Default to interview prep or learning based on job search completion
  return 3;
}

function getStageCompletion(stageId: StageId, progress?: JourneyProgress): boolean {
  if (!progress) return false;

  switch (stageId) {
    case 'career-exploration':
      return progress.careerExploration.isComplete;
    case 'resume-building':
      return progress.resumeBuilding.isComplete;
    case 'job-search':
      return progress.jobSearch.isComplete;
    case 'interview-prep':
      return progress.advising?.completedCount ? progress.advising.completedCount > 0 : false;
    case 'learning':
      return false; // Learning is never "complete"
    default:
      return false;
  }
}

// =============================================================================
// Sub-components
// =============================================================================

function StageTabs({
  stages,
  activeStage,
  onSelectStage,
  journeyProgress,
}: {
  stages: StageConfig[];
  activeStage: number;
  onSelectStage: (index: number) => void;
  journeyProgress?: JourneyProgress;
}) {
  return (
    <div className="flex items-center justify-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {stages.map((stage, index) => {
        const isActive = activeStage === index;
        const isComplete = getStageCompletion(stage.id, journeyProgress);
        const Icon = stage.icon;

        return (
          <div key={stage.id} className="flex items-center">
            <button
              onClick={() => onSelectStage(index)}
              className={cn(
                'relative flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap sm:w-44 border',
                isActive
                  ? 'bg-primary-100 text-primary-700 border-primary-200 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300',
              )}
            >
              {isComplete && !isActive ? (
                <Check className="h-4 w-4 flex-shrink-0" />
              ) : (
                <Icon className="h-4 w-4 flex-shrink-0" />
              )}
              <span className="hidden sm:inline">{stage.label}</span>
            </button>

            {/* Separator between tabs */}
            {index < stages.length - 1 && (
              <div className="hidden sm:flex items-center px-1.5">
                <div className="w-6 h-0.5 rounded-full bg-slate-200" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ProgressPanel({ subtasks, metrics }: { subtasks: SubTask[]; metrics: StageMetrics }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm h-full">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
        Progress
      </h3>

      <div className="space-y-4">
        {subtasks.map((task) => {
          const progress = task.getProgress(metrics);
          const Icon = task.icon;
          const displayValue =
            progress.percentage !== undefined ? `${progress.percentage}%` : progress.value;

          return (
            <div key={task.id} className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                  <Icon className="h-4 w-4 text-slate-600" />
                </div>
                <span className="flex-1 text-sm font-medium text-slate-700">{task.label}</span>
                <span className="text-sm font-semibold text-slate-900">{displayValue}</span>
              </div>
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden ml-11">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress.percentage ?? 0}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StageHeroPanel({ stage, metrics }: { stage: StageConfig; metrics: StageMetrics }) {
  const statValue = stage.stat.getValue(metrics);
  // Resolve hero content - either static object or dynamic function
  const hero = typeof stage.hero === 'function' ? stage.hero(metrics) : stage.hero;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-6 h-full flex flex-col">
      {/* Background decoration */}
      <div className="absolute right-0 top-0 -mr-16 -mt-16 h-48 w-48 rounded-full bg-gradient-to-br from-primary-100/20 to-transparent blur-3xl" />

      <div className="relative flex-1 flex flex-col lg:flex-row gap-6">
        {/* Left content */}
        <div className="flex-1 flex flex-col justify-center">
          {/* Stage chip */}
          <span className="inline-flex self-start items-center rounded-full bg-primary-100 px-3 py-1 text-xs font-medium text-primary-700 mb-3">
            {hero.chipLabel}
          </span>

          {/* Headline */}
          <h2 className="text-xl lg:text-2xl font-bold text-slate-900 mb-2">{hero.headline}</h2>

          {/* Description */}
          <p className="text-sm text-slate-600 mb-5 max-w-md">{hero.description}</p>

          {/* CTA */}
          <Link
            href={hero.ctaHref}
            className="inline-flex self-start items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-slate-800 hover:shadow-lg"
          >
            {hero.ctaText}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Right stat badge */}
        <div className="flex items-center justify-center lg:justify-end">
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm border border-slate-200/50 px-6 py-4 shadow-sm">
            <span className="text-2xl lg:text-3xl font-bold text-primary-600">{statValue}</span>
            <span className="text-xs font-medium text-slate-500 mt-1">{stage.stat.label}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function DashboardHeader({
  userName,
  thisWeekActions,
  journeyProgress,
  resumeScore = 16,
  activeApplications = 0,
  upcomingInterviews = 0,
  nextInterviewDays = null,
  careerPathsCount = 0,
  resumesCount = 0,
  coverLettersCount = 0,
  goalsCount = 0,
  skillsCount = 0,
  hasAnyResume = false,
  hasAiTailoredResume = false,
  firstResumeId = null,
  hasAnyCoverLetter = false,
}: DashboardHeaderProps) {
  const initialIndex = getInitialStageIndex(journeyProgress, resumesCount > 0);
  const [activeStage, setActiveStage] = useState(initialIndex);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Update active stage when journey progress changes (if user hasn't interacted)
  useEffect(() => {
    if (!hasInteracted) {
      setActiveStage(getInitialStageIndex(journeyProgress, resumesCount > 0));
    }
  }, [journeyProgress, resumesCount, hasInteracted]);

  const currentStage = stageConfigs[activeStage];

  // Build metrics object from props
  const metrics: StageMetrics = {
    // Career exploration
    careerPathsExplored: careerPathsCount,
    directionsChosen: careerPathsCount > 0 ? 1 : 0,
    targetCompanies: 0, // TODO: wire up
    goalsCreated: goalsCount,
    pathClarity: Math.min(careerPathsCount * 20 + goalsCount * 10, 100),
    // Resume building
    resumeScore,
    resumesCreated: resumesCount,
    resumesTailored: hasAiTailoredResume ? 1 : 0,
    coverLettersCreated: coverLettersCount,
    hasAnyResume,
    hasAiTailoredResume,
    hasAnyCoverLetter,
    firstResumeId,
    // Job search
    rolesSaved: activeApplications,
    applicationsSubmitted: activeApplications,
    interviewsLogged: upcomingInterviews,
    followUpsCompleted: 0, // TODO: wire up
    activeApplications,
    // Interview prep
    questionsAnswered: 0, // TODO: wire up
    storiesPrepared: 0, // TODO: wire up
    mockInterviewsScheduled: 0, // TODO: wire up
    nextInterviewDays,
    // Learning
    skillsAdded: skillsCount,
    modulesCompleted: 0, // TODO: wire up
    reflectionsLogged: 0, // TODO: wire up
    skillsInProgress: skillsCount,
  };

  const handleSelectStage = (index: number) => {
    setActiveStage(index);
    setHasInteracted(true);
  };

  return (
    <div className="space-y-5">
      {/* Row 1: Greeting */}
      <div className="flex flex-col sm:relative items-center sm:items-stretch gap-2 sm:gap-0">
        <span className="sm:absolute right-0 top-0 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-primary-600">
          <TrendingUp className="h-3.5 w-3.5" />
          This week: {thisWeekActions} action{thisWeekActions !== 1 ? 's' : ''}
        </span>
        <div className="text-center sm:pt-1 sm:px-40">
          <h1 className="text-2xl font-bold text-slate-900">Hi {userName || 'there'}!</h1>
          <p className="text-base text-slate-500 mt-0.5 mb-4">What&apos;s your goal today?</p>
        </div>
      </div>

      {/* Row 2: Stage Tabs */}
      <StageTabs
        stages={stageConfigs}
        activeStage={activeStage}
        onSelectStage={handleSelectStage}
        journeyProgress={journeyProgress}
      />

      {/* Row 3: Two-column Hero Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeStage}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        >
          {/* Left: Progress Panel */}
          <div className="lg:col-span-1">
            <ProgressPanel subtasks={currentStage.subtasks} metrics={metrics} />
          </div>

          {/* Right: Stage Hero Panel */}
          <div className="lg:col-span-2">
            <StageHeroPanel stage={currentStage} metrics={metrics} />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
