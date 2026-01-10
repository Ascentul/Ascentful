'use client';

/**
 * Student Advisor Review Detail - View Review Request Page
 *
 * Shows details of a specific review request and any feedback from the advisor.
 */

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  MessageSquare,
  Trash2,
  User,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { StudentUniversityGate } from '@/components/StudentUniversityGate';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

export default function ReviewDetailPage() {
  return (
    <StudentUniversityGate>
      <ReviewDetailContent />
    </StudentUniversityGate>
  );
}

function ReviewDetailContent() {
  const { user } = useUser();
  const params = useParams();
  const router = useRouter();
  const clerkId = user?.id;
  const requestId = params.id as Id<'student_review_requests'>;

  const [isCancelling, setIsCancelling] = useState(false);

  const review = useQuery(
    api.student_advisor_hub.getReviewRequestDetail,
    clerkId && requestId ? { clerkId, requestId } : 'skip',
  );

  const cancelRequest = useMutation(api.student_advisor_hub_mutations.cancelReviewRequest);

  const isLoading = review === undefined;

  const handleCancel = async () => {
    if (!clerkId || isCancelling) return;

    setIsCancelling(true);
    try {
      await cancelRequest({
        clerkId,
        requestId,
      });
      router.push('/student/advisor/reviews');
    } catch (error) {
      console.error('Failed to cancel request:', error);
      toast({
        title: 'Error',
        description: 'Failed to cancel review request. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCancelling(false);
    }
  };

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

  if (!review) {
    return (
      <div className="w-full">
        <div className="w-full gradient-border-bottom p-5 space-y-6 shadow-sm">
          <div className="flex items-center gap-4">
            <Link href="/student/advisor/reviews">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Review Request</h1>
          </div>

          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Review Not Found</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                This review request doesn't exist or you don't have access to view it.
              </p>
              <Link href="/student/advisor/reviews" className="mt-4 inline-block">
                <Button variant="outline">Back to Reviews</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const getAssetTypeLabel = (type: string) => {
    switch (type) {
      case 'resume':
        return 'Resume';
      case 'cover_letter':
        return 'Cover Letter';
      default:
        return 'Document';
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'draft':
        return {
          label: 'Draft',
          className: 'bg-slate-50 text-slate-600 border-slate-200',
          icon: FileText,
          description: 'This request has not been submitted yet.',
        };
      case 'submitted':
        return {
          label: 'Submitted',
          className: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: Clock,
          description: 'Waiting for your advisor to start the review.',
        };
      case 'in_review':
        return {
          label: 'In Review',
          className: 'bg-purple-50 text-purple-700 border-purple-200',
          icon: Eye,
          description: 'Your advisor is currently reviewing your document.',
        };
      case 'feedback_ready':
        return {
          label: 'Feedback Ready',
          className: 'bg-green-50 text-green-700 border-green-200',
          icon: MessageSquare,
          description: 'Your advisor has provided feedback on your document.',
        };
      case 'complete':
        return {
          label: 'Complete',
          className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: CheckCircle2,
          description: 'This review has been completed.',
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          className: 'bg-red-50 text-red-700 border-red-200',
          icon: XCircle,
          description: 'This review request was cancelled.',
        };
      default:
        return {
          label: status,
          className: 'bg-slate-50 text-slate-600 border-slate-200',
          icon: FileText,
          description: '',
        };
    }
  };

  const statusConfig = getStatusConfig(review.status);
  const StatusIcon = statusConfig.icon;

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const canCancel = ['draft', 'submitted'].includes(review.status);

  return (
    <div className="w-full">
      <div className="w-full gradient-border-bottom p-5 space-y-6 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/student/advisor/reviews">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{review.assetName}</h1>
                <Badge variant="outline" className={statusConfig.className}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusConfig.label}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {getAssetTypeLabel(review.asset_type)} Review Request
              </p>
            </div>
          </div>

          {canCancel && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  disabled={isCancelling}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  {isCancelling ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Cancel Request
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Review Request</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to cancel this review request? This action cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Request</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCancel} className="bg-red-600 hover:bg-red-700">
                    Cancel Request
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <StatusIcon className="h-5 w-5" />
                  Review Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div
                    className={`h-12 w-12 rounded-full flex items-center justify-center ${statusConfig.className}`}
                  >
                    <StatusIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold">{statusConfig.label}</p>
                    <p className="text-sm text-muted-foreground">{statusConfig.description}</p>
                  </div>
                </div>

                {/* Status Timeline */}
                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-6 w-6 rounded-full flex items-center justify-center ${
                        review.created_at ? 'bg-green-100 text-green-600' : 'bg-slate-100'
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Request Created</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(review.created_at)}
                      </p>
                    </div>
                  </div>

                  {review.submitted_at && (
                    <div className="flex items-center gap-3">
                      <div className="h-6 w-6 rounded-full flex items-center justify-center bg-green-100 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Submitted for Review</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(review.submitted_at)}
                        </p>
                      </div>
                    </div>
                  )}

                  {['in_review', 'feedback_ready', 'complete'].includes(review.status) && (
                    <div className="flex items-center gap-3">
                      <div className="h-6 w-6 rounded-full flex items-center justify-center bg-green-100 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Review Started</p>
                      </div>
                    </div>
                  )}

                  {['feedback_ready', 'complete'].includes(review.status) && (
                    <div className="flex items-center gap-3">
                      <div className="h-6 w-6 rounded-full flex items-center justify-center bg-green-100 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Feedback Provided</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Your Note */}
            {review.student_note && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Your Note</CardTitle>
                  <CardDescription>What you asked your advisor to focus on</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{review.student_note}</p>
                </CardContent>
              </Card>
            )}

            {/* Document Link */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Document
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="font-medium">{review.assetName}</p>
                      <p className="text-sm text-muted-foreground">
                        {getAssetTypeLabel(review.asset_type)}
                      </p>
                    </div>
                  </div>
                  {review.assetUrl ? (
                    <a href={review.assetUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open
                      </Button>
                    </a>
                  ) : review.resume_id ? (
                    <Link href={`/resumes/${review.resume_id}`}>
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </Link>
                  ) : review.cover_letter_id ? (
                    <Link href={`/cover-letters/${review.cover_letter_id}`}>
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </Link>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {/* Feedback Section - Placeholder for when feedback is available */}
            {review.status === 'feedback_ready' && (
              <Card className="border-green-200 bg-green-50/30">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-green-700">
                    <MessageSquare className="h-5 w-5" />
                    Advisor Feedback
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Your advisor has reviewed your document. Check the comments on your{' '}
                    {getAssetTypeLabel(review.asset_type).toLowerCase()} for detailed feedback.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Advisor Card */}
            {review.advisor && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Reviewer
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary-600" />
                    </div>
                    <div>
                      <p className="font-semibold">{review.advisor.name}</p>
                      <p className="text-sm text-muted-foreground">{review.advisor.email}</p>
                    </div>
                  </div>
                  <Link href="/student/advisor/messages" className="mt-4 block">
                    <Button variant="outline" className="w-full">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Send Message
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/student/advisor/reviews/new">
                  <Button variant="outline" className="w-full justify-start">
                    <FileText className="h-4 w-4 mr-2" />
                    Submit Another Review
                  </Button>
                </Link>
                <Link href="/student/advisor/reviews">
                  <Button variant="outline" className="w-full justify-start">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    View All Reviews
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
