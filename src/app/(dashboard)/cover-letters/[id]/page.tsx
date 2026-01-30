'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { ChevronDown, ChevronUp, Loader2, MessageSquare, Save, Trash, Wand2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';

import { StudentCommentSidebar } from '@/components/comments';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useStudentCommentCounts } from '@/hooks/useStudentComments';

interface CoverLetterDoc {
  _id: string;
  name: string;
  job_title: string;
  company_name?: string;
  template: string;
  content?: string;
  closing: string;
  created_at: number;
  updated_at: number;
  source?: 'manual' | 'ai_generated' | 'ai_optimized' | 'pdf_upload';
}

export default function CoverLetterDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();

  const { user } = useUser();
  const clerkId = user?.id;
  const { toast } = useToast();

  const coverLetters = useQuery(
    api.cover_letters.getUserCoverLetters,
    clerkId ? { clerkId } : 'skip',
  ) as CoverLetterDoc[] | undefined;

  const updateCoverLetter = useMutation(api.cover_letters.updateCoverLetter);
  const deleteCoverLetter = useMutation(api.cover_letters.deleteCoverLetter);
  const generateContent = useMutation(api.cover_letters.generateCoverLetterContent);

  const current = useMemo(() => coverLetters?.find((c) => c._id === id), [coverLetters, id]);

  const [name, setName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [content, setContent] = useState('');
  const [closing, setClosing] = useState('Sincerely,');
  const [jobDescription, setJobDescription] = useState('');
  const [userProfile, setUserProfile] = useState('');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Comment sidebar state
  const [commentSidebarOpen, setCommentSidebarOpen] = useState(false);

  // Get comment counts for this cover letter (for showing feedback button)
  const { total: commentCount, unresolved: unresolvedCommentCount } = useStudentCommentCounts(
    'cover_letter',
    current?._id ? (current._id as Id<'cover_letters'>) : undefined,
  );

  // Check if user is a university student (has advisor feedback available)
  const userProfileData = useQuery(api.users.getUserByClerkId, clerkId ? { clerkId } : 'skip');
  const isUniversityStudent =
    userProfileData?.university_id &&
    (userProfileData?.role === 'student' || userProfileData?.role === 'user');
  const hasComments = commentCount > 0;

  useEffect(() => {
    if (current) {
      setName(current.name || '');
      setJobTitle(current.job_title || '');
      setCompanyName(current.company_name || '');
      setContent(current.content || '');
      setClosing(current.closing || 'Sincerely,');
    }
  }, [current]);

  const onSave = async () => {
    if (!clerkId || !id) return;
    setSaving(true);
    try {
      await updateCoverLetter({
        coverLetterId: id as Id<'cover_letters'>,
        updates: {
          name,
          job_title: jobTitle,
          company_name: companyName || undefined,
          content,
          closing,
        },
      });
      toast({
        title: 'Saved',
        description: 'Your cover letter has been saved successfully.',
        variant: 'success',
      });
      router.push('/cover-letters');
    } catch (error: any) {
      toast({
        title: 'Save failed',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const onGenerate = async () => {
    if (!clerkId || !jobTitle || !companyName) {
      return;
    }
    setGenerating(true);
    try {
      const response = await fetch('/api/cover-letters/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobDescription: jobDescription || `Position: ${jobTitle} at ${companyName}`,
          companyName,
          position: jobTitle,
          userProfile: userProfile || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate cover letter');
      }

      if (result.generatedContent) {
        setContent(result.generatedContent);
        toast({
          title: 'Cover letter generated',
          description: result.usedFallback
            ? 'Generated using fallback (OpenAI unavailable)'
            : 'Generated using AI',
          variant: 'success',
        });
      }
    } catch (error: any) {
      console.error('Generation failed:', error);
      toast({
        title: 'AI generation failed',
        description: 'Trying fallback method...',
        variant: 'destructive',
      });
      // Fallback to existing Convex mutation
      try {
        const result = await generateContent({
          job_title: jobTitle || 'Position',
          company_name: companyName || 'Company',
          job_description: jobDescription || undefined,
          user_experience: userProfile || undefined,
        });
        if (result?.content) {
          setContent(result.content);
          toast({
            title: 'Cover letter generated',
            description: 'Generated using template-based fallback',
            variant: 'success',
          });
        }
      } catch (fallbackError) {
        console.error('Fallback generation also failed:', fallbackError);
        toast({
          title: 'Generation failed',
          description: 'Both AI and fallback generation failed. Please write manually.',
          variant: 'destructive',
        });
      }
    } finally {
      setGenerating(false);
    }
  };

  const onDelete = async () => {
    if (!clerkId || !id) return;
    setDeleting(true);
    try {
      await deleteCoverLetter({ coverLetterId: id as any });
      toast({
        title: 'Cover letter deleted',
        description: 'Your cover letter has been deleted successfully.',
        variant: 'success',
      });
      router.push('/cover-letters');
    } catch (error: any) {
      toast({
        title: 'Delete failed',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  if (!!clerkId && !coverLetters) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!current) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Cover letter not found</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => router.push('/cover-letters')}>
              Back to list
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className={`flex-1 overflow-auto ${commentSidebarOpen ? 'pr-0' : ''}`}>
        <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Edit Cover Letter</h1>
            <div className="flex gap-2">
              {/* Feedback button - only show for university students with comments */}
              {isUniversityStudent && hasComments && (
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
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={deleting}>
                    {deleting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Trash className="h-4 w-4 mr-2" />
                    )}
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Cover Letter</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{name || 'this cover letter'}"? This action
                      cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete} className="bg-red-600 hover:bg-red-700">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button onClick={onSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Untitled Cover Letter"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Job Title</label>
                  <Input
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Software Engineer"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Company</label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="TechCorp Inc."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Closing</label>
                  <Input
                    value={closing}
                    onChange={(e) => setClosing(e.target.value)}
                    placeholder="Sincerely,"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">AI-Enhanced Generation</label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                  >
                    {showAdvanced ? (
                      <ChevronUp className="h-4 w-4 mr-2" />
                    ) : (
                      <ChevronDown className="h-4 w-4 mr-2" />
                    )}
                    {showAdvanced ? 'Hide' : 'Show'} Advanced Options
                  </Button>
                </div>

                {showAdvanced && (
                  <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                    <div>
                      <label className="text-sm font-medium">Job Description</label>
                      <Textarea
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        rows={4}
                        placeholder="Paste the job description here for more personalized generation..."
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Your Experience/Profile</label>
                      <Textarea
                        value={userProfile}
                        onChange={(e) => setUserProfile(e.target.value)}
                        rows={3}
                        placeholder="Describe your relevant experience, skills, and background..."
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Cover Letter Content</label>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onGenerate}
                    disabled={generating || !jobTitle || !companyName}
                  >
                    {generating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Wand2 className="h-4 w-4 mr-2" />
                    )}
                    Generate with AI
                  </Button>
                </div>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={16}
                  placeholder="Write your cover letter here or use AI generation above..."
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Comment Sidebar - for viewing advisor feedback */}
      {commentSidebarOpen && current?._id && (
        <StudentCommentSidebar
          targetType="cover_letter"
          targetId={current._id as Id<'cover_letters'>}
          onClose={() => setCommentSidebarOpen(false)}
        />
      )}
    </div>
  );
}
