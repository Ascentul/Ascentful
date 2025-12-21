'use client';

import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { TemplateId } from './types';
import { TEMPLATE_OPTIONS } from './types';

interface TemplateStepProps {
  value: TemplateId | null;
  onChange: (templateId: TemplateId) => void;
}

// Simple visual representation for each template
const TEMPLATE_PREVIEWS: Record<TemplateId, React.ReactNode> = {
  clean: (
    <div className="w-full h-full bg-white p-2">
      <div className="h-3 w-16 bg-slate-800 rounded mb-2" />
      <div className="h-1.5 w-20 bg-slate-300 rounded mb-3" />
      <div className="space-y-1.5">
        <div className="h-1 w-full bg-slate-200 rounded" />
        <div className="h-1 w-3/4 bg-slate-200 rounded" />
        <div className="h-1 w-5/6 bg-slate-200 rounded" />
      </div>
    </div>
  ),
  modern: (
    <div className="w-full h-full bg-white p-2">
      <div className="h-4 w-20 bg-primary-500 rounded mb-2" />
      <div className="h-1.5 w-16 bg-primary-200 rounded mb-3" />
      <div className="space-y-1.5">
        <div className="h-1 w-full bg-slate-200 rounded" />
        <div className="h-1 w-4/5 bg-slate-200 rounded" />
        <div className="h-1 w-3/4 bg-slate-200 rounded" />
      </div>
    </div>
  ),
  bold: (
    <div className="w-full h-full bg-white p-2">
      <div className="h-5 w-24 bg-slate-900 rounded mb-1" />
      <div className="h-2 w-20 bg-slate-400 rounded mb-3" />
      <div className="space-y-1.5">
        <div className="h-1.5 w-full bg-slate-300 rounded" />
        <div className="h-1.5 w-5/6 bg-slate-300 rounded" />
      </div>
    </div>
  ),
  minimal: (
    <div className="w-full h-full bg-white p-3">
      <div className="h-2 w-14 bg-slate-700 rounded mb-4" />
      <div className="space-y-2">
        <div className="h-0.5 w-full bg-slate-150 rounded" />
        <div className="h-0.5 w-4/5 bg-slate-150 rounded" />
        <div className="h-0.5 w-5/6 bg-slate-150 rounded" />
      </div>
    </div>
  ),
  classic: (
    <div className="w-full h-full bg-white p-2">
      <div className="text-center mb-2">
        <div className="h-2.5 w-16 bg-slate-800 rounded mx-auto mb-1" />
        <div className="h-1 w-24 bg-slate-300 rounded mx-auto" />
      </div>
      <div className="border-t border-slate-200 pt-2 space-y-1">
        <div className="h-1 w-full bg-slate-200 rounded" />
        <div className="h-1 w-3/4 bg-slate-200 rounded" />
      </div>
    </div>
  ),
  ats: (
    <div className="w-full h-full bg-white p-2">
      <div className="h-2 w-20 bg-slate-800 rounded mb-1" />
      <div className="h-1 w-28 bg-slate-400 rounded mb-2" />
      <div className="border-t border-slate-300 pt-2 space-y-1">
        <div className="h-1 w-full bg-slate-200 rounded" />
        <div className="h-1 w-full bg-slate-200 rounded" />
        <div className="h-1 w-4/5 bg-slate-200 rounded" />
      </div>
    </div>
  ),
};

export function TemplateStep({ value, onChange }: TemplateStepProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-slate-900">Choose a template</h2>
        <p className="mt-2 text-slate-500">You can change this anytime</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-8">
        {TEMPLATE_OPTIONS.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onChange(template.id)}
            className={cn(
              'relative flex flex-col rounded-xl border-2 transition-all overflow-hidden',
              'hover:border-primary-300 hover:shadow-md',
              value === template.id
                ? 'border-primary-500 ring-2 ring-primary-500/20'
                : 'border-slate-200',
            )}
          >
            {/* Preview */}
            <div className="aspect-[3/4] bg-slate-100 relative">
              {TEMPLATE_PREVIEWS[template.id]}
              {value === template.id && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}
            </div>

            {/* Label */}
            <div className="p-3 bg-white">
              <h3 className="font-medium text-slate-900 text-sm">{template.name}</h3>
              <p className="text-xs text-slate-500">{template.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
