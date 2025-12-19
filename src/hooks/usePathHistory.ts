'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { MainPathStep } from '@/lib/career-explorer/types';

interface PathHistoryState {
  steps: MainPathStep[];
  timestamp: number;
}

interface UsePathHistoryOptions {
  maxHistory?: number;
  /**
   * Enable global keyboard shortcuts (Cmd/Ctrl+Z for undo, Cmd/Ctrl+Shift+Z for redo).
   * Disabled by default to prevent conflicts when multiple instances are mounted.
   * Only enable this in one component at a time.
   */
  enableKeyboardShortcuts?: boolean;
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
  const { maxHistory = 20, enableKeyboardShortcuts = false } = options;

  // Consolidated state to ensure atomic updates and prevent race conditions
  const [historyState, setHistoryState] = useState<{
    history: PathHistoryState[];
    currentIndex: number;
    future: PathHistoryState[];
  }>({
    history: [],
    currentIndex: -1,
    future: [],
  });

  // Ref to capture return value from functional state updates
  const undoResultRef = useRef<MainPathStep[] | null>(null);
  const redoResultRef = useRef<MainPathStep[] | null>(null);

  const { history, currentIndex, future } = historyState;
  // canUndo requires currentIndex > 0 because we need a previous state to undo TO
  // At currentIndex 0, there's no state at index -1
  const canUndo = currentIndex > 0;
  const canRedo = future.length > 0;

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

      setHistoryState((prev) => {
        // If we're in the middle of history (after undos), truncate future
        const newHistory = prev.history.slice(0, prev.currentIndex + 1);

        // Add new state
        newHistory.push(newState);

        // Trim to max history and calculate new index
        const trimmedHistory =
          newHistory.length > maxHistory ? newHistory.slice(-maxHistory) : newHistory;

        return {
          history: trimmedHistory,
          currentIndex: Math.min(prev.currentIndex + 1, maxHistory - 1),
          future: [], // Clear redo stack when new change is recorded
        };
      });
    },
    [maxHistory],
  );

  /**
   * Undo the last change.
   * Returns the previous state or null if nothing to undo.
   * Uses atomic state update to prevent race conditions during rapid calls.
   */
  const undo = useCallback((): MainPathStep[] | null => {
    // Reset ref before update
    undoResultRef.current = null;

    setHistoryState((prev) => {
      // Check if we can undo using current state (must match canUndo logic)
      if (prev.currentIndex <= 0) {
        return prev;
      }

      const currentState = prev.history[prev.currentIndex];
      const newIndex = prev.currentIndex - 1;

      // Capture result for return value
      if (newIndex >= 0 && prev.history[newIndex]) {
        undoResultRef.current = JSON.parse(JSON.stringify(prev.history[newIndex].steps));
      }

      return {
        history: prev.history,
        currentIndex: newIndex,
        future: currentState ? [currentState, ...prev.future] : prev.future,
      };
    });

    return undoResultRef.current;
  }, []);

  /**
   * Redo a previously undone change.
   * Returns the next state or null if nothing to redo.
   * Uses atomic state update to prevent race conditions during rapid calls.
   */
  const redo = useCallback((): MainPathStep[] | null => {
    // Reset ref before update
    redoResultRef.current = null;

    setHistoryState((prev) => {
      // Check if we can redo using current state
      if (prev.future.length === 0) {
        return prev;
      }

      const [nextState, ...remainingFuture] = prev.future;

      // Capture result for return value
      redoResultRef.current = JSON.parse(JSON.stringify(nextState.steps));

      return {
        history: [...prev.history.slice(0, prev.currentIndex + 1), nextState],
        currentIndex: prev.currentIndex + 1,
        future: remainingFuture,
      };
    });

    return redoResultRef.current;
  }, []);

  /**
   * Clear all history.
   */
  const clearHistory = useCallback(() => {
    setHistoryState({ history: [], currentIndex: -1, future: [] });
  }, []);

  // Keyboard shortcuts (Cmd/Ctrl + Z for undo, Cmd/Ctrl + Shift + Z for redo)
  // Only registered when enableKeyboardShortcuts is true to prevent multiple handlers
  useEffect(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input to preserve native undo/redo
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

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
  }, [enableKeyboardShortcuts, undo, redo]);

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
