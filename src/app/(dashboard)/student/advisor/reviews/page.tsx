'use client';

/**
 * Student Advisor Reviews - Review Requests Page
 *
 * Shows a student's document review requests (resumes, cover letters).
 * Students can see the status of their requests and any feedback from their advisor.
 */

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useQuery } from 'convex/react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Loader2,
  MessageSquare,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { StudentUniversityGate } from '@/components/StudentUniversityGate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function StudentReviewsPage() {
  return (
    <StudentUniversityGate>
      <StudentReviewsContent />
    </StudentUniversityGate>
  );
}

function StudentReviewsContent() {
  const { user } = useUser();
  const clerkId = user?.id;

  const [activeTab, setActiveTab] = useState<'pending' | 'complete'>('pending');

  // Fetch review requests based on filter
  const reviews = useQuery(
    api.student_advisor_hub.getMyReviewRequests,
    clerkId ? { clerkId, filter: activeTab } : 'skip',
  );

  const isLoading = reviews === undefined || !clerkId;

  return (
    <div className="w-full">
      <div className="w-full gradient-border-bottom p-5 space-y-6 shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/student/advisor">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="Back to advisor hub"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Document Reviews</h1>
            <p className="text-muted-foreground">Get feedback on your resumes and cover letters</p>
          </div>
          <Link href="/student/advisor/reviews/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Request Review
            </Button>
          </Link>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pending' | 'complete')}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="complete">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-6">
            {isLoading ? (
              <LoadingState />
            ) : reviews?.length === 0 ? (
              <EmptyState type="pending" />
            ) : (
              <ReviewsList reviews={reviews ?? []} />
            )}
          </TabsContent>

          <TabsContent value="complete" className="mt-6">
            {isLoading ? (
              <LoadingState />
            ) : reviews?.length === 0 ? (
              <EmptyState type="complete" />
            ) : (
              <ReviewsList reviews={reviews ?? []} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ============================================================================
// Reviews List Component
// ============================================================================

// Use Convex-generated type from getMyReviewRequests query return
type ReviewRequest = Awaited<
  ReturnType<typeof api.student_advisor_hub.getMyReviewRequests>
>[number];

function ReviewsList({ reviews }: { reviews: ReviewRequest[] }) {
  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <ReviewCard key={review._id} review={review} />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: ReviewRequest }) {
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
        };
      case 'submitted':
        return {
          label: 'Submitted',
          className: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: Clock,
        };
      case 'in_review':
        return {
          label: 'In Review',
          className: 'bg-purple-50 text-purple-700 border-purple-200',
          icon: Eye,
        };
      case 'feedback_ready':
        return {
          label: 'Feedback Ready',
          className: 'bg-green-50 text-green-700 border-green-200',
          icon: MessageSquare,
        };
      case 'complete':
        return {
          label: 'Complete',
          className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: CheckCircle2,
        };
      default:
        return {
          label: status,
          className: 'bg-slate-50 text-slate-600 border-slate-200',
          icon: FileText,
        };
    }
  };

  const statusConfig = getStatusConfig(review.status);
  const StatusIcon = statusConfig.icon;

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return formatDate(timestamp);
  };

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="h-12 w-12 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
              <FileText className="h-6 w-6 text-primary-600" />
            </div>

            {/* Info */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">{review.assetName}</h3>
                <Badge variant="outline" className={statusConfig.className}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusConfig.label}
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground">
                {getAssetTypeLabel(review.asset_type)} &bull;{' '}
                {review.submitted_at
                  ? `Submitted ${getRelativeTime(review.submitted_at)}`
                  : `Created ${getRelativeTime(review.created_at)}`}
              </p>

              {review.student_note && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  "{review.student_note}"
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {review.status === 'feedback_ready' && (
              <Badge className="bg-green-100 text-green-800 border-green-200">New Feedback</Badge>
            )}
            <Link href={`/student/advisor/reviews/${review._id}`}>
              <Button variant="ghost" size="sm">
                View Details
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Empty & Loading States
// ============================================================================

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function EmptyState({ type }: { type: 'pending' | 'complete' }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">
          {type === 'pending' ? 'No Pending Reviews' : 'No Completed Reviews'}
        </h3>
        <p className="text-muted-foreground max-w-md mx-auto mb-6">
          {type === 'pending'
            ? "You don't have any review requests waiting for feedback. Submit a document to get expert advice from your advisor."
            : "You haven't received any completed reviews yet. Your completed reviews will appear here."}
        </p>
        {type === 'pending' && (
          <Link href="/student/advisor/reviews/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Request a Review
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
