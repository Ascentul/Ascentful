'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import {
  ArrowLeft,
  Download,
  Loader2,
  MessageSquare,
  Plus,
  Save,
  Trash2,
  Upload as UploadIcon,
  X,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

import { StudentCommentSidebar } from '@/components/comments';
import type { ResumeData } from '@/components/resume/ResumeDocument';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useStudentCommentCounts } from '@/hooks/useStudentComments';
import { generateResumePDF } from '@/lib/resume-pdf-generator';

interface ContactInfo {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  website: string;
}

interface Experience {
  id: string;
  title: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
}

interface Education {
  id: string;
  school: string;
  degree: string;
  field: string;
  location: string;
  startYear: string;
  endYear: string;
  gpa: string;
  honors: string;
}

interface Project {
  id: string;
  name: string;
  role: string;
  description: string;
  technologies: string;
  url: string;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  date: string;
}

export default function ResumeEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const clerkId = user?.id;
  const resumeId = (
    Array.isArray((params as any)?.id) ? (params as any).id[0] : (params as any)?.id
  ) as string;
  const isNewResume = !resumeId || resumeId === 'new';

  const resume = useQuery(
    api.resumes.getResumeById,
    !isNewResume && clerkId && resumeId ? ({ clerkId, resumeId } as any) : 'skip',
  ) as any;

  const userProfile = useQuery(api.users.getUserByClerkId, clerkId ? { clerkId } : 'skip') as any;

  const userProjects = useQuery(api.projects.getUserProjects, clerkId ? { clerkId } : 'skip');

  const createResumeMutation = useMutation(api.resumes.createResume);
  const updateResume = useMutation(api.resumes.updateResume);
  const deleteResume = useMutation(api.resumes.deleteResume);

  const [title, setTitle] = useState('');
  const [contactInfo, setContactInfo] = useState<ContactInfo>({
    name: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    github: '',
    website: '',
  });
  const [summary, setSummary] = useState('');
  const [skillsText, setSkillsText] = useState('');
  const [experience, setExperience] = useState<Experience[]>([]);
  const [education, setEducation] = useState<Education[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  // Comment sidebar state
  const [commentSidebarOpen, setCommentSidebarOpen] = useState(false);

  // Get comment counts for this resume (for showing feedback button)
  const { total: commentCount, unresolved: unresolvedCommentCount } = useStudentCommentCounts(
    'resume',
    !isNewResume && resume?._id ? (resume._id as Id<'resumes'>) : undefined,
  );

  // Check if user is a university student (has advisor feedback available)
  const isUniversityStudent =
    userProfile?.university_id && (userProfile?.role === 'student' || userProfile?.role === 'user');
  const hasComments = commentCount > 0;

  // Hydrate local state when data loads
  useEffect(() => {
    if (!resume) return;
    setTitle(resume.title || '');
    const content = resume.content || {};

    // Contact Info - check both contactInfo and personalInfo for backward compatibility
    const contactData = content.contactInfo ||
      content.personalInfo || {
        name: '',
        email: '',
        phone: '',
        location: '',
        linkedin: '',
        github: '',
        website: '',
      };
    setContactInfo(contactData);

    setSummary(content.summary || '');
    setSkillsText((content.skills || []).join(', '));
    setExperience(content.experience || []);
    setEducation(content.education || []);
    setProjects(content.projects || []);
    setAchievements(content.achievements || []);
  }, [resume]);

  const loading = !isNewResume && resume === undefined;

  // If the resume was deleted or cannot be accessed, return to list
  useEffect(() => {
    if (resume === null) {
      router.replace('/resumes');
    }
  }, [resume, router]);

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
      const experienceData = (userProfile.work_history || []).map((job: any) => ({
        id: Date.now().toString() + Math.random(), // Ensure unique IDs
        title: job.role || '',
        company: job.company || '',
        location: job.location || '',
        startDate: job.start_date || '',
        endDate: job.is_current ? 'Present' : job.end_date || '',
        current: job.is_current || false,
        description: job.summary || '',
      }));

      console.log('Mapped experience:', experienceData);

      // Map education history to education
      const educationData = (userProfile.education_history || []).map((edu: any) => ({
        id: Date.now().toString() + Math.random(), // Ensure unique IDs
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
      const projectsData = (userProjects || []).map((proj: any) => ({
        id: Date.now().toString() + Math.random(), // Ensure unique IDs
        name: proj.title || '',
        role: proj.role || '',
        technologies: Array.isArray(proj.technologies) ? proj.technologies.join(', ') : '',
        description: proj.description || '',
        url: proj.url || proj.github_url || '',
      }));

      // Map achievements from achievements_history
      const achievementsData = (userProfile.achievements_history || []).map((ach: any) => ({
        id: Date.now().toString() + Math.random(), // Ensure unique IDs
        title: ach.title || '',
        description: ach.description || '',
        date: ach.date || '',
      }));

      // Import all profile data
      setContactInfo({
        name: userProfile.name || user?.fullName || '',
        email: userProfile.email || user?.primaryEmailAddress?.emailAddress || '',
        phone: user?.phoneNumbers?.[0]?.phoneNumber || '',
        location: userProfile.location || '',
        linkedin: userProfile.linkedin_url || '',
        github: userProfile.github_url || '',
        website: userProfile.website || '',
      });

      setSummary(userProfile.bio || '');
      setSkillsText(userProfile.skills || '');
      setExperience(experienceData);
      setEducation(educationData);
      setProjects(projectsData);
      setAchievements(achievementsData);

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

  const doSave = async () => {
    if (!clerkId) return;

    const normalizedTitle = title.trim() || 'Untitled Resume';

    // Clean up empty social links from contact info
    const cleanedContactInfo = {
      ...contactInfo,
      linkedin: contactInfo.linkedin?.trim() || undefined,
      github: contactInfo.github?.trim() || undefined,
      website: contactInfo.website?.trim() || undefined,
    };
    // Remove undefined properties to keep JSON clean
    Object.keys(cleanedContactInfo).forEach(
      (key) =>
        cleanedContactInfo[key as keyof typeof cleanedContactInfo] === undefined &&
        delete cleanedContactInfo[key as keyof typeof cleanedContactInfo],
    );

    const contentPayload = {
      contactInfo: cleanedContactInfo,
      summary,
      skills: skillsText
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
      experience,
      education,
      projects,
      achievements,
    };

    setSaving(true);
    try {
      if (isNewResume) {
        await createResumeMutation({
          clerkId,
          title: normalizedTitle,
          content: contentPayload,
          visibility: 'private',
          source: 'manual',
        } as any);

        toast({
          title: 'Resume created',
          description: 'Your new resume has been saved.',
          variant: 'success',
        });
      } else if (resume?._id) {
        await updateResume({
          clerkId,
          resumeId: resume._id,
          updates: {
            title: normalizedTitle,
            content: contentPayload,
          },
        } as any);

        toast({
          title: 'Saved',
          description: 'Your resume has been saved successfully.',
          variant: 'success',
        });
      } else {
        throw new Error('Resume not found');
      }

      setTimeout(() => {
        router.push('/resumes');
      }, 500);
    } catch (e: any) {
      toast({
        title: 'Save failed',
        description: e?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Experience management
  const addExperience = () => {
    const newExp: Experience = {
      id: Date.now().toString(),
      title: '',
      company: '',
      location: '',
      startDate: '',
      endDate: '',
      current: false,
      description: '',
    };
    setExperience([...experience, newExp]);
  };

  const removeExperience = (id: string) => {
    setExperience(experience.filter((exp) => exp.id !== id));
  };

  const updateExperience = (id: string, field: keyof Experience, value: any) => {
    setExperience(experience.map((exp) => (exp.id === id ? { ...exp, [field]: value } : exp)));
  };

  // Education management
  const addEducation = () => {
    const newEdu: Education = {
      id: Date.now().toString(),
      school: '',
      degree: '',
      field: '',
      location: '',
      startYear: '',
      endYear: '',
      gpa: '',
      honors: '',
    };
    setEducation([...education, newEdu]);
  };

  const removeEducation = (id: string) => {
    setEducation(education.filter((edu) => edu.id !== id));
  };

  const updateEducation = (id: string, field: keyof Education, value: string) => {
    setEducation(education.map((edu) => (edu.id === id ? { ...edu, [field]: value } : edu)));
  };

  // Project management
  const addProject = () => {
    const newProject: Project = {
      id: Date.now().toString(),
      name: '',
      role: '',
      description: '',
      technologies: '',
      url: '',
    };
    setProjects([...projects, newProject]);
  };

  const removeProject = (id: string) => {
    setProjects(projects.filter((proj) => proj.id !== id));
  };

  const updateProject = (id: string, field: keyof Project, value: string) => {
    setProjects(projects.map((proj) => (proj.id === id ? { ...proj, [field]: value } : proj)));
  };

  // Achievement management
  const addAchievement = () => {
    const newAchievement: Achievement = {
      id: Date.now().toString(),
      title: '',
      description: '',
      date: '',
    };
    setAchievements([...achievements, newAchievement]);
  };

  const removeAchievement = (id: string) => {
    setAchievements(achievements.filter((ach) => ach.id !== id));
  };

  const updateAchievement = (id: string, field: keyof Achievement, value: string) => {
    setAchievements(achievements.map((ach) => (ach.id === id ? { ...ach, [field]: value } : ach)));
  };

  // PDF export using unified generator
  const exportPdf = async () => {
    try {
      // Normalize data to ResumeData format
      const resumeData: ResumeData = {
        contactInfo: {
          name: contactInfo.name || title || 'Resume',
          email: contactInfo.email || '',
          phone: contactInfo.phone || '',
          location: contactInfo.location || '',
          linkedin: contactInfo.linkedin || '',
          github: contactInfo.github || '',
          website: contactInfo.website || '',
        },
        summary,
        skills: skillsText
          ? skillsText
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        experience,
        education,
        projects,
        achievements,
      };

      const fileName = `${(title || contactInfo?.name || 'resume').replace(/\s+/g, '_')}.pdf`;
      await generateResumePDF(resumeData, fileName);

      toast({ title: 'Exported', description: 'PDF downloaded successfully.', variant: 'success' });
    } catch (e: any) {
      console.error('PDF export error:', e);
      const errorMsg =
        e?.message ||
        'An error occurred during PDF export. Please check your resume data and try again.';
      toast({ title: 'Export failed', description: errorMsg, variant: 'destructive' });
    }
  };

  const doDelete = async () => {
    if (!clerkId || !resume?._id) return;
    setDeleting(true);
    try {
      await deleteResume({ clerkId, resumeId: resume._id } as any);
      toast({ title: 'Deleted', description: 'Resume removed.', variant: 'success' });
      router.replace('/resumes');
    } catch (e: any) {
      toast({
        title: 'Delete failed',
        description: e?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className={`flex-1 overflow-auto ${commentSidebarOpen ? 'pr-0' : ''}`}>
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => router.push('/resumes')}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <h1 className="text-3xl font-bold tracking-tight text-[#0C29AB]">
                {isNewResume ? 'Create Resume' : 'Edit Resume'}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {/* Feedback button - only show for university students with comments */}
              {!isNewResume && isUniversityStudent && hasComments && (
                <Button
                  variant={commentSidebarOpen ? 'secondary' : 'outline'}
                  onClick={() => setCommentSidebarOpen(!commentSidebarOpen)}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Feedback
                  <span
                    className={`ml-1 rounded-full px-1.5 text-xs ${
                      unresolvedCommentCount > 0
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    {unresolvedCommentCount > 0 ? unresolvedCommentCount : commentCount}
                  </span>
                </Button>
              )}
              <Button
                variant="outline"
                onClick={importFromProfile}
                disabled={importing || !userProfile}
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <UploadIcon className="h-4 w-4 mr-2" />
                )}
                Import from Career Profile
              </Button>
              {!isNewResume && (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => setConfirmOpen(true)}
                    disabled={!resume || deleting}
                  >
                    {deleting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}{' '}
                    Delete
                  </Button>
                  <Button variant="outline" onClick={exportPdf} disabled={!resume}>
                    <Download className="h-4 w-4 mr-2" /> Export PDF
                  </Button>
                </>
              )}
              <Button onClick={doSave} disabled={saving || !clerkId}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {isNewResume ? 'Save Resume' : 'Save'}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : resume === null ? (
            <Card>
              <CardHeader>
                <CardTitle>Resume not found</CardTitle>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid gap-6">
              {/* Basic Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Basic Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Resume Title</label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., Software Engineer Resume"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Contact Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Full Name</label>
                      <Input
                        value={contactInfo.name}
                        onChange={(e) => setContactInfo({ ...contactInfo, name: e.target.value })}
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Email</label>
                      <Input
                        type="email"
                        value={contactInfo.email}
                        onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                        placeholder="john@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Phone</label>
                      <Input
                        value={contactInfo.phone}
                        onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Location</label>
                      <Input
                        value={contactInfo.location}
                        onChange={(e) =>
                          setContactInfo({ ...contactInfo, location: e.target.value })
                        }
                        placeholder="San Francisco, CA"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">LinkedIn</label>
                      <Input
                        value={contactInfo.linkedin}
                        onChange={(e) =>
                          setContactInfo({ ...contactInfo, linkedin: e.target.value })
                        }
                        placeholder="linkedin.com/in/johndoe"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">GitHub</label>
                      <Input
                        value={contactInfo.github}
                        onChange={(e) => setContactInfo({ ...contactInfo, github: e.target.value })}
                        placeholder="github.com/johndoe"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1">Website</label>
                      <Input
                        value={contactInfo.website}
                        onChange={(e) =>
                          setContactInfo({ ...contactInfo, website: e.target.value })
                        }
                        placeholder="johndoe.com"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Professional Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Professional Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    rows={5}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Write a compelling summary of your professional experience and career goals..."
                  />
                </CardContent>
              </Card>

              {/* Skills */}
              <Card>
                <CardHeader>
                  <CardTitle>Skills</CardTitle>
                </CardHeader>
                <CardContent>
                  <label className="block text-sm font-medium mb-2">Skills (comma separated)</label>
                  <Input
                    value={skillsText}
                    onChange={(e) => setSkillsText(e.target.value)}
                    placeholder="React, TypeScript, Node.js, Python, AWS"
                  />
                </CardContent>
              </Card>

              {/* Work Experience */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Work Experience</CardTitle>
                  <Button onClick={addExperience} size="sm">
                    <Plus className="h-4 w-4 mr-2" /> Add Experience
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  {experience.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No experience added yet. Click "Add Experience" to get started.
                    </p>
                  ) : (
                    experience.map((exp, idx) => (
                      <div key={exp.id} className="border rounded-lg p-4 space-y-4 relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => removeExperience(exp.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-1">Job Title</label>
                            <Input
                              value={exp.title}
                              onChange={(e) => updateExperience(exp.id, 'title', e.target.value)}
                              placeholder="Software Engineer"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Company</label>
                            <Input
                              value={exp.company}
                              onChange={(e) => updateExperience(exp.id, 'company', e.target.value)}
                              placeholder="Tech Corp"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Location</label>
                            <Input
                              value={exp.location}
                              onChange={(e) => updateExperience(exp.id, 'location', e.target.value)}
                              placeholder="San Francisco, CA"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={exp.current}
                              onChange={(e) =>
                                updateExperience(exp.id, 'current', e.target.checked)
                              }
                              className="h-4 w-4"
                            />
                            <label className="text-sm font-medium">Current Position</label>
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Start Date</label>
                            <Input
                              value={exp.startDate}
                              onChange={(e) =>
                                updateExperience(exp.id, 'startDate', e.target.value)
                              }
                              placeholder="Jan 2020"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">End Date</label>
                            <Input
                              value={exp.endDate}
                              onChange={(e) => updateExperience(exp.id, 'endDate', e.target.value)}
                              placeholder="Dec 2023"
                              disabled={exp.current}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Responsibilities & Achievements
                          </label>
                          <Textarea
                            rows={4}
                            value={exp.description}
                            onChange={(e) =>
                              updateExperience(exp.id, 'description', e.target.value)
                            }
                            placeholder="• Led development of key features&#10;• Improved performance by 40%&#10;• Mentored junior developers"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Education */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Education</CardTitle>
                  <Button onClick={addEducation} size="sm">
                    <Plus className="h-4 w-4 mr-2" /> Add Education
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  {education.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No education added yet. Click "Add Education" to get started.
                    </p>
                  ) : (
                    education.map((edu, idx) => (
                      <div key={edu.id} className="border rounded-lg p-4 space-y-4 relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => removeEducation(edu.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-1">
                              School/University
                            </label>
                            <Input
                              value={edu.school}
                              onChange={(e) => updateEducation(edu.id, 'school', e.target.value)}
                              placeholder="Stanford University"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Degree</label>
                            <Input
                              value={edu.degree}
                              onChange={(e) => updateEducation(edu.id, 'degree', e.target.value)}
                              placeholder="Bachelor of Science"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">
                              Major/Field of Study
                            </label>
                            <Input
                              value={edu.field}
                              onChange={(e) => updateEducation(edu.id, 'field', e.target.value)}
                              placeholder="Computer Science"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Location</label>
                            <Input
                              value={edu.location}
                              onChange={(e) => updateEducation(edu.id, 'location', e.target.value)}
                              placeholder="Stanford, CA"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Start Year</label>
                            <Input
                              value={edu.startYear}
                              onChange={(e) => updateEducation(edu.id, 'startYear', e.target.value)}
                              placeholder="2016"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">End Year</label>
                            <Input
                              value={edu.endYear}
                              onChange={(e) => updateEducation(edu.id, 'endYear', e.target.value)}
                              placeholder="2020"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">GPA (optional)</label>
                            <Input
                              value={edu.gpa}
                              onChange={(e) => updateEducation(edu.id, 'gpa', e.target.value)}
                              placeholder="3.8/4.0"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">
                              Honors (optional)
                            </label>
                            <Input
                              value={edu.honors}
                              onChange={(e) => updateEducation(edu.id, 'honors', e.target.value)}
                              placeholder="Cum Laude, Dean's List"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Projects */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Projects</CardTitle>
                  <Button onClick={addProject} size="sm">
                    <Plus className="h-4 w-4 mr-2" /> Add Project
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  {projects.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No projects added yet. Click "Add Project" to get started.
                    </p>
                  ) : (
                    projects.map((proj, idx) => (
                      <div key={proj.id} className="border rounded-lg p-4 space-y-4 relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => removeProject(proj.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-1">Project Name</label>
                            <Input
                              value={proj.name}
                              onChange={(e) => updateProject(proj.id, 'name', e.target.value)}
                              placeholder="E-commerce Platform"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Role</label>
                            <Input
                              value={proj.role}
                              onChange={(e) => updateProject(proj.id, 'role', e.target.value)}
                              placeholder="Lead Developer"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Technologies</label>
                            <Input
                              value={proj.technologies}
                              onChange={(e) =>
                                updateProject(proj.id, 'technologies', e.target.value)
                              }
                              placeholder="React, Node.js, MongoDB"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">URL (optional)</label>
                            <Input
                              value={proj.url}
                              onChange={(e) => updateProject(proj.id, 'url', e.target.value)}
                              placeholder="https://project-demo.com"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Description</label>
                          <Textarea
                            rows={3}
                            value={proj.description}
                            onChange={(e) => updateProject(proj.id, 'description', e.target.value)}
                            placeholder="Built a full-stack e-commerce platform serving 10k+ users..."
                          />
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Achievements */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Achievements & Awards</CardTitle>
                  <Button onClick={addAchievement} size="sm">
                    <Plus className="h-4 w-4 mr-2" /> Add Achievement
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  {achievements.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No achievements added yet. Click "Add Achievement" to get started.
                    </p>
                  ) : (
                    achievements.map((ach, idx) => (
                      <div key={ach.id} className="border rounded-lg p-4 space-y-4 relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => removeAchievement(ach.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-1">
                              Achievement Title
                            </label>
                            <Input
                              value={ach.title}
                              onChange={(e) => updateAchievement(ach.id, 'title', e.target.value)}
                              placeholder="Employee of the Year"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Date</label>
                            <Input
                              value={ach.date}
                              onChange={(e) => updateAchievement(ach.id, 'date', e.target.value)}
                              placeholder="2023"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Description</label>
                          <Textarea
                            rows={2}
                            value={ach.description}
                            onChange={(e) =>
                              updateAchievement(ach.id, 'description', e.target.value)
                            }
                            placeholder="Recognized for exceptional performance..."
                          />
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Confirm Delete Dialog */}
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete resume?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete this resume.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={doDelete}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Comment Sidebar - for viewing advisor feedback */}
      {commentSidebarOpen && resume?._id && (
        <StudentCommentSidebar
          targetType="resume"
          targetId={resume._id as Id<'resumes'>}
          onClose={() => setCommentSidebarOpen(false)}
        />
      )}
    </div>
  );
}
