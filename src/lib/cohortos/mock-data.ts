// CohortOS Mock Data
// Realistic demo data for Pepperdine MBA career services

import type {
  AlertCounts,
  Coach,
  ContactType,
  OutreachStatus,
  PipelineStats,
  Status,
  Student,
  SuggestedAction,
  Survey,
  SurveyResponse,
  TimelineEntry,
} from './types';

// Demo "current date" for calculating stale students
const DEMO_CURRENT_DATE = '2026-01-29';

// =============================================================================
// COACHES
// =============================================================================

export const mockCoaches: Coach[] = [
  {
    id: 'coach-1',
    name: 'Kazah Mims',
    email: 'kazah.mims@pepperdine.edu',
    title: 'Director of Career Advancement',
    role: 'Director',
    studentCount: 9,
  },
  {
    id: 'coach-2',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@pepperdine.edu',
    title: 'Career Coach',
    role: 'Coach',
    studentCount: 6,
  },
];

// =============================================================================
// STUDENTS (15 total)
// Distribution: 3 Searching, 4 Applying, 3 Interviewing, 2 Offered, 3 Placed
// =============================================================================

export const mockStudents: Student[] = [
  {
    id: 'student-1',
    name: 'Sarah Chen',
    email: 'sarah.chen@pepperdine.edu',
    phone: '(626) 555-1234',
    program: 'ft-mba',
    status: 'interviewing',
    coachId: 'coach-1',
    isInternational: true,
    requiresCpt: true,
    cptDeadline: '2026-03-15',
    hasBlocker: true,
    blockerNote: 'Needs CPT authorization letter',
    targetIndustry: 'Consulting',
    targetRole: 'Strategy Consultant Intern',
    linkedinUrl: 'https://linkedin.com/in/sarah-chen',
    lastUpdated: '2026-01-28T10:30:00Z',
    createdAt: '2025-09-01T09:00:00Z',
    lastContactDate: '2026-01-28T14:30:00Z',
    lastContactType: 'email',
    totalTouchpoints: 8,
  },
  {
    id: 'student-2',
    name: 'Michael Torres',
    email: 'michael.torres@pepperdine.edu',
    phone: '(310) 555-2345',
    program: 'ft-mba',
    status: 'applying',
    coachId: 'coach-1',
    isInternational: false,
    requiresCpt: false,
    hasBlocker: false,
    targetIndustry: 'Tech',
    targetRole: 'Product Management Intern',
    linkedinUrl: 'https://linkedin.com/in/michael-torres',
    lastUpdated: '2026-01-25T14:15:00Z',
    createdAt: '2025-09-01T09:00:00Z',
    lastContactDate: '2026-01-25T14:15:00Z',
    lastContactType: 'call',
    totalTouchpoints: 5,
  },
  {
    id: 'student-3',
    name: 'Priya Sharma',
    email: 'priya.sharma@pepperdine.edu',
    phone: '(818) 555-3456',
    program: 'ft-mba',
    status: 'searching',
    coachId: 'coach-1',
    isInternational: true,
    requiresCpt: true,
    cptDeadline: '2026-03-15',
    hasBlocker: true,
    blockerNote: 'Limited sponsorship options',
    targetIndustry: 'Finance',
    targetRole: 'Investment Banking Summer Analyst',
    linkedinUrl: 'https://linkedin.com/in/priya-sharma',
    lastUpdated: '2026-01-20T11:00:00Z',
    createdAt: '2025-09-01T09:00:00Z',
    lastContactDate: '2026-01-15T10:00:00Z',
    lastContactType: 'email',
    totalTouchpoints: 3,
  },
  {
    id: 'student-4',
    name: 'James Wilson',
    email: 'james.wilson@pepperdine.edu',
    phone: '(213) 555-4567',
    program: 'pt-mba',
    status: 'placed',
    coachId: 'coach-2',
    isInternational: false,
    requiresCpt: false,
    hasBlocker: false,
    targetIndustry: 'Healthcare',
    targetRole: 'Healthcare Strategy Intern',
    linkedinUrl: 'https://linkedin.com/in/james-wilson',
    lastUpdated: '2026-01-22T09:30:00Z',
    createdAt: '2025-09-01T09:00:00Z',
    lastContactDate: '2026-01-22T09:30:00Z',
    lastContactType: 'email',
    totalTouchpoints: 6,
  },
  {
    id: 'student-5',
    name: 'Emily Park',
    email: 'emily.park@pepperdine.edu',
    phone: '(626) 555-5678',
    program: 'ft-mba',
    status: 'interviewing',
    coachId: 'coach-1',
    isInternational: false,
    requiresCpt: false,
    hasBlocker: false,
    targetIndustry: 'Tech',
    targetRole: 'Software Engineering Intern',
    linkedinUrl: 'https://linkedin.com/in/emily-park',
    lastUpdated: '2026-01-27T16:45:00Z',
    createdAt: '2025-09-01T09:00:00Z',
    lastContactDate: '2026-01-27T16:45:00Z',
    lastContactType: 'sms',
    totalTouchpoints: 4,
  },
  {
    id: 'student-6',
    name: 'David Kim',
    email: 'david.kim@pepperdine.edu',
    phone: '(310) 555-6789',
    program: 'ft-mba',
    status: 'applying',
    coachId: 'coach-2',
    isInternational: true,
    requiresCpt: false,
    hasBlocker: false,
    targetIndustry: 'Consulting',
    targetRole: 'Management Consultant Intern',
    linkedinUrl: 'https://linkedin.com/in/david-kim',
    lastUpdated: '2026-01-18T13:20:00Z',
    createdAt: '2025-09-01T09:00:00Z',
    lastContactDate: '2026-01-10T13:20:00Z',
    lastContactType: 'email',
    totalTouchpoints: 2,
  },
  {
    id: 'student-7',
    name: 'Rachel Adams',
    email: 'rachel.adams@pepperdine.edu',
    phone: '(818) 555-7890',
    program: 'pt-mba',
    status: 'searching',
    coachId: 'coach-2',
    isInternational: false,
    requiresCpt: false,
    hasBlocker: false,
    targetIndustry: 'Marketing',
    targetRole: 'Brand Marketing Intern',
    linkedinUrl: 'https://linkedin.com/in/rachel-adams',
    lastUpdated: '2026-01-10T10:00:00Z',
    createdAt: '2025-09-01T09:00:00Z',
    lastContactDate: '2026-01-05T10:00:00Z',
    lastContactType: 'call',
    totalTouchpoints: 2,
  },
  {
    id: 'student-8',
    name: 'Carlos Martinez',
    email: 'carlos.martinez@pepperdine.edu',
    phone: '(213) 555-8901',
    program: 'ft-mba',
    status: 'offered',
    coachId: 'coach-1',
    isInternational: false,
    requiresCpt: false,
    hasBlocker: false,
    targetIndustry: 'Finance',
    targetRole: 'Corporate Finance Intern',
    linkedinUrl: 'https://linkedin.com/in/carlos-martinez',
    lastUpdated: '2026-01-26T15:30:00Z',
    createdAt: '2025-09-01T09:00:00Z',
    lastContactDate: '2026-01-26T15:30:00Z',
    lastContactType: 'call',
    totalTouchpoints: 7,
  },
  {
    id: 'student-9',
    name: 'Aisha Patel',
    email: 'aisha.patel@pepperdine.edu',
    phone: '(626) 555-9012',
    program: 'ft-mba',
    status: 'searching',
    coachId: 'coach-1',
    isInternational: true,
    requiresCpt: true,
    cptDeadline: '2026-03-15',
    hasBlocker: true,
    blockerNote: 'Needs resume help',
    targetIndustry: 'Tech',
    targetRole: 'Data Science Intern',
    linkedinUrl: 'https://linkedin.com/in/aisha-patel',
    lastUpdated: '2026-01-08T11:45:00Z',
    createdAt: '2025-09-01T09:00:00Z',
    // Never contacted - critical outreach needed
    totalTouchpoints: 0,
  },
  {
    id: 'student-10',
    name: 'Tom Bradley',
    email: 'tom.bradley@pepperdine.edu',
    phone: '(310) 555-0123',
    program: 'emba',
    status: 'placed',
    coachId: 'coach-2',
    isInternational: false,
    requiresCpt: false,
    hasBlocker: false,
    targetIndustry: 'Consulting',
    targetRole: 'Executive Leadership Program',
    linkedinUrl: 'https://linkedin.com/in/tom-bradley',
    lastUpdated: '2026-01-15T08:00:00Z',
    createdAt: '2025-09-01T09:00:00Z',
    lastContactDate: '2026-01-20T08:00:00Z',
    lastContactType: 'meeting',
    totalTouchpoints: 4,
  },
  {
    id: 'student-11',
    name: 'Lin Wang',
    email: 'lin.wang@pepperdine.edu',
    phone: '(818) 555-1234',
    program: 'ft-mba',
    status: 'applying',
    coachId: 'coach-1',
    isInternational: true,
    requiresCpt: true,
    cptDeadline: '2026-03-15',
    hasBlocker: false,
    targetIndustry: 'Finance',
    targetRole: 'Equity Research Intern',
    linkedinUrl: 'https://linkedin.com/in/lin-wang',
    lastUpdated: '2026-01-23T12:30:00Z',
    createdAt: '2025-09-01T09:00:00Z',
    lastContactDate: '2026-01-23T12:30:00Z',
    lastContactType: 'email',
    totalTouchpoints: 3,
  },
  {
    id: 'student-12',
    name: 'Jessica Moore',
    email: 'jessica.moore@pepperdine.edu',
    phone: '(213) 555-2345',
    program: 'pt-mba',
    status: 'interviewing',
    coachId: 'coach-2',
    isInternational: false,
    requiresCpt: false,
    hasBlocker: false,
    targetIndustry: 'Healthcare',
    targetRole: 'Operations Analyst Intern',
    linkedinUrl: 'https://linkedin.com/in/jessica-moore',
    lastUpdated: '2026-01-24T14:00:00Z',
    createdAt: '2025-09-01T09:00:00Z',
    lastContactDate: '2026-01-12T14:00:00Z',
    lastContactType: 'email',
    totalTouchpoints: 3,
  },
  {
    id: 'student-13',
    name: 'Ahmed Hassan',
    email: 'ahmed.hassan@pepperdine.edu',
    phone: '(626) 555-3456',
    program: 'ft-mba',
    status: 'applying',
    coachId: 'coach-1',
    isInternational: true,
    requiresCpt: false,
    hasBlocker: false,
    targetIndustry: 'Consulting',
    targetRole: 'Business Analyst Intern',
    linkedinUrl: 'https://linkedin.com/in/ahmed-hassan',
    lastUpdated: '2026-01-12T09:15:00Z',
    createdAt: '2025-09-01T09:00:00Z',
    lastContactDate: '2026-01-08T09:15:00Z',
    lastContactType: 'sms',
    totalTouchpoints: 1,
  },
  {
    id: 'student-14',
    name: 'Olivia Scott',
    email: 'olivia.scott@pepperdine.edu',
    phone: '(310) 555-4567',
    program: 'ft-mba',
    status: 'offered',
    coachId: 'coach-2',
    isInternational: false,
    requiresCpt: false,
    hasBlocker: false,
    targetIndustry: 'Tech',
    targetRole: 'UX Research Intern',
    linkedinUrl: 'https://linkedin.com/in/olivia-scott',
    lastUpdated: '2026-01-19T16:00:00Z',
    createdAt: '2025-09-01T09:00:00Z',
    lastContactDate: '2026-01-19T16:00:00Z',
    lastContactType: 'call',
    totalTouchpoints: 5,
  },
  {
    id: 'student-15',
    name: 'Kevin Nguyen',
    email: 'kevin.nguyen@pepperdine.edu',
    phone: '(818) 555-5678',
    program: 'ft-mba',
    status: 'placed',
    coachId: 'coach-1',
    isInternational: true,
    requiresCpt: true,
    cptDeadline: '2026-03-15',
    hasBlocker: false,
    targetIndustry: 'Tech',
    targetRole: 'Product Manager Intern',
    linkedinUrl: 'https://linkedin.com/in/kevin-nguyen',
    lastUpdated: '2026-01-21T11:30:00Z',
    createdAt: '2025-09-01T09:00:00Z',
    lastContactDate: '2026-01-21T11:30:00Z',
    lastContactType: 'email',
    totalTouchpoints: 6,
  },
];

