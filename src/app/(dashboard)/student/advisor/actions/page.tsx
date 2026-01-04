'use client';

/**
 * Student Advisor Action Items - Tasks Page
 *
 * Shows action items/tasks assigned to the student by their advisor.
 * Students can mark items as complete or reopen them.
 */

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  Target,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { StudentUniversityGate } from '@/components/StudentUniversityGate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';

export default function StudentActionsPage() {
  return (
    <StudentUniversityGate>
      <StudentActionsContent />
    </StudentUniversityGate>
  );
}

function StudentActionsContent() {
  const { user } = useUser();
  const clerkId = user?.id;

  const [activeTab, setActiveTab] = useState<'open' | 'done'>('open');

  // Fetch action items based on filter
  const actionItems = useQuery(
    api.student_advisor_hub.getMyActionItems,
    clerkId ? { clerkId, filter: activeTab } : 'skip',
  );

  const isLoading = actionItems === undefined;

  // Count overdue items
  const overdueCount = actionItems?.filter((item) => item.isOverdue).length ?? 0;

  return (
    <div className="w-full">
      <div className="w-full gradient-border-bottom p-5 space-y-6 shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/student/advisor">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Action Items</h1>
            <p className="text-muted-foreground">Tasks and follow-ups from your advisor</p>
          </div>
        </div>

        {/* Overdue Warning */}
        {overdueCount > 0 && activeTab === 'open' && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="font-medium text-red-900">
                    {overdueCount} Overdue Item{overdueCount !== 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-red-700">These tasks are past their due date</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'open' | 'done')}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="done">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="mt-6">
            {isLoading || !clerkId ? (
              <LoadingState />
            ) : actionItems?.length === 0 ? (
              <EmptyState type="open" />
            ) : (
              <ActionItemsList items={actionItems ?? []} clerkId={clerkId} />
            )}
          </TabsContent>

          <TabsContent value="done" className="mt-6">
            {isLoading || !clerkId ? (
              <LoadingState />
            ) : actionItems?.length === 0 ? (
              <EmptyState type="done" />
            ) : (
              <ActionItemsList items={actionItems ?? []} clerkId={clerkId} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ============================================================================
// Action Items List Component
// ============================================================================

interface ActionItem {
  _id: Id<'follow_ups'>;
  title: string;
  description?: string;
  status: string;
  due_at?: number;
  priority?: string;
  isOverdue: boolean;
  created_at: number;
  updated_at: number;
}

function ActionItemsList({ items, clerkId }: { items: ActionItem[]; clerkId: string }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <ActionItemCard key={item._id} item={item} clerkId={clerkId} />
      ))}
    </div>
  );
}

function ActionItemCard({ item, clerkId }: { item: ActionItem; clerkId: string }) {
  const [isUpdating, setIsUpdating] = useState(false);

  const completeItem = useMutation(api.student_advisor_hub_mutations.completeActionItem);
  const reopenItem = useMutation(api.student_advisor_hub_mutations.reopenActionItem);

  const isDone = item.status === 'done';

  const handleToggle = async () => {
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      if (isDone) {
        await reopenItem({ clerkId, itemId: item._id });
      } else {
        await completeItem({ clerkId, itemId: item._id });
      }
    } catch (error) {
      console.error('Failed to update action item:', error);
      toast({
        title: 'Error',
        description: 'Failed to update action item. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDueDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.ceil((timestamp - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} overdue`;
    } else if (diffDays === 0) {
      return 'Due today';
    } else if (diffDays === 1) {
      return 'Due tomorrow';
    } else if (diffDays <= 7) {
      return `Due in ${diffDays} days`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'urgent':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            Urgent
          </Badge>
        );
      case 'high':
        return (
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
            High
          </Badge>
        );
      case 'medium':
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            Medium
          </Badge>
        );
      case 'low':
        return (
          <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
            Low
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Card
      className={`transition-all hover:shadow-md ${
        item.isOverdue ? 'border-red-200 bg-red-50/30' : ''
      } ${isDone ? 'opacity-70' : ''}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Checkbox */}
          <button
            onClick={handleToggle}
            disabled={isUpdating}
            className={`flex-shrink-0 mt-1 rounded-full transition-colors ${
              isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            {isUpdating ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : isDone ? (
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            ) : item.isOverdue ? (
              <AlertCircle className="h-6 w-6 text-red-500" />
            ) : (
              <Circle className="h-6 w-6 text-slate-300 hover:text-primary-500" />
            )}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className={`font-medium ${isDone ? 'line-through text-muted-foreground' : ''}`}>
                  {item.title}
                </h3>
                {item.description && (
                  <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                )}
              </div>
              {getPriorityBadge(item.priority)}
            </div>

            {/* Meta Info */}
            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
              {item.due_at && (
                <div
                  className={`flex items-center gap-1 ${
                    item.isOverdue ? 'text-red-600 font-medium' : ''
                  }`}
                >
                  {item.isOverdue ? (
                    <Clock className="h-4 w-4" />
                  ) : (
                    <Calendar className="h-4 w-4" />
                  )}
                  <span>{formatDueDate(item.due_at)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Empty & Loading States
// ============================================================================

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function EmptyState({ type }: { type: 'open' | 'done' }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-12 text-center">
        <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">
          {type === 'open' ? 'No Open Tasks' : 'No Completed Tasks'}
        </h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          {type === 'open'
            ? "Great job! You don't have any pending tasks from your advisor right now."
            : "You haven't completed any tasks yet. Tasks will appear here once you mark them as done."}
        </p>
      </CardContent>
    </Card>
  );
}
