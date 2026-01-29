'use client';

import { AlertTriangle, CheckCircle2, Inbox, Pause, TrendingUp } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';

interface QueueStatsProps {
  stats: {
    open: number;
    inProgress: number;
    snoozed: number;
    resolvedToday: number;
    total: number;
  } | null;
}

export function QueueStats({ stats }: QueueStatsProps) {
  if (!stats) {
    return (
      <div className="grid gap-4 md:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="h-16 animate-pulse bg-neutral-100 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-5">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500">Active Items</p>
              <p className="text-3xl font-bold">{stats.total}</p>
            </div>
            <Inbox className="h-8 w-8 text-neutral-400" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-700">Needs Attention</p>
              <p className="text-3xl font-bold text-red-700">{stats.open}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700">In Progress</p>
              <p className="text-3xl font-bold text-blue-700">{stats.inProgress}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-500" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-700">Snoozed</p>
              <p className="text-3xl font-bold text-amber-700">{stats.snoozed}</p>
            </div>
            <Pause className="h-8 w-8 text-amber-500" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700">Resolved Today</p>
              <p className="text-3xl font-bold text-green-700">{stats.resolvedToday}</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
