'use client';

import { Briefcase, Building2, Clock, GraduationCap, HelpCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { ResumeIntent } from './types';
import { INTENT_OPTIONS } from './types';

interface IntentStepProps {
  value: ResumeIntent | null;
  onChange: (intent: ResumeIntent) => void;
}

const INTENT_ICONS: Record<ResumeIntent, React.ReactNode> = {
  internship: <Briefcase className="h-6 w-6" />,
  fulltime: <Building2 className="h-6 w-6" />,
  parttime: <Clock className="h-6 w-6" />,
  grad_school: <GraduationCap className="h-6 w-6" />,
  unsure: <HelpCircle className="h-6 w-6" />,
};

export function IntentStep({ value, onChange }: IntentStepProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-slate-900">
          What are you using this resume for?
        </h2>
        <p className="mt-2 text-slate-500">
          This helps us tailor your resume to the right audience
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 mt-8">
        {INTENT_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left',
              'hover:border-primary-300 hover:bg-primary-50/30',
              value === option.value
                ? 'border-primary-500 bg-primary-50/50 ring-2 ring-primary-500/20'
                : 'border-slate-200 bg-white',
            )}
          >
            <div
              className={cn(
                'flex items-center justify-center w-12 h-12 rounded-lg',
                value === option.value
                  ? 'bg-primary-100 text-primary-600'
                  : 'bg-slate-100 text-slate-500',
              )}
            >
              {INTENT_ICONS[option.value]}
            </div>
            <div>
              <h3 className="font-medium text-slate-900">{option.label}</h3>
              <p className="text-sm text-slate-500">{option.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
