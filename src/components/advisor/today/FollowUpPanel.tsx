'use client';

/**
 * FollowUpPanel - Tabbed panel for follow-ups
 *
 * Displays follow-ups grouped by:
 * - Overdue (due before today)
 * - Today (due today)
 * - Upcoming (due in next 7 days)
 */

import { Id } from 'convex/_generated/dataModel';
import { format, formatDistanceToNow, isPast, isToday } from 'date-fns';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  ListTodo,
  RotateCcw,
  User,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface FollowUp {
  _id: Id<'follow_ups'>;
  student_id: Id<'users'>;
  student_name: string;
  title: string;
  description?: string;
  due_at?: number;
  priority?: string;
  status: string;
  related_type?: string;
}

interface FollowUpPanelProps {
  followUps: {
    overdue: FollowUp[];
    today: FollowUp[];
    upcoming: FollowUp[];
  };
  activeTab: 'overdue' | 'today' | 'upcoming';
  onTabChange: (tab: 'overdue' | 'today' | 'upcoming') => void;
  onComplete?: (followUpId: Id<'follow_ups'>) => void;
  onSnooze?: (followUpId: Id<'follow_ups'>, title?: string) => void;
  isLoading?: boolean;
  /** Route prefix for links (e.g., '/u' or '/advisor') */
  routePrefix?: string;
}

function FollowUpRow({
  followUp,
  onComplete,
  onSnooze,
  routePrefix = '/advisor',
}: {
  followUp: FollowUp;
  onComplete?: (id: Id<'follow_ups'>) => void;
  onSnooze?: (id: Id<'follow_ups'>, title?: string) => void;
  routePrefix?: string;
}) {
  const isOverdue = followUp.due_at && isPast(followUp.due_at) && !isToday(followUp.due_at);
  const studentHref = `${routePrefix}/students/${followUp.student_id}`;

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border transition-colors hover:bg-slate-50',
        isOverdue && 'border-red-200 bg-red-50/50',
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="font-medium text-sm text-slate-900 truncate">{followUp.title}</p>
          {followUp.priority === 'high' && (
            <Badge variant="destructive" className="text-xs h-5">
              High
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <User className="h-3 w-3" />
          <Link href={studentHref} className="hover:text-primary-600 hover:underline">
            {followUp.student_name}
          </Link>
          {followUp.due_at && (
            <>
              <span className="text-slate-300">|</span>
              <Clock className="h-3 w-3" />
              <span className={cn(isOverdue && 'text-red-600 font-medium')}>
                {isToday(followUp.due_at)
                  ? 'Due today'
                  : isOverdue
                    ? `Overdue by ${formatDistanceToNow(followUp.due_at, { addSuffix: false })}`
                    : format(followUp.due_at, 'MMM d')}
              </span>
            </>
          )}
        </div>

        {followUp.description && (
          <p className="text-xs text-slate-500 mt-1 line-clamp-1">{followUp.description}</p>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
          onClick={() => onComplete?.(followUp._id)}
          title="Mark complete"
        >
          <CheckCircle2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-slate-500 hover:text-slate-700"
          onClick={() => onSnooze?.(followUp._id, followUp.title)}
          title="Snooze"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-slate-500 hover:text-slate-700"
          asChild
        >
          <Link href={studentHref} title="View student">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function EmptyState({ tab }: { tab: 'overdue' | 'today' | 'upcoming' }) {
  const messages = {
    overdue: { icon: CheckCircle2, text: 'No overdue follow-ups', subtext: 'All caught up!' },
    today: { icon: ListTodo, text: 'No follow-ups due today', subtext: 'Check upcoming items' },
    upcoming: { icon: Clock, text: 'No upcoming follow-ups', subtext: 'Schedule some tasks' },
  };

  const { icon: Icon, text, subtext } = messages[tab];

  return (
    <div className="text-center py-8 text-slate-500">
      <Icon className="h-8 w-8 mx-auto mb-2 opacity-50" />
      <p className="text-sm font-medium">{text}</p>
      <p className="text-xs mt-0.5">{subtext}</p>
    </div>
  );
}

export function FollowUpPanel({
  followUps,
  activeTab,
  onTabChange,
  onComplete,
  onSnooze,
  isLoading,
  routePrefix = '/advisor',
}: FollowUpPanelProps) {
  const overdueCount = followUps.overdue.length;
  const todayCount = followUps.today.length;
  const upcomingCount = followUps.upcoming.length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListTodo className="h-4 w-4" />
            Follow-ups
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListTodo className="h-4 w-4" />
          Follow-ups
          {overdueCount > 0 && (
            <Badge variant="destructive" className="ml-1">
              {overdueCount} overdue
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as typeof activeTab)}>
          <TabsList className="w-full grid grid-cols-3 mb-3">
            <TabsTrigger
              value="overdue"
              className={cn(
                'text-xs',
                overdueCount > 0 && 'text-red-600 data-[state=active]:text-red-700',
              )}
            >
              {overdueCount > 0 && <AlertCircle className="h-3 w-3 mr-1" />}
              Overdue
              {overdueCount > 0 && ` (${overdueCount})`}
            </TabsTrigger>
            <TabsTrigger value="today" className="text-xs">
              Today
              {todayCount > 0 && ` (${todayCount})`}
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="text-xs">
              Upcoming
              {upcomingCount > 0 && ` (${upcomingCount})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overdue" className="mt-0">
            {overdueCount === 0 ? (
              <EmptyState tab="overdue" />
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {followUps.overdue.map((followUp) => (
                  <FollowUpRow
                    key={followUp._id}
                    followUp={followUp}
                    onComplete={onComplete}
                    onSnooze={onSnooze}
                    routePrefix={routePrefix}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="today" className="mt-0">
            {todayCount === 0 ? (
              <EmptyState tab="today" />
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {followUps.today.map((followUp) => (
                  <FollowUpRow
                    key={followUp._id}
                    followUp={followUp}
                    onComplete={onComplete}
                    onSnooze={onSnooze}
                    routePrefix={routePrefix}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="upcoming" className="mt-0">
            {upcomingCount === 0 ? (
              <EmptyState tab="upcoming" />
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {followUps.upcoming.map((followUp) => (
                  <FollowUpRow
                    key={followUp._id}
                    followUp={followUp}
                    onComplete={onComplete}
                    onSnooze={onSnooze}
                    routePrefix={routePrefix}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
