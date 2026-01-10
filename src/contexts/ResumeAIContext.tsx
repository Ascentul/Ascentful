'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';

import type { ResumeData } from '@/components/resume/ResumeDocument';
import { useAISuggestions, useMatchScore, useRewrite, useScore } from '@/hooks/useAI';
import type {
  JDAnalysisResponse,
  MatchScoreResponse,
  ScoreResponse,
  Suggestion,
} from '@/lib/ai/schemas';
import {
  applyRuleBasedChecks,
  generateMissingContentSuggestions,
  prioritizeAndDedupe,
} from '@/lib/ai/suggestion-generator';
import {
  computeResumeDiff,
  type OptimizedResumeResponse,
  optimizedToResumeData,
  type ResumeDiff,
} from '@/lib/resume/optimizedToResumeData';
import { resumeDataToText } from '@/lib/resume/resumeToText';
import { calculateEnhancedScore } from '@/lib/resume-score';
import type {
  GroupedSuggestions,
  ResumeScore,
  Suggestion as LegacySuggestion,
  TopFix,
} from '@/types/resume-editor';

// ============================================================================
// CONSTANTS
// ============================================================================

// Maps AI suggestion severity to legacy severity values
const SEVERITY_MAP: Record<Suggestion['severity'], LegacySuggestion['severity']> = {
  critical: 'critical',
  important: 'improve',
  polish: 'optional',
};

// Maps AI suggestion type to legacy type values
const TYPE_MAP: Record<Suggestion['type'], LegacySuggestion['type']> = {
  'missing-metrics': 'metric',
  'weak-verb': 'verb',
  'too-long': 'length',
  'passive-voice': 'clarity',
  'missing-keyword': 'keyword',
  'vague-achievement': 'impact',
  'no-outcome': 'clarity',
  'missing-info': 'clarity',
  'generic-content': 'clarity',
  'redundant-content': 'clarity',
  'weak-scope': 'impact',
  'buried-impact': 'impact',
  'filler-words': 'clarity',
  'formatting-consistency': 'clarity',
  'order-optimization': 'clarity',
  'enhancement-opportunity': 'clarity',
  'structure-issue': 'clarity',
  'missing-summary': 'clarity',
  'missing-experience': 'clarity',
  'missing-education': 'clarity',
  'missing-skills': 'clarity',
  'missing-contact-field': 'clarity',
  'incomplete-entry': 'clarity',
  'empty-bullets': 'clarity',
  'short-content': 'clarity',
  'career-gap': 'clarity',
  'missing-progression': 'impact',
  'outdated-skills': 'keyword',
};

// Factory function to create a legacy suggestion mapper with dismissed state
function createLegacyMapper(dismissedIds: Set<string>) {
  return (s: Suggestion): LegacySuggestion => ({
    suggestionId: s.id,
    spanId: s.targetPath,
    severity: SEVERITY_MAP[s.severity] ?? 'optional',
    type: TYPE_MAP[s.type] ?? 'clarity',
    category: s.category.charAt(0).toUpperCase() + s.category.slice(1),
    message: s.explanation,
    proposedText: s.afterText,
    dismissed: dismissedIds.has(s.id),
  });
}

// ============================================================================
// TYPES
// ============================================================================

// Analysis result from /api/resumes/analyze (the working API)
export interface JobAnalysisResult {
  score: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  suggestions: string[];
  strengthHighlights?: string[];
}

// Simple match score for when only the numeric score is available (e.g., from /api/resumes/analyze)
export interface SimpleMatchScore {
  matchScore: number;
}

// Match score can be either the full AI response or just the numeric score
export type MatchScore = MatchScoreResponse | SimpleMatchScore;

export type AIAssistMode = 'onboarding' | 'active' | 'strategy';

interface ResumeAIState {
  // AI Score
  aiScore: ScoreResponse | null;
  scoreLoading: boolean;
  scoreError: string | null;

  // AI Suggestions
  aiSuggestions: Suggestion[];
  suggestionsLoading: boolean;
  suggestionsError: string | null;
  dismissedSuggestionIds: Set<string>;

  // JD Analysis (legacy - uses broken /api/ai/analyze-jd)
  jobDescription: string;
  jdAnalysis: JDAnalysisResponse | null;
  jdLoading: boolean;
  jdError: string | null;

  // Match Score (can be full AI response or simple score from /api/resumes/analyze)
  matchScore: MatchScore | null;
  matchLoading: boolean;
  matchError: string | null;

  // Job Analysis (working - uses /api/resumes/analyze)
  jobAnalysisResult: JobAnalysisResult | null;

  // Optimized Resume (from /api/resumes/optimize)
  optimizedResume: ResumeData | null;
  optimizeLoading: boolean;
  optimizeError: string | null;
  resumeDiff: ResumeDiff | null;

