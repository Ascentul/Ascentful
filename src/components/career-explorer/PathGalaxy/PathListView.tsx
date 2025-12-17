'use client';

import { Bookmark, ChevronDown, ChevronUp, Circle, Star, Target } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { NodeType, PathNode } from '@/lib/career-explorer/types';
import { cn } from '@/lib/utils';

interface PathListViewProps {
  nodes: PathNode[];
  selectedNodeId?: string;
  onNodeSelect?: (nodeId: string) => void;
  onNodeSave?: (nodeId: string) => void;
}

type SortOption = 'fit_score' | 'title' | 'type' | 'saved';
type GroupOption = 'none' | 'type' | 'fit_range';

const NODE_TYPE_CONFIG: Record<NodeType, { label: string; icon: React.ReactNode; color: string }> =
  {
    current: {
      label: 'Current Position',
      icon: <Circle className="w-4 h-4 fill-current" />,
      color: 'text-blue-600 bg-blue-50',
    },
    target: {
      label: 'Target Role',
      icon: <Target className="w-4 h-4" />,
      color: 'text-emerald-600 bg-emerald-50',
    },
    role: {
      label: 'Role',
      icon: null,
      color: 'text-neutral-600 bg-neutral-50',
    },
    bridge: {
      label: 'Bridge Role',
      icon: null,
      color: 'text-amber-600 bg-amber-50',
    },
  };

function getFitScoreRange(score?: number): string {
  if (score === undefined) return 'No Score';
  if (score >= 80) return 'Excellent Fit (80-100%)';
  if (score >= 60) return 'Good Fit (60-79%)';
  if (score >= 40) return 'Moderate Fit (40-59%)';
  return 'Development Needed (0-39%)';
}

function getFitScoreColor(score?: number): string {
  if (score === undefined) return 'bg-neutral-100 text-neutral-600';
  if (score >= 80) return 'bg-emerald-100 text-emerald-700';
  if (score >= 60) return 'bg-blue-100 text-blue-700';
  if (score >= 40) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

interface NodeListItemProps {
  node: PathNode;
  isSelected: boolean;
  onSelect: () => void;
  onSave?: () => void;
}

function NodeListItem({ node, isSelected, onSelect, onSave }: NodeListItemProps) {
  const typeConfig = NODE_TYPE_CONFIG[node.type];

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left p-4 rounded-lg border transition-all',
        'hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500',
        isSelected ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 bg-white',
      )}
      aria-pressed={isSelected}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Header with type badge */}
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className={cn('text-xs gap-1', typeConfig.color)}>
              {typeConfig.icon}
              {typeConfig.label}
            </Badge>
            {node.is_main_path && (
              <Badge variant="secondary" className="text-xs bg-primary-100 text-primary-700">
                Main Path
              </Badge>
            )}
          </div>

          {/* Title */}
          <h4 className="font-medium text-sm truncate">{node.title}</h4>

          {/* Subtitle */}
          {node.subtitle && (
            <p className="text-xs text-neutral-500 truncate mt-0.5">{node.subtitle}</p>
          )}

          {/* Skills */}
          {node.skills && node.skills.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {node.skills.slice(0, 4).map((skill, idx) => (
                <Badge key={idx} variant="outline" className="text-[10px] px-1.5 py-0">
                  {skill}
                </Badge>
              ))}
              {node.skills.length > 4 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  +{node.skills.length - 4}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Right side: fit score and save button */}
        <div className="flex flex-col items-end gap-2">
          {node.fit_score !== undefined && (
            <Badge className={cn('text-xs', getFitScoreColor(node.fit_score))}>
              {node.fit_score}% fit
            </Badge>
          )}

          {onSave && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSave();
              }}
              className={cn(
                'p-1.5 rounded-full hover:bg-neutral-100 transition-colors',
                node.is_saved && 'text-amber-500',
              )}
              aria-label={node.is_saved ? 'Remove from saved' : 'Save role'}
              aria-pressed={node.is_saved}
            >
              {node.is_saved ? (
                <Star className="w-4 h-4 fill-current" />
              ) : (
                <Bookmark className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>
    </button>
  );
}

export function PathListView({
  nodes,
  selectedNodeId,
  onNodeSelect,
  onNodeSave,
}: PathListViewProps) {
  const [sortBy, setSortBy] = useState<SortOption>('fit_score');
  const [sortAsc, setSortAsc] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupOption>('none');

  // Sort nodes
  const sortedNodes = useMemo(() => {
    const sorted = [...nodes].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'fit_score':
          comparison = (b.fit_score ?? -1) - (a.fit_score ?? -1);
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'saved':
          comparison = (b.is_saved ? 1 : 0) - (a.is_saved ? 1 : 0);
          break;
      }

      return sortAsc ? -comparison : comparison;
    });

    return sorted;
  }, [nodes, sortBy, sortAsc]);

  // Group nodes
  const groupedNodes = useMemo(() => {
    if (groupBy === 'none') {
      return { '': sortedNodes };
    }

    const groups: Record<string, PathNode[]> = {};

    for (const node of sortedNodes) {
      let key: string;

      if (groupBy === 'type') {
        key = NODE_TYPE_CONFIG[node.type]?.label || node.type;
      } else if (groupBy === 'fit_range') {
        key = getFitScoreRange(node.fit_score);
      } else {
        key = '';
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(node);
    }

    return groups;
  }, [sortedNodes, groupBy]);

  const toggleSortDirection = () => setSortAsc(!sortAsc);

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Career Paths ({nodes.length})</CardTitle>

          <div className="flex items-center gap-2">
            {/* Sort direction */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleSortDirection}
              aria-label={sortAsc ? 'Sort ascending' : 'Sort descending'}
            >
              {sortAsc ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>

            {/* Sort by */}
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fit_score">Fit Score</SelectItem>
                <SelectItem value="title">Title</SelectItem>
                <SelectItem value="type">Type</SelectItem>
                <SelectItem value="saved">Saved</SelectItem>
              </SelectContent>
            </Select>

            {/* Group by */}
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupOption)}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue placeholder="Group by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Grouping</SelectItem>
                <SelectItem value="type">Role Type</SelectItem>
                <SelectItem value="fit_range">Fit Score Range</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {nodes.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">
            <Target className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
            <p className="font-medium">No career paths to display</p>
            <p className="text-sm mt-1">
              Complete the quiz to discover roles that match your profile
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedNodes).map(([groupName, groupNodes]) => (
              <div key={groupName || 'ungrouped'}>
                {groupName && groupBy !== 'none' && (
                  <h3 className="text-sm font-medium text-neutral-700 mb-3 flex items-center gap-2">
                    {groupName}
                    <Badge variant="secondary" className="text-xs">
                      {groupNodes.length}
                    </Badge>
                  </h3>
                )}

                <div className="space-y-2" role="list" aria-label={groupName || 'Career paths'}>
                  {groupNodes.map((node) => (
                    <NodeListItem
                      key={node.id}
                      node={node}
                      isSelected={selectedNodeId === node.id}
                      onSelect={() => onNodeSelect?.(node.id)}
                      onSave={onNodeSave ? () => onNodeSave(node.id) : undefined}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
