'use client';

import { X } from 'lucide-react';
import { KeyboardEvent, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface SkillsInputProps {
  value: string[]; // Array of skills
  onChange: (skills: string[]) => void;
  placeholder?: string;
  maxSkills?: number;
}

export function SkillsInput({
  value,
  onChange,
  placeholder = 'Type a skill and press Enter...',
  maxSkills = 50,
}: SkillsInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      const trimmed = inputValue.trim();

      // Check if skill already exists (case-insensitive)
      if (value.some((skill) => skill.toLowerCase() === trimmed.toLowerCase())) {
        setInputValue('');
        return;
      }

      // Check max skills limit
      if (value.length >= maxSkills) {
        return;
      }

      onChange([...value, trimmed]);
      setInputValue('');
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      // Remove last skill when backspace is pressed on empty input
      e.preventDefault();
      onChange(value.slice(0, -1));
    }
  };

  const removeSkill = (skillToRemove: string) => {
    onChange(value.filter((skill) => skill !== skillToRemove));
  };

  return (
    <div className="space-y-2">
      {/* Skills badges */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((skill) => (
            <Badge
              key={skill}
              variant="secondary"
              className="pl-3 pr-1 py-1 text-sm rounded-control flex items-center gap-1"
            >
              {skill}
              <button
                type="button"
                onClick={() => removeSkill(skill)}
                className="ml-1 hover:bg-neutral-300 rounded-full p-0.5 transition-colors"
                aria-label={`Remove ${skill}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Input field */}
      <Input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="rounded-control"
      />

      {/* Helper text */}
      <p className="text-xs text-muted-foreground">
        Press Enter to add skills • {value.length}/{maxSkills} skills
      </p>
    </div>
  );
}
