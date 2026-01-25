'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import {
  AlertTriangle,
  Briefcase,
  Calendar,
  FileText,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  Target,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { StudentPredictionCard } from '@/components/analytics/EngagementPredictionPanel';
import { SignalList } from '@/components/signals/SignalCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

type TimelineEventType =
  | 'application'
  | 'goal'
  | 'resume'
  | 'cover_letter'
  | 'session'
  | 'note'
  | 'comment';

interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  label: string;
  summary: string;
  timestamp: number;
  sourceId?: string;
  sourceLink?: string;
  metadata?: Record<string, unknown>;
}

const EVENT_TYPE_CONFIG: Record<
  TimelineEventType,
  { icon: typeof Briefcase; color: string; bgColor: string }
> = {
  application: {
    icon: Briefcase,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  goal: {
    icon: Target,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
  },
  resume: {
    icon: FileText,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  cover_letter: {
    icon: Send,
    color: 'text-pink-600',
    bgColor: 'bg-pink-100',
  },
  session: {
    icon: Calendar,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
  note: {
    icon: MessageSquare,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
  },
  comment: {
    icon: MessageSquare,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
  },
};

const FILTER_OPTIONS: { value: TimelineEventType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'application', label: 'Applications' },
  { value: 'goal', label: 'Goals' },
  { value: 'resume', label: 'Resumes' },
  { value: 'cover_letter', label: 'Cover Letters' },
  { value: 'session', label: 'Sessions' },
  { value: 'note', label: 'Notes' },
  { value: 'comment', label: 'Comments' },
];

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  // Handle future timestamps (e.g., scheduled sessions)
  if (diff < 0) return 'Upcoming';

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const weeks = Math.floor(diff / 604800000);
  const months = Math.floor(diff / 2592000000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 4) return `${weeks}w ago`;
  return `${months}mo ago`;
}

function groupEventsByDate(events: TimelineEvent[]): Map<string, TimelineEvent[]> {
  const groups = new Map<string, TimelineEvent[]>();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const weekAgo = today - 604800000;

  for (const event of events) {
    let groupKey: string;
    const eventDate = new Date(event.timestamp);
    const eventDay = new Date(
      eventDate.getFullYear(),
      eventDate.getMonth(),
      eventDate.getDate(),
    ).getTime();

    if (eventDay >= today) {
      groupKey = 'Today';
    } else if (eventDay >= yesterday) {
      groupKey = 'Yesterday';
    } else if (eventDay >= weekAgo) {
      groupKey = 'This Week';
    } else {
      groupKey = 'Earlier';
    }

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(event);
  }

  return groups;
}

type AssetType = 'application' | 'goal' | 'resume' | 'cover_letter' | 'project';

interface StudentTimelineProps {
  studentId: Id<'users'>;
  onAssetSelect?: (asset: { type: AssetType; id: string }) => void;
}

export function StudentTimeline({ studentId, onAssetSelect }: StudentTimelineProps) {
  const { user } = useUser();
  const clerkId = user?.id;
  const { toast } = useToast();

  const [selectedFilter, setSelectedFilter] = useState<TimelineEventType | 'all'>('all');
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const [allEvents, setAllEvents] = useState<TimelineEvent[]>([]);
  const [showSignals, setShowSignals] = useState(true);
  const prevCursorRef = useRef<number | undefined>(undefined);

  const filters = useMemo(() => {
    if (selectedFilter === 'all') return undefined;
    return { types: [selectedFilter] };
  }, [selectedFilter]);

  const timelineData = useQuery(
    api.advisor_students.getStudentTimeline,
    clerkId && studentId
      ? {
          clerkId,
          studentId,
          filters,
          cursor,
          limit: 20,
        }
      : 'skip',
  );

  // Query signals for this student (skip until auth is ready, matching timeline query pattern)
  const signalsData = useQuery(
    api.signals.getSignalsByStudent,
    clerkId && studentId
      ? {
          studentId,
          limit: 10,
        }
      : 'skip',
  );

  // Signal mutations
  const snoozeSignalMutation = useMutation(api.signals.snoozeSignal);
  const dismissSignalMutation = useMutation(api.signals.dismissSignal);
  const resolveSignalMutation = useMutation(api.signals.resolveSignal);

  // Signal handlers
  const handleSnooze = useCallback(
    async (signalId: Id<'signals'>, days: number) => {
      try {
        await snoozeSignalMutation({ signalId, snoozeDays: days });
        toast({ title: 'Signal snoozed', description: `Will resurface in ${days} day(s)` });
      } catch (error) {
        console.error('Failed to snooze signal:', error);
        toast({ title: 'Error', description: 'Failed to snooze signal', variant: 'destructive' });
      }
    },
    [snoozeSignalMutation, toast],
  );

  const handleDismiss = useCallback(
    async (signalId: Id<'signals'>) => {
      try {
        await dismissSignalMutation({ signalId });
        toast({ title: 'Signal dismissed' });
      } catch (error) {
        console.error('Failed to dismiss signal:', error);
        toast({ title: 'Error', description: 'Failed to dismiss signal', variant: 'destructive' });
      }
    },
    [dismissSignalMutation, toast],
  );

  const handleResolve = useCallback(
    async (signalId: Id<'signals'>, notes?: string) => {
      try {
        await resolveSignalMutation({
          signalId,
          resolutionType: 'action_taken',
          resolutionNotes: notes,
        });
        toast({ title: 'Signal resolved' });
      } catch (error) {
        console.error('Failed to resolve signal:', error);
        toast({ title: 'Error', description: 'Failed to resolve signal', variant: 'destructive' });
      }
    },
    [resolveSignalMutation, toast],
  );

  // Accumulate events when new data arrives
  useEffect(() => {
    if (timelineData?.events) {
      if (cursor === undefined) {
        // First page or filter reset - replace all events
        setAllEvents(timelineData.events);
      } else if (cursor !== prevCursorRef.current) {
        // New page loaded - append events
        setAllEvents((prev) => [...prev, ...timelineData.events]);
      }
      prevCursorRef.current = cursor;
    }
  }, [timelineData?.events, cursor]);

  const handleLoadMore = useCallback(() => {
    if (timelineData?.nextCursor) {
      setCursor(timelineData.nextCursor);
    }
  }, [timelineData?.nextCursor]);

  const handleFilterChange = useCallback((filter: TimelineEventType | 'all') => {
    setSelectedFilter(filter);
    setCursor(undefined);
    setAllEvents([]); // Reset accumulated events on filter change
  }, []);

  // Group events by date
  const groupedEvents = useMemo(() => {
    if (allEvents.length === 0) return new Map<string, TimelineEvent[]>();
    return groupEventsByDate(allEvents);
  }, [allEvents]);

  // Count active signals (signalsData is an array)
  const activeSignalCount = useMemo(() => {
    if (!signalsData) return 0;
    return signalsData.filter((s) => s.status === 'active' || s.status === 'snoozed').length;
  }, [signalsData]);

  if (!clerkId) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5" />
          Activity Timeline
          {activeSignalCount > 0 && (
            <Badge variant="destructive" className="ml-auto">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {activeSignalCount} Signal{activeSignalCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
        {/* Filter pills */}
        <div className="flex flex-wrap gap-1.5 pt-2">
          {signalsData && signalsData.length > 0 && (
            <Button
              variant={showSignals ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowSignals(!showSignals)}
            >
              <AlertTriangle className="h-3 w-3 mr-1" />
              Signals
            </Button>
          )}
          {FILTER_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={selectedFilter === option.value ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => handleFilterChange(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="max-h-[500px] overflow-y-auto">
        {/* Engagement Prediction - Compact */}
        <div className="mb-4">
          <StudentPredictionCard studentId={studentId} compact />
        </div>

        {/* Signals Section */}
        {showSignals && signalsData && signalsData.length > 0 && (
          <div className="mb-6">
            <SignalList
              signals={signalsData}
              onSnooze={handleSnooze}
              onDismiss={handleDismiss}
              onResolve={handleResolve}
              showResolved
            />
          </div>
        )}

        {/* Activity Timeline */}
        {timelineData === undefined ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : allEvents.length === 0 && (!signalsData || signalsData.length === 0) ? (
          <div className="text-center py-12">
            <Sparkles className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-sm font-medium text-muted-foreground">No activity yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedFilter === 'all'
                ? 'Activity will appear here as the student works on their career'
                : `No ${selectedFilter.replace('_', ' ')} activity found`}
            </p>
          </div>
        ) : allEvents.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">
              {selectedFilter === 'all'
                ? 'No activity events yet'
                : `No ${selectedFilter.replace('_', ' ')} activity found`}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from(groupedEvents.entries()).map(([groupLabel, events]) => (
              <div key={groupLabel}>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {groupLabel}
                </div>
                <div className="space-y-3">
                  {events.map((event) => {
                    const config = EVENT_TYPE_CONFIG[event.type];
                    const IconComponent = config.icon;

                    return (
                      <div key={event.id} className="flex items-start gap-3 group">
                        <div
                          className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${config.bgColor}`}
                        >
                          <IconComponent className={`h-4 w-4 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs font-normal">
                              {event.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatRelativeTime(event.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm mt-0.5 line-clamp-2">{event.summary}</p>
                          {onAssetSelect &&
                            event.sourceId &&
                            ['application', 'goal', 'resume', 'cover_letter'].includes(
                              event.type,
                            ) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onAssetSelect({
                                    type: event.type as AssetType,
                                    id: event.sourceId!,
                                  });
                                }}
                                className="text-xs text-primary hover:underline mt-1 inline-block"
                              >
                                View details →
                              </button>
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Load more button */}
            {timelineData.hasMore && (
              <div className="flex justify-center pt-4">
                <Button variant="outline" size="sm" onClick={handleLoadMore} className="text-xs">
                  Load more
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
