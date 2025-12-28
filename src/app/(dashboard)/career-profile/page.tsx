'use client';

import { useUser } from '@clerk/nextjs';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import {
  Award,
  Briefcase,
  Calendar,
  CheckCircle2,
  Edit,
  FolderKanban,
  GraduationCap,
  Linkedin,
  Loader2,
  Plus,
  Trash2,
  User,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';

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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
// Import UI components
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { useToast } from '@/hooks/use-toast';

// Career profile form schema
const educationEntrySchema = z.object({
  id: z.string(),
  school: z.string().optional(),
  degree: z.string().optional(),
  fieldOfStudy: z.string().optional(),
  startYear: z.string().optional(),
  endYear: z.string().optional(),
  isCurrent: z.boolean().optional(),
  description: z.string().optional(),
});

const workEntrySchema = z.object({
  id: z.string(),
  role: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isCurrent: z.boolean().optional(),
  summary: z.string().optional(),
});

const achievementEntrySchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  date: z.string().optional(),
  organization: z.string().optional(),
});

const careerProfileFormSchema = z.object({
  currentPosition: z.string().optional(),
  currentCompany: z.string().optional(),
  location: z.string().optional(),
  industry: z.string().optional(),
  experienceLevel: z.enum(['entry', 'mid', 'senior', 'executive']).optional(),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  linkedinUrl: z.string().url('Enter a valid URL').optional().or(z.literal('')),
  skills: z.string().optional(),
  education: z.array(educationEntrySchema),
  workHistory: z.array(workEntrySchema),
  achievements: z.array(achievementEntrySchema),
  careerGoals: z.string().max(300, 'Career goals must be less than 300 characters').optional(),
});

type CareerProfileFormValues = z.infer<typeof careerProfileFormSchema>;

const createEmptyEducationEntry = () => ({
  id: uuid(),
  school: '',
  degree: '',
  fieldOfStudy: '',
  startYear: '',
  endYear: '',
  isCurrent: false,
  description: '',
});

const createEmptyWorkEntry = () => ({
  id: uuid(),
  role: '',
  company: '',
  location: '',
  startDate: '',
  endDate: '',
  isCurrent: false,
  summary: '',
});

const createEmptyAchievementEntry = () => ({
  id: uuid(),
  title: '',
  description: '',
  date: '',
  organization: '',
});

const normalizeString = (value?: string | null) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const hasEducationContent = (entry: z.infer<typeof educationEntrySchema>) =>
  !!(
    normalizeString(entry.school) ||
    normalizeString(entry.degree) ||
    normalizeString(entry.fieldOfStudy) ||
    normalizeString(entry.startYear) ||
    normalizeString(entry.endYear) ||
    normalizeString(entry.description)
  );

const hasWorkContent = (entry: z.infer<typeof workEntrySchema>) =>
  !!(
    normalizeString(entry.role) ||
    normalizeString(entry.company) ||
    normalizeString(entry.location) ||
    normalizeString(entry.startDate) ||
    normalizeString(entry.endDate) ||
    normalizeString(entry.summary)
  );

const hasAchievementContent = (entry: z.infer<typeof achievementEntrySchema>) =>
  !!(
    normalizeString(entry.title) ||
    normalizeString(entry.description) ||
    normalizeString(entry.date) ||
    normalizeString(entry.organization)
  );

