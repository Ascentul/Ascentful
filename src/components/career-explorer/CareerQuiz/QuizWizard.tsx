'use client';

import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { ChevronLeft, ChevronRight, Loader2, Save } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import type { MajorContext, QuizAnswers } from '@/lib/career-explorer/types';

import { QUIZ_CATEGORIES, QUIZ_QUESTIONS } from './questions';
import { QuizStep } from './QuizStep';

interface QuizWizardProps {
  initialAnswers?: QuizAnswers;
  initialStep?: number;
  majorContext: MajorContext;
  onComplete: (answers: QuizAnswers) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function QuizWizard({
  initialAnswers,
  initialStep,
  majorContext,
  onComplete,
  onCancel,
  isSubmitting,
}: QuizWizardProps) {
  // Query for existing draft
  const existingDraft = useQuery(api.career_explorer.getQuizDraft);
  const saveDraft = useMutation(api.career_explorer.saveQuizDraft);
  const deleteDraft = useMutation(api.career_explorer.deleteQuizDraft);

  // Determine initial state from props or draft
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(initialStep ?? 0);
  const [answers, setAnswers] = useState<QuizAnswers>(initialAnswers ?? {});
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Debounce timer for auto-save
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize from draft if no initial values provided
  useEffect(() => {
    if (!isInitialized && existingDraft !== undefined) {
      if (existingDraft && !initialAnswers) {
        setAnswers(existingDraft.answers as QuizAnswers);
        setCurrentIndex(existingDraft.current_step);
        setLastSaved(new Date(existingDraft.updated_at));
      }
      setIsInitialized(true);
    }
  }, [existingDraft, initialAnswers, isInitialized]);

  // Auto-save draft with debounce
  const autoSaveDraft = useCallback(
    async (newAnswers: QuizAnswers, step: number) => {
      try {
        setIsSaving(true);
        await saveDraft({ answers: newAnswers, current_step: step });
        setLastSaved(new Date());
      } catch {
        // Silently fail auto-save - don't interrupt user flow
        console.warn('Auto-save failed');
      } finally {
        setIsSaving(false);
      }
    },
    [saveDraft],
  );

  // Debounced auto-save on answer changes
  useEffect(() => {
    if (!isInitialized || isSubmitting) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      autoSaveDraft(answers, currentIndex);
    }, 1500); // Save after 1.5s of inactivity

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [answers, currentIndex, autoSaveDraft, isInitialized, isSubmitting]);

  const currentQuestion = QUIZ_QUESTIONS[currentIndex];
  const totalQuestions = QUIZ_QUESTIONS.length;

  // useMemo must be called before any early returns to follow React's rules of hooks
  const currentCategory = useMemo(() => {
    if (!currentQuestion) return undefined;
    return QUIZ_CATEGORIES.find((c) => c.id === currentQuestion.category);
  }, [currentQuestion]);

  // Guard against empty questions array
  if (!currentQuestion) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <p className="text-neutral-500">No quiz questions available.</p>
        <Button variant="outline" onClick={onCancel} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  const progress = ((currentIndex + 1) / totalQuestions) * 100;

  const handleAnswer = (value: string | string[] | number) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: value,
    }));
  };

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    // Delete draft on successful submission
    try {
      await deleteDraft();
    } catch {
      // Ignore delete errors - proceed with submission
    }
    onComplete(answers);
  };

  const isCurrentAnswered = answers[currentQuestion.id] !== undefined;
  const isLastQuestion = currentIndex === totalQuestions - 1;

  // Calculate required questions answered
  const requiredQuestions = QUIZ_QUESTIONS.filter(
    (q) => q.type !== 'ranking', // Rankings are optional
  );
  const answeredRequired = requiredQuestions.filter((q) => answers[q.id] !== undefined);
  const canSubmit = answeredRequired.length >= requiredQuestions.length * 0.8; // 80% threshold

  // Show loading state while initializing
  if (!isInitialized) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-2 w-full" />
        </div>
        <Card>
          <CardHeader className="pb-4">
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-between">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-neutral-500">
          <span>
            Question {currentIndex + 1} of {totalQuestions}
          </span>
          <div className="flex items-center gap-2">
            {/* Save indicator */}
            {isSaving ? (
              <Badge variant="outline" className="text-xs">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Saving...
              </Badge>
            ) : lastSaved ? (
              <Badge variant="outline" className="text-xs text-neutral-400">
                <Save className="w-3 h-3 mr-1" />
                Saved
              </Badge>
            ) : null}
            <span className="font-medium text-primary-600">{currentCategory?.name}</span>
          </div>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Major Context Display */}
      {majorContext.enabled && majorContext.major && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg px-4 py-2 text-sm text-primary-700">
          Considering your major: <strong>{majorContext.major}</strong>
        </div>
      )}

      {/* Question Card */}
      <Card>
        <CardHeader className="pb-4">
          <p className="text-sm text-neutral-500">{currentCategory?.description}</p>
        </CardHeader>
        <CardContent>
          <QuizStep
            question={currentQuestion}
            value={answers[currentQuestion.id]}
            onChange={handleAnswer}
          />
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={currentIndex === 0 ? onCancel : handlePrevious}
          disabled={isSubmitting}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          {currentIndex === 0 ? 'Cancel' : 'Previous'}
        </Button>

        <div className="flex items-center gap-2">
          {/* Skip button for non-required questions */}
          {currentQuestion.type === 'ranking' && !isLastQuestion && (
            <Button variant="ghost" onClick={handleNext} disabled={isSubmitting}>
              Skip
            </Button>
          )}

          {isLastQuestion ? (
            <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                'Get Results'
              )}
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={!isCurrentAnswered || isSubmitting}>
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>

      {/* Quick navigation dots */}
      <div className="flex justify-center gap-1.5 flex-wrap">
        {QUIZ_QUESTIONS.map((q, idx) => (
          <button
            key={q.id}
            onClick={() => setCurrentIndex(idx)}
            disabled={isSubmitting}
            className={`w-2 h-2 rounded-full transition-colors ${
              idx === currentIndex
                ? 'bg-primary-500'
                : answers[q.id] !== undefined
                  ? 'bg-primary-300'
                  : 'bg-neutral-200'
            }`}
            aria-label={`Go to question ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
