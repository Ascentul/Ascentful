'use client';

import { Loader2, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import type { ResumeData } from '@/components/resume/ResumeDocument';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AIQuickGeneratePopupProps {
  open: boolean;
  onClose: () => void;
  section: string;
  sectionLabel: string;
  currentResumeData: Partial<ResumeData>;
  currentValue?: string;
  onAccept: (value: string) => void;
}

export function AIQuickGeneratePopup({
  open,
  onClose,
  section,
  sectionLabel,
  currentResumeData,
  currentValue,
  onAccept,
}: AIQuickGeneratePopupProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateContent = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setGeneratedContent(null);

    try {
      const response = await fetch('/api/ai/resume-guidance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section,
          isInitial: false,
          message: `Generate a professional ${sectionLabel.toLowerCase()} for my resume. Make it compelling and tailored to my background. Return ONLY the content text, nothing else.`,
          currentResumeData,
          quickGenerate: true,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate content');

      const data = await response.json();

      // Try to get the resume content value, or fall back to the response text
      const content = data.resumeContent?.value || data.response;
      setGeneratedContent(content);
    } catch (err) {
      console.error('Failed to generate content:', err);
      setError('Failed to generate content. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [section, sectionLabel, currentResumeData]);

  // Generate content when popup opens
  useEffect(() => {
    if (open) {
      generateContent();
    } else {
      // Reset state when closed
      setGeneratedContent(null);
      setError(null);
      setIsLoading(false);
    }
  }, [open, generateContent]);

  const handleAccept = () => {
    if (generatedContent) {
      onAccept(generatedContent);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      {/* Popup */}
      <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary-500" />
            <span className="font-medium text-slate-900">AI {sectionLabel}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
              <p className="text-sm text-slate-500">
                Generating your {sectionLabel.toLowerCase()}...
              </p>
            </div>
          ) : error ? (
            <div className="py-8 text-center">
              <p className="text-sm text-red-500 mb-4">{error}</p>
              <Button type="button" variant="outline" size="sm" onClick={generateContent}>
                Try Again
              </Button>
            </div>
          ) : generatedContent ? (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 max-h-[300px] overflow-y-auto">
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {generatedContent}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {generatedContent && !isLoading && (
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAccept}
              className="bg-primary-500 hover:bg-primary-600"
            >
              Accept
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
