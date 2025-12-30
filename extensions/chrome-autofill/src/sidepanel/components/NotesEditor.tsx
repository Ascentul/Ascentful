/**
 * Notes Editor
 *
 * Component for adding/editing notes on an application.
 */

import { useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';

interface NotesEditorProps {
  initialNotes?: string;
  onSave: (notes: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export function NotesEditor({
  initialNotes = '',
  onSave,
  disabled = false,
  placeholder = 'Add notes about this application...',
}: NotesEditorProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update notes when initialNotes changes
  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (notes === initialNotes) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(notes);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setNotes(initialNotes);
    setIsEditing(false);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Save on Cmd/Ctrl + Enter
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    // Cancel on Escape
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!isEditing) {
    return (
      <div className="group">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-medium text-neutral-700">Notes</h4>
          {!disabled && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs font-medium text-primary-600 opacity-0 transition-opacity hover:text-primary-700 group-hover:opacity-100"
            >
              {initialNotes ? 'Edit' : 'Add'}
            </button>
          )}
        </div>
        {initialNotes ? (
          <p
            className={clsx(
              'whitespace-pre-wrap text-sm text-neutral-600',
              !disabled && 'cursor-pointer rounded-lg p-2 transition-colors hover:bg-neutral-50'
            )}
            onClick={() => !disabled && setIsEditing(true)}
          >
            {initialNotes}
          </p>
        ) : (
          <button
            onClick={() => !disabled && setIsEditing(true)}
            disabled={disabled}
            className={clsx(
              'w-full rounded-lg border border-dashed border-neutral-300 p-3 text-left text-sm text-neutral-400 transition-colors',
              disabled ? 'cursor-not-allowed' : 'hover:border-neutral-400 hover:text-neutral-500'
            )}
          >
            {placeholder}
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-medium text-neutral-700">Notes</h4>
        <span className="text-xs text-neutral-400">Cmd/Ctrl + Enter to save</span>
      </div>
      <textarea
        ref={textareaRef}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isSaving}
        className={clsx(
          'w-full resize-none rounded-lg border border-neutral-300 p-3 text-sm text-neutral-700 transition-colors',
          'focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500',
          isSaving && 'opacity-60'
        )}
        rows={4}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <button
          onClick={handleCancel}
          disabled={isSaving}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={clsx(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors',
            isSaving
              ? 'cursor-wait bg-primary-400'
              : 'bg-primary-500 hover:bg-primary-600'
          )}
        >
          {isSaving && (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          )}
          Save
        </button>
      </div>
    </div>
  );
}
