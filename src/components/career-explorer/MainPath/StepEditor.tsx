'use client';

import { Id } from 'convex/_generated/dataModel';
import { Plus, X } from 'lucide-react';
import React, { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type {
  MainPathStep,
  StepDetails,
  StepTimeframe,
  StepType,
} from '@/lib/career-explorer/types';

interface StepEditorProps {
  step?: MainPathStep;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    step_type: StepType;
    timeframe: StepTimeframe;
    role_id?: string;
    details: StepDetails;
    notes?: string;
  }) => void;
  isLoading?: boolean;
}

const STEP_TYPES: { value: StepType; label: string }[] = [
  { value: 'role', label: 'Role' },
  { value: 'bridge', label: 'Bridge Role' },
  { value: 'project', label: 'Project' },
  { value: 'internship', label: 'Internship' },
  { value: 'certification', label: 'Certification' },
];

const TIMEFRAMES: { value: StepTimeframe; label: string }[] = [
  { value: '6m', label: '6 months' },
  { value: '12m', label: '1 year' },
  { value: '24m', label: '2 years' },
  { value: '36m', label: '3 years' },
  { value: 'semester_1', label: 'Semester 1' },
  { value: 'semester_2', label: 'Semester 2' },
  { value: 'summer', label: 'Summer' },
];

export function StepEditor({ step, isOpen, onClose, onSave, isLoading }: StepEditorProps) {
  const [title, setTitle] = useState(step?.title || '');
  const [stepType, setStepType] = useState<StepType>(step?.step_type || 'role');
  const [timeframe, setTimeframe] = useState<StepTimeframe>(step?.timeframe || '12m');
  const [notes, setNotes] = useState(step?.notes || '');

  // Details arrays
  const [skills, setSkills] = useState<string[]>(step?.details.skills_to_build || []);
  const [projects, setProjects] = useState<string[]>(step?.details.projects || []);
  const [certifications, setCertifications] = useState<string[]>(
    step?.details.certifications || [],
  );
  const [experienceTargets, setExperienceTargets] = useState<string[]>(
    step?.details.experience_targets || [],
  );

  // Input states for adding items
  const [newSkill, setNewSkill] = useState('');
  const [newProject, setNewProject] = useState('');
  const [newCertification, setNewCertification] = useState('');
  const [newExperienceTarget, setNewExperienceTarget] = useState('');

  const handleSave = () => {
    if (!title.trim()) return;

    onSave({
      title: title.trim(),
      step_type: stepType,
      timeframe,
      details: {
        skills_to_build: skills.length > 0 ? skills : undefined,
        projects: projects.length > 0 ? projects : undefined,
        certifications: certifications.length > 0 ? certifications : undefined,
        experience_targets: experienceTargets.length > 0 ? experienceTargets : undefined,
      },
      notes: notes.trim() || undefined,
    });
  };

  const addItem = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    inputSetter: React.Dispatch<React.SetStateAction<string>>,
  ) => {
    if (value.trim()) {
      setter((prev) => [...prev, value.trim()]);
      inputSetter('');
    }
  };

  const removeItem = (index: number, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{step ? 'Edit Step' : 'Add Step'}</DialogTitle>
          <DialogDescription>Define the details of this career path step</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Junior Software Engineer"
              />
            </div>

            <div className="space-y-2">
              <Label>Step Type</Label>
              <Select value={stepType} onValueChange={(v) => setStepType(v as StepType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STEP_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Timeframe</Label>
              <Select value={timeframe} onValueChange={(v) => setTimeframe(v as StepTimeframe)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEFRAMES.map((tf) => (
                    <SelectItem key={tf.value} value={tf.value}>
                      {tf.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Skills to Build */}
          <div className="space-y-2">
            <Label>Skills to Build</Label>
            <div className="flex gap-2">
              <Input
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                placeholder="Add a skill"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addItem(newSkill, setSkills, setNewSkill);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => addItem(newSkill, setSkills, setNewSkill)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {skills.map((skill, idx) => (
                  <Badge key={idx} variant="secondary" className="gap-1">
                    {skill}
                    <button
                      onClick={() => removeItem(idx, setSkills)}
                      className="ml-1 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Projects */}
          <div className="space-y-2">
            <Label>Projects</Label>
            <div className="flex gap-2">
              <Input
                value={newProject}
                onChange={(e) => setNewProject(e.target.value)}
                placeholder="Add a project"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addItem(newProject, setProjects, setNewProject);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => addItem(newProject, setProjects, setNewProject)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {projects.length > 0 && (
              <div className="space-y-1 mt-2">
                {projects.map((project, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-neutral-50 rounded px-2 py-1"
                  >
                    <span className="text-sm">{project}</span>
                    <button
                      onClick={() => removeItem(idx, setProjects)}
                      className="text-neutral-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Certifications */}
          <div className="space-y-2">
            <Label>Certifications</Label>
            <div className="flex gap-2">
              <Input
                value={newCertification}
                onChange={(e) => setNewCertification(e.target.value)}
                placeholder="Add a certification"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addItem(newCertification, setCertifications, setNewCertification);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => addItem(newCertification, setCertifications, setNewCertification)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {certifications.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {certifications.map((cert, idx) => (
                  <Badge key={idx} variant="outline" className="gap-1">
                    {cert}
                    <button
                      onClick={() => removeItem(idx, setCertifications)}
                      className="ml-1 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Experience Targets */}
          <div className="space-y-2">
            <Label>Experience Targets</Label>
            <div className="flex gap-2">
              <Input
                value={newExperienceTarget}
                onChange={(e) => setNewExperienceTarget(e.target.value)}
                placeholder="Add an experience target"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addItem(newExperienceTarget, setExperienceTargets, setNewExperienceTarget);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() =>
                  addItem(newExperienceTarget, setExperienceTargets, setNewExperienceTarget)
                }
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {experienceTargets.length > 0 && (
              <div className="space-y-1 mt-2">
                {experienceTargets.map((target, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-neutral-50 rounded px-2 py-1"
                  >
                    <span className="text-sm">{target}</span>
                    <button
                      onClick={() => removeItem(idx, setExperienceTargets)}
                      className="text-neutral-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this step..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!title.trim() || isLoading}>
            {isLoading ? 'Saving...' : step ? 'Save Changes' : 'Add Step'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
