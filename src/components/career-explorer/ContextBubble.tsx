'use client';

import { Settings } from 'lucide-react';
import React, { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import type { GradSchoolInterest, MajorContext } from '@/lib/career-explorer/types';

interface ContextBubbleProps {
  majorContext: MajorContext;
  onContextChange: (context: MajorContext) => void;
  onApply: () => void;
  isLoading?: boolean;
}

const CLOSENESS_LABELS: Record<number, string> = {
  0: 'Open to anything',
  25: 'Somewhat flexible',
  50: 'Balanced',
  75: 'Prefer related',
  100: 'Strictly related',
};

function getClosenessLabel(value: number): string {
  const keys = Object.keys(CLOSENESS_LABELS)
    .map(Number)
    .sort((a, b) => a - b);
  let closestKey = keys[0];
  for (const key of keys) {
    if (Math.abs(value - key) < Math.abs(value - closestKey)) {
      closestKey = key;
    }
  }
  return CLOSENESS_LABELS[closestKey];
}

export function ContextBubble({
  majorContext,
  onContextChange,
  onApply,
  isLoading,
}: ContextBubbleProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleClosenessChange = (value: number[]) => {
    onContextChange({ ...majorContext, closeness: value[0] });
  };

  const handleEnabledChange = (enabled: boolean) => {
    onContextChange({ ...majorContext, enabled });
  };

  const handleOpenToUnrelatedChange = (open_to_unrelated: boolean) => {
    onContextChange({ ...majorContext, open_to_unrelated });
  };

  const handleGradSchoolChange = (value: string) => {
    onContextChange({
      ...majorContext,
      grad_school_interest: value as GradSchoolInterest,
    });
  };

  const handleApply = () => {
    onApply();
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full bg-white shadow-sm border-neutral-200 hover:bg-neutral-50"
        >
          <Settings className="h-4 w-4 text-neutral-600" />
          <span className="sr-only">Path Settings</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end" sideOffset={8}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Path Settings</h4>
            <Badge
              variant={majorContext.enabled ? 'default' : 'secondary'}
              className={
                majorContext.enabled ? 'bg-primary-100 text-primary-700 text-xs' : 'text-xs'
              }
            >
              {majorContext.enabled ? 'Active' : 'Off'}
            </Badge>
          </div>

          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="major-enabled" className="text-sm">
                Consider my major
              </Label>
              <p className="text-xs text-neutral-500">Include major when suggesting paths</p>
            </div>
            <Switch
              id="major-enabled"
              checked={majorContext.enabled}
              onCheckedChange={handleEnabledChange}
            />
          </div>

          {majorContext.enabled && (
            <>
              {/* Closeness Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Relevance to major</Label>
                  <span className="text-xs text-neutral-500">
                    {getClosenessLabel(majorContext.closeness)}
                  </span>
                </div>
                <Slider
                  value={[majorContext.closeness]}
                  onValueChange={handleClosenessChange}
                  max={100}
                  step={5}
                  className="w-full"
                />
              </div>

              {/* Open to Unrelated Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="open-unrelated" className="text-sm">
                    Show unrelated paths
                  </Label>
                  <p className="text-xs text-neutral-500">Include paths outside your major</p>
                </div>
                <Switch
                  id="open-unrelated"
                  checked={majorContext.open_to_unrelated}
                  onCheckedChange={handleOpenToUnrelatedChange}
                />
              </div>

              {/* Grad School Interest */}
              <div className="space-y-2">
                <Label className="text-sm">Graduate school interest</Label>
                <Select
                  value={majorContext.grad_school_interest || 'none'}
                  onValueChange={handleGradSchoolChange}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select interest level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not interested</SelectItem>
                    <SelectItem value="considering">Considering it</SelectItem>
                    <SelectItem value="planning">Definitely planning</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Apply Button */}
          <Button
            onClick={handleApply}
            disabled={isLoading}
            className="w-full h-8 text-sm"
            variant="default"
          >
            {isLoading ? 'Updating...' : 'Apply Changes'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
