'use client';

import { ChevronDown, ChevronUp, GraduationCap, Settings2 } from 'lucide-react';
import React, { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
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
  const [isExpanded, setIsExpanded] = useState(false);

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

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className="bg-gradient-to-r from-primary-50 to-violet-50 border-primary-200">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-primary-50/50 transition-colors pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <GraduationCap className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Major Context</CardTitle>
                  <p className="text-sm text-neutral-500">
                    {majorContext.major || 'Not set'} •{' '}
                    {majorContext.enabled ? getClosenessLabel(majorContext.closeness) : 'Disabled'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={majorContext.enabled ? 'default' : 'secondary'}
                  className={majorContext.enabled ? 'bg-primary-100 text-primary-700' : ''}
                >
                  {majorContext.enabled ? 'Active' : 'Off'}
                </Badge>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-neutral-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-neutral-400" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="major-enabled">Consider my major</Label>
                <p className="text-sm text-neutral-500">Include your major when suggesting paths</p>
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
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>How closely related should paths be?</Label>
                    <Badge variant="outline" className="font-normal">
                      {getClosenessLabel(majorContext.closeness)}
                    </Badge>
                  </div>
                  <Slider
                    value={[majorContext.closeness]}
                    onValueChange={handleClosenessChange}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-neutral-400">
                    <span>Open to anything</span>
                    <span>Strictly related</span>
                  </div>
                </div>

                {/* Open to Unrelated Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="open-unrelated">Show unrelated paths too</Label>
                    <p className="text-sm text-neutral-500">
                      Include some paths outside your major
                    </p>
                  </div>
                  <Switch
                    id="open-unrelated"
                    checked={majorContext.open_to_unrelated}
                    onCheckedChange={handleOpenToUnrelatedChange}
                  />
                </div>

                {/* Grad School Interest */}
                <div className="space-y-2">
                  <Label>Graduate school interest</Label>
                  <Select
                    value={majorContext.grad_school_interest || 'none'}
                    onValueChange={handleGradSchoolChange}
                  >
                    <SelectTrigger>
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
            <Button onClick={onApply} disabled={isLoading} className="w-full" variant="default">
              <Settings2 className="w-4 h-4 mr-2" />
              {isLoading ? 'Updating paths...' : 'Apply Context'}
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
