'use client';

/**
 * Student Advisor Reviews - Create Review Request Page
 *
 * Allows students to submit documents for review by their advisor.
 * Supports resumes, cover letters, and other documents.
 */

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { ArrowLeft, Check, FileText, Loader2, Upload, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { StudentUniversityGate } from '@/components/StudentUniversityGate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';

type AssetType = 'resume' | 'cover_letter' | 'other';

export default function NewReviewRequestPage() {
  return (
    <StudentUniversityGate>
      <NewReviewRequestContent />
    </StudentUniversityGate>
  );
}

function NewReviewRequestContent() {
  const { user } = useUser();
  const router = useRouter();
  const clerkId = user?.id;

  // State
  const [assetType, setAssetType] = useState<AssetType>('resume');
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [selectedCoverLetterId, setSelectedCoverLetterId] = useState<string>('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Queries
  const advisor = useQuery(api.student_advisor_hub.getMyAdvisor, clerkId ? { clerkId } : 'skip');

  // Get user's resumes and cover letters
  const resumes = useQuery(api.resumes.getUserResumes, clerkId ? { clerkId } : 'skip');
  const coverLetters = useQuery(
    api.cover_letters.getUserCoverLetters,
    clerkId ? { clerkId } : 'skip',
  );

  // Mutation
  const createReviewRequest = useMutation(api.student_advisor_hub_mutations.createReviewRequest);

  const isLoading = advisor === undefined;

  const handleSubmit = async () => {
    if (!clerkId || isSubmitting) return;

    // Validation
    if (assetType === 'resume' && !selectedResumeId) {
      return;
    }
    if (assetType === 'cover_letter' && !selectedCoverLetterId) {
      return;
    }
    if (assetType === 'other' && !documentUrl.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await createReviewRequest({
        clerkId,
        assetType,
        resumeId: assetType === 'resume' ? (selectedResumeId as Id<'resumes'>) : undefined,
        coverLetterId:
          assetType === 'cover_letter' ? (selectedCoverLetterId as Id<'cover_letters'>) : undefined,
        documentUrl: assetType === 'other' ? documentUrl.trim() : undefined,
        studentNote: note.trim() || undefined,
        submitNow: true,
      });
      setSubmitSuccess(true);
    } catch (error) {
      console.error('Failed to create review request:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit review request. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitSuccess) {
    return (
      <div className="w-full">
        <div className="w-full gradient-border-bottom p-5 space-y-6 shadow-sm">
          <Card className="max-w-md mx-auto">
            <CardContent className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Review Requested!</h2>
              <p className="text-muted-foreground mb-6">
                Your document has been submitted for review. You'll be notified once your advisor
                provides feedback.
              </p>
              <div className="space-y-2">
                <Link href="/student/advisor/reviews">
                  <Button className="w-full">View My Reviews</Button>
                </Link>
                <Link href="/student/advisor">
                  <Button variant="outline" className="w-full">
                    Back to Advisor Hub
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="w-full gradient-border-bottom p-5 shadow-sm">
          <div className="flex items-center justify-center h-96">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  if (!advisor) {
    return (
      <div className="w-full">
        <div className="w-full gradient-border-bottom p-5 space-y-6 shadow-sm">
          <div className="flex items-center gap-4">
            <Link href="/student/advisor/reviews">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Request a Review</h1>
          </div>

          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Advisor Assigned</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                You need to be assigned an advisor before you can request document reviews. Contact
                your university career center to get connected.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="w-full gradient-border-bottom p-5 space-y-6 shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/student/advisor/reviews">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Request a Review</h1>
            <p className="text-muted-foreground">Get feedback from {advisor.advisorName}</p>
          </div>
        </div>

        <div className="max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Document Details</CardTitle>
              <CardDescription>
                Select the document you'd like your advisor to review
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Asset Type Selection */}
              <div className="space-y-3">
                <Label>Document Type</Label>
                <RadioGroup
                  value={assetType}
                  onValueChange={(v) => setAssetType(v as AssetType)}
                  className="grid grid-cols-3 gap-4"
                >
                  <div>
                    <RadioGroupItem value="resume" id="resume" className="peer sr-only" />
                    <Label
                      htmlFor="resume"
                      className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      <FileText className="mb-2 h-6 w-6" />
                      Resume
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem
                      value="cover_letter"
                      id="cover_letter"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="cover_letter"
                      className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      <FileText className="mb-2 h-6 w-6" />
                      Cover Letter
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="other" id="other" className="peer sr-only" />
                    <Label
                      htmlFor="other"
                      className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      <Upload className="mb-2 h-6 w-6" />
                      Other
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Resume Selection */}
              {assetType === 'resume' && (
                <div className="space-y-2">
                  <Label>Select Resume</Label>
                  {resumes?.length === 0 ? (
                    <div className="text-center py-6 border rounded-lg border-dashed">
                      <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground mb-3">
                        You don't have any resumes yet
                      </p>
                      <Link href="/resumes">
                        <Button variant="outline" size="sm">
                          Create a Resume
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <Select value={selectedResumeId} onValueChange={setSelectedResumeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a resume" />
                      </SelectTrigger>
                      <SelectContent>
                        {resumes?.map((resume) => (
                          <SelectItem key={resume._id} value={resume._id}>
                            {resume.title || 'Untitled Resume'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* Cover Letter Selection */}
              {assetType === 'cover_letter' && (
                <div className="space-y-2">
                  <Label>Select Cover Letter</Label>
                  {coverLetters?.length === 0 ? (
                    <div className="text-center py-6 border rounded-lg border-dashed">
                      <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground mb-3">
                        You don't have any cover letters yet
                      </p>
                      <Link href="/cover-letters">
                        <Button variant="outline" size="sm">
                          Create a Cover Letter
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <Select value={selectedCoverLetterId} onValueChange={setSelectedCoverLetterId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a cover letter" />
                      </SelectTrigger>
                      <SelectContent>
                        {coverLetters?.map((cl) => (
                          <SelectItem key={cl._id} value={cl._id}>
                            {cl.name || 'Untitled Cover Letter'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* Other Document URL */}
              {assetType === 'other' && (
                <div className="space-y-2">
                  <Label>Document Link</Label>
                  <Input
                    type="url"
                    placeholder="Paste a link to your document (Google Docs, Dropbox, etc.)"
                    value={documentUrl}
                    onChange={(e) => setDocumentUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Make sure your document is shared with your advisor or set to "anyone with link"
                  </p>
                </div>
              )}

              {/* Note */}
              <div className="space-y-2">
                <Label>Note for Advisor (Optional)</Label>
                <Textarea
                  placeholder="What specific feedback are you looking for?"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Submit Button */}
              <Button
                onClick={handleSubmit}
                disabled={
                  isSubmitting ||
                  (assetType === 'resume' && !selectedResumeId) ||
                  (assetType === 'cover_letter' && !selectedCoverLetterId) ||
                  (assetType === 'other' && !documentUrl.trim())
                }
                className="w-full"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit for Review'
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
