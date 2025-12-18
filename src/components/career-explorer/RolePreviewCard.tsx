'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, DollarSign, GraduationCap, Info, Plus, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getFitScoreColor } from '@/lib/career-explorer/fit-scoring';
import type { PathNode } from '@/lib/career-explorer/types';

export interface RoleSalaryData {
  role_title: string;
  bls_occupation_code?: string;
  bls_occupation_title?: string;
  salary_range: {
    min: number;
    median: number;
    max: number;
  };
  source: 'BLS' | 'estimated';
  source_url?: string;
  last_updated?: string;
  experience_level?: string;
  summary?: string;
}

interface RolePreviewCardProps {
  node: PathNode;
  position: { x: number; y: number };
  salaryData?: RoleSalaryData;
  onClose?: () => void;
  onViewDetails?: (nodeId: string) => void;
  onPlaceInPlan?: (nodeId: string) => void;
  isLoading?: boolean;
  isRightPanelOpen?: boolean;
  planRailHeight?: number;
}

function formatSalary(amount: number): string {
  if (amount >= 1000) {
    return `$${Math.round(amount / 1000)}k`;
  }
  return `$${amount.toLocaleString()}`;
}

export function RolePreviewCard({
  node,
  position,
  salaryData,
  onClose,
  onViewDetails,
  onPlaceInPlan,
  isLoading,
  isRightPanelOpen = false,
  planRailHeight = 160,
}: RolePreviewCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const [adjustedPosition, setAdjustedPosition] = useState({ left: 0, top: 0 });
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport with resize handling (SSR-safe)
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Calculate position to avoid going off-screen and overlapping panel/rail
  useEffect(() => {
    const cardWidth = 320;
    const cardHeight = 320;
    const padding = 16;
    const rightPanelWidth = isRightPanelOpen ? 320 : 0;

    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

    // Available space accounting for right panel
    const availableWidth = viewportWidth - rightPanelWidth;

    let left = position.x + 20; // Default: to the right of the cursor
    let top = position.y - cardHeight / 2; // Center vertically

    // Smart positioning: prefer right of node, but flip to left if needed
    if (left + cardWidth + padding > availableWidth) {
      left = position.x - cardWidth - 20;
    }

    // If still off screen to the left, center it
    if (left < padding) {
      left = Math.max(padding, (availableWidth - cardWidth) / 2);
    }

    // Keep card within vertical bounds, accounting for plan rail at bottom
    const maxTop = viewportHeight - cardHeight - planRailHeight - padding;
    if (top < padding) {
      top = padding;
    } else if (top > maxTop) {
      top = maxTop;
    }

    setAdjustedPosition({ left, top });
  }, [position, isRightPanelOpen, planRailHeight]);

  const fitScoreColor = node.fit_score ? getFitScoreColor(node.fit_score) : 'text-neutral-500';

  const cardContent = (
    <Card
      className={`shadow-lg border-2 border-neutral-200 bg-white ${isMobile ? 'w-full' : 'w-80'}`}
    >
      <CardContent className="p-4 space-y-3 relative">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 id="role-preview-title" className="font-semibold text-lg text-neutral-900 truncate">
              {node.title}
            </h3>
            <p id="role-preview-description" className="text-sm text-neutral-500 truncate">
              {node.subtitle || salaryData?.bls_occupation_title || 'Career Role'}
            </p>
          </div>
          {node.fit_score !== undefined && (
            <Badge variant="outline" className={`${fitScoreColor} border-current shrink-0`}>
              {node.fit_score}% fit
            </Badge>
          )}
        </div>

        {/* Salary Range */}
        {isLoading ? (
          <div className="flex items-center gap-2 py-2">
            <div className="w-4 h-4 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
            <span className="text-sm text-neutral-500">Loading salary data...</span>
          </div>
        ) : salaryData ? (
          <div className="bg-neutral-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-neutral-700">Salary Range</span>
              {salaryData.source === 'BLS' && (
                <Badge
                  variant="outline"
                  className="text-xs py-0 px-1.5 text-green-700 border-green-300"
                >
                  BLS
                </Badge>
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-sm text-neutral-500">
                {formatSalary(salaryData.salary_range.min)}
              </span>
              <span className="text-neutral-300">–</span>
              <span className="text-lg font-semibold text-neutral-900">
                {formatSalary(salaryData.salary_range.median)}
              </span>
              <span className="text-neutral-300">–</span>
              <span className="text-sm text-neutral-500">
                {formatSalary(salaryData.salary_range.max)}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-1">10th – median – 90th percentile</p>
          </div>
        ) : (
          <div className="bg-neutral-50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-neutral-400" />
              <span className="text-sm text-neutral-500">Salary data unavailable</span>
            </div>
          </div>
        )}

        {/* Experience Level */}
        {salaryData?.experience_level && (
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-neutral-400" />
            <span className="text-sm text-neutral-600">{salaryData.experience_level}</span>
          </div>
        )}

        {/* Skills - Top 3 */}
        {node.skills && node.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {node.skills.slice(0, 3).map((skill, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="text-xs py-0.5 bg-neutral-100 text-neutral-600"
              >
                {skill}
              </Badge>
            ))}
            {node.skills.length > 3 && (
              <Badge variant="secondary" className="text-xs py-0.5 bg-neutral-100 text-neutral-500">
                +{node.skills.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2 border-t border-neutral-100">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewDetails?.(node.id)}
            className="flex-1 gap-1.5"
          >
            <Info className="w-3.5 h-3.5" />
            Details
          </Button>
          <Button
            size="sm"
            onClick={() => onPlaceInPlan?.(node.id)}
            className="flex-1 gap-1.5 bg-primary-500 hover:bg-primary-600"
          >
            <Plus className="w-3.5 h-3.5" />
            Set as next step
            <ArrowRight className="w-3 h-3" />
          </Button>
        </div>

        {/* Close button - always visible on mobile, hidden on desktop (uses mouse leave) */}
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close role preview"
            className={`absolute top-2 right-2 p-1.5 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-colors ${
              isMobile ? 'block' : 'hidden'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <>
      {/* Backdrop for mobile */}
      {isMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/20 animate-in fade-in-0 duration-150"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <motion.div
        role="dialog"
        aria-labelledby="role-preview-title"
        aria-describedby="role-preview-description"
        aria-modal={isMobile}
        initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={prefersReducedMotion ? {} : { opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className={`fixed z-50 pointer-events-auto ${
          isMobile ? 'inset-x-4 bottom-4 top-auto' : ''
        }`}
        style={
          isMobile
            ? {}
            : {
                left: `${adjustedPosition.left}px`,
                top: `${adjustedPosition.top}px`,
              }
        }
        onMouseLeave={isMobile ? undefined : onClose}
      >
        {cardContent}
      </motion.div>
    </>
  );
}
