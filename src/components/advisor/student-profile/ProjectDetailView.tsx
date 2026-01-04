'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import {
  Building2,
  Calendar,
  ExternalLink,
  FolderKanban,
  Github,
  Link as LinkIcon,
  Loader2,
  User,
} from 'lucide-react';

import { CommentButton } from '@/components/advisor/comments/CommentButton';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { formatDateWithFallback } from '@/lib/date-utils';

interface ProjectDetailViewProps {
  projectId: Id<'projects'>;
  studentId: Id<'users'>;
}

export function ProjectDetailView({ projectId, studentId }: ProjectDetailViewProps) {
  const { user } = useUser();
  const clerkId = user?.id;

  // Fetch project details
  const project = useQuery(
    api.advisor_students.getStudentProject,
    clerkId ? { clerkId, studentId, projectId } : 'skip',
  );

  if (!clerkId) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Please sign in to view project details.</p>
      </div>
    );
  }

  if (project === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Project not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
            <FolderKanban className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{project.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {project.type}
              </Badge>
            </div>
          </div>
        </div>
        <CommentButton
          targetType="profile"
          targetId={projectId}
          studentId={studentId}
          variant="default"
          section="project"
        />
      </div>

      <Separator />

      {/* Project image */}
      {project.image_url && (
        <div className="rounded-lg overflow-hidden border">
          <img
            src={project.image_url}
            alt={project.title || 'Project image'}
            className="w-full h-40 object-cover"
          />
        </div>
      )}

      {/* Details */}
      <div className="grid grid-cols-2 gap-4">
        {project.role && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" />
              Role
            </Label>
            <p className="text-sm font-medium">{project.role}</p>
          </div>
        )}
        {project.company && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              Company/Organization
            </Label>
            <p className="text-sm font-medium">{project.company}</p>
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Start Date
          </Label>
          <p className="text-sm">{formatDateWithFallback(project.start_date)}</p>
        </div>
        {project.end_date && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              End Date
            </Label>
            <p className="text-sm">{formatDateWithFallback(project.end_date)}</p>
          </div>
        )}
      </div>

      {/* Description */}
      {project.description && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label className="text-sm font-medium">Description</Label>
            <p className="text-sm bg-muted/50 rounded-lg p-3 whitespace-pre-wrap">
              {project.description}
            </p>
          </div>
        </>
      )}

      {/* Technologies */}
      {project.technologies && project.technologies.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label className="text-sm font-medium">Technologies</Label>
            <div className="flex flex-wrap gap-1.5">
              {project.technologies.map((tech, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {tech}
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Links */}
      {(project.url || project.github_url) && (
        <>
          <Separator />
          <div className="space-y-3">
            <Label className="text-sm font-medium">Links</Label>
            <div className="flex flex-col gap-2">
              {project.url && (
                <a
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <LinkIcon className="h-4 w-4" />
                  Project Link
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {project.github_url && (
                <a
                  href={project.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Github className="h-4 w-4" />
                  GitHub Repository
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </>
      )}

      {/* Timestamps */}
      <div className="text-xs text-muted-foreground pt-4 border-t">
        <p>Created: {formatDateWithFallback(project.created_at)}</p>
        <p>Updated: {formatDateWithFallback(project.updated_at)}</p>
      </div>
    </div>
  );
}
