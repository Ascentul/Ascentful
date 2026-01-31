'use client';

import { AlertTriangle, Globe } from 'lucide-react';

import { formatRelativeTime, getCoachById } from '@/lib/cohortos/mock-data';
import { PROGRAM_CONFIG, type Student } from '@/lib/cohortos/types';
import { cn } from '@/lib/utils';

import { StatusBadge } from './status-badge';

interface StudentRowProps {
  student: Student;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onClick?: (id: string) => void;
  className?: string;
}

export function StudentRow({ student, selected, onSelect, onClick, className }: StudentRowProps) {
  const coach = getCoachById(student.coachId);
  const programLabel = PROGRAM_CONFIG[student.program].shortLabel;

  const handleRowClick = (e: React.MouseEvent) => {
    // Don't trigger row click if clicking on checkbox
    if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
      return;
    }
    onClick?.(student.id);
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onSelect?.(student.id);
  };

  return (
    <tr
      className={cn(
        'border-b border-slate-100 transition-colors',
        onClick && 'cursor-pointer hover:bg-slate-50',
        selected && 'bg-blue-50',
        className,
      )}
      onClick={handleRowClick}
    >
      {/* Checkbox */}
      {onSelect && (
        <td className="px-4 py-3 w-12">
          <input
            type="checkbox"
            checked={selected ?? false}
            onChange={handleCheckboxChange}
            className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
        </td>
      )}

      {/* Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={cn('font-medium text-slate-900', onClick && 'hover:text-primary-600')}>
            {student.name}
          </span>
          {student.isInternational && (
            <span title="International Student">
              <Globe className="h-4 w-4 text-slate-400" />
            </span>
          )}
          {student.hasBlocker && (
            <span title={student.blockerNote || 'Has blocker'}>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </span>
          )}
        </div>
        <div className="text-xs text-slate-500 mt-0.5">{student.email}</div>
      </td>

      {/* Program */}
      <td className="px-4 py-3">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
          {programLabel}
        </span>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <StatusBadge status={student.status} size="sm" />
      </td>

      {/* Coach */}
      <td className="px-4 py-3 text-sm text-slate-600">{coach?.name || '-'}</td>

      {/* Target */}
      <td className="px-4 py-3">
        <div className="text-sm text-slate-900">{student.targetRole}</div>
        <div className="text-xs text-slate-500">{student.targetIndustry}</div>
      </td>

      {/* Last Updated */}
      <td className="px-4 py-3 text-sm text-slate-500">
        {formatRelativeTime(student.lastUpdated)}
      </td>
    </tr>
  );
}

// Table header component for consistency
export function StudentTableHeader({ showCheckbox = false }: { showCheckbox?: boolean }) {
  return (
    <thead className="bg-slate-50 border-b border-slate-200">
      <tr>
        {showCheckbox && <th className="px-4 py-3 w-12" />}
        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
          Student
        </th>
        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
          Program
        </th>
        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
          Status
        </th>
        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
          Coach
        </th>
        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
          Target Role
        </th>
        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
          Last Updated
        </th>
      </tr>
    </thead>
  );
}
