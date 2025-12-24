'use client';

import { AlertCircle, Check, Loader2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface EditorHeaderProps {
  title: string;
  onTitleChange?: (title: string) => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt?: number | null;
  onClose: () => void;
}

export function EditorHeader({
  title,
  onTitleChange,
  saveStatus,
  lastSavedAt,
  onClose,
}: EditorHeaderProps) {
  const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const getSaveStatusDisplay = () => {
    switch (saveStatus) {
      case 'saving':
        return (
          <span className="flex items-center gap-1.5 text-sm text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Saving...
          </span>
        );
      case 'saved':
        return (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <Check className="h-3.5 w-3.5" />
            {lastSavedAt ? `Saved at ${formatTime(lastSavedAt)}` : 'All changes saved'}
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1.5 text-sm text-red-500">
            <AlertCircle className="h-3.5 w-3.5" />
            Error saving
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
      <div className="flex items-center gap-4">
        {/* Title - editable */}
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange?.(e.target.value)}
          className="text-lg font-semibold text-slate-900 bg-transparent border-none focus:outline-none focus:ring-0 min-w-[200px]"
          placeholder="Untitled Resume"
          aria-label="Resume title"
        />

        {/* Save status */}
        <div className="h-6 flex items-center">{getSaveStatusDisplay()}</div>
      </div>

      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="rounded-full hover:bg-slate-100"
        aria-label="Close editor"
      >
        <X className="h-5 w-5" />
      </Button>
    </div>
  );
}
