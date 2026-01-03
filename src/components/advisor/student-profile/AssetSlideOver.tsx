'use client';

import { Id } from 'convex/_generated/dataModel';
import * as React from 'react';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

import { ApplicationDetailView } from './ApplicationDetailView';
import { CoverLetterDetailView } from './CoverLetterDetailView';
import { GoalDetailView } from './GoalDetailView';
import { ProjectDetailView } from './ProjectDetailView';
import { ResumeDetailView } from './ResumeDetailView';

export type AssetType = 'application' | 'goal' | 'resume' | 'cover_letter' | 'project';

export interface SelectedAsset {
  type: AssetType;
  id: string;
}

interface AssetSlideOverProps {
  selectedAsset: SelectedAsset | null;
  studentId: Id<'users'>;
  onClose: () => void;
}

const ASSET_TYPE_CONFIG: Record<AssetType, { title: string; description: string }> = {
  application: {
    title: 'Application Details',
    description: 'View and manage job application',
  },
  goal: {
    title: 'Goal Details',
    description: 'View and track career goal progress',
  },
  resume: {
    title: 'Resume',
    description: 'Review resume content and add feedback',
  },
  cover_letter: {
    title: 'Cover Letter',
    description: 'Review cover letter and add feedback',
  },
  project: {
    title: 'Project Details',
    description: 'View project information',
  },
};

export function AssetSlideOver({ selectedAsset, studentId, onClose }: AssetSlideOverProps) {
  const isOpen = selectedAsset !== null;

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const config = selectedAsset ? ASSET_TYPE_CONFIG[selectedAsset.type] : null;

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[600px] sm:max-w-xl overflow-y-auto">
        {selectedAsset && config && (
          <>
            <SheetHeader className="mb-4">
              <SheetTitle>{config.title}</SheetTitle>
              <SheetDescription>{config.description}</SheetDescription>
            </SheetHeader>

            <div className="flex-1">
              {selectedAsset.type === 'application' && (
                <ApplicationDetailView
                  applicationId={selectedAsset.id as Id<'applications'>}
                  studentId={studentId}
                  onClose={onClose}
                />
              )}
              {selectedAsset.type === 'goal' && (
                <GoalDetailView
                  goalId={selectedAsset.id as Id<'goals'>}
                  studentId={studentId}
                  onClose={onClose}
                />
              )}
              {selectedAsset.type === 'resume' && (
                <ResumeDetailView
                  resumeId={selectedAsset.id as Id<'resumes'>}
                  studentId={studentId}
                  onClose={onClose}
                />
              )}
              {selectedAsset.type === 'cover_letter' && (
                <CoverLetterDetailView
                  coverLetterId={selectedAsset.id as Id<'cover_letters'>}
                  studentId={studentId}
                  onClose={onClose}
                />
              )}
              {selectedAsset.type === 'project' && (
                <ProjectDetailView
                  projectId={selectedAsset.id as Id<'projects'>}
                  studentId={studentId}
                  onClose={onClose}
                />
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