// =============================================================================
// SURVEYS
// =============================================================================

export const mockSurveys: Survey[] = [
  {
    id: 'survey-1',
    name: 'Internship Status Check-in',
    dateSent: '2026-01-20',
    totalSent: 47,
    responses: {
      initial: { count: 24, percentage: 51, date: '2026-01-20' },
      afterSmsReminder: { count: 32, percentage: 68, date: '2026-01-22' },
      afterEmailReminder: { count: 36, percentage: 77, date: '2026-01-23' },
      final: { count: 36, percentage: 77 },
    },
    nonResponders: 11,
  },
];

// =============================================================================
// SURVEY RESPONSES
// =============================================================================

export const mockSurveyResponses: SurveyResponse[] = [
  {
    id: 'response-1',
    studentId: 'student-1',
    surveyId: 'survey-1',
    responses: {
      currentStatus: 'interviewing',
      companiesInterviewing: 'Deloitte, BCG',
      blockers: 'Need CPT authorization',
      confidenceLevel: 4,
    },
    respondedAt: '2026-01-20T15:30:00Z',
  },
  {
    id: 'response-2',
    studentId: 'student-2',
    surveyId: 'survey-1',
    responses: {
      currentStatus: 'applying',
      applicationsSubmitted: 12,
      blockers: 'None',
      confidenceLevel: 3,
    },
    respondedAt: '2026-01-21T09:45:00Z',
  },
  {
    id: 'response-3',
    studentId: 'student-5',
    surveyId: 'survey-1',
    responses: {
      currentStatus: 'interviewing',
      companiesInterviewing: 'Google, Meta, Apple',
      blockers: 'None',
      confidenceLevel: 4,
    },
    respondedAt: '2026-01-20T18:00:00Z',
  },
  {
    id: 'response-4',
    studentId: 'student-8',
    surveyId: 'survey-1',
    responses: {
      currentStatus: 'offered',
      companyOffered: 'Goldman Sachs',
      offerDeadline: '2026-02-15',
      confidenceLevel: 5,
    },
    respondedAt: '2026-01-22T10:15:00Z',
  },
];

