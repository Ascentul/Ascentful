'use client';

import React from 'react';

import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import type { QuizQuestion } from '@/lib/career-explorer/types';
import { cn } from '@/lib/utils';

interface QuizStepProps {
  question: QuizQuestion;
  value: string | string[] | number | undefined;
  onChange: (value: string | string[] | number) => void;
}

export function QuizStep({ question, value, onChange }: QuizStepProps) {
  const renderSingleChoice = () => (
    <RadioGroup value={value as string} onValueChange={onChange} className="space-y-3">
      {question.options?.map((option) => (
        <Label
          key={option.value}
          htmlFor={`${question.id}-${option.value}`}
          className="cursor-pointer"
        >
          <Card
            className={cn(
              'flex items-center gap-3 p-4 transition-all hover:border-primary-300',
              value === option.value && 'border-primary-500 bg-primary-50',
            )}
          >
            <RadioGroupItem value={option.value} id={`${question.id}-${option.value}`} />
            <span className="text-sm">{option.label}</span>
          </Card>
        </Label>
      ))}
    </RadioGroup>
  );

  const renderMultipleChoice = () => {
    const selectedValues = (value as string[]) || [];
    const maxSelections = 3;

    const handleToggle = (optionValue: string) => {
      if (selectedValues.includes(optionValue)) {
        onChange(selectedValues.filter((v) => v !== optionValue));
      } else if (selectedValues.length < maxSelections) {
        onChange([...selectedValues, optionValue]);
      }
    };

    return (
      <div className="space-y-3">
        <p className="text-sm text-neutral-500">
          Select up to {maxSelections} options ({selectedValues.length}/{maxSelections})
        </p>
        {question.options?.map((option) => {
          const isSelected = selectedValues.includes(option.value);
          const isDisabled = !isSelected && selectedValues.length >= maxSelections;

          return (
            <Label
              key={option.value}
              htmlFor={`${question.id}-${option.value}`}
              className={cn('cursor-pointer', isDisabled && 'cursor-not-allowed')}
            >
              <Card
                className={cn(
                  'flex items-center gap-3 p-4 transition-all',
                  isSelected && 'border-primary-500 bg-primary-50',
                  !isSelected && !isDisabled && 'hover:border-primary-300',
                  isDisabled && 'opacity-50',
                )}
              >
                <Checkbox
                  id={`${question.id}-${option.value}`}
                  checked={isSelected}
                  disabled={isDisabled}
                  onCheckedChange={() => handleToggle(option.value)}
                />
                <span className="text-sm">{option.label}</span>
              </Card>
            </Label>
          );
        })}
      </div>
    );
  };

  const renderScale = () => {
    const currentValue =
      (value as number) ?? Math.ceil((question.scaleMax! + question.scaleMin!) / 2);

    return (
      <div className="space-y-6 py-4">
        <div className="px-2">
          <Slider
            value={[currentValue]}
            onValueChange={([v]) => onChange(v)}
            min={question.scaleMin}
            max={question.scaleMax}
            step={1}
            className="w-full"
          />
        </div>
        <div className="flex justify-between text-sm text-neutral-500">
          <span>{question.scaleLabels?.min}</span>
          <span className="font-medium text-primary-600">{currentValue}</span>
          <span>{question.scaleLabels?.max}</span>
        </div>
      </div>
    );
  };

  const renderRanking = () => {
    const rankedValues = (value as string[]) || [];

    const handleRankItem = (optionValue: string) => {
      if (rankedValues.includes(optionValue)) {
        // Remove from ranking
        onChange(rankedValues.filter((v) => v !== optionValue));
      } else {
        // Add to ranking
        onChange([...rankedValues, optionValue]);
      }
    };

    return (
      <div className="space-y-3">
        <p className="text-sm text-neutral-500">
          Click items in order of importance (1 = most important)
        </p>
        {question.options?.map((option) => {
          const rankIndex = rankedValues.indexOf(option.value);
          const isRanked = rankIndex !== -1;

          return (
            <Card
              key={option.value}
              onClick={() => handleRankItem(option.value)}
              className={cn(
                'flex items-center gap-3 p-4 cursor-pointer transition-all',
                isRanked && 'border-primary-500 bg-primary-50',
                !isRanked && 'hover:border-primary-300',
              )}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                  isRanked ? 'bg-primary-500 text-white' : 'bg-neutral-100 text-neutral-400',
                )}
              >
                {isRanked ? rankIndex + 1 : '-'}
              </div>
              <span className="text-sm">{option.label}</span>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-neutral-900">{question.question}</h3>
      </div>

      {question.type === 'single_choice' && renderSingleChoice()}
      {question.type === 'multiple_choice' && renderMultipleChoice()}
      {question.type === 'scale' && renderScale()}
      {question.type === 'ranking' && renderRanking()}
    </div>
  );
}
