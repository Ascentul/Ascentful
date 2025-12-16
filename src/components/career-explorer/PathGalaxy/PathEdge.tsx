'use client';

import React from 'react';

import { cn } from '@/lib/utils';

interface PathEdgeProps {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  label?: string;
  isMainPath?: boolean;
  isHighlighted?: boolean;
}

export function PathEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  label,
  isMainPath,
  isHighlighted,
}: PathEdgeProps) {
  // Calculate control points for curved line
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  // Create curved path
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;

  // Offset for curve based on distance
  const curveOffset = Math.min(Math.abs(dy) * 0.3, 50);

  // Path for a smooth curve
  const path =
    Math.abs(dy) < 20
      ? // Nearly horizontal - straight line
        `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`
      : // Curved path
        `M ${sourceX} ${sourceY}
         Q ${midX} ${sourceY + curveOffset * Math.sign(dy)}, ${midX} ${midY}
         Q ${midX} ${targetY - curveOffset * Math.sign(dy)}, ${targetX} ${targetY}`;

  return (
    <g>
      {/* Edge line */}
      <path
        d={path}
        fill="none"
        stroke={isMainPath ? '#5371FF' : isHighlighted ? '#8B5CF6' : '#D1D5DB'}
        strokeWidth={isMainPath ? 3 : 2}
        strokeDasharray={isMainPath ? 'none' : '4 2'}
        className={cn('transition-all', isHighlighted && 'stroke-violet-400')}
      />

      {/* Arrow marker */}
      <circle
        cx={targetX}
        cy={targetY}
        r={4}
        fill={isMainPath ? '#5371FF' : isHighlighted ? '#8B5CF6' : '#9CA3AF'}
      />

      {/* Label */}
      {label && (
        <g transform={`translate(${midX}, ${midY})`}>
          <rect
            x={-label.length * 3 - 8}
            y={-10}
            width={label.length * 6 + 16}
            height={20}
            rx={10}
            fill="white"
            stroke="#E5E7EB"
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            className="text-[10px] fill-neutral-600"
          >
            {label}
          </text>
        </g>
      )}
    </g>
  );
}

// Helper component for defining arrow markers
export function EdgeMarkers() {
  return (
    <defs>
      <marker
        id="arrow"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth={6}
        markerHeight={6}
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#9CA3AF" />
      </marker>
      <marker
        id="arrow-main"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth={6}
        markerHeight={6}
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#5371FF" />
      </marker>
      <marker
        id="arrow-highlight"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth={6}
        markerHeight={6}
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#8B5CF6" />
      </marker>
    </defs>
  );
}
