'use client';

import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { Activity, ArrowLeft, Copy, Edit, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import React, { useState } from 'react';

import {
  DEFAULT_QUALIFYING_EVENTS,
  EventTypeBadges,
  EventTypeSelector,
} from '@/components/settings/EventTypeSelector';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

interface CriteriaFormData {
  // New engagement criteria fields
  qualifying_event_types: string[];
  period_days: number;
  min_events_in_period: number;
  // Legacy fields (still supported)
  min_logins_per_week: number;
  min_actions_per_week: number;
  min_applications_active: number;
  max_days_since_activity: number;
}

interface DefinitionFormData {
  name: string;
  description: string;
  engagedThreshold: number;
  atRiskThreshold: number;
  appliesTo: 'all_students' | 'undergrad' | 'grad' | 'by_major' | 'by_year';
  criteria: CriteriaFormData;
}

const defaultFormData: DefinitionFormData = {
  name: '',
  description: '',
  engagedThreshold: 70,
  atRiskThreshold: 30,
  appliesTo: 'all_students',
  criteria: {
    // New fields for activity-based engagement scoring
    qualifying_event_types: [...DEFAULT_QUALIFYING_EVENTS],
    period_days: 14,
    min_events_in_period: 3,
    // Legacy fields (still supported for backwards compatibility)
    min_logins_per_week: 2,
    min_actions_per_week: 5,
    min_applications_active: 0,
    max_days_since_activity: 14,
  },
};

export default function EngagementDefinitionsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const universityId = user?.university_id as Id<'universities'> | undefined;

  // Queries
  const definitions = useQuery(
    api.engagement_definitions.getDefinitionsByUniversity,
    universityId ? { universityId } : 'skip',
  );

  // Mutations
  const createDefinition = useMutation(api.engagement_definitions.createDefinition);
  const updateDefinition = useMutation(api.engagement_definitions.updateDefinition);
  const deleteDefinition = useMutation(api.engagement_definitions.deleteDefinition);
  const duplicateDefinition = useMutation(api.engagement_definitions.duplicateDefinition);

  // State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<'engagement_definitions'> | null>(null);
  const [deletingId, setDeletingId] = useState<Id<'engagement_definitions'> | null>(null);
  const [formData, setFormData] = useState<DefinitionFormData>(defaultFormData);
  const [loading, setLoading] = useState(false);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData(defaultFormData);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (def: NonNullable<typeof definitions>[number]) => {
    setEditingId(def._id);
    const criteria = def.criteria as Partial<CriteriaFormData> | undefined;
    setFormData({
      name: def.name,
      description: def.description || '',
      engagedThreshold: def.engaged_threshold,
      atRiskThreshold: def.at_risk_threshold,
      appliesTo: def.applies_to,
      criteria: {
        // New activity-based scoring fields
        qualifying_event_types: criteria?.qualifying_event_types ?? [...DEFAULT_QUALIFYING_EVENTS],
        period_days: criteria?.period_days ?? 14,
        min_events_in_period: criteria?.min_events_in_period ?? 3,
        // Legacy fields
        min_logins_per_week: criteria?.min_logins_per_week ?? 2,
        min_actions_per_week: criteria?.min_actions_per_week ?? 5,
        min_applications_active: criteria?.min_applications_active ?? 0,
        max_days_since_activity: criteria?.max_days_since_activity ?? 14,
      },
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

    if (formData.atRiskThreshold >= formData.engagedThreshold) {
      toast({
        title: 'Validation Error',
        description: 'At-risk threshold must be less than engaged threshold.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        await updateDefinition({
          definitionId: editingId,
          name: formData.name,
          description: formData.description || undefined,
          engagedThreshold: formData.engagedThreshold,
          atRiskThreshold: formData.atRiskThreshold,
          appliesTo: formData.appliesTo,
          criteria: formData.criteria,
        });
        toast({
          title: 'Definition Updated',
          description: 'Engagement definition has been updated.',
        });
      } else {
        await createDefinition({
          universityId,
          name: formData.name,
          description: formData.description || undefined,
          engagedThreshold: formData.engagedThreshold,
          atRiskThreshold: formData.atRiskThreshold,
          appliesTo: formData.appliesTo,
          criteria: formData.criteria,
        });
        toast({
          title: 'Definition Created',
          description: 'New engagement definition has been created.',
        });
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save definition.',
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
      await deleteDefinition({ definitionId: deletingId });
      toast({
        title: 'Definition Deleted',
        description: 'Engagement definition has been deleted.',
      });
      setIsDeleteDialogOpen(false);
      setDeletingId(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete definition.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async (id: Id<'engagement_definitions'>) => {
    if (loading) return;
    setLoading(true);
    try {
      await duplicateDefinition({ definitionId: id });
      toast({
        title: 'Definition Duplicated',
        description: 'A copy of the engagement definition has been created.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to duplicate definition.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
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
          <h1 className="text-2xl font-bold">Engagement Definitions</h1>
          <p className="text-muted-foreground">
            Define what constitutes engaged vs at-risk students for your university.
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Definition
        </Button>
      </div>

      {/* Definitions List */}
      {!definitions ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      ) : definitions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Activity className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">No Engagement Definitions</h3>
            <p className="mb-4 text-center text-muted-foreground">
              Create your first engagement definition to start tracking student engagement levels.
            </p>
            <Button onClick={handleOpenCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Definition
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {definitions.map((def) => (
            <Card key={def._id} className={!def.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{def.name}</CardTitle>
                    {def.description && (
                      <CardDescription className="mt-1">{def.description}</CardDescription>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Open definition actions"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenEdit(def)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(def._id)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => {
                          setDeletingId(def._id);
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {def.is_active ? (
                      <Badge variant="default" className="bg-green-500">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                    {def.is_default && <Badge variant="outline">Default</Badge>}
                    <Badge variant="outline">{def.applies_to.replace('_', ' ')}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Engaged Threshold</p>
                      <p className="font-medium text-green-600">&ge; {def.engaged_threshold}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">At-Risk Threshold</p>
                      <p className="font-medium text-red-600">&le; {def.at_risk_threshold}%</p>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Created {new Date(def.created_at).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Engagement Definition' : 'New Engagement Definition'}
            </DialogTitle>
            <DialogDescription>
              Define the criteria and thresholds for measuring student engagement.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">Basic Settings</TabsTrigger>
              <TabsTrigger value="activities">Qualifying Activities</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Weekly Active"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what this definition measures"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="appliesTo">Applies To</Label>
                <Select
                  value={formData.appliesTo}
                  onValueChange={(v) =>
                    setFormData({ ...formData, appliesTo: v as DefinitionFormData['appliesTo'] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_students">All Students</SelectItem>
                    <SelectItem value="undergrad">Undergrad Only</SelectItem>
                    <SelectItem value="grad">Graduate Only</SelectItem>
                    <SelectItem value="by_major">By Major</SelectItem>
                    <SelectItem value="by_year">By Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="engagedThreshold">Engaged Threshold (%)</Label>
                  <Input
                    id="engagedThreshold"
                    type="number"
                    min={1}
                    max={100}
                    value={formData.engagedThreshold}
                    onChange={(e) =>
                      setFormData({ ...formData, engagedThreshold: parseInt(e.target.value) || 0 })
                    }
                  />
                  <p className="text-xs text-muted-foreground">Score at or above this = Engaged</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="atRiskThreshold">At-Risk Threshold (%)</Label>
                  <Input
                    id="atRiskThreshold"
                    type="number"
                    min={0}
                    max={99}
                    value={formData.atRiskThreshold}
                    onChange={(e) =>
                      setFormData({ ...formData, atRiskThreshold: parseInt(e.target.value) || 0 })
                    }
                  />
                  <p className="text-xs text-muted-foreground">Score at or below this = At-Risk</p>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <h4 className="font-medium">Engagement Period</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="periodDays">Look-back Period (days)</Label>
                    <Input
                      id="periodDays"
                      type="number"
                      min={1}
                      max={90}
                      value={formData.criteria.period_days}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          criteria: {
                            ...formData.criteria,
                            period_days: parseInt(e.target.value) || 14,
                          },
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      How many days back to check for activity
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="minEvents">Min Events in Period</Label>
                    <Input
                      id="minEvents"
                      type="number"
                      min={1}
                      value={formData.criteria.min_events_in_period}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          criteria: {
                            ...formData.criteria,
                            min_events_in_period: parseInt(e.target.value) || 3,
                          },
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Minimum qualifying events needed
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="activities" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Qualifying Activities</Label>
                <p className="text-sm text-muted-foreground">
                  Select which activities count as engagement. Students will be scored based on
                  their qualifying activity within the look-back period.
                </p>
              </div>

              <EventTypeSelector
                selectedEvents={formData.criteria.qualifying_event_types}
                onChange={(events) =>
                  setFormData({
                    ...formData,
                    criteria: {
                      ...formData.criteria,
                      qualifying_event_types: events,
                    },
                  })
                }
              />

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> Engagement scores are calculated based on the number and
                  recency of qualifying events. More events and more recent activity result in
                  higher scores.
                </p>
              </div>
            </TabsContent>
          </Tabs>

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
            <DialogTitle>Delete Engagement Definition</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this engagement definition? This action cannot be
              undone.
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
