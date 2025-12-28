'use client';

import { Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface SummarySectionProps {
  value: string;
  onChange: (value: string) => void;
  onGenerateAI?: () => void;
  isGenerating?: boolean;
}

export function SummarySection({
  value,
  onChange,
  onGenerateAI,
  isGenerating,
}: SummarySectionProps) {
  const charCount = value.length;
  const isGoodLength = charCount >= 100 && charCount <= 300;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Write a brief professional summary highlighting your key strengths.
        </p>
        {onGenerateAI && (
          <Button
            variant="outline"
            size="sm"
            onClick={onGenerateAI}
            disabled={isGenerating}
            className="gap-1.5 text-primary-600 border-primary-200 hover:bg-primary-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {isGenerating ? 'Generating...' : 'Generate with AI'}
          </Button>
        )}
      </div>

      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Motivated software engineer with 3+ years of experience building scalable web applications..."
        className="min-h-[120px] resize-none"
      />

      <div className="flex items-center justify-between text-xs">
        <span className={isGoodLength ? 'text-green-600' : 'text-slate-400'}>
          {charCount} characters
          {charCount < 100 && ' (aim for 100-300)'}
          {charCount > 300 && ' (consider shortening)'}
        </span>
      </div>
    </div>
  );
}
