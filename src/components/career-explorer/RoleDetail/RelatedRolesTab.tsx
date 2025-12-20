'use client';

import {
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  Shuffle,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getFitScoreColor } from '@/lib/career-explorer/fit-scoring';

type RelationshipType = 'entry_level' | 'lateral' | 'promotion' | 'pivot' | 'specialization';

interface RelatedRole {
  role_id: string;
  title: string;
  fit_score: number;
  relationship?: RelationshipType;
}

interface RelatedRolesTabProps {
  relatedRoles?: RelatedRole[];
  onSelectRole?: (roleId: string) => void;
}

const RELATIONSHIP_CONFIG: Record<
  RelationshipType,
  { label: string; icon: React.ReactNode; color: string; bgColor: string }
> = {
  promotion: {
    label: 'Promotion',
    icon: <ArrowUp className="w-3 h-3" />,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50 border-emerald-200',
  },
  lateral: {
    label: 'Lateral Move',
    icon: <ArrowLeftRight className="w-3 h-3" />,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 border-blue-200',
  },
  entry_level: {
    label: 'Entry Level',
    icon: <Target className="w-3 h-3" />,
    color: 'text-purple-700',
    bgColor: 'bg-purple-50 border-purple-200',
  },
  pivot: {
    label: 'Career Pivot',
    icon: <Shuffle className="w-3 h-3" />,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50 border-amber-200',
  },
  specialization: {
    label: 'Specialization',
    icon: <Target className="w-3 h-3" />,
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50 border-indigo-200',
  },
};

export function RelatedRolesTab({ relatedRoles, onSelectRole }: RelatedRolesTabProps) {
  if (!relatedRoles || relatedRoles.length === 0) {
    return (
      <div className="text-center py-8 text-neutral-400">
        <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p>No related roles found</p>
        <p className="text-sm mt-2">Explore the galaxy to discover similar roles</p>
      </div>
    );
  }

  // Sort by fit score descending
  const sortedRoles = [...relatedRoles].sort((a, b) => b.fit_score - a.fit_score);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            Similar Roles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {sortedRoles.map((role) => {
              const scoreColor = getFitScoreColor(role.fit_score);
              const relationshipConfig = role.relationship
                ? RELATIONSHIP_CONFIG[role.relationship]
                : null;

              return (
                <li
                  key={role.role_id}
                  className="flex items-center justify-between gap-4 p-3 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm text-neutral-800 truncate">
                      {role.title}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <Badge variant="outline" className={`text-xs ${scoreColor}`}>
                        {role.fit_score}% fit
                      </Badge>
                      {relationshipConfig && (
                        <Badge
                          variant="outline"
                          className={`text-xs ${relationshipConfig.color} ${relationshipConfig.bgColor} flex items-center gap-1`}
                        >
                          {relationshipConfig.icon}
                          {relationshipConfig.label}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {onSelectRole && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-shrink-0"
                      onClick={() => onSelectRole(role.role_id)}
                    >
                      View
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {/* Career Path Suggestion */}
      <Card className="bg-primary-50 border-primary-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-primary-700">
              <p className="font-medium mb-1">Explore Career Paths</p>
              <p>
                Related roles can serve as stepping stones or alternative paths. Consider adding
                them to your career path to compare options.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
