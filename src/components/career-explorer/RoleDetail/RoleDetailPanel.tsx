'use client';

import {
  Award,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  Building2,
  Calendar,
  ChevronRight,
  Clock,
  DollarSign,
  GraduationCap,
  Plus,
  Shield,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import React, { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CONFIDENCE_CONFIG } from '@/lib/career-explorer/confidence';
import {
  getFitScoreBgColor,
  getFitScoreColor,
  getFitScoreLabel,
} from '@/lib/career-explorer/fit-scoring';
import type {
  ConfidenceLabel,
  FitScore,
  RoleDetail,
  RoleIndustryContext,
} from '@/lib/career-explorer/types';

import { CertificationsTab } from './CertificationsTab';
import { CompensationTab } from './CompensationTab';
import { DayInLifeTab } from './DayInLifeTab';
import { OverviewTab } from './OverviewTab';
import { RelatedRolesTab } from './RelatedRolesTab';
import { SkillsTab } from './SkillsTab';

interface RoleDetailPanelProps {
  role: RoleDetail | null;
  isLoading?: boolean;
  isSaved?: boolean;
  onClose: () => void;
  onSave: (roleId: string) => void;
  onUnsave: (roleId: string) => void;
  onAddToPath: (roleId: string) => void;
  onSelectRelatedRole?: (roleId: string) => void;
}

function ConfidenceBadge({ confidence }: { confidence: ConfidenceLabel }) {
  const config = CONFIDENCE_CONFIG[confidence.level];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`${config.bgColor} ${config.color} text-xs border`}>
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs text-sm">{confidence.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function IndustryBadge({ industryContext }: { industryContext: RoleIndustryContext }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs"
          >
            <Building2 className="w-3 h-3 mr-1" />
            {industryContext.industryName}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            {industryContext.careerLevel && (
              <p className="text-xs">
                <span className="font-medium">Level:</span> {industryContext.careerLevel.name}
              </p>
            )}
            {industryContext.typicalProgression && (
              <p className="text-xs">
                <span className="font-medium">Typical path:</span>{' '}
                {industryContext.typicalProgression.slice(0, 4).join(' → ')}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function CareerLevelBadge({ level }: { level: { level: number; name: string } }) {
  return (
    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
      Level {level.level}: {level.name}
    </Badge>
  );
}

function CredentialRequirements({
  credentials,
  hasInternships,
  entryPathType,
}: {
  credentials?: string[];
  hasInternships?: boolean;
  entryPathType?: string;
}) {
  if ((!credentials || credentials.length === 0) && hasInternships !== false) {
    return null;
  }

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <Shield className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            {!hasInternships && entryPathType && (
              <p className="text-xs text-amber-800">
                <span className="font-medium">Entry path:</span> {entryPathType.replace(/_/g, ' ')}{' '}
                (not traditional internships)
              </p>
            )}
            {credentials && credentials.length > 0 && (
              <div>
                <p className="text-xs font-medium text-amber-800 mb-1">Common credentials:</p>
                <div className="flex flex-wrap gap-1">
                  {credentials.map((cred, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="bg-white text-amber-700 border-amber-300 text-xs"
                    >
                      {cred}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FitScoreDisplay({ fitScore }: { fitScore: FitScore }) {
  const scoreColor = getFitScoreColor(fitScore.overall);
  const scoreBg = getFitScoreBgColor(fitScore.overall);
  const scoreLabel = getFitScoreLabel(fitScore.overall);
  const confidenceConfig = CONFIDENCE_CONFIG[fitScore.confidence];

  return (
    <div className={`rounded-lg p-4 ${scoreBg} space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`text-3xl font-bold ${scoreColor}`}>{fitScore.overall}</div>
          <div>
            <div className={`font-medium ${scoreColor}`}>{scoreLabel}</div>
            <div className="text-xs text-neutral-500">Fit Score</div>
          </div>
        </div>
        <Badge
          variant="outline"
          className={`${confidenceConfig.bgColor} ${confidenceConfig.color} text-xs`}
        >
          {confidenceConfig.label}
        </Badge>
      </div>

      {/* Score Drivers */}
      <div className="space-y-2">
        {fitScore.drivers.map((driver, idx) => (
          <TooltipProvider key={idx}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="space-y-1 cursor-help">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-600">{driver.factor}</span>
                    <span className="text-neutral-500">{driver.score}%</span>
                  </div>
                  <Progress value={driver.score} className="h-1.5" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-sm">{driver.explanation}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    </div>
  );
}

function RoleDetailSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>

      <Skeleton className="h-32 w-full rounded-lg" />

      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}

export function RoleDetailPanel({
  role,
  isLoading,
  isSaved,
  onClose,
  onSave,
  onUnsave,
  onAddToPath,
  onSelectRelatedRole,
}: RoleDetailPanelProps) {
  const [activeTab, setActiveTab] = useState('overview');

  if (isLoading) {
    return (
      <div className="bg-white border-l border-neutral-200 h-full overflow-y-auto">
        <RoleDetailSkeleton />
      </div>
    );
  }

  if (!role) {
    return (
      <div className="bg-white border-l border-neutral-200 h-full flex items-center justify-center text-neutral-400">
        <div className="text-center p-8">
          <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Select a role to view details</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-l border-neutral-200 h-full overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white z-10 border-b border-neutral-200">
        <div className="p-4 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-neutral-900 truncate">{role.title}</h2>
              <p className="text-sm text-neutral-500 line-clamp-2">{role.description}</p>
              {/* Industry and Career Level Badges */}
              {role.industryContext && (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <IndustryBadge industryContext={role.industryContext} />
                  {role.industryContext.careerLevel && (
                    <CareerLevelBadge level={role.industryContext.careerLevel} />
                  )}
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="flex-shrink-0"
              aria-label="Close role details"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Credential Requirements (if applicable) */}
          {role.industryContext && (
            <CredentialRequirements
              credentials={role.industryContext.requiredCredentials}
              hasInternships={role.industryContext.hasInternships}
              entryPathType={role.industryContext.entryPathType}
            />
          )}

          {/* Fit Score Summary */}
          <FitScoreDisplay fitScore={role.fit_score} />

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant={isSaved ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => (isSaved ? onUnsave(role.role_id) : onSave(role.role_id))}
            >
              {isSaved ? (
                <>
                  <BookmarkCheck className="w-4 h-4 mr-2" />
                  Saved
                </>
              ) : (
                <>
                  <Bookmark className="w-4 h-4 mr-2" />
                  Save Role
                </>
              )}
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-primary-500 hover:bg-primary-600"
              onClick={() => onAddToPath(role.role_id)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Place in Plan
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="p-4">
        <TabsList className="grid grid-cols-3 w-full mb-4">
          <TabsTrigger value="overview" className="text-xs">
            Overview
          </TabsTrigger>
          <TabsTrigger value="skills" className="text-xs">
            Skills
          </TabsTrigger>
          <TabsTrigger value="more" className="text-xs">
            More
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-0">
          <OverviewTab role={role} />

          {/* Quick Compensation Preview */}
          {role.compensation && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-neutral-400" />
                    <span className="text-sm text-neutral-600">Salary Range</span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium">
                      ${(role.compensation.min / 1000).toFixed(0)}k - $
                      {(role.compensation.max / 1000).toFixed(0)}k
                    </span>
                    <ConfidenceBadge confidence={role.compensation.confidence} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Growth Outlook */}
          {role.growth_outlook && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-4 h-4 text-emerald-500 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-neutral-700">Growth Outlook</div>
                    <div className="text-sm text-neutral-500">{role.growth_outlook}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="skills" className="mt-0">
          <SkillsTab skills={role.skills} />
        </TabsContent>

        <TabsContent value="more" className="space-y-4 mt-0">
          {/* Sub-navigation for More tab */}
          <div className="space-y-2">
            <button
              onClick={() => setActiveTab('compensation')}
              className="w-full flex items-center justify-between p-3 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-neutral-400" />
                <span className="text-sm font-medium">Compensation Details</span>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400" />
            </button>

            <button
              onClick={() => setActiveTab('day-in-life')}
              className="w-full flex items-center justify-between p-3 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-neutral-400" />
                <span className="text-sm font-medium">Day in the Life</span>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400" />
            </button>

            <button
              onClick={() => setActiveTab('certifications')}
              className="w-full flex items-center justify-between p-3 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Award className="w-5 h-5 text-neutral-400" />
                <span className="text-sm font-medium">Certifications</span>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400" />
            </button>

            <button
              onClick={() => setActiveTab('related')}
              className="w-full flex items-center justify-between p-3 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-neutral-400" />
                <span className="text-sm font-medium">Related Roles</span>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400" />
            </button>
          </div>
        </TabsContent>

        <TabsContent value="compensation" className="mt-0">
          <div className="mb-4">
            <Button variant="ghost" size="sm" onClick={() => setActiveTab('more')}>
              <ChevronRight className="w-4 h-4 mr-1 rotate-180" />
              Back
            </Button>
          </div>
          <CompensationTab compensation={role.compensation} />
        </TabsContent>

        <TabsContent value="day-in-life" className="mt-0">
          <div className="mb-4">
            <Button variant="ghost" size="sm" onClick={() => setActiveTab('more')}>
              <ChevronRight className="w-4 h-4 mr-1 rotate-180" />
              Back
            </Button>
          </div>
          <DayInLifeTab description={role.day_in_life} />
        </TabsContent>

        <TabsContent value="certifications" className="mt-0">
          <div className="mb-4">
            <Button variant="ghost" size="sm" onClick={() => setActiveTab('more')}>
              <ChevronRight className="w-4 h-4 mr-1 rotate-180" />
              Back
            </Button>
          </div>
          <CertificationsTab certifications={role.certifications} />
        </TabsContent>

        <TabsContent value="related" className="mt-0">
          <div className="mb-4">
            <Button variant="ghost" size="sm" onClick={() => setActiveTab('more')}>
              <ChevronRight className="w-4 h-4 mr-1 rotate-180" />
              Back
            </Button>
          </div>
          <RelatedRolesTab relatedRoles={role.related_roles} onSelectRole={onSelectRelatedRole} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
