'use client';

import {
  Award,
  BookOpen,
  Briefcase,
  Code,
  Edit2,
  FolderKanban,
  GitBranch,
  Goal,
  GraduationCap,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type {
  MainPathStep as MainPathStepType,
  StepTimeframe,
  StepType,
} from '@/lib/career-explorer/types';
import { cn } from '@/lib/utils';

interface MainPathStepProps {
  step: MainPathStepType;
  index: number;
  isEditing?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onConvertToGoal?: () => void;
  readOnly?: boolean;
}

const STEP_TYPE_CONFIG: Record<StepType, { icon: React.ReactNode; color: string; label: string }> =
  {
    role: {
      icon: <Briefcase className="w-4 h-4" />,
      color: 'bg-blue-100 text-blue-700 border-blue-200',
      label: 'Role',
    },
    bridge: {
      icon: <GitBranch className="w-4 h-4" />,
      color: 'bg-amber-100 text-amber-700 border-amber-200',
      label: 'Bridge',
    },
    project: {
      icon: <FolderKanban className="w-4 h-4" />,
      color: 'bg-violet-100 text-violet-700 border-violet-200',
      label: 'Project',
    },
    internship: {
      icon: <GraduationCap className="w-4 h-4" />,
      color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      label: 'Internship',
    },
    certification: {
      icon: <Award className="w-4 h-4" />,
      color: 'bg-rose-100 text-rose-700 border-rose-200',
      label: 'Certification',
    },
    // New step types for Career Dreamer
    foundation_skill: {
      icon: <BookOpen className="w-4 h-4" />,
      color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      label: 'Foundation Skill',
    },
    portfolio_project: {
      icon: <Code className="w-4 h-4" />,
      color: 'bg-violet-100 text-violet-700 border-violet-200',
      label: 'Portfolio Project',
    },
    stepping_stone: {
      icon: <TrendingUp className="w-4 h-4" />,
      color: 'bg-teal-100 text-teal-700 border-teal-200',
      label: 'Stepping Stone',
    },
    target_role: {
      icon: <Target className="w-4 h-4" />,
      color: 'bg-rose-100 text-rose-700 border-rose-200',
      label: 'Target Role',
    },
  };

const TIMEFRAME_LABELS: Record<StepTimeframe, string> = {
  '6m': '6 months',
  '12m': '1 year',
  '24m': '2 years',
  '36m': '3 years',
  semester_1: 'Semester 1',
  semester_2: 'Semester 2',
  summer: 'Summer',
};

export function MainPathStep({
  step,
  index,
  isEditing,
  onEdit,
  onDelete,
  onConvertToGoal,
  readOnly,
}: MainPathStepProps) {
  const config = STEP_TYPE_CONFIG[step.step_type] || {
    icon: <Briefcase className="w-4 h-4" />,
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    label: step.step_type,
  };

  return (
    <Card
      className={cn(
        'relative transition-all',
        isEditing && 'ring-2 ring-primary-500',
        !readOnly && 'hover:shadow-md',
      )}
    >
      <div>
        <CardHeader className="pb-2 flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn('gap-1', config.color)}>
                {config.icon}
                {config.label}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {TIMEFRAME_LABELS[step.timeframe]}
              </Badge>
            </div>
            <h4 className="font-semibold text-lg">{step.title}</h4>
          </div>

          {/* Step Index */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-sm font-bold text-primary-700">{index + 1}</span>
            </div>

            {/* Actions */}
            {!readOnly && (
              <div className="flex items-center gap-1">
                {onConvertToGoal && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                    onClick={onConvertToGoal}
                    aria-label="Create goal from step"
                  >
                    <Goal className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onEdit}
                  aria-label="Edit step"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={onDelete}
                  aria-label="Delete step"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Skills to Build */}
          {step.details.skills_to_build && step.details.skills_to_build.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-neutral-500">Skills to Build</p>
              <div className="flex flex-wrap gap-1">
                {step.details.skills_to_build.map((skill, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Projects */}
          {step.details.projects && step.details.projects.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-neutral-500">Projects</p>
              <ul className="text-sm text-neutral-600 space-y-0.5">
                {step.details.projects.map((project, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-primary-400 mt-1.5">•</span>
                    {project}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Certifications */}
          {step.details.certifications && step.details.certifications.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-neutral-500">Certifications</p>
              <div className="flex flex-wrap gap-1">
                {step.details.certifications.map((cert, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs gap-1">
                    <Award className="w-3 h-3" />
                    {cert}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Experience Targets */}
          {step.details.experience_targets && step.details.experience_targets.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-neutral-500">Experience Targets</p>
              <ul className="text-sm text-neutral-600 space-y-0.5">
                {step.details.experience_targets.map((target, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-emerald-400 mt-1.5">✓</span>
                    {target}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Notes */}
          {step.notes && (
            <div className="pt-2 border-t">
              <p className="text-sm text-neutral-500 italic">{step.notes}</p>
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  );
}
