// CohortOS Demo Types
// This is an isolated demo - no Convex/Clerk dependencies

// Status enum for student placement status
export type Status = 'searching' | 'applying' | 'interviewing' | 'offered' | 'placed';

// Program enum for MBA programs
export type Program = 'ft-mba' | 'pt-mba' | 'emba';

// Note type for communication logs
export type NoteType = 'note' | 'email' | 'sms' | 'call' | 'survey';

// Outreach status for tracking contact recency
export type OutreachStatus = 'recent' | 'due' | 'overdue';

// Contact types for outreach tracking
export type ContactType = 'email' | 'sms' | 'call' | 'meeting';

// Coach/Advisor interface
export interface Coach {
  id: string;
  name: string;
  email: string;
  title: string;
  role?: string;
  studentCount?: number;
}

// Student interface
export interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
  program: Program;
  status: Status;
  coachId: string;
  isInternational: boolean;
  requiresCpt: boolean;
  cptDeadline?: string; // ISO date string
  hasBlocker: boolean;
  blockerNote?: string;
  targetIndustry: string;
  targetRole: string;
  linkedinUrl?: string;
  lastUpdated: string; // ISO date string
  createdAt: string; // ISO date string
  // Outreach tracking fields
  lastContactDate?: string; // ISO date string
  lastContactType?: ContactType;
  totalTouchpoints: number; // Total outreach count
}

// Timeline entry for activity feed
export interface TimelineEntry {
  id: string;
  studentId: string;
  coachId: string;
  coachName: string;
  type: NoteType;
  content: string;
  createdAt: string; // ISO date string
  // Engagement tracking (for emails/SMS)
  opened?: boolean;
  openedAt?: string; // ISO date string
  replied?: boolean;
  repliedAt?: string; // ISO date string
  resultedInAction?: boolean;
  actionNote?: string;
}

// Suggested action for outreach queue
export type SuggestedActionType = 'follow-up' | 'check-in' | 'reminder' | 'urgent';

export interface SuggestedAction {
  id: string;
  studentId: string;
  studentName: string;
  type: SuggestedActionType;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  suggestedAction: string;
}

// Enhanced survey response tracking per stage
export interface SurveyResponseStage {
  count: number;
  percentage: number;
  date?: string;
}

// Survey interface with response funnel
export interface Survey {
  id: string;
  name: string;
  dateSent: string; // ISO date string
  totalSent: number;
  responses: {
    initial: SurveyResponseStage;
    afterSmsReminder: SurveyResponseStage;
    afterEmailReminder: SurveyResponseStage;
    final: SurveyResponseStage;
  };
  nonResponders: number;
}

// Individual survey response
export interface SurveyResponse {
  id: string;
  studentId: string;
  surveyId: string;
  responses: Record<string, string | number | boolean>;
  respondedAt: string; // ISO date string
}

// Communication/activity note (legacy - use TimelineEntry instead)
export interface Note {
  id: string;
  studentId: string;
  coachId: string;
  content: string;
  type: NoteType;
  createdAt: string; // ISO date string
}

// Navigation item for the nav bar
export interface NavItem {
  label: string;
  href: string;
  icon: string;
  disabled?: boolean;
}

// Pipeline stats for dashboard
export interface PipelineStats {
  total: number;
  searching: number;
  applying: number;
  interviewing: number;
  offered: number;
  placed: number;
}

// Alert counts for dashboard
export interface AlertCounts {
  staleCount: number;
  blockerCount: number;
  internationalSearchingCount: number;
  cptDeadlineSoonCount: number;
  needsOutreachCount: number;
}

// Status display configuration
export const STATUS_CONFIG: Record<Status, { label: string; color: string; bgColor: string }> = {
  searching: { label: 'Searching', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  applying: { label: 'Applying', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  interviewing: { label: 'Interviewing', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  offered: { label: 'Offered', color: 'text-green-700', bgColor: 'bg-green-100' },
  placed: { label: 'Placed', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
};

// Program display configuration
export const PROGRAM_CONFIG: Record<Program, { label: string; shortLabel: string }> = {
  'ft-mba': { label: 'Full-Time MBA', shortLabel: 'FT-MBA' },
  'pt-mba': { label: 'Part-Time MBA', shortLabel: 'PT-MBA' },
  emba: { label: 'Executive MBA', shortLabel: 'EMBA' },
};

// Outreach status display configuration
export const OUTREACH_STATUS_CONFIG: Record<
  OutreachStatus,
  { label: string; color: string; bgColor: string }
> = {
  recent: { label: 'Recent', color: 'text-green-700', bgColor: 'bg-green-100' },
  due: { label: 'Due Soon', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  overdue: { label: 'Overdue', color: 'text-red-700', bgColor: 'bg-red-100' },
};
