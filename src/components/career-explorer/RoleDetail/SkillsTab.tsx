'use client';

import { AlertCircle, CheckCircle, Circle, Star } from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RoleSkill } from '@/lib/career-explorer/types';

interface SkillsTabProps {
  skills: RoleSkill[];
}

const PROFICIENCY_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; level: number }
> = {
  beginner: { label: 'Beginner', color: 'text-blue-600', bgColor: 'bg-blue-50', level: 1 },
  intermediate: {
    label: 'Intermediate',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    level: 2,
  },
  advanced: { label: 'Advanced', color: 'text-orange-600', bgColor: 'bg-orange-50', level: 3 },
  expert: { label: 'Expert', color: 'text-red-600', bgColor: 'bg-red-50', level: 4 },
};

function ProficiencyIndicator({ proficiency }: { proficiency?: string }) {
  if (!proficiency) return null;

  const config = PROFICIENCY_CONFIG[proficiency];
  if (!config) return null;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4].map((level) => (
        <div
          key={level}
          className={`w-1.5 h-3 rounded-sm ${
            level <= config.level ? config.bgColor : 'bg-neutral-200'
          }`}
        />
      ))}
      <span className={`text-xs ${config.color} ml-1`}>{config.label}</span>
    </div>
  );
}

export function SkillsTab({ skills }: SkillsTabProps) {
  const requiredSkills = skills.filter((s) => s.required);
  const niceToHaveSkills = skills.filter((s) => !s.required);

  if (skills.length === 0) {
    return (
      <div className="text-center py-8 text-neutral-400">
        <Star className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p>No skills data available</p>
        <p className="text-sm mt-2">Skills information will be added soon</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Required Skills */}
      {requiredSkills.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              Required Skills
              <Badge variant="destructive" className="ml-auto text-xs">
                Must Have
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {requiredSkills.map((skill, idx) => (
                <li key={idx} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-neutral-700">{skill.name}</span>
                  </div>
                  <ProficiencyIndicator proficiency={skill.proficiency} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Nice to Have Skills */}
      {niceToHaveSkills.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" />
              Nice to Have
              <Badge variant="secondary" className="ml-auto text-xs">
                Preferred
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {niceToHaveSkills.map((skill, idx) => (
                <li key={idx} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Circle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span className="text-sm text-neutral-600">{skill.name}</span>
                  </div>
                  <ProficiencyIndicator proficiency={skill.proficiency} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Skill Development Tip */}
      <Card className="bg-primary-50 border-primary-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Star className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-primary-700">
              <p className="font-medium mb-1">Build Your Skills</p>
              <p>
                Add required skills to your career path to track your progress and get personalized
                learning recommendations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
