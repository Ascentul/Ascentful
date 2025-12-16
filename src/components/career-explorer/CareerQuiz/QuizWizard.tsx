'use client';

import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { MajorContext, QuizAnswers } from '@/lib/career-explorer/types';

import { QUIZ_CATEGORIES, QUIZ_QUESTIONS } from './questions';
import { QuizStep } from './QuizStep';

interface QuizWizardProps {
  initialAnswers?: QuizAnswers;
  majorContext: MajorContext;
  onComplete: (answers: QuizAnswers) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function QuizWizard({
  initialAnswers = {},
  majorContext,
  onComplete,
  onCancel,
  isSubmitting,
}: QuizWizardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>(initialAnswers);

  const currentQuestion = QUIZ_QUESTIONS[currentIndex];
  const totalQuestions = QUIZ_QUESTIONS.length;
  const progress = ((currentIndex + 1) / totalQuestions) * 100;

  const currentCategory = useMemo(() => {
    return QUIZ_CATEGORIES.find((c) => c.id === currentQuestion.category);
  }, [currentQuestion.category]);

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

  const handleSubmit = () => {
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-neutral-500">
          <span>
            Question {currentIndex + 1} of {totalQuestions}
          </span>
          <span className="font-medium text-primary-600">{currentCategory?.name}</span>
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
