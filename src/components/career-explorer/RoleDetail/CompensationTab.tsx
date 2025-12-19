'use client';

import { DollarSign, HelpCircle, TrendingUp } from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CONFIDENCE_CONFIG } from '@/lib/career-explorer/confidence';
import type { RoleCompensation } from '@/lib/career-explorer/types';

interface CompensationTabProps {
  compensation?: RoleCompensation;
}

function formatSalary(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  return `$${(amount / 1000).toFixed(0)}k`;
}

export function CompensationTab({ compensation }: CompensationTabProps) {
  if (!compensation) {
    return (
      <div className="text-center py-8 text-neutral-400">
        <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p>Compensation data not available</p>
        <p className="text-sm mt-2">Check back later for salary information</p>
      </div>
    );
  }

  const confidenceConfig = CONFIDENCE_CONFIG[compensation.confidence.level];
  const range = compensation.max - compensation.min;
  const medianPosition =
    compensation.median && range > 0
      ? ((compensation.median - compensation.min) / range) * 100
      : 50;

  return (
    <div className="space-y-4">
      {/* Main Salary Display */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              Salary Range
            </CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className={`${confidenceConfig.bgColor} ${confidenceConfig.color} text-xs cursor-help`}
                  >
                    <HelpCircle className="w-3 h-3 mr-1" />
                    {confidenceConfig.label}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-sm">{compensation.confidence.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Range Visualization */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500">Entry</span>
              {compensation.median && <span className="text-neutral-500">Median</span>}
              <span className="text-neutral-500">Senior</span>
            </div>

            <div className="relative h-8">
              {/* Range bar */}
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-3 bg-gradient-to-r from-emerald-100 via-emerald-200 to-emerald-300 rounded-full" />

              {/* Min marker */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white shadow" />

              {/* Median marker */}
              {compensation.median && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-emerald-600 rounded-full border-2 border-white shadow"
                  style={{ left: `calc(${medianPosition}% - 8px)` }}
                />
              )}

              {/* Max marker */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-emerald-700 rounded-full border-2 border-white shadow" />
            </div>

            <div className="flex justify-between text-sm font-medium">
              <span>{formatSalary(compensation.min)}</span>
              {compensation.median && (
                <span className="text-emerald-600">{formatSalary(compensation.median)}</span>
              )}
              <span>{formatSalary(compensation.max)}</span>
            </div>
          </div>

          {/* Currency Note */}
          <div className="text-xs text-neutral-400 text-center">
            All figures in {compensation.currency} per year
          </div>
        </CardContent>
      </Card>

      {/* Compensation Factors */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            Factors Affecting Pay
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-neutral-600">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
              <span>Years of experience in similar roles</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
              <span>Geographic location and cost of living</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
              <span>Industry and company size</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
              <span>Specialized skills and certifications</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
