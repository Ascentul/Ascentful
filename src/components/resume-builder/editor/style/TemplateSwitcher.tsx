'use client';

import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { TemplateId } from '../../templates/types';
import { TEMPLATE_METADATA } from '../../templates/types';

interface TemplateSwitcherProps {
  value: TemplateId;
  onChange: (templateId: TemplateId) => void;
}

const TEMPLATES: TemplateId[] = ['clean', 'modern', 'bold', 'minimal', 'classic', 'ats'];

// Simple visual preview for each template
const TemplatePreview = ({ templateId }: { templateId: TemplateId }) => {
  const previews: Record<TemplateId, React.ReactNode> = {
    clean: (
      <div className="w-full h-full bg-white p-1.5">
        <div className="h-2 w-10 bg-slate-800 rounded-sm mb-1" />
        <div className="h-1 w-14 bg-slate-300 rounded-sm mb-2" />
        <div className="space-y-1">
          <div className="h-0.5 w-full bg-slate-200 rounded-sm" />
          <div className="h-0.5 w-3/4 bg-slate-200 rounded-sm" />
        </div>
      </div>
    ),
    modern: (
      <div className="w-full h-full bg-white p-1.5">
        <div className="h-2.5 w-12 bg-primary-500 rounded-sm mb-1" />
        <div className="h-1 w-10 bg-primary-200 rounded-sm mb-2" />
        <div className="space-y-1">
          <div className="h-0.5 w-full bg-slate-200 rounded-sm" />
          <div className="h-0.5 w-4/5 bg-slate-200 rounded-sm" />
        </div>
      </div>
    ),
    bold: (
      <div className="w-full h-full bg-white p-1.5">
        <div className="h-3 w-14 bg-slate-900 rounded-sm mb-0.5" />
        <div className="h-1 w-12 bg-slate-400 rounded-sm mb-2" />
        <div className="space-y-1">
          <div className="h-1 w-full bg-slate-300 rounded-sm" />
          <div className="h-1 w-5/6 bg-slate-300 rounded-sm" />
        </div>
      </div>
    ),
    minimal: (
      <div className="w-full h-full bg-white p-2">
        <div className="h-1.5 w-8 bg-slate-700 rounded-sm mb-3" />
        <div className="space-y-1.5">
          <div className="h-0.5 w-full bg-slate-100 rounded-sm" />
          <div className="h-0.5 w-4/5 bg-slate-100 rounded-sm" />
        </div>
      </div>
    ),
    classic: (
      <div className="w-full h-full bg-white p-1.5">
        <div className="text-center mb-1">
          <div className="h-1.5 w-10 bg-slate-800 rounded-sm mx-auto mb-0.5" />
          <div className="h-0.5 w-14 bg-slate-300 rounded-sm mx-auto" />
        </div>
        <div className="border-t border-slate-200 pt-1 space-y-1">
          <div className="h-0.5 w-full bg-slate-200 rounded-sm" />
          <div className="h-0.5 w-3/4 bg-slate-200 rounded-sm" />
        </div>
      </div>
    ),
    ats: (
      <div className="w-full h-full bg-white p-1.5">
        <div className="h-1.5 w-12 bg-slate-800 rounded-sm mb-0.5" />
        <div className="h-0.5 w-16 bg-slate-400 rounded-sm mb-1.5" />
        <div className="border-t border-slate-300 pt-1 space-y-0.5">
          <div className="h-0.5 w-full bg-slate-200 rounded-sm" />
          <div className="h-0.5 w-full bg-slate-200 rounded-sm" />
          <div className="h-0.5 w-4/5 bg-slate-200 rounded-sm" />
        </div>
      </div>
    ),
  };

  return previews[templateId];
};

export function TemplateSwitcher({ value, onChange }: TemplateSwitcherProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-slate-700">Template</h3>
      <div className="grid grid-cols-3 gap-3">
        {TEMPLATES.map((templateId) => {
          const meta = TEMPLATE_METADATA[templateId];
          const isSelected = value === templateId;

          return (
            <button
              key={templateId}
              type="button"
              onClick={() => onChange(templateId)}
              className={cn(
                'relative flex flex-col rounded-lg border-2 transition-all overflow-hidden',
                'hover:border-primary-300 hover:shadow-sm',
                isSelected ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-slate-200',
              )}
            >
              {/* Preview */}
              <div className="aspect-[3/4] bg-slate-50 relative">
                <TemplatePreview templateId={templateId} />
                {isSelected && (
                  <div className="absolute top-1 right-1 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                    <Check className="h-2.5 w-2.5 text-white" />
                  </div>
                )}
              </div>

              {/* Label */}
              <div className="p-2 bg-white text-center">
                <span className="text-xs font-medium text-slate-700">{meta.name}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
