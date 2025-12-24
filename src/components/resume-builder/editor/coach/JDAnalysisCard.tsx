'use client';

import {
  Briefcase,
  Building2,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  MapPin,
  Star,
} from 'lucide-react';
import { useState } from 'react';

import type { JDAnalysisResponse } from '@/lib/ai/schemas';
import { cn } from '@/lib/utils';

interface JDAnalysisCardProps {
  analysis: JDAnalysisResponse;
  loading?: boolean;
}

export function JDAnalysisCard({ analysis, loading }: JDAnalysisCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'requirements' | 'keywords'>('overview');

  if (loading) {
    return (
      <div className="p-4 border-b border-slate-200">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-slate-200 rounded w-3/4" />
          <div className="h-3 bg-slate-200 rounded w-1/2" />
          <div className="h-3 bg-slate-200 rounded w-2/3" />
        </div>
      </div>
    );
  }

  const { basics, requirements, keywords } = analysis;

  const locationTypeLabel =
    {
      onsite: 'On-site',
      hybrid: 'Hybrid',
      remote: 'Remote',
    }[basics.locationType] ?? basics.locationType;

  const seniorityLabel =
    {
      entry: 'Entry Level',
      mid: 'Mid Level',
      senior: 'Senior',
      lead: 'Lead',
      executive: 'Executive',
    }[basics.seniorityLevel] ?? basics.seniorityLevel;

  return (
    <div className="border-b border-slate-200">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary-500" />
          <div className="text-left">
            <span className="text-sm font-medium text-slate-900">{basics.title}</span>
            <span className="text-xs text-slate-500 ml-2">@ {basics.company}</span>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4">
          {/* Quick Info */}
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-full">
              <MapPin className="h-3 w-3" />
              {basics.location} • {locationTypeLabel}
            </span>
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-primary-50 text-primary-700 rounded-full">
              {seniorityLabel}
            </span>
            {basics.estimatedYearsExperience.min > 0 && (
              <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-full">
                {basics.estimatedYearsExperience.min}
                {basics.estimatedYearsExperience.max
                  ? `-${basics.estimatedYearsExperience.max}`
                  : '+'}{' '}
                years
              </span>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-3 bg-slate-100 p-1 rounded-lg">
            {(['overview', 'requirements', 'keywords'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 text-xs py-1.5 rounded-md transition-colors capitalize',
                  activeTab === tab
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-2">
              <p className="text-xs text-slate-600">
                Standardized Title: <span className="font-medium">{basics.standardizedTitle}</span>
              </p>
              {requirements.education.required && (
                <div className="flex items-start gap-2 text-xs text-slate-600">
                  <GraduationCap className="h-3.5 w-3.5 mt-0.5 text-slate-400" />
                  <span>
                    Required: <span className="font-medium">{requirements.education.required}</span>
                    {requirements.education.fieldOfStudy.length > 0 && (
                      <> in {requirements.education.fieldOfStudy.join(' or ')}</>
                    )}
                  </span>
                </div>
              )}
              {requirements.education.preferred && (
                <div className="flex items-start gap-2 text-xs text-slate-500">
                  <Star className="h-3.5 w-3.5 mt-0.5 text-amber-400" />
                  <span>Preferred: {requirements.education.preferred}</span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'requirements' && (
            <div className="space-y-3">
              {/* Required */}
              {requirements.required.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-slate-700 mb-1.5">Required</h4>
                  <ul className="space-y-1">
                    {requirements.required.slice(0, 5).map((req) => (
                      <li
                        key={req.item}
                        className="text-xs text-slate-600 flex items-start gap-1.5"
                      >
                        <span
                          className={cn(
                            'mt-0.5',
                            req.importance === 'critical'
                              ? 'text-red-500'
                              : req.importance === 'high'
                                ? 'text-orange-500'
                                : 'text-slate-400',
                          )}
                        >
                          •
                        </span>
                        <span>
                          {req.item}
                          <span className="text-slate-400 ml-1">({req.type})</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preferred */}
              {requirements.preferred.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-slate-500 mb-1.5">Preferred</h4>
                  <ul className="space-y-1">
                    {requirements.preferred.slice(0, 3).map((req) => (
                      <li
                        key={req.item}
                        className="text-xs text-slate-500 flex items-start gap-1.5"
                      >
                        <span className="text-slate-300 mt-0.5">•</span>
                        {req.item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {activeTab === 'keywords' && (
            <div className="space-y-3">
              {/* Technical */}
              {keywords.technical.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-slate-700 mb-1.5">Technical</h4>
                  <div className="flex flex-wrap gap-1">
                    {keywords.technical.slice(0, 8).map((kw) => (
                      <span
                        key={kw.keyword}
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full',
                          kw.mustIncludeInResume
                            ? 'bg-primary-100 text-primary-700 font-medium'
                            : 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {kw.keyword}
                        {kw.frequency > 1 && (
                          <span className="text-slate-400 ml-0.5">×{kw.frequency}</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Soft Skills */}
              {keywords.soft.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-slate-500 mb-1.5">Soft Skills</h4>
                  <div className="flex flex-wrap gap-1">
                    {keywords.soft.slice(0, 5).map((kw) => (
                      <span
                        key={kw.keyword}
                        className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700"
                      >
                        {kw.keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Domain */}
              {keywords.domain.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-slate-500 mb-1.5">Domain</h4>
                  <div className="flex flex-wrap gap-1">
                    {keywords.domain.slice(0, 4).map((kw) => (
                      <span
                        key={kw.keyword}
                        className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700"
                      >
                        {kw.keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
