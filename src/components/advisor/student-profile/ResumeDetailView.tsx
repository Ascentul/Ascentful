'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import {
  Briefcase,
  Calendar,
  FileText,
  GraduationCap,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Star,
  User,
} from 'lucide-react';

import { CommentButton } from '@/components/advisor/comments/CommentButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { formatDateWithFallback } from '@/lib/date-utils';

interface ResumeDetailViewProps {
  resumeId: Id<'resumes'>;
  studentId: Id<'users'>;
}

interface ResumeContent {
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    website?: string;
  };
  summary?: string;
  experience?: Array<{
    id?: string;
    company: string;
    title: string;
    location?: string;
    start_date?: string;
    end_date?: string;
    current?: boolean;
    bullets?: string[];
  }>;
  education?: Array<{
    id?: string;
    school: string;
    degree: string;
    field?: string;
    location?: string;
    start_date?: string;
    end_date?: string;
    gpa?: string;
  }>;
  skills?: string[];
  projects?: Array<{
    id?: string;
    name: string;
    description?: string;
    technologies?: string[];
    url?: string;
  }>;
  certifications?: Array<{
    id?: string;
    name: string;
    issuer?: string;
    date?: string;
  }>;
}

export function ResumeDetailView({ resumeId, studentId }: ResumeDetailViewProps) {
  const { user } = useUser();
  const clerkId = user?.id;

  // Fetch resume details
  const resume = useQuery(
    api.advisor_students.getStudentResume,
    clerkId ? { clerkId, studentId, resumeId } : 'skip',
  );

  if (!clerkId) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Please sign in to view resume details.</p>
      </div>
    );
  }

  if (resume === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (resume === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Resume not found.</p>
      </div>
    );
  }

  const content = resume.content as ResumeContent | null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
            <FileText className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{resume.title}</h3>
            <p className="text-sm text-muted-foreground">
              Last updated: {formatDateWithFallback(resume.updated_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CommentButton
            targetType="resume"
            targetId={resumeId}
            studentId={studentId}
            variant="default"
          />
          {resume.template_id && (
            <Badge variant="outline" className="text-xs">
              {resume.template_id} template
            </Badge>
          )}
        </div>
      </div>

      <Separator />

      {/* Metadata */}
      <div className="flex flex-wrap gap-2">
        {resume.source && (
          <Badge variant="secondary" className="text-xs">
            {resume.source.replace(/_/g, ' ')}
          </Badge>
        )}
        {resume.intent && (
          <Badge variant="outline" className="text-xs">
            {resume.intent.replace(/_/g, ' ')}
          </Badge>
        )}
        <Badge variant={resume.visibility === 'public' ? 'default' : 'outline'} className="text-xs">
          {resume.visibility}
        </Badge>
      </div>

      {/* Resume Content Preview */}
      {content && (
        <div className="space-y-6 bg-white border rounded-lg p-4">
          {/* Contact */}
          {content.contact && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-semibold">{content.contact.name || 'Contact Information'}</h4>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {content.contact.email && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    {content.contact.email}
                  </div>
                )}
                {content.contact.phone && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {content.contact.phone}
                  </div>
                )}
                {content.contact.location && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {content.contact.location}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Summary */}
          {content.summary && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="text-sm font-medium">Summary</Label>
                <p className="text-sm text-muted-foreground">{content.summary}</p>
              </div>
            </>
          )}

          {/* Experience */}
          {content.experience && content.experience.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-semibold">Experience</h4>
                </div>
                {content.experience.map((exp, idx) => (
                  <div key={exp.id || idx} className="border-l-2 border-muted pl-3 space-y-1">
                    <p className="font-medium text-sm">{exp.title}</p>
                    <p className="text-sm text-muted-foreground">{exp.company}</p>
                    <p className="text-xs text-muted-foreground">
                      {exp.start_date || 'N/A'} - {exp.current ? 'Present' : exp.end_date || 'N/A'}
                      {exp.location && ` • ${exp.location}`}
                    </p>
                    {exp.bullets && exp.bullets.length > 0 && (
                      <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                        {exp.bullets.slice(0, 3).map((bullet, i) => (
                          <li key={i}>{bullet}</li>
                        ))}
                        {exp.bullets.length > 3 && (
                          <li className="text-primary">+{exp.bullets.length - 3} more bullets</li>
                        )}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Education */}
          {content.education && content.education.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-semibold">Education</h4>
                </div>
                {content.education.map((edu, idx) => (
                  <div key={edu.id || idx} className="border-l-2 border-muted pl-3 space-y-1">
                    <p className="font-medium text-sm">{edu.school}</p>
                    <p className="text-sm text-muted-foreground">
                      {edu.degree}
                      {edu.field && ` in ${edu.field}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {edu.start_date || 'N/A'} - {edu.end_date || 'N/A'}
                      {edu.gpa && ` • GPA: ${edu.gpa}`}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Skills */}
          {content.skills && content.skills.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-semibold">Skills</h4>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {content.skills.map((skill, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Projects */}
          {content.projects && content.projects.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-semibold">Projects</h4>
                {content.projects.map((project, idx) => (
                  <div key={project.id || idx} className="border-l-2 border-muted pl-3 space-y-1">
                    <p className="font-medium text-sm">{project.name}</p>
                    {project.description && (
                      <p className="text-xs text-muted-foreground">{project.description}</p>
                    )}
                    {project.technologies && project.technologies.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {project.technologies.map((tech, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {tech}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {!content && (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No content available for this resume.</p>
        </div>
      )}

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
