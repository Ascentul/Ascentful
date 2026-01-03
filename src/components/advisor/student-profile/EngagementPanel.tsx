'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import { Activity, AlertTriangle, Bell, BellOff, CheckCircle, Clock } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface EngagementPanelProps {
  studentId: Id<'users'>;
  lastActiveAt?: number;
  needsOutreach: boolean;
  outreachSnoozedUntil?: number;
  inactivityDays?: number;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function EngagementPanel({
  studentId,
  lastActiveAt,
  needsOutreach,
  outreachSnoozedUntil,
  inactivityDays = 0,
}: EngagementPanelProps) {
  const { user } = useUser();
  const clerkId = user?.id;

  const [isSnoozing, setIsSnoozing] = useState(false);
  const [isUnsnoozing, setIsUnsnoozing] = useState(false);

  const snoozeOutreach = useMutation(api.advisor_students.snoozeOutreach);
  const clearOutreachSnooze = useMutation(api.advisor_students.clearOutreachSnooze);

  const handleSnooze = async () => {
    if (!clerkId) return;

    setIsSnoozing(true);
    try {
      await snoozeOutreach({
        clerkId,
        studentId,
        days: 7,
      });
      toast.success('Snoozed for 7 days');
    } catch (error) {
      console.error('Failed to snooze:', error);
      toast.error('Failed to snooze outreach');
    } finally {
      setIsSnoozing(false);
    }
  };

  const handleUnsnooze = async () => {
    if (!clerkId) return;

    setIsUnsnoozing(true);
    try {
      await clearOutreachSnooze({
        clerkId,
        studentId,
      });
      toast.success('Outreach reminder restored');
    } catch (error) {
      console.error('Failed to unsnooze:', error);
      toast.error('Failed to restore reminder');
    } finally {
      setIsUnsnoozing(false);
    }
  };

  if (!clerkId) return null;

  const now = Date.now();
  const isSnoozed = outreachSnoozedUntil && outreachSnoozedUntil > now;
  const isActive = !needsOutreach && !isSnoozed;

  return (
    <Card
      className={
        needsOutreach
          ? 'border-amber-200 bg-amber-50/50'
          : isSnoozed
            ? 'border-slate-200 bg-slate-50/30'
            : ''
      }
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Engagement
          </div>
          {needsOutreach && !isSnoozed && (
            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Needs Outreach
            </Badge>
          )}
          {isSnoozed && (
            <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">
              <BellOff className="h-3 w-3 mr-1" />
              Snoozed
            </Badge>
          )}
          {isActive && (
            <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">
              <CheckCircle className="h-3 w-3 mr-1" />
              Active
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Single unified activity line */}
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span>
            Last activity:{' '}
            <span className="font-medium">
              {inactivityDays > 0 ? `${inactivityDays} days ago` : 'Today'}
            </span>
          </span>
        </div>

        {/* Flag explanation when needs outreach */}
        {needsOutreach && (
          <p className="text-xs text-muted-foreground">Flagged: Inactive 10+ days</p>
        )}

        {/* Snoozed info with unsnooze button */}
        {isSnoozed && outreachSnoozedUntil && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Snoozed until {formatDate(outreachSnoozedUntil)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={handleUnsnooze}
              disabled={isUnsnoozing}
            >
              <Bell className="h-3 w-3 mr-1" />
              Unsnooze
            </Button>
          </div>
        )}

        {/* Snooze action - simplified to single button */}
        {needsOutreach && (
          <div className="pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={handleSnooze}
              disabled={isSnoozing}
            >
              <BellOff className="h-3 w-3 mr-1.5" />
              Snooze 7 days
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
