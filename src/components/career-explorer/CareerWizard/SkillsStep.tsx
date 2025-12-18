'use client';

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Lightbulb,
  Loader2,
  Plus,
  RefreshCw,
  Target,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { SkillsSuggestion, StartingRole } from '@/lib/career-explorer/types';

interface SkillsStepProps {
  startingRole: StartingRole;
  skillsHave: string[];
  skillsWant: string[];
  onSkillsHaveChange: (skills: string[]) => void;
  onSkillsWantChange: (skills: string[]) => void;
  onContinue: () => void;
  onBack: () => void;
}

export function SkillsStep({
  startingRole,
  skillsHave,
  skillsWant,
  onSkillsHaveChange,
  onSkillsWantChange,
  onContinue,
  onBack,
}: SkillsStepProps) {
  const [suggestions, setSuggestions] = useState<SkillsSuggestion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [newSkillHave, setNewSkillHave] = useState('');
  const [newSkillWant, setNewSkillWant] = useState('');

  // Fetch skill suggestions based on starting role
  const fetchSuggestions = useCallback(async () => {
    setIsLoading(true);
    setFetchError(false);
    try {
      const response = await fetch('/api/career-explorer/skills-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_title: startingRole.title }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data);
      } else {
        setFetchError(true);
      }
    } catch (error) {
      console.error('Skills suggestion error:', error);
      setFetchError(true);
    } finally {
      setIsLoading(false);
    }
  }, [startingRole.title]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const toggleSkillHave = (skill: string) => {
    if (skillsHave.includes(skill)) {
      onSkillsHaveChange(skillsHave.filter((s) => s !== skill));
    } else {
      onSkillsHaveChange([...skillsHave, skill]);
    }
  };

  const toggleSkillWant = (skill: string) => {
    if (skillsWant.includes(skill)) {
      onSkillsWantChange(skillsWant.filter((s) => s !== skill));
    } else {
      onSkillsWantChange([...skillsWant, skill]);
    }
  };

  const addCustomSkillHave = () => {
    const skill = newSkillHave.trim();
    if (skill && !skillsHave.includes(skill)) {
      onSkillsHaveChange([...skillsHave, skill]);
      setNewSkillHave('');
    }
  };

  const addCustomSkillWant = () => {
    const skill = newSkillWant.trim();
    if (skill && !skillsWant.includes(skill)) {
      onSkillsWantChange([...skillsWant, skill]);
      setNewSkillWant('');
    }
  };

  const removeSkillHave = (skill: string) => {
    onSkillsHaveChange(skillsHave.filter((s) => s !== skill));
  };

  const removeSkillWant = (skill: string) => {
    onSkillsWantChange(skillsWant.filter((s) => s !== skill));
  };

  // Combine all suggested skills for the "have" column
  const suggestedSkillsHave = suggestions
    ? [...suggestions.required, ...suggestions.transferable]
    : [];

  // Combine recommended skills for the "want" column
  const suggestedSkillsWant = suggestions
    ? [...suggestions.recommended, ...suggestions.required.filter((s) => !skillsHave.includes(s))]
    : [];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500 mb-4" />
        <p className="text-neutral-500">Loading skills for {startingRole.title}...</p>
      </div>
    );
  }

  if (fetchError && !suggestions) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-semibold text-neutral-900 mb-2">Failed to load suggestions</h2>
        <p className="text-neutral-500 text-center max-w-md mb-6">
          We couldn&apos;t load skill suggestions for {startingRole.title}. You can try again or
          continue by adding skills manually.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
          <Button onClick={fetchSuggestions}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <Button variant="ghost" onClick={onBack} className="text-neutral-600">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="text-center flex-1">
          <h1 className="text-2xl font-semibold text-neutral-900">What are your skills?</h1>
          <p className="text-neutral-500 mt-1">
            Select skills you have and skills you want to develop
          </p>
        </div>
        <Button onClick={onContinue} disabled={skillsHave.length < 1} className="min-w-[120px]">
          Continue
        </Button>
      </div>

      {/* Two Column Layout */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Skills I Have */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Skills I Have</CardTitle>
                <CardDescription className="text-sm">Skills you already possess</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selected Skills */}
            {skillsHave.length > 0 && (
              <div className="flex flex-wrap gap-2 pb-3 border-b border-neutral-100">
                {skillsHave.map((skill) => (
                  <Badge
                    key={skill}
                    variant="default"
                    className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 cursor-pointer py-1.5 px-3"
                    onClick={() => removeSkillHave(skill)}
                  >
                    {skill}
                    <X className="w-3 h-3 ml-1.5" />
                  </Badge>
                ))}
              </div>
            )}

            {/* Add Custom Skill */}
            <div className="flex gap-2">
              <Input
                placeholder="Add a skill..."
                value={newSkillHave}
                onChange={(e) => setNewSkillHave(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomSkillHave()}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={addCustomSkillHave}
                disabled={!newSkillHave.trim()}
                aria-label="Add skill"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Suggested Skills */}
            <div className="space-y-2">
              <p className="text-xs text-neutral-500 font-medium uppercase tracking-wide">
                Suggested Skills
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestedSkillsHave
                  .filter((skill) => !skillsHave.includes(skill))
                  .slice(0, 12)
                  .map((skill) => (
                    <Badge
                      key={skill}
                      variant="outline"
                      className="cursor-pointer hover:bg-emerald-50 hover:border-emerald-300 py-1.5 px-3"
                      onClick={() => toggleSkillHave(skill)}
                    >
                      {skill}
                    </Badge>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Skills I Want to Build */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                <Target className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Skills I Want</CardTitle>
                <CardDescription className="text-sm">Skills you want to develop</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selected Skills */}
            {skillsWant.length > 0 && (
              <div className="flex flex-wrap gap-2 pb-3 border-b border-neutral-100">
                {skillsWant.map((skill) => (
                  <Badge
                    key={skill}
                    variant="default"
                    className="bg-primary-100 text-primary-700 hover:bg-primary-200 cursor-pointer py-1.5 px-3"
                    onClick={() => removeSkillWant(skill)}
                  >
                    {skill}
                    <X className="w-3 h-3 ml-1.5" />
                  </Badge>
                ))}
              </div>
            )}

            {/* Add Custom Skill */}
            <div className="flex gap-2">
              <Input
                placeholder="Add a skill..."
                value={newSkillWant}
                onChange={(e) => setNewSkillWant(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomSkillWant()}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={addCustomSkillWant}
                disabled={!newSkillWant.trim()}
                aria-label="Add skill"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Suggested Skills */}
            <div className="space-y-2">
              <p className="text-xs text-neutral-500 font-medium uppercase tracking-wide">
                Recommended to Learn
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestedSkillsWant
                  .filter((skill) => !skillsWant.includes(skill) && !skillsHave.includes(skill))
                  .slice(0, 12)
                  .map((skill) => (
                    <Badge
                      key={skill}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary-50 hover:border-primary-300 py-1.5 px-3"
                      onClick={() => toggleSkillWant(skill)}
                    >
                      {skill}
                    </Badge>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tip */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mt-6">
        <Lightbulb className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-medium">Tip</p>
          <p className="text-amber-700">
            Select at least 3 skills you have and 2-3 skills you want to build. This helps us
            personalize your career path recommendations.
          </p>
        </div>
      </div>
    </div>
  );
}
