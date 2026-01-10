'use client';

import { Minus, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { Experience } from '@/components/resume/ResumeDocument';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { parseDescriptionToStructured, structuredToDescription } from '@/lib/resume-utils';

interface ExperienceSectionProps {
  experiences: Experience[];
  onChange: (experiences: Experience[]) => void;
  onGenerateBullets?: (experienceIndex: number) => void;
  isGenerating?: boolean;
}

export function ExperienceSection({
  experiences,
  onChange,
  onGenerateBullets,
  isGenerating,
}: ExperienceSectionProps) {
  // Track if we've auto-parsed experiences to avoid infinite loops
  const autoParseRef = useRef<Set<string>>(new Set());

  // Auto-parse description into structured fields when both summary and keyContributions are empty
  // This handles imported resumes that only have description populated
  useEffect(() => {
    const experiencesToUpdate: Experience[] = [];

    for (const exp of experiences) {
      // Skip if we've already processed this experience
      if (autoParseRef.current.has(exp.id)) continue;

      // Check if structured fields are empty but description has content
      const hasEmptyStructured =
        !exp.summary && (!exp.keyContributions || exp.keyContributions.length === 0);
      const hasDescription = exp.description && exp.description.trim().length > 0;

      if (hasEmptyStructured && hasDescription) {
        // Parse description into structured fields
        const { summary, keyContributions } = parseDescriptionToStructured(exp.description);
        if (summary || keyContributions.length > 0) {
          experiencesToUpdate.push({
            ...exp,
            summary,
            keyContributions,
          });
          autoParseRef.current.add(exp.id);
        }
      }
    }

    // Update experiences if any were parsed
    if (experiencesToUpdate.length > 0) {
      const updatedExperiences = experiences.map((exp) => {
        const updated = experiencesToUpdate.find((u) => u.id === exp.id);
        return updated || exp;
      });
      onChange(updatedExperiences);
    }
  }, [experiences, onChange]);

  const handleAdd = () => {
    const id = `exp-${crypto.randomUUID()}`;
    const newExperience: Experience = {
      id,
      title: '',
      company: '',
      location: '',
      startDate: '',
      endDate: '',
      current: false,
      description: '',
      summary: '',
      keyContributions: [],
    };
    onChange([...experiences, newExperience]);
  };

  const handleUpdate = (index: number, updates: Partial<Experience>) => {
    const updated = experiences.map((exp, i) => {
      if (i !== index) return exp;
      const newExp = { ...exp, ...updates };

      // Keep description in sync with structured fields for backward compatibility
      if (updates.summary !== undefined || updates.keyContributions !== undefined) {
        newExp.description = structuredToDescription(
          updates.summary ?? exp.summary ?? '',
          updates.keyContributions ?? exp.keyContributions ?? [],
        );
      }

      return newExp;
    });
    onChange(updated);
  };

  const handleDelete = (index: number) => {
    onChange(experiences.filter((_, i) => i !== index));
  };

  const handleAddBullet = (index: number) => {
    const exp = experiences[index];
    const currentBullets = exp.keyContributions || [];
    handleUpdate(index, { keyContributions: [...currentBullets, ''] });
  };

  const handleUpdateBullet = (expIndex: number, bulletIndex: number, value: string) => {
    const exp = experiences[expIndex];
    const currentBullets = [...(exp.keyContributions || [])];
    currentBullets[bulletIndex] = value;
    handleUpdate(expIndex, { keyContributions: currentBullets });
  };

  const handleRemoveBullet = (expIndex: number, bulletIndex: number) => {
    const exp = experiences[expIndex];
    const currentBullets = [...(exp.keyContributions || [])];
    currentBullets.splice(bulletIndex, 1);
    handleUpdate(expIndex, { keyContributions: currentBullets });
  };

  if (experiences.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-500 mb-4">
          Add your work experience to show employers what you've accomplished.
        </p>
        <Button onClick={handleAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Experience
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {experiences.map((exp, index) => (
        <div key={exp.id} className="p-4 border border-slate-200 rounded-lg space-y-4">
          <div className="flex items-start justify-between">
            <span className="text-sm font-medium text-slate-400">Experience {index + 1}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(index)}
              className="h-7 w-7 text-slate-400 hover:text-red-500"
              aria-label={`Delete experience ${index + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor={`title-${exp.id}`} className="text-sm font-medium text-slate-700">
                Job Title
              </label>
              <Input
                id={`title-${exp.id}`}
                value={exp.title}
                onChange={(e) => handleUpdate(index, { title: e.target.value })}
                placeholder="Software Engineer"
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor={`company-${exp.id}`} className="text-sm font-medium text-slate-700">
                Company
              </label>
              <Input
                id={`company-${exp.id}`}
                value={exp.company}
                onChange={(e) => handleUpdate(index, { company: e.target.value })}
                placeholder="Acme Inc."
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label
                htmlFor={`start-date-${exp.id}`}
                className="text-sm font-medium text-slate-700"
              >
                Start Date
              </label>
              <Input
                id={`start-date-${exp.id}`}
                value={exp.startDate}
                onChange={(e) => handleUpdate(index, { startDate: e.target.value })}
                placeholder="Jan 2022"
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor={`end-date-${exp.id}`} className="text-sm font-medium text-slate-700">
                End Date
              </label>
              <Input
                id={`end-date-${exp.id}`}
                value={exp.current ? 'Present' : exp.endDate}
                onChange={(e) => handleUpdate(index, { endDate: e.target.value })}
                placeholder="Dec 2023"
                disabled={exp.current}
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor={`location-${exp.id}`} className="text-sm font-medium text-slate-700">
                Location
              </label>
              <Input
                id={`location-${exp.id}`}
                value={exp.location}
                onChange={(e) => handleUpdate(index, { location: e.target.value })}
                placeholder="San Francisco, CA"
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id={`current-${exp.id}`}
              checked={exp.current}
              onCheckedChange={(checked) =>
                handleUpdate(index, {
                  current: checked === true,
                  endDate: checked ? 'Present' : exp.endDate === 'Present' ? '' : exp.endDate,
                })
              }
            />
            <label htmlFor={`current-${exp.id}`} className="text-sm text-slate-600">
              I currently work here
            </label>
          </div>

          {/* Role Overview / Summary */}
          <div>
            <label htmlFor={`summary-${exp.id}`} className="text-sm font-medium text-slate-700">
              Role Overview
            </label>
            <p className="text-xs text-slate-500 mb-1">
              Brief paragraph about your role, scope, and value delivered (2-3 sentences)
            </p>
            <Textarea
              id={`summary-${exp.id}`}
              value={exp.summary || ''}
              onChange={(e) => handleUpdate(index, { summary: e.target.value })}
              placeholder="Led a team of 5 engineers to deliver critical features for the company's flagship product. Responsible for architecture decisions, code reviews, and mentoring junior developers."
              className="min-h-[80px] text-sm"
            />
          </div>

          {/* Key Accomplishments */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div>
                <label className="text-sm font-medium text-slate-700">Accomplishments</label>
                <p className="text-xs text-slate-500">
                  Specific achievements with metrics and impact
                </p>
              </div>
              {onGenerateBullets && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onGenerateBullets(index)}
                  disabled={isGenerating || !exp.title}
                  className="gap-1.5 text-primary-600 border-primary-200 hover:bg-primary-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {isGenerating ? 'Generating...' : 'Write bullets'}
                </Button>
              )}
            </div>

            <div className="space-y-2">
              {(exp.keyContributions || []).map((bullet, bulletIndex) => (
                <div key={bulletIndex} className="flex items-start gap-2">
                  <span className="text-slate-400 mt-2.5 text-sm">•</span>
                  <Input
                    value={bullet}
                    onChange={(e) => handleUpdateBullet(index, bulletIndex, e.target.value)}
                    placeholder="Increased revenue by 25% through implementing new checkout flow"
                    className="flex-1 text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveBullet(index, bulletIndex)}
                    className="h-9 w-9 text-slate-400 hover:text-red-500 shrink-0"
                    aria-label="Remove bullet"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAddBullet(index)}
                className="gap-1.5 text-slate-600"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Bullet
              </Button>
            </div>
          </div>
        </div>
      ))}

      <Button variant="outline" onClick={handleAdd} className="w-full gap-2">
        <Plus className="h-4 w-4" />
        Add Another Experience
      </Button>
    </div>
  );
}
