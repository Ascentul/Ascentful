'use client';

import { ArrowRight, TrendingUp, Users } from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getFitScoreColor } from '@/lib/career-explorer/fit-scoring';

interface RelatedRole {
  role_id: string;
  title: string;
  fit_score: number;
}

interface RelatedRolesTabProps {
  relatedRoles?: RelatedRole[];
  onSelectRole?: (roleId: string) => void;
}

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

              return (
                <li
                  key={role.role_id}
                  className="flex items-center justify-between gap-4 p-3 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm text-neutral-800 truncate">
                      {role.title}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={`text-xs ${scoreColor}`}>
                        {role.fit_score}% fit
                      </Badge>
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
