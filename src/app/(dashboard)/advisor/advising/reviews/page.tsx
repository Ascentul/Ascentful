'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useQuery } from 'convex/react';
import { AlertCircle, CheckCircle, Clock, FileEdit } from 'lucide-react';

import { AdvisorGate } from '@/components/advisor/AdvisorGate';
import { ReviewQueue } from '@/components/advisor/reviews/ReviewQueue';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';

export default function AdvisorReviewsPage() {
  const { user, isLoaded } = useUser();
  const clerkId = user?.id;

  const reviews = useQuery(api.advisor_reviews_queries.getReviews, clerkId ? { clerkId } : 'skip');

  const stats = useQuery(
    api.advisor_reviews_queries.getReviewQueueStats,
    clerkId ? { clerkId } : 'skip',
  );

  if (!isLoaded) {
    return <div className="container mx-auto p-6">Loading...</div>;
  }

  if (!user) {
    return <div className="container mx-auto p-6">Please sign in to view reviews.</div>;
  }

  return (
    <ErrorBoundary>
      <AdvisorGate requiredFlag="advisor.advising">
        <div className="w-full">
          <div className="w-full gradient-border-bottom p-5 space-y-6 shadow-sm">
            <PageHeader title="Reviews" description="Review student resumes and cover letters" />

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="py-5 px-5">
                <div className="flex items-center gap-3">
                  <p className="text-xl font-semibold leading-none">{stats?.waiting ?? '-'}</p>
                  <p className="text-xs text-muted-foreground">Waiting</p>
                </div>
              </Card>

              <Card className="py-5 px-5">
                <div className="flex items-center gap-3">
                  <p className="text-xl font-semibold leading-none">{stats?.inProgress ?? '-'}</p>
                  <p className="text-xs text-muted-foreground">In Progress</p>
                </div>
              </Card>

              <Card className="py-5 px-5">
                <div className="flex items-center gap-3">
                  <p className="text-xl font-semibold leading-none">{stats?.completed ?? '-'}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
              </Card>

              <Card className="py-5 px-5">
                <div className="flex items-center gap-3">
                  <p className="text-xl font-semibold leading-none text-red-600">
                    {stats?.urgent ?? '-'}
                  </p>
                  <p className="text-xs text-muted-foreground">Urgent</p>
                </div>
              </Card>
            </div>

            {/* Review Queue */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileEdit className="h-5 w-5" />
                  Review Queue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ReviewQueue reviews={reviews || []} isLoading={reviews === undefined} />
              </CardContent>
            </Card>
          </div>
        </div>
      </AdvisorGate>
    </ErrorBoundary>
  );
}
