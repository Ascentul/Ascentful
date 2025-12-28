'use client';

import { cn } from '@/lib/utils';

interface FunnelProgressProps {
  currentStep: number;
  totalSteps: number;
}

export function FunnelProgress({ currentStep, totalSteps }: FunnelProgressProps) {
  const safeStep = Math.max(0, Math.min(currentStep, totalSteps - 1));
  return (
    <div
      role="progressbar"
      aria-valuenow={safeStep + 1}
      aria-valuemin={1}
      aria-valuemax={totalSteps}
      aria-label={`Step ${safeStep + 1} of ${totalSteps}`}
      className="flex items-center justify-center gap-2"
    >
      {Array.from({ length: totalSteps }).map((_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className={cn(
            'h-2 w-2 rounded-full transition-all duration-200',
            index === safeStep
              ? 'bg-primary-500 w-6'
              : index < safeStep
                ? 'bg-primary-300'
                : 'bg-slate-200',
          )}
        />
      ))}
    </div>
  );
}
