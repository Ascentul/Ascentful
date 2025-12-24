'use client';

import { Briefcase, Plus, Target, X } from 'lucide-react';
import { useCallback, useState } from 'react';

import { cn } from '@/lib/utils';

export interface RoleTargetingData {
  targetRole: string;
  alternateRoles?: string; // Comma-separated string of roles
  jobDescription?: string;
}

interface RoleTargetingStepProps {
  value: RoleTargetingData;
  onChange: (data: RoleTargetingData) => void;
}

export function RoleTargetingStep({ value, onChange }: RoleTargetingStepProps) {
  const [showJDInput, setShowJDInput] = useState(!!value.jobDescription);
  const [newRole, setNewRole] = useState('');

  // Parse alternate roles from comma-separated string to array
  const alternateRolesArray = value.alternateRoles
    ? value.alternateRoles
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean)
    : [];

  const handleRoleChange = (targetRole: string) => {
    onChange({ ...value, targetRole });
  };

  const handleAddAlternateRole = useCallback(() => {
    const trimmedRole = newRole.trim();
    if (!trimmedRole) return;

    // Don't add duplicates (case-insensitive)
    if (alternateRolesArray.some((r) => r.toLowerCase() === trimmedRole.toLowerCase())) {
      setNewRole('');
      return;
    }

    const updatedRoles = [...alternateRolesArray, trimmedRole];
    onChange({ ...value, alternateRoles: updatedRoles.join(', ') });
    setNewRole('');
  }, [newRole, alternateRolesArray, value, onChange]);

  const handleRemoveAlternateRole = useCallback(
    (roleToRemove: string) => {
      const updatedRoles = alternateRolesArray.filter((r) => r !== roleToRemove);
      onChange({
        ...value,
        alternateRoles: updatedRoles.length > 0 ? updatedRoles.join(', ') : undefined,
      });
    },
    [alternateRolesArray, value, onChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddAlternateRole();
    }
  };

  const handleJDChange = (jobDescription: string) => {
    onChange({ ...value, jobDescription });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 mb-2">
          <Target className="h-6 w-6 text-primary-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">What role are you targeting?</h2>
        <p className="text-slate-500">
          This helps us tailor your resume to the right opportunities
        </p>
      </div>

      {/* Role Input */}
      <div className="space-y-2">
        <label htmlFor="targetRole" className="block text-sm font-medium text-slate-700">
          Primary target role
        </label>
        <div className="relative">
          <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            id="targetRole"
            type="text"
            value={value.targetRole}
            onChange={(e) => handleRoleChange(e.target.value)}
            placeholder="e.g., Product Manager, Software Engineer"
            className={cn(
              'w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200',
              'focus:ring-2 focus:ring-primary-300 focus:border-primary-300 outline-none',
              'text-slate-900 placeholder:text-slate-400',
            )}
          />
        </div>
      </div>

      {/* Other Roles - Tag Bubbles */}
      <div className="space-y-2">
        <label htmlFor="newAlternateRole" className="block text-sm font-medium text-slate-700">
          Other roles <span className="text-slate-400 font-normal">(optional)</span>
        </label>

        {/* Tag bubbles display */}
        {alternateRolesArray.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {alternateRolesArray.map((role) => (
              <span
                key={role}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full',
                  'bg-primary-50 text-primary-700 text-sm font-medium',
                  'border border-primary-200',
                )}
              >
                {role}
                <button
                  type="button"
                  onClick={() => handleRemoveAlternateRole(role)}
                  className="p-0.5 rounded-full hover:bg-primary-200 transition-colors"
                  aria-label={`Remove ${role}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Add new role input */}
        <div className="flex gap-2">
          <input
            id="newAlternateRole"
            type="text"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a role and press Enter"
            className={cn(
              'flex-1 px-4 py-2.5 rounded-xl border border-slate-200',
              'focus:ring-2 focus:ring-primary-300 focus:border-primary-300 outline-none',
              'text-slate-900 placeholder:text-slate-400 text-sm',
            )}
          />
          <button
            type="button"
            onClick={handleAddAlternateRole}
            disabled={!newRole.trim()}
            className={cn(
              'px-4 py-2.5 rounded-xl font-medium text-sm',
              'bg-slate-100 text-slate-700 hover:bg-slate-200',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors flex items-center gap-1.5',
            )}
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
        <p className="text-xs text-slate-400">Add alternative job titles you&apos;d consider</p>
      </div>

      {/* Optional JD Section */}
      <div className="space-y-3 pt-4 border-t border-slate-100">
        {!showJDInput ? (
          <button
            type="button"
            onClick={() => setShowJDInput(true)}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-3 rounded-xl',
              'border-2 border-dashed border-slate-200 text-slate-500',
              'hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50/50',
              'transition-colors',
            )}
          >
            <Target className="h-4 w-4" />
            <span className="text-sm font-medium">Have a specific job posting? (optional)</span>
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="jobDescription" className="block text-sm font-medium text-slate-700">
                Paste job description or URL
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowJDInput(false);
                  handleJDChange('');
                }}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Remove
              </button>
            </div>
            <textarea
              id="jobDescription"
              value={value.jobDescription || ''}
              onChange={(e) => handleJDChange(e.target.value)}
              placeholder="Paste the job description here to get tailored suggestions..."
              rows={4}
              className={cn(
                'w-full px-4 py-3 rounded-xl border border-slate-200',
                'focus:ring-2 focus:ring-primary-300 focus:border-primary-300 outline-none',
                'text-slate-900 placeholder:text-slate-400 resize-none',
              )}
            />
            <p className="text-xs text-slate-400">
              We&apos;ll analyze the job requirements and tailor your resume to match
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
