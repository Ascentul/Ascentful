'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { MainPathStep } from '@/lib/career-explorer/types';

interface PathHistoryState {
  steps: MainPathStep[];
  timestamp: number;
}

interface UsePathHistoryOptions {
  maxHistory?: number;
}

interface UsePathHistoryReturn {
  // State
  canUndo: boolean;
  canRedo: boolean;
  historyLength: number;
  currentIndex: number;

  // Actions
  recordChange: (steps: MainPathStep[]) => void;
  undo: () => MainPathStep[] | null;
  redo: () => MainPathStep[] | null;
  clearHistory: () => void;
}

/**
 * Hook for managing undo/redo history for career path steps.
 * Captures state snapshots on each change and allows navigation through history.
 *
 * Usage:
 * ```tsx
 * const { canUndo, canRedo, recordChange, undo, redo } = usePathHistory({ maxHistory: 20 });
 *
 * // Record a change when steps are modified
 * const handleAddStep = (step) => {
 *   const newSteps = [...steps, step];
 *   setSteps(newSteps);
 *   recordChange(newSteps);
 * };
 *
 * // Undo the last change
 * const handleUndo = () => {
 *   const previousSteps = undo();
 *   if (previousSteps) setSteps(previousSteps);
 * };
 * ```
 */
export function usePathHistory(options: UsePathHistoryOptions = {}): UsePathHistoryReturn {
  const { maxHistory = 20 } = options;

  // History stack - past states
  const [history, setHistory] = useState<PathHistoryState[]>([]);
  // Current position in history
  const [currentIndex, setCurrentIndex] = useState(-1);
  // Future stack - states we can redo to
  const futureRef = useRef<PathHistoryState[]>([]);

  const canUndo = currentIndex >= 0;
  const canRedo = futureRef.current.length > 0;

  /**
   * Record a new state change.
   * Clears any redo history and adds the new state to the history stack.
   */
  const recordChange = useCallback(
    (steps: MainPathStep[]) => {
      const newState: PathHistoryState = {
        steps: JSON.parse(JSON.stringify(steps)), // Deep clone
        timestamp: Date.now(),
      };

      setHistory((prev) => {
        // If we're in the middle of history (after undos), truncate future
        const newHistory = prev.slice(0, currentIndex + 1);

        // Add new state
        newHistory.push(newState);

        // Trim to max history
        if (newHistory.length > maxHistory) {
          return newHistory.slice(-maxHistory);
        }

        return newHistory;
      });

      setCurrentIndex((prev) => Math.min(prev + 1, maxHistory - 1));

      // Clear redo stack when new change is recorded
      futureRef.current = [];
    },
    [currentIndex, maxHistory],
  );

  /**
   * Undo the last change.
   * Returns the previous state or null if nothing to undo.
   */
  const undo = useCallback((): MainPathStep[] | null => {
    if (!canUndo) return null;

    // Save current state to future (for redo)
    const currentState = history[currentIndex];
    if (currentState) {
      futureRef.current = [currentState, ...futureRef.current];
    }

    // Move back in history
    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex);

    // Return previous state, or empty array if at beginning
    if (newIndex >= 0 && history[newIndex]) {
      return JSON.parse(JSON.stringify(history[newIndex].steps));
    }

    return [];
  }, [canUndo, currentIndex, history]);

  /**
   * Redo a previously undone change.
   * Returns the next state or null if nothing to redo.
   */
  const redo = useCallback((): MainPathStep[] | null => {
    if (!canRedo) return null;

    // Get the next future state
    const [nextState, ...remainingFuture] = futureRef.current;
    futureRef.current = remainingFuture;

    // Add it back to history
    setHistory((prev) => [...prev.slice(0, currentIndex + 1), nextState]);
    setCurrentIndex((prev) => prev + 1);

    return JSON.parse(JSON.stringify(nextState.steps));
  }, [canRedo, currentIndex]);

  /**
   * Clear all history.
   */
  const clearHistory = useCallback(() => {
    setHistory([]);
    setCurrentIndex(-1);
    futureRef.current = [];
  }, []);

  // Keyboard shortcuts (Cmd/Ctrl + Z for undo, Cmd/Ctrl + Shift + Z for redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifierKey = isMac ? e.metaKey : e.ctrlKey;

      if (modifierKey && e.key === 'z') {
        if (e.shiftKey) {
          // Redo
          e.preventDefault();
          const nextSteps = redo();
          if (nextSteps) {
            // Dispatch custom event for components to handle
            window.dispatchEvent(
              new CustomEvent('pathHistoryRedo', { detail: { steps: nextSteps } }),
            );
          }
        } else {
          // Undo
          e.preventDefault();
          const prevSteps = undo();
          if (prevSteps) {
            // Dispatch custom event for components to handle
            window.dispatchEvent(
              new CustomEvent('pathHistoryUndo', { detail: { steps: prevSteps } }),
            );
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return {
    canUndo,
    canRedo,
    historyLength: history.length,
    currentIndex,
    recordChange,
    undo,
    redo,
    clearHistory,
  };
}

/**
 * Hook for listening to path history events.
 * Use this in components that need to react to undo/redo actions.
 */
export function usePathHistoryEvents(
  onUndo?: (steps: MainPathStep[]) => void,
  onRedo?: (steps: MainPathStep[]) => void,
) {
  useEffect(() => {
    const handleUndo = (e: CustomEvent<{ steps: MainPathStep[] }>) => {
      onUndo?.(e.detail.steps);
    };

    const handleRedo = (e: CustomEvent<{ steps: MainPathStep[] }>) => {
      onRedo?.(e.detail.steps);
    };

    window.addEventListener('pathHistoryUndo', handleUndo as EventListener);
    window.addEventListener('pathHistoryRedo', handleRedo as EventListener);

    return () => {
      window.removeEventListener('pathHistoryUndo', handleUndo as EventListener);
      window.removeEventListener('pathHistoryRedo', handleRedo as EventListener);
    };
  }, [onUndo, onRedo]);
}
