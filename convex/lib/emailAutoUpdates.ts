export const EMAIL_SUBJECT_GATE_VERSION = 'v1';

export type EmailProvider = 'gmail' | 'outlook';
export type EmailScanMode = 'metadata_only' | 'enhanced';

export type EmailEventType =
  | 'applied_confirmation'
  | 'interview_request'
  | 'interview_scheduled'
  | 'interview_rescheduled'
  | 'interview_reminder'
  | 'take_home_assignment'
  | 'rejection'
  | 'offer'
  | 'background_check'
  | 'reference_request'
  | 'onboarding';

export const AUTO_UPDATE_CONFIDENCE_THRESHOLD = 0.85;
export const SUGGEST_CONFIDENCE_THRESHOLD = 0.6;

export type ExtractedEmailEntities = {
  companyName?: string;
  roleTitle?: string;
  interviewDateTime?: string;
  recruiterName?: string;
  trackingId?: string;
  requisitionId?: string;
};

export type SubjectGateResult = {
  passed: boolean;
  matchedPatterns: string[];
  vendorSignals: string[];
};

const SUBJECT_PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: 'application_received', re: /\b(application received|we received your application)\b/i },
  { id: 'thanks_for_applying', re: /\b(thanks for applying|thank you for applying)\b/i },
  { id: 'application_status', re: /\b(application status|update on your application)\b/i },
  { id: 'interview_request', re: /\b(interview request|interview invitation|interview invite)\b/i },
  {
    id: 'schedule_interview',
    re: /\b(schedule (an )?interview|interview (schedule|scheduling))\b/i,
  },
  {
    id: 'interview_confirmation',
    re: /\b(interview (confirmation|confirmed)|confirmed interview)\b/i,
  },
  { id: 'interview_rescheduled', re: /\b(interview rescheduled|rescheduled interview)\b/i },
  { id: 'interview_reminder', re: /\b(interview reminder|reminder:.*interview)\b/i },
  { id: 'take_home', re: /\b(take[- ]home|coding challenge|assessment|assignment)\b/i },
  { id: 'offer', re: /\b(job offer|offer extended|offer letter|congratulations)\b/i },
  { id: 'rejection', re: /\b(unfortunately|not moving forward|we regret|rejected|declined)\b/i },
  { id: 'background_check', re: /\b(background check)\b/i },
  { id: 'reference_request', re: /\b(reference(s)? (request|check)|provide references)\b/i },
  { id: 'onboarding', re: /\b(onboarding|welcome aboard)\b/i },
];

const VENDOR_SIGNALS: Array<{ id: string; re: RegExp }> = [
  { id: 'greenhouse', re: /\bgreenhouse\b/i },
  { id: 'lever', re: /\blever\b/i },
  { id: 'workday', re: /\bworkday\b/i },
  { id: 'icims', re: /\bicims\b/i },
  { id: 'smartrecruiters', re: /\bsmartrecruiters\b/i },
  { id: 'ashby', re: /\bashby\b/i },
  { id: 'taleo', re: /\btaleo\b/i },
  { id: 'jobvite', re: /\bjobvite\b/i },
  { id: 'successfactors', re: /\bsuccessfactors\b/i },
];

