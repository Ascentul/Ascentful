'use client';

import { AlertCircle, CheckCircle, Loader2, Sparkles, TrendingUp, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { ResumeData } from '@/components/resume/ResumeDocument';
import { cn } from '@/lib/utils';

// Shorter delay in development for faster iteration
const ANALYSIS_DELAY_MS = process.env.NODE_ENV === 'development' ? 200 : 1000;

export interface QuickWinItem {
  id: string;
  type: 'metric' | 'verb' | 'length' | 'keyword' | 'structure';
  severity: 'high' | 'medium' | 'low';
  count: number;
  message: string;
}

export interface QuickWinsAnalysis {
  currentScore: number;
  potentialScore: number;
  quickWins: QuickWinItem[];
  loading: boolean;
  error?: string;
}

interface QuickWinsPreviewStepProps {
  resumeContent: ResumeData | null;
  startSource: 'profile' | 'upload' | 'blank';
  onViewSuggestions?: () => void;
  jobDescription?: string;
}

// Analyze resume content and generate quick wins
function analyzeResumeContent(
  content: ResumeData | null,
  jd?: string,
): Omit<QuickWinsAnalysis, 'loading'> {
  if (!content) {
    return {
      currentScore: 0,
      potentialScore: 0,
      quickWins: [],
    };
  }

  const quickWins: QuickWinItem[] = [];
  let currentScore = 50; // Base score

  // Analyze experience bullets for metrics
  const allBullets: string[] = [];
  (content.experience || []).forEach((exp) => {
    if (exp.description) {
      const bullets = exp.description.split('\n').filter((b) => b.trim());
      allBullets.push(...bullets);
    }
  });

  // Check for bullets without metrics
  const bulletsWithoutMetrics = allBullets.filter((bullet) => {
    const hasNumber = /\d+/.test(bullet);
    const hasPercent = /%/.test(bullet);
    const hasDollar = /\$/.test(bullet);
    return !hasNumber && !hasPercent && !hasDollar;
  });

  if (bulletsWithoutMetrics.length > 0) {
    quickWins.push({
      id: 'add-metrics',
      type: 'metric',
      severity: 'high',
      count: bulletsWithoutMetrics.length,
      message: `Add metrics to ${bulletsWithoutMetrics.length} bullet${bulletsWithoutMetrics.length > 1 ? 's' : ''}`,
    });
    currentScore += bulletsWithoutMetrics.length > 3 ? 0 : 5;
  }

  // Check for weak action verbs
  const weakVerbs = ['helped', 'assisted', 'worked on', 'was responsible for', 'participated in'];
  const bulletsWithWeakVerbs = allBullets.filter((bullet) =>
    weakVerbs.some((verb) => bullet.toLowerCase().startsWith(verb)),
  );

  if (bulletsWithWeakVerbs.length > 0) {
    quickWins.push({
      id: 'strengthen-verbs',
      type: 'verb',
      severity: 'medium',
      count: bulletsWithWeakVerbs.length,
      message: `Strengthen ${bulletsWithWeakVerbs.length} weak verb${bulletsWithWeakVerbs.length > 1 ? 's' : ''}`,
    });
    currentScore += bulletsWithWeakVerbs.length > 4 ? 0 : 3;
  }

  // Check for long bullets (over 150 chars)
  const longBullets = allBullets.filter((bullet) => bullet.length > 150);

  if (longBullets.length > 0) {
    quickWins.push({
      id: 'shorten-bullets',
      type: 'length',
      severity: 'low',
      count: longBullets.length,
      message: `Shorten ${longBullets.length} long bullet${longBullets.length > 1 ? 's' : ''}`,
    });
  } else {
    currentScore += 2;
  }

  // Check for missing sections
  if (!content.summary || content.summary.trim().length < 50) {
    quickWins.push({
      id: 'add-summary',
      type: 'structure',
      severity: 'high',
      count: 1,
      message: 'Add a professional summary',
    });
  } else {
    currentScore += 10;
  }

  // Check for skills
  if (!content.skills || content.skills.length < 5) {
    quickWins.push({
      id: 'add-skills',
      type: 'structure',
      severity: 'medium',
      count: 1,
      message: 'Add more relevant skills',
    });
  } else {
    currentScore += 8;
  }

  // If JD is provided, add keyword suggestions (before score calculation so it contributes)
  if (jd && jd.trim().length > 50) {
    quickWins.push({
      id: 'match-keywords',
      type: 'keyword',
      severity: 'high',
      count: 1,
      message: 'Align with job keywords',
    });
  }

  // Calculate potential score
  const potentialGain = quickWins.reduce((acc, win) => {
    if (win.severity === 'high') return acc + 8;
    if (win.severity === 'medium') return acc + 5;
    return acc + 2;
  }, 0);

  const potentialScore = Math.min(100, currentScore + potentialGain);

  return {
    currentScore: Math.min(100, Math.max(0, currentScore)),
    potentialScore,
    quickWins,
  };
}

export function QuickWinsPreviewStep({
  resumeContent,
  startSource,
  onViewSuggestions,
  jobDescription,
}: QuickWinsPreviewStepProps) {
  const [analysis, setAnalysis] = useState<QuickWinsAnalysis>({
    currentScore: 0,
    potentialScore: 0,
    quickWins: [],
    loading: true,
  });

  // Analyze content on mount
  useEffect(() => {
    // Simulate loading for better UX
    const timer = setTimeout(() => {
      const result = analyzeResumeContent(resumeContent, jobDescription);
      setAnalysis({
        ...result,
        loading: false,
      });
    }, ANALYSIS_DELAY_MS);

    return () => clearTimeout(timer);
  }, [resumeContent, jobDescription]);

  // Don't show this step for blank resumes
  if (startSource === 'blank') {
    return null;
  }

  const { currentScore, potentialScore, quickWins, loading } = analysis;
  const scoreGain = potentialScore - currentScore;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-primary-500 animate-pulse" />
          </div>
          <Loader2 className="absolute -top-1 -right-1 h-6 w-6 text-primary-500 animate-spin" />
        </div>
        <div className="text-center">
          <p className="font-medium text-slate-900">Analyzing your resume...</p>
          <p className="text-sm text-slate-500 mt-1">Finding opportunities to improve</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with score improvement */}
      <div className="text-center space-y-3 py-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-primary-100 to-purple-100 mb-1">
          <Sparkles className="h-6 w-6 text-primary-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            {quickWins.length > 0 ? (
              <>
                I found <span className="text-primary-600">{quickWins.length} quick wins</span> to
                boost your resume
              </>
            ) : (
              'Your resume is looking good!'
            )}
          </h2>
          {quickWins.length > 0 && (
            <p className="text-slate-500 mt-2 flex items-center justify-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              From <span className="font-semibold text-slate-700">{currentScore}</span>
              {' → '}
              <span className="font-semibold text-green-600">{potentialScore}</span>
              {' points '}
              <span className="text-green-600">(+{scoreGain})</span>
            </p>
          )}
        </div>
      </div>

      {/* Quick Wins List */}
      {quickWins.length > 0 && (
        <div className="bg-slate-50 rounded-2xl p-5 space-y-3">
          {quickWins.map((win) => (
            <div
              key={win.id}
              className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100"
            >
              {/* Severity indicator */}
              <div
                className={cn(
                  'w-2 h-2 rounded-full flex-shrink-0',
                  win.severity === 'high' && 'bg-red-500',
                  win.severity === 'medium' && 'bg-amber-500',
                  win.severity === 'low' && 'bg-green-500',
                )}
              />

              {/* Icon */}
              <div
                className={cn(
                  'p-2 rounded-lg flex-shrink-0',
                  win.severity === 'high' && 'bg-red-50',
                  win.severity === 'medium' && 'bg-amber-50',
                  win.severity === 'low' && 'bg-green-50',
                )}
              >
                {win.type === 'metric' && (
                  <TrendingUp
                    className={cn(
                      'h-4 w-4',
                      win.severity === 'high' && 'text-red-600',
                      win.severity === 'medium' && 'text-amber-600',
                      win.severity === 'low' && 'text-green-600',
                    )}
                  />
                )}
                {win.type === 'verb' && (
                  <Zap
                    className={cn(
                      'h-4 w-4',
                      win.severity === 'high' && 'text-red-600',
                      win.severity === 'medium' && 'text-amber-600',
                      win.severity === 'low' && 'text-green-600',
                    )}
                  />
                )}
                {win.type === 'length' && (
                  <AlertCircle
                    className={cn(
                      'h-4 w-4',
                      win.severity === 'high' && 'text-red-600',
                      win.severity === 'medium' && 'text-amber-600',
                      win.severity === 'low' && 'text-green-600',
                    )}
                  />
                )}
                {(win.type === 'keyword' || win.type === 'structure') && (
                  <CheckCircle
                    className={cn(
                      'h-4 w-4',
                      win.severity === 'high' && 'text-red-600',
                      win.severity === 'medium' && 'text-amber-600',
                      win.severity === 'low' && 'text-green-600',
                    )}
                  />
                )}
              </div>

              {/* Message */}
              <span className="text-sm font-medium text-slate-700 flex-1">{win.message}</span>

              {/* Count badge */}
              {win.count > 1 && (
                <span
                  className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-full',
                    win.severity === 'high' && 'bg-red-100 text-red-700',
                    win.severity === 'medium' && 'bg-amber-100 text-amber-700',
                    win.severity === 'low' && 'bg-green-100 text-green-700',
                  )}
                >
                  {win.count}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* No issues found state */}
      {quickWins.length === 0 && (
        <div className="bg-green-50 rounded-2xl p-6 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
          <p className="font-medium text-green-800">Great start!</p>
          <p className="text-sm text-green-600 mt-1">
            Your resume content looks solid. You can still fine-tune it in the editor.
          </p>
        </div>
      )}

      {/* CTA hint */}
      {quickWins.length > 0 && (
        <p className="text-center text-sm text-slate-500">
          Continue to choose a template — we&apos;ll help you fix these in the editor
        </p>
      )}
    </div>
  );
}
