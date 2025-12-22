'use client';

import { Plus, Trash2 } from 'lucide-react';

import type { Project } from '@/components/resume/ResumeDocument';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface ProjectsSectionProps {
  projects: Project[];
  onChange: (projects: Project[]) => void;
}

export function ProjectsSection({ projects, onChange }: ProjectsSectionProps) {
  const handleAdd = () => {
    const newProject: Project = {
      id: `proj-${Date.now()}`,
      name: '',
      role: '',
      description: '',
      technologies: '',
      url: '',
    };
    onChange([...projects, newProject]);
  };

  const handleUpdate = (index: number, updates: Partial<Project>) => {
    const updated = projects.map((proj, i) => (i === index ? { ...proj, ...updates } : proj));
    onChange(updated);
  };

  const handleDelete = (index: number) => {
    onChange(projects.filter((_, i) => i !== index));
  };

  if (projects.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-500 mb-4">Showcase your personal or academic projects.</p>
        <Button onClick={handleAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Project
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {projects.map((proj, index) => (
        <div key={proj.id} className="p-4 border border-slate-200 rounded-lg space-y-4">
          <div className="flex items-start justify-between">
            <span className="text-sm font-medium text-slate-400">Project {index + 1}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(index)}
              className="h-7 w-7 text-slate-400 hover:text-red-500"
              aria-label={`Delete project ${index + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor={`proj-name-${proj.id}`}
                className="text-sm font-medium text-slate-700"
              >
                Project Name
              </label>
              <Input
                id={`proj-name-${proj.id}`}
                value={proj.name}
                onChange={(e) => handleUpdate(index, { name: e.target.value })}
                placeholder="E-commerce Platform"
                className="mt-1"
              />
            </div>
            <div>
              <label
                htmlFor={`proj-role-${proj.id}`}
                className="text-sm font-medium text-slate-700"
              >
                Your Role
              </label>
              <Input
                id={`proj-role-${proj.id}`}
                value={proj.role}
                onChange={(e) => handleUpdate(index, { role: e.target.value })}
                placeholder="Lead Developer"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <label htmlFor={`proj-tech-${proj.id}`} className="text-sm font-medium text-slate-700">
              Technologies Used
            </label>
            <Input
              id={`proj-tech-${proj.id}`}
              value={proj.technologies}
              onChange={(e) => handleUpdate(index, { technologies: e.target.value })}
              placeholder="React, Node.js, PostgreSQL"
              className="mt-1"
            />
          </div>

          <div>
            <label htmlFor={`proj-desc-${proj.id}`} className="text-sm font-medium text-slate-700">
              Description
            </label>
            <Textarea
              id={`proj-desc-${proj.id}`}
              value={proj.description}
              onChange={(e) => handleUpdate(index, { description: e.target.value })}
              placeholder="Built a full-stack e-commerce platform with user authentication, product management, and payment processing..."
              className="mt-1 min-h-[80px]"
            />
          </div>

          <div>
            <label htmlFor={`proj-url-${proj.id}`} className="text-sm font-medium text-slate-700">
              Project URL (optional)
            </label>
            <Input
              id={`proj-url-${proj.id}`}
              value={proj.url || ''}
              onChange={(e) => handleUpdate(index, { url: e.target.value })}
              placeholder="https://github.com/username/project"
              className="mt-1"
            />
          </div>
        </div>
      ))}

      <Button variant="outline" onClick={handleAdd} className="w-full gap-2">
        <Plus className="h-4 w-4" />
        Add Another Project
      </Button>
    </div>
  );
}
