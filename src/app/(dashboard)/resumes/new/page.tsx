'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { ArrowLeft, Loader2, Save, Upload as UploadIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

export default function NewResumePage() {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const { toast } = useToast();

  const userProfile = useQuery(
    api.users.getUserByClerkId,
    clerkUser?.id ? { clerkId: clerkUser.id } : 'skip',
  );

  const userProjects = useQuery(
    api.projects.getUserProjects,
    clerkUser?.id ? { clerkId: clerkUser.id } : 'skip',
  );

  const [title, setTitle] = useState('My Resume');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  // Initial resume template
  const [resumeContent, setResumeContent] = useState({
    contactInfo: {
      name: clerkUser?.fullName || '',
      email: clerkUser?.primaryEmailAddress?.emailAddress || '',
      phone: '',
      location: '',
      linkedin: '',
      github: '',
    },
    summary: '',
    skills: [] as any[],
    experience: [] as any[],
    education: [] as any[],
    projects: [] as any[],
    achievements: [] as any[],
  });

  const createResumeMutation = useMutation(api.resumes.createResume);

  const handleSave = async () => {
    if (!clerkUser?.id) {
      toast({
        title: 'Error',
        description: 'You must be logged in to create a resume',
        variant: 'destructive',
      });
      return;
    }

    if (!title.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a title for your resume',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const resumeId = await createResumeMutation({
        title: title.trim(),
        content: resumeContent,
        source: 'manual' as any,
        visibility: 'private' as any,
      });

      toast({
        title: 'Success',
        description: 'Resume created successfully!',
      });

      // Redirect to full-featured editor
      router.push(`/resumes/${resumeId}`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create resume',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateContactInfo = (field: string, value: string) => {
    setResumeContent((prev) => ({
      ...prev,
      contactInfo: {
        ...prev.contactInfo,
        [field]: value,
      },
    }));
  };

  const importFromProfile = async () => {
    if (userProfile === undefined) {
      toast({
        title: 'Loading...',
        description: 'Please wait while we load your profile',
        variant: 'default',
      });
      return;
    }

    if (!userProfile) {
      toast({
        title: 'Profile not found',
        description: 'Please complete your career profile first',
        variant: 'destructive',
      });
      return;
    }

    setImporting(true);
    try {
      // Debug logging
      console.log('Importing from profile:', {
        userProfile,
        workHistory: userProfile.work_history,
        educationHistory: userProfile.education_history,
        projects: userProjects,
      });

      // Map work history to experience
      const experience = (userProfile.work_history || []).map((job: any) => ({
        title: job.role || '',
        company: job.company || '',
        location: job.location || '',
        startDate: job.start_date || '',
        endDate: job.is_current ? 'Present' : job.end_date || '',
        current: job.is_current || false,
        description: job.summary || '',
      }));

      console.log('Mapped experience:', experience);

      // Map education history to education
      const education = (userProfile.education_history || []).map((edu: any) => ({
        degree: edu.degree || '',
        field: edu.field_of_study || '',
        school: edu.school || '',
        location: '',
        startYear: edu.start_year || '',
        endYear: edu.end_year || '',
        graduationYear: edu.end_year || '',
        gpa: '',
        honors: '',
      }));

      // Map projects from projects table
      const projects = (userProjects || []).map((proj: any) => ({
        name: proj.title || '',
        role: proj.role || '',
        technologies: Array.isArray(proj.technologies) ? proj.technologies.join(', ') : '',
        description: proj.description || '',
        url: proj.url || proj.github_url || '',
      }));

      // Map achievements from achievements_history
      const achievements = (userProfile.achievements_history || []).map((ach: any) => ({
        id: Date.now().toString() + Math.random(), // Ensure unique IDs
        title: ach.title || '',
        description: ach.description || '',
        date: ach.date || '',
      }));

      // Import all profile data
      setResumeContent((prev) => ({
        ...prev,
        contactInfo: {
          name: userProfile.name || clerkUser?.fullName || '',
          email: userProfile.email || clerkUser?.primaryEmailAddress?.emailAddress || '',
          phone: clerkUser?.phoneNumbers?.[0]?.phoneNumber || '',
          location: userProfile.location || '',
          linkedin: userProfile.linkedin_url || '',
          github: userProfile.github_url || '',
        },
        summary: userProfile.bio || '',
        skills: userProfile.skills
          ? userProfile.skills.split(',').map((s: string) => s.trim())
          : [],
        experience,
        education,
        projects,
        achievements,
      }));

      toast({
        title: 'Profile Imported',
        description: 'Career profile data has been imported successfully',
        variant: 'success',
      });
    } catch (error) {
      console.error('Import error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to import profile data';
      toast({
        title: 'Import Failed',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/resumes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Create New Resume</h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={importFromProfile}
            disabled={importing || userProfile === null}
          >
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <UploadIcon className="mr-2 h-4 w-4" />
                Import from Career Profile
              </>
            )}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Resume
              </>
            )}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resume Details</CardTitle>
          <CardDescription>
            Start with the basics. You can add more details after creating the resume.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Resume Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Resume Title</Label>
            <Input
              id="title"
              placeholder="e.g., Software Engineer Resume"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              This title is for your reference only and won't appear on the resume
            </p>
          </div>

          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="font-semibold">Personal Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={resumeContent.contactInfo.name}
                  onChange={(e) => updateContactInfo('name', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={resumeContent.contactInfo.email}
                  onChange={(e) => updateContactInfo('email', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder="+1 (555) 123-4567"
                  value={resumeContent.contactInfo.phone}
                  onChange={(e) => updateContactInfo('phone', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="New York, NY"
                  value={resumeContent.contactInfo.location}
                  onChange={(e) => updateContactInfo('location', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="linkedin">LinkedIn URL (Optional)</Label>
                <Input
                  id="linkedin"
                  placeholder="linkedin.com/in/johndoe"
                  value={resumeContent.contactInfo.linkedin}
                  onChange={(e) => updateContactInfo('linkedin', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="github">GitHub URL (Optional)</Label>
                <Input
                  id="github"
                  placeholder="github.com/johndoe"
                  value={resumeContent.contactInfo.github}
                  onChange={(e) => updateContactInfo('github', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Professional Summary */}
          <div className="space-y-2">
            <Label htmlFor="summary">Professional Summary (Optional)</Label>
            <Textarea
              id="summary"
              placeholder="Brief overview of your professional background and key strengths..."
              value={resumeContent.summary}
              onChange={(e) =>
                setResumeContent((prev) => ({
                  ...prev,
                  summary: e.target.value,
                }))
              }
              rows={4}
            />
            <p className="text-sm text-muted-foreground">
              You can add work experience, education, and skills after creating the resume
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Need help getting started?</p>
              <p className="text-sm text-muted-foreground">
                You can also generate a resume using AI or upload an existing one
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/resumes?tab=generate-ai">
                <Button variant="outline">Generate with AI</Button>
              </Link>
              <Link href="/resumes?tab=my-resumes&action=import">
                <Button variant="outline">Upload Existing</Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
