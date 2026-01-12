'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { Building2, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

export interface ExperienceSectionRef {
  handleSave: () => Promise<void>;
  isSaving: boolean;
}

interface WorkExperience {
  id: string;
  role?: string;
  company?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
  location?: string;
  summary?: string;
}

const YEARS_OF_EXPERIENCE_OPTIONS = [
  'Less than 1 year',
  '1-2 years',
  '3-5 years',
  '6-10 years',
  '11-15 years',
  '16-20 years',
  '20+ years',
];

export const ExperienceSection = forwardRef<ExperienceSectionRef, {}>((_, ref) => {
  const { user: clerkUser } = useUser();
  const { toast } = useToast();

  const convexUser = useQuery(
    api.users.getUserByClerkId,
    clerkUser?.id ? { clerkId: clerkUser.id } : 'skip',
  );

  const updateUserMutation = useMutation(api.users.updateUser);

  // Form state
  const [yearsOfExperience, setYearsOfExperience] = useState('');
  const [workHistory, setWorkHistory] = useState<WorkExperience[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExperience, setEditingExperience] = useState<WorkExperience | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form fields for dialog
  const [formCompany, setFormCompany] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formIsCurrent, setFormIsCurrent] = useState(false);
  const [formLocation, setFormLocation] = useState('');
  const [formSummary, setFormSummary] = useState('');

  // Initialize form from Convex data (only once to prevent overwriting unsaved edits)
  useEffect(() => {
    if (convexUser && !isInitialized) {
      setYearsOfExperience(convexUser.years_of_experience || '');
      setWorkHistory(convexUser.work_history || []);
      setIsInitialized(true);
    }
  }, [convexUser, isInitialized]);

  const handleSave = useCallback(async () => {
    if (!clerkUser?.id) return;

    setIsSaving(true);
    try {
      await updateUserMutation({
        clerkId: clerkUser.id,
        updates: {
          years_of_experience: yearsOfExperience || undefined,
          work_history: workHistory,
        },
      });

      toast({
        title: 'Experience updated',
        description: 'Your work experience has been saved successfully',
        variant: 'success',
      });
    } catch (error) {
      console.error('Failed to update experience:', error);
      toast({
        title: 'Update failed',
        description: 'Failed to update experience. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [clerkUser?.id, yearsOfExperience, workHistory, updateUserMutation, toast]);

  useImperativeHandle(
    ref,
    () => ({
      handleSave,
      isSaving,
    }),
    [handleSave, isSaving],
  );

  const resetForm = () => {
    setFormCompany('');
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

  const openEditDialog = (experience: WorkExperience) => {
    setEditingExperience(experience);
    setFormCompany(experience.company || '');
    setFormRole(experience.role || '');
    setFormStartDate(experience.start_date || '');
    setFormEndDate(experience.end_date || '');
    setFormIsCurrent(experience.is_current || false);
    setFormLocation(experience.location || '');
    setFormSummary(experience.summary || '');
    setIsDialogOpen(true);
  };

  const handleSaveExperience = () => {
    const newExperience: WorkExperience = {
      id: editingExperience?.id || `exp_${crypto.randomUUID()}`,
      company: formCompany || undefined,
      role: formRole || undefined,
      start_date: formStartDate || undefined,
      end_date: formIsCurrent ? undefined : formEndDate || undefined,
      is_current: formIsCurrent,
      location: formLocation || undefined,
      summary: formSummary || undefined,
    };

    if (editingExperience) {
      // Update existing
      setWorkHistory((prev) =>
        prev.map((exp) => (exp.id === editingExperience.id ? newExperience : exp)),
      );
    } else {
      // Add new
      setWorkHistory((prev) => [newExperience, ...prev]);
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const handleDeleteExperience = (id: string) => {
    setWorkHistory((prev) => prev.filter((exp) => exp.id !== id));
    setDeleteConfirmId(null);
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
    <div className="space-y-8">
      {/* Total Work Experience */}
      <div className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Total Work Experience</h3>
          <p className="text-sm text-muted-foreground">
            How many years of total professional experience do you have? (Regardless of role)
          </p>
        </div>
        <Select value={yearsOfExperience} onValueChange={setYearsOfExperience}>
          <SelectTrigger className="rounded-control">
            <SelectValue placeholder="Years of Experience" />
          </SelectTrigger>
          <SelectContent>
            {YEARS_OF_EXPERIENCE_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Work Experience List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Work Experience</h3>
            <p className="text-sm text-muted-foreground">Add your work experience below</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={openAddDialog}
            className="rounded-control flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Experience
          </Button>
        </div>

        {workHistory.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center">
            <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No work experience added yet</p>
            <Button
              variant="link"
              onClick={openAddDialog}
              className="mt-2 text-primary-600 hover:text-primary-700"
            >
              Add your first work experience
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {workHistory.map((experience) => (
              <div key={experience.id} className="border border-slate-200 rounded-xl p-5 bg-white">
                <div className="flex gap-4">
                  {/* Company Icon */}
                  <div className="flex-shrink-0">
                    <div className="w-14 h-14 bg-slate-100 rounded-lg flex items-center justify-center">
                      <Building2 className="h-7 w-7 text-slate-400" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="font-semibold text-slate-900">
                          {experience.company || 'Company Name'}
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label="Actions"
                          >
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
              {editingExperience ? 'Edit Work Experience' : 'Add Work Experience'}
            </DialogTitle>
            <DialogDescription>
              {editingExperience
                ? 'Update your work experience details'
                : 'Add a new work experience to your profile'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={formCompany}
                onChange={(e) => setFormCompany(e.target.value)}
                placeholder="e.g., Google, Microsoft"
                className="rounded-control"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role / Job Title</Label>
              <Input
                id="role"
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
                placeholder="e.g., Software Engineer"
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
              <Switch id="is_current" checked={formIsCurrent} onCheckedChange={setFormIsCurrent} />
              <Label htmlFor="is_current">I currently work here</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location (Optional)</Label>
              <Input
                id="location"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                placeholder="e.g., San Francisco, CA"
                className="rounded-control"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="summary">Description</Label>
              <Textarea
                id="summary"
                value={formSummary}
                onChange={(e) => setFormSummary(e.target.value)}
                placeholder="Describe your responsibilities, achievements, and impact..."
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
              disabled={!formCompany && !formRole}
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
            <DialogTitle>Delete Experience</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this work experience? This action cannot be undone.
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
});

ExperienceSection.displayName = 'ExperienceSection';
