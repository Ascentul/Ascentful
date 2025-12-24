'use client';

import { Check, Download, Loader2, Redo2, Share2, Undo2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getShortcutText } from '@/hooks/useEditorKeyboard';

interface EditorTopBarProps {
  title: string;
  onTitleChange: (title: string) => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt?: number | null;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onShare?: () => void;
  onClose: () => void;
  isExporting?: boolean;
}

export function EditorTopBar({
  title,
  onTitleChange,
  saveStatus,
  lastSavedAt,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onExport,
  onShare,
  onClose,
  isExporting,
}: EditorTopBarProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(title);

  useEffect(() => {
    if (!isEditingTitle) {
      setTitleValue(title);
    }
  }, [title, isEditingTitle]);

  const handleTitleSubmit = () => {
    if (titleValue.trim()) {
      onTitleChange(titleValue.trim());
    } else {
      setTitleValue(title);
    }
    setIsEditingTitle(false);
  };

  return (
    <TooltipProvider>
      <div className="h-14 px-4 border-b border-slate-200 bg-white flex items-center sticky top-0 z-50">
        {/* Left section: Close + Undo/Redo */}
        <div className="flex items-center gap-2 flex-1">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-900"
            aria-label="Close editor"
          >
            <X className="h-5 w-5" />
          </Button>

          {/* Divider */}
          <div className="w-px h-6 bg-slate-200 mx-1" />

          {/* Undo/Redo */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onUndo}
                  disabled={!canUndo}
                  className="text-slate-500 hover:text-slate-900 disabled:opacity-30"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Undo ({getShortcutText('undo')})</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onRedo}
                  disabled={!canRedo}
                  className="text-slate-500 hover:text-slate-900 disabled:opacity-30"
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Redo ({getShortcutText('redo')})</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Center section: Title + Save status */}
        <div className="flex flex-col items-center justify-center">
          {isEditingTitle ? (
            <Input
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSubmit();
                if (e.key === 'Escape') {
                  setTitleValue(title);
                  setIsEditingTitle(false);
                }
              }}
              className="h-7 w-[200px] text-sm font-medium text-center"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setIsEditingTitle(true)}
              className="text-sm font-medium text-slate-900 hover:text-primary-600 transition-colors truncate max-w-[250px]"
              aria-label={`Edit title: ${title}`}
            >
              {title}
            </button>
          )}
          {/* Save status */}
          <SaveStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
        </div>

        {/* Right section: Share + Export */}
        <div className="flex items-center gap-2 flex-1 justify-end">
          {/* Share button */}
          {onShare && (
            <Button variant="ghost" size="sm" onClick={onShare} className="gap-2 text-slate-600">
              <Share2 className="h-4 w-4" />
              <span>Share</span>
            </Button>
          )}

          {/* Export button */}
          <Button
            onClick={onExport}
            disabled={isExporting}
            className="gap-2 bg-primary-500 hover:bg-primary-600"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span>Export</span>
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}

// ============================================================================
// Save Status Indicator
// ============================================================================

function SaveStatusIndicator({
  status,
  lastSavedAt,
}: {
  status: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt?: number | null;
}) {
  const formatLastSaved = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Saved just now';
    if (minutes === 1) return 'Saved 1 min ago';
    if (minutes < 60) return `Saved ${minutes} mins ago`;

    const hours = Math.floor(minutes / 60);
    if (hours === 1) return 'Saved 1 hour ago';
    if (hours < 24) return `Saved ${hours} hours ago`;

    return 'Saved';
  };

  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-500">
      {status === 'saving' && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Saving...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <Check className="h-3 w-3 text-green-500" />
          <span>{lastSavedAt ? formatLastSaved(lastSavedAt) : 'Saved'}</span>
        </>
      )}
      {status === 'error' && <span className="text-red-500">Failed to save</span>}
    </div>
  );
}
