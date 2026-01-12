'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { FolderKanban, Loader2, MoreHorizontal, Pencil, Plus, Trash2, X } from 'lucide-react';
import { forwardRef, useImperativeHandle, useState } from 'react';

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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

export interface ProjectsSectionRef {
  handleSave: () => Promise<void>;
  isSaving: boolean;
}

interface Project {
  _id: Id<'projects'>;
  title: string;
  role?: string;
  start_date?: number;
  end_date?: number;
  company?: string;
  url?: string;
  github_url?: string;
  description?: string;
  type: string;
  technologies: string[];
}

const PROJECT_TYPES = [
  { value: 'personal', label: 'Personal Project' },
  { value: 'professional', label: 'Professional/Work' },
  { value: 'academic', label: 'Academic/School' },
  { value: 'open_source', label: 'Open Source' },
  { value: 'freelance', label: 'Freelance/Contract' },
];

export const ProjectsSection = forwardRef<ProjectsSectionRef, {}>((_, ref) => {
  const { user: clerkUser } = useUser();
  const { toast } = useToast();

  const projects = useQuery(
    api.projects.getUserProjects,
    clerkUser?.id ? { clerkId: clerkUser.id } : 'skip',
  );

  const createProjectMutation = useMutation(api.projects.createProject);
  const updateProjectMutation = useMutation(api.projects.updateProject);
  const deleteProjectMutation = useMutation(api.projects.deleteProject);

  const [isSaving, setIsSaving] = useState(false);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<Id<'projects'> | null>(null);

  // Form fields for dialog
  const [formTitle, setFormTitle] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formType, setFormType] = useState('personal');
  const [formCompany, setFormCompany] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formGithubUrl, setFormGithubUrl] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTechnologies, setFormTechnologies] = useState<string[]>([]);
  const [formTechInput, setFormTechInput] = useState('');

  // No-op save since projects auto-save via mutations
  const handleSave = async () => {
    // Projects are auto-saved on add/edit/delete
  };

  useImperativeHandle(
    ref,
    () => ({
      handleSave,
      isSaving,
    }),
    [handleSave, isSaving],
  );

  const resetForm = () => {
    setFormTitle('');
    setFormRole('');
    setFormType('personal');
    setFormCompany('');
    setFormStartDate('');
    setFormEndDate('');
    setFormUrl('');
    setFormGithubUrl('');
    setFormDescription('');
    setFormTechnologies([]);
    setFormTechInput('');
    setEditingProject(null);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (project: Project) => {
    setEditingProject(project);
    setFormTitle(project.title || '');
    setFormRole(project.role || '');
    setFormType(project.type || 'personal');
    setFormCompany(project.company || '');
    setFormStartDate(
      project.start_date ? new Date(project.start_date).toISOString().split('T')[0] : '',
    );
    setFormEndDate(project.end_date ? new Date(project.end_date).toISOString().split('T')[0] : '');
    setFormUrl(project.url || '');
    setFormGithubUrl(project.github_url || '');
    setFormDescription(project.description || '');
    setFormTechnologies(project.technologies || []);
    setIsDialogOpen(true);
  };

  const addTechnology = () => {
    if (formTechInput.trim() && !formTechnologies.includes(formTechInput.trim())) {
      setFormTechnologies([...formTechnologies, formTechInput.trim()]);
      setFormTechInput('');
    }
  };

  const removeTechnology = (index: number) => {
    setFormTechnologies(formTechnologies.filter((_, i) => i !== index));
  };

  const handleSaveProject = async () => {
    if (!clerkUser?.id || !formTitle) return;

    setIsSaving(true);
    try {
      if (editingProject) {
        // Update existing project
        await updateProjectMutation({
          clerkId: clerkUser.id,
          projectId: editingProject._id,
          updates: {
            title: formTitle,
            role: formRole || undefined,
            type: formType,
            company: formCompany || undefined,
            start_date: formStartDate ? new Date(formStartDate).getTime() : undefined,
            end_date: formEndDate ? new Date(formEndDate).getTime() : undefined,
            url: formUrl || undefined,
            github_url: formGithubUrl || undefined,
            description: formDescription || undefined,
            technologies: formTechnologies,
          },
        });
        toast({
          title: 'Project updated',
          description: 'Your changes have been saved',
          variant: 'success',
        });
      } else {
        // Create new project
        await createProjectMutation({
          clerkId: clerkUser.id,
          title: formTitle,
          role: formRole || undefined,
          type: formType,
          company: formCompany || undefined,
          start_date: formStartDate ? new Date(formStartDate).getTime() : undefined,
          end_date: formEndDate ? new Date(formEndDate).getTime() : undefined,
          url: formUrl || undefined,
          github_url: formGithubUrl || undefined,
          description: formDescription || undefined,
          technologies: formTechnologies,
        });
        toast({
          title: 'Project added',
          description: 'New project has been added to your profile',
          variant: 'success',
        });
      }

      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Failed to save project:', error);
      toast({
        title: 'Save failed',
        description: 'Failed to save project. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = async (id: Id<'projects'>) => {
    if (!clerkUser?.id) return;

    try {
      await deleteProjectMutation({
        clerkId: clerkUser.id,
        projectId: id,
      });
      toast({
        title: 'Project deleted',
        description: 'The project has been removed',
        variant: 'success',
      });
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Failed to delete project:', error);
      toast({
        title: 'Delete failed',
        description: 'Failed to delete project. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const formatDateRange = (startDate?: number, endDate?: number) => {
    if (!startDate) return '';
    const start = new Date(startDate).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
    const end = endDate
      ? new Date(endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : 'Present';
    return `${start} - ${end}`;
  };

  if (projects === undefined) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Projects List */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Projects</h3>
          <p className="text-sm text-muted-foreground">Showcase your projects and portfolio work</p>
        </div>

        {/* Add Button at Top */}
        <button
          onClick={openAddDialog}
          className="w-full border border-dashed border-slate-300 rounded-xl p-4 flex items-center justify-center hover:border-slate-400 hover:bg-slate-50 transition-colors"
          aria-label="Add new project"
        >
          <Plus className="h-5 w-5 text-slate-400" />
        </button>

        {projects && projects.length > 0 && (
          <div className="space-y-4">
            {projects.map((project) => (
              <div key={project._id} className="border border-slate-200 rounded-xl p-5 bg-white">
                <div className="flex gap-4">
                  {/* Project Icon */}
                  <div className="flex-shrink-0">
                    <div className="w-14 h-14 bg-slate-100 rounded-lg flex items-center justify-center">
                      <FolderKanban className="h-7 w-7 text-slate-400" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="font-semibold text-slate-900">{project.title}</h4>
                        {project.role && <p className="text-slate-600">{project.role}</p>}
                        {(project.start_date || project.end_date) && (
                          <p className="text-sm text-slate-500">
                            {formatDateRange(project.start_date, project.end_date)}
                          </p>
                        )}
                      </div>

                      {/* Actions Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label="Project actions"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(project as Project)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteConfirmId(project._id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Technologies */}
                    {project.technologies && project.technologies.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {project.technologies.map((tech, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-slate-100 rounded-md text-xs text-slate-600"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Description */}
                    {project.description && (
                      <div className="mt-3 text-sm text-slate-600 whitespace-pre-wrap line-clamp-3">
                        {project.description}
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProject ? 'Edit Project' : 'Add Project'}</DialogTitle>
            <DialogDescription>
              {editingProject
                ? 'Update your project details'
                : 'Add a new project to your portfolio'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Project Title *</Label>
              <Input
                id="title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g., E-commerce Platform"
                className="rounded-control"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">Your Role</Label>
                <Input
                  id="role"
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  placeholder="e.g., Lead Developer"
                  className="rounded-control"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Project Type</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger className="rounded-control">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Company / Organization (Optional)</Label>
              <Input
                id="company"
                value={formCompany}
                onChange={(e) => setFormCompany(e.target.value)}
                placeholder="e.g., Acme Corp"
                className="rounded-control"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  className="rounded-control"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  className="rounded-control"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">Project URL (Optional)</Label>
              <Input
                id="url"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="e.g., https://myproject.com"
                className="rounded-control"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="github_url">GitHub URL (Optional)</Label>
              <Input
                id="github_url"
                value={formGithubUrl}
                onChange={(e) => setFormGithubUrl(e.target.value)}
                placeholder="e.g., https://github.com/username/project"
                className="rounded-control"
              />
            </div>

            <div className="space-y-2">
              <Label>Technologies Used</Label>
              <div className="flex gap-2">
                <Input
                  value={formTechInput}
                  onChange={(e) => setFormTechInput(e.target.value)}
                  placeholder="e.g., React, Node.js"
                  className="rounded-control"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTechnology();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addTechnology}
                  className="rounded-control"
                >
                  Add
                </Button>
              </div>
              {formTechnologies.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formTechnologies.map((tech, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-sm"
                    >
                      {tech}
                      <button
                        type="button"
                        onClick={() => removeTechnology(index)}
                        className="text-slate-500 hover:text-slate-700"
                        aria-label={`Remove ${tech}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Describe the project, your contributions, and key achievements..."
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
              onClick={handleSaveProject}
              disabled={!formTitle || isSaving}
              className="rounded-control bg-[#5371FF] hover:bg-[#4361EE] text-white"
            >
              {isSaving ? 'Saving...' : editingProject ? 'Save Changes' : 'Add Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this project? This action cannot be undone.
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
              onClick={() => deleteConfirmId && handleDeleteProject(deleteConfirmId)}
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

ProjectsSection.displayName = 'ProjectsSection';
