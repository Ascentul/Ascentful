/**
 * Types for the Kanban Board components
 */

import type { Id } from 'convex/_generated/dataModel';

export type ApplicationStatus = 'saved' | 'applied' | 'interview' | 'offer' | 'rejected';

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
