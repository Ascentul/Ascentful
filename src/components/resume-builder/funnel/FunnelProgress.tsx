'use client';

import { cn } from '@/lib/utils';

interface FunnelProgressProps {
  currentStep: number;
  totalSteps: number;
}

export function FunnelProgress({ currentStep, totalSteps }: FunnelProgressProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: totalSteps }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'h-2 w-2 rounded-full transition-colors duration-200',
            index === currentStep
              ? 'bg-primary-500 w-6'
              : index < currentStep
                ? 'bg-primary-300'
                : 'bg-slate-200',
          )}
        />
      ))}
    </div>
  );
}
