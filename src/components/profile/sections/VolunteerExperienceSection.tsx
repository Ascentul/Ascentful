'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { Heart, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';

import { Button } from '@/components/ui/button';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

export interface VolunteerExperienceSectionRef {
  handleSave: () => Promise<void>;
  isSaving: boolean;
}

interface VolunteerExperience {
  id: string;
  role?: string;
  organization?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
  location?: string;
  summary?: string;
}

export const VolunteerExperienceSection = forwardRef<VolunteerExperienceSectionRef, {}>(
  (_, ref) => {
    const { user: clerkUser } = useUser();
    const { toast } = useToast();

    const convexUser = useQuery(
      api.users.getUserByClerkId,
      clerkUser?.id ? { clerkId: clerkUser.id } : 'skip',
    );

    const updateUserMutation = useMutation(api.users.updateUser);

    // Form state
    const [volunteerHistory, setVolunteerHistory] = useState<VolunteerExperience[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingExperience, setEditingExperience] = useState<VolunteerExperience | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    // Form fields for dialog
    const [formOrganization, setFormOrganization] = useState('');
    const [formRole, setFormRole] = useState('');
    const [formStartDate, setFormStartDate] = useState('');
    const [formEndDate, setFormEndDate] = useState('');
    const [formIsCurrent, setFormIsCurrent] = useState(false);
    const [formLocation, setFormLocation] = useState('');
    const [formSummary, setFormSummary] = useState('');

    // Initialize form from Convex data
    useEffect(() => {
      if (convexUser) {
        setVolunteerHistory(convexUser.volunteer_history || []);
      }
    }, [convexUser]);

    const handleSave = useCallback(async () => {
      if (!clerkUser?.id) return;

      setIsSaving(true);
      try {
        await updateUserMutation({
          clerkId: clerkUser.id,
          updates: {
            volunteer_history: volunteerHistory.length > 0 ? volunteerHistory : undefined,
          },
        });

        toast({
          title: 'Volunteer experience updated',
          description: 'Your volunteer experience has been saved successfully',
          variant: 'success',
        });
      } catch (error) {
        console.error('Failed to update volunteer experience:', error);
        toast({
          title: 'Update failed',
          description: 'Failed to update volunteer experience. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    }, [clerkUser?.id, volunteerHistory, updateUserMutation, toast]);

    useImperativeHandle(
      ref,
      () => ({
        handleSave,
        isSaving,
      }),
      [handleSave, isSaving],
    );

    const resetForm = () => {
      setFormOrganization('');
      setFormRole('');
      setFormStartDate('');
      setFormEndDate('');
      setFormIsCurrent(false);
      setFormLocation('');
      setFormSummary('');
      setEditingExperience(null);
    };

    const openAddDialog = () => {
      resetForm();
      setIsDialogOpen(true);
    };

    const openEditDialog = (experience: VolunteerExperience) => {
      setEditingExperience(experience);
      setFormOrganization(experience.organization || '');
      setFormRole(experience.role || '');
      setFormStartDate(experience.start_date || '');
      setFormEndDate(experience.end_date || '');
      setFormIsCurrent(experience.is_current || false);
      setFormLocation(experience.location || '');
      setFormSummary(experience.summary || '');
      setIsDialogOpen(true);
    };

    const handleSaveExperience = async () => {
      const newExperience: VolunteerExperience = {
        id: editingExperience?.id || `vol_${Date.now()}`,
        organization: formOrganization || undefined,
        role: formRole || undefined,
        start_date: formStartDate || undefined,
        end_date: formIsCurrent ? undefined : formEndDate || undefined,
        is_current: formIsCurrent,
        location: formLocation || undefined,
        summary: formSummary || undefined,
      };

      let updatedHistory: VolunteerExperience[];
      if (editingExperience) {
        // Update existing
        updatedHistory = volunteerHistory.map((exp) =>
          exp.id === editingExperience.id ? newExperience : exp,
        );
      } else {
        // Add new
        updatedHistory = [newExperience, ...volunteerHistory];
      }

      setVolunteerHistory(updatedHistory);
      setIsDialogOpen(false);
      resetForm();

      // Auto-save after adding/editing
      if (clerkUser?.id) {
        try {
          await updateUserMutation({
            clerkId: clerkUser.id,
            updates: {
              volunteer_history: updatedHistory.length > 0 ? updatedHistory : undefined,
            },
          });
          toast({
            title: 'Volunteer experience saved',
            description: editingExperience
              ? 'Your changes have been saved'
              : 'New volunteer experience added',
            variant: 'success',
          });
        } catch (error) {
          console.error('Failed to save volunteer experience:', error);
          toast({
            title: 'Save failed',
            description: 'Failed to save. Please try again.',
            variant: 'destructive',
          });
        }
      }
    };

    const handleDeleteExperience = async (id: string) => {
      const updatedHistory = volunteerHistory.filter((exp) => exp.id !== id);
      setVolunteerHistory(updatedHistory);
      setDeleteConfirmId(null);

      // Auto-save after deleting
      if (clerkUser?.id) {
        try {
          await updateUserMutation({
            clerkId: clerkUser.id,
            updates: {
              volunteer_history: updatedHistory.length > 0 ? updatedHistory : undefined,
            },
          });
          toast({
            title: 'Volunteer experience deleted',
            description: 'The volunteer experience has been removed',
            variant: 'success',
          });
        } catch (error) {
          console.error('Failed to delete volunteer experience:', error);
          toast({
            title: 'Delete failed',
            description: 'Failed to delete. Please try again.',
            variant: 'destructive',
          });
        }
      }
    };

    const formatDateRange = (startDate?: string, endDate?: string, isCurrent?: boolean) => {
      if (!startDate) return '';
      const start = startDate;
      const end = isCurrent ? 'Present' : endDate || '';
      return `${start} to ${end}`;
    };

    if (!convexUser) {
      return (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Volunteer Experience List */}
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Volunteer Experience</h3>
            <p className="text-sm text-muted-foreground">Add your volunteer experience below</p>
          </div>

          {/* Add Button */}
          <button
            onClick={openAddDialog}
            className="w-full border border-dashed border-slate-300 rounded-xl p-4 flex items-center justify-center hover:border-slate-400 hover:bg-slate-50 transition-colors"
          >
            <Plus className="h-5 w-5 text-slate-400" />
          </button>

          {volunteerHistory.length > 0 && (
            <div className="space-y-4">
              {volunteerHistory.map((experience) => (
                <div
                  key={experience.id}
                  className="border border-slate-200 rounded-xl p-5 bg-white"
                >
                  <div className="flex gap-4">
                    {/* Organization Icon */}
                    <div className="flex-shrink-0">
                      <div className="w-14 h-14 bg-slate-100 rounded-lg flex items-center justify-center">
                        <Heart className="h-7 w-7 text-slate-400" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="font-semibold text-slate-900">
                            {experience.organization || 'Organization Name'}
                          </h4>
                          <p className="text-slate-600">{experience.role || 'Role'}</p>
                          <p className="text-sm text-slate-500">
                            {formatDateRange(
                              experience.start_date,
                              experience.end_date,
                              experience.is_current,
                            )}
                          </p>
                        </div>

                        {/* Actions Menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(experience)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteConfirmId(experience.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Summary */}
                      {experience.summary && (
                        <div className="mt-3 text-sm text-slate-600 whitespace-pre-wrap">
                          {experience.summary}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingExperience ? 'Edit Volunteer Experience' : 'Add Volunteer Experience'}
              </DialogTitle>
              <DialogDescription>
                {editingExperience
                  ? 'Update your volunteer experience details'
                  : 'Add a new volunteer experience to your profile'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="organization">Organization</Label>
                <Input
                  id="organization"
                  value={formOrganization}
                  onChange={(e) => setFormOrganization(e.target.value)}
                  placeholder="e.g., Red Cross, Habitat for Humanity"
                  className="rounded-control"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role / Position</Label>
                <Input
                  id="role"
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  placeholder="e.g., Volunteer Coordinator"
                  className="rounded-control"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    placeholder="e.g., Jan, 2023"
                    className="rounded-control"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    placeholder="e.g., Dec, 2024"
                    disabled={formIsCurrent}
                    className="rounded-control"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="is_current"
                  checked={formIsCurrent}
                  onCheckedChange={setFormIsCurrent}
                />
                <Label htmlFor="is_current">I currently volunteer here</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location (Optional)</Label>
                <Input
                  id="location"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder="e.g., Chicago, IL"
                  className="rounded-control"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="summary">Description</Label>
                <Textarea
                  id="summary"
                  value={formSummary}
                  onChange={(e) => setFormSummary(e.target.value)}
                  placeholder="Describe your volunteer work, responsibilities, and impact..."
                  rows={6}
                  className="rounded-lg resize-none"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
                className="rounded-control"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveExperience}
                disabled={!formOrganization && !formRole}
                className="rounded-control bg-[#5371FF] hover:bg-[#4361EE] text-white"
              >
                {editingExperience ? 'Save Changes' : 'Add Experience'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete Volunteer Experience</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this volunteer experience? This action cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmId(null)}
                className="rounded-control"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteConfirmId && handleDeleteExperience(deleteConfirmId)}
                className="rounded-control"
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  },
);

VolunteerExperienceSection.displayName = 'VolunteerExperienceSection';
