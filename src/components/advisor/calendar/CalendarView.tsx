'use client';

import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';

import { CalendarControls } from './CalendarControls';
import { DayCard } from './DayCard';
import { DayCell } from './DayCell';

type ViewMode = 'day' | 'week' | 'month';

/**
 * Helper function to group items by day
 * @param items Array of items to group
 * @param getTimestamp Function to extract timestamp from an item
 * @returns Map of date strings to arrays of items
 */
function groupByDay<T>(
  items: T[],
  getTimestamp: (item: T) => number | undefined,
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  items.forEach((item) => {
    const timestamp = getTimestamp(item);
    if (timestamp) {
      const date = new Date(timestamp);
      const key = date.toDateString();
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    }
  });
  return grouped;
}

interface Session {
  _id: string;
  student_id: string;
  student_name: string;
  title: string;
  session_type: string;
  start_at: number;
  end_at?: number; // Optional - calculated from duration_minutes if not provided
  duration_minutes: number;
  location?: string;
  meeting_url?: string;
  notes?: string;
  visibility: string;
  status?: string;
}

interface FollowUp {
  _id: string;
  student_id: string;
  student_name: string;
  title: string;
  due_at?: number;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: string;
}

interface CalendarViewProps {
  sessions: Session[];
  followUps: FollowUp[];
  isLoading?: boolean;
  currentDate?: Date;
  onDateChange?: (date: Date) => void;
  /** Route prefix for links (e.g., '/u' or '/advisor') */
  routePrefix?: string;
}

export function CalendarView({
  sessions,
  followUps,
  isLoading,
  currentDate: controlledDate,
  onDateChange,
  routePrefix = '/advisor',
}: CalendarViewProps) {
  const [internalDate, setInternalDate] = useState<Date>(() => controlledDate ?? new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [now, setNow] = useState<number>(() => Date.now());

  // Track initial controlledDate to avoid stale reference while keeping mount-only semantics
  const initialControlledDate = useRef(controlledDate);
  useEffect(() => {
    setNow(Date.now());
    if (!initialControlledDate.current) {
      setInternalDate(new Date());
    }
  }, []);

  // Sync internal date when controlled value changes
  useEffect(() => {
    if (controlledDate) {
      setInternalDate(controlledDate);
    }
  }, [controlledDate]);

  const currentDate = controlledDate ?? internalDate;

  const updateDate = (updater: (date: Date) => Date) => {
    const nextDate = updater(currentDate);
    if (onDateChange) {
      onDateChange(nextDate);
    } else {
      setInternalDate(nextDate);
    }
  };

  // Update current time every minute for accurate session status
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Navigation handlers
  const handlePrevious = () => {
    updateDate((date) => {
      if (viewMode === 'day') return subDays(date, 1);
      if (viewMode === 'week') return subWeeks(date, 1);
      return subMonths(date, 1);
    });
  };

  const handleNext = () => {
    updateDate((date) => {
      if (viewMode === 'day') return addDays(date, 1);
      if (viewMode === 'week') return addWeeks(date, 1);
      return addMonths(date, 1);
    });
  };

  const handleToday = () => {
    updateDate(() => new Date());
  };

  // Get days to display based on view mode (memoized to avoid recalculation)
  const daysToDisplay = useMemo(() => {
    if (viewMode === 'day') {
      return [currentDate];
    } else if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end });
    } else {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      // Extend to start from Monday and end on Sunday
      const calendarStart = startOfWeek(start, { weekStartsOn: 1 });
      const calendarEnd = endOfWeek(end, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    }
  }, [viewMode, currentDate]);

  // Group sessions by day (memoized to avoid re-filtering)
  const sessionsByDay = useMemo(() => groupByDay(sessions, (s) => s.start_at), [sessions]);

  const getSessionsForDay = (day: Date) => sessionsByDay.get(day.toDateString()) || [];

  // Group follow-ups by day (memoized to avoid re-filtering)
  const followUpsByDay = useMemo(() => groupByDay(followUps, (f) => f.due_at), [followUps]);

  const getFollowUpsForDay = (day: Date) => followUpsByDay.get(day.toDateString()) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Calendar Controls */}
      <CalendarControls
        currentDate={currentDate}
        viewMode={viewMode}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToday={handleToday}
        onViewModeChange={setViewMode}
      />

      {/* Calendar Grid */}
      {viewMode === 'month' ? (
        <div className="border rounded-lg overflow-hidden">
          {/* Month view - grid layout */}
          <div className="grid grid-cols-7 bg-muted">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div
                key={day}
                className="p-2 text-center text-sm font-medium border-r last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {daysToDisplay.map((day) => (
              <DayCell
                key={day.toISOString()}
                day={day}
                currentMonth={currentDate}
                sessions={getSessionsForDay(day)}
                followUps={getFollowUpsForDay(day)}
                now={now}
                routePrefix={routePrefix}
              />
            ))}
          </div>
        </div>
      ) : (
        // Day/Week view - list layout
        <div className="space-y-4">
          {daysToDisplay.map((day) => (
            <DayCard
              key={day.toISOString()}
              day={day}
              sessions={getSessionsForDay(day)}
              followUps={getFollowUpsForDay(day)}
              now={now}
              routePrefix={routePrefix}
            />
          ))}
        </div>
      )}
    </div>
  );
}
