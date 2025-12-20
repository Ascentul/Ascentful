/**
 * Enhanced Email Pattern Library for Application Tracking
 *
 * Patterns are organized by category with confidence scoring.
 * Each pattern has a base confidence that can be boosted by entity extraction.
 */

import type { EmailEventType } from './emailAutoUpdates';

export type PatternCategory =
  | 'application'
  | 'interview'
  | 'offer'
  | 'rejection'
  | 'assessment'
  | 'background'
  | 'reference'
  | 'onboarding'
  | 'outreach'
  | 'status';

export type ClassificationPattern = {
  id: string;
  category: PatternCategory;
  eventType: EmailEventType;
  pattern: RegExp;
  baseConfidence: number;
  description: string;
};

// =============================================================================
// APPLICATION LIFECYCLE PATTERNS
// =============================================================================

const APPLICATION_PATTERNS: ClassificationPattern[] = [
  // Application received/confirmed
  {
    id: 'app_received_1',
    category: 'application',
    eventType: 'applied_confirmation',
    pattern: /\b(application received|we received your application)\b/i,
    baseConfidence: 0.92,
    description: 'Direct application received confirmation',
  },
  {
    id: 'app_received_2',
    category: 'application',
    eventType: 'applied_confirmation',
    pattern: /\b(thanks for applying|thank you for applying)\b/i,
    baseConfidence: 0.9,
    description: 'Thanks for applying message',
  },
  {
    id: 'app_received_3',
    category: 'application',
    eventType: 'applied_confirmation',
    pattern: /\b(application was sent|application submitted|successfully applied)\b/i,
    baseConfidence: 0.92,
    description: 'Application submission confirmation',
  },
  {
    id: 'app_received_4',
    category: 'application',
    eventType: 'applied_confirmation',
    pattern: /\bwe have received your application for\b/i,
    baseConfidence: 0.94,
    description: 'Formal receipt acknowledgment',
  },
  {
    id: 'app_received_5',
    category: 'application',
    eventType: 'applied_confirmation',
    pattern: /\byour application has been submitted\b/i,
    baseConfidence: 0.93,
    description: 'Submission success message',
  },

  // LinkedIn specific patterns
  {
    id: 'linkedin_app_1',
    category: 'application',
    eventType: 'applied_confirmation',
    pattern: /\byour application to .+ was submitted\b/i,
    baseConfidence: 0.94,
    description: 'LinkedIn application submitted',
  },
  {
    id: 'linkedin_app_2',
    category: 'application',
    eventType: 'applied_confirmation',
    pattern: /\byou applied to .+ at .+\b/i,
    baseConfidence: 0.92,
    description: 'LinkedIn you applied notification',
  },
  {
    id: 'linkedin_app_3',
    category: 'application',
    eventType: 'applied_confirmation',
    pattern: /\bapplication.*submitted.*successfully\b/i,
    baseConfidence: 0.91,
    description: 'Generic successful submission',
  },

  // Application viewed/status
  {
    id: 'app_viewed_1',
    category: 'status',
    eventType: 'application_viewed',
    pattern: /\b(your application|application).*\bviewed\b/i,
    baseConfidence: 0.88,
    description: 'Application viewed notification',
  },
  {
    id: 'app_viewed_2',
    category: 'status',
    eventType: 'application_viewed',
    pattern: /\byour profile was viewed\b/i,
    baseConfidence: 0.85,
    description: 'Profile viewed by recruiter',
  },
  {
    id: 'app_viewed_3',
    category: 'status',
    eventType: 'application_viewed',
    pattern: /\brecruiter.*viewed your\b/i,
    baseConfidence: 0.86,
    description: 'Recruiter viewed profile',
  },
  {
    id: 'app_status_1',
    category: 'status',
    eventType: 'application_viewed',
    pattern: /\byour application.*being reviewed\b/i,
    baseConfidence: 0.87,
    description: 'Application under review',
  },
  {
    id: 'app_status_2',
    category: 'application',
    eventType: 'applied_confirmation',
    pattern: /\bapplication status\b.*\bupdate\b/i,
    baseConfidence: 0.75,
    description: 'Generic status update',
  },

  // Referral patterns
  {
    id: 'referral_1',
    category: 'application',
    eventType: 'applied_confirmation',
    pattern: /\breferral.*application\b/i,
    baseConfidence: 0.88,
    description: 'Referral application',
  },
  {
    id: 'referral_2',
    category: 'application',
    eventType: 'applied_confirmation',
    pattern: /\breferred by\b/i,
    baseConfidence: 0.82,
    description: 'Referred by someone',
  },
  {
    id: 'referral_3',
    category: 'application',
    eventType: 'applied_confirmation',
    pattern: /\bemployee referral\b/i,
    baseConfidence: 0.86,
    description: 'Employee referral program',
  },
];

