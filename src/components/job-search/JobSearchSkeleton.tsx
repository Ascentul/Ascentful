'use client';

import { Skeleton } from '@/components/ui/skeleton';

interface JobSearchSkeletonProps {
  count?: number;
}

export function JobSearchSkeleton({ count = 4 }: JobSearchSkeletonProps) {
  return (
    <div className="space-y-3" aria-label="Loading job results">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="bg-white rounded-xl border border-slate-200 px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            {/* Content skeleton */}
            <div className="flex-1 space-y-3">
              {/* Title */}
              <Skeleton className="h-5 w-3/4" />

              {/* Company & Location */}
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-28" />
              </div>

              {/* Posted date */}
              <Skeleton className="h-3 w-20" />

              {/* Description */}
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>

              {/* Tags */}
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-18 rounded-full" />
              </div>
            </div>

            {/* Actions skeleton */}
            <div className="flex sm:flex-col gap-2 sm:items-end">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-32" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
