'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  ListTodo,
  Loader2,
  User,
} from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface FollowUp {
  _id: Id<'follow_ups'>;
  title: string;
  description?: string;
  due_at?: number;
  status: 'open' | 'done';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  isOverdue: boolean;
  creator?: {
    name: string;
    role: string;
  } | null;
  created_at: number;
}

/**
 * StudentAdvisorActionsCard Component
 *
 * Displays action items/follow-ups created by advisors for students.
 * Students can view and mark actions as complete.
 */
export function StudentAdvisorActionsCard() {
  const { user } = useUser();
  const clerkId = user?.id;

  const [selectedAction, setSelectedAction] = useState<FollowUp | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  // Fetch follow-ups assigned to this student
  const followUps = useQuery(api.students.getMyFollowUps, clerkId ? { clerkId } : 'skip') as
    | FollowUp[]
    | undefined;

  const completeFollowUp = useMutation(api.students.completeMyFollowUp);

  // Check if user is a university student
  const userProfile = useQuery(api.users.getUserByClerkId, clerkId ? { clerkId } : 'skip') as any;

  const isUniversityStudent =
    userProfile?.university_id && (userProfile?.role === 'student' || userProfile?.role === 'user');

  // Don't show card if not a university student or no follow-ups
  if (!isUniversityStudent) {
    return null;
  }

  // Loading state
  if (followUps === undefined) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ListTodo className="h-5 w-5" />
            Advisor Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // No actions assigned
  if (!followUps || followUps.length === 0) {
    return null; // Don't show card if no actions
  }

  const openActions = followUps.filter((f) => f.status === 'open');
  const completedActions = followUps.filter((f) => f.status === 'done');
  const overdueCount = openActions.filter((f) => f.isOverdue).length;

  const handleComplete = async () => {
    if (!selectedAction || !clerkId) return;

    setIsCompleting(true);
    try {
      await completeFollowUp({
        clerkId,
        followUpId: selectedAction._id,
      });
      setSelectedAction(null);
    } catch (error) {
      console.error('Failed to complete action:', error);
    } finally {
      setIsCompleting(false);
    }
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="destructive">Urgent</Badge>;
      case 'high':
        return <Badge className="bg-orange-500">High</Badge>;
      case 'medium':
        return <Badge variant="secondary">Medium</Badge>;
      case 'low':
        return <Badge variant="outline">Low</Badge>;
      default:
        return null;
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ListTodo className="h-5 w-5" />
              Advisor Actions
            </CardTitle>
            {overdueCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                {overdueCount} overdue
              </Badge>
            )}
          </div>
          <CardDescription>
            Action items from your advisor ({openActions.length} open
            {completedActions.length > 0 && `, ${completedActions.length} completed`})
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Open Actions */}
          {openActions.map((action) => (
            <button
              key={action._id}
              onClick={() => setSelectedAction(action)}
              className={cn(
                'w-full text-left p-3 rounded-lg border transition-colors',
                'hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20',
                action.isOverdue && 'border-red-200 bg-red-50/50',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{action.title}</span>
                    {getPriorityBadge(action.priority)}
                  </div>
                  {action.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {action.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    {action.due_at && (
                      <span
                        className={cn(
                          'flex items-center gap-1',
                          action.isOverdue && 'text-red-600 font-medium',
                        )}
                      >
                        <Clock className="h-3 w-3" />
                        {action.isOverdue
                          ? `Overdue by ${formatDistanceToNow(action.due_at)}`
                          : `Due ${formatDistanceToNow(action.due_at, { addSuffix: true })}`}
                      </span>
                    )}
                    {action.creator && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {action.creator.name}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
              </div>
            </button>
          ))}

          {/* Show completed (collapsed) */}
          {completedActions.length > 0 && openActions.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-600" />
                {completedActions.length} completed action{completedActions.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          {/* If all completed, show message */}
          {openActions.length === 0 && completedActions.length > 0 && (
            <div className="text-center py-4">
              <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-green-700">All caught up!</p>
              <p className="text-xs text-muted-foreground">
                You've completed all {completedActions.length} action
                {completedActions.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Detail Dialog */}
      <Dialog open={!!selectedAction} onOpenChange={(open) => !open && setSelectedAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAction?.title}
              {selectedAction && getPriorityBadge(selectedAction.priority)}
            </DialogTitle>
            <DialogDescription>
              {selectedAction?.creator && (
                <span className="flex items-center gap-1 mt-1">
                  <User className="h-3 w-3" />
                  Assigned by {selectedAction.creator.name}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedAction?.description && (
              <div>
                <h4 className="text-sm font-medium mb-1">Description</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {selectedAction.description}
                </p>
              </div>
            )}

            <div className="flex items-center gap-4 text-sm">
              {selectedAction?.due_at && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className={cn(selectedAction.isOverdue && 'text-red-600 font-medium')}>
                    Due: {format(selectedAction.due_at, 'PPp')}
                    {selectedAction.isOverdue && ' (Overdue)'}
                  </span>
                </div>
              )}
            </div>

            {selectedAction?.status === 'done' && (
              <div className="flex items-center gap-2 text-green-600 bg-green-50 rounded-lg p-3">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Completed</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAction(null)}>
              Close
            </Button>
            {selectedAction?.status === 'open' && (
              <Button onClick={handleComplete} disabled={isCompleting}>
                {isCompleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Mark Complete
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