// =============================================================================
// TIMELINE ENTRIES (Activity feed for Sarah Chen)
// =============================================================================

export const mockTimelineForSarahChen: TimelineEntry[] = [
  {
    id: 'timeline-1',
    studentId: 'student-1',
    coachId: 'coach-1',
    coachName: 'Kazah Mims',
    type: 'email',
    content:
      'Subject: Checking in on your Deloitte interview - Hi Sarah, wanted to follow up on how your Deloitte interview went yesterday. Let me know if you need any help preparing for the next round!',
    createdAt: '2026-01-28T14:30:00Z',
    // Engagement tracking
    opened: true,
    openedAt: '2026-01-28T14:45:00Z',
    replied: true,
    repliedAt: '2026-01-28T16:20:00Z',
    resultedInAction: true,
    actionNote: 'Scheduled final round prep session',
  },
  {
    id: 'timeline-2',
    studentId: 'student-1',
    coachId: 'coach-1',
    coachName: 'Kazah Mims',
    type: 'note',
    content:
      'Deloitte interview prep session - Reviewed case study frameworks, practiced behavioral questions. Sarah is well-prepared for the final round. Key focus areas: leadership examples and quantitative analysis.',
    createdAt: '2026-01-25T10:00:00Z',
  },
  {
    id: 'timeline-3',
    studentId: 'student-1',
    coachId: 'coach-1',
    coachName: 'System',
    type: 'sms',
    content:
      'Automated reminder: Please complete the Internship Status Check-in survey. Your feedback helps us support you better!',
    createdAt: '2026-01-22T09:00:00Z',
    // Engagement tracking
    opened: true,
    openedAt: '2026-01-22T09:05:00Z',
    replied: false,
    resultedInAction: true,
    actionNote: 'Student completed survey',
  },
  {
    id: 'timeline-4',
    studentId: 'student-1',
    coachId: 'coach-1',
    coachName: 'Sarah Chen',
    type: 'survey',
    content:
      'Completed Internship Status Check-in survey. Current status: Interviewing at Deloitte and BCG. Confidence level: 4/5.',
    createdAt: '2026-01-20T15:30:00Z',
  },
  {
    id: 'timeline-5',
    studentId: 'student-1',
    coachId: 'coach-1',
    coachName: 'Kazah Mims',
    type: 'call',
    content:
      '30-minute career coaching call - Discussed interview strategy, reviewed target companies list. Sarah is focusing on consulting firms. Need to follow up on CPT authorization status.',
    createdAt: '2026-01-15T14:00:00Z',
  },
  {
    id: 'timeline-6',
    studentId: 'student-1',
    coachId: 'coach-1',
    coachName: 'Kazah Mims',
    type: 'note',
    content:
      'Resume review meeting - Updated resume with quantified achievements from previous internship. Added consulting-specific keywords. Resume is now ready for applications.',
    createdAt: '2026-01-05T11:00:00Z',
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get students filtered by status
 */
export function getStudentsByStatus(status: Status): Student[] {
  return mockStudents.filter((s) => s.status === status);
}

/**
 * Get students assigned to a specific coach
 */
export function getStudentsByCoach(coachId: string): Student[] {
  return mockStudents.filter((s) => s.coachId === coachId);
}

/**
 * Get all international students
 */
export function getInternationalStudents(): Student[] {
  return mockStudents.filter((s) => s.isInternational);
}

/**
 * Get students who have blockers
 */
export function getStudentsWithBlockers(): Student[] {
  return mockStudents.filter((s) => s.hasBlocker);
}

/**
 * Get students who haven't been updated in 14+ days (stale)
 * Based on demo current date of 2026-01-29
 */
export function getStaleStudents(): Student[] {
  const currentDate = new Date(DEMO_CURRENT_DATE);
  const fourteenDaysAgo = new Date(currentDate);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  return mockStudents.filter((s) => {
    const lastUpdated = new Date(s.lastUpdated);
    return lastUpdated < fourteenDaysAgo;
  });
}

/**
 * Get a student by their ID
 */
export function getStudentById(id: string): Student | undefined {
  return mockStudents.find((s) => s.id === id);
}

/**
 * Get a coach by their ID
 */
export function getCoachById(id: string): Coach | undefined {
  return mockCoaches.find((c) => c.id === id);
}

/**
 * Get timeline entries for a specific student
 */
export function getTimelineForStudent(studentId: string): TimelineEntry[] {
  if (studentId === 'student-1') {
    return mockTimelineForSarahChen;
  }
  // Return empty array for other students (demo only has timeline for Sarah)
  return [];
}

/**
 * Get pipeline statistics
 */
export function getPipelineStats(): PipelineStats {
  const stats: PipelineStats = {
    total: mockStudents.length,
    searching: 0,
    applying: 0,
    interviewing: 0,
    offered: 0,
    placed: 0,
  };

  for (const student of mockStudents) {
    stats[student.status]++;
  }

  return stats;
}

/**
 * Get alert counts for dashboard
 */
export function getAlertCounts(): AlertCounts {
  const currentDate = new Date(DEMO_CURRENT_DATE);
  const fourteenDaysAgo = new Date(currentDate);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  // CPT deadline is "soon" if within 60 days
  const sixtyDaysFromNow = new Date(currentDate);
  sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);

  let staleCount = 0;
  let blockerCount = 0;
  let internationalSearchingCount = 0;
  let cptDeadlineSoonCount = 0;
  let needsOutreachCount = 0;

  for (const student of mockStudents) {
    // Stale: not updated in 14+ days
    const lastUpdated = new Date(student.lastUpdated);
    if (lastUpdated < fourteenDaysAgo) {
      staleCount++;
    }

    // Has blocker
    if (student.hasBlocker) {
      blockerCount++;
    }

    // International and still searching
    if (student.isInternational && student.status === 'searching') {
      internationalSearchingCount++;
    }

    // CPT deadline coming up
    if (student.requiresCpt && student.cptDeadline) {
      const deadline = new Date(student.cptDeadline);
      if (deadline <= sixtyDaysFromNow && student.status !== 'placed') {
        cptDeadlineSoonCount++;
      }
    }

    // Needs outreach: never contacted or 14+ days since last contact
    if (!student.lastContactDate) {
      needsOutreachCount++;
    } else {
      const lastContact = new Date(student.lastContactDate);
      if (lastContact < fourteenDaysAgo) {
        needsOutreachCount++;
      }
    }
  }

  return {
    staleCount,
    blockerCount,
    internationalSearchingCount,
    cptDeadlineSoonCount,
    needsOutreachCount,
  };
}

/**
 * Get notes/timeline for a student (alias for getTimelineForStudent)
 */
export function getNotesByStudent(studentId: string): TimelineEntry[] {
  return getTimelineForStudent(studentId);
}

/**
 * Get survey responses for a specific survey
 */
export function getSurveyResponses(surveyId: string): SurveyResponse[] {
  return mockSurveyResponses.filter((r) => r.surveyId === surveyId);
}

/**
 * Calculate days since last update for a student
 */
export function getDaysSinceUpdate(student: Student): number {
  const currentDate = new Date(DEMO_CURRENT_DATE);
  const lastUpdated = new Date(student.lastUpdated);
  const diffTime = currentDate.getTime() - lastUpdated.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Format relative time (e.g., "2 days ago")
 */
export function formatRelativeTime(dateString: string): string {
  const currentDate = new Date(DEMO_CURRENT_DATE);
  const date = new Date(dateString);
  const diffTime = currentDate.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return '1 week ago';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

// =============================================================================
// OUTREACH TRACKING HELPERS
// =============================================================================

/**
 * Get days since last contact with a student
 * Returns Infinity if never contacted
 */
export function getDaysSinceLastContact(student: Student): number {
  if (!student.lastContactDate) return Infinity;
  const currentDate = new Date(DEMO_CURRENT_DATE);
  const lastContact = new Date(student.lastContactDate);
  const diffTime = currentDate.getTime() - lastContact.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get outreach status based on days since last contact
 * - recent: 0-7 days
 * - due: 8-14 days
 * - overdue: 14+ days or never contacted
 */
export function getOutreachStatus(student: Student): OutreachStatus {
  if (!student.lastContactDate) return 'overdue';
  const days = getDaysSinceLastContact(student);
  if (days <= 7) return 'recent';
  if (days <= 14) return 'due';
  return 'overdue';
}

/**
 * Get students needing outreach (14+ days since contact or never contacted)
 */
export function getStudentsNeedingOutreach(): Student[] {
  return mockStudents.filter((s) => {
    if (!s.lastContactDate) return true;
    return getDaysSinceLastContact(s) >= 14;
  });
}

// =============================================================================
// SUGGESTED ACTIONS FOR OUTREACH QUEUE
// =============================================================================

export const studentSuggestedActions: SuggestedAction[] = [
  {
    id: 'action-1',
    studentId: 'student-9', // Aisha Patel - never contacted
    studentName: 'Aisha Patel',
    type: 'urgent',
    reason: 'Never been contacted',
    priority: 'high',
    suggestedAction: 'Send introduction email',
  },
  {
    id: 'action-2',
    studentId: 'student-7', // Rachel Adams - 24 days ago
    studentName: 'Rachel Adams',
    type: 'follow-up',
    reason: 'No contact in 24 days',
    priority: 'high',
    suggestedAction: 'Schedule check-in call',
  },
  {
    id: 'action-3',
    studentId: 'student-13', // Ahmed Hassan - 21 days, international
    studentName: 'Ahmed Hassan',
    type: 'urgent',
    reason: 'International student, no contact in 21 days',
    priority: 'high',
    suggestedAction: 'Review visa timeline and schedule meeting',
  },
  {
    id: 'action-4',
    studentId: 'student-6', // David Kim - 19 days
    studentName: 'David Kim',
    type: 'follow-up',
    reason: 'No contact in 19 days',
    priority: 'high',
    suggestedAction: 'Check on application progress',
  },
  {
    id: 'action-5',
    studentId: 'student-12', // Jessica Moore - 17 days
    studentName: 'Jessica Moore',
    type: 'check-in',
    reason: 'No contact in 17 days',
    priority: 'medium',
    suggestedAction: 'Send status update request',
  },
  {
    id: 'action-6',
    studentId: 'student-3', // Priya Sharma - 14 days, international with blocker
    studentName: 'Priya Sharma',
    type: 'urgent',
    reason: 'International student with blocker, 14 days since contact',
    priority: 'high',
    suggestedAction: 'Discuss sponsorship options',
  },
];
