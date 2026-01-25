'use client';

import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Copy,
  Edit,
  MoreHorizontal,
  Plus,
  Power,
  Trash2,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import React, { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { useToast } from '@/hooks/use-toast';

type SignalType =
  | 'needs_outreach'
  | 'application_support'
  | 'document_review'
  | 'milestone_check'
  | 'custom';
type Priority = 'low' | 'medium' | 'high' | 'urgent';
type ConditionType =
  | 'inactivity'
  | 'application_stall'
  | 'engagement_drop'
  | 'no_progress'
  | 'stalled'
  | 'high_intent_low_conversion'
  | 'stage_stuck'
  | 'custom';

interface ConditionFormData {
  type: ConditionType;
  days?: number;
  stage?: string;
  from?: string;
  to?: string;
  rejections_min?: number;
  offers?: number;
  // New condition parameters
  qualifying_event_types?: string[];
  applications_threshold?: number;
  application_period_days?: number;
  appointment_days?: number;
}

// Condition type metadata for visual builder
const CONDITION_TYPE_CONFIG: Record<
  ConditionType,
  {
    label: string;
    description: string;
    icon: string;
    category: 'activity' | 'application' | 'engagement';
  }
> = {
  inactivity: {
    label: 'Inactivity',
    description: 'Triggers when a student has no activity for a specified number of days',
    icon: '⏰',
    category: 'activity',
  },
  stalled: {
    label: 'Stalled Student',
    description:
      'No qualifying activity (logins, applications, updates) within the threshold period',
    icon: '🛑',
    category: 'activity',
  },
  application_stall: {
    label: 'Application Stall',
    description: 'Application stuck at a specific stage without progress',
    icon: '📋',
    category: 'application',
  },
  stage_stuck: {
    label: 'Stage Stuck',
    description: 'One or more applications stuck in a particular stage for too long',
    icon: '🔒',
    category: 'application',
  },
  high_intent_low_conversion: {
    label: 'High Intent, Low Conversion',
    description: 'Student submitting applications but not scheduling advisor appointments',
    icon: '📊',
    category: 'application',
  },
  engagement_drop: {
    label: 'Engagement Drop',
    description: 'Student engagement level has decreased significantly',
    icon: '📉',
    category: 'engagement',
  },
  no_progress: {
    label: 'No Progress',
    description: 'Multiple rejections without offers, may need strategy review',
    icon: '❌',
    category: 'application',
  },
  custom: {
    label: 'Custom',
    description: 'Create a custom condition with manual evaluation',
    icon: '⚙️',
    category: 'activity',
  },
};

const QUALIFYING_EVENT_OPTIONS = [
  { value: 'login', label: 'Login' },
  { value: 'application_created', label: 'Application Created' },
  { value: 'application_updated', label: 'Application Updated' },
  { value: 'resume_created', label: 'Resume Created' },
  { value: 'resume_updated', label: 'Resume Updated' },
  { value: 'cover_letter_created', label: 'Cover Letter Created' },
  { value: 'goal_created', label: 'Goal Created' },
  { value: 'goal_completed', label: 'Goal Completed' },
  { value: 'coach_conversation_started', label: 'AI Coach Conversation Started' },
  { value: 'coach_message_sent', label: 'AI Coach Message Sent' },
  { value: 'appointment_scheduled', label: 'Appointment Scheduled' },
];

interface RuleFormData {
  name: string;
  description: string;
  condition: ConditionFormData;
  signalType: SignalType;
  priority: Priority;
  autoCreateFollowup: boolean;
  followupTemplate: string;
  cooldownDays: number;
}

const defaultFormData: RuleFormData = {
  name: '',
  description: '',
  condition: { type: 'inactivity', days: 14 },
  signalType: 'needs_outreach',
  priority: 'medium',
  autoCreateFollowup: false,
  followupTemplate: '',
  cooldownDays: 7,
};

const signalTypeLabels: Record<SignalType, string> = {
  needs_outreach: 'Needs Outreach',
  application_support: 'Application Support',
  document_review: 'Document Review',
  milestone_check: 'Milestone Check',
  custom: 'Custom',
};

const priorityColors: Record<Priority, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-gray-400',
};

