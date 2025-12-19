'use client';

import { CheckCircle, Lightbulb, Target } from 'lucide-react';
import React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RoleDetail } from '@/lib/career-explorer/types';

interface OverviewTabProps {
  role: RoleDetail;
}

export function OverviewTab({ role }: OverviewTabProps) {
  // Get top required skills (first 5)
  const topSkills = role.skills.filter((s) => s.required).slice(0, 5);

  // Get key strengths from fit score drivers
  const strengths = role.fit_score.drivers.filter((d) => d.score >= 70).slice(0, 3);

  const growthAreas = role.fit_score.drivers.filter((d) => d.score < 50).slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Role Description */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="w-4 h-4 text-primary-500" />
            About This Role
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-600 leading-relaxed">{role.description}</p>
        </CardContent>
      </Card>

      {/* Top Required Skills */}
      {topSkills.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              Key Requirements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {topSkills.map((skill, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                  <span className="text-neutral-700">{skill.name}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Your Strengths for This Role */}
      {strengths.length > 0 && (
        <Card className="bg-emerald-50 border-emerald-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-emerald-700">
              <CheckCircle className="w-4 h-4" />
              Your Strengths
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {strengths.map((driver, idx) => (
                <li key={idx} className="text-sm text-emerald-700">
                  <span className="font-medium">{driver.factor}:</span> {driver.explanation}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Areas for Growth */}
      {growthAreas.length > 0 && (
        <Card className="bg-amber-50 border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
              <Lightbulb className="w-4 h-4" />
              Growth Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {growthAreas.map((driver, idx) => (
                <li key={idx} className="text-sm text-amber-700">
                  <span className="font-medium">{driver.factor}:</span> {driver.explanation}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
