'use client';

import { X } from 'lucide-react';
import React, { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * Available event types for engagement tracking.
 * Grouped by category for easier selection.
 */
export const EVENT_TYPE_GROUPS = {
  auth: {
    label: 'Authentication',
    events: [
      { value: 'login', label: 'Login' },
      { value: 'session_start', label: 'Session Start' },
    ],
  },
  application: {
    label: 'Job Applications',
    events: [
      { value: 'application_created', label: 'Application Created' },
      { value: 'application_updated', label: 'Application Updated' },
      { value: 'application_stage_changed', label: 'Stage Changed' },
    ],
  },
  document: {
    label: 'Documents',
    events: [
      { value: 'resume_created', label: 'Resume Created' },
      { value: 'resume_updated', label: 'Resume Updated' },
      { value: 'resume_analyzed', label: 'Resume Analyzed' },
      { value: 'cover_letter_created', label: 'Cover Letter Created' },
      { value: 'cover_letter_updated', label: 'Cover Letter Updated' },
    ],
  },
  goal: {
    label: 'Goals',
    events: [
      { value: 'goal_created', label: 'Goal Created' },
      { value: 'goal_updated', label: 'Goal Updated' },
      { value: 'goal_completed', label: 'Goal Completed' },
      { value: 'goal_checklist_item_completed', label: 'Checklist Item Completed' },
    ],
  },
  networking: {
    label: 'Networking',
    events: [
      { value: 'contact_added', label: 'Contact Added' },
      { value: 'contact_updated', label: 'Contact Updated' },
      { value: 'interaction_logged', label: 'Interaction Logged' },
    ],
  },
  ai_coach: {
    label: 'AI Coach',
    events: [
      { value: 'coach_conversation_started', label: 'Conversation Started' },
      { value: 'coach_message_sent', label: 'Message Sent' },
    ],
  },
  career_explorer: {
    label: 'Career Explorer',
    events: [
      { value: 'career_quiz_completed', label: 'Quiz Completed' },
      { value: 'career_path_created', label: 'Path Created' },
      { value: 'role_saved', label: 'Role Saved' },
    ],
  },
} as const;

/**
 * Union type of all valid event type values.
 * Derived from EVENT_TYPE_GROUPS for type-safe event references.
 */
export type EventType =
  (typeof EVENT_TYPE_GROUPS)[keyof typeof EVENT_TYPE_GROUPS]['events'][number]['value'];

/**
 * Type for event type group keys (auth, application, document, etc.)
 */
export type EventTypeGroup = keyof typeof EVENT_TYPE_GROUPS;

/**
 * Get all event types as a flat array.
 */
export function getAllEventTypes(): EventType[] {
  return Object.values(EVENT_TYPE_GROUPS).flatMap((group) =>
    group.events.map((e) => e.value),
  ) as EventType[];
}

/**
 * Pre-computed lookup map for event value -> label.
 * O(1) lookup instead of linear search through all groups.
 */
const eventLabelMap = new Map<string, string>(
  Object.values(EVENT_TYPE_GROUPS).flatMap((group) =>
    group.events.map((event) => [event.value, event.label] as const),
  ),
);

/**
 * Get the display label for an event type value.
 */
export function getEventLabel(eventType: string): string {
  return eventLabelMap.get(eventType) ?? eventType;
}

/**
 * Default qualifying event types for engagement scoring.
 */
export const DEFAULT_QUALIFYING_EVENTS = [
  'login',
  'application_created',
  'application_updated',
  'application_stage_changed',
  'resume_created',
  'resume_updated',
  'goal_created',
  'goal_updated',
  'goal_completed',
  'coach_conversation_started',
  'coach_message_sent',
] as const satisfies readonly EventType[];

interface EventTypeSelectorProps {
  selectedEvents: EventType[];
  onChange: (events: EventType[]) => void;
  className?: string;
}

export function EventTypeSelector({ selectedEvents, onChange, className }: EventTypeSelectorProps) {
  const allEventTypes = useMemo(() => getAllEventTypes(), []);

  const handleToggle = (eventType: EventType) => {
    if (selectedEvents.includes(eventType)) {
      onChange(selectedEvents.filter((e) => e !== eventType));
    } else {
      onChange([...selectedEvents, eventType]);
    }
  };

  const handleSelectAll = () => {
    onChange(allEventTypes);
  };

  const handleSelectNone = () => {
    onChange([]);
  };

  const handleSelectDefaults = () => {
    onChange([...DEFAULT_QUALIFYING_EVENTS]);
  };

  const allSelected = allEventTypes.every((e) => selectedEvents.includes(e));
  const noneSelected = selectedEvents.length === 0;

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Quick select:</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSelectAll}
          disabled={allSelected}
        >
          All
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleSelectDefaults}>
          Defaults
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSelectNone}
          disabled={noneSelected}
        >
          None
        </Button>
        <Badge variant="secondary" className="ml-auto">
          {selectedEvents.length} selected
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {Object.entries(EVENT_TYPE_GROUPS).map(([category, group]) => (
          <div key={category} className="rounded-lg border p-3">
            <h5 className="mb-2 text-sm font-medium text-muted-foreground">{group.label}</h5>
            <div className="space-y-2">
              {group.events.map((event) => (
                <div key={event.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`event-${event.value}`}
                    checked={selectedEvents.includes(event.value)}
                    onCheckedChange={() => handleToggle(event.value)}
                  />
                  <Label
                    htmlFor={`event-${event.value}`}
                    className="cursor-pointer text-sm font-normal"
                  >
                    {event.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Compact version showing selected events as badges.
 */
interface EventTypeBadgesProps {
  events: string[];
  onRemove?: (event: string) => void;
  maxDisplay?: number;
  className?: string;
}

export function EventTypeBadges({
  events,
  onRemove,
  maxDisplay = 5,
  className,
}: EventTypeBadgesProps) {
  const displayEvents = events.slice(0, maxDisplay);
  const remaining = events.length - maxDisplay;

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {displayEvents.map((event) => (
        <Badge key={event} variant="secondary" className="gap-1">
          {getEventLabel(event)}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(event)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
              aria-label={`Remove ${getEventLabel(event)}`}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}
      {remaining > 0 && <Badge variant="outline">+{remaining} more</Badge>}
      {events.length === 0 && (
        <span className="text-sm text-muted-foreground">No events selected</span>
      )}
    </div>
  );
}
