'use client';

import { useCallback, useState } from 'react';

import type { ResumeData } from '@/components/resume/ResumeDocument';
import type {
  BulletRewriteResponse,
  JDAnalysisResponse,
  MatchScoreResponse,
  ScoreResponse,
  SuggestionsResponse,
} from '@/lib/ai/schemas';

// ============================================================================
// TYPES
// ============================================================================

interface AICallState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseScoreOptions {
  jobDescription?: string;
}

interface UseSuggestionsOptions {
  jobDescription?: string;
  focusAreas?: string[];
}

interface UseRewriteOptions {
  roleContext?: {
    company?: string;
    title?: string;
    industry?: string;
  };
  targetKeywords?: string[];
  emphasis?: 'impact' | 'leadership' | 'technical' | 'efficiency';
}

// ============================================================================
// HELPER: Generic API call wrapper
// ============================================================================

async function callAPI<T>(
  endpoint: string,
  body: Record<string, unknown>,
  timeoutMs: number = 30000,
): Promise<{ success: boolean; data?: T; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    // Handle non-JSON responses (e.g., HTML error pages, 502 Gateway errors)
    let result;
    try {
      result = await response.json();
    } catch {
      return {
        success: false,
        error: `Server error (${response.status})`,
      };
    }

    if (!response.ok || !result.success) {
      return {
        success: false,
        error: result.error || result.details || 'Request failed',
      };
    }

    return { success: true, data: result.data };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: 'Request timed out' };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// HOOK: useScore
// ============================================================================

export function useScore() {
  const [state, setState] = useState<AICallState<ScoreResponse>>({
    data: null,
    loading: false,
    error: null,
  });

  const calculateScore = useCallback(async (resume: ResumeData, options: UseScoreOptions = {}) => {
    setState({ data: null, loading: true, error: null });

    const result = await callAPI<ScoreResponse>('/api/ai/score', {
      resume,
      jobDescription: options.jobDescription,
    });

    if (result.success && result.data) {
      setState({ data: result.data, loading: false, error: null });
    } else {
      setState({ data: null, loading: false, error: result.error || 'Failed to score resume' });
    }

    return result;
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    score: state.data,
    loading: state.loading,
    error: state.error,
    calculateScore,
    reset,
  };
}

// ============================================================================
// HOOK: useAISuggestions
// ============================================================================

export function useAISuggestions() {
  const [state, setState] = useState<AICallState<SuggestionsResponse>>({
    data: null,
    loading: false,
    error: null,
  });

  const generateSuggestions = useCallback(
    async (resume: ResumeData, options: UseSuggestionsOptions = {}) => {
      setState({ data: null, loading: true, error: null });

      const result = await callAPI<SuggestionsResponse>('/api/ai/suggest', {
        resume,
        jobDescription: options.jobDescription,
        focusAreas: options.focusAreas,
      });

      if (result.success && result.data) {
        setState({ data: result.data, loading: false, error: null });
      } else {
        setState({
          data: null,
          loading: false,
          error: result.error || 'Failed to generate suggestions',
        });
      }

      return result;
    },
    [],
  );

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    suggestions: state.data?.suggestions || [],
    summary: state.data?.summary || null,
    loading: state.loading,
    error: state.error,
    generateSuggestions,
    reset,
  };
}

// ============================================================================
// HOOK: useRewrite
// ============================================================================

export function useRewrite() {
  const [state, setState] = useState<AICallState<BulletRewriteResponse>>({
    data: null,
    loading: false,
    error: null,
  });

  const rewriteBullet = useCallback(async (bullet: string, options: UseRewriteOptions = {}) => {
    setState({ data: null, loading: true, error: null });

    const result = await callAPI<BulletRewriteResponse>('/api/ai/rewrite', {
      bullet,
      roleContext: options.roleContext,
      targetKeywords: options.targetKeywords,
      emphasis: options.emphasis,
    });

    if (result.success && result.data) {
      setState({ data: result.data, loading: false, error: null });
    } else {
      setState({ data: null, loading: false, error: result.error || 'Failed to rewrite bullet' });
    }

    return result;
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    rewrite: state.data,
    loading: state.loading,
    error: state.error,
    rewriteBullet,
    reset,
  };
}

// ============================================================================
// HOOK: useJDAnalysis
// ============================================================================

export function useJDAnalysis() {
  const [state, setState] = useState<AICallState<JDAnalysisResponse>>({
    data: null,
    loading: false,
    error: null,
  });

  const analyzeJD = useCallback(async (jobDescription: string, url?: string) => {
    setState({ data: null, loading: true, error: null });

    const result = await callAPI<JDAnalysisResponse>('/api/ai/analyze-jd', {
      jobDescription,
      url,
    });

    if (result.success && result.data) {
      setState({ data: result.data, loading: false, error: null });
    } else {
      setState({
        data: null,
        loading: false,
        error: result.error || 'Failed to analyze job description',
      });
    }

    return result;
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    analysis: state.data,
    loading: state.loading,
    error: state.error,
    analyzeJD,
    reset,
  };
}

// ============================================================================
// HOOK: useMatchScore
// ============================================================================

export function useMatchScore() {
  const [state, setState] = useState<AICallState<MatchScoreResponse>>({
    data: null,
    loading: false,
    error: null,
  });

  const calculateMatch = useCallback(async (resume: ResumeData, jdAnalysis: JDAnalysisResponse) => {
    setState({ data: null, loading: true, error: null });

    const result = await callAPI<MatchScoreResponse>('/api/ai/match', {
      resume,
      jdAnalysis,
    });

    if (result.success && result.data) {
      setState({ data: result.data, loading: false, error: null });
    } else {
      setState({
        data: null,
        loading: false,
        error: result.error || 'Failed to calculate match score',
      });
    }

    return result;
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    matchScore: state.data,
    loading: state.loading,
    error: state.error,
    calculateMatch,
    reset,
  };
}

// ============================================================================
// COMBINED HOOK: useAI (convenience wrapper for all AI features)
// ============================================================================

export function useAI() {
  const score = useScore();
  const suggestions = useAISuggestions();
  const rewrite = useRewrite();
  const jdAnalysis = useJDAnalysis();
  const matchScore = useMatchScore();

  // Check if any operation is loading
  const isLoading =
    score.loading ||
    suggestions.loading ||
    rewrite.loading ||
    jdAnalysis.loading ||
    matchScore.loading;

  // Collect all errors (type guard ensures proper string[] typing)
  const errors = [
    score.error,
    suggestions.error,
    rewrite.error,
    jdAnalysis.error,
    matchScore.error,
  ].filter((e): e is string => Boolean(e));

  // Reset all states (use stable reset function references, not hook objects)
  const resetAll = useCallback(() => {
    score.reset();
    suggestions.reset();
    rewrite.reset();
    jdAnalysis.reset();
    matchScore.reset();
  }, [score.reset, suggestions.reset, rewrite.reset, jdAnalysis.reset, matchScore.reset]);

  return {
    // Individual hooks
    score,
    suggestions,
    rewrite,
    jdAnalysis,
    matchScore,

    // Convenience properties
    isLoading,
    errors,
    resetAll,
  };
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default useAI;