// =============================================================================
// INTERVIEW PATTERNS
// =============================================================================

const INTERVIEW_PATTERNS: ClassificationPattern[] = [
  // Interview requests
  {
    id: 'int_request_1',
    category: 'interview',
    eventType: 'interview_request',
    pattern: /\b(interview request|interview invitation|interview invite)\b/i,
    baseConfidence: 0.9,
    description: 'Direct interview request',
  },
  {
    id: 'int_request_2',
    category: 'interview',
    eventType: 'interview_request',
    pattern: /\bschedule (an )?interview\b/i,
    baseConfidence: 0.88,
    description: 'Schedule interview request',
  },
  {
    id: 'int_request_3',
    category: 'interview',
    eventType: 'interview_request',
    pattern: /\binterview (schedule|scheduling)\b/i,
    baseConfidence: 0.86,
    description: 'Interview scheduling',
  },
  {
    id: 'int_request_4',
    category: 'interview',
    eventType: 'interview_request',
    pattern: /\bwould like to (schedule|set up).*interview\b/i,
    baseConfidence: 0.89,
    description: 'Would like to schedule interview',
  },
  {
    id: 'int_request_5',
    category: 'interview',
    eventType: 'interview_request',
    pattern: /\byour availability.*interview\b/i,
    baseConfidence: 0.85,
    description: 'Asking for interview availability',
  },
  {
    id: 'int_request_6',
    category: 'interview',
    eventType: 'interview_request',
    pattern: /\bplease (select|choose|pick).*time.*interview\b/i,
    baseConfidence: 0.87,
    description: 'Select interview time',
  },

  // Interview confirmations
  {
    id: 'int_confirmed_1',
    category: 'interview',
    eventType: 'interview_scheduled',
    pattern: /\b(interview (confirmation|confirmed)|confirmed interview)\b/i,
    baseConfidence: 0.92,
    description: 'Interview confirmed',
  },
  {
    id: 'int_confirmed_2',
    category: 'interview',
    eventType: 'interview_scheduled',
    pattern: /\byour interview.*scheduled\b/i,
    baseConfidence: 0.91,
    description: 'Interview is scheduled',
  },
  {
    id: 'int_confirmed_3',
    category: 'interview',
    eventType: 'interview_scheduled',
    pattern: /\bcalendar invite.*interview\b/i,
    baseConfidence: 0.88,
    description: 'Calendar invite for interview',
  },
  {
    id: 'int_confirmed_4',
    category: 'interview',
    eventType: 'interview_scheduled',
    pattern: /\binterview.*has been (booked|scheduled)\b/i,
    baseConfidence: 0.9,
    description: 'Interview booked/scheduled',
  },

  // Interview rescheduled
  {
    id: 'int_resched_1',
    category: 'interview',
    eventType: 'interview_rescheduled',
    pattern: /\b(rescheduled|new time|updated time).*interview\b/i,
    baseConfidence: 0.88,
    description: 'Interview rescheduled',
  },
  {
    id: 'int_resched_2',
    category: 'interview',
    eventType: 'interview_rescheduled',
    pattern: /\binterview.*rescheduled\b/i,
    baseConfidence: 0.9,
    description: 'Interview has been rescheduled',
  },
  {
    id: 'int_resched_3',
    category: 'interview',
    eventType: 'interview_rescheduled',
    pattern: /\bchange.*interview.*time\b/i,
    baseConfidence: 0.82,
    description: 'Change interview time',
  },

  // Interview reminders
  {
    id: 'int_reminder_1',
    category: 'interview',
    eventType: 'interview_reminder',
    pattern: /\b(reminder|don't forget).*interview\b/i,
    baseConfidence: 0.86,
    description: 'Interview reminder',
  },
  {
    id: 'int_reminder_2',
    category: 'interview',
    eventType: 'interview_reminder',
    pattern: /\binterview.*reminder\b/i,
    baseConfidence: 0.88,
    description: 'Reminder about interview',
  },
  {
    id: 'int_reminder_3',
    category: 'interview',
    eventType: 'interview_reminder',
    pattern: /\bupcoming interview\b/i,
    baseConfidence: 0.84,
    description: 'Upcoming interview notification',
  },

  // Scheduling tools (Calendly, etc.)
  {
    id: 'calendly_1',
    category: 'interview',
    eventType: 'interview_scheduled',
    pattern: /\bcalendly.*interview\b/i,
    baseConfidence: 0.85,
    description: 'Calendly interview booking',
  },
  {
    id: 'booking_1',
    category: 'interview',
    eventType: 'interview_scheduled',
    pattern: /\bbooking.*confirmed\b/i,
    baseConfidence: 0.8,
    description: 'Booking confirmed',
  },
  {
    id: 'meeting_1',
    category: 'interview',
    eventType: 'interview_scheduled',
    pattern: /\b(event|meeting).*scheduled.*interview\b/i,
    baseConfidence: 0.82,
    description: 'Meeting scheduled for interview',
  },

  // Interview round types
  {
    id: 'phone_screen_1',
    category: 'interview',
    eventType: 'interview_request',
    pattern: /\bphone screen\b/i,
    baseConfidence: 0.88,
    description: 'Phone screen interview',
  },
  {
    id: 'video_int_1',
    category: 'interview',
    eventType: 'interview_request',
    pattern: /\b(video|virtual) interview\b/i,
    baseConfidence: 0.87,
    description: 'Video/virtual interview',
  },
  {
    id: 'onsite_int_1',
    category: 'interview',
    eventType: 'interview_request',
    pattern: /\bon[- ]?site interview\b/i,
    baseConfidence: 0.89,
    description: 'Onsite interview',
  },
  {
    id: 'final_round_1',
    category: 'interview',
    eventType: 'interview_request',
    pattern: /\bfinal (round|interview)\b/i,
    baseConfidence: 0.88,
    description: 'Final round interview',
  },
  {
    id: 'tech_int_1',
    category: 'interview',
    eventType: 'interview_request',
    pattern: /\btechnical interview\b/i,
    baseConfidence: 0.89,
    description: 'Technical interview',
  },
  {
    id: 'panel_int_1',
    category: 'interview',
    eventType: 'interview_request',
    pattern: /\bpanel interview\b/i,
    baseConfidence: 0.88,
    description: 'Panel interview',
  },
  {
    id: 'case_int_1',
    category: 'interview',
    eventType: 'interview_request',
    pattern: /\bcase interview\b/i,
    baseConfidence: 0.87,
    description: 'Case interview',
  },
  {
    id: 'behavioral_1',
    category: 'interview',
    eventType: 'interview_request',
    pattern: /\bbehavioral interview\b/i,
    baseConfidence: 0.86,
    description: 'Behavioral interview',
  },

  // Next steps / moving forward
  {
    id: 'next_steps_1',
    category: 'interview',
    eventType: 'interview_request',
    pattern: /\bnext steps.*interview\b/i,
    baseConfidence: 0.82,
    description: 'Next steps involving interview',
  },
  {
    id: 'moving_fwd_1',
    category: 'interview',
    eventType: 'interview_request',
    pattern: /\bmoving (forward|you forward).*interview\b/i,
    baseConfidence: 0.85,
    description: 'Moving forward to interview',
  },
  {
    id: 'proceed_1',
    category: 'interview',
    eventType: 'interview_request',
    pattern: /\b(proceed|advance).*next.*round\b/i,
    baseConfidence: 0.84,
    description: 'Proceeding to next round',
  },
];

// =============================================================================
// ASSESSMENT PATTERNS
// =============================================================================

const ASSESSMENT_PATTERNS: ClassificationPattern[] = [
  {
    id: 'takehome_1',
    category: 'assessment',
    eventType: 'take_home_assignment',
    pattern: /\btake[- ]?home\b/i,
    baseConfidence: 0.86,
    description: 'Take-home assignment',
  },
  {
    id: 'coding_1',
    category: 'assessment',
    eventType: 'take_home_assignment',
    pattern: /\bcoding challenge\b/i,
    baseConfidence: 0.88,
    description: 'Coding challenge',
  },
  {
    id: 'assessment_1',
    category: 'assessment',
    eventType: 'take_home_assignment',
    pattern: /\b(technical|skills?) assessment\b/i,
    baseConfidence: 0.87,
    description: 'Technical/skills assessment',
  },
  {
    id: 'assignment_1',
    category: 'assessment',
    eventType: 'take_home_assignment',
    pattern: /\bcoding assignment\b/i,
    baseConfidence: 0.86,
    description: 'Coding assignment',
  },
  {
    id: 'hackerrank_1',
    category: 'assessment',
    eventType: 'take_home_assignment',
    pattern: /\b(hackerrank|codility|leetcode|codesignal)\b/i,
    baseConfidence: 0.9,
    description: 'Coding platform assessment',
  },
  {
    id: 'project_1',
    category: 'assessment',
    eventType: 'take_home_assignment',
    pattern: /\b(complete|submit).*project\b.*interview\b/i,
    baseConfidence: 0.82,
    description: 'Project submission for interview',
  },
  {
    id: 'test_1',
    category: 'assessment',
    eventType: 'take_home_assignment',
    pattern: /\bonline (test|assessment)\b/i,
    baseConfidence: 0.84,
    description: 'Online test/assessment',
  },
];

// =============================================================================
// OFFER PATTERNS
// =============================================================================

const OFFER_PATTERNS: ClassificationPattern[] = [
  // Direct offer
  {
    id: 'offer_1',
    category: 'offer',
    eventType: 'offer',
    pattern: /\b(job offer|offer extended|offer letter)\b/i,
    baseConfidence: 0.94,
    description: 'Direct job offer',
  },
  {
    id: 'offer_2',
    category: 'offer',
    eventType: 'offer',
    pattern: /\bcongratulations.*offer\b/i,
    baseConfidence: 0.92,
    description: 'Congratulations on offer',
  },
  {
    id: 'offer_3',
    category: 'offer',
    eventType: 'offer',
    pattern: /\bpleased to (offer|extend)\b/i,
    baseConfidence: 0.93,
    description: 'Pleased to offer',
  },
  {
    id: 'offer_4',
    category: 'offer',
    eventType: 'offer',
    pattern: /\bexcited to offer\b/i,
    baseConfidence: 0.92,
    description: 'Excited to offer',
  },
  {
    id: 'offer_5',
    category: 'offer',
    eventType: 'offer',
    pattern: /\bformal offer\b/i,
    baseConfidence: 0.93,
    description: 'Formal offer',
  },
  {
    id: 'offer_6',
    category: 'offer',
    eventType: 'offer',
    pattern: /\bwe would like to offer you\b/i,
    baseConfidence: 0.94,
    description: 'Would like to offer you',
  },
  {
    id: 'offer_7',
    category: 'offer',
    eventType: 'offer',
    pattern: /\boffer.*position\b/i,
    baseConfidence: 0.88,
    description: 'Offer for position',
  },

  // Compensation
  {
    id: 'comp_1',
    category: 'offer',
    eventType: 'offer',
    pattern: /\bcompensation.*package\b/i,
    baseConfidence: 0.85,
    description: 'Compensation package',
  },
  {
    id: 'salary_1',
    category: 'offer',
    eventType: 'offer',
    pattern: /\b(salary|base pay).*\$?\d+/i,
    baseConfidence: 0.82,
    description: 'Salary details',
  },

  // Pre-offer / verbal
  {
    id: 'verbal_1',
    category: 'offer',
    eventType: 'offer',
    pattern: /\bverbal offer\b/i,
    baseConfidence: 0.88,
    description: 'Verbal offer',
  },
  {
    id: 'pending_1',
    category: 'offer',
    eventType: 'offer',
    pattern: /\bpending.*offer\b/i,
    baseConfidence: 0.8,
    description: 'Pending offer',
  },

  // Negotiation
  {
    id: 'nego_1',
    category: 'offer',
    eventType: 'offer_negotiation',
    pattern: /\bnegotiat.*offer\b/i,
    baseConfidence: 0.85,
    description: 'Offer negotiation',
  },
  {
    id: 'nego_2',
    category: 'offer',
    eventType: 'offer_negotiation',
    pattern: /\bcounter.*offer\b/i,
    baseConfidence: 0.87,
    description: 'Counter offer',
  },
  {
    id: 'nego_3',
    category: 'offer',
    eventType: 'offer_negotiation',
    pattern: /\bsalary.*discussion\b/i,
    baseConfidence: 0.78,
    description: 'Salary discussion',
  },
];

// =============================================================================
// REJECTION PATTERNS
// =============================================================================

const REJECTION_PATTERNS: ClassificationPattern[] = [
  // Direct rejections
  {
    id: 'rej_1',
    category: 'rejection',
    eventType: 'rejection',
    pattern: /\bunfortunately\b/i,
    baseConfidence: 0.88,
    description: 'Unfortunately (rejection)',
  },
  {
    id: 'rej_2',
    category: 'rejection',
    eventType: 'rejection',
    pattern: /\bnot moving forward\b/i,
    baseConfidence: 0.92,
    description: 'Not moving forward',
  },
  {
    id: 'rej_3',
    category: 'rejection',
    eventType: 'rejection',
    pattern: /\bwe regret\b/i,
    baseConfidence: 0.9,
    description: 'We regret to inform',
  },
  {
    id: 'rej_4',
    category: 'rejection',
    eventType: 'rejection',
    pattern: /\b(application|candidacy).*rejected\b/i,
    baseConfidence: 0.94,
    description: 'Application rejected',
  },
  {
    id: 'rej_5',
    category: 'rejection',
    eventType: 'rejection',
    pattern: /\b(application|candidacy).*declined\b/i,
    baseConfidence: 0.92,
    description: 'Application declined',
  },

  // Soft rejections
  {
    id: 'soft_rej_1',
    category: 'rejection',
    eventType: 'rejection',
    pattern: /\bdecided.*pursue.*other\b/i,
    baseConfidence: 0.86,
    description: 'Decided to pursue other candidates',
  },
  {
    id: 'soft_rej_2',
    category: 'rejection',
    eventType: 'rejection',
    pattern: /\bposition.*filled\b/i,
    baseConfidence: 0.88,
    description: 'Position has been filled',
  },
  {
    id: 'soft_rej_3',
    category: 'rejection',
    eventType: 'rejection',
    pattern: /\bnot.*selected\b/i,
    baseConfidence: 0.85,
    description: 'Not selected',
  },
  {
    id: 'soft_rej_4',
    category: 'rejection',
    eventType: 'rejection',
    pattern: /\bafter careful consideration\b/i,
    baseConfidence: 0.82,
    description: 'After careful consideration',
  },
  {
    id: 'soft_rej_5',
    category: 'rejection',
    eventType: 'rejection',
    pattern: /\bwe appreciate your interest\b.*\bnot\b/i,
    baseConfidence: 0.8,
    description: 'Appreciate interest but no',
  },
  {
    id: 'soft_rej_6',
    category: 'rejection',
    eventType: 'rejection',
    pattern: /\bkeep.*resume.*file\b/i,
    baseConfidence: 0.78,
    description: 'Keep resume on file',
  },
  {
    id: 'soft_rej_7',
    category: 'rejection',
    eventType: 'rejection',
    pattern: /\bencourage.*apply.*future\b/i,
    baseConfidence: 0.76,
    description: 'Encourage to apply in future',
  },

  // Stage-specific rejections
  {
    id: 'stage_rej_1',
    category: 'rejection',
    eventType: 'rejection',
    pattern: /\bnot.*proceed.*interview\b/i,
    baseConfidence: 0.86,
    description: 'Not proceeding to interview',
  },
  {
    id: 'stage_rej_2',
    category: 'rejection',
    eventType: 'rejection',
    pattern: /\bchosen another candidate\b/i,
    baseConfidence: 0.9,
    description: 'Chosen another candidate',
  },
  {
    id: 'stage_rej_3',
    category: 'rejection',
    eventType: 'rejection',
    pattern: /\bcompetitive.*process\b.*\bnot\b/i,
    baseConfidence: 0.82,
    description: 'Competitive process rejection',
  },
  {
    id: 'stage_rej_4',
    category: 'rejection',
    eventType: 'rejection',
    pattern: /\bwon't be moving forward\b/i,
    baseConfidence: 0.92,
    description: "Won't be moving forward",
  },
];

// =============================================================================
// BACKGROUND CHECK & REFERENCE PATTERNS
// =============================================================================

const BACKGROUND_PATTERNS: ClassificationPattern[] = [
  {
    id: 'bg_1',
    category: 'background',
    eventType: 'background_check',
    pattern: /\bbackground check\b/i,
    baseConfidence: 0.9,
    description: 'Background check',
  },
  {
    id: 'bg_2',
    category: 'background',
    eventType: 'background_check',
    pattern: /\bbackground (screening|verification)\b/i,
    baseConfidence: 0.88,
    description: 'Background screening',
  },
  {
    id: 'bg_3',
    category: 'background',
    eventType: 'background_check',
    pattern: /\b(checkr|sterling|hireright|goodhire)\b/i,
    baseConfidence: 0.92,
    description: 'Background check provider',
  },
];

const REFERENCE_PATTERNS: ClassificationPattern[] = [
  {
    id: 'ref_1',
    category: 'reference',
    eventType: 'reference_request',
    pattern: /\breferences? (request|check)\b/i,
    baseConfidence: 0.88,
    description: 'Reference request',
  },
  {
    id: 'ref_2',
    category: 'reference',
    eventType: 'reference_request',
    pattern: /\bprovide references\b/i,
    baseConfidence: 0.86,
    description: 'Provide references',
  },
  {
    id: 'ref_3',
    category: 'reference',
    eventType: 'reference_request',
    pattern: /\bcontact.*references\b/i,
    baseConfidence: 0.84,
    description: 'Contact references',
  },
];

// =============================================================================
// ONBOARDING PATTERNS
// =============================================================================

const ONBOARDING_PATTERNS: ClassificationPattern[] = [
  {
    id: 'onboard_1',
    category: 'onboarding',
    eventType: 'onboarding',
    pattern: /\bonboarding\b/i,
    baseConfidence: 0.86,
    description: 'Onboarding',
  },
  {
    id: 'onboard_2',
    category: 'onboarding',
    eventType: 'onboarding',
    pattern: /\bwelcome aboard\b/i,
    baseConfidence: 0.9,
    description: 'Welcome aboard',
  },
  {
    id: 'onboard_3',
    category: 'onboarding',
    eventType: 'onboarding',
    pattern: /\bfirst day\b.*\b(orientation|start)\b/i,
    baseConfidence: 0.84,
    description: 'First day orientation',
  },
  {
    id: 'onboard_4',
    category: 'onboarding',
    eventType: 'onboarding',
    pattern: /\bstart date confirmed\b/i,
    baseConfidence: 0.88,
    description: 'Start date confirmed',
  },
  {
    id: 'onboard_5',
    category: 'onboarding',
    eventType: 'onboarding',
    pattern: /\bnew hire\b.*\b(paperwork|documents)\b/i,
    baseConfidence: 0.82,
    description: 'New hire paperwork',
  },
];

// =============================================================================
// RECRUITER OUTREACH PATTERNS
// =============================================================================

const OUTREACH_PATTERNS: ClassificationPattern[] = [
  {
    id: 'outreach_1',
    category: 'outreach',
    eventType: 'recruiter_outreach',
    pattern: /\breaching out about.*position\b/i,
    baseConfidence: 0.82,
    description: 'Reaching out about position',
  },
  {
    id: 'outreach_2',
    category: 'outreach',
    eventType: 'recruiter_outreach',
    pattern: /\binterested in your profile\b/i,
    baseConfidence: 0.8,
    description: 'Interested in your profile',
  },
  {
    id: 'outreach_3',
    category: 'outreach',
    eventType: 'recruiter_outreach',
    pattern: /\bopportunity at\b/i,
    baseConfidence: 0.75,
    description: 'Opportunity at company',
  },
  {
    id: 'outreach_4',
    category: 'outreach',
    eventType: 'recruiter_outreach',
    pattern: /\brecruiting for\b/i,
    baseConfidence: 0.78,
    description: 'Recruiting for position',
  },
  {
    id: 'outreach_5',
    category: 'outreach',
    eventType: 'recruiter_outreach',
    pattern: /\bsaw your (profile|resume|linkedin)\b/i,
    baseConfidence: 0.76,
    description: 'Saw your profile/resume',
  },
  {
    id: 'outreach_6',
    category: 'outreach',
    eventType: 'recruiter_outreach',
    pattern: /\bopen (role|position|opportunity)\b/i,
    baseConfidence: 0.72,
    description: 'Open role/position',
  },
];

// =============================================================================
// VENDOR SIGNALS (ATS platforms)
// =============================================================================

export type VendorSignal = {
  id: string;
  pattern: RegExp;
  isATS: boolean; // true = ATS (not a company), false = job board that may hire
};

export const VENDOR_SIGNALS: VendorSignal[] = [
  // ATS platforms (should not be matched as companies)
  { id: 'greenhouse', pattern: /\bgreenhouse\b/i, isATS: true },
  { id: 'lever', pattern: /\blever\b/i, isATS: true },
  { id: 'workday', pattern: /\bworkday\b/i, isATS: true },
  { id: 'icims', pattern: /\bicims\b/i, isATS: true },
  { id: 'smartrecruiters', pattern: /\bsmartrecruiters\b/i, isATS: true },
  { id: 'ashby', pattern: /\bashby\b/i, isATS: true },
  { id: 'taleo', pattern: /\btaleo\b/i, isATS: true },
  { id: 'jobvite', pattern: /\bjobvite\b/i, isATS: true },
  { id: 'successfactors', pattern: /\bsuccessfactors\b/i, isATS: true },
  { id: 'breezy', pattern: /\bbreezy\s*hr\b/i, isATS: true },
  { id: 'bamboohr', pattern: /\bbamboo\s*hr\b/i, isATS: true },
  { id: 'jazz', pattern: /\bjazz\s*hr\b/i, isATS: true },
  { id: 'recruiterbox', pattern: /\brecruiterbox\b/i, isATS: true },
  { id: 'workable', pattern: /\bworkable\b/i, isATS: true },
  { id: 'rippling', pattern: /\brippling\b/i, isATS: true },
  { id: 'deel', pattern: /\bdeel\b/i, isATS: true },

  // Job boards (could be employers themselves)
  { id: 'linkedin', pattern: /\blinkedin\b/i, isATS: false },
  { id: 'indeed', pattern: /\bindeed\b/i, isATS: false },
  { id: 'glassdoor', pattern: /\bglassdoor\b/i, isATS: false },
  { id: 'ziprecruiter', pattern: /\bziprecruiter\b/i, isATS: false },
  { id: 'monster', pattern: /\bmonster\.com\b/i, isATS: false },
  { id: 'wellfound', pattern: /\b(wellfound|angellist)\b/i, isATS: false },
];

// =============================================================================
// COMBINED PATTERNS
// =============================================================================

export const ALL_PATTERNS: ClassificationPattern[] = [
  ...APPLICATION_PATTERNS,
  ...INTERVIEW_PATTERNS,
  ...ASSESSMENT_PATTERNS,
  ...OFFER_PATTERNS,
  ...REJECTION_PATTERNS,
  ...BACKGROUND_PATTERNS,
  ...REFERENCE_PATTERNS,
  ...ONBOARDING_PATTERNS,
  ...OUTREACH_PATTERNS,
];

// Sort by base confidence descending for priority matching
export const PATTERNS_BY_CONFIDENCE = [...ALL_PATTERNS].sort(
  (a, b) => b.baseConfidence - a.baseConfidence,
);

// Group patterns by event type for quick lookup
export const PATTERNS_BY_EVENT_TYPE: Record<EmailEventType, ClassificationPattern[]> = {
  applied_confirmation: ALL_PATTERNS.filter((p) => p.eventType === 'applied_confirmation'),
  interview_request: ALL_PATTERNS.filter((p) => p.eventType === 'interview_request'),
  interview_scheduled: ALL_PATTERNS.filter((p) => p.eventType === 'interview_scheduled'),
  interview_rescheduled: ALL_PATTERNS.filter((p) => p.eventType === 'interview_rescheduled'),
  interview_reminder: ALL_PATTERNS.filter((p) => p.eventType === 'interview_reminder'),
  take_home_assignment: ALL_PATTERNS.filter((p) => p.eventType === 'take_home_assignment'),
  rejection: ALL_PATTERNS.filter((p) => p.eventType === 'rejection'),
  offer: ALL_PATTERNS.filter((p) => p.eventType === 'offer'),
  background_check: ALL_PATTERNS.filter((p) => p.eventType === 'background_check'),
  reference_request: ALL_PATTERNS.filter((p) => p.eventType === 'reference_request'),
  onboarding: ALL_PATTERNS.filter((p) => p.eventType === 'onboarding'),
  // New event types
  application_viewed: ALL_PATTERNS.filter((p) => p.eventType === 'application_viewed'),
  recruiter_outreach: ALL_PATTERNS.filter((p) => p.eventType === 'recruiter_outreach'),
  offer_negotiation: ALL_PATTERNS.filter((p) => p.eventType === 'offer_negotiation'),
};

/**
 * Classify an email subject using enhanced patterns.
 * Returns the best matching pattern with highest confidence.
 */
export function classifyWithPatterns(input: { subject: string; snippet?: string }): {
  pattern?: ClassificationPattern;
  confidence: number;
  matchedPatterns: ClassificationPattern[];
} {
  const combined = `${input.subject || ''}\n${input.snippet || ''}`.toLowerCase();

  const matchedPatterns = PATTERNS_BY_CONFIDENCE.filter((p) => p.pattern.test(combined));

  if (matchedPatterns.length === 0) {
    return { confidence: 0, matchedPatterns: [] };
  }

  // Return the highest confidence pattern
  const bestPattern = matchedPatterns[0];

  return {
    pattern: bestPattern,
    confidence: bestPattern.baseConfidence,
    matchedPatterns,
  };
}

/**
 * Check if email passes the subject gate (is job-related).
 * More inclusive than classification - just checks if email might be relevant.
 */
export function enhancedSubjectGate(input: { subject: string; from: string }): {
  passed: boolean;
  matchedPatterns: string[];
  vendorSignals: string[];
} {
  const subject = (input.subject || '').trim();
  const from = (input.from || '').trim();

  if (!subject) {
    return { passed: false, matchedPatterns: [], vendorSignals: [] };
  }

  const matchedPatterns = ALL_PATTERNS.filter((p) => p.pattern.test(subject)).map((p) => p.id);

  const vendorSignals = VENDOR_SIGNALS.filter((v) => v.pattern.test(from)).map((v) => v.id);

  // Pass if we matched any patterns directly
  const passedBySubject = matchedPatterns.length > 0;

  // Or if from a known vendor and subject mentions job-related keywords
  const passedByVendor =
    vendorSignals.length > 0 &&
    /\b(application|interview|offer|assessment|candidate|job|position|role|opportunity)\b/i.test(
      subject,
    );

  return {
    passed: passedBySubject || passedByVendor,
    matchedPatterns,
    vendorSignals,
  };
}
