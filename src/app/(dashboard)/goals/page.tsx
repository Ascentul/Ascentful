'use client';

import { useQuery } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpDown,
  CheckCircle,
  Filter,
  GanttChartSquare,
  LayoutList,
  Plus,
  RefreshCw,
  Target,
} from 'lucide-react';
import { useState } from 'react';

import GoalCard from '@/components/GoalCard';
import GoalForm from '@/components/GoalForm';
import { goalTemplates } from '@/components/goals/GoalTemplates';
import { GoalTemplatesStrip } from '@/components/goals/GoalTemplatesStrip';
import GoalTimeline from '@/components/goals/GoalTimeline';
import { UpgradeModal } from '@/components/modals/UpgradeModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

export default function Goals() {
  const { user, hasPremium } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<string>('dueDate-asc');
  const [isAddGoalOpen, setIsAddGoalOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<any>(null);
  const [hiddenGoalIds, setHiddenGoalIds] = useState<number[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isFreeUser = !hasPremium; // Use Clerk Billing subscription check

  // Fetch goals
  const { data: goals = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/goals'],
    // Fetch goals from our API and return the array directly
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', '/api/goals');
        const data = await res.json().catch(() => ({ goals: [] }));
        return Array.isArray(data?.goals) ? data.goals : [];
      } catch (_) {
        // Fail safe: return empty list on error
        return [];
      }
    },
    placeholderData: [],
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async (goalId: string | number) => {
      return apiRequest('DELETE', `/api/goals/${goalId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users/statistics'] });
      toast({
        title: 'Goal Deleted',
        description: 'Your goal has been deleted successfully',
        variant: 'success',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to delete goal: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const handleEditGoal = (goalId: string | number) => {
    const goal = goals.find((g: any) => g.id === goalId);
    if (goal) {
      setSelectedGoal(goal);
      setIsAddGoalOpen(true);
    }
  };

  const handleDeleteGoal = (goalId: string | number) => {
    if (confirm('Are you sure you want to delete this goal?')) {
      deleteGoalMutation.mutate(goalId);
    }
  };

  const handleReopenGoal = (goalId: string | number) => {
    const goal = goals.find((g: any) => g.id === goalId);
    if (goal) {
      // Only send the specific fields needed for updating
      apiRequest('PUT', `/api/goals/${goalId}`, {
        status: 'active',
        completed: false,
        completedAt: null,
      })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
          queryClient.invalidateQueries({ queryKey: ['/api/users/statistics'] });

          toast({
            title: 'Goal Reopened',
            description: 'The goal has been moved back to active goals.',
            variant: 'success',
          });
        })
        .catch((error) => {
          console.error('Error reopening goal:', error);

          toast({
            title: 'Error',
            description: 'Failed to reopen goal. Please try again.',
            variant: 'destructive',
          });
        });
    }
  };

  const handleGoalComplete = (goalId: string | number) => {
    const goal = goals.find((g: any) => g.id === goalId);
    if (goal) {
      apiRequest('PUT', `/api/goals/${goalId}`, {
        ...goal,
        status: 'completed',
        progress: 100,
        completed: true,
        completedAt: new Date().toISOString(),
      })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
          queryClient.invalidateQueries({ queryKey: ['/api/users/statistics'] });

          toast({
            title: 'Goal Saved as Completed',
            description: 'Your goal has been moved to the completed section.',
            variant: 'success',
          });
        })
        .catch((error) => {
          console.error('Error updating goal:', error);

          toast({
            title: 'Error',
            description: 'Failed to save completed goal. Please try again.',
            variant: 'destructive',
          });
        });
    }
  };

  const sortedAndFilteredGoals = () => {
    if (!goals || !Array.isArray(goals)) return [];

    let filteredGoals = [...goals];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredGoals = filteredGoals.filter(
        (goal: any) =>
          goal.title.toLowerCase().includes(query) ||
          (goal.description && goal.description.toLowerCase().includes(query)),
      );
    }

    if (statusFilter) {
      filteredGoals = filteredGoals.filter((goal: any) => goal.status === statusFilter);
    }

    const [sortField, sortDirection] = sortOption.split('-');
    filteredGoals.sort((a: any, b: any) => {
      if (sortField === 'dueDate') {
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      } else if (sortField === 'progress') {
        return sortDirection === 'asc' ? a.progress - b.progress : b.progress - a.progress;
      } else if (sortField === 'title') {
        return sortDirection === 'asc'
          ? a.title.localeCompare(b.title)
          : b.title.localeCompare(a.title);
      }
      return 0;
    });

    return filteredGoals;
  };

  const fadeIn = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.4 } },
  };

  const subtleUp = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  const listContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        when: 'beforeChildren',
      },
    },
  };

  const listItem = {
    hidden: { opacity: 0, y: 5 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
  };

  return (
    <motion.div className="space-y-4 min-w-0" initial="hidden" animate="visible" variants={fadeIn}>
      <div className="w-full min-w-0 rounded-3xl bg-white p-5 space-y-6 border-0 shadow-none">
        <motion.div className="flex items-center justify-between mb-4" variants={subtleUp}>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Career Goals</h1>
            <p className="text-muted-foreground">Track and manage your career goals</p>
          </div>
          <Button
            className="bg-primary-500 hover:bg-primary-700"
            onClick={() => {
              // Check free user limit (1 goal max)
              if (isFreeUser && goals.length >= 1) {
                setShowUpgradeModal(true);
                return;
              }
              setSelectedGoal(null);
              setIsAddGoalOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Goal
          </Button>
        </motion.div>

        {/* Goal Templates Section */}
        <motion.div variants={subtleUp} className="mb-5">
          <GoalTemplatesStrip
            onSelectTemplate={(templateId) => {
              // Check free user limit (1 goal max)
              if (isFreeUser && goals.length >= 1) {
                setShowUpgradeModal(true);
                return;
              }
              setSelectedTemplate(templateId);
              setIsAddGoalOpen(true);
            }}
          />
        </motion.div>

        {/* Active Goals Section */}
        <motion.div className="mb-8 min-w-0" variants={subtleUp}>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm min-w-0">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-base font-semibold text-slate-900">Active Goals</h2>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center py-6">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : goals &&
              Array.isArray(goals) &&
              goals.filter((g: any) => g.status !== 'completed').length > 0 ? (
              <motion.div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 min-w-0"
                variants={listContainer}
              >
                {sortedAndFilteredGoals()
                  .filter((goal) => goal.status !== 'completed')
                  .map((goal: any) => (
                    <motion.div key={goal.id} className="relative" variants={listItem}>
                      <GoalCard
                        id={goal.id}
                        title={goal.title}
                        description={goal.description || ''}
                        progress={goal.progress}
                        status={goal.status}
                        dueDate={goal.dueDate ? new Date(goal.dueDate) : undefined}
                        checklist={goal.checklist || []}
                        onEdit={handleEditGoal}
                        onComplete={handleGoalComplete}
                      />
                    </motion.div>
                  ))}
              </motion.div>
            ) : (
              <motion.div
                className="text-center py-6 bg-white border border-slate-200 shadow-sm rounded-xl"
                variants={subtleUp}
              >
                <div className="bg-white shadow-sm rounded-full p-3 inline-block mb-3">
                  <Target className="h-10 w-10 text-blue-500" />
                </div>
                <h3 className="text-lg font-medium mb-1 text-slate-900">No Active Goals</h3>
                <p className="text-sm text-neutral-500 mb-4 max-w-md mx-auto">
                  Start by creating your first career goal to track your progress toward
                  professional success
                </p>
                <Button
                  onClick={() => {
                    // Check free user limit (1 goal max)
                    if (isFreeUser && goals.length >= 1) {
                      setShowUpgradeModal(true);
                      return;
                    }
                    setSelectedGoal(null);
                    setIsAddGoalOpen(true);
                  }}
                  className="px-5 py-2 shadow-sm hover:shadow transition-all"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Goal
                </Button>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Completed Goals Section */}
        <motion.div variants={subtleUp}>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base font-semibold flex items-center text-slate-900">
              <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
              <span>Completed Goals</span>
            </h2>
            <div className="flex items-center space-x-2">
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <LayoutList className="h-4 w-4 mr-1" />
                List
              </Button>
              <Button
                variant={viewMode === 'timeline' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('timeline')}
              >
                <GanttChartSquare className="h-4 w-4 mr-1" />
                Timeline
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
            </div>
          ) : goals &&
            Array.isArray(goals) &&
            goals.filter((g: any) => g.status === 'completed' && !hiddenGoalIds.includes(g.id))
              .length > 0 ? (
            <>
              {viewMode === 'timeline' && (
                <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <CardContent className="p-4">
                    <GoalTimeline
                      goals={goals.filter(
                        (goal: any) =>
                          goal.status === 'completed' && !hiddenGoalIds.includes(goal.id),
                      )}
                    />
                  </CardContent>
                </Card>
              )}

              {viewMode === 'list' && (
                <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <AnimatePresence mode="sync">
                        {goals
                          .filter(
                            (goal: any) =>
                              goal.status === 'completed' && !hiddenGoalIds.includes(goal.id),
                          )
                          .map((goal: any) => (
                            <motion.div
                              key={goal.id}
                              id={`goal-${goal.id}`}
                              initial={{ opacity: 1 }}
                              animate={{ opacity: 1 }}
                              className="mb-4"
                            >
                              <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl border shadow-sm p-4 relative hover:shadow-md transition-all duration-200">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center">
                                      <h3 className="font-medium text-sm line-through text-neutral-500">
                                        {goal.title}
                                      </h3>
                                      <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                        Completed
                                      </span>
                                    </div>
                                    {goal.description && (
                                      <p className="text-xs text-neutral-500 mt-1 line-through">
                                        {goal.description}
                                      </p>
                                    )}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs h-8 rounded-full hover:bg-gray-100"
                                    onClick={() => handleReopenGoal(goal.id)}
                                  >
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    Reopen
                                  </Button>
                                </div>
                                {goal.completedAt && (
                                  <p className="text-xs text-neutral-400 mt-2">
                                    Completed {new Date(goal.completedAt).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            </motion.div>
                          ))}
                      </AnimatePresence>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="text-center py-6">
                  <CheckCircle className="mx-auto h-16 w-16 text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500">
                    🎯 You're on your way! Complete a goal to start building momentum.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
        {/* Add/Edit Goal Dialog */}
        <Dialog
          open={isAddGoalOpen}
          onOpenChange={(isOpen) => {
            setIsAddGoalOpen(isOpen);
            if (!isOpen) {
              setSelectedTemplate(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {selectedGoal
                  ? 'Edit Goal'
                  : selectedTemplate
                    ? 'Create Goal from Template'
                    : 'Create New Goal'}
              </DialogTitle>
              {selectedTemplate && (
                <p className="text-sm text-muted-foreground mt-1">
                  Using {goalTemplates.find((t) => t.id === selectedTemplate)?.title} template
                </p>
              )}
            </DialogHeader>
            <GoalForm
              goal={selectedGoal}
              templateId={selectedTemplate}
              onSuccess={() => {
                setIsAddGoalOpen(false);
                setSelectedTemplate(null);
              }}
            />
          </DialogContent>
        </Dialog>

        {/* Upgrade Modal for Free User Limits */}
        <UpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} feature="goal" />
      </div>
    </motion.div>
  );
}