export default function SignalRulesPage() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();

  const universityId = user?.university_id as Id<'universities'> | undefined;

  // Queries
  const rules = useQuery(
    api.signal_rules.getRulesByUniversity,
    universityId ? { universityId } : 'skip',
  );
  const templates = useQuery(api.signal_rules.getRuleTemplates, {});

  // Mutations
  const createRule = useMutation(api.signal_rules.createRule);
  const updateRule = useMutation(api.signal_rules.updateRule);
  const deleteRule = useMutation(api.signal_rules.deleteRule);
  const duplicateRule = useMutation(api.signal_rules.duplicateRule);
  const toggleRuleActive = useMutation(api.signal_rules.toggleRuleActive);

  // State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<'signal_rules'> | null>(null);
  const [deletingId, setDeletingId] = useState<Id<'signal_rules'> | null>(null);
  const [formData, setFormData] = useState<RuleFormData>(defaultFormData);
  const [loading, setLoading] = useState(false);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData(defaultFormData);
    setIsDialogOpen(true);
  };

  const handleOpenFromTemplate = (template: NonNullable<typeof templates>[number]) => {
    setEditingId(null);
    setFormData({
      name: template.name,
      description: template.description,
      condition: template.condition as ConditionFormData,
      signalType: template.signalType,
      priority: template.priority,
      autoCreateFollowup: false,
      followupTemplate: '',
      cooldownDays: template.cooldownDays,
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (rule: NonNullable<typeof rules>[number]) => {
    setEditingId(rule._id);
    const condition = rule.condition as ConditionFormData;
    setFormData({
      name: rule.name,
      description: rule.description || '',
      condition,
      signalType: rule.signal_type,
      priority: rule.priority,
      autoCreateFollowup: rule.auto_create_followup || false,
      followupTemplate: rule.followup_template || '',
      cooldownDays: rule.cooldown_days || 7,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!universityId) return;

    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Name is required.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        await updateRule({
          ruleId: editingId,
          name: formData.name,
          description: formData.description || undefined,
          condition: formData.condition,
          signalType: formData.signalType,
          priority: formData.priority,
          autoCreateFollowup: formData.autoCreateFollowup,
          followupTemplate: formData.followupTemplate || undefined,
          cooldownDays: formData.cooldownDays,
        });
        toast({
          title: 'Rule Updated',
          description: 'Signal rule has been updated.',
        });
      } else {
        await createRule({
          universityId,
          name: formData.name,
          description: formData.description || undefined,
          condition: formData.condition,
          signalType: formData.signalType,
          priority: formData.priority,
          autoCreateFollowup: formData.autoCreateFollowup,
          followupTemplate: formData.followupTemplate || undefined,
          cooldownDays: formData.cooldownDays,
        });
        toast({
          title: 'Rule Created',
          description: 'New signal rule has been created.',
        });
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save rule.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    setLoading(true);
    try {
      await deleteRule({ ruleId: deletingId });
      toast({
        title: 'Rule Deleted',
        description: 'Signal rule has been deleted.',
      });
      setIsDeleteDialogOpen(false);
      setDeletingId(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete rule.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: Id<'signal_rules'>) => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await toggleRuleActive({ ruleId: id });
      toast({
        title: result.isActive ? 'Rule Activated' : 'Rule Deactivated',
        description: result.isActive
          ? 'The rule is now active and will trigger signals.'
          : 'The rule is now inactive and will not trigger signals.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to toggle rule status.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async (id: Id<'signal_rules'>) => {
    if (loading) return;
    setLoading(true);
    try {
      await duplicateRule({ ruleId: id });
      toast({
        title: 'Rule Duplicated',
        description: 'A copy of the signal rule has been created.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to duplicate rule.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getConditionDescription = (condition: ConditionFormData): string => {
    switch (condition.type) {
      case 'inactivity':
        return `No activity for ${condition.days || 14} days`;
      case 'stalled':
        return `No qualifying activity for ${condition.days || 14} days`;
      case 'application_stall':
        return `Application stuck at ${condition.stage || 'any stage'} for ${condition.days || 14} days`;
      case 'stage_stuck':
        return `Application in "${condition.stage || 'Interview'}" stage for ${condition.days || 14}+ days`;
      case 'high_intent_low_conversion':
        return `${condition.applications_threshold || 3}+ applications in ${condition.application_period_days || 14} days, no appointment in ${condition.appointment_days || 30} days`;
      case 'engagement_drop':
        return `Engagement dropped from ${condition.from || 'engaged'} to ${condition.to || 'at_risk'}`;
      case 'no_progress':
        return `${condition.rejections_min || 5}+ rejections, ${condition.offers || 0} offers`;
      case 'custom':
        return 'Custom condition';
      default:
        return 'Custom condition';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!universityId) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">No university access.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/u/admin/settings">
          <Button variant="ghost" size="icon" aria-label="Back to settings">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Signal Rules</h1>
          <p className="text-muted-foreground">
            Configure rules that trigger advisor action signals for students.
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Rule
        </Button>
      </div>

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">Active Rules</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-4">
          {/* Rules List */}
          {!rules ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
            </div>
          ) : rules.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Zap className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-semibold">No Signal Rules</h3>
                <p className="mb-4 text-center text-muted-foreground">
                  Create your first signal rule to start automating advisor notifications.
                </p>
                <Button onClick={handleOpenCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Rule
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {rules.map((rule) => {
                const conditionConfig =
                  CONDITION_TYPE_CONFIG[(rule.condition as ConditionFormData).type] ||
                  CONDITION_TYPE_CONFIG.custom;
                return (
                  <Card key={rule._id} className={!rule.is_active ? 'opacity-60' : ''}>
                    <CardContent className="flex items-center gap-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-lg" title={conditionConfig.label}>
                          {conditionConfig.icon}
                        </span>
                        <div
                          className={`h-3 w-3 rounded-full ${priorityColors[rule.priority]}`}
                          title={`Priority: ${rule.priority}`}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{rule.name}</h3>
                          <Badge variant="outline" className="text-xs">
                            {conditionConfig.label}
                          </Badge>
                          {!rule.is_active && <Badge variant="secondary">Inactive</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {getConditionDescription(rule.condition as ConditionFormData)}
                        </p>
                      </div>
                      <Badge variant="outline">{signalTypeLabels[rule.signal_type]}</Badge>
                      <div className="text-sm text-muted-foreground">
                        Cooldown: {rule.cooldown_days}d
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label="Rule actions"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenEdit(rule)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(rule._id)}>
                            <Power className="mr-2 h-4 w-4" />
                            {rule.is_active ? 'Deactivate' : 'Activate'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(rule._id)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => {
                              setDeletingId(rule._id);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates?.map((template) => (
              <Card
                key={`${template.name}-${template.signalType}`}
                className="cursor-pointer hover:border-primary-500 transition-colors"
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full ${priorityColors[template.priority]}`}
                      />
                      <span className="text-sm text-muted-foreground">
                        {signalTypeLabels[template.signalType]}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenFromTemplate(template)}
                    >
                      Use Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Signal Rule' : 'New Signal Rule'}</DialogTitle>
            <DialogDescription>
              Configure when and how this rule triggers signals for advisors.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Inactive for 2 Weeks"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what triggers this rule"
                rows={2}
              />
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <h4 className="font-medium">Trigger Condition</h4>

              {/* Visual condition type selector */}
              <div className="space-y-2">
                <Label>Condition Type</Label>
                <Select
                  value={formData.condition.type}
                  onValueChange={(v) => {
                    // Initialize conditions with default values to match UI display and pass validation
                    const conditionDefaults: Record<string, ConditionFormData> = {
                      inactivity: { type: 'inactivity', days: 14 },
                      stalled: {
                        type: 'stalled',
                        days: 14,
                        qualifying_event_types: [
                          'login',
                          'application_created',
                          'application_updated',
                        ],
                      },
                      application_stall: { type: 'application_stall', days: 14 },
                      stage_stuck: { type: 'stage_stuck', days: 14, stage: 'Interview' },
                      engagement_drop: { type: 'engagement_drop', from: 'engaged', to: 'at_risk' },
                      high_intent_low_conversion: {
                        type: 'high_intent_low_conversion',
                        applications_threshold: 3,
                        application_period_days: 14,
                        appointment_days: 30,
                      },
                      no_progress: {
                        type: 'no_progress',
                        rejections_min: 5,
                        offers: 0,
                      },
                    };
                    setFormData({
                      ...formData,
                      condition: conditionDefaults[v] || { type: v as ConditionType },
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Activity-Based
                    </div>
                    <SelectItem value="inactivity">
                      <span className="flex items-center gap-2">
                        <span>⏰</span> Inactivity
                      </span>
                    </SelectItem>
                    <SelectItem value="stalled">
                      <span className="flex items-center gap-2">
                        <span>🛑</span> Stalled Student
                      </span>
                    </SelectItem>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Application-Based
                    </div>
                    <SelectItem value="application_stall">
                      <span className="flex items-center gap-2">
                        <span>📋</span> Application Stall
                      </span>
                    </SelectItem>
                    <SelectItem value="stage_stuck">
                      <span className="flex items-center gap-2">
                        <span>🔒</span> Stage Stuck
                      </span>
                    </SelectItem>
                    <SelectItem value="high_intent_low_conversion">
                      <span className="flex items-center gap-2">
                        <span>📊</span> High Intent, Low Conversion
                      </span>
                    </SelectItem>
                    <SelectItem value="no_progress">
                      <span className="flex items-center gap-2">
                        <span>❌</span> No Progress
                      </span>
                    </SelectItem>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Engagement-Based
                    </div>
                    <SelectItem value="engagement_drop">
                      <span className="flex items-center gap-2">
                        <span>📉</span> Engagement Drop
                      </span>
                    </SelectItem>
                    <SelectItem value="custom">
                      <span className="flex items-center gap-2">
                        <span>⚙️</span> Custom
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {CONDITION_TYPE_CONFIG[formData.condition.type]?.description}
                </p>
              </div>

              {formData.condition.type === 'inactivity' && (
                <div className="space-y-2">
                  <Label>Days of Inactivity</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.condition.days || 14}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        condition: { ...formData.condition, days: parseInt(e.target.value) || 14 },
                      })
                    }
                  />
                </div>
              )}

              {formData.condition.type === 'application_stall' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Stage</Label>
                    <Select
                      value={formData.condition.stage || 'any'}
                      onValueChange={(v) =>
                        setFormData({
                          ...formData,
                          condition: { ...formData.condition, stage: v === 'any' ? undefined : v },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any Stage</SelectItem>
                        <SelectItem value="Applied">Applied</SelectItem>
                        <SelectItem value="Interview">Interview</SelectItem>
                        <SelectItem value="Offer">Offer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Days Stalled</Label>
                    <Input
                      type="number"
                      min={1}
                      value={formData.condition.days || 14}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          condition: {
                            ...formData.condition,
                            days: parseInt(e.target.value) || 14,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              )}

              {formData.condition.type === 'engagement_drop' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>From Level</Label>
                    <Select
                      value={formData.condition.from || 'engaged'}
                      onValueChange={(v) =>
                        setFormData({
                          ...formData,
                          condition: { ...formData.condition, from: v },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="engaged">Engaged</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>To Level</Label>
                    <Select
                      value={formData.condition.to || 'at_risk'}
                      onValueChange={(v) =>
                        setFormData({
                          ...formData,
                          condition: { ...formData.condition, to: v },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="at_risk">At Risk</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {formData.condition.type === 'no_progress' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Min Rejections</Label>
                    <Input
                      type="number"
                      min={0}
                      value={formData.condition.rejections_min || 5}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          condition: {
                            ...formData.condition,
                            rejections_min: parseInt(e.target.value) || 0,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Offers</Label>
                    <Input
                      type="number"
                      min={0}
                      value={formData.condition.offers || 0}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          condition: {
                            ...formData.condition,
                            offers: parseInt(e.target.value) || 0,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              )}

              {/* Stalled Student condition */}
              {formData.condition.type === 'stalled' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Days Without Activity</Label>
                    <Input
                      type="number"
                      min={1}
                      value={formData.condition.days || 14}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          condition: {
                            ...formData.condition,
                            days: parseInt(e.target.value) || 14,
                          },
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Trigger signal if no qualifying activity in this many days
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Qualifying Activities</Label>
                    <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
                      {QUALIFYING_EVENT_OPTIONS.map((option) => (
                        <div key={option.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`event-${option.value}`}
                            checked={(
                              formData.condition.qualifying_event_types || [
                                'login',
                                'application_created',
                                'application_updated',
                              ]
                            ).includes(option.value)}
                            onCheckedChange={(checked) => {
                              const current = formData.condition.qualifying_event_types || [
                                'login',
                                'application_created',
                                'application_updated',
                              ];
                              const updated = checked
                                ? [...current, option.value]
                                : current.filter((v) => v !== option.value);
                              setFormData({
                                ...formData,
                                condition: {
                                  ...formData.condition,
                                  qualifying_event_types: updated,
                                },
                              });
                            }}
                          />
                          <Label htmlFor={`event-${option.value}`} className="text-sm font-normal">
                            {option.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Select which activities count as "active" for this rule
                    </p>
                  </div>
                </div>
              )}

              {/* Stage Stuck condition */}
              {formData.condition.type === 'stage_stuck' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Target Stage</Label>
                    <Select
                      value={formData.condition.stage || 'Interview'}
                      onValueChange={(v) =>
                        setFormData({
                          ...formData,
                          condition: { ...formData.condition, stage: v },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Applied">Applied</SelectItem>
                        <SelectItem value="Phone Screen">Phone Screen</SelectItem>
                        <SelectItem value="Interview">Interview</SelectItem>
                        <SelectItem value="Technical">Technical</SelectItem>
                        <SelectItem value="Onsite">Onsite</SelectItem>
                        <SelectItem value="Final Round">Final Round</SelectItem>
                        <SelectItem value="Offer">Offer</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Monitor applications stuck in this stage
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Days Stuck Threshold</Label>
                    <Input
                      type="number"
                      min={1}
                      value={formData.condition.days || 14}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          condition: {
                            ...formData.condition,
                            days: parseInt(e.target.value) || 14,
                          },
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Trigger after this many days in stage
                    </p>
                  </div>
                </div>
              )}

              {/* High Intent, Low Conversion condition */}
              {formData.condition.type === 'high_intent_low_conversion' && (
                <div className="space-y-4">
                  <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
                    <p className="text-sm text-amber-800">
                      This rule triggers when a student is actively applying but hasn't scheduled an
                      advising appointment.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Min Applications</Label>
                      <Input
                        type="number"
                        min={1}
                        value={formData.condition.applications_threshold || 3}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            condition: {
                              ...formData.condition,
                              applications_threshold: parseInt(e.target.value) || 3,
                            },
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">Applications required</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Application Period</Label>
                      <Input
                        type="number"
                        min={1}
                        value={formData.condition.application_period_days || 14}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            condition: {
                              ...formData.condition,
                              application_period_days: parseInt(e.target.value) || 14,
                            },
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">Days to count apps</p>
                    </div>
                    <div className="space-y-2">
                      <Label>No Appointment In</Label>
                      <Input
                        type="number"
                        min={1}
                        value={formData.condition.appointment_days || 30}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            condition: {
                              ...formData.condition,
                              appointment_days: parseInt(e.target.value) || 30,
                            },
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">Days without appointment</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Custom condition placeholder */}
              {formData.condition.type === 'custom' && (
                <div className="rounded-md bg-muted p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Custom conditions can be configured through advanced settings or API
                    integration.
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Signal Type</Label>
                <Select
                  value={formData.signalType}
                  onValueChange={(v) => setFormData({ ...formData, signalType: v as SignalType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="needs_outreach">Needs Outreach</SelectItem>
                    <SelectItem value="application_support">Application Support</SelectItem>
                    <SelectItem value="document_review">Document Review</SelectItem>
                    <SelectItem value="milestone_check">Milestone Check</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(v) => setFormData({ ...formData, priority: v as Priority })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cooldown">Cooldown (days)</Label>
              <Input
                id="cooldown"
                type="number"
                min={1}
                max={90}
                value={formData.cooldownDays}
                onChange={(e) =>
                  setFormData({ ...formData, cooldownDays: parseInt(e.target.value) || 7 })
                }
              />
              <p className="text-xs text-muted-foreground">
                Minimum days between signals for the same student
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="autoFollowup"
                checked={formData.autoCreateFollowup}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, autoCreateFollowup: !!checked })
                }
              />
              <Label htmlFor="autoFollowup" className="text-sm font-normal">
                Automatically create a follow-up task
              </Label>
            </div>

            {/* Rule Preview */}
            <div className="rounded-lg border-2 border-dashed border-primary-200 bg-primary-50/50 p-4">
              <h4 className="text-sm font-semibold text-primary-700 mb-2 flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Rule Preview
              </h4>
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">When:</span>{' '}
                  {getConditionDescription(formData.condition)}
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Then:</span> Create a{' '}
                  <span className="font-medium text-foreground">{formData.priority}</span> priority{' '}
                  <span className="font-medium text-foreground">
                    "{signalTypeLabels[formData.signalType]}"
                  </span>{' '}
                  signal
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Cooldown:</span> Won't trigger again
                  for the same student for {formData.cooldownDays} day
                  {formData.cooldownDays !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Signal Rule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this signal rule? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
