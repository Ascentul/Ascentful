'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { Building2, Loader2, MoreHorizontal, Pencil, Plus, Trash2, X } from 'lucide-react';
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

export interface EducationSectionRef {
  handleSave: () => Promise<void>;
  isSaving: boolean;
}

interface Education {
  id: string;
  school?: string;
  degree?: string;
  field_of_study?: string;
  start_year?: string;
  end_year?: string;
  is_current?: boolean;
  gpa?: string;
  achievements?: string[];
  description?: string;
}

export const EducationSection = forwardRef<EducationSectionRef, {}>((_, ref) => {
  const { user: clerkUser } = useUser();
  const { toast } = useToast();

  const convexUser = useQuery(
    api.users.getUserByClerkId,
    clerkUser?.id ? { clerkId: clerkUser.id } : 'skip',
  );

  const updateUserMutation = useMutation(api.users.updateUser);

  // Form state
  const [educationHistory, setEducationHistory] = useState<Education[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEducation, setEditingEducation] = useState<Education | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form fields for dialog
  const [formSchool, setFormSchool] = useState('');
  const [formDegree, setFormDegree] = useState('');
  const [formFieldOfStudy, setFormFieldOfStudy] = useState('');
  const [formStartYear, setFormStartYear] = useState('');
  const [formEndYear, setFormEndYear] = useState('');
  const [formIsCurrent, setFormIsCurrent] = useState(false);
  const [formGpa, setFormGpa] = useState('');
  const [formAchievements, setFormAchievements] = useState<string[]>([]);
  const [formAchievementInput, setFormAchievementInput] = useState('');
  const [formDescription, setFormDescription] = useState('');

  // Initialize form from Convex data
  useEffect(() => {
    if (convexUser) {
      setEducationHistory(convexUser.education_history || []);
    }
  }, [convexUser]);

  const handleSave = useCallback(async () => {
    if (!clerkUser?.id) return;

    setIsSaving(true);
    try {
      await updateUserMutation({
        clerkId: clerkUser.id,
        updates: {
          education_history: educationHistory.length > 0 ? educationHistory : undefined,
        },
      });

      toast({
        title: 'Education updated',
        description: 'Your education history has been saved successfully',
        variant: 'success',
      });
    } catch (error) {
      console.error('Failed to update education:', error);
      toast({
        title: 'Update failed',
        description: 'Failed to update education. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [clerkUser?.id, educationHistory, updateUserMutation, toast]);

  useImperativeHandle(
    ref,
    () => ({
      handleSave,
      isSaving,
    }),
    [handleSave, isSaving],
  );

  const resetForm = () => {
    setFormSchool('');
    setFormDegree('');
    setFormFieldOfStudy('');
    setFormStartYear('');
    setFormEndYear('');
    setFormIsCurrent(false);
    setFormGpa('');
    setFormAchievements([]);
    setFormAchievementInput('');
    setFormDescription('');
    setEditingEducation(null);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (education: Education) => {
    setEditingEducation(education);
    setFormSchool(education.school || '');
    setFormDegree(education.degree || '');
    setFormFieldOfStudy(education.field_of_study || '');
    setFormStartYear(education.start_year || '');
    setFormEndYear(education.end_year || '');
    setFormIsCurrent(education.is_current || false);
    setFormGpa(education.gpa || '');
    setFormAchievements(education.achievements || []);
    setFormDescription(education.description || '');
    setIsDialogOpen(true);
  };

  const addAchievement = () => {
    if (formAchievementInput.trim()) {
      setFormAchievements([...formAchievements, formAchievementInput.trim()]);
      setFormAchievementInput('');
    }
  };

  const removeAchievement = (index: number) => {
    setFormAchievements(formAchievements.filter((_, i) => i !== index));
  };

  const handleSaveEducation = async () => {
    const newEducation: Education = {
      id: editingEducation?.id || `edu_${Date.now()}`,
      school: formSchool || undefined,
      degree: formDegree || undefined,
      field_of_study: formFieldOfStudy || undefined,
      start_year: formStartYear || undefined,
      end_year: formIsCurrent ? undefined : formEndYear || undefined,
      is_current: formIsCurrent,
      gpa: formGpa || undefined,
      achievements: formAchievements.length > 0 ? formAchievements : undefined,
      description: formDescription || undefined,
    };

    let updatedHistory: Education[];
    if (editingEducation) {
      // Update existing
      updatedHistory = educationHistory.map((edu) =>
        edu.id === editingEducation.id ? newEducation : edu,
      );
    } else {
      // Add new
      updatedHistory = [newEducation, ...educationHistory];
    }

    // Store previous state for rollback
    const previousHistory = educationHistory;
    setEducationHistory(updatedHistory);
    setIsDialogOpen(false);
    resetForm();

    // Auto-save after adding/editing
    if (clerkUser?.id) {
      try {
        await updateUserMutation({
          clerkId: clerkUser.id,
          updates: {
            education_history: updatedHistory.length > 0 ? updatedHistory : undefined,
          },
        });
        toast({
          title: 'Education saved',
          description: editingEducation ? 'Your changes have been saved' : 'New education added',
          variant: 'success',
        });
      } catch (error) {
        console.error('Failed to save education:', error);
        // Rollback local state on failure
        setEducationHistory(previousHistory);
        toast({
          title: 'Save failed',
          description: 'Failed to save. Please try again.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleDeleteEducation = async (id: string) => {
    const previousHistory = [...educationHistory];
    const updatedHistory = educationHistory.filter((edu) => edu.id !== id);
    setEducationHistory(updatedHistory);
    setDeleteConfirmId(null);

    // Auto-save after deleting
    if (clerkUser?.id) {
      try {
        await updateUserMutation({
          clerkId: clerkUser.id,
          updates: {
            education_history: updatedHistory.length > 0 ? updatedHistory : undefined,
          },
        });
        toast({
          title: 'Education deleted',
          description: 'The education record has been removed',
          variant: 'success',
        });
      } catch (error) {
        console.error('Failed to delete education:', error);
        // Rollback local state on failure
        setEducationHistory(previousHistory);
        toast({
          title: 'Delete failed',
          description: 'Failed to delete. Please try again.',
          variant: 'destructive',
        });
      }
    }
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
      {/* Education List */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Education</h3>
          <p className="text-sm text-muted-foreground">Add your education history below</p>
        </div>

        {educationHistory.length > 0 && (
          <div className="space-y-4">
            {educationHistory.map((education) => (
              <div key={education.id} className="border border-slate-200 rounded-xl p-5 bg-white">
                <div className="flex gap-4">
                  {/* School Icon */}
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
                          {education.school || 'School Name'}
                        </h4>
                        <p className="text-slate-600">
                          {[education.field_of_study, education.degree]
                            .filter(Boolean)
                            .join(' - ') || 'Degree'}
                        </p>
                        {(education.start_year || education.end_year) && (
                          <p className="text-sm text-slate-500">
                            {education.start_year || ''} -{' '}
                            {education.is_current ? 'Present' : education.end_year || ''}
                          </p>
                        )}
                      </div>

                      {/* Actions Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(education)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteConfirmId(education.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Achievements */}
                    {education.achievements && education.achievements.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {education.achievements.map((achievement, index) => (
                          <p key={index} className="text-sm text-slate-600 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            {achievement}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Description */}
                    {education.description && (
                      <div className="mt-3 text-sm text-slate-600 whitespace-pre-wrap">
                        {education.description}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Button */}
        <button
          onClick={openAddDialog}
          className="w-full border border-dashed border-slate-300 rounded-xl p-4 flex items-center justify-center hover:border-slate-400 hover:bg-slate-50 transition-colors"
          aria-label="Add education"
        >
          <Plus className="h-5 w-5 text-slate-400" />
        </button>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEducation ? 'Edit Education' : 'Add Education'}</DialogTitle>
            <DialogDescription>
              {editingEducation
                ? 'Update your education details'
                : 'Add a new education record to your profile'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="school">School / University</Label>
              <Input
                id="school"
                value={formSchool}
                onChange={(e) => setFormSchool(e.target.value)}
                placeholder="e.g., North Park University"
                className="rounded-control"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="degree">Degree</Label>
                <Input
                  id="degree"
                  value={formDegree}
                  onChange={(e) => setFormDegree(e.target.value)}
                  placeholder="e.g., Bachelor of Arts"
                  className="rounded-control"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="field_of_study">Field of Study</Label>
                <Input
                  id="field_of_study"
                  value={formFieldOfStudy}
                  onChange={(e) => setFormFieldOfStudy(e.target.value)}
                  placeholder="e.g., Marketing"
                  className="rounded-control"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_year">Start Year</Label>
                <Input
                  id="start_year"
                  value={formStartYear}
                  onChange={(e) => setFormStartYear(e.target.value)}
                  placeholder="e.g., 2020"
                  className="rounded-control"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_year">End Year</Label>
                <Input
                  id="end_year"
                  value={formEndYear}
                  onChange={(e) => setFormEndYear(e.target.value)}
                  placeholder="e.g., 2024"
                  disabled={formIsCurrent}
                  className="rounded-control"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch id="is_current" checked={formIsCurrent} onCheckedChange={setFormIsCurrent} />
              <Label htmlFor="is_current">I currently attend here</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gpa">GPA (Optional)</Label>
              <Input
                id="gpa"
                value={formGpa}
                onChange={(e) => setFormGpa(e.target.value)}
                placeholder="e.g., 3.8"
                className="rounded-control"
              />
            </div>

            <div className="space-y-2">
              <Label>Achievements / Honors (Optional)</Label>
              <div className="flex gap-2">
                <Input
                  value={formAchievementInput}
                  onChange={(e) => setFormAchievementInput(e.target.value)}
                  placeholder="e.g., Honor Roll, Dean's List"
                  className="rounded-control"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addAchievement();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addAchievement}
                  className="rounded-control"
                >
                  Add
                </Button>
              </div>
              {formAchievements.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formAchievements.map((achievement, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-sm"
                    >
                      {achievement}
                      <button
                        type="button"
                        onClick={() => removeAchievement(index)}
                        className="text-slate-500 hover:text-slate-700"
                        aria-label={`Remove ${achievement}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Additional details about your education..."
                rows={4}
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
              onClick={handleSaveEducation}
              disabled={!formSchool}
              className="rounded-control bg-[#5371FF] hover:bg-[#4361EE] text-white"
            >
              {editingEducation ? 'Save Changes' : 'Add Education'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Education</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this education record? This action cannot be undone.
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
              onClick={() => deleteConfirmId && handleDeleteEducation(deleteConfirmId)}
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

EducationSection.displayName = 'EducationSection';
