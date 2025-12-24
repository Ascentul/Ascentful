'use client';

import { BarChart2, MoreHorizontal, Scissors, Sparkles, Zap } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type AIToolbarAction = 'rewrite' | 'add-metrics' | 'shorten' | 'strengthen';

interface InlineAIToolbarProps {
  position: { x: number; y: number };
  onAction: (action: AIToolbarAction) => void;
  onClose: () => void;
  isLoading?: boolean;
}

export function InlineAIToolbar({ position, onAction, onClose, isLoading }: InlineAIToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  // Adjust position to keep toolbar in viewport
  useEffect(() => {
    if (!toolbarRef.current) return;

    const rect = toolbarRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    let x = position.x;
    let y = position.y - 40; // Position above the text

    // Keep in horizontal bounds
    if (x + rect.width > viewportWidth - 16) {
      x = viewportWidth - rect.width - 16;
    }
    if (x < 16) {
      x = 16;
    }

    // If too close to top, position below
    if (y < 16) {
      y = position.y + 24;
    }

    setAdjustedPosition({ x, y });
  }, [position]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleAction = useCallback(
    (action: AIToolbarAction) => {
      if (isLoading) return;
      onAction(action);
    },
    [isLoading, onAction],
  );

  return (
    <div
      ref={toolbarRef}
      style={{
        position: 'fixed',
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        zIndex: 9999,
      }}
      className={cn(
        'flex items-center gap-0.5 p-1 rounded-lg shadow-lg',
        'bg-white border border-slate-200',
        isLoading && 'opacity-75 pointer-events-none',
      )}
    >
      {/* Main AI Rewrite */}
      <button
        type="button"
        onClick={() => handleAction('rewrite')}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium',
          'bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors',
        )}
        title="AI Rewrite"
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span>Rewrite</span>
      </button>

      {/* Separator */}
      <div className="w-px h-5 bg-slate-200 mx-0.5" />

      {/* Quick Actions */}
      <button
        type="button"
        onClick={() => handleAction('add-metrics')}
        className={cn(
          'p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900',
          'transition-colors',
        )}
        title="Add Metrics"
      >
        <BarChart2 className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        onClick={() => handleAction('strengthen')}
        className={cn(
          'p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900',
          'transition-colors',
        )}
        title="Strengthen Verbs"
      >
        <Zap className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        onClick={() => handleAction('shorten')}
        className={cn(
          'p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900',
          'transition-colors',
        )}
        title="Shorten"
      >
        <Scissors className="h-3.5 w-3.5" />
      </button>

      {/* More Options */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600',
              'transition-colors',
            )}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => handleAction('rewrite')}>
            <Sparkles className="h-4 w-4 mr-2" />
            Full AI Rewrite
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAction('add-metrics')}>
            <BarChart2 className="h-4 w-4 mr-2" />
            Add Metrics
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAction('strengthen')}>
            <Zap className="h-4 w-4 mr-2" />
            Strengthen Verbs
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAction('shorten')}>
            <Scissors className="h-4 w-4 mr-2" />
            Make Concise
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
