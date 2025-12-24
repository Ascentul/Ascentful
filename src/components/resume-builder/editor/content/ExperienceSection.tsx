'use client';

import { Plus, Sparkles, Trash2 } from 'lucide-react';

import type { Experience } from '@/components/resume/ResumeDocument';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

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
  const handleAdd = () => {
    const newExperience: Experience = {
      id: `exp-${crypto.randomUUID()}`,
      title: '',
      company: '',
      location: '',
      startDate: '',
      endDate: '',
      current: false,
      description: '',
    };
    onChange([...experiences, newExperience]);
  };

  const handleUpdate = (index: number, updates: Partial<Experience>) => {
    const updated = experiences.map((exp, i) => (i === index ? { ...exp, ...updates } : exp));
    onChange(updated);
  };

  const handleDelete = (index: number) => {
    onChange(experiences.filter((_, i) => i !== index));
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

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor={`description-${exp.id}`}
                className="text-sm font-medium text-slate-700"
              >
                Description & Achievements
              </label>
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
            <Textarea
              id={`description-${exp.id}`}
              value={exp.description}
              onChange={(e) => handleUpdate(index, { description: e.target.value })}
              placeholder="• Led development of new features serving 10K+ users
• Improved page load times by 40% through optimization
• Mentored 2 junior developers"
              className="min-h-[120px] font-mono text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">
              Use bullet points (•) to list your key achievements
            </p>
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
