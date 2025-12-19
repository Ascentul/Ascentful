'use client';

import { Award, Clock, DollarSign, TrendingUp } from 'lucide-react';
import React from 'react';

interface RoleHoverCardProps {
  title: string;
  category: string;
  fitScore: number;
  relationship?: string;
}

// Mock data generators based on role title - in production, this would come from an API
function getSalaryRange(title: string): { min: number; max: number } {
  const titleLower = title.toLowerCase();

  // Executive/C-suite
  if (
    titleLower.includes('chief') ||
    titleLower.includes('ceo') ||
    titleLower.includes('cto') ||
    titleLower.includes('cfo') ||
    titleLower.includes('cmo')
  ) {
    return { min: 200000, max: 400000 };
  }
  // VP level
  if (titleLower.includes('vp') || titleLower.includes('vice president')) {
    return { min: 150000, max: 280000 };
  }
  // Director level
  if (titleLower.includes('director') || titleLower.includes('head of')) {
    return { min: 120000, max: 200000 };
  }
  // Senior/Lead
  if (
    titleLower.includes('senior') ||
    titleLower.includes('lead') ||
    titleLower.includes('principal') ||
    titleLower.includes('staff')
  ) {
    return { min: 100000, max: 160000 };
  }
  // Manager
  if (titleLower.includes('manager')) {
    return { min: 80000, max: 130000 };
  }
  // Intern
  if (titleLower.includes('intern')) {
    return { min: 40000, max: 70000 };
  }
  // Entry level / Junior
  if (
    titleLower.includes('junior') ||
    titleLower.includes('associate') ||
    titleLower.includes('entry')
  ) {
    return { min: 50000, max: 80000 };
  }
  // Default mid-level
  return { min: 70000, max: 110000 };
}

function getExperienceYears(title: string): string {
  const titleLower = title.toLowerCase();

  if (
    titleLower.includes('chief') ||
    titleLower.includes('ceo') ||
    titleLower.includes('cto') ||
    titleLower.includes('cfo') ||
    titleLower.includes('cmo')
  ) {
    return '15+ years';
  }
  if (titleLower.includes('vp') || titleLower.includes('vice president')) {
    return '12-15 years';
  }
  if (titleLower.includes('director') || titleLower.includes('head of')) {
    return '8-12 years';
  }
  if (
    titleLower.includes('senior') ||
    titleLower.includes('lead') ||
    titleLower.includes('principal') ||
    titleLower.includes('staff')
  ) {
    return '5-8 years';
  }
  if (titleLower.includes('manager')) {
    return '4-7 years';
  }
  if (titleLower.includes('intern')) {
    return '0 years';
  }
  if (
    titleLower.includes('junior') ||
    titleLower.includes('associate') ||
    titleLower.includes('entry')
  ) {
    return '0-2 years';
  }
  return '2-5 years';
}

function getGrowthPotential(relationship?: string): { label: string; color: string } {
  switch (relationship) {
    case 'promotion':
      return { label: 'High Growth', color: 'text-emerald-600' };
    case 'lateral':
      return { label: 'Skill Expansion', color: 'text-blue-600' };
    case 'entry_level':
      return { label: 'Foundation Role', color: 'text-purple-600' };
    default:
      return { label: 'Career Move', color: 'text-neutral-600' };
  }
}

function formatSalary(amount: number): string {
  return `$${(amount / 1000).toFixed(0)}k`;
}

export function RoleHoverCard({ title, category, fitScore, relationship }: RoleHoverCardProps) {
  const salary = getSalaryRange(title);
  const experience = getExperienceYears(title);
  const growth = getGrowthPotential(relationship);

  return (
    <div className="w-64 bg-white rounded-xl shadow-lg border border-neutral-200 p-4 z-50">
      {/* Header */}
      <div className="mb-3 pb-3 border-b border-neutral-100">
        <h3 className="font-semibold text-neutral-900 text-sm leading-tight">{title}</h3>
        <p className="text-xs text-neutral-500 mt-0.5">{category}</p>
      </div>

      {/* Stats Grid */}
      <div className="space-y-2.5">
        {/* Salary Range */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-neutral-500">Salary Range</p>
            <p className="text-sm font-medium text-neutral-900">
              {formatSalary(salary.min)} - {formatSalary(salary.max)}
            </p>
          </div>
        </div>

        {/* Experience Required */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-neutral-500">Experience</p>
            <p className="text-sm font-medium text-neutral-900">{experience}</p>
          </div>
        </div>

        {/* Fit Score */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Award className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-neutral-500">Fit Score</p>
            <p className="text-sm font-medium text-neutral-900">{fitScore}% match</p>
          </div>
        </div>

        {/* Growth Potential */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <div>
            <p className="text-xs text-neutral-500">Growth Type</p>
            <p className={`text-sm font-medium ${growth.color}`}>{growth.label}</p>
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <div className="mt-3 pt-3 border-t border-neutral-100">
        <p className="text-xs text-neutral-400 text-center">Click to add to your path</p>
      </div>
    </div>
  );
}