  // AI Assist Panel Mode
  assistMode: AIAssistMode;

  // Inline toolbar state
  inlineToolbarTarget: {
    spanId: string;
    bulletText: string;
    position: { x: number; y: number };
  } | null;

  // Fallback mode (when AI fails)
  usingFallback: boolean;
}

type ResumeAIAction =
  | { type: 'SET_SCORE'; payload: ScoreResponse | null }
  | { type: 'SET_SCORE_LOADING'; payload: boolean }
  | { type: 'SET_SCORE_ERROR'; payload: string | null }
  | { type: 'SET_SUGGESTIONS'; payload: Suggestion[] }
  | { type: 'SET_SUGGESTIONS_LOADING'; payload: boolean }
  | { type: 'SET_SUGGESTIONS_ERROR'; payload: string | null }
  | { type: 'DISMISS_SUGGESTION'; payload: string }
  | { type: 'APPLY_SUGGESTION'; payload: string }
  | { type: 'RESET_DISMISSED_SUGGESTIONS' }
  | { type: 'SET_DISMISSED_SUGGESTIONS'; payload: Set<string> }
  | { type: 'SET_JD'; payload: string }
  | { type: 'SET_JD_ANALYSIS'; payload: JDAnalysisResponse | null }
  | { type: 'SET_JD_LOADING'; payload: boolean }
  | { type: 'SET_JD_ERROR'; payload: string | null }
  | { type: 'SET_MATCH_SCORE'; payload: MatchScore | null }
  | { type: 'SET_MATCH_LOADING'; payload: boolean }
  | { type: 'SET_MATCH_ERROR'; payload: string | null }
  | { type: 'SET_ASSIST_MODE'; payload: AIAssistMode }
  | { type: 'SHOW_INLINE_TOOLBAR'; payload: ResumeAIState['inlineToolbarTarget'] }
  | { type: 'HIDE_INLINE_TOOLBAR' }
  | { type: 'SET_USING_FALLBACK'; payload: boolean }
  | { type: 'SET_JOB_ANALYSIS_RESULT'; payload: JobAnalysisResult | null }
  | { type: 'SET_OPTIMIZED_RESUME'; payload: ResumeData | null }
  | { type: 'SET_OPTIMIZE_LOADING'; payload: boolean }
  | { type: 'SET_OPTIMIZE_ERROR'; payload: string | null }
  | { type: 'SET_RESUME_DIFF'; payload: ResumeDiff | null }
  | { type: 'CLEAR_OPTIMIZED_RESUME' };

interface ResumeAIStateValue extends ResumeAIState {
  // Resume data reference
  resumeData: ResumeData | null;

  // Computed score (AI or fallback) - UI-friendly format
  effectiveScore: {
    overallScore: number;
    subscores: Array<{ label: string; score: number; color: string }>;
    topFixes: Array<{ id: string; label: string; suggestionIds: string[] }>;
    quickWins: string[];
  };

  // Legacy-compatible score and suggestions (for existing components)
  legacyScore: ResumeScore;
  legacyGroupedSuggestions: GroupedSuggestions;

  // Loading states
  isAnyLoading: boolean;
}

