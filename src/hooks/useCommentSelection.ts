'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { TextSelection, UseCommentSelectionReturn } from '@/components/advisor/comments/types';

/**
 * useCommentSelection Hook
 *
 * Handles text selection within a container element for inline document comments.
 * Detects when user selects text and provides the selection data for creating comments.
 *
 * @example
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null);
 * const { selection, clearSelection } = useCommentSelection(containerRef);
 *
 * return (
 *   <div ref={containerRef}>
 *     {documentContent}
 *     {selection && (
 *       <CommentInput
 *         onSubmit={(body, visibility) => {
 *           createComment({
 *             ...args,
 *             inlinePosition: {
 *               selection_start: selection.start,
 *               selection_end: selection.end,
 *               selection_text: selection.text,
 *             },
 *           });
 *           clearSelection();
 *         }}
 *       />
 *     )}
 *   </div>
 * );
 * ```
 */
export function useCommentSelection(
  containerRef: React.RefObject<HTMLElement>,
  options?: {
    minSelectionLength?: number;
    maxSelectionLength?: number;
    onSelectionChange?: (selection: TextSelection | null) => void;
  },
): UseCommentSelectionReturn {
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const lastSelectionRef = useRef<TextSelection | null>(null);

  const minLength = options?.minSelectionLength ?? 3;
  const maxLength = options?.maxSelectionLength ?? 500;

  /**
   * Get character offset from the start of the container
   */
  const getCharacterOffset = useCallback(
    (node: Node, offset: number): number => {
      const container = containerRef.current;
      if (!container) return 0;

      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);

      let charCount = 0;
      let currentNode = walker.nextNode();

      while (currentNode) {
        if (currentNode === node) {
          return charCount + offset;
        }
        charCount += currentNode.textContent?.length ?? 0;
        currentNode = walker.nextNode();
      }

      return charCount + offset;
    },
    [containerRef],
  );

  /**
   * Extract section and field info from selection context
   */
  const getSelectionContext = useCallback(
    (range: Range): { sectionId?: string; fieldPath?: string; pageNumber?: number } => {
      const startElement = range.startContainer.parentElement;
      if (!startElement) return {};

      // Look for data attributes on ancestor elements
      const sectionElement = startElement.closest('[data-section-id]');
      const fieldElement = startElement.closest('[data-field-path]');
      const pageElement = startElement.closest('[data-page]');

      return {
        sectionId: sectionElement?.getAttribute('data-section-id') ?? undefined,
        fieldPath: fieldElement?.getAttribute('data-field-path') ?? undefined,
        pageNumber: pageElement
          ? parseInt(pageElement.getAttribute('data-page') ?? '1', 10)
          : undefined,
      };
    },
    [],
  );

  /**
   * Handle mouse up - check for text selection
   */
  const handleMouseUp = useCallback(() => {
    setIsSelecting(false);

    const windowSelection = window.getSelection();
    if (!windowSelection || windowSelection.isCollapsed) {
      // Clear selection if clicking without selecting
      if (lastSelectionRef.current) {
        setSelection(null);
        lastSelectionRef.current = null;
        options?.onSelectionChange?.(null);
      }
      return;
    }

    const text = windowSelection.toString().trim();

    // Validate selection length
    if (text.length < minLength || text.length > maxLength) {
      return;
    }

    // Check if selection is within our container
    const container = containerRef.current;
    if (!container) return;

    const range = windowSelection.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) {
      return;
    }

    // Calculate character offsets
    const start = getCharacterOffset(range.startContainer, range.startOffset);
    const end = getCharacterOffset(range.endContainer, range.endOffset);

    // Get section context
    const context = getSelectionContext(range);

    // Get bounding rect for positioning
    const rect = range.getBoundingClientRect();

    const newSelection: TextSelection = {
      text,
      start,
      end,
      sectionId: context.sectionId,
      fieldPath: context.fieldPath,
      pageNumber: context.pageNumber,
      rect,
    };

    setSelection(newSelection);
    lastSelectionRef.current = newSelection;
    options?.onSelectionChange?.(newSelection);
  }, [containerRef, getCharacterOffset, getSelectionContext, minLength, maxLength, options]);

  /**
   * Handle mouse down - track selection start
   */
  const handleMouseDown = useCallback(() => {
    setIsSelecting(true);
  }, []);

  /**
   * Clear the current selection
   */
  const clearSelection = useCallback(() => {
    setSelection(null);
    lastSelectionRef.current = null;
    window.getSelection()?.removeAllRanges();
    options?.onSelectionChange?.(null);
  }, [options]);

  /**
   * Set up event listeners
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);

    // Clear selection when clicking outside container
    const handleClickOutside = (e: MouseEvent) => {
      if (container && !container.contains(e.target as Node)) {
        // Don't clear if clicking on comment sidebar or popover
        const target = e.target as HTMLElement;
        if (target.closest('[data-comment-ui]')) return;

        clearSelection();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [containerRef, handleMouseDown, handleMouseUp, clearSelection]);

  return {
    selection,
    isSelecting,
    clearSelection,
  };
}

/**
 * Helper function to highlight text at a specific position
 *
 * Used to visually indicate where a comment is attached in the document.
 */
export function highlightTextRange(
  containerRef: React.RefObject<HTMLElement>,
  start: number,
  end: number,
  className: string = 'bg-yellow-200',
): { cleanup: () => void } | null {
  const container = containerRef.current;
  if (!container) return null;

  const range = document.createRange();
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);

  let charCount = 0;
  let startNode: Node | null = null;
  let startOffset = 0;
  let endNode: Node | null = null;
  let endOffset = 0;

  let currentNode = walker.nextNode();
  while (currentNode) {
    const nodeLength = currentNode.textContent?.length ?? 0;
    const nodeEnd = charCount + nodeLength;

    // Find start position
    if (!startNode && charCount + nodeLength >= start) {
      startNode = currentNode;
      startOffset = start - charCount;
    }

    // Find end position
    if (startNode && charCount + nodeLength >= end) {
      endNode = currentNode;
      endOffset = end - charCount;
      break;
    }

    charCount = nodeEnd;
    currentNode = walker.nextNode();
  }

  if (!startNode || !endNode) return null;

  try {
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);

    // Create highlight wrapper
    const highlight = document.createElement('mark');
    highlight.className = className;
    highlight.setAttribute('data-comment-highlight', 'true');

    // Surround the range with the highlight
    range.surroundContents(highlight);

    return {
      cleanup: () => {
        // Remove the highlight wrapper, keeping the text content
        const parent = highlight.parentNode;
        if (parent) {
          while (highlight.firstChild) {
            parent.insertBefore(highlight.firstChild, highlight);
          }
          parent.removeChild(highlight);
        }
      },
    };
  } catch (error) {
    // Range may cross element boundaries - handle gracefully
    console.warn('Could not highlight text range:', error);
    return null;
  }
}
