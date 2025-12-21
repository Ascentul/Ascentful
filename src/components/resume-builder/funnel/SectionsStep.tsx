'use client';

import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { ResumeStartSource, SectionId } from './types';
import { SECTION_OPTIONS } from './types';

interface SectionsStepProps {
  enabledSections: SectionId[];
  onChange: (sections: SectionId[]) => void;
  startSource: ResumeStartSource;
  // Profile data to show which sections have data
  profileData?: {
    hasWorkHistory?: boolean;
    hasEducation?: boolean;
    hasSkills?: boolean;
    hasProjects?: boolean;
    hasBio?: boolean;
    hasAchievements?: boolean;
  };
}

export function SectionsStep({
  enabledSections,
  onChange,
  startSource,
  profileData,
}: SectionsStepProps) {
  const toggleSection = (sectionId: SectionId) => {
    if (enabledSections.includes(sectionId)) {
      onChange(enabledSections.filter((id) => id !== sectionId));
    } else {
      onChange([...enabledSections, sectionId]);
    }
  };

  const hasDataForSection = (sectionId: SectionId): boolean => {
    if (!profileData) return false;
    switch (sectionId) {
      case 'experience':
        return !!profileData.hasWorkHistory;
      case 'education':
        return !!profileData.hasEducation;
      case 'skills':
        return !!profileData.hasSkills;
      case 'projects':
        return !!profileData.hasProjects;
      case 'summary':
        return !!profileData.hasBio;
      case 'achievements':
        return !!profileData.hasAchievements;
      default:
        return false;
    }
  };

  const getSubtitle = () => {
    if (startSource === 'profile') {
      return "We've pre-selected sections based on your profile data";
    }
    if (startSource === 'upload') {
      return "We've detected these sections from your uploaded resume";
    }
    return 'Select the sections you want to include';
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-slate-900">What sections do you need?</h2>
        <p className="mt-2 text-slate-500">{getSubtitle()}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-8">
        {SECTION_OPTIONS.map((section) => {
          const isEnabled = enabledSections.includes(section.id);
          const hasData = hasDataForSection(section.id);

          return (
            <button
              key={section.id}
              type="button"
              onClick={() => toggleSection(section.id)}
              className={cn(
                'flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left',
                'hover:border-primary-300',
                isEnabled ? 'border-primary-500 bg-primary-50/50' : 'border-slate-200 bg-white',
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-center w-6 h-6 rounded-md border-2 transition-colors',
                  isEnabled ? 'bg-primary-500 border-primary-500' : 'bg-white border-slate-300',
                )}
              >
                {isEnabled && <Check className="h-4 w-4 text-white" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-slate-900">{section.label}</h3>
                  {startSource === 'profile' && hasData && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      Has data
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500">{section.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-center text-sm text-slate-400 mt-4">
        You can add or remove sections later in the editor
      </p>
    </div>
  );
}
