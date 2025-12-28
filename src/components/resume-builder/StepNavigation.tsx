'use client';

import { ArrowRight } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';

import { STEPS } from './hooks/useResumeBuilder';

interface StepNavigationProps {
  currentStep: number;
  onStepChange: (step: number) => void;
  onNext: () => void;
  onPrev: () => void;
  onFinish?: () => void;
}

export function StepNavigation({
  currentStep,
  onStepChange,
  onNext,
  onPrev,
  onFinish,
}: StepNavigationProps) {
  const safeCurrentStep = Math.max(0, Math.min(currentStep, STEPS.length - 1));
  const isLastStep = safeCurrentStep === STEPS.length - 1;
  const isFirstStep = safeCurrentStep === 0;
  const currentStepData = STEPS[safeCurrentStep];
  const nextLabel = isLastStep ? 'Finish' : `Next: ${currentStepData.nextLabel}`;
  const isFinishDisabled = isLastStep && !onFinish;
  const handleNextClick = () => {
    if (isLastStep && onFinish) {
      onFinish();
    } else if (!isLastStep) {
      onNext();
    }
  };

  return (
    <div className="flex items-center justify-between py-4 px-6 border-t border-slate-200 bg-white">
      {/* Progress dots */}
      <div className="flex items-center gap-2">
        {STEPS.map((step, index) => (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepChange(index)}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              index === safeCurrentStep
                ? 'bg-primary-500 w-6'
                : index < safeCurrentStep
                  ? 'bg-primary-300'
                  : 'bg-slate-200'
            }`}
            aria-label={`Go to ${step.label}`}
          />
        ))}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center gap-3">
        {!isFirstStep && (
          <Button variant="ghost" onClick={onPrev} className="text-slate-600">
            Back
          </Button>
        )}
        <Button
          onClick={handleNextClick}
          disabled={isFinishDisabled}
          className="bg-primary-500 hover:bg-primary-600 text-white px-6"
        >
          {nextLabel}
          {!isLastStep && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