export function subjectGate(input: { subject: string; from: string }): SubjectGateResult {
  const subject = (input.subject || '').trim();
  const from = (input.from || '').trim();

  if (!subject) {
    return { passed: false, matchedPatterns: [], vendorSignals: [] };
  }

  const matchedPatterns = SUBJECT_PATTERNS.filter((p) => p.re.test(subject)).map((p) => p.id);
  const vendorSignals = VENDOR_SIGNALS.filter((p) => p.re.test(from)).map((p) => p.id);

  const passedBySubject = matchedPatterns.length > 0;
  const passedByVendorWeak =
    vendorSignals.length > 0 &&
    /\b(application|interview|offer|assessment|candidate)\b/i.test(subject);

  return {
    passed: passedBySubject || passedByVendorWeak,
    matchedPatterns,
    vendorSignals,
  };
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function stripCommonCompanySuffixes(text: string): string {
  return text
    .replace(/\b(inc|inc\.|llc|l\.l\.c\.|ltd|ltd\.|corp|corp\.|co|co\.|company)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeCompanyName(text: string): string {
  const cleaned = stripCommonCompanySuffixes(text.toLowerCase().replace(/[^a-z0-9\s]/g, ' '));
  return normalizeWhitespace(cleaned);
}

export function normalizeRoleTitle(text: string): string {
  return normalizeWhitespace(text.toLowerCase().replace(/[^a-z0-9\s]/g, ' '));
}

export function extractEmailAddressDomain(from: string): string | undefined {
  const match =
    from.match(/<([^>]+)>/)?.[1] ?? from.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  if (!match) return undefined;
  const at = match.lastIndexOf('@');
  if (at === -1) return undefined;
  return match.slice(at + 1).toLowerCase();
}

function tokenSet(text: string): Set<string> {
  const tokens = normalizeWhitespace(text).split(' ').filter(Boolean);
  return new Set(tokens);
}

function tokenJaccard(a: string, b: string): number {
  const aSet = tokenSet(a);
  const bSet = tokenSet(b);
  if (aSet.size === 0 && bSet.size === 0) return 0;
  let intersection = 0;
  for (const t of aSet) {
    if (bSet.has(t)) intersection += 1;
  }
  const union = aSet.size + bSet.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function safeLower(text: string | undefined): string {
  return (text || '').toLowerCase();
}

export function classifyEmail(input: { subject: string; from: string; snippet?: string }): {
  eventType?: EmailEventType;
  confidence: number;
  entities: ExtractedEmailEntities;
  reason: string;
} {
  const subject = input.subject || '';
  const snippet = input.snippet || '';
  const combined = `${subject}\n${snippet}`.toLowerCase();

  const entities = extractEntities({ subject, from: input.from, snippet: input.snippet });

  const rules: Array<{ type: EmailEventType; re: RegExp; base: number; reason: string }> = [
    {
      type: 'rejection',
      re: /\b(unfortunately|not moving forward|we regret|rejected|declined)\b/i,
      base: 0.92,
      reason: 'rejection_phrases',
    },
    {
      type: 'offer',
      re: /\b(job offer|offer extended|offer letter)\b/i,
      base: 0.9,
      reason: 'offer_phrases',
    },
    {
      type: 'interview_rescheduled',
      re: /\b(rescheduled|new time|updated time)\b.*\binterview\b/i,
      base: 0.86,
      reason: 'interview_rescheduled_phrases',
    },
    {
      type: 'interview_reminder',
      re: /\b(reminder)\b.*\binterview\b/i,
      base: 0.82,
      reason: 'interview_reminder_phrases',
    },
    {
      type: 'interview_scheduled',
      re: /\b(interview (confirmation|confirmed)|confirmed interview|calendar invite)\b/i,
      base: 0.85,
      reason: 'interview_scheduled_phrases',
    },
    {
      type: 'interview_request',
      re: /\b(interview request|interview invitation|schedule (an )?interview|availability)\b/i,
      base: 0.84,
      reason: 'interview_request_phrases',
    },
    {
      type: 'take_home_assignment',
      re: /\b(take[- ]home|coding challenge|assessment|assignment)\b/i,
      base: 0.8,
      reason: 'assessment_phrases',
    },
    {
      type: 'background_check',
      re: /\b(background check)\b/i,
      base: 0.86,
      reason: 'background_check_phrases',
    },
    {
      type: 'reference_request',
      re: /\b(reference(s)? (request|check)|provide references)\b/i,
      base: 0.82,
      reason: 'reference_request_phrases',
    },
    {
      type: 'onboarding',
      re: /\b(onboarding|welcome aboard)\b/i,
      base: 0.8,
      reason: 'onboarding_phrases',
    },
    {
      type: 'applied_confirmation',
      re: /\b(application received|thanks for applying|thank you for applying|we received your application)\b/i,
      base: 0.9,
      reason: 'application_received_phrases',
    },
  ];

  for (const rule of rules) {
    if (rule.re.test(combined)) {
      const confidenceBoost = entities.companyName ? 0.03 : 0;
      return {
        eventType: rule.type,
        confidence: clamp01(rule.base + confidenceBoost),
        entities,
        reason: rule.reason,
      };
    }
  }

  return {
    eventType: undefined,
    confidence: 0,
    entities,
    reason: 'no_match',
  };
}

export function extractEntities(input: {
  subject: string;
  from: string;
  snippet?: string;
}): ExtractedEmailEntities {
  const subject = input.subject || '';
  const snippet = input.snippet || '';
  const combined = `${subject}\n${snippet}`;

  const entities: ExtractedEmailEntities = {};

  // Company name heuristics - order matters, more specific patterns first
  // Pattern: "... at CompanyName" (e.g., "Interview invitation - Marketing Manager at Starbucks")
  const companyFromAt = subject.match(
    /\bat\s+([A-Za-z0-9][A-Za-z0-9\s&.,'-]{1,58}[A-Za-z0-9.]?)$/i,
  )?.[1];
  // Pattern: "... with CompanyName" or "... from CompanyName"
  const companyFromWithFrom = subject.match(
    /\b(your interview with|interview with|offer from|application to)\s+([^|–—-]+)$/i,
  )?.[2];
  // Pattern: "Subject - CompanyName" (dash separator at end)
  const companyFromDash = subject.match(/[-–—]\s*([^|–—-]+)\s*$/)?.[1];

  const companyFromSubject = companyFromAt || companyFromWithFrom || companyFromDash;
  if (companyFromSubject) {
    const candidate = normalizeWhitespace(companyFromSubject);
    if (candidate.length >= 2 && candidate.length <= 60) {
      entities.companyName = candidate;
    }
  }

  // Role title heuristics - extract role from subject
  // Pattern: "Interview invitation - Marketing Manager at Starbucks" -> "Marketing Manager"
  const roleFromDashAt = subject.match(/[-–—]\s*([^|–—-]+?)\s+at\s+/i)?.[1];
  // Pattern: "for the role of X" or "for X"
  const roleFromFor =
    subject.match(/\bfor (the )?role of\s+([^|–—-]+)$/i)?.[2] ||
    subject.match(/\bfor\s+([^|–—-]{3,80})$/i)?.[1];

  const roleFromSubject = roleFromDashAt || roleFromFor;
  if (roleFromSubject) {
    const candidate = normalizeWhitespace(roleFromSubject);
    if (candidate.length >= 3 && candidate.length <= 80) {
      entities.roleTitle = candidate;
    }
  }

  // Tracking/requisition IDs (common patterns)
  const trackingId =
    combined.match(/\b(requisition|req|job)\s*(id|#)?\s*[:#]?\s*([A-Z0-9-]{5,})\b/i)?.[3] ||
    combined.match(/\btracking\s*(id|#)?\s*[:#]?\s*([A-Z0-9-]{5,})\b/i)?.[2];
  if (trackingId) {
    entities.requisitionId = trackingId;
    entities.trackingId = trackingId;
  }

  return entities;
}

export type ApplicationForMatching = {
  _id: string;
  company: string;
  job_title: string;
};

export type ApplicationMatchCandidate = {
  applicationId: string;
  score: number;
  signals: Record<string, unknown>;
};

// Minimum score required to suggest a match. Below this, we recommend creating a new application.
const MATCH_CONFIDENCE_THRESHOLD = 0.5;

// If we extracted a company name and it doesn't match any application's company,
// require an even higher threshold since we have explicit evidence of a mismatch.
const MATCH_CONFIDENCE_THRESHOLD_WITH_EXTRACTED_COMPANY = 0.6;

export function rankApplicationsForEmail(input: {
  applications: ApplicationForMatching[];
  extracted: ExtractedEmailEntities;
  subject: string;
  from: string;
  threadLinkedApplicationId?: string;
}): { best?: ApplicationMatchCandidate; top: ApplicationMatchCandidate[] } {
  if (input.threadLinkedApplicationId) {
    const linked = input.applications.find((a) => a._id === input.threadLinkedApplicationId);
    if (linked) {
      const candidate: ApplicationMatchCandidate = {
        applicationId: linked._id,
        score: 0.95,
        signals: { thread_link: true },
      };
      return { best: candidate, top: [candidate] };
    }
  }

  const emailDomain = extractEmailAddressDomain(input.from);
  const extractedCompany = input.extracted.companyName
    ? normalizeCompanyName(input.extracted.companyName)
    : '';
  const extractedRole = input.extracted.roleTitle
    ? normalizeRoleTitle(input.extracted.roleTitle)
    : '';

  const subjectNorm = normalizeRoleTitle(input.subject);

  const scored = input.applications
    .map((app) => {
      const companyNorm = normalizeCompanyName(app.company);
      const roleNorm = normalizeRoleTitle(app.job_title);

      const companyScore = extractedCompany
        ? Math.max(
            tokenJaccard(companyNorm, extractedCompany),
            companyNorm === extractedCompany ? 1 : 0,
            companyNorm.includes(extractedCompany) || extractedCompany.includes(companyNorm)
              ? 0.9
              : 0,
          )
        : tokenJaccard(companyNorm, subjectNorm) * 0.7;

      const roleScore = extractedRole
        ? tokenJaccard(roleNorm, extractedRole)
        : tokenJaccard(roleNorm, subjectNorm);

      const domainBoost =
        emailDomain &&
        companyNorm &&
        safeLower(emailDomain).includes(companyNorm.split(' ')[0] || '')
          ? 0.08
          : 0;

      const score = clamp01(companyScore * 0.7 + roleScore * 0.3 + domainBoost);

      const signals: Record<string, unknown> = {
        companyScore,
        roleScore,
        emailDomain,
        extractedCompany: input.extracted.companyName,
        extractedRole: input.extracted.roleTitle,
      };

      return { applicationId: app._id, score, signals };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  // Determine the threshold based on whether we extracted a company name.
  // If we have an extracted company name (like "Starbucks") and no application matches it,
  // we should NOT suggest an existing application - the user should create a new one.
  const threshold = extractedCompany
    ? MATCH_CONFIDENCE_THRESHOLD_WITH_EXTRACTED_COMPANY
    : MATCH_CONFIDENCE_THRESHOLD;

  const best = scored[0];

  // Only return a "best" match if it meets the threshold
  // If the score is too low, return undefined for best so the UI defaults to "Create new"
  if (!best || best.score < threshold) {
    return { best: undefined, top: scored };
  }

  return { best, top: scored };
}

export type ApplicationStage =
  | 'Prospect'
  | 'Applied'
  | 'Interview'
  | 'Offer'
  | 'Accepted'
  | 'Rejected'
  | 'Withdrawn'
  | 'Archived';

export function mapEmailEventTypeToStage(eventType: EmailEventType): ApplicationStage {
  switch (eventType) {
    case 'applied_confirmation':
      return 'Applied';
    case 'interview_request':
    case 'interview_scheduled':
    case 'interview_rescheduled':
    case 'interview_reminder':
      return 'Interview';
    case 'take_home_assignment':
      // No dedicated Assessment stage in Ascentful stage model
      return 'Interview';
    case 'offer':
    case 'background_check':
    case 'reference_request':
      return 'Offer';
    case 'onboarding':
      // Best fit for "hired" in Ascentful stage model
      return 'Accepted';
    case 'rejection':
      return 'Rejected';
  }
}

export type LegacyApplicationStatus = 'saved' | 'applied' | 'interview' | 'offer' | 'rejected';

export function mapStageToLegacyStatus(stage: ApplicationStage): LegacyApplicationStatus {
  const map: Record<ApplicationStage, LegacyApplicationStatus> = {
    Prospect: 'saved',
    Applied: 'applied',
    Interview: 'interview',
    Offer: 'offer',
    Accepted: 'offer', // Lossy: maps to same as Offer
    Rejected: 'rejected',
    Withdrawn: 'rejected', // Lossy: maps to same as Rejected
    Archived: 'saved', // Lossy: maps to same as Prospect
  };
  return map[stage];
}

export function limitSnippet(text: string | undefined, maxLen: number = 280): string | undefined {
  if (!text) return undefined;
  const trimmed = normalizeWhitespace(text);
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLen - 1))}…`;
}