interface ResumeAIActionsValue {
  refreshScore: () => Promise<void>;
  refreshSuggestions: () => Promise<void>;
  setJobDescription: (jd: string) => void;
  analyzeJobDescription: (jd: string) => Promise<void>;
  refreshMatchScore: () => Promise<void>;
  dismissSuggestion: (id: string) => void;
  applySuggestion: (id: string) => void;
  setAssistMode: (mode: AIAssistMode) => void;
  showInlineToolbar: (target: ResumeAIState['inlineToolbarTarget']) => void;
  hideInlineToolbar: () => void;
  rewriteBullet: (
    bullet: string,
    options?: {
      emphasis?: 'impact' | 'leadership' | 'technical' | 'efficiency';
      targetKeywords?: string[];
    },
  ) => Promise<{ rewrittenBullet: string } | null>;
  // New: Working optimize flow
  optimizeForJob: () => Promise<void>;
  applyOptimizedResume: () => void;
  discardOptimizedResume: () => void;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: ResumeAIState = {
  aiScore: null,
  scoreLoading: false,
  scoreError: null,
  aiSuggestions: [],
  suggestionsLoading: false,
  suggestionsError: null,
  dismissedSuggestionIds: new Set(),
  jobDescription: '',
  jdAnalysis: null,
  jdLoading: false,
  jdError: null,
  matchScore: null,
  matchLoading: false,
  matchError: null,
  // New working job analysis
  jobAnalysisResult: null,
  optimizedResume: null,
  optimizeLoading: false,
  optimizeError: null,
  resumeDiff: null,
  assistMode: 'active',
  inlineToolbarTarget: null,
  usingFallback: false,
};

// ============================================================================
// REDUCER
// ============================================================================

function resumeAIReducer(state: ResumeAIState, action: ResumeAIAction): ResumeAIState {
  switch (action.type) {
    case 'SET_SCORE':
      return { ...state, aiScore: action.payload };
    case 'SET_SCORE_LOADING':
      return { ...state, scoreLoading: action.payload };
    case 'SET_SCORE_ERROR':
      return { ...state, scoreError: action.payload };
    case 'SET_SUGGESTIONS':
      return { ...state, aiSuggestions: action.payload };
    case 'SET_SUGGESTIONS_LOADING':
      return { ...state, suggestionsLoading: action.payload };
    case 'SET_SUGGESTIONS_ERROR':
      return { ...state, suggestionsError: action.payload };
    case 'DISMISS_SUGGESTION':
      return {
        ...state,
        dismissedSuggestionIds: new Set([...state.dismissedSuggestionIds, action.payload]),
      };
    case 'APPLY_SUGGESTION':
      return {
        ...state,
        dismissedSuggestionIds: new Set([...state.dismissedSuggestionIds, action.payload]),
        aiSuggestions: state.aiSuggestions.filter((s) => s.id !== action.payload),
      };
    case 'RESET_DISMISSED_SUGGESTIONS':
      return { ...state, dismissedSuggestionIds: new Set() };
    case 'SET_DISMISSED_SUGGESTIONS':
      return { ...state, dismissedSuggestionIds: new Set(action.payload) };
    case 'SET_JD':
      return { ...state, jobDescription: action.payload };
    case 'SET_JD_ANALYSIS':
      return { ...state, jdAnalysis: action.payload };
    case 'SET_JD_LOADING':
      return { ...state, jdLoading: action.payload };
    case 'SET_JD_ERROR':
      return { ...state, jdError: action.payload };
    case 'SET_MATCH_SCORE':
      return { ...state, matchScore: action.payload };
    case 'SET_MATCH_LOADING':
      return { ...state, matchLoading: action.payload };
    case 'SET_MATCH_ERROR':
      return { ...state, matchError: action.payload };
    case 'SET_ASSIST_MODE':
      return { ...state, assistMode: action.payload };
    case 'SHOW_INLINE_TOOLBAR':
      return { ...state, inlineToolbarTarget: action.payload };
    case 'HIDE_INLINE_TOOLBAR':
      return { ...state, inlineToolbarTarget: null };
    case 'SET_USING_FALLBACK':
      return { ...state, usingFallback: action.payload };
    case 'SET_JOB_ANALYSIS_RESULT':
      return { ...state, jobAnalysisResult: action.payload };
    case 'SET_OPTIMIZED_RESUME':
      return { ...state, optimizedResume: action.payload };
    case 'SET_OPTIMIZE_LOADING':
      return { ...state, optimizeLoading: action.payload };
    case 'SET_OPTIMIZE_ERROR':
      return { ...state, optimizeError: action.payload };
    case 'SET_RESUME_DIFF':
      return { ...state, resumeDiff: action.payload };
    case 'CLEAR_OPTIMIZED_RESUME':
      return { ...state, optimizedResume: null, resumeDiff: null, optimizeError: null };
    default:
      return state;
  }
}

// ============================================================================
// CONTEXT
// ============================================================================

const ResumeAIStateContext = createContext<ResumeAIStateValue | undefined>(undefined);
const ResumeAIActionsContext = createContext<ResumeAIActionsValue | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

interface ResumeAIProviderProps {
  children: React.ReactNode;
  resumeData: ResumeData;
  enabled?: boolean;
}

export function ResumeAIProvider({ children, resumeData, enabled = true }: ResumeAIProviderProps) {
  const [state, dispatch] = useReducer(resumeAIReducer, initialState);

  // AI Hooks
  const scoreHook = useScore();
  const suggestionsHook = useAISuggestions();
  const rewriteHook = useRewrite();
  const matchHook = useMatchScore();

  // Refs for debouncing (using ReturnType for browser/Node compatibility)
  const scoreDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeDataRef = useRef<ResumeData>(resumeData);
  const dismissedByContentRef = useRef<Record<string, Set<string>>>({});
  const contentSignatureRef = useRef<string>('');

  // Limit dismissed cache size to prevent memory leak during long editing sessions
  const MAX_DISMISSED_CACHE_SIZE = 10;

  // Keep resumeData ref up to date
  useEffect(() => {
    resumeDataRef.current = resumeData;
  }, [resumeData]);

  // Create a lightweight content signature for change detection.
  // Only stringify fields that affect suggestions to avoid expensive full serialization.
  const resumeDataSignature = useMemo(() => {
    try {
      const { contactInfo, summary, experience, education, skills, projects } = resumeData;
      // Extract only the content-relevant parts (exclude metadata like ids, timestamps)
      const contentSnapshot = {
        summary,
        skills,
        experience: experience?.map((e) => ({
          title: e.title,
          company: e.company,
          description: e.description,
        })),
        education: education?.map((e) => ({
          degree: e.degree,
          school: e.school,
          field: e.field,
        })),
        projects: projects?.map((p) => ({
          name: p.name,
          description: p.description,
        })),
        hasContact: Boolean(contactInfo?.name || contactInfo?.email),
      };
      return JSON.stringify(contentSnapshot);
    } catch {
      return '';
    }
  }, [resumeData]);

  // Preserve dismissed suggestions by content signature
  // Only trigger on signature change - dismissed IDs are captured via the sync effect below
  useEffect(() => {
    const nextSignature = resumeDataSignature;
    const prevSignature = contentSignatureRef.current;

    if (prevSignature !== nextSignature) {
      const nextDismissed = dismissedByContentRef.current[nextSignature] ?? new Set();
      dispatch({ type: 'SET_DISMISSED_SUGGESTIONS', payload: nextDismissed });
      contentSignatureRef.current = nextSignature;
    }
  }, [resumeDataSignature]);

  useEffect(() => {
    if (!resumeDataSignature) return;
    dismissedByContentRef.current[resumeDataSignature] = new Set(state.dismissedSuggestionIds);

    // Trim cache to prevent unbounded growth during long editing sessions
    const keys = Object.keys(dismissedByContentRef.current);
    if (keys.length > MAX_DISMISSED_CACHE_SIZE) {
      const keysToRemove = keys
        .filter((k) => k !== resumeDataSignature)
        .slice(0, keys.length - MAX_DISMISSED_CACHE_SIZE);
      keysToRemove.forEach((k) => delete dismissedByContentRef.current[k]);
    }
  }, [resumeDataSignature, state.dismissedSuggestionIds]);

  // Determine assist mode based on resume state
  useEffect(() => {
    if (!enabled) return;

    const isEmpty =
      !resumeData.summary &&
      (!resumeData.experience || resumeData.experience.length === 0) &&
      (!resumeData.education || resumeData.education.length === 0);

    const hasJD = !!state.jobDescription && state.jobDescription.trim().length > 0;

    if (isEmpty) {
      dispatch({ type: 'SET_ASSIST_MODE', payload: 'onboarding' });
    } else if (hasJD) {
      dispatch({ type: 'SET_ASSIST_MODE', payload: 'strategy' });
    } else {
      dispatch({ type: 'SET_ASSIST_MODE', payload: 'active' });
    }
  }, [resumeData, state.jobDescription, enabled]);

  // Refresh Score
  const refreshScore = useCallback(async () => {
    if (!enabled) return;

    dispatch({ type: 'SET_SCORE_LOADING', payload: true });
    dispatch({ type: 'SET_SCORE_ERROR', payload: null });

    try {
      const result = await scoreHook.calculateScore(resumeDataRef.current, {
        jobDescription: state.jobDescription || undefined,
      });

      if (result.success && result.data) {
        dispatch({ type: 'SET_SCORE', payload: result.data });
        dispatch({ type: 'SET_USING_FALLBACK', payload: false });
      } else {
        // Fallback to heuristic scoring
        dispatch({ type: 'SET_USING_FALLBACK', payload: true });
        dispatch({ type: 'SET_SCORE_ERROR', payload: result.error || 'Failed to calculate score' });
      }
    } catch (error) {
      dispatch({ type: 'SET_USING_FALLBACK', payload: true });
      dispatch({
        type: 'SET_SCORE_ERROR',
        payload: error instanceof Error ? error.message : 'Score calculation failed',
      });
    } finally {
      dispatch({ type: 'SET_SCORE_LOADING', payload: false });
    }
  }, [enabled, scoreHook, state.jobDescription]);

  // Refresh Suggestions - Hybrid approach: local + AI
  const refreshSuggestions = useCallback(async () => {
    if (!enabled) return;

    dispatch({ type: 'SET_SUGGESTIONS_LOADING', payload: true });
    dispatch({ type: 'SET_SUGGESTIONS_ERROR', payload: null });

    try {
      const currentData = resumeDataRef.current;

      // 1. Generate local suggestions instantly (missing content, rule-based checks)
      const missingContentSuggestions = generateMissingContentSuggestions(currentData);
      const ruleSuggestions = applyRuleBasedChecks(currentData);

      // Convert local suggestions to AI schema format
      const localSuggestions: Suggestion[] = [...missingContentSuggestions, ...ruleSuggestions].map(
        (s) => ({
          id: s.id,
          type: s.type,
          severity: s.severity,
          category: s.category,
          targetType: s.targetType,
          targetId: s.targetId,
          targetPath: s.targetPath,
          title: s.title,
          explanation: s.explanation,
          beforeText: s.beforeText,
          afterText: s.afterText,
          estimatedScoreImpact: s.estimatedScoreImpact,
        }),
      );

      // 2. Set local suggestions immediately for instant feedback
      if (localSuggestions.length > 0) {
        dispatch({ type: 'SET_SUGGESTIONS', payload: localSuggestions });
      }

      // 3. Fetch AI suggestions (deep analysis)
      const result = await suggestionsHook.generateSuggestions(currentData, {
        jobDescription: state.jobDescription || undefined,
      });

      if (result.success && result.data) {
        // 4. Merge and prioritize all suggestions
        const allSuggestions = prioritizeAndDedupe([
          ...localSuggestions,
          ...result.data.suggestions,
        ]);

        dispatch({ type: 'SET_SUGGESTIONS', payload: allSuggestions });
      } else {
        // AI failed but we still have local suggestions
        if (localSuggestions.length === 0) {
          dispatch({
            type: 'SET_SUGGESTIONS_ERROR',
            payload: result.error || 'Failed to generate suggestions',
          });
        }
        // Keep local suggestions if AI fails
      }
    } catch (error) {
      // On error, still try to provide local suggestions
      try {
        const currentData = resumeDataRef.current;
        const missingContentSuggestions = generateMissingContentSuggestions(currentData);
        const ruleSuggestions = applyRuleBasedChecks(currentData);
        const localSuggestions: Suggestion[] = [
          ...missingContentSuggestions,
          ...ruleSuggestions,
        ].map((s) => ({
          id: s.id,
          type: s.type,
          severity: s.severity,
          category: s.category,
          targetType: s.targetType,
          targetId: s.targetId,
          targetPath: s.targetPath,
          title: s.title,
          explanation: s.explanation,
          beforeText: s.beforeText,
          afterText: s.afterText,
          estimatedScoreImpact: s.estimatedScoreImpact,
        }));

        if (localSuggestions.length > 0) {
          dispatch({ type: 'SET_SUGGESTIONS', payload: localSuggestions });
        }
      } catch {
        // Fallback failed too
      }

      dispatch({
        type: 'SET_SUGGESTIONS_ERROR',
        payload: error instanceof Error ? error.message : 'Suggestions generation failed',
      });
    } finally {
      dispatch({ type: 'SET_SUGGESTIONS_LOADING', payload: false });
    }
  }, [enabled, suggestionsHook, state.jobDescription]);

  // Stable refs for the refresh functions to avoid dependency issues
  const refreshScoreRef = useRef(refreshScore);
  const refreshSuggestionsRef = useRef(refreshSuggestions);

  useEffect(() => {
    refreshScoreRef.current = refreshScore;
  }, [refreshScore]);

  useEffect(() => {
    refreshSuggestionsRef.current = refreshSuggestions;
  }, [refreshSuggestions]);

  // Track if initial load has happened
  const initialLoadDone = useRef(false);

  // Debounced auto-refresh on resume changes
  useEffect(() => {
    if (!enabled) return;

    // Clear existing timeouts
    if (scoreDebounceRef.current) {
      clearTimeout(scoreDebounceRef.current);
    }
    if (suggestionsDebounceRef.current) {
      clearTimeout(suggestionsDebounceRef.current);
    }

    // Use shorter delay for initial load, longer for subsequent changes
    const scoreDelay = initialLoadDone.current ? 2000 : 500;
    const suggestionsDelay = initialLoadDone.current ? 3000 : 1000;

    // Debounce score refresh
    scoreDebounceRef.current = setTimeout(() => {
      refreshScoreRef.current();
      initialLoadDone.current = true;
    }, scoreDelay);

    // Debounce suggestions refresh
    suggestionsDebounceRef.current = setTimeout(() => {
      refreshSuggestionsRef.current();
    }, suggestionsDelay);

    return () => {
      if (scoreDebounceRef.current) {
        clearTimeout(scoreDebounceRef.current);
      }
      if (suggestionsDebounceRef.current) {
        clearTimeout(suggestionsDebounceRef.current);
      }
    };
  }, [resumeData, enabled]); // Only depend on resumeData and enabled, not the functions

  // Set Job Description
  const setJobDescription = useCallback((jd: string) => {
    dispatch({ type: 'SET_JD', payload: jd });
  }, []);

  // Internal match score refresh (used after JD analysis)
  const refreshMatchScoreInternal = useCallback(
    async (jdAnalysis: JDAnalysisResponse) => {
      dispatch({ type: 'SET_MATCH_LOADING', payload: true });
      dispatch({ type: 'SET_MATCH_ERROR', payload: null });

      try {
        const result = await matchHook.calculateMatch(resumeDataRef.current, jdAnalysis);

        if (result.success && result.data) {
          dispatch({ type: 'SET_MATCH_SCORE', payload: result.data });
        } else {
          dispatch({
            type: 'SET_MATCH_ERROR',
            payload: result.error || 'Failed to calculate match score',
          });
        }
      } catch (error) {
        dispatch({
          type: 'SET_MATCH_ERROR',
          payload: error instanceof Error ? error.message : 'Match calculation failed',
        });
      } finally {
        dispatch({ type: 'SET_MATCH_LOADING', payload: false });
      }
    },
    [matchHook],
  );

  // Analyze Job Description - NOW USES WORKING /api/resumes/analyze
  const analyzeJobDescription = useCallback(
    async (jd: string) => {
      if (!enabled || !jd.trim()) return;

      dispatch({ type: 'SET_JD', payload: jd });
      dispatch({ type: 'SET_JD_LOADING', payload: true });
      dispatch({ type: 'SET_JD_ERROR', payload: null });
      // Clear previous analysis/match so UI doesn't show stale data
      dispatch({ type: 'SET_JD_ANALYSIS', payload: null });
      dispatch({ type: 'SET_MATCH_SCORE', payload: null });
      dispatch({ type: 'SET_JOB_ANALYSIS_RESULT', payload: null });
      dispatch({ type: 'CLEAR_OPTIMIZED_RESUME' });

      try {
        // Convert current resume to text for the API
        const resumeText = resumeDataToText(resumeDataRef.current);

        // Call the working /api/resumes/analyze endpoint
        const response = await fetch('/api/resumes/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resumeText, jobDescription: jd }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Analysis failed (${response.status})`);
        }

        const result: JobAnalysisResult = await response.json();
        dispatch({ type: 'SET_JOB_ANALYSIS_RESULT', payload: result });

        // Set match score from the analysis result (simple score, not full MatchScoreResponse)
        dispatch({
          type: 'SET_MATCH_SCORE',
          payload: { matchScore: result.score },
        });
      } catch (error) {
        dispatch({
          type: 'SET_JD_ERROR',
          payload: error instanceof Error ? error.message : 'JD analysis failed',
        });
      } finally {
        dispatch({ type: 'SET_JD_LOADING', payload: false });
      }
    },
    [enabled],
  );

  // Optimize resume for the job using /api/resumes/optimize
  const optimizeForJob = useCallback(async () => {
    if (!enabled || !state.jobDescription || !state.jobAnalysisResult) return;

    // Capture resume data at start to avoid race conditions
    const originalResume = resumeDataRef.current;

    dispatch({ type: 'SET_OPTIMIZE_LOADING', payload: true });
    dispatch({ type: 'SET_OPTIMIZE_ERROR', payload: null });

    try {
      const resumeText = resumeDataToText(originalResume);

      const response = await fetch('/api/resumes/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalResumeText: resumeText,
          analysisRecommendations: state.jobAnalysisResult,
          jobDescription: state.jobDescription,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Optimization failed (${response.status})`);
      }

      const result = await response.json();

      if (result.success && result.resume) {
        // Convert optimized response to ResumeData format
        const optimizedData = optimizedToResumeData(result.resume, originalResume);
        dispatch({ type: 'SET_OPTIMIZED_RESUME', payload: optimizedData });

        // Compute diff to show what changed
        const diff = computeResumeDiff(originalResume, optimizedData);
        dispatch({ type: 'SET_RESUME_DIFF', payload: diff });
      } else {
        throw new Error('Invalid optimization response');
      }
    } catch (error) {
      dispatch({
        type: 'SET_OPTIMIZE_ERROR',
        payload: error instanceof Error ? error.message : 'Optimization failed',
      });
    } finally {
      dispatch({ type: 'SET_OPTIMIZE_LOADING', payload: false });
    }
  }, [enabled, state.jobDescription, state.jobAnalysisResult]);

  /**
   * Signals that the optimized resume has been applied to the actual resume data.
   *
   * IMPORTANT: This function does NOT apply the optimization itself.
   *
   * Usage pattern:
   * 1. Read `state.optimizedResume` to get the AI-optimized version
   * 2. Apply the optimized data to your actual resume state (e.g., via setResumeData)
   * 3. Call this function to clear the optimized state
   *
   * The actual application logic is in the parent component (e.g., ThreePanelEditor)
   * because it has access to the resume state setters.
   *
   * @example
   * ```typescript
   * const { optimizedResume, applyOptimizedResume } = useResumeAIActions();
   *
   * const handleApply = () => {
   *   if (optimizedResume) {
   *     // Apply each section to actual resume
   *     if (optimizedResume.summary) onUpdateSummary(optimizedResume.summary);
   *     if (optimizedResume.experience) onUpdateExperience(optimizedResume.experience);
   *     // ... apply other sections
   *
   *     // Clear the optimized state
   *     applyOptimizedResume();
   *   }
   * };
   * ```
   */
  const applyOptimizedResume = useCallback(() => {
    dispatch({ type: 'CLEAR_OPTIMIZED_RESUME' });
  }, []);

  /**
   * Discards the optimized resume without applying it.
   *
   * Use this when the user rejects the AI optimization or wants to
   * keep their current resume unchanged.
   *
   * @example
   * ```typescript
   * const { discardOptimizedResume } = useResumeAIActions();
   *
   * const handleDiscard = () => {
   *   discardOptimizedResume(); // Clear without applying changes
   * };
   * ```
   */
  const discardOptimizedResume = useCallback(() => {
    dispatch({ type: 'CLEAR_OPTIMIZED_RESUME' });
  }, []);

  // Public match score refresh
  const refreshMatchScore = useCallback(async () => {
    if (!enabled || !state.jdAnalysis) return;
    await refreshMatchScoreInternal(state.jdAnalysis);
  }, [enabled, state.jdAnalysis, refreshMatchScoreInternal]);

  // Dismiss Suggestion
  const dismissSuggestion = useCallback((id: string) => {
    dispatch({ type: 'DISMISS_SUGGESTION', payload: id });
  }, []);

  // Apply Suggestion
  const applySuggestion = useCallback((id: string) => {
    dispatch({ type: 'APPLY_SUGGESTION', payload: id });
  }, []);

  // Set Assist Mode
  const setAssistMode = useCallback((mode: AIAssistMode) => {
    dispatch({ type: 'SET_ASSIST_MODE', payload: mode });
  }, []);

  // Show Inline Toolbar
  const showInlineToolbar = useCallback((target: ResumeAIState['inlineToolbarTarget']) => {
    dispatch({ type: 'SHOW_INLINE_TOOLBAR', payload: target });
  }, []);

  // Hide Inline Toolbar
  const hideInlineToolbar = useCallback(() => {
    dispatch({ type: 'HIDE_INLINE_TOOLBAR' });
  }, []);

  // Rewrite Bullet
  const rewriteBullet = useCallback(
    async (
      bullet: string,
      options?: {
        emphasis?: 'impact' | 'leadership' | 'technical' | 'efficiency';
        targetKeywords?: string[];
      },
    ) => {
      const result = await rewriteHook.rewriteBullet(bullet, {
        emphasis: options?.emphasis,
        targetKeywords:
          options?.targetKeywords ||
          state.jdAnalysis?.keywords?.technical?.map((k) => k.keyword) ||
          [],
        roleContext: state.jdAnalysis?.basics
          ? {
              company: state.jdAnalysis.basics.company,
              title: state.jdAnalysis.basics.title,
            }
          : undefined,
      });

      if (result.success && result.data) {
        return { rewrittenBullet: result.data.rewrittenBullet };
      }
      return null;
    },
    [rewriteHook, state.jdAnalysis],
  );

  // Compute effective score (AI or fallback) - returns UI-friendly format
  const effectiveScore = useMemo(() => {
    if (state.aiScore && !state.usingFallback) {
      // Map AI score to UI format
      return {
        overallScore: state.aiScore.overall,
        subscores: [
          { label: 'Impact', score: state.aiScore.breakdown.impact.score, color: 'orange' },
          { label: 'Clarity', score: state.aiScore.breakdown.clarity.score, color: 'green' },
          { label: 'ATS', score: state.aiScore.breakdown.ats.score, color: 'blue' },
          { label: 'Brevity', score: state.aiScore.breakdown.brevity.score, color: 'cyan' },
        ],
        topFixes: state.aiScore.topIssues.map((issue, idx) => ({
          id: `ai-fix-${idx}`,
          label: issue.fix,
          suggestionIds: [] as string[],
        })),
        quickWins: state.aiScore.quickWins,
      };
    }

    // Fallback to heuristic scoring
    const heuristicScore = calculateEnhancedScore(resumeData, []);
    return {
      overallScore: heuristicScore.overallScore,
      subscores: [
        { label: 'Impact', score: heuristicScore.subscores.impact, color: 'orange' },
        { label: 'Clarity', score: heuristicScore.subscores.clarity, color: 'green' },
        { label: 'ATS', score: heuristicScore.subscores.ats, color: 'blue' },
        { label: 'Relevance', score: heuristicScore.subscores.relevance, color: 'purple' },
      ],
      topFixes: heuristicScore.topFixes.map((fix) => ({
        id: fix.fixId,
        label: fix.message,
        suggestionIds: fix.suggestionIds,
      })),
      quickWins: [] as string[],
    };
  }, [state.aiScore, state.usingFallback, resumeData]);

  // Legacy-compatible score (for components that expect ResumeScore type)
  const legacyScore = useMemo((): ResumeScore => {
    if (state.aiScore && !state.usingFallback) {
      return {
        overallScore: state.aiScore.overall,
        subscores: {
          impact: state.aiScore.breakdown.impact.score,
          clarity: state.aiScore.breakdown.clarity.score,
          relevance: Math.round(
            (state.aiScore.breakdown.ats.score + state.aiScore.breakdown.brevity.score) / 2,
          ),
          ats: state.aiScore.breakdown.ats.score,
          consistency: state.aiScore.breakdown.clarity.score, // Map clarity to consistency
        },
        topFixes: state.aiScore.topIssues.map(
          (issue, idx): TopFix => ({
            fixId: `ai-fix-${idx}`,
            suggestionIds: [],
            message: issue.fix,
            impact:
              issue.category === 'impact'
                ? 'high'
                : issue.category === 'clarity'
                  ? 'medium'
                  : 'low',
          }),
        ),
      };
    }

    // Fallback to heuristic scoring
    return calculateEnhancedScore(resumeData, []);
  }, [state.aiScore, state.usingFallback, resumeData]);

  // Filter out dismissed suggestions
  const activeSuggestions = useMemo(() => {
    return state.aiSuggestions.filter((s) => !state.dismissedSuggestionIds.has(s.id));
  }, [state.aiSuggestions, state.dismissedSuggestionIds]);

  // Legacy-compatible grouped suggestions (uses activeSuggestions to respect dismissals)
  const legacyGroupedSuggestions = useMemo((): GroupedSuggestions => {
    const mapToLegacy = createLegacyMapper(state.dismissedSuggestionIds);

    return {
      critical: activeSuggestions.filter((s) => s.severity === 'critical').map(mapToLegacy),
      improve: activeSuggestions.filter((s) => s.severity === 'important').map(mapToLegacy),
      optional: activeSuggestions.filter((s) => s.severity === 'polish').map(mapToLegacy),
    };
  }, [activeSuggestions, state.dismissedSuggestionIds]);

  // Loading state
  const isAnyLoading =
    state.scoreLoading ||
    state.suggestionsLoading ||
    state.jdLoading ||
    state.matchLoading ||
    state.optimizeLoading ||
    rewriteHook.loading;

  const stateValue = useMemo<ResumeAIStateValue>(
    () => ({
      ...state,
      aiSuggestions: activeSuggestions,
      resumeData,
      effectiveScore,
      legacyScore,
      legacyGroupedSuggestions,
      isAnyLoading,
    }),
    [
      state,
      activeSuggestions,
      resumeData,
      effectiveScore,
      legacyScore,
      legacyGroupedSuggestions,
      isAnyLoading,
    ],
  );

  const actionsValue = useMemo<ResumeAIActionsValue>(
    () => ({
      refreshScore,
      refreshSuggestions,
      setJobDescription,
      analyzeJobDescription,
      refreshMatchScore,
      dismissSuggestion,
      applySuggestion,
      setAssistMode,
      showInlineToolbar,
      hideInlineToolbar,
      rewriteBullet,
      optimizeForJob,
      applyOptimizedResume,
      discardOptimizedResume,
    }),
    [
      refreshScore,
      refreshSuggestions,
      setJobDescription,
      analyzeJobDescription,
      refreshMatchScore,
      dismissSuggestion,
      applySuggestion,
      setAssistMode,
      showInlineToolbar,
      hideInlineToolbar,
      optimizeForJob,
      applyOptimizedResume,
      discardOptimizedResume,
      rewriteBullet,
    ],
  );

  return (
    <ResumeAIStateContext.Provider value={stateValue}>
      <ResumeAIActionsContext.Provider value={actionsValue}>
        {children}
      </ResumeAIActionsContext.Provider>
    </ResumeAIStateContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useResumeAIState() {
  const context = useContext(ResumeAIStateContext);
  if (context === undefined) {
    throw new Error('useResumeAIState must be used within a ResumeAIProvider');
  }
  return context;
}

export function useResumeAIActions() {
  const context = useContext(ResumeAIActionsContext);
  if (context === undefined) {
    throw new Error('useResumeAIActions must be used within a ResumeAIProvider');
  }
  return context;
}

export function useResumeAI() {
  const stateContext = useResumeAIState();
  const actionsContext = useResumeAIActions();
  return useMemo(() => ({ ...stateContext, ...actionsContext }), [stateContext, actionsContext]);
}

export default ResumeAIStateContext;
