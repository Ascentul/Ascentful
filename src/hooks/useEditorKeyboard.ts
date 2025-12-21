'use client';

import { useCallback, useEffect } from 'react';

interface UseEditorKeyboardOptions {
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onExitInlineEdit: () => void;
  inlineEditing: boolean;
  enabled?: boolean;
}

/**
 * Hook for handling keyboard shortcuts in the resume editor
 *
 * Shortcuts:
 * - Cmd/Ctrl + Z: Undo
 * - Cmd/Ctrl + Shift + Z: Redo
 * - Cmd/Ctrl + S: Save
 * - Escape: Exit inline editing
 */
export function useEditorKeyboard({
  onUndo,
  onRedo,
  onSave,
  onExitInlineEdit,
  inlineEditing,
  enabled = true,
}: UseEditorKeyboardOptions): void {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Detect platform
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? event.metaKey : event.ctrlKey;

      // Cmd/Ctrl + Z (with or without Shift)
      if (cmdKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();

        if (event.shiftKey) {
          onRedo();
        } else {
          onUndo();
        }
        return;
      }

      // Cmd/Ctrl + Y (alternative redo on Windows)
      if (!isMac && event.ctrlKey && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        onRedo();
        return;
      }

      // Cmd/Ctrl + S
      if (cmdKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        onSave();
        return;
      }

      // Escape - exit inline editing
      if (event.key === 'Escape') {
        if (inlineEditing) {
          event.preventDefault();
          onExitInlineEdit();
        }
        return;
      }
    },
    [enabled, onUndo, onRedo, onSave, onExitInlineEdit, inlineEditing],
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}

// ============================================================================
// Additional keyboard utilities
// ============================================================================

/**
 * Check if the current platform is Mac
 */
export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
}

/**
 * Get keyboard shortcut display text
 */
export function getShortcutText(action: 'undo' | 'redo' | 'save'): string {
  const isMac = isMacPlatform();
  const cmdKey = isMac ? '⌘' : 'Ctrl';

  switch (action) {
    case 'undo':
      return `${cmdKey}+Z`;
    case 'redo':
      return isMac ? `${cmdKey}+Shift+Z` : `${cmdKey}+Y`;
    case 'save':
      return `${cmdKey}+S`;
    default:
      return '';
  }
}

/**
 * Hook for specific key press detection
 */
export function useKeyPress(targetKey: string, callback: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === targetKey) {
        callback();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [targetKey, callback, enabled]);
}
