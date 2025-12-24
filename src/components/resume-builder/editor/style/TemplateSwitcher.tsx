'use client';

import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

import { TemplateThumbnail } from '../../templates/TemplateThumbnail';
import type { TemplateId } from '../../templates/types';
import { TEMPLATE_METADATA } from '../../templates/types';

interface TemplateSwitcherProps {
  value: TemplateId;
  onChange: (templateId: TemplateId) => void;
}

const TEMPLATES = Object.keys(TEMPLATE_METADATA) as TemplateId[];

export function TemplateSwitcher({ value, onChange }: TemplateSwitcherProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-slate-700">Template</h3>
      <div className="grid grid-cols-3 gap-3">
        {TEMPLATES.map((templateId) => {
          const meta = TEMPLATE_METADATA[templateId];
          if (!meta) return null;
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
                <TemplateThumbnail templateId={templateId} />
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
