'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import { Building2, Calendar, FileText, Loader2, Send } from 'lucide-react';

import { CommentButton } from '@/components/advisor/comments/CommentButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { formatDateWithFallback } from '@/lib/date-utils';

interface CoverLetterDetailViewProps {
  coverLetterId: Id<'cover_letters'>;
  studentId: Id<'users'>;
}

export function CoverLetterDetailView({ coverLetterId, studentId }: CoverLetterDetailViewProps) {
  const { user } = useUser();
  const clerkId = user?.id;

  // Fetch cover letter details
  const coverLetter = useQuery(
    api.advisor_students.getStudentCoverLetter,
    clerkId ? { clerkId, studentId, coverLetterId } : 'skip',
  );

  if (!clerkId) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Please sign in to view cover letter details.</p>
      </div>
    );
  }

  if (coverLetter === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (coverLetter === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Cover letter not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-pink-100 flex items-center justify-center">
            <Send className="h-5 w-5 text-pink-600" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{coverLetter.name}</h3>
            <p className="text-sm text-muted-foreground">
              Last updated: {formatDateWithFallback(coverLetter.updated_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CommentButton
            targetType="cover_letter"
            targetId={coverLetterId}
            studentId={studentId}
            variant="default"
          />
        </div>
      </div>

      <Separator />

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            Company
          </Label>
          <p className="text-sm font-medium">{coverLetter.company_name || 'Not specified'}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Position
          </Label>
          <p className="text-sm font-medium">{coverLetter.job_title}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Created
          </Label>
          <p className="text-sm">{formatDateWithFallback(coverLetter.created_at)}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Template</Label>
          <Badge variant="outline" className="text-xs">
            {coverLetter.template}
          </Badge>
        </div>
      </div>

      {/* Source badge */}
      {coverLetter.source && (
        <Badge variant="secondary" className="text-xs">
          {coverLetter.source.replace(/_/g, ' ')}
        </Badge>
      )}

      <Separator />

      {/* Cover Letter Content */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Content</Label>
        {coverLetter.content ? (
          <div className="bg-white border rounded-lg p-4 space-y-4">
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {coverLetter.content}
              </div>
            </div>
            {coverLetter.closing && (
              <div className="pt-4 border-t">
                <p className="text-sm italic text-muted-foreground">{coverLetter.closing}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No content available for this cover letter.</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4">
        <Button variant="outline" className="flex-1" disabled>
          Request Review
        </Button>
        <Button variant="outline" className="flex-1" disabled>
          Add to Review Queue
        </Button>
      </div>
    </div>
  );
}
