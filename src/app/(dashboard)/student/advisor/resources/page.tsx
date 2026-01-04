'use client';

/**
 * Student Advisor Resources - Shared Resources Page
 *
 * Shows resources shared by the advisor that students can view and pin.
 */

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import {
  AlertCircle,
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  Loader2,
  Tag,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { StudentUniversityGate } from '@/components/StudentUniversityGate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ResourcesPage() {
  return (
    <StudentUniversityGate>
      <ResourcesContent />
    </StudentUniversityGate>
  );
}

function ResourcesContent() {
  const { user } = useUser();
  const clerkId = user?.id;

  const [activeTab, setActiveTab] = useState<'all' | 'pinned'>('all');

  // Fetch resources
  const resources = useQuery(
    api.student_advisor_hub.getSharedResources,
    clerkId ? { clerkId } : 'skip',
  );

  const isLoading = resources === undefined;

  // Filter based on tab
  const filteredResources =
    activeTab === 'pinned' ? resources?.filter((r) => r.isPinned) : resources;

  const pinnedCount = resources?.filter((r) => r.isPinned).length ?? 0;

  return (
    <div className="w-full">
      <div className="w-full gradient-border-bottom p-5 space-y-6 shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/student/advisor">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Resources</h1>
            <p className="text-muted-foreground">Helpful resources shared by your advisor</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'all' | 'pinned')}>
          <TabsList>
            <TabsTrigger value="all">All Resources</TabsTrigger>
            <TabsTrigger value="pinned">
              Pinned
              {pinnedCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {pinnedCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            {isLoading ? (
              <LoadingState />
            ) : filteredResources?.length === 0 ? (
              <EmptyState type="all" />
            ) : (
              <ResourcesGrid resources={filteredResources ?? []} clerkId={clerkId!} />
            )}
          </TabsContent>

          <TabsContent value="pinned" className="mt-6">
            {isLoading ? (
              <LoadingState />
            ) : filteredResources?.length === 0 ? (
              <EmptyState type="pinned" />
            ) : (
              <ResourcesGrid resources={filteredResources ?? []} clerkId={clerkId!} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ============================================================================
// Resources Grid Component
// ============================================================================

interface Resource {
  _id: Id<'advisor_resources'>;
  title: string;
  description?: string;
  url: string;
  tags: string[];
  isPinned: boolean;
  created_at: number;
}

function ResourcesGrid({ resources, clerkId }: { resources: Resource[]; clerkId: string }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {resources.map((resource) => (
        <ResourceCard key={resource._id} resource={resource} clerkId={clerkId} />
      ))}
    </div>
  );
}

function ResourceCard({ resource, clerkId }: { resource: Resource; clerkId: string }) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pinResource = useMutation(api.student_advisor_hub_mutations.pinResource);
  const unpinResource = useMutation(api.student_advisor_hub_mutations.unpinResource);

  const handleTogglePin = async () => {
    if (isUpdating) return;

    setIsUpdating(true);
    setError(null);
    try {
      if (resource.isPinned) {
        await unpinResource({ clerkId, resourceId: resource._id });
      } else {
        await pinResource({ clerkId, resourceId: resource._id });
      }
    } catch (err) {
      console.error('Failed to toggle pin:', err);
      setError(resource.isPinned ? 'Failed to unpin' : 'Failed to pin');
      // Auto-clear error after 3 seconds
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsUpdating(false);
    }
  };

  // Extract domain from URL for display
  const getDomain = (url: string) => {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      return domain;
    } catch {
      return url;
    }
  };

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base line-clamp-2">{resource.title}</CardTitle>
            <CardDescription className="flex items-center gap-1 mt-1">
              <LinkIcon className="h-3 w-3" />
              {getDomain(resource.url)}
            </CardDescription>
          </div>
          <button
            onClick={handleTogglePin}
            disabled={isUpdating}
            className={`flex-shrink-0 p-2 rounded-full transition-colors ${
              isUpdating
                ? 'opacity-50 cursor-not-allowed'
                : resource.isPinned
                  ? 'text-primary-600 bg-primary-50 hover:bg-primary-100'
                  : 'text-slate-400 hover:text-primary-600 hover:bg-slate-100'
            }`}
            title={resource.isPinned ? 'Unpin resource' : 'Pin resource'}
          >
            {isUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : resource.isPinned ? (
              <BookmarkCheck className="h-4 w-4" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
          </button>
        </div>
        {error && (
          <div className="flex items-center gap-1 text-red-600 text-xs mt-2">
            <AlertCircle className="h-3 w-3" />
            <span>{error}</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {resource.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{resource.description}</p>
        )}

        {resource.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {resource.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs px-2 py-0">
                {tag}
              </Badge>
            ))}
            {resource.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs px-2 py-0">
                +{resource.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        <a href={resource.url} target="_blank" rel="noopener noreferrer" className="block">
          <Button variant="outline" size="sm" className="w-full">
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Resource
          </Button>
        </a>
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

function EmptyState({ type }: { type: 'all' | 'pinned' }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-12 text-center">
        {type === 'pinned' ? (
          <>
            <Bookmark className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Pinned Resources</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Pin resources you find helpful for quick access. Click the bookmark icon on any
              resource to pin it.
            </p>
          </>
        ) : (
          <>
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Resources Available</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Your advisor hasn't shared any resources yet. Check back later or ask your advisor for
              helpful materials.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
