'use client';

import { useUser } from '@clerk/nextjs';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import {
  Award,
  Briefcase,
  Calendar,
  Camera,
  CheckCircle2,
  Circle,
  Edit,
  ExternalLink,
  FileText,
  FolderGit2,
  Github,
  Globe,
  GraduationCap,
  Image as ImageIcon,
  Linkedin,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Target,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { UpgradeModal } from '@/components/modals/UpgradeModal';
import { ProjectPreviewModal } from '@/components/project-preview-modal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { useToast } from '@/hooks/use-toast';

// Career Profile Form Schema
const careerProfileSchema = z.object({
  bio: z.string().max(500, 'Bio must be 500 characters or less').optional(),
  email: z.string().email('Please enter a valid email').optional().or(z.literal('')),
  phone_number: z.string().optional(),
  city: z.string().optional(),
  linkedin_url: z.string().url('Please enter a valid LinkedIn URL').optional().or(z.literal('')),
  major: z.string().optional(),
  university_name: z.string().optional(),
  graduation_year: z.string().optional(),
  current_position: z.string().optional(),
  current_company: z.string().optional(),
  experience_level: z.string().optional(),
  industry: z.string().optional(),
  skills: z.string().optional(),
  career_goals: z.string().max(1000, 'Career goals must be 1000 characters or less').optional(),
});

type CareerProfileFormValues = z.infer<typeof careerProfileSchema>;

interface Project {
  _id: string;
  title: string;
  description?: string;
  technologies: string[];
  url?: string;
  github_url?: string;
  image_url?: string;
  role?: string;
  start_date?: number;
  end_date?: number;
  company?: string;
  type?: string;
}

export function CareerProfileContent() {
  const searchParams = useSearchParams();
  const viewingUserId = searchParams.get('userId');

  const { user: clerkUser } = useUser();
  const { user: userProfile, isAdmin, hasPremium } = useAuth();
  const { toast } = useToast();
  const updateUser = useMutation(api.users.updateUser);

  // Project mutations
  const createProjectMutation = useMutation(api.projects.createProject);
  const updateProjectMutation = useMutation(api.projects.updateProject);
  const deleteProjectMutation = useMutation(api.projects.deleteProject);
  const generateProjectImageUploadUrl = useMutation(api.projects.generateProjectImageUploadUrl);
  const updateProjectImage = useMutation(api.projects.updateProjectImage);

  const isFreeUser = !hasPremium;

  // Determine which user we're viewing
  const targetUserId = viewingUserId || clerkUser?.id;
  const isViewingOwnProfile = !viewingUserId || viewingUserId === clerkUser?.id;

  // Query the target user's data
  const targetUserProfile = useQuery(
    api.users.getUserByClerkId,
    viewingUserId ? { clerkId: viewingUserId } : 'skip',
  );

  // Use target user's data or fallback to current user
  const displayProfile = viewingUserId ? targetUserProfile : userProfile;

  // Check if current user can view this profile
  const canView = isViewingOwnProfile || isAdmin || userProfile?.role === 'university_admin';

  // Queries for user data
  const goals = useQuery(api.goals.getUserGoals, targetUserId ? { clerkId: targetUserId } : 'skip');
  const applications = useQuery(
    api.applications.getUserApplications,
    targetUserId ? { clerkId: targetUserId } : 'skip',
  );
  const contacts = useQuery(
    api.contacts.getUserContacts,
    targetUserId ? { clerkId: targetUserId } : 'skip',
  );
  const projects = useQuery(
    api.projects.getUserProjects,
    targetUserId ? { clerkId: targetUserId } : 'skip',
  );

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);

  // Work History Management
  const [isAddingWorkHistory, setIsAddingWorkHistory] = useState(false);
  const [editingWorkHistoryId, setEditingWorkHistoryId] = useState<string | null>(null);
  const [workHistoryForm, setWorkHistoryForm] = useState({
    role: '',
    company: '',
    location: '',
    start_date: '',
    end_date: '',
    is_current: false,
    summary: '',
  });

  // Achievements Management
  const [isAddingAchievement, setIsAddingAchievement] = useState(false);
  const [editingAchievementId, setEditingAchievementId] = useState<string | null>(null);
  const [achievementForm, setAchievementForm] = useState({
    title: '',
    organization: '',
    date: '',
    description: '',
  });

  // Projects Management
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [previewProject, setPreviewProject] = useState<Project | null>(null);
  const [projectFormData, setProjectFormData] = useState({
    title: '',
    description: '',
    technologies: '',
    github_url: '',
    url: '',
    role: '',
    company: '',
    start_date: '',
    end_date: '',
    image_url: '', // Legacy field for display preview during form editing
    type: 'personal',
  });
  // Store the actual file for new projects (uploaded on save)
  const [pendingProjectImageFile, setPendingProjectImageFile] = useState<File | null>(null);

  // Avatar mutations
  const generateAvatarUploadUrl = useMutation(api.avatar.generateAvatarUploadUrl);
  const updateUserAvatar = useMutation(api.avatar.updateUserAvatar);

  // Career profile form
  const profileForm = useForm<CareerProfileFormValues>({
    resolver: zodResolver(careerProfileSchema),
    defaultValues: {
      bio: displayProfile?.bio || '',
      email: displayProfile?.email || '',
      phone_number: displayProfile?.phone_number || '',
      city: displayProfile?.city || '',
      linkedin_url: displayProfile?.linkedin_url || '',
      major: displayProfile?.major || '',
      university_name: displayProfile?.university_name || '',
      graduation_year: displayProfile?.graduation_year || '',
      current_position: displayProfile?.current_position || '',
      current_company: displayProfile?.current_company || '',
      experience_level: displayProfile?.experience_level || '',
      industry: displayProfile?.industry || '',
      skills: displayProfile?.skills || '',
      career_goals: displayProfile?.career_goals || '',
    },
  });

  // Reset form when displayProfile changes or dialog opens
  React.useEffect(() => {
    if (displayProfile && isEditingProfile) {
      profileForm.reset({
        bio: displayProfile.bio || '',
        email: displayProfile.email || '',
        phone_number: displayProfile.phone_number || '',
        city: displayProfile.city || '',
        linkedin_url: displayProfile.linkedin_url || '',
        major: displayProfile.major || '',
        university_name: displayProfile.university_name || '',
        graduation_year: displayProfile.graduation_year || '',
        current_position: displayProfile.current_position || '',
        current_company: displayProfile.current_company || '',
        experience_level: displayProfile.experience_level || '',
        industry: displayProfile.industry || '',
        skills: displayProfile.skills || '',
        career_goals: displayProfile.career_goals || '',
      });
    }
  }, [displayProfile, isEditingProfile, profileForm]);

  // Calculate profile completion
  const calculateProfileCompletion = () => {
    const sections = [
      !!displayProfile?.bio,
      !!displayProfile?.linkedin_url,
      Array.isArray((displayProfile as any)?.work_history) &&
        (displayProfile as any).work_history.length > 0,
      (Array.isArray((displayProfile as any)?.education_history) &&
        (displayProfile as any).education_history.length > 0) ||
        !!displayProfile?.major ||
        !!displayProfile?.university_name,
      !!displayProfile?.skills,
    ];
    const completed = sections.filter(Boolean).length;
    return Math.round((completed / sections.length) * 100);
  };

  const handleProfileUpdate = async (data: CareerProfileFormValues) => {
    if (!isViewingOwnProfile) {
      toast({
        title: 'Unauthorized',
        description: "Cannot modify another user's profile",
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      if (!clerkUser) throw new Error('No user found');

      // Use undefined check instead of truthiness to allow clearing fields with empty strings
      const updates: any = {};
      if (data.bio !== undefined) updates.bio = data.bio;
      if (data.email !== undefined) updates.email = data.email;
      if (data.phone_number !== undefined) updates.phone_number = data.phone_number;
      if (data.city !== undefined) updates.city = data.city;
      if (data.linkedin_url !== undefined) updates.linkedin_url = data.linkedin_url;
      if (data.major !== undefined) updates.major = data.major;
      if (data.university_name !== undefined) updates.university_name = data.university_name;
      if (data.graduation_year !== undefined) updates.graduation_year = data.graduation_year;
      if (data.current_position !== undefined) updates.current_position = data.current_position;
      if (data.current_company !== undefined) updates.current_company = data.current_company;
      if (data.experience_level !== undefined) updates.experience_level = data.experience_level;
      if (data.industry !== undefined) updates.industry = data.industry;
      if (data.skills !== undefined) updates.skills = data.skills;
      if (data.career_goals !== undefined) updates.career_goals = data.career_goals;

      await updateUser({
        clerkId: clerkUser.id,
        updates,
      });

      profileForm.reset({
        bio: data.bio ?? displayProfile?.bio ?? '',
        email: data.email ?? displayProfile?.email ?? '',
        phone_number: data.phone_number ?? displayProfile?.phone_number ?? '',
        city: data.city ?? displayProfile?.city ?? '',
        linkedin_url: data.linkedin_url ?? displayProfile?.linkedin_url ?? '',
        major: data.major ?? displayProfile?.major ?? '',
        university_name: data.university_name ?? displayProfile?.university_name ?? '',
        graduation_year: data.graduation_year ?? displayProfile?.graduation_year ?? '',
        current_position: data.current_position ?? displayProfile?.current_position ?? '',
        current_company: data.current_company ?? displayProfile?.current_company ?? '',
        experience_level: data.experience_level ?? displayProfile?.experience_level ?? '',
        industry: data.industry ?? displayProfile?.industry ?? '',
        skills: data.skills ?? displayProfile?.skills ?? '',
        career_goals: data.career_goals ?? displayProfile?.career_goals ?? '',
      });

      toast({
        title: 'Profile updated',
        description: 'Your career profile has been updated successfully.',
        variant: 'success',
      });
      setIsEditingProfile(false);
    } catch (error: any) {
      console.error('Profile update error:', error);
      const errorMessage = error?.message || 'Failed to update profile. Please try again.';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (file: File, type: 'avatar' | 'cover') => {
    if (!isViewingOwnProfile) {
      toast({
        title: 'Unauthorized',
        description: "Cannot modify another user's profile",
        variant: 'destructive',
      });
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 5MB',
        variant: 'destructive',
      });
      return;
    }

    try {
      const uploadUrl = await generateAvatarUploadUrl();
      const uploadResult = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadResult.ok) throw new Error('Failed to upload image');

      const { storageId } = await uploadResult.json();

      if (clerkUser?.id) {
        if (type === 'avatar') {
          await updateUserAvatar({
            clerkId: clerkUser.id,
            storageId,
          });
          toast({
            title: 'Profile picture updated',
            description: 'Your profile picture has been updated successfully',
          });
        } else {
          await updateUser({
            clerkId: clerkUser.id,
            updates: { cover_image: storageId },
          });
          toast({
            title: 'Cover image updated',
            description: 'Your cover image has been updated successfully',
          });
        }
      }
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: 'Failed to upload image. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Work History Management Functions
  const handleAddWorkHistory = async () => {
    if (!clerkUser || !isViewingOwnProfile || !workHistoryForm.role || !workHistoryForm.company) {
      toast({
        title: !isViewingOwnProfile ? 'Unauthorized' : 'Missing fields',
        description: !isViewingOwnProfile
          ? "Cannot modify another user's profile"
          : 'Please fill in role and company',
        variant: 'destructive',
      });
      return;
    }

    try {
      const currentWorkHistory = userProfile?.work_history || [];
      const newWorkHistory = {
        id: Date.now().toString(),
        role: workHistoryForm.role,
        company: workHistoryForm.company,
        location: workHistoryForm.location || undefined,
        start_date: workHistoryForm.start_date || undefined,
        end_date: workHistoryForm.is_current ? undefined : workHistoryForm.end_date || undefined,
        is_current: workHistoryForm.is_current,
        summary: workHistoryForm.summary || undefined,
      };

      await updateUser({
        clerkId: clerkUser.id,
        updates: {
          work_history: [...currentWorkHistory, newWorkHistory],
        },
      });

      toast({
        title: 'Work experience added',
        description: 'Your work history has been updated',
      });

      setWorkHistoryForm({
        role: '',
        company: '',
        location: '',
        start_date: '',
        end_date: '',
        is_current: false,
        summary: '',
      });
      setIsAddingWorkHistory(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add work history',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateWorkHistory = async () => {
    if (!isViewingOwnProfile) {
      toast({
        title: 'Unauthorized',
        description: "Cannot modify another user's profile",
        variant: 'destructive',
      });
      return;
    }

    if (!clerkUser || !editingWorkHistoryId) return;

    try {
      const currentWorkHistory = userProfile?.work_history || [];
      const updatedWorkHistory = currentWorkHistory.map((item) =>
        item.id === editingWorkHistoryId
          ? {
              ...item,
              role: workHistoryForm.role,
              company: workHistoryForm.company,
              location: workHistoryForm.location || undefined,
              start_date: workHistoryForm.start_date || undefined,
              end_date: workHistoryForm.is_current
                ? undefined
                : workHistoryForm.end_date || undefined,
              is_current: workHistoryForm.is_current,
              summary: workHistoryForm.summary || undefined,
            }
          : item,
      );

      await updateUser({
        clerkId: clerkUser.id,
        updates: {
          work_history: updatedWorkHistory,
        },
      });

      toast({
        title: 'Work experience updated',
        description: 'Your work history has been updated',
      });

      setWorkHistoryForm({
        role: '',
        company: '',
        location: '',
        start_date: '',
        end_date: '',
        is_current: false,
        summary: '',
      });
      setEditingWorkHistoryId(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update work history',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteWorkHistory = async (id: string) => {
    if (!isViewingOwnProfile) {
      toast({
        title: 'Unauthorized',
        description: "Cannot modify another user's profile",
        variant: 'destructive',
      });
      return;
    }

    if (!clerkUser) return;

    try {
      const currentWorkHistory = userProfile?.work_history || [];
      const updatedWorkHistory = currentWorkHistory.filter((item) => item.id !== id);

      await updateUser({
        clerkId: clerkUser.id,
        updates: {
          work_history: updatedWorkHistory,
        },
      });

      toast({
        title: 'Work experience deleted',
        description: 'Your work history has been updated',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete work history',
        variant: 'destructive',
      });
    }
  };

  const handleEditWorkHistory = (item: any) => {
    setWorkHistoryForm({
      role: item.role || '',
      company: item.company || '',
      location: item.location || '',
      start_date: item.start_date || '',
      end_date: item.end_date || '',
      is_current: item.is_current || false,
      summary: item.summary || '',
    });
    setEditingWorkHistoryId(item.id);
  };

  // Achievements Management Functions
  const handleAddAchievement = async () => {
    if (!clerkUser || !isViewingOwnProfile || !achievementForm.title) {
      toast({
        title: !isViewingOwnProfile ? 'Unauthorized' : 'Missing fields',
        description: !isViewingOwnProfile
          ? "Cannot modify another user's profile"
          : 'Please fill in the achievement title',
        variant: 'destructive',
      });
      return;
    }

    try {
      const currentAchievements = (userProfile as any)?.achievements_history || [];
      const newAchievement = {
        id: Date.now().toString(),
        title: achievementForm.title,
        organization: achievementForm.organization || undefined,
        date: achievementForm.date || undefined,
        description: achievementForm.description || undefined,
      };

      await updateUser({
        clerkId: clerkUser.id,
        updates: {
          achievements_history: [...currentAchievements, newAchievement],
        },
      });

      toast({
        title: 'Achievement added',
        description: 'Your achievement has been added successfully',
      });

      setAchievementForm({
        title: '',
        organization: '',
        date: '',
        description: '',
      });
      setIsAddingAchievement(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add achievement',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateAchievement = async () => {
    if (!isViewingOwnProfile) {
      toast({
        title: 'Unauthorized',
        description: "Cannot modify another user's profile",
        variant: 'destructive',
      });
      return;
    }

    if (!clerkUser || !editingAchievementId) return;

    try {
      const currentAchievements = (userProfile as any)?.achievements_history || [];
      const updatedAchievements = currentAchievements.map((item: any) =>
        item.id === editingAchievementId
          ? {
              ...item,
              title: achievementForm.title,
              organization: achievementForm.organization || undefined,
              date: achievementForm.date || undefined,
              description: achievementForm.description || undefined,
            }
          : item,
      );

      await updateUser({
        clerkId: clerkUser.id,
        updates: {
          achievements_history: updatedAchievements,
        },
      });

      toast({
        title: 'Achievement updated',
        description: 'Your achievement has been updated successfully',
      });

      setAchievementForm({
        title: '',
        organization: '',
        date: '',
        description: '',
      });
      setEditingAchievementId(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update achievement',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteAchievement = async (id: string) => {
    if (!isViewingOwnProfile) {
      toast({
        title: 'Unauthorized',
        description: "Cannot modify another user's profile",
        variant: 'destructive',
      });
      return;
    }

    if (!clerkUser) return;

    try {
      const currentAchievements = (userProfile as any)?.achievements_history || [];
      const updatedAchievements = currentAchievements.filter((item: any) => item.id !== id);

      await updateUser({
        clerkId: clerkUser.id,
        updates: {
          achievements_history: updatedAchievements,
        },
      });

      toast({
        title: 'Achievement deleted',
        description: 'Your achievement has been removed',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete achievement',
        variant: 'destructive',
      });
    }
  };

  const handleEditAchievement = (item: any) => {
    setAchievementForm({
      title: item.title || '',
      organization: item.organization || '',
      date: item.date || '',
      description: item.description || '',
    });
    setEditingAchievementId(item.id);
  };

  // Project Management Functions
  const resetProjectForm = () => {
    setProjectFormData({
      title: '',
      description: '',
      technologies: '',
      github_url: '',
      url: '',
      role: '',
      company: '',
      start_date: '',
      end_date: '',
      image_url: '',
      type: 'personal',
    });
    setPendingProjectImageFile(null);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clerkUser?.id || !isViewingOwnProfile) return;

    try {
      // If there's a pending image file, upload to storage first
      let imageStorageId: Id<'_storage'> | undefined;
      if (pendingProjectImageFile) {
        const uploadUrl = await generateProjectImageUploadUrl();
        const uploadResult = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': pendingProjectImageFile.type },
          body: pendingProjectImageFile,
        });

        if (!uploadResult.ok) throw new Error('Failed to upload image');

        const { storageId } = await uploadResult.json();
        imageStorageId = storageId as Id<'_storage'>;
      }

      await createProjectMutation({
        clerkId: clerkUser.id,
        title: projectFormData.title,
        description: projectFormData.description || undefined,
        technologies: projectFormData.technologies
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        type: projectFormData.type as 'personal' | 'professional',
        url: projectFormData.url || undefined,
        github_url: projectFormData.github_url || undefined,
        role: projectFormData.role || undefined,
        company: projectFormData.company || undefined,
        // Use storage ID if available, otherwise don't include legacy base64
        image_storage_id: imageStorageId,
        start_date: projectFormData.start_date
          ? new Date(projectFormData.start_date).getTime()
          : undefined,
        end_date: projectFormData.end_date
          ? new Date(projectFormData.end_date).getTime()
          : undefined,
      });

      toast({
        title: 'Project created',
        description: 'Your project has been added successfully.',
        variant: 'success',
      });
      setShowProjectForm(false);
      resetProjectForm();
      setPendingProjectImageFile(null);
    } catch (error: any) {
      if (error?.message?.includes('Free plan limit reached')) {
        setShowProjectForm(false);
        setShowUpgradeModal(true);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to create project. Please try again.',
          variant: 'destructive',
        });
      }
    }
  };

  const startEditProject = (project: Project) => {
    setEditingProject(project);
    setProjectFormData({
      title: project.title,
      description: project.description || '',
      technologies: project.technologies.join(', '),
      github_url: project.github_url || '',
      url: project.url || '',
      role: project.role || '',
      company: project.company || '',
      start_date: project.start_date
        ? new Date(project.start_date).toISOString().split('T')[0]
        : '',
      end_date: project.end_date ? new Date(project.end_date).toISOString().split('T')[0] : '',
      image_url: project.image_url || '',
      type: project.type || 'personal',
    });
  };

  const handleEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clerkUser?.id || !editingProject || !isViewingOwnProfile) return;

    try {
      await updateProjectMutation({
        clerkId: clerkUser.id,
        projectId: editingProject._id as any,
        updates: {
          title: projectFormData.title,
          description: projectFormData.description || undefined,
          technologies: projectFormData.technologies
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          url: projectFormData.url || undefined,
          github_url: projectFormData.github_url || undefined,
          role: projectFormData.role || undefined,
          company: projectFormData.company || undefined,
          start_date: projectFormData.start_date
            ? new Date(projectFormData.start_date).getTime()
            : undefined,
          end_date: projectFormData.end_date
            ? new Date(projectFormData.end_date).getTime()
            : undefined,
        },
      });

      toast({
        title: 'Project updated',
        description: 'Your project has been updated successfully.',
        variant: 'success',
      });
      setEditingProject(null);
      resetProjectForm();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update project. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteProject = async () => {
    if (!clerkUser?.id || !deleteProjectId || !isViewingOwnProfile) return;

    try {
      await deleteProjectMutation({
        clerkId: clerkUser.id,
        projectId: deleteProjectId as any,
      });

      toast({
        title: 'Project deleted',
        description: 'Your project has been deleted successfully.',
        variant: 'success',
      });
      setDeleteProjectId(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete project. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleProjectImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    projectId?: string,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !clerkUser?.id) return;

    if (projectId) {
      // Existing project: Upload to Convex storage immediately
      try {
        const uploadUrl = await generateProjectImageUploadUrl();
        const uploadResult = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
        });

        if (!uploadResult.ok) throw new Error('Failed to upload image');

        const { storageId } = await uploadResult.json();

        await updateProjectImage({
          clerkId: clerkUser.id,
          projectId: projectId as any,
          storageId,
        });

        toast({ title: 'Image uploaded', variant: 'success' });
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to upload image.',
          variant: 'destructive',
        });
      }
    } else {
      // New project: Store file for later upload, show preview
      setPendingProjectImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        const previewUrl = reader.result as string;
        setProjectFormData({ ...projectFormData, image_url: previewUrl });
      };
      reader.readAsDataURL(file);
    }
  };

  const formatProjectDate = (timestamp?: number) => {
    if (!timestamp) return null;
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  };

  if (!clerkUser || !userProfile) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!canView) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Unauthorized</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">You do not have permission to view this profile.</p>
        </CardContent>
      </Card>
    );
  }

  if (!displayProfile) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const profileCompletion = calculateProfileCompletion();
  const completedSections = {
    careerSummary: !!displayProfile?.bio,
    linkedinProfile: !!displayProfile?.linkedin_url,
    workHistory:
      Array.isArray((displayProfile as any)?.work_history) &&
      (displayProfile as any).work_history.length > 0,
    education:
      (Array.isArray((displayProfile as any)?.education_history) &&
        (displayProfile as any).education_history.length > 0) ||
      !!displayProfile?.major ||
      !!displayProfile?.university_name,
    skills: !!displayProfile?.skills,
  };

  return (
    <div className="space-y-6">
      {/* Cover Image */}
      <div className="relative h-48 bg-gradient-to-r from-[#0C29AB] to-[#1e40af] rounded-lg">
        {displayProfile?.cover_image && (
          <Image
            src={displayProfile.cover_image}
            alt="Cover"
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 1536px, 1536px"
            priority
            className="object-cover rounded-lg"
          />
        )}
        {isViewingOwnProfile && (
          <input
            type="file"
            id="cover-upload"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file, 'cover');
            }}
          />
        )}
        {isViewingOwnProfile && (
          <Button
            variant="secondary"
            size="sm"
            className="absolute bottom-4 right-4"
            onClick={() => document.getElementById('cover-upload')?.click()}
          >
            <Camera className="h-4 w-4 mr-2" />
            Edit Cover
          </Button>
        )}
      </div>

      {/* Profile Header */}
      <Card className="-mt-16 relative">
        <CardContent className="pt-20 pb-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Profile Picture */}
            <div className="relative -mt-32">
              <Avatar className="w-32 h-32 ring-4 ring-primary-500 bg-white">
                <AvatarImage
                  src={profilePreview || displayProfile.profile_image || clerkUser?.imageUrl}
                  className="object-cover"
                />
                <AvatarFallback className="text-2xl">
                  {displayProfile.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {isViewingOwnProfile && (
                <>
                  <input
                    type="file"
                    id="profile-upload"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file, 'avatar');
                    }}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute bottom-0 right-0 rounded-full p-2"
                    onClick={() => document.getElementById('profile-upload')?.click()}
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>

            {/* Profile Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-[#0C29AB]">{displayProfile.name}</h1>
                  <p className="text-lg text-muted-foreground mt-1">
                    {displayProfile.current_position || displayProfile.major || 'Student'}
                    {displayProfile.current_company && ` at ${displayProfile.current_company}`}
                  </p>
                  {displayProfile.city && (
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {displayProfile.city}
                    </p>
                  )}
                </div>
                {isViewingOwnProfile && (
                  <Button onClick={() => setIsEditingProfile(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                )}
              </div>

              {/* Quick Links */}
              <div className="flex gap-3 mt-4 flex-wrap">
                {displayProfile.email && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`mailto:${displayProfile.email}`}>
                      <Mail className="h-4 w-4 mr-2" />
                      {displayProfile.email}
                    </a>
                  </Button>
                )}
                {displayProfile.phone_number && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`tel:${displayProfile.phone_number}`}>
                      <Phone className="h-4 w-4 mr-2" />
                      {displayProfile.phone_number}
                    </a>
                  </Button>
                )}
                {displayProfile.linkedin_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={displayProfile.linkedin_url} target="_blank" rel="noopener noreferrer">
                      <Linkedin className="h-4 w-4 mr-2" />
                      LinkedIn
                    </a>
                  </Button>
                )}
                {displayProfile.website && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={displayProfile.website} target="_blank" rel="noopener noreferrer">
                      <Globe className="h-4 w-4 mr-2" />
                      Website
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Completion */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Profile Completion
              </CardTitle>
              <CardDescription>
                Complete your career profile to maximize opportunities
              </CardDescription>
            </div>
            <div className="text-3xl font-bold text-[#0C29AB]">{profileCompletion}%</div>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={profileCompletion} className="mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(completedSections).map(([key, completed]) => (
              <div key={key} className="flex items-center gap-2">
                {completed ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="text-sm capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Activity Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Target className="h-8 w-8 mx-auto mb-2 text-[#0C29AB]" />
              <div className="text-3xl font-bold">{goals?.length || 0}</div>
              <div className="text-sm text-muted-foreground">Goals</div>
              <div className="text-xs text-muted-foreground mt-1">
                {goals?.filter((g) => g.status === 'active').length || 0} active
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <FileText className="h-8 w-8 mx-auto mb-2 text-[#0C29AB]" />
              <div className="text-3xl font-bold">{applications?.length || 0}</div>
              <div className="text-sm text-muted-foreground">Applications</div>
              <div className="text-xs text-muted-foreground mt-1">
                {applications?.filter((a) => a.status === 'applied').length || 0} in progress
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Users className="h-8 w-8 mx-auto mb-2 text-[#0C29AB]" />
              <div className="text-3xl font-bold">{contacts?.length || 0}</div>
              <div className="text-sm text-muted-foreground">Contacts</div>
              <div className="text-xs text-muted-foreground mt-1">
                {contacts?.filter((c) => c.relationship === 'Strong').length || 0} strong
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Briefcase className="h-8 w-8 mx-auto mb-2 text-[#0C29AB]" />
              <div className="text-3xl font-bold">{projects?.length || 0}</div>
              <div className="text-sm text-muted-foreground">Projects</div>
              <div className="text-xs text-muted-foreground mt-1">
                {projects?.length || 0} total
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Career Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Career Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {displayProfile.bio || 'No career summary added yet. Click Edit Profile to add one.'}
            </p>
          </CardContent>
        </Card>

        {/* LinkedIn Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Linkedin className="h-5 w-5" />
              LinkedIn Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            {displayProfile.linkedin_url ? (
              <a
                href={displayProfile.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#0C29AB] hover:underline break-all"
              >
                {displayProfile.linkedin_url}
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">
                No LinkedIn profile added yet. Click Edit Profile to add one.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Education */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Education
            </CardTitle>
          </CardHeader>
          <CardContent>
            {displayProfile.major || displayProfile.university_name ? (
              <div>
                {displayProfile.major && <p className="font-medium">{displayProfile.major}</p>}
                {displayProfile.university_name && (
                  <p className="text-sm text-muted-foreground">{displayProfile.university_name}</p>
                )}
                {displayProfile.graduation_year && (
                  <p className="text-sm text-muted-foreground">
                    Class of {displayProfile.graduation_year}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No education information added yet. Click Edit Profile to add.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Work History */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Work History
              </CardTitle>
              {isViewingOwnProfile && (
                <Button variant="outline" size="sm" onClick={() => setIsAddingWorkHistory(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Experience
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {displayProfile.work_history && displayProfile.work_history.length > 0 ? (
              <div className="space-y-6">
                {displayProfile.work_history.map((job, index) => (
                  <div key={job.id || index} className="border-b last:border-0 pb-4 last:pb-0">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-base">{job.role}</h3>
                        <p className="text-sm text-muted-foreground">{job.company}</p>
                        {job.location && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />
                            {job.location}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground mt-1">
                          {job.start_date || 'Start date not specified'} -{' '}
                          {job.is_current ? 'Present' : job.end_date || 'End date not specified'}
                        </p>
                        {job.summary && <p className="text-sm mt-2">{job.summary}</p>}
                      </div>
                      {isViewingOwnProfile && (
                        <div className="flex gap-2 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditWorkHistory(job)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteWorkHistory(job.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No work history added yet.{' '}
                {isViewingOwnProfile && "Click 'Add Experience' to add your work history."}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Skills */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Skills
            </CardTitle>
          </CardHeader>
          <CardContent>
            {displayProfile.skills ? (
              <div className="flex flex-wrap gap-2">
                {displayProfile.skills.split(',').map((skill, index) => (
                  <Badge key={index} variant="secondary">
                    {skill.trim()}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No skills added yet. Click Edit Profile to add your skills.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Career Goals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Career Goals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {displayProfile.career_goals ||
                'No career goals added yet. Click Edit Profile to add your goals.'}
            </p>
          </CardContent>
        </Card>

        {/* Awards & Achievements */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Awards & Achievements
              </CardTitle>
              {isViewingOwnProfile && (
                <Button variant="outline" size="sm" onClick={() => setIsAddingAchievement(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Achievement
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {(displayProfile as any).achievements_history &&
            (displayProfile as any).achievements_history.length > 0 ? (
              <div className="space-y-4">
                {(displayProfile as any).achievements_history.map(
                  (achievement: any, index: number) => (
                    <div
                      key={achievement.id || index}
                      className="border-b last:border-0 pb-4 last:pb-0"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold text-base">{achievement.title}</h3>
                          {achievement.organization && (
                            <p className="text-sm text-muted-foreground">
                              {achievement.organization}
                            </p>
                          )}
                          {achievement.date && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <Calendar className="h-3 w-3" />
                              {achievement.date}
                            </p>
                          )}
                          {achievement.description && (
                            <p className="text-sm mt-2">{achievement.description}</p>
                          )}
                        </div>
                        {isViewingOwnProfile && (
                          <div className="flex gap-2 ml-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditAchievement(achievement)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteAchievement(achievement.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No awards or achievements added yet.{' '}
                {isViewingOwnProfile && "Click 'Add Achievement' to showcase your accomplishments."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Projects Section - Full Width */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FolderGit2 className="h-5 w-5" />
              Projects
            </CardTitle>
            {isViewingOwnProfile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (isFreeUser && projects && (projects as Project[]).length >= 1) {
                    setShowUpgradeModal(true);
                    return;
                  }
                  setShowProjectForm(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Project
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {projects === undefined ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (projects as Project[]).length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <FolderGit2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                No projects yet.{' '}
                {isViewingOwnProfile && 'Click "Add Project" to showcase your work.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(projects as Project[]).map((project) => (
                <Card
                  key={project._id}
                  className="hover:shadow-lg transition-all overflow-hidden group cursor-pointer"
                  onClick={() => setPreviewProject(project)}
                >
                  <div className="relative w-full h-40 bg-[#f4f4f4] border-b border-[#eaeaea]">
                    {project.image_url ? (
                      <Image
                        src={project.image_url}
                        alt={project.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center">
                        <ImageIcon className="h-12 w-12 text-gray-300" />
                        <p className="text-xs text-[#888] mt-2">No image</p>
                      </div>
                    )}

                    <div className="absolute bottom-2 right-2">
                      <Badge
                        variant={project.type === 'professional' ? 'default' : 'secondary'}
                        className="bg-white/90 backdrop-blur-sm shadow-sm"
                      >
                        {project.type
                          ? project.type.charAt(0).toUpperCase() + project.type.slice(1)
                          : 'Personal'}
                      </Badge>
                    </div>

                    {isViewingOwnProfile && (
                      <div className="flex space-x-1 absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 bg-white/90 shadow-sm backdrop-blur-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditProject(project);
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-600 bg-white/90 shadow-sm backdrop-blur-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteProjectId(project._id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <h3 className="font-semibold text-base line-clamp-1">{project.title}</h3>

                    {(project.start_date || project.end_date) && (
                      <div className="text-xs text-neutral-500 mt-1">
                        {formatProjectDate(project.start_date)} -{' '}
                        {project.end_date ? formatProjectDate(project.end_date) : 'Present'}
                      </div>
                    )}

                    {project.role && (
                      <p className="text-xs text-muted-foreground mt-1">{project.role}</p>
                    )}

                    {project.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
                        {project.description}
                      </p>
                    )}

                    {project.technologies.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {project.technologies.slice(0, 3).map((tech, index) => (
                          <span
                            key={index}
                            className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-xs rounded"
                          >
                            {tech}
                          </span>
                        ))}
                        {project.technologies.length > 3 && (
                          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                            +{project.technologies.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 mt-3">
                      {project.url && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <a href={project.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Demo
                          </a>
                        </Button>
                      )}
                      {project.github_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <a href={project.github_url} target="_blank" rel="noopener noreferrer">
                            <Github className="h-3 w-3 mr-1" />
                            Code
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project Create/Edit Dialog */}
      <Dialog
        open={showProjectForm || !!editingProject}
        onOpenChange={(open) => {
          if (!open) {
            setShowProjectForm(false);
            setEditingProject(null);
            resetProjectForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProject ? 'Edit Project' : 'Add New Project'}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={editingProject ? handleEditProject : handleCreateProject}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="project-title">Project Title *</Label>
              <Input
                id="project-title"
                value={projectFormData.title}
                onChange={(e) => setProjectFormData({ ...projectFormData, title: e.target.value })}
                placeholder="My Awesome Project"
                required
              />
            </div>

            <div>
              <Label htmlFor="project-description">Description</Label>
              <Textarea
                id="project-description"
                value={projectFormData.description}
                onChange={(e) =>
                  setProjectFormData({ ...projectFormData, description: e.target.value })
                }
                placeholder="Describe your project, technologies used, and your contributions..."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="project-image">Project Image</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="project-image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleProjectImageUpload(e, editingProject?._id)}
                  className="flex-1"
                />
                {projectFormData.image_url && (
                  <div className="w-16 h-16 rounded border overflow-hidden flex-shrink-0 relative">
                    <Image
                      src={projectFormData.image_url}
                      alt="Preview"
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="project-type">Type</Label>
                <select
                  id="project-type"
                  value={projectFormData.type}
                  onChange={(e) => setProjectFormData({ ...projectFormData, type: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="personal">Personal</option>
                  <option value="professional">Professional</option>
                </select>
              </div>
              <div>
                <Label htmlFor="project-role">Your Role</Label>
                <Input
                  id="project-role"
                  value={projectFormData.role}
                  onChange={(e) => setProjectFormData({ ...projectFormData, role: e.target.value })}
                  placeholder="Full Stack Developer"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="project-company">Company/Organization</Label>
              <Input
                id="project-company"
                value={projectFormData.company}
                onChange={(e) =>
                  setProjectFormData({ ...projectFormData, company: e.target.value })
                }
                placeholder="Personal Project"
              />
            </div>

            <div>
              <Label htmlFor="project-technologies">Technologies (comma-separated)</Label>
              <Input
                id="project-technologies"
                value={projectFormData.technologies}
                onChange={(e) =>
                  setProjectFormData({ ...projectFormData, technologies: e.target.value })
                }
                placeholder="React, Node.js, MongoDB"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="project-github-url">GitHub URL</Label>
                <Input
                  id="project-github-url"
                  type="url"
                  value={projectFormData.github_url}
                  onChange={(e) =>
                    setProjectFormData({ ...projectFormData, github_url: e.target.value })
                  }
                  placeholder="https://github.com/username/project"
                />
              </div>
              <div>
                <Label htmlFor="project-url">Live Demo URL</Label>
                <Input
                  id="project-url"
                  type="url"
                  value={projectFormData.url}
                  onChange={(e) => setProjectFormData({ ...projectFormData, url: e.target.value })}
                  placeholder="https://myproject.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="project-start-date">Start Date</Label>
                <Input
                  id="project-start-date"
                  type="date"
                  value={projectFormData.start_date}
                  onChange={(e) =>
                    setProjectFormData({ ...projectFormData, start_date: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="project-end-date">End Date</Label>
                <Input
                  id="project-end-date"
                  type="date"
                  value={projectFormData.end_date}
                  onChange={(e) =>
                    setProjectFormData({ ...projectFormData, end_date: e.target.value })
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowProjectForm(false);
                  setEditingProject(null);
                  resetProjectForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit">{editingProject ? 'Save Changes' : 'Create Project'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Project Delete Confirmation */}
      <AlertDialog
        open={!!deleteProjectId}
        onOpenChange={(open) => !open && setDeleteProjectId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this project? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Project Preview Modal */}
      {previewProject && (
        <ProjectPreviewModal
          open={!!previewProject}
          onClose={() => setPreviewProject(null)}
          project={previewProject}
        />
      )}

      {/* Upgrade Modal for Free User Limits */}
      <UpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} feature="project" />

      {/* Edit Profile Dialog */}
      <Dialog open={isEditingProfile} onOpenChange={setIsEditingProfile}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Career Profile</DialogTitle>
            <DialogDescription>
              Update your career information to help advisors better assist you
            </DialogDescription>
          </DialogHeader>
          <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(handleProfileUpdate)} className="space-y-4">
              <FormField
                control={profileForm.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Career Summary</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Brief professional summary..."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      A brief summary of your professional background and aspirations
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={profileForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="your@email.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={profileForm.control}
                  name="phone_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="(555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={profileForm.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="San Francisco, CA" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={profileForm.control}
                  name="linkedin_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>LinkedIn Profile URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://linkedin.com/in/yourprofile" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={profileForm.control}
                  name="major"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Major</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Computer Science" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={profileForm.control}
                  name="graduation_year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Graduation Year</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 2025" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={profileForm.control}
                name="university_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>University</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Stanford University" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={profileForm.control}
                  name="current_position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Position</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Software Engineer Intern" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={profileForm.control}
                  name="current_company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Company</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Google" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={profileForm.control}
                  name="experience_level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Experience Level</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Entry Level, Mid-Level" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={profileForm.control}
                  name="industry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Industry</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Technology, Finance" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={profileForm.control}
                name="skills"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Skills</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. JavaScript, Python, React (comma-separated)"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Enter your skills separated by commas</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={profileForm.control}
                name="career_goals"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Career Goals</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="What are your career aspirations?"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Share your short and long-term career objectives
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditingProfile(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Work History Dialog */}
      <Dialog
        open={isAddingWorkHistory || !!editingWorkHistoryId}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddingWorkHistory(false);
            setEditingWorkHistoryId(null);
            setWorkHistoryForm({
              role: '',
              company: '',
              location: '',
              start_date: '',
              end_date: '',
              is_current: false,
              summary: '',
            });
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingWorkHistoryId ? 'Edit Work Experience' : 'Add Work Experience'}
            </DialogTitle>
            <DialogDescription>Add details about your work experience</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Job Title *</label>
                <Input
                  placeholder="e.g. Software Engineer"
                  value={workHistoryForm.role}
                  onChange={(e) => setWorkHistoryForm({ ...workHistoryForm, role: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Company *</label>
                <Input
                  placeholder="e.g. Google"
                  value={workHistoryForm.company}
                  onChange={(e) =>
                    setWorkHistoryForm({ ...workHistoryForm, company: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Location</label>
              <Input
                placeholder="e.g. San Francisco, CA"
                value={workHistoryForm.location}
                onChange={(e) =>
                  setWorkHistoryForm({ ...workHistoryForm, location: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="month"
                  value={workHistoryForm.start_date}
                  onChange={(e) =>
                    setWorkHistoryForm({ ...workHistoryForm, start_date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="month"
                  value={workHistoryForm.end_date}
                  onChange={(e) =>
                    setWorkHistoryForm({ ...workHistoryForm, end_date: e.target.value })
                  }
                  disabled={workHistoryForm.is_current}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_current"
                checked={workHistoryForm.is_current}
                onChange={(e) =>
                  setWorkHistoryForm({ ...workHistoryForm, is_current: e.target.checked })
                }
                className="rounded border-gray-300"
              />
              <label htmlFor="is_current" className="text-sm font-medium">
                I currently work here
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Describe your responsibilities and achievements..."
                value={workHistoryForm.summary}
                onChange={(e) =>
                  setWorkHistoryForm({ ...workHistoryForm, summary: e.target.value })
                }
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddingWorkHistory(false);
                setEditingWorkHistoryId(null);
                setWorkHistoryForm({
                  role: '',
                  company: '',
                  location: '',
                  start_date: '',
                  end_date: '',
                  is_current: false,
                  summary: '',
                });
              }}
            >
              Cancel
            </Button>
            <Button onClick={editingWorkHistoryId ? handleUpdateWorkHistory : handleAddWorkHistory}>
              {editingWorkHistoryId ? 'Update' : 'Add'} Experience
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Achievement Dialog */}
      <Dialog
        open={isAddingAchievement || !!editingAchievementId}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddingAchievement(false);
            setEditingAchievementId(null);
            setAchievementForm({
              title: '',
              organization: '',
              date: '',
              description: '',
            });
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAchievementId ? 'Edit Achievement' : 'Add Achievement'}
            </DialogTitle>
            <DialogDescription>Add details about your award or achievement</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Achievement Title *</label>
              <Input
                placeholder="e.g. Dean's List, Employee of the Year"
                value={achievementForm.title}
                onChange={(e) => setAchievementForm({ ...achievementForm, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Organization</label>
              <Input
                placeholder="e.g. Stanford University, Company Name"
                value={achievementForm.organization}
                onChange={(e) =>
                  setAchievementForm({ ...achievementForm, organization: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <Input
                type="month"
                value={achievementForm.date}
                onChange={(e) => setAchievementForm({ ...achievementForm, date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Describe your achievement and its significance..."
                value={achievementForm.description}
                onChange={(e) =>
                  setAchievementForm({ ...achievementForm, description: e.target.value })
                }
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddingAchievement(false);
                setEditingAchievementId(null);
                setAchievementForm({
                  title: '',
                  organization: '',
                  date: '',
                  description: '',
                });
              }}
            >
              Cancel
            </Button>
            <Button onClick={editingAchievementId ? handleUpdateAchievement : handleAddAchievement}>
              {editingAchievementId ? 'Update' : 'Add'} Achievement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
