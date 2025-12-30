'use client';

import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { useAction, useMutation } from 'convex/react';
import { format } from 'date-fns';
import {
  AlertCircle,
  Check,
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  Save,
  User,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { CommentButton } from '@/components/advisor/comments';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/errors';

interface AssetContent {
  file_url?: string;
  content?: string;
}

interface Review {
  _id: Id<'advisor_reviews'>;
  student_id: Id<'users'>;
  student_name: string;
  student_email: string;
  asset_id: string;
  asset_type: string;
  asset_name: string;
  asset_content?: AssetContent;
  status: string;
  priority: string;
  requested_at: number;
  reviewer_id?: string | null;
  reviewed_at?: number | null;
  feedback?: string | null;
  suggestions?: string[];
  version: number;
}

interface ReviewEditorProps {
  review: Review;
  clerkId: string;
  onSaveSuccess?: () => void;
  onCompleteSuccess?: () => void;
}

export function ReviewEditor({
  review,
  clerkId,
  onSaveSuccess,
  onCompleteSuccess,
}: ReviewEditorProps) {
  const { toast } = useToast();
  const updateReviewFeedback = useMutation(api.advisor_reviews_mutations.updateReviewFeedback);
  const completeReview = useAction(api.advisor_reviews_mutations.completeReview);
  const claimReview = useMutation(api.advisor_reviews_mutations.claimReview);

  // Form state
  const [feedback, setFeedback] = useState(review.feedback || '');
  const [currentVersion, setCurrentVersion] = useState(review.version);

  // Autosave state
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedFeedback, setLastSavedFeedback] = useState(review.feedback || '');

  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset state only when switching to a different review
  // This prevents losing unsaved changes when background syncs update the review prop
  useEffect(() => {
    // Clear any pending autosave timer when switching reviews
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    setFeedback(review.feedback || '');
    setCurrentVersion(review.version);
    setLastSavedFeedback(review.feedback || '');
    setHasUnsavedChanges(false);
    setLastSaved(null);
    setSaveError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only reset state when review._id changes, not on every review prop update
  }, [review._id]);
  // Track if feedback has changed
  useEffect(() => {
    const changed = feedback !== lastSavedFeedback;
    setHasUnsavedChanges(changed);
  }, [feedback, lastSavedFeedback]);

  // Autosave function
  const saveChanges = useCallback(async (): Promise<{
    success: boolean;
    version?: number;
    reason?: string;
  }> => {
    if (!hasUnsavedChanges || review.status !== 'in_review') {
      return { success: false };
    }

    // Prevent parallel saves; caller should wait for isSaving to clear
    if (isSaving) {
      return { success: false, reason: 'save_in_progress' };
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const result = await updateReviewFeedback({
        clerkId,
        review_id: review._id,
        feedback: feedback || undefined,
        version: currentVersion,
      });

      setCurrentVersion(result.version);
      setLastSaved(new Date());
      setLastSavedFeedback(feedback);
      setHasUnsavedChanges(false);

      if (onSaveSuccess) {
        onSaveSuccess();
      }

      return { success: true, version: result.version };
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      setSaveError(message);
      toast({
        title: 'Save failed',
        description: message,
        variant: 'destructive',
      });
      return { success: false };
    } finally {
      setIsSaving(false);
    }
  }, [
    hasUnsavedChanges,
    isSaving,
    review.status,
    clerkId,
    review._id,
    feedback,
    currentVersion,
    updateReviewFeedback,
    toast,
    onSaveSuccess,
  ]);

  // Keep saveChangesRef up to date
  const saveChangesRef = useRef(saveChanges);
  useEffect(() => {
    saveChangesRef.current = saveChanges;
  }, [saveChanges]);

  // Autosave on change (debounced)
  useEffect(() => {
    if (hasUnsavedChanges && review.status === 'in_review') {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }

      autosaveTimerRef.current = setTimeout(() => {
        saveChangesRef.current();
      }, 2000);
    }

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [hasUnsavedChanges, review.status]);

  // Save when tab becomes hidden or window closes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && hasUnsavedChanges && !isSaving) {
        // Save immediately when tab becomes hidden
        void saveChangesRef.current();
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && !isSaving) {
        // Best-effort save before unload; may not complete
        void saveChangesRef.current();
        e.preventDefault();
        e.returnValue = '';
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges, isSaving]);

  // Manual save
  const handleManualSave = async () => {
    const saveResult = await saveChanges();
    if (saveResult.success) {
      toast({
        title: 'Saved',
        description: 'Review feedback saved',
      });
    }
  };

  // Claim review
  const handleClaim = async () => {
    try {
      await claimReview({
        clerkId,
        review_id: review._id,
      });

      toast({
        title: 'Review claimed',
        description: 'You can now provide feedback',
      });

      if (onSaveSuccess) {
        onSaveSuccess();
      }
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      toast({
        title: 'Claim failed',
        description: message,
        variant: 'destructive',
      });
    }
  };

  // Complete review
  const handleComplete = async () => {
    if (!feedback.trim()) {
      toast({
        title: 'Feedback required',
        description: 'Please provide feedback before completing the review',
        variant: 'destructive',
      });
      return;
    }

    // Save any unsaved changes first
    let versionToUse = currentVersion;
    if (hasUnsavedChanges) {
      const saveResult = await saveChanges();
      if (!saveResult.success) {
        toast({
          title: 'Cannot complete',
          description: 'Please save your changes before completing',
          variant: 'destructive',
        });
        return;
      }
      if (saveResult.version !== undefined) {
        versionToUse = saveResult.version;
        // Sync state immediately so currentVersion is correct even if completeReview fails
        setCurrentVersion(saveResult.version);
      }
    }

    setIsCompleting(true);

    try {
      await completeReview({
        clerkId,
        review_id: review._id,
        feedback: feedback,
        version: versionToUse,
      });

      toast({
        title: 'Review completed',
        description: 'Student will be notified',
      });

      if (onCompleteSuccess) {
        onCompleteSuccess();
      }
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      toast({
        title: 'Complete failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const isWaiting = review.status === 'waiting';
  const isInProgress = review.status === 'in_review';
  const isCompleted = review.status === 'completed';

  return (
    <div className="space-y-6">
      {/* Review header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {review.asset_name}
            </CardTitle>
            <Badge variant={isCompleted ? 'default' : isInProgress ? 'secondary' : 'outline'}>
              {review.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{review.student_name}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">{review.student_email}</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Requested {format(new Date(review.requested_at), "MMM d, yyyy 'at' h:mm a")}
          </div>

          {review.reviewed_at && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              Completed {format(new Date(review.reviewed_at), "MMM d, yyyy 'at' h:mm a")}
            </div>
          )}

          {review.priority === 'urgent' && (
            <Badge variant="destructive" className="mt-2">
              Urgent Priority
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Document preview */}
      {review.asset_content && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Document Preview</CardTitle>
              <CommentButton
                targetType={review.asset_type === 'resume' ? 'resume' : 'cover_letter'}
                targetId={review.asset_id}
                studentId={review.student_id}
                section="document"
              />
            </div>
          </CardHeader>
          <CardContent>
            {review.asset_content.file_url ? (
              <div className="space-y-2">
                <a
                  href={review.asset_content.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  View full document →
                </a>
                {review.asset_content.content && (
                  <div className="p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {review.asset_content.content}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No document preview available</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Feedback editor */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Your Feedback</CardTitle>

            {isInProgress && (
              <div className="flex items-center gap-2">
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    <span className="text-sm text-muted-foreground">Saving...</span>
                  </>
                ) : hasUnsavedChanges ? (
                  <>
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                    <span className="text-sm text-muted-foreground">Unsaved changes</span>
                  </>
                ) : lastSaved ? (
                  <>
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-muted-foreground">
                      Saved {format(lastSaved, 'h:mm a')}
                    </span>
                  </>
                ) : null}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{saveError}</p>
            </div>
          )}

          {isWaiting && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <p className="text-sm text-blue-800 mb-3">This review is waiting to be claimed</p>
              <Button onClick={handleClaim}>Claim Review</Button>
            </div>
          )}

          {isCompleted ? (
            <div className="space-y-2">
              <Label>Feedback Provided</Label>
              <div className="p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                {review.feedback || 'No feedback provided'}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="feedback">Feedback *</Label>
              <Textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Provide detailed feedback on the document..."
                rows={12}
                disabled={!isInProgress}
              />
              <p className="text-xs text-muted-foreground">
                Your feedback will be shared with the student
              </p>
            </div>
          )}

          {isInProgress && (
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex gap-2">
                <Button
                  onClick={handleManualSave}
                  disabled={!hasUnsavedChanges || isSaving}
                  variant="outline"
                  size="sm"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Draft
                </Button>
              </div>

              <Button onClick={handleComplete} disabled={isCompleting || !feedback.trim()}>
                {isCompleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete Review
                  </>
                )}
              </Button>
            </div>
          )}

          {isInProgress && (
            <div className="text-xs text-muted-foreground">
              Version: {currentVersion} • Autosave enabled
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
