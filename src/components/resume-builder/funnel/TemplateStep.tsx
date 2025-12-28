'use client';

import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

import { TemplateThumbnail } from '../templates/TemplateThumbnail';
import type { TemplateId } from './types';
import { TEMPLATE_OPTIONS } from './types';

interface TemplateStepProps {
  value: TemplateId | null;
  onChange: (templateId: TemplateId) => void;
}

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
            <div className="aspect-[3/4] bg-slate-50 relative">
              <TemplateThumbnail templateId={template.id} />
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
