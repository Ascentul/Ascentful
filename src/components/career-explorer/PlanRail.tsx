'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, GripVertical, Plus, X } from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PlacedStep } from '@/lib/career-explorer/types';
import { cn } from '@/lib/utils';

interface PlanRailProps {
  steps: PlacedStep[];
  isEmpty: boolean;
  onRemoveStep: (stepId: string) => void;
  onGoToPlanTab: () => void;
  className?: string;
}

// Motion variants for step chips
const chipVariants = {
  initial: {
    opacity: 0,
    scale: 0.8,
    y: 20,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 25,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    y: -10,
    transition: {
      duration: 0.2,
    },
  },
};

// Step chip component
function StepChip({
  step,
  index,
  onRemove,
  prefersReducedMotion,
}: {
  step: PlacedStep;
  index: number;
  onRemove: () => void;
  prefersReducedMotion: boolean;
}) {
  return (
    <motion.div
      layout={!prefersReducedMotion}
      variants={chipVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="relative group flex items-center gap-2 px-3 py-2 bg-white border border-neutral-200 rounded-lg shadow-sm hover:shadow-md hover:border-primary-300 transition-all"
    >
      {/* Step number */}
      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold">
        {index + 1}
      </div>

      {/* Title */}
      <span className="text-sm font-medium text-neutral-800 whitespace-nowrap max-w-[140px] truncate">
        {step.title}
      </span>

      {/* Fit score badge */}
      {step.fit_score !== undefined && (
        <Badge
          variant="secondary"
          className={cn(
            'text-xs px-1.5 py-0',
            step.fit_score >= 80
              ? 'bg-green-100 text-green-700'
              : step.fit_score >= 60
                ? 'bg-blue-100 text-blue-700'
                : 'bg-neutral-100 text-neutral-600',
          )}
        >
          {step.fit_score}%
        </Badge>
      )}

      {/* Remove button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="opacity-0 group-hover:opacity-100 absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center transition-opacity"
        aria-label={`Remove ${step.title} from plan`}
      >
        <X className="w-3 h-3 text-red-600" />
      </button>
    </motion.div>
  );
}

// Connecting line between chips
function ConnectingLine({ prefersReducedMotion }: { prefersReducedMotion: boolean }) {
  return (
    <motion.div
      initial={prefersReducedMotion ? {} : { scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: 0.3 }}
      className="flex items-center mx-1"
    >
      <div className="w-6 h-0.5 bg-neutral-200" />
      <ArrowRight className="w-3 h-3 text-neutral-300 -ml-1" />
    </motion.div>
  );
}

export function PlanRail({
  steps,
  isEmpty,
  onRemoveStep,
  onGoToPlanTab,
  className,
}: PlanRailProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;

  // Empty state
  if (isEmpty || steps.length === 0) {
    return (
      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'h-[72px] border-2 border-dashed border-neutral-200 rounded-lg bg-neutral-50/50',
          'flex items-center justify-center gap-3',
          'transition-colors hover:border-primary-300 hover:bg-primary-50/30',
          className,
        )}
      >
        <div className="flex items-center gap-2 text-neutral-400">
          <Plus className="w-4 h-4" />
          <span className="text-sm">Place roles here to build your plan</span>
        </div>
      </motion.div>
    );
  }

  // Populated state
  return (
    <motion.div
      initial={prefersReducedMotion ? {} : { opacity: 0, height: 72 }}
      animate={{ opacity: 1, height: 'auto' }}
      transition={{ duration: 0.3 }}
      className={cn('border border-neutral-200 rounded-lg bg-white shadow-sm p-4', className)}
      role="region"
      aria-label="Career plan preview"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-neutral-400" />
          <span className="text-sm font-medium text-neutral-700">Your Plan</span>
          <Badge variant="outline" className="text-xs">
            {steps.length} {steps.length === 1 ? 'step' : 'steps'}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onGoToPlanTab}
          className="text-primary-600 hover:text-primary-700 gap-1"
        >
          Edit in Plan
          <ArrowRight className="w-3 h-3" />
        </Button>
      </div>

      {/* Step timeline */}
      <div className="flex items-center overflow-x-auto pb-1 -mx-1 px-1">
        <AnimatePresence mode="popLayout">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <StepChip
                step={step}
                index={index}
                onRemove={() => onRemoveStep(step.id)}
                prefersReducedMotion={prefersReducedMotion}
              />
              {index < steps.length - 1 && (
                <ConnectingLine
                  key={`line-${step.id}`}
                  prefersReducedMotion={prefersReducedMotion}
                />
              )}
            </React.Fragment>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
