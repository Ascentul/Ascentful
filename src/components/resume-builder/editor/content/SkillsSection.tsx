'use client';

import { Plus, Sparkles, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SkillsSectionProps {
  skills: string[];
  onChange: (skills: string[]) => void;
  onSuggestAI?: () => void;
  isSuggesting?: boolean;
}

export function SkillsSection({ skills, onChange, onSuggestAI, isSuggesting }: SkillsSectionProps) {
  const [newSkill, setNewSkill] = useState('');

  const handleAddSkill = () => {
    const trimmed = newSkill.trim();
    if (trimmed && !skills.includes(trimmed)) {
      onChange([...skills, trimmed]);
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    onChange(skills.filter((skill) => skill !== skillToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSkill();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Add relevant technical and soft skills.</p>
        {onSuggestAI && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSuggestAI}
            disabled={isSuggesting}
            className="gap-1.5 text-primary-600 border-primary-200 hover:bg-primary-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {isSuggesting ? 'Suggesting...' : 'Suggest skills'}
          </Button>
        )}
      </div>

      {/* Skills chips */}
      <div className="flex flex-wrap gap-2">
        {skills.map((skill) => (
          <span
            key={skill}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-full text-sm"
          >
            {skill}
            <button
              type="button"
              onClick={() => handleRemoveSkill(skill)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>

      {/* Add new skill */}
      <div className="flex gap-2">
        <Input
          value={newSkill}
          onChange={(e) => setNewSkill(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a skill and press Enter"
          className="flex-1"
        />
        <Button
          variant="outline"
          onClick={handleAddSkill}
          disabled={!newSkill.trim()}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {skills.length < 5 && (
        <p className="text-xs text-amber-600">
          Tip: Add at least 5 skills to improve your resume score
        </p>
      )}
    </div>
  );
}
