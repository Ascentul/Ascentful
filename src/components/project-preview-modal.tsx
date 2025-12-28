'use client';

import { Calendar, ExternalLink, Github, MapPin } from 'lucide-react';
import Image from 'next/image';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Project {
  _id: string;
  title: string;
  description?: string;
  technologies: string[];
  url?: string;
  github_url?: string;
  image_url?: string;
  role?: string;
  start_date?: number;
  end_date?: number;
  company?: string;
}

interface ProjectPreviewModalProps {
  open: boolean;
  onClose: () => void;
  project: Project;
}

export function ProjectPreviewModal({ open, onClose, project }: ProjectPreviewModalProps) {
  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Present';
    return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{project.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Project Image */}
          {project.image_url && (
            <div className="w-full h-64 bg-muted relative rounded-lg overflow-hidden">
              <Image src={project.image_url} alt={project.title} fill className="object-cover" />
            </div>
          )}

          {/* Project Meta Info */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {project.role && (
              <div className="flex items-center gap-2">
                <span className="font-semibold">Role:</span>
                <span>{project.role}</span>
              </div>
            )}
            {project.company && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{project.company}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>
                {formatDate(project.start_date)} - {formatDate(project.end_date)}
              </span>
            </div>
          </div>

          {/* Description */}
          {project.description && (
            <div className="prose prose-sm max-w-none">
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {project.description}
              </p>
            </div>
          )}

          {/* Technologies */}
          {project.technologies && project.technologies.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Technologies Used</h3>
              <div className="flex flex-wrap gap-2">
                {project.technologies.map((tech, index) => (
                  <Badge key={index} variant="secondary" className="px-3 py-1">
                    {tech}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Links */}
          {(project.url || project.github_url) && (
            <div className="flex gap-3 pt-4 border-t">
              {project.url && /^https?:\/\//i.test(project.url) && (
                <Button variant="default" asChild>
                  <a href={project.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Live Demo
                  </a>
                </Button>
              )}
              {project.github_url && (
                <Button variant="outline" asChild>
                  <a href={project.github_url} target="_blank" rel="noopener noreferrer">
                    <Github className="h-4 w-4 mr-2" />
                    View Source Code
                  </a>
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
