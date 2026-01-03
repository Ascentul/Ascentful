'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import {
  Briefcase,
  Building2,
  Calendar,
  Clock,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  Loader2,
  MapPin,
  Save,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { CommentButton } from '@/components/advisor/comments/CommentButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

interface ApplicationDetailViewProps {
  applicationId: Id<'applications'>;
  studentId: Id<'users'>;
  onClose: () => void;
}

const STAGE_OPTIONS = [
  { value: 'Prospect', label: 'Prospect', color: 'bg-slate-100 text-slate-700' },
  { value: 'Applied', label: 'Applied', color: 'bg-blue-100 text-blue-700' },
  { value: 'Interview', label: 'Interview', color: 'bg-purple-100 text-purple-700' },
  { value: 'Offer', label: 'Offer', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'Accepted', label: 'Accepted', color: 'bg-green-100 text-green-700' },
  { value: 'Rejected', label: 'Rejected', color: 'bg-red-100 text-red-700' },
  { value: 'Withdrawn', label: 'Withdrawn', color: 'bg-amber-100 text-amber-700' },
  { value: 'Archived', label: 'Archived', color: 'bg-gray-100 text-gray-700' },
];

function getStageColor(stage: string): string {
  return STAGE_OPTIONS.find((s) => s.value === stage)?.color || 'bg-slate-100 text-slate-700';
}

function formatDate(timestamp?: number | null): string {
  if (!timestamp) return 'Not set';
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ApplicationDetailView({
  applicationId,
  studentId,
  onClose,
}: ApplicationDetailViewProps) {
  const { user } = useUser();
  const clerkId = user?.id;

  const [isEditing, setIsEditing] = useState(false);
  const [editedStage, setEditedStage] = useState<string | null>(null);
  const [editedNotes, setEditedNotes] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch application details
  const application = useQuery(
    api.advisor_students.getStudentApplication,
    clerkId ? { clerkId, studentId, applicationId } : 'skip',
  );

  // Mutation for updating application
  const updateApplication = useMutation(api.advisor_students.updateStudentApplication);

  const handleSave = async () => {
    if (!clerkId || !application) return;

    setIsSaving(true);
    try {
      await updateApplication({
        clerkId,
        studentId,
        applicationId,
        stage: editedStage || undefined,
        notes: editedNotes !== null ? editedNotes : undefined,
      });
      toast.success('Application updated');
      setIsEditing(false);
      setEditedStage(null);
      setEditedNotes(null);
    } catch (error) {
      console.error('Failed to update application:', error);
      toast.error('Failed to update application');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedStage(null);
    setEditedNotes(null);
  };

  const startEditing = () => {
    setEditedStage(application?.stage || null);
    setEditedNotes(application?.notes || '');
    setIsEditing(true);
  };

  if (!clerkId) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Please sign in to view application details.</p>
      </div>
    );
  }

  if (application === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (application === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Application not found.</p>
      </div>
    );
  }

  const currentStage = isEditing && editedStage ? editedStage : application.stage || 'Prospect';
  const currentNotes = isEditing && editedNotes !== null ? editedNotes : application.notes || '';

  return (
    <div className="space-y-6">
      {/* Header with company info and actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {application.logo_url ? (
            <img
              src={application.logo_url}
              alt={`${application.company} logo`}
              className="h-12 w-12 rounded-lg object-contain bg-white border"
            />
          ) : (
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
          )}
          <div>
            <h3 className="font-semibold text-lg">{application.company}</h3>
            <p className="text-muted-foreground">{application.job_title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CommentButton
            targetType="application"
            targetId={applicationId}
            studentId={studentId}
            variant="default"
          />
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={startEditing}>
              Edit
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      <Separator />

      {/* Stage */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Stage</Label>
        {isEditing ? (
          <Select value={currentStage} onValueChange={setEditedStage}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${option.color.split(' ')[0]}`} />
                    {option.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge className={getStageColor(currentStage)}>{currentStage}</Badge>
        )}
      </div>

      {/* Application Details */}
      <div className="grid grid-cols-2 gap-4">
        {application.location && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Location
            </Label>
            <p className="text-sm">{application.location}</p>
          </div>
        )}
        {application.source && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              Source
            </Label>
            <p className="text-sm">{application.source}</p>
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Applied Date
          </Label>
          <p className="text-sm">{formatDate(application.applied_at)}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Last Updated
          </Label>
          <p className="text-sm">
            {formatDate(application.stage_set_at || application.updated_at)}
          </p>
        </div>
      </div>

      {/* Job URL */}
      {application.url && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <LinkIcon className="h-3 w-3" />
            Job Posting
          </Label>
          <a
            href={application.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            View job posting
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      <Separator />

      {/* Notes */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Notes
        </Label>
        {isEditing ? (
          <Textarea
            value={currentNotes}
            onChange={(e) => setEditedNotes(e.target.value)}
            placeholder="Add notes about this application..."
            rows={4}
          />
        ) : currentNotes ? (
          <div className="text-sm bg-muted/50 rounded-lg p-3 whitespace-pre-wrap">
            {currentNotes}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No notes added</p>
        )}
      </div>

      {/* Related documents */}
      {(application.resume_id || application.cover_letter_id) && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label className="text-sm font-medium">Related Documents</Label>
            <div className="flex gap-2">
              {application.resume_id && (
                <Badge variant="outline" className="text-xs">
                  Resume attached
                </Badge>
              )}
              {application.cover_letter_id && (
                <Badge variant="outline" className="text-xs">
                  Cover letter attached
                </Badge>
              )}
            </div>
          </div>
        </>
      )}

      {/* Next Step (if set) */}
      {application.next_step && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label className="text-sm font-medium">Next Step</Label>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm">{application.next_step}</p>
              {application.due_date && (
                <p className="text-xs text-muted-foreground mt-1">
                  Due: {formatDate(application.due_date)}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
