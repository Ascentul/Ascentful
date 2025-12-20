/**
 * Types for the Kanban Board components
 */

import type { Id } from 'convex/_generated/dataModel';

export type ApplicationStatus = 'saved' | 'applied' | 'interview' | 'offer' | 'rejected';

/**
 * Interview stage info for card display
 */
export interface InterviewStagePreview {
  id: string;
  title: string;
  scheduled_at: number;
  outcome?: 'scheduled' | 'passed' | 'failed' | null;
}

/**
 * Summary of interview progress for an application
 */
export interface InterviewSummary {
  completedCount: number; // outcome = "passed" | "failed"
  totalCount: number; // all interview_stages for this app
  stages: InterviewStagePreview[]; // All interview stages for display
}

/**
 * Preview of next open follow-up action for card display
 */
export interface ActionPreview {
  id: string;
  title: string;
  dueAt: number | null;
  isOverdue: boolean;
}

/**
 * Summary of follow-up actions for an application
 */
export interface ActionSummary {
  openCount: number; // follow_ups with status = "open"
  overdueCount: number; // open + due_at < now
  preview: ActionPreview | null; // Next open action for preview
  allActions?: ActionPreview[]; // All open actions for expandable list
}

export interface KanbanApplication {
  _id: Id<'applications'>;
  company: string;
  job_title: string;
  status: ApplicationStatus;
  url?: string | null;
  notes?: string | null;
  location?: string | null;
  source?: string | null;
  sort_order?: number | null;
  logo_url?: string | null;
  created_at: number;
  updated_at: number;
  // Fields for "Next Step" context display
  interviews?: Array<{
    id: string;
    date: number;
    interviewer?: string;
    interview_type?: string;
    notes?: string;
  }> | null;
  due_date?: number | null;
  next_step?: string | null;
  // Email auto-update fields
  auto_created?: boolean | null;
  review_status?: 'confirmed' | 'needs_review' | null;
  // Interview and follow-up summaries (computed server-side)
  interviewSummary?: InterviewSummary | null;
  actionSummary?: ActionSummary | null;
  // Computed last activity timestamp (max of app, interviews, followups)
  lastActivityAt?: number;
}

export interface StatusConfig {
  id: ApplicationStatus;
  label: string;
  color: string;
  borderColor: string;
}

export const STATUS_CONFIGS: StatusConfig[] = [
  {
    id: 'saved',
    label: 'In Progress',
    color: 'bg-slate-50',
    borderColor: 'border-slate-200',
  },
  {
    id: 'applied',
    label: 'Applied',
    color: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  {
    id: 'interview',
    label: 'Interviewing',
    color: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  {
    id: 'offer',
    label: 'Offer',
    color: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  {
    id: 'rejected',
    label: 'Rejected',
    color: 'bg-red-50',
    borderColor: 'border-red-200',
  },
];

export function getStatusConfig(status: ApplicationStatus): StatusConfig {
  return STATUS_CONFIGS.find((c) => c.id === status) || STATUS_CONFIGS[0];
}
