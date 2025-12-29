'use client';

import { MessageSquare } from 'lucide-react';

import { cn } from '@/lib/utils';

import { CommentButton } from './CommentButton';
import type { SectionCommentIndicatorProps } from './types';

/**
 * SectionCommentIndicator Component
 *
 * A small badge/indicator that shows comment count for a specific section.
 * Clicking opens the CommentButton popover for that section.
 *
 * Usage:
 * ```tsx
 * <div className="flex items-center gap-2">
 *   <Label>Description</Label>
 *   <SectionCommentIndicator
 *     targetType="goal"
 *     targetId={goalId}
 *     studentId={studentId}
 *     section="description"
 *     sectionLabel="Goal Description"
 *     count={2}
 *   />
 * </div>
 * ```
 */
export function SectionCommentIndicator({
  targetType,
  targetId,
  studentId,
  section,
  // sectionLabel reserved for future use (e.g., display in CommentButton header)
  sectionLabel: _sectionLabel,
  count = 0,
  unresolvedCount = 0,
}: SectionCommentIndicatorProps) {
  // Don't render if no comments and we want minimal UI
  // (can be made configurable via prop if needed)

  return (
    <CommentButton
      targetType={targetType}
      targetId={targetId}
      studentId={studentId}
      section={section}
      count={count}
      unresolvedCount={unresolvedCount}
      variant="badge"
    />
  );
}

/**
 * SectionCommentWrapper Component
 *
 * Wraps a section with comment indicator positioned appropriately.
 * Useful for forms where you want consistent comment indicator placement.
 */
interface SectionCommentWrapperProps {
  targetType: SectionCommentIndicatorProps['targetType'];
  targetId: string;
  studentId: SectionCommentIndicatorProps['studentId'];
  section: string;
  sectionLabel?: string;
  count?: number;
  unresolvedCount?: number;
  children: React.ReactNode;
  className?: string;
}

export function SectionCommentWrapper({
  targetType,
  targetId,
  studentId,
  section,
  sectionLabel,
  count = 0,
  unresolvedCount = 0,
  children,
  className,
}: SectionCommentWrapperProps) {
  return (
    <div className={cn('group relative', className)}>
      {children}

      {/* Comment indicator - shows on hover or when has comments */}
      <div
        className={cn(
          'absolute top-0 -right-6 transition-opacity',
          count > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        <SectionCommentIndicator
          targetType={targetType}
          targetId={targetId}
          studentId={studentId}
          section={section}
          sectionLabel={sectionLabel}
          count={count}
          unresolvedCount={unresolvedCount}
        />
      </div>
    </div>
  );
}

/**
 * CommentableField Component
 *
 * A field wrapper that adds comment functionality inline.
 * Shows a small comment icon that expands on hover.
 */
interface CommentableFieldProps {
  targetType: SectionCommentIndicatorProps['targetType'];
  targetId: string;
  studentId: SectionCommentIndicatorProps['studentId'];
  section: string;
  sectionLabel?: string;
  count?: number;
  unresolvedCount?: number;
  label?: string;
  children: React.ReactNode;
  className?: string;
}

export function CommentableField({
  targetType,
  targetId,
  studentId,
  section,
  sectionLabel,
  count = 0,
  unresolvedCount = 0,
  label,
  children,
  className,
}: CommentableFieldProps) {
  return (
    <div className={cn('space-y-1', className)}>
      {/* Label row with comment indicator */}
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-700">{label}</span>
          <SectionCommentIndicator
            targetType={targetType}
            targetId={targetId}
            studentId={studentId}
            section={section}
            sectionLabel={sectionLabel ?? label}
            count={count}
            unresolvedCount={unresolvedCount}
          />
        </div>
      )}

      {/* Field content */}
      {children}
    </div>
  );
}
