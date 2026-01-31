'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { ArrowLeft, Eye, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface PageProps {
  params: { id: string };
}

export default function EditResumePage({ params }: PageProps) {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const { toast } = useToast();

  const resumeId = params.id as Id<'resumes'>;

  const resume = useQuery(
    api.resumes.getResumeById,
    clerkUser?.id ? { clerkId: clerkUser.id, resumeId } : 'skip',
  );

  const [title, setTitle] = useState('');
  const [resumeContent, setResumeContent] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const updateResumeMutation = useMutation(api.resumes.updateResume);

  useEffect(() => {
    if (resume) {
      setTitle(resume.title || 'My Resume');
      // Check both contactInfo and personalInfo for backward compatibility
      const content = resume.content || {};
      const contactData = content.contactInfo || content.personalInfo || {};
      setResumeContent({
        contactInfo: contactData,
        summary: content.summary || '',
        skills: content.skills || [],
        experience: content.experience || [],
        education: content.education || [],
        projects: content.projects || [],
        achievements: content.achievements || [],
      });
    }
  }, [resume]);

  const handleSave = async () => {
    if (!clerkUser?.id || !resumeContent) {
      return;
    }

    setSaving(true);
    try {
      await updateResumeMutation({
        resumeId,
        updates: {
          title: title.trim(),
          content: resumeContent,
        },
      });

      toast({
        title: 'Success',
        description: 'Resume updated successfully!',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update resume',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateContactInfo = (field: string, value: string) => {
    setResumeContent((prev: any) => ({
      ...prev,
      contactInfo: {
        ...prev.contactInfo,
        [field]: value,
      },
    }));
  };

  const addExperience = () => {
    setResumeContent((prev: any) => ({
      ...prev,
      experience: [
        ...(prev.experience || []),
        {
          title: '',
          company: '',
          startDate: '',
          endDate: '',
          description: '',
        },
      ],
    }));
  };

  const updateExperience = (index: number, field: string, value: string) => {
    setResumeContent((prev: any) => ({
      ...prev,
      experience: prev.experience.map((exp: any, i: number) =>
        i === index ? { ...exp, [field]: value } : exp,
      ),
    }));
  };

  const removeExperience = (index: number) => {
    setResumeContent((prev: any) => ({
      ...prev,
      experience: prev.experience.filter((_: any, i: number) => i !== index),
    }));
  };

  const addEducation = () => {
    setResumeContent((prev: any) => ({
      ...prev,
      education: [
        ...(prev.education || []),
        {
          degree: '',
          school: '',
          graduationYear: '',
        },
      ],
    }));
  };

  const updateEducation = (index: number, field: string, value: string) => {
    setResumeContent((prev: any) => ({
      ...prev,
      education: prev.education.map((edu: any, i: number) =>
        i === index ? { ...edu, [field]: value } : edu,
      ),
    }));
  };

  const removeEducation = (index: number) => {
    setResumeContent((prev: any) => ({
      ...prev,
      education: prev.education.filter((_: any, i: number) => i !== index),
    }));
  };

  const updateSkills = (value: string) => {
    const skillsArray = value
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s);
    setResumeContent((prev: any) => ({
      ...prev,
      skills: skillsArray,
    }));
  };

  if (!resume) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!resumeContent) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/resumes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Edit Resume</h1>
        </div>
        <div className="flex gap-2">
          <Link href={`/resumes/${resumeId}`}>
            <Button variant="outline">
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>
          </Link>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Resume Title */}
        <Card>
          <CardHeader>
            <CardTitle>Resume Title</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Software Engineer Resume"
            />
          </CardContent>
        </Card>

        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  value={resumeContent.contactInfo?.name || ''}
                  onChange={(e) => updateContactInfo('name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={resumeContent.contactInfo?.email || ''}
                  onChange={(e) => updateContactInfo('email', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={resumeContent.contactInfo?.phone || ''}
                  onChange={(e) => updateContactInfo('phone', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  value={resumeContent.contactInfo?.location || ''}
                  onChange={(e) => updateContactInfo('location', e.target.value)}
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
              value={resumeContent.summary || ''}
              onChange={(e) =>
                setResumeContent((prev: any) => ({
                  ...prev,
                  summary: e.target.value,
                }))
              }
              placeholder="Brief overview of your professional background..."
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Skills */}
        <Card>
          <CardHeader>
            <CardTitle>Skills</CardTitle>
            <CardDescription>Enter skills separated by commas</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={Array.isArray(resumeContent.skills) ? resumeContent.skills.join(', ') : ''}
              onChange={(e) => updateSkills(e.target.value)}
              placeholder="React, TypeScript, Node.js, Python..."
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Experience */}
        <Card>
          <CardHeader>
            <CardTitle>Work Experience</CardTitle>
            <Button size="sm" onClick={addExperience}>
              <Plus className="mr-2 h-4 w-4" />
              Add Experience
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {resumeContent.experience?.map((exp: any, index: number) => (
              <Card key={index}>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex justify-end">
                    <Button size="sm" variant="destructive" onClick={() => removeExperience(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Job Title</Label>
                      <Input
                        value={exp.title || ''}
                        onChange={(e) => updateExperience(index, 'title', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Company</Label>
                      <Input
                        value={exp.company || ''}
                        onChange={(e) => updateExperience(index, 'company', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input
                        value={exp.startDate || ''}
                        onChange={(e) => updateExperience(index, 'startDate', e.target.value)}
                        placeholder="MM/YYYY"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input
                        value={exp.endDate || ''}
                        onChange={(e) => updateExperience(index, 'endDate', e.target.value)}
                        placeholder="MM/YYYY or Present"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={exp.description || ''}
                      onChange={(e) => updateExperience(index, 'description', e.target.value)}
                      placeholder="Key responsibilities and achievements..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>

        {/* Education */}
        <Card>
          <CardHeader>
            <CardTitle>Education</CardTitle>
            <Button size="sm" onClick={addEducation}>
              <Plus className="mr-2 h-4 w-4" />
              Add Education
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {resumeContent.education?.map((edu: any, index: number) => (
              <Card key={index}>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex justify-end">
                    <Button size="sm" variant="destructive" onClick={() => removeEducation(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Degree</Label>
                      <Input
                        value={edu.degree || ''}
                        onChange={(e) => updateEducation(index, 'degree', e.target.value)}
                        placeholder="Bachelor of Science"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>School</Label>
                      <Input
                        value={edu.school || ''}
                        onChange={(e) => updateEducation(index, 'school', e.target.value)}
                        placeholder="University Name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Graduation Year</Label>
                      <Input
                        value={edu.graduationYear || ''}
                        onChange={(e) => updateEducation(index, 'graduationYear', e.target.value)}
                        placeholder="YYYY"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
