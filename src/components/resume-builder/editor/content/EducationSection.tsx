'use client';

import { Plus, Trash2 } from 'lucide-react';

import type { Education } from '@/components/resume/ResumeDocument';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface EducationSectionProps {
  education: Education[];
  onChange: (education: Education[]) => void;
}

export function EducationSection({ education, onChange }: EducationSectionProps) {
  const handleAdd = () => {
    const newEducation: Education = {
      id: `edu-${crypto.randomUUID()}`,
      school: '',
      degree: '',
      field: '',
      location: '',
      startYear: '',
      endYear: '',
    };
    onChange([...education, newEducation]);
  };

  const handleUpdate = (index: number, updates: Partial<Education>) => {
    const updated = education.map((edu, i) => (i === index ? { ...edu, ...updates } : edu));
    onChange(updated);
  };

  const handleDelete = (index: number) => {
    onChange(education.filter((_, i) => i !== index));
  };

  if (education.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-500 mb-4">Add your education to complete your background.</p>
        <Button onClick={handleAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Education
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {education.map((edu, index) => (
        <div key={edu.id} className="p-4 border border-slate-200 rounded-lg space-y-4">
          <div className="flex items-start justify-between">
            <span className="text-sm font-medium text-slate-400">Education {index + 1}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(index)}
              className="h-7 w-7 text-slate-400 hover:text-red-500"
              aria-label={`Delete education ${index + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor={`edu-school-${edu.id}`}
                className="text-sm font-medium text-slate-700"
              >
                School
              </label>
              <Input
                id={`edu-school-${edu.id}`}
                value={edu.school}
                onChange={(e) => handleUpdate(index, { school: e.target.value })}
                placeholder="University of California"
                className="mt-1"
              />
            </div>
            <div>
              <label
                htmlFor={`edu-location-${edu.id}`}
                className="text-sm font-medium text-slate-700"
              >
                Location
              </label>
              <Input
                id={`edu-location-${edu.id}`}
                value={edu.location}
                onChange={(e) => handleUpdate(index, { location: e.target.value })}
                placeholder="Berkeley, CA"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor={`edu-degree-${edu.id}`}
                className="text-sm font-medium text-slate-700"
              >
                Degree
              </label>
              <Input
                id={`edu-degree-${edu.id}`}
                value={edu.degree}
                onChange={(e) => handleUpdate(index, { degree: e.target.value })}
                placeholder="Bachelor of Science"
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor={`edu-field-${edu.id}`} className="text-sm font-medium text-slate-700">
                Field of Study
              </label>
              <Input
                id={`edu-field-${edu.id}`}
                value={edu.field}
                onChange={(e) => handleUpdate(index, { field: e.target.value })}
                placeholder="Computer Science"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor={`edu-start-${edu.id}`} className="text-sm font-medium text-slate-700">
                Start Year
              </label>
              <Input
                id={`edu-start-${edu.id}`}
                value={edu.startYear}
                onChange={(e) => handleUpdate(index, { startYear: e.target.value })}
                placeholder="2018"
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor={`edu-end-${edu.id}`} className="text-sm font-medium text-slate-700">
                End Year
              </label>
              <Input
                id={`edu-end-${edu.id}`}
                value={edu.endYear}
                onChange={(e) => handleUpdate(index, { endYear: e.target.value })}
                placeholder="2022"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor={`edu-gpa-${edu.id}`} className="text-sm font-medium text-slate-700">
                GPA (optional)
              </label>
              <Input
                id={`edu-gpa-${edu.id}`}
                value={edu.gpa || ''}
                onChange={(e) => handleUpdate(index, { gpa: e.target.value })}
                placeholder="3.8"
                className="mt-1"
              />
            </div>
            <div>
              <label
                htmlFor={`edu-honors-${edu.id}`}
                className="text-sm font-medium text-slate-700"
              >
                Honors (optional)
              </label>
              <Input
                id={`edu-honors-${edu.id}`}
                value={edu.honors || ''}
                onChange={(e) => handleUpdate(index, { honors: e.target.value })}
                placeholder="Magna Cum Laude"
                className="mt-1"
              />
            </div>
          </div>
        </div>
      ))}

      <Button variant="outline" onClick={handleAdd} className="w-full gap-2">
        <Plus className="h-4 w-4" />
        Add Another Education
      </Button>
    </div>
  );
}