export default function CareerProfilePage() {
  const { user: clerkUser } = useUser();
  const { user: userProfile, subscription } = useAuth();
  const { toast } = useToast();
  const updateUser = useMutation(api.users.updateUser);

  // Fetch user projects
  const userProjects = useQuery(
    api.projects.getUserProjects,
    clerkUser?.id ? { clerkId: clerkUser.id } : 'skip',
  );

  // State for editing
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Career profile form
  const careerProfileForm = useForm<CareerProfileFormValues>({
    resolver: zodResolver(careerProfileFormSchema),
    defaultValues: {
      currentPosition: '',
      currentCompany: '',
      location: '',
      industry: '',
      experienceLevel: 'mid',
      bio: '',
      linkedinUrl: '',
      skills: '',
      education: [createEmptyEducationEntry()],
      workHistory: [createEmptyWorkEntry()],
      achievements: [createEmptyAchievementEntry()],
      careerGoals: '',
    },
  });

  const educationFieldArray = useFieldArray({
    control: careerProfileForm.control,
    name: 'education',
  });

  const workHistoryFieldArray = useFieldArray({
    control: careerProfileForm.control,
    name: 'workHistory',
  });

  const achievementsFieldArray = useFieldArray({
    control: careerProfileForm.control,
    name: 'achievements',
  });

  // Load user data into form when available
  useEffect(() => {
    if (userProfile) {
      const profile = userProfile as any;
      const educationEntries = Array.isArray(profile.education_history)
        ? profile.education_history.map((item: any) => ({
            id: item.id || uuid(),
            school: item.school || '',
            degree: item.degree || '',
            fieldOfStudy: item.field_of_study || '',
            startYear: item.start_year || '',
            endYear: item.end_year || '',
            isCurrent: !!item.is_current,
            description: item.description || '',
          }))
        : [];

      const workEntries = Array.isArray(profile.work_history)
        ? profile.work_history.map((item: any) => ({
            id: item.id || uuid(),
            role: item.role || '',
            company: item.company || '',
            location: item.location || '',
            startDate: item.start_date || '',
            endDate: item.end_date || '',
            isCurrent: !!item.is_current,
            summary: item.summary || '',
          }))
        : [];

      const achievementEntries = Array.isArray(profile.achievements_history)
        ? profile.achievements_history.map((item: any) => ({
            id: item.id || uuid(),
            title: item.title || '',
            description: item.description || '',
            date: item.date || '',
            organization: item.organization || '',
          }))
        : [];

      if (educationEntries.length === 0) {
        educationEntries.push(createEmptyEducationEntry());
      }

      if (workEntries.length === 0) {
        workEntries.push(createEmptyWorkEntry());
      }

      if (achievementEntries.length === 0) {
        achievementEntries.push(createEmptyAchievementEntry());
      }

      careerProfileForm.reset({
        currentPosition: profile.current_position || '',
        currentCompany: profile.current_company || '',
        location: profile.location || '',
        industry: profile.industry || '',
        experienceLevel:
          (profile.experience_level as 'entry' | 'mid' | 'senior' | 'executive') || 'mid',
        bio: profile.bio || '',
        linkedinUrl: profile.linkedin_url || '',
        skills: profile.skills || '',
        education: educationEntries,
        workHistory: workEntries,
        achievements: achievementEntries,
        careerGoals: profile.career_goals || '',
      });
    }
  }, [userProfile, careerProfileForm]);

  const handleProfileUpdate = async (data: CareerProfileFormValues) => {
    setIsLoading(true);
    try {
      if (!clerkUser) throw new Error('No user found');

      const educationUpdates = (data.education ?? [])
        .filter((entry) => hasEducationContent(entry))
        .map((entry) => ({
          id: entry.id || uuid(),
          school: normalizeString(entry.school),
          degree: normalizeString(entry.degree),
          field_of_study: normalizeString(entry.fieldOfStudy),
          start_year: normalizeString(entry.startYear),
          end_year: entry.isCurrent ? undefined : normalizeString(entry.endYear),
          is_current: !!entry.isCurrent,
          description: normalizeString(entry.description),
        }));

      const workUpdates = (data.workHistory ?? [])
        .filter((entry) => hasWorkContent(entry))
        .map((entry) => ({
          id: entry.id || uuid(),
          role: normalizeString(entry.role),
          company: normalizeString(entry.company),
          location: normalizeString(entry.location),
          start_date: normalizeString(entry.startDate),
          end_date: entry.isCurrent ? undefined : normalizeString(entry.endDate),
          is_current: !!entry.isCurrent,
          summary: normalizeString(entry.summary),
        }));

      const achievementUpdates = (data.achievements ?? [])
        .filter((entry) => hasAchievementContent(entry))
        .map((entry) => ({
          id: entry.id || uuid(),
          title: normalizeString(entry.title),
          description: normalizeString(entry.description),
          date: normalizeString(entry.date),
          organization: normalizeString(entry.organization),
        }));

      await updateUser({
        clerkId: clerkUser.id,
        updates: {
          current_position: normalizeString(data.currentPosition),
          current_company: normalizeString(data.currentCompany),
          location: normalizeString(data.location),
          industry: normalizeString(data.industry),
          experience_level: data.experienceLevel,
          bio: normalizeString(data.bio) || undefined,
          linkedin_url: normalizeString(data.linkedinUrl),
          skills: normalizeString(data.skills),
          education_history: educationUpdates.length > 0 ? educationUpdates : undefined,
          work_history: workUpdates.length > 0 ? workUpdates : undefined,
          achievements_history: achievementUpdates.length > 0 ? achievementUpdates : undefined,
          career_goals: normalizeString(data.careerGoals),
        } as any,
      });

      toast({
        title: 'Career Profile updated',
        description: 'Your career profile has been updated successfully.',
        variant: 'success',
      });
      setIsEditingProfile(false);
    } catch (error: any) {
      console.error('Profile update error:', error);
      toast({
        title: 'Error',
        description:
          error?.errors?.[0]?.message || 'Failed to update career profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!clerkUser || !userProfile) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Loading your career profile...</p>
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-4" />
        </div>
      </div>
    );
  }

  const educationHistory = Array.isArray((userProfile as any).education_history)
    ? (userProfile as any).education_history
    : [];
  const workHistory = Array.isArray((userProfile as any).work_history)
    ? (userProfile as any).work_history
    : [];
  const achievementsHistory = Array.isArray((userProfile as any).achievements_history)
    ? (userProfile as any).achievements_history
    : [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[#0C29AB]">Career Profile</h1>
        <p className="text-muted-foreground">
          Manage your professional profile and career information
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Career Details</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Profile Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Overview
              </CardTitle>
              <CardDescription>Your professional summary and key information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <p className="text-sm text-muted-foreground">{userProfile.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <p className="text-sm text-muted-foreground">{userProfile.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Current Position</label>
                  <p className="text-sm text-muted-foreground">
                    {(userProfile as any).current_position || 'Not specified'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Current Company</label>
                  <p className="text-sm text-muted-foreground">
                    {(userProfile as any).current_company || 'Not specified'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Location</label>
                  <p className="text-sm text-muted-foreground">
                    {(userProfile as any).location || 'Not specified'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Experience Level</label>
                  <Badge variant="secondary" className="capitalize">
                    {(userProfile as any).experience_level || 'Not specified'}
                  </Badge>
                </div>
                {(userProfile as any).linkedin_url && (
                  <div className="col-span-2">
                    <label className="text-sm font-medium">LinkedIn</label>
                    <a
                      href={(userProfile as any).linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline break-all inline-flex items-center gap-1"
                    >
                      <Linkedin className="h-4 w-4" />
                      {(userProfile as any).linkedin_url}
                    </a>
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setIsEditingProfile(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Career Profile
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Professional Bio */}
          {(userProfile as any).bio && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Professional Bio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {(userProfile as any).bio}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Skills */}
          {(userProfile as any).skills && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Skills & Expertise
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(userProfile as any).skills.split(',').map((skill: string, idx: number) => (
                    <Badge key={idx} variant="secondary">
                      {skill.trim()}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="details" className="space-y-6">
          {/* Education */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Education
              </CardTitle>
            </CardHeader>
            <CardContent>
              {educationHistory.length > 0 ? (
                <div className="space-y-4">
                  {educationHistory.map((entry: any, index: number) => {
                    const hasTimeline = entry.start_year || entry.end_year;
                    const timeline = hasTimeline
                      ? `${entry.start_year || 'Start'} – ${
                          entry.is_current ? 'Present' : entry.end_year || 'End'
                        }`
                      : null;
                    return (
                      <div
                        key={entry.id || `${entry.school || 'education'}-${index}`}
                        className="space-y-1 border-b pb-3 last:border-none last:pb-0"
                      >
                        <p className="font-medium">{entry.school || 'Education'}</p>
                        <div className="text-sm text-muted-foreground space-y-1">
                          {entry.degree && <p>{entry.degree}</p>}
                          {entry.field_of_study && <p>{entry.field_of_study}</p>}
                          {timeline && <p>{timeline}</p>}
                          {entry.description && (
                            <p className="text-sm leading-relaxed">{entry.description}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No education history added yet. Use the editor to document your studies or
                  training.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Work History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Work History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {workHistory.length > 0 ? (
                <div className="space-y-4">
                  {workHistory.map((entry: any, index: number) => {
                    const hasTimeline = entry.start_date || entry.end_date;
                    const timeline = hasTimeline
                      ? `${entry.start_date || 'Start'} – ${
                          entry.is_current ? 'Present' : entry.end_date || 'End'
                        }`
                      : null;
                    return (
                      <div
                        key={entry.id || `${entry.role || 'role'}-${index}`}
                        className="space-y-1 border-b pb-3 last:border-none last:pb-0"
                      >
                        <p className="font-medium">{entry.role || 'Role'}</p>
                        <div className="text-sm text-muted-foreground space-y-1">
                          {entry.company && <p>{entry.company}</p>}
                          {entry.location && <p>{entry.location}</p>}
                          {timeline && <p>{timeline}</p>}
                          {entry.summary && (
                            <p className="text-sm leading-relaxed">{entry.summary}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No work history recorded. Add roles, internships, or freelance projects to
                  showcase your experience.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Achievements */}
          {achievementsHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Achievements & Awards
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {achievementsHistory.map((entry: any, index: number) => (
                    <div
                      key={entry.id || `achievement-${index}`}
                      className="space-y-1 border-b pb-3 last:border-none last:pb-0"
                    >
                      <p className="font-medium">{entry.title || 'Achievement'}</p>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {entry.organization && <p>{entry.organization}</p>}
                        {entry.date && <p>{entry.date}</p>}
                        {entry.description && (
                          <p className="text-sm leading-relaxed">{entry.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Projects */}
          {userProjects && userProjects.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderKanban className="h-5 w-5" />
                  Projects
                </CardTitle>
                <CardDescription>
                  Projects from your portfolio{' '}
                  <a href="/projects" className="text-primary hover:underline">
                    (Manage in Projects)
                  </a>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {userProjects.map((project: any, index: number) => {
                    const startDate = project.start_date
                      ? new Date(project.start_date).toLocaleDateString('en-US', {
                          month: 'short',
                          year: 'numeric',
                        })
                      : null;
                    const endDate = project.end_date
                      ? new Date(project.end_date).toLocaleDateString('en-US', {
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'Present';
                    const timeline = startDate ? `${startDate} - ${endDate}` : null;

                    return (
                      <div
                        key={project._id || `project-${index}`}
                        className="space-y-2 border-b pb-4 last:border-none last:pb-0"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{project.title || 'Project'}</p>
                            {project.role && (
                              <p className="text-sm text-muted-foreground">{project.role}</p>
                            )}
                            {project.company && (
                              <p className="text-sm text-muted-foreground">{project.company}</p>
                            )}
                          </div>
                          {timeline && <p className="text-xs text-muted-foreground">{timeline}</p>}
                        </div>
                        {project.description && (
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {project.description}
                          </p>
                        )}
                        {project.technologies && project.technologies.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {project.technologies.map((tech: string, idx: number) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {tech}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {(project.url || project.github_url) && (
                          <div className="flex gap-3 text-xs">
                            {project.url && /^https?:\/\//i.test(project.url) && (
                              <a
                                href={project.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                View Project →
                              </a>
                            )}
                            {project.github_url && (
                              <a
                                href={project.github_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                GitHub →
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Career Goals */}
          {(userProfile as any).career_goals && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Career Goals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {(userProfile as any).career_goals}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Account Information
              </CardTitle>
              <CardDescription>Account creation and role information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Role</label>
                  <p className="text-sm text-muted-foreground capitalize">{userProfile.role}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Member Since</label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(userProfile.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Subscription Plan</label>
                  <p className="text-sm text-muted-foreground">{subscription.planName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Last Updated</label>
                  <p className="text-sm text-muted-foreground">
                    {userProfile.updated_at
                      ? new Date(userProfile.updated_at).toLocaleDateString()
                      : 'Never'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Career Profile Dialog */}
      <Dialog open={isEditingProfile} onOpenChange={setIsEditingProfile}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Career Profile</DialogTitle>
            <DialogDescription>
              Update your professional information and career details
            </DialogDescription>
          </DialogHeader>
          <Form {...careerProfileForm}>
            <form
              onSubmit={careerProfileForm.handleSubmit(handleProfileUpdate)}
              className="space-y-6"
            >
              <section className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Professional Overview</h3>
                  <p className="text-sm text-muted-foreground">
                    Share your current role, headline details, and a short summary that introduces
                    you.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={careerProfileForm.control}
                    name="currentPosition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Position</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Software Engineer" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={careerProfileForm.control}
                    name="currentCompany"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Company</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Acme Corp" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={careerProfileForm.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. San Francisco, CA" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={careerProfileForm.control}
                    name="industry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Industry</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Technology" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={careerProfileForm.control}
                  name="experienceLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Experience Level</FormLabel>
                      <FormControl>
                        <select {...field} className="w-full px-3 py-2 text-sm border rounded-md">
                          <option value="entry">Entry Level</option>
                          <option value="mid">Mid Level</option>
                          <option value="senior">Senior Level</option>
                          <option value="executive">Executive Level</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={careerProfileForm.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Career Summary</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Tell us about your professional background and experience..."
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Brief professional summary (max 500 characters)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={careerProfileForm.control}
                  name="linkedinUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>LinkedIn Profile</FormLabel>
                      <FormControl>
                        <Input placeholder="https://linkedin.com/in/yourprofile" {...field} />
                      </FormControl>
                      <FormDescription>
                        Paste the URL to your LinkedIn profile so advisors and employers can learn
                        more.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={careerProfileForm.control}
                  name="skills"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Skills & Expertise</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="List your key skills, technologies, and areas of expertise..."
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Separate skills with commas (e.g. JavaScript, SQL, stakeholder management)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={careerProfileForm.control}
                  name="careerGoals"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Career Goals</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What are your short-term and long-term career objectives?"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Your career aspirations and goals (max 300 characters)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </section>

              <Separator />

              <section className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Education</h3>
                  <p className="text-sm text-muted-foreground">
                    Capture your academic background, certifications, or training programs.
                  </p>
                </div>
                <div className="space-y-4">
                  {educationFieldArray.fields.map((field, index) => (
                    <div key={field.id} className="space-y-4 rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Education #{index + 1}</span>
                        {educationFieldArray.fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => educationFieldArray.remove(index)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Remove
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={careerProfileForm.control}
                          name={`education.${index}.school` as const}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>School or Program</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. Stanford University" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={careerProfileForm.control}
                          name={`education.${index}.degree` as const}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Degree / Credential</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. B.S. Computer Science" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={careerProfileForm.control}
                          name={`education.${index}.fieldOfStudy` as const}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Focus Area</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. Artificial Intelligence" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={careerProfileForm.control}
                            name={`education.${index}.startYear` as const}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Start Year</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g. 2022" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={careerProfileForm.control}
                            name={`education.${index}.endYear` as const}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Completion Year</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g. 2026" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                      <FormField
                        control={careerProfileForm.control}
                        name={`education.${index}.description` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Highlights</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Clubs, awards, or projects worth noting..."
                                rows={3}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={careerProfileForm.control}
                        name={`education.${index}.isCurrent` as const}
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value ?? false}
                                onCheckedChange={(checked) => field.onChange(!!checked)}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                              I am currently enrolled in this program
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => educationFieldArray.append(createEmptyEducationEntry())}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Education
                </Button>
              </section>

              <Separator />

              <section className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Work History</h3>
                  <p className="text-sm text-muted-foreground">
                    Document key roles, internships, or freelance engagements so mentors understand
                    your experience.
                  </p>
                </div>
                <div className="space-y-4">
                  {workHistoryFieldArray.fields.map((field, index) => (
                    <div key={field.id} className="space-y-4 rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Role #{index + 1}</span>
                        {workHistoryFieldArray.fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => workHistoryFieldArray.remove(index)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Remove
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={careerProfileForm.control}
                          name={`workHistory.${index}.role` as const}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Role / Title</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. Product Manager" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={careerProfileForm.control}
                          name={`workHistory.${index}.company` as const}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company / Organization</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. Dollar Bank" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={careerProfileForm.control}
                          name={`workHistory.${index}.location` as const}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Location</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. Remote, Pittsburgh, PA" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={careerProfileForm.control}
                            name={`workHistory.${index}.startDate` as const}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Start Date</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g. May 2023" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={careerProfileForm.control}
                            name={`workHistory.${index}.endDate` as const}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>End Date</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g. Aug 2024" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                      <FormField
                        control={careerProfileForm.control}
                        name={`workHistory.${index}.summary` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Impact Highlights</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Share accomplishments, scope of work, or tools used..."
                                rows={3}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={careerProfileForm.control}
                        name={`workHistory.${index}.isCurrent` as const}
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value ?? false}
                                onCheckedChange={(checked) => field.onChange(!!checked)}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                              I currently work in this role
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => workHistoryFieldArray.append(createEmptyWorkEntry())}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Role
                </Button>
              </section>

              <Separator />

              <section className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Achievements & Awards</h3>
                  <p className="text-sm text-muted-foreground">
                    Highlight certifications, awards, publications, or notable professional
                    accomplishments.
                  </p>
                </div>
                <div className="space-y-4">
                  {achievementsFieldArray.fields.map((field, index) => (
                    <div key={field.id} className="space-y-4 rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Achievement #{index + 1}</span>
                        {achievementsFieldArray.fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => achievementsFieldArray.remove(index)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Remove
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={careerProfileForm.control}
                          name={`achievements.${index}.title` as const}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Achievement Title</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. Employee of the Year" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={careerProfileForm.control}
                          name={`achievements.${index}.date` as const}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Date</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. 2024" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={careerProfileForm.control}
                        name={`achievements.${index}.organization` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Organization</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Google, IEEE, etc." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={careerProfileForm.control}
                        name={`achievements.${index}.description` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Brief description of the achievement..."
                                rows={2}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => achievementsFieldArray.append(createEmptyAchievementEntry())}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Achievement
                </Button>
              </section>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditingProfile(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
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
    </div>
  );
}
