'use client';

import { useCallback, useState } from 'react';

import type { EditorAction, EditorActionType } from '@/types/resume-editor';

interface UseResumeUndoOptions {
  maxHistorySize?: number;
}

interface UseResumeUndoReturn {
  undoStack: EditorAction[];
  redoStack: EditorAction[];
  canUndo: boolean;
  canRedo: boolean;
  pushAction: (action: Omit<EditorAction, 'id' | 'timestamp'>) => void;
  undo: () => EditorAction | null;
  redo: () => EditorAction | null;
  clear: () => void;
}

/**
 * Hook for managing undo/redo functionality in the resume editor
 */
export function useResumeUndo(options: UseResumeUndoOptions = {}): UseResumeUndoReturn {
  const { maxHistorySize = 50 } = options;

  const [undoStack, setUndoStack] = useState<EditorAction[]>([]);
  const [redoStack, setRedoStack] = useState<EditorAction[]>([]);

  /**
   * Push a new action to the undo stack
   * Clears the redo stack since we're creating a new branch
   */
  const pushAction = useCallback(
    (action: Omit<EditorAction, 'id' | 'timestamp'>) => {
      const fullAction: EditorAction = {
        ...action,
        id: `action-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        timestamp: Date.now(),
      };

      setUndoStack((prev) => {
        // Trim old actions if we exceed max history size
        const newStack = [...prev, fullAction];
        if (newStack.length > maxHistorySize) {
          return newStack.slice(-maxHistorySize);
        }
        return newStack;
      });

      // Clear redo stack when a new action is pushed
      setRedoStack([]);
    },
    [maxHistorySize],
  );

  /**
   * Undo the last action
   * Returns the action that was undone (to be applied externally)
   */
  const undo = useCallback((): EditorAction | null => {
    let action: EditorAction | null = null;

    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      action = prev[prev.length - 1];
      return prev.slice(0, -1);
    });

    if (action) {
      setRedoStack((prev) => [...prev, action]);
    }

    return action;
  }, []);

  /**
   * Redo the last undone action
   * Returns the action that was redone (to be applied externally)
   */
  const redo = useCallback((): EditorAction | null => {
    let action: EditorAction | null = null;

    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      action = prev[prev.length - 1];
      return prev.slice(0, -1);
    });

    if (action) {
      setUndoStack((prev) => [...prev, action]);
    }

    return action;
  }, []);

  /**
   * Clear all history
   */
  const clear = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  return {
    undoStack,
    redoStack,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    pushAction,
    undo,
    redo,
    clear,
  };
}

// ============================================================================
// Action Creators
// ============================================================================

/**
 * Create a text edit action
 */
export function createTextEditAction(
  spanId: string,
  before: string,
  after: string,
  description?: string,
): Omit<EditorAction, 'id' | 'timestamp'> {
  return {
    type: 'text_edit',
    spanId,
    before,
    after,
    description: description || 'Edit text',
  };
}

/**
 * Create a section reorder action
 */
export function createReorderSectionAction(
  before: string[],
  after: string[],
  description?: string,
): Omit<EditorAction, 'id' | 'timestamp'> {
  return {
    type: 'reorder_section',
    before,
    after,
    description: description || 'Reorder sections',
  };
}

/**
 * Create an item reorder action
 */
export function createReorderItemAction(
  sectionId: string,
  before: string[],
  after: string[],
  description?: string,
): Omit<EditorAction, 'id' | 'timestamp'> {
  return {
    type: 'reorder_item',
    sectionId,
    before,
    after,
    description: description || 'Reorder items',
  };
}

/**
 * Create a toggle section action
 */
export function createToggleSectionAction(
  sectionId: string,
  before: boolean,
  after: boolean,
  description?: string,
): Omit<EditorAction, 'id' | 'timestamp'> {
  return {
    type: 'toggle_section',
    sectionId,
    before,
    after,
    description: description || `${after ? 'Show' : 'Hide'} section`,
  };
}

/**
 * Create an apply suggestion action
 */
export function createApplySuggestionAction(
  spanId: string,
  suggestionId: string,
  before: string,
  after: string,
  description?: string,
): Omit<EditorAction, 'id' | 'timestamp'> {
  return {
    type: 'apply_suggestion',
    spanId,
    suggestionId,
    before,
    after,
    description: description || 'Apply suggestion',
  };
}

// ============================================================================
// Types Export
// ============================================================================

export type { EditorAction, EditorActionType };
