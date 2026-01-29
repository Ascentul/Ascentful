'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ResumeData } from '@/components/resume/ResumeDocument';
import { generateMockSuggestions, generateTopFixes } from '@/lib/resume-editor/suggestion-rules';
import type { GroupedSuggestions, Suggestion, SuggestionCounts } from '@/types/resume-editor';

interface UseSuggestionsOptions {
  enabled?: boolean;
  autoFetch?: boolean;
  debounceMs?: number;
}

interface UseSuggestionsReturn {
  suggestions: Suggestion[];
  groupedSuggestions: GroupedSuggestions;
  suggestionCounts: SuggestionCounts;
  topFixes: ReturnType<typeof generateTopFixes>;
  loading: boolean;
  error: string | null;
  dismissSuggestion: (suggestionId: string) => void;
  applySuggestion: (suggestionId: string) => void;
  undoDismiss: (suggestionId: string) => void;
  getSuggestionsForSpan: (spanId: string) => Suggestion[];
  refetch: () => Promise<void>;
  clearAll: () => void;
}

// spanId format is expected to be "<section>-<id>" (e.g., "experience-0").
const getSectionKeyFromSpanId = (spanId: string): string => {
  return spanId.split('-')[0];
};

/**
 * Hook for managing AI suggestions in the resume editor
 */
export function useSuggestions(
  resumeData: ResumeData,
  options: UseSuggestionsOptions = {},
): UseSuggestionsReturn {
  const { enabled = true, autoFetch = true, debounceMs = 1000 } = options;

  const resumeDataRef = useRef(resumeData);

  const [allSuggestions, setAllSuggestions] = useState<Suggestion[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    resumeDataRef.current = resumeData;
  }, [resumeData]);

  // Deep comparison needed to detect any content changes for re-fetching suggestions.
  // ResumeData lacks a version/timestamp field, so we serialize to compare.
  // Note: JSON.stringify is acceptable here since ResumeData is typically small (<10KB).
  // If performance becomes an issue with larger data, consider using a fast hash function.
  const resumeDataKey = useMemo(() => {
    return JSON.stringify(resumeData);
  }, [resumeData]);

  // Filter out dismissed and applied suggestions
  const activeSuggestions = useMemo(() => {
    return allSuggestions.filter(
      (s) => !dismissedIds.has(s.suggestionId) && !appliedIds.has(s.suggestionId),
    );
  }, [allSuggestions, dismissedIds, appliedIds]);

  // Group suggestions by severity
  const groupedSuggestions = useMemo((): GroupedSuggestions => {
    return {
      critical: activeSuggestions.filter((s) => s.severity === 'critical'),
      improve: activeSuggestions.filter((s) => s.severity === 'improve'),
      optional: activeSuggestions.filter((s) => s.severity === 'optional'),
    };
  }, [activeSuggestions]);

  // Count suggestions per section
  const suggestionCounts = useMemo((): SuggestionCounts => {
    const counts = new Map<string, number>();
    for (const suggestion of activeSuggestions) {
      const sectionType = getSectionKeyFromSpanId(suggestion.spanId);
      counts.set(sectionType, (counts.get(sectionType) ?? 0) + 1);
    }
    return Object.fromEntries(counts) as SuggestionCounts;
  }, [activeSuggestions]);

  // Generate top fixes
  const topFixes = useMemo(() => {
    return generateTopFixes(activeSuggestions);
  }, [activeSuggestions]);

  /**
   * Fetch suggestions from AI API with fallback to rule-based suggestions
   */
  const fetchSuggestions = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      // Use ref to get latest data (avoids stale closure issues)
      const currentData = resumeDataRef.current;

      // Try AI-powered suggestions first
      const response = await fetch('/api/resumes/ai/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeData: currentData }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.suggestions && Array.isArray(data.suggestions)) {
          setAllSuggestions(data.suggestions);
          return;
        }
      }

      // Fallback to rule-based suggestions if API fails
      console.warn('AI suggestions unavailable, using rule-based suggestions');
      const mockSuggestions = generateMockSuggestions(currentData);
      setAllSuggestions(mockSuggestions);
    } catch (err) {
      console.error('Error fetching suggestions:', err);
      // Fallback to rule-based suggestions on error
      try {
        const mockSuggestions = generateMockSuggestions(resumeDataRef.current);
        setAllSuggestions(mockSuggestions);
      } catch {
        setError('Failed to load suggestions');
      }
    } finally {
      setLoading(false);
    }
    // resumeDataKey triggers re-fetch on content changes, but we use ref for latest value
  }, [enabled, resumeDataKey]);

  // Auto-fetch on mount and when resume data changes (debounced)
  useEffect(() => {
    if (!autoFetch || !enabled) return;

    const timer = setTimeout(() => {
      fetchSuggestions();
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [autoFetch, enabled, fetchSuggestions, debounceMs]);

  /**
   * Dismiss a suggestion
   */
  const dismissSuggestion = useCallback((suggestionId: string) => {
    setDismissedIds((prev) => new Set([...prev, suggestionId]));
  }, []);

  /**
   * Mark a suggestion as applied
   */
  const applySuggestion = useCallback((suggestionId: string) => {
    setAppliedIds((prev) => new Set([...prev, suggestionId]));
    // Also update the suggestion's appliedAt timestamp
    setAllSuggestions((prev) =>
      prev.map((s) => (s.suggestionId === suggestionId ? { ...s, appliedAt: Date.now() } : s)),
    );
  }, []);

  /**
   * Undo dismissal of a suggestion
   */
  const undoDismiss = useCallback((suggestionId: string) => {
    setDismissedIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(suggestionId);
      return newSet;
    });
  }, []);

  /**
   * Get all suggestions for a specific span
   */
  const getSuggestionsForSpan = useCallback(
    (spanId: string): Suggestion[] => {
      return activeSuggestions.filter((s) => s.spanId === spanId);
    },
    [activeSuggestions],
  );

  /**
   * Clear all suggestions and reset state
   */
  const clearAll = useCallback(() => {
    setAllSuggestions([]);
    setDismissedIds(new Set());
    setAppliedIds(new Set());
    setError(null);
  }, []);

  return {
    suggestions: activeSuggestions,
    groupedSuggestions,
    suggestionCounts,
    topFixes,
    loading,
    error,
    dismissSuggestion,
    applySuggestion,
    undoDismiss,
    getSuggestionsForSpan,
    refetch: fetchSuggestions,
    clearAll,
  };
}

// ============================================================================
// Utility Hook: Check if span has suggestions
// ============================================================================

export function useSpanHasSuggestion(spanId: string, suggestions: Suggestion[]): boolean {
  return useMemo(() => {
    return suggestions.some((s) => s.spanId === spanId);
  }, [spanId, suggestions]);
}
