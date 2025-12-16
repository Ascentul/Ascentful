'use client';

import { Bookmark, Circle, Star, Target } from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { NodeType, PathNode as PathNodeType } from '@/lib/career-explorer/types';
import { cn } from '@/lib/utils';

interface PathNodeProps {
  node: PathNodeType;
  isSelected?: boolean;
  onClick?: () => void;
  onSave?: () => void;
}

const NODE_STYLES: Record<NodeType, { bg: string; border: string; icon: React.ReactNode }> = {
  current: {
    bg: 'bg-blue-50',
    border: 'border-blue-400',
    icon: <Circle className="w-4 h-4 text-blue-600 fill-blue-600" />,
  },
  target: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-400',
    icon: <Target className="w-4 h-4 text-emerald-600" />,
  },
  role: {
    bg: 'bg-white',
    border: 'border-neutral-200',
    icon: null,
  },
  bridge: {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    icon: null,
  },
};

export function PathNode({ node, isSelected, onClick, onSave }: PathNodeProps) {
  const style = NODE_STYLES[node.type];
  const isBridge = node.type === 'bridge';

  return (
    <Card
      className={cn(
        'relative cursor-pointer transition-all',
        style.bg,
        style.border,
        isBridge ? 'w-[160px] p-2' : 'w-[220px] p-3',
        isSelected && 'ring-2 ring-primary-500 ring-offset-2',
        node.is_main_path && 'border-2',
        'hover:shadow-md',
      )}
      onClick={onClick}
    >
      {/* Type Icon */}
      {style.icon && <div className="absolute -top-2 -left-2">{style.icon}</div>}

      {/* Save Button */}
      {onSave && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSave();
          }}
          aria-label={node.is_saved ? 'Remove from saved' : 'Save path'}
          aria-pressed={node.is_saved}
          className={cn(
            'absolute -top-2 -right-2 p-1 rounded-full bg-white shadow-sm',
            'hover:bg-neutral-50 transition-colors',
            node.is_saved && 'text-amber-500',
          )}
        >
          {node.is_saved ? (
            <Star className="w-4 h-4 fill-current" />
          ) : (
            <Bookmark className="w-4 h-4" />
          )}
        </button>
      )}

      {/* Content */}
      <div className="space-y-1">
        <h4 className={cn('font-medium', isBridge ? 'text-xs' : 'text-sm')}>{node.title}</h4>
        {node.subtitle && <p className="text-xs text-neutral-500">{node.subtitle}</p>}

        {/* Fit Score */}
        {node.fit_score !== undefined && (
          <Badge
            variant="secondary"
            className={cn(
              'text-xs',
              node.fit_score >= 80
                ? 'bg-emerald-100 text-emerald-700'
                : node.fit_score >= 60
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-neutral-100 text-neutral-600',
            )}
          >
            {node.fit_score}% fit
          </Badge>
        )}

        {/* Skills Preview */}
        {node.skills && node.skills.length > 0 && !isBridge && (
          <div className="flex flex-wrap gap-1 mt-2">
            {node.skills.slice(0, 3).map((skill, idx) => (
              <Badge key={idx} variant="outline" className="text-[10px] px-1.5 py-0">
                {skill}
              </Badge>
            ))}
            {node.skills.length > 3 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                +{node.skills.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Main Path Indicator */}
      {node.is_main_path && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-primary-500 text-white text-[10px] rounded-full">
          Main Path
        </div>
      )}
    </Card>
  );
}
