'use client';

import { ArrowUp, Loader2, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

const QUICK_PROMPTS = [
  'Make this more impactful',
  'Add metrics to my bullets',
  'Shorten my summary',
  'Improve my skills section',
];

interface AIChatInputProps {
  onSubmit: (message: string) => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function AIChatInput({
  onSubmit,
  placeholder = 'Ask AI for help...',
  disabled,
  className,
}: AIChatInputProps) {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to measure scrollHeight correctly
      textarea.style.height = '42px';
      // Set to scrollHeight, capped by max-height in CSS
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [message]);

  const handleSubmit = useCallback(async () => {
    if (!message.trim() || isSubmitting || disabled) return;

    setIsSubmitting(true);
    try {
      await onSubmit(message.trim());
      setMessage('');
    } finally {
      setIsSubmitting(false);
    }
  }, [message, isSubmitting, disabled, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div className={cn('p-3 border-t border-slate-200 bg-slate-50', className)}>
      <div className="relative">
        <div className="absolute left-3 top-3">
          <Sparkles className="h-4 w-4 text-primary-400" />
        </div>
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isSubmitting}
          rows={1}
          className={cn(
            'w-full pl-9 pr-10 py-2.5 text-sm rounded-xl',
            'bg-white border border-slate-200',
            'placeholder:text-slate-400 focus:border-primary-400 focus:ring-1 focus:ring-primary-400',
            'disabled:opacity-50 disabled:cursor-not-allowed resize-none',
            'min-h-[42px] max-h-[120px] overflow-y-auto',
          )}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!message.trim() || isSubmitting || disabled}
          aria-label={isSubmitting ? 'Sending message' : 'Send message'}
          className={cn(
            'absolute right-2 top-2.5',
            'p-1.5 rounded-lg transition-colors',
            message.trim() && !isSubmitting
              ? 'bg-primary-500 text-white hover:bg-primary-600'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed',
          )}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUp className="h-4 w-4" />
          )}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => setMessage(prompt)}
            disabled={disabled || isSubmitting}
            className={cn(
              'text-[10px] px-2 py-1 rounded-full',
              'bg-white border border-slate-200 text-slate-500',
              'hover:border-primary-200 hover:text-primary-600',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
