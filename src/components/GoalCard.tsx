'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { Calendar, Check, CheckSquare, ChevronDown, ChevronUp, Edit, Square } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { type GoalChecklistItem } from '@/utils/schema';

import Confetti from './Confetti';

interface GoalCardProps {
  id: string | number;
  title: string;
  description: string;
  progress: number;
  status: string;
  dueDate?: Date;
  checklist?: GoalChecklistItem[] | null;
  onEdit: (id: string | number) => void;
  onComplete?: (id: string | number) => void;
}

export default function GoalCard({
  id,
  title,
  description,
  progress,
  status,
  dueDate,
  checklist = [],
  onEdit,
  onComplete,
}: GoalCardProps) {
  const [showChecklist, setShowChecklist] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const completionCelebratedRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDissolveAnimation = useCallback(
    (goalId: string | number) => {
      if (onComplete) {
        onComplete(goalId);
      }
    },
    [onComplete],
  );

  const getBadgeStyles = () => {
    switch (status.toLowerCase()) {
      case 'in-progress':
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'active':
        return 'bg-primary/10 text-primary';
      case 'on-track':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'not_started':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDueDate = () => {
    if (!dueDate) return 'No due date';

    const now = new Date();
    const dueTime = new Date(dueDate).getTime();

    if (dueTime < now.getTime()) {
      return `Overdue by ${formatDistanceToNow(dueTime)}`;
    }

    return `Due in ${formatDistanceToNow(dueTime)}`;
  };

  const handleStatusChange = (newStatus: string) => {
    if (status === newStatus) return;

    const isCompleted = newStatus === 'completed';

    const updateData: any = { status: newStatus };

    if (isCompleted) {
      updateData.completed = true;
      updateData.progress = 100;
    }

    updateChecklistMutation.mutate(updateData);

    const statusLabel = newStatus.replace('_', ' ');
    const formattedStatus = statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1);

    toast({
      title: `Goal status updated`,
      description: `Status changed to "${formattedStatus}"`,
      variant: isCompleted ? 'success' : undefined,
    });

    if (isCompleted && !completionCelebratedRef.current) {
      completionCelebratedRef.current = true;
      setShowConfetti(true);

      setTimeout(() => {
        handleDissolveAnimation(id);
      }, 1500);
    }
  };

  const updateChecklistMutation = useMutation({
    mutationFn: async (updatedGoal: any) => {
      const response = await apiRequest('PUT', `/api/goals/${id}`, updatedGoal);
      return response.json();
    },
    onMutate: async (updatedGoal) => {
      await queryClient.cancelQueries({ queryKey: ['/api/goals'] });

      const previousGoals = queryClient.getQueryData(['/api/goals']);

      queryClient.setQueryData(['/api/goals'], (old: any[]) => {
        if (!old) return [];

        return old.map((goal) => {
          if (goal.id === id) {
            return {
              ...goal,
              ...updatedGoal,
            };
          }
          return goal;
        });
      });

      return { previousGoals };
    },
    onError: (error, newData, context: any) => {
      if (context?.previousGoals) {
        queryClient.setQueryData(['/api/goals'], context.previousGoals);
      }

      toast({
        title: 'Failed to update checklist',
        description:
          error.message || 'There was a problem updating the checklist. Please try again.',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users/statistics'] });
    },
  });

  useEffect(() => {
    if (!checklist || checklist.length === 0) return;
    if (updateChecklistMutation.isPending) return; // Prevent updates while mutation is in progress

    const allCompleted = checklist.every((item) => item.completed);
    const hasAtLeastOneChecked = checklist.some((item) => item.completed);
    const totalItems = checklist.length;
    const hasAtLeastTwoItems = totalItems >= 2;
    const isNotStarted =
      status.toLowerCase() === 'not_started' || status.toLowerCase() === 'active';

    if (
      allCompleted &&
      totalItems > 0 &&
      status.toLowerCase() !== 'completed' &&
      !completionCelebratedRef.current
    ) {
      completionCelebratedRef.current = true;

      setShowConfetti(true);

      updateChecklistMutation.mutate({
        status: 'completed',
        progress: 100,
        checklist: checklist,
        completed: true,
      });

      toast({
        title: 'Goal completed! 🎉',
        description: 'Congratulations on completing your goal!',
        variant: 'success',
      });

      handleDissolveAnimation(id);
    } else if (
      allCompleted &&
      totalItems > 0 &&
      status.toLowerCase() === 'completed' &&
      !completionCelebratedRef.current
    ) {
      completionCelebratedRef.current = true;

      setShowConfetti(true);

      toast({
        title: 'Goal completed! 🎉',
        description: 'Congratulations on completing your goal!',
        variant: 'success',
      });

      handleDissolveAnimation(id);
    } else if (hasAtLeastTwoItems && hasAtLeastOneChecked && !allCompleted && isNotStarted) {
      updateChecklistMutation.mutate({
        status: 'in_progress',
        checklist: checklist,
      });
    }
  }, [
    checklist,
    status,
    id,
    onComplete,
    updateChecklistMutation.isPending,
    handleDissolveAnimation,
    toast,
    updateChecklistMutation,
  ]);

  const toggleChecklistItem = (itemId: string) => {
    if (!checklist) return;

    const updatedChecklist = checklist.map((item) => {
      if (item.id === itemId) {
        return { ...item, completed: !item.completed };
      }
      return item;
    });

    const completedItems = updatedChecklist.filter((item) => item.completed).length;
    const totalItems = updatedChecklist.length;
    const newProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : progress;

    const allCompleted = completedItems === totalItems && totalItems > 0;

    if (allCompleted && status.toLowerCase() !== 'completed' && !completionCelebratedRef.current) {
      updateChecklistMutation.mutate({
        checklist: updatedChecklist,
        progress: 100,
        status: 'completed',
        completed: true,
      });

      completionCelebratedRef.current = true;

      setShowConfetti(true);

      toast({
        title: 'Goal completed! 🎉',
        description: 'Congratulations on completing your goal!',
        variant: 'success',
      });

      handleDissolveAnimation(id);
    } else if (
      allCompleted &&
      status.toLowerCase() === 'completed' &&
      !completionCelebratedRef.current
    ) {
      updateChecklistMutation.mutate({
        checklist: updatedChecklist,
        progress: 100,
      });

      completionCelebratedRef.current = true;

      setShowConfetti(true);

      handleDissolveAnimation(id);
    } else {
      const hasAtLeastTwoItems = updatedChecklist.length >= 2;
      const hasAtLeastOneChecked = updatedChecklist.some((item) => item.completed);
      const areAllChecked = updatedChecklist.every((item) => item.completed);
      const isNotStarted =
        status.toLowerCase() === 'not_started' || status.toLowerCase() === 'active';

      if (hasAtLeastTwoItems && hasAtLeastOneChecked && !areAllChecked && isNotStarted) {
        updateChecklistMutation.mutate({
          checklist: updatedChecklist,
          progress: newProgress,
          status: 'in_progress',
        });

        toast({
          title: 'Goal in progress',
          description: "Your goal status has been updated to 'In Progress'",
        });
      } else {
        updateChecklistMutation.mutate({
          checklist: updatedChecklist,
          progress: newProgress,
        });
      }
    }
  };

  const hasChecklist = checklist && checklist.length > 0;

  return (
    <>
      <Confetti active={showConfetti} duration={1750} targetRef={cardRef} />

      <div id={`goal-${id}`} className="goal-card" ref={cardRef}>
        <Card
          className={`rounded-2xl shadow-sm flex flex-col bg-white hover:shadow-md transition-shadow duration-150 ${
            showChecklist ? 'min-h-[320px]' : hasChecklist ? 'min-h-[240px]' : 'min-h-[200px]'
          }`}
        >
          <div className="p-6 space-y-3 pb-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold">{title}</h3>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="p-0 h-auto hover:bg-transparent">
                    <Badge
                      variant="outline"
                      className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap ${getBadgeStyles()} cursor-pointer hover:shadow-sm transition-all duration-150`}
                      title="Click to change status"
                    >
                      {status === 'not_started' ? (
                        <span className="flex items-center">
                          <span className="h-1.5 w-1.5 bg-gray-400 rounded-full mr-1.5"></span>
                          Not started
                        </span>
                      ) : status === 'in_progress' ? (
                        'In progress'
                      ) : (
                        status.charAt(0).toUpperCase() + status.slice(1)
                      )}
                    </Badge>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[150px]">
                  <DropdownMenuItem
                    onClick={() => handleStatusChange('not_started')}
                    className="gap-2"
                  >
                    <span className="h-1.5 w-1.5 bg-gray-400 rounded-full"></span>
                    Not started
                    {status === 'not_started' && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleStatusChange('in_progress')}
                    className="gap-2"
                  >
                    <span className="h-1.5 w-1.5 bg-blue-600 rounded-full"></span>
                    In progress
                    {status === 'in_progress' && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleStatusChange('completed')}
                    className="gap-2"
                  >
                    <span className="h-1.5 w-1.5 bg-green-600 rounded-full"></span>
                    Completed
                    {status === 'completed' && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div>
              <p className="text-sm font-medium">Progress</p>
              <div className="relative">
                {progress > 0 ? (
                  <Progress value={progress} className="mt-1 h-2 transition-all duration-300" />
                ) : (
                  <div className="mt-1 h-2 w-full rounded-full bg-secondary transition-all duration-300" />
                )}
              </div>
            </div>

            {hasChecklist && (
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <p>
                  {checklist.filter((item) => item.completed).length}/{checklist.length} tasks
                  complete
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="font-medium"
                  onClick={() => setShowChecklist(!showChecklist)}
                >
                  View checklist
                  {showChecklist ? (
                    <ChevronUp className="ml-2 h-4 w-4" />
                  ) : (
                    <ChevronDown className="ml-2 h-4 w-4" />
                  )}
                </Button>
              </div>
            )}

            {showChecklist && hasChecklist && (
              <div className="mt-2 space-y-1 max-h-[120px] overflow-y-auto">
                {checklist.map((item) => (
                  <div key={item.id} className="flex items-start gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleChecklistItem(item.id)}
                      className="h-5 w-5 p-0 mt-0.5 flex-shrink-0"
                    >
                      {item.completed ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </Button>
                    <span
                      className={`text-xs ${item.completed ? 'line-through text-neutral-400' : 'text-neutral-600'}`}
                    >
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            className={`flex items-center justify-between px-4 py-3 border-t ${
              showChecklist ? 'mt-auto' : 'mt-2'
            }`}
          >
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="w-4 h-4 ml-[8px]" />
              {formatDueDate()}
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="text-blue-600 hover:text-blue-800 transition-colors p-1.5 rounded-full hover:bg-blue-50"
              onClick={() => onEdit(id)}
              aria-label="Edit goal"
            >
              <Edit className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
