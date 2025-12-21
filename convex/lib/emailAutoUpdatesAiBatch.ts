/**
 * Batch AI Classification for Email Auto-Updates
 *
 * This module provides:
 * 1. Batch classification of multiple emails in a single AI call
 * 2. Enhanced entity extraction (salary, deadlines, meeting links)
 * 3. Rate limit handling with exponential backoff
 */

import { z } from 'zod';
import type OpenAI from 'openai';

import {
  AUTO_UPDATE_CONFIDENCE_THRESHOLD,
  type EmailEventType,
  type ExtractedEmailEntities,
} from './emailAutoUpdates';

export const EMAIL_AI_BATCH_EXTRACTOR_PROMPT_VERSION = 'v2';

// =============================================================================
// EXTENDED EVENT TYPES FOR AI
// =============================================================================

const EMAIL_EVENT_TYPES: EmailEventType[] = [
  'applied_confirmation',
  'application_viewed',
  'interview_request',
  'interview_scheduled',
  'interview_rescheduled',
  'interview_reminder',
  'interview_feedback',
  'take_home_assignment',
  'offer',
  'offer_negotiation',
  'background_check',
  'reference_request',
  'onboarding',
  'rejection',
  'withdrawal_confirmation',
  'recruiter_outreach',
];

// =============================================================================
// ENHANCED ENTITY SCHEMA
// =============================================================================

const SalaryRangeSchema = z
  .object({
    min: z.number().optional(),
    max: z.number().optional(),
    currency: z.string().default('USD'),
    period: z.enum(['hourly', 'annual', 'monthly']).default('annual'),
  })
  .optional();

const ExtendedEntitiesSchema = z.object({
  companyName: z.string().min(2).max(60).optional(),
  roleTitle: z.string().min(3).max(80).optional(),
  interviewDateTime: z.string().max(80).optional(),
  interviewType: z
    .enum(['phone', 'video', 'onsite', 'panel', 'technical', 'behavioral'])
    .optional(),
  interviewRound: z.number().min(1).max(10).optional(),
  interviewerNames: z.array(z.string().max(80)).optional(),
  meetingLink: z.string().url().optional(),
  recruiterName: z.string().max(80).optional(),
  trackingId: z.string().max(80).optional(),
  requisitionId: z.string().max(80).optional(),
  salary: SalaryRangeSchema,
  offerDeadline: z.string().max(80).optional(),
  startDate: z.string().max(80).optional(),
  location: z.enum(['remote', 'onsite', 'hybrid']).optional(),
});

export type ExtendedEntities = z.infer<typeof ExtendedEntitiesSchema>;

// =============================================================================
// BATCH OUTPUT SCHEMA
// =============================================================================

const BatchEmailClassificationSchema = z.object({
  emailIndex: z.number(),
  classification: z.object({
    eventType: z.enum(EMAIL_EVENT_TYPES as [EmailEventType, ...EmailEventType[]]),
    confidence: z.number().min(0).max(1),
    entities: ExtendedEntitiesSchema.default({}),
    summary: z.string().min(1).max(160),
  }),
});

const BatchOutputSchema = z.object({
  classifications: z.array(BatchEmailClassificationSchema),
});

export type BatchEmailClassification = z.infer<typeof BatchEmailClassificationSchema>;
export type BatchOutput = z.infer<typeof BatchOutputSchema>;

// =============================================================================
// BATCH CLASSIFICATION PROMPT
// =============================================================================

const BATCH_SYSTEM_PROMPT = `You are an expert email classifier for a job application tracking system.
You will receive a batch of emails and must classify each one.

For EACH email, return a classification with:
- eventType: The type of job-related event
- confidence: How confident you are (0.0-1.0)
- entities: Extracted information
- summary: Brief summary (≤100 chars)

IMPORTANT RULES:
1. Use confidence >= 0.9 ONLY for very clear, unambiguous cases
2. Use confidence < 0.6 if you're unsure - it's better to be conservative
3. Extract ALL entities you can find (company, role, salary, dates, etc.)
4. For salary, extract any mentioned ranges or amounts
5. For dates, use ISO 8601 format when possible
6. Never include personal email addresses in entities
7. If an email doesn't appear job-related, use confidence 0 and eventType "rejection"

EVENT TYPES:
- applied_confirmation: "We received your application"
- application_viewed: "Your application was viewed"
- interview_request: "We'd like to schedule an interview"
- interview_scheduled: "Your interview is confirmed"
- interview_rescheduled: "Interview time has changed"
- interview_reminder: "Reminder about your upcoming interview"
- interview_feedback: "Following up on your interview"
- take_home_assignment: "Please complete this assessment"
- offer: "We're pleased to offer you"
- offer_negotiation: "Regarding your compensation package"
- background_check: "Background verification required"
- reference_request: "Please provide references"
- onboarding: "Welcome aboard / Start date info"
- rejection: "Unfortunately / Not moving forward"
- withdrawal_confirmation: "Your withdrawal has been processed"
- recruiter_outreach: "I found your profile / Opportunity at..."`;

// =============================================================================
// RATE LIMIT CONFIG
// =============================================================================

export type RateLimitConfig = {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('rate limit') ||
      error.message.includes('429') ||
      error.message.includes('Rate limit')
    );
  }
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// BATCH CLASSIFICATION FUNCTIONS
// =============================================================================

export type EmailForBatchClassification = {
  index: number;
  subject: string;
  from: string;
  snippet?: string;
};

/**
 * Build the user prompt for batch classification.
 */
function buildBatchUserPrompt(emails: EmailForBatchClassification[]): string {
  const emailsText = emails
    .map((e) => {
      const snippetLine = e.snippet ? `Snippet: ${e.snippet}` : 'Snippet: [not provided]';
      return `EMAIL ${e.index}:
Subject: ${e.subject || '[empty]'}
From: ${e.from || '[unknown]'}
${snippetLine}`;
    })
    .join('\n\n');

  return `PROMPT_VERSION=${EMAIL_AI_BATCH_EXTRACTOR_PROMPT_VERSION}

Classify the following ${emails.length} email(s):

${emailsText}

Return a JSON object with a "classifications" array containing one entry per email.`;
}

/**
 * Strip markdown code fences from AI response.
 */
function stripJsonCodeFences(content: string): string {
  let clean = (content || '').trim();
  if (clean.startsWith('```')) {
    clean = clean
      .replace(/^```json\n?/, '')
      .replace(/^```\n?/, '')
      .replace(/\n?```$/, '')
      .trim();
  }
  return clean;
}

/**
 * Classify a batch of emails using AI.
 * Returns classifications for all emails, with fallbacks for failed items.
 */
export async function batchClassifyEmails(input: {
  openai: OpenAI;
  model: string;
  emails: EmailForBatchClassification[];
  rateLimitConfig?: RateLimitConfig;
}): Promise<BatchEmailClassification[]> {
  const config = input.rateLimitConfig || DEFAULT_RATE_LIMIT_CONFIG;

  if (input.emails.length === 0) {
    return [];
  }

  // Limit batch size to 10 emails
  const batchSize = Math.min(input.emails.length, 10);
  const emailsToProcess = input.emails.slice(0, batchSize);

  if (input.emails.length > 10) {
    console.warn(`[batchClassifyEmails] Truncating batch from ${input.emails.length} to 10 emails`);
  }

  let attempts = 0;
  let delay = config.baseDelayMs;

  while (attempts < config.maxRetries) {
    try {
      const response = await input.openai.chat.completions.create({
        model: input.model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: BATCH_SYSTEM_PROMPT },
          { role: 'user', content: buildBatchUserPrompt(emailsToProcess) },
        ],
        temperature: 0.3, // Lower temperature for more consistent classification
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from AI');
      }

      const parsed = JSON.parse(stripJsonCodeFences(content));
      const validation = BatchOutputSchema.safeParse(parsed);

      if (!validation.success) {
        console.warn('[batchClassifyEmails] Schema validation failed:', validation.error);
        // Try to salvage individual classifications
        return createFallbackClassifications(emailsToProcess);
      }

      return validation.data.classifications;
    } catch (error) {
      if (isRateLimitError(error) && attempts < config.maxRetries - 1) {
        console.warn(
          `[batchClassifyEmails] Rate limited, retrying in ${delay}ms (attempt ${attempts + 1})`,
        );
        await sleep(delay);
        delay = Math.min(delay * 2, config.maxDelayMs);
        attempts++;
      } else if (isRateLimitError(error)) {
        // All rate-limit retries exhausted
        console.error('[batchClassifyEmails] Rate limit retries exhausted:', error);
        return createFallbackClassifications(emailsToProcess);
      } else {
        // Non-recoverable error
        console.error('[batchClassifyEmails] Failed:', error);
        return createFallbackClassifications(emailsToProcess);
      }
    }
  }

  // Should not reach here, but fallback just in case
  return createFallbackClassifications(emailsToProcess);
}

/**
 * Create fallback classifications when AI fails.
 * Returns low-confidence classifications that will be handled by rules.
 */
function createFallbackClassifications(
  emails: EmailForBatchClassification[],
): BatchEmailClassification[] {
  return emails.map((email) => ({
    emailIndex: email.index,
    classification: {
      eventType: 'rejection' as EmailEventType, // Safe default
      confidence: 0, // Will be overridden by rules
      entities: {},
      summary: 'AI classification unavailable',
    },
  }));
}

/**
 * Merge extended AI entities with rule-based entities.
 * AI entities take precedence for fields it extracts.
 */
export function mergeEntities(
  ruleEntities: ExtractedEmailEntities,
  aiEntities: ExtendedEntities,
): ExtractedEmailEntities & Partial<ExtendedEntities> {
  const merged: ExtractedEmailEntities & Partial<ExtendedEntities> = { ...ruleEntities };

  // String fields - AI takes precedence if present
  if (aiEntities.companyName?.trim()) {
    merged.companyName = aiEntities.companyName.trim();
  }
  if (aiEntities.roleTitle?.trim()) {
    merged.roleTitle = aiEntities.roleTitle.trim();
  }
  if (aiEntities.interviewDateTime?.trim()) {
    merged.interviewDateTime = aiEntities.interviewDateTime.trim();
  }
  if (aiEntities.recruiterName?.trim()) {
    merged.recruiterName = aiEntities.recruiterName.trim();
  }
  if (aiEntities.trackingId?.trim()) {
    merged.trackingId = aiEntities.trackingId.trim();
  }
  if (aiEntities.requisitionId?.trim()) {
    merged.requisitionId = aiEntities.requisitionId.trim();
  }

  // Interview round - AI takes precedence
  if (aiEntities.interviewRound !== undefined) {
    merged.interviewRound = aiEntities.interviewRound;
  }

  // Extended fields (new)
  if (aiEntities.interviewType) {
    (merged as ExtendedEntities).interviewType = aiEntities.interviewType;
  }
  if (aiEntities.interviewerNames?.length) {
    (merged as ExtendedEntities).interviewerNames = aiEntities.interviewerNames;
  }
  if (aiEntities.meetingLink) {
    (merged as ExtendedEntities).meetingLink = aiEntities.meetingLink;
  }
  if (aiEntities.salary) {
    (merged as ExtendedEntities).salary = aiEntities.salary;
  }
  if (aiEntities.offerDeadline) {
    (merged as ExtendedEntities).offerDeadline = aiEntities.offerDeadline;
  }
  if (aiEntities.startDate) {
    (merged as ExtendedEntities).startDate = aiEntities.startDate;
  }
  if (aiEntities.location) {
    (merged as ExtendedEntities).location = aiEntities.location;
  }

  return merged;
}

/**
 * Merge batch AI classification with rule-based classification.
 * Similar to mergeRuleAndAiClassification but for batch results.
 */
export function mergeBatchClassification(input: {
  rule: {
    eventType?: EmailEventType;
    confidence: number;
    entities: ExtractedEmailEntities;
    reason: string;
  };
  ai: BatchEmailClassification['classification'];
}): {
  eventType?: EmailEventType;
  confidence: number;
  entities: ExtractedEmailEntities & Partial<ExtendedEntities>;
  classificationSource: 'rules' | 'rules+ai' | 'rules+ai_conflict' | 'ai';
} {
  const AUTO_UPDATE_THRESHOLD = AUTO_UPDATE_CONFIDENCE_THRESHOLD;
  const mergedEntities = mergeEntities(input.rule.entities, input.ai.entities);

  const ruleType = input.rule.eventType;
  const aiType = input.ai.eventType;

  // If rules didn't match, use AI
  if (!ruleType) {
    return {
      eventType: aiType,
      confidence: clamp01(input.ai.confidence),
      entities: mergedEntities,
      classificationSource: 'ai',
    };
  }

  // If both agree, boost confidence
  if (aiType === ruleType) {
    return {
      eventType: ruleType,
      confidence: clamp01(Math.max(input.rule.confidence, input.ai.confidence)),
      entities: mergedEntities,
      classificationSource: 'rules+ai',
    };
  }

  // Conflict - prefer rules but cap confidence below auto-apply threshold
  return {
    eventType: ruleType,
    confidence: clamp01(
      Math.min(Math.max(input.rule.confidence, input.ai.confidence), AUTO_UPDATE_THRESHOLD - 0.01),
    ),
    entities: mergedEntities,
    classificationSource: 'rules+ai_conflict',
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// =============================================================================
// BATCH PROCESSING UTILITIES
// =============================================================================

export type BatchProcessResult = {
  processed: number;
  aiCalls: number;
  classifications: Array<{
    emailIndex: number;
    eventType?: EmailEventType;
    confidence: number;
    entities: ExtractedEmailEntities & Partial<ExtendedEntities>;
    classificationSource: string;
    aiSummary?: string;
  }>;
};

/**
 * Process a batch of emails with combined rules + AI classification.
 */
export async function processBatchWithAI(input: {
  openai: OpenAI;
  model: string;
  emails: Array<{
    index: number;
    subject: string;
    from: string;
    snippet?: string;
    ruleClassification: {
      eventType?: EmailEventType;
      confidence: number;
      entities: ExtractedEmailEntities;
      reason: string;
    };
  }>;
}): Promise<BatchProcessResult> {
  // Filter emails that need AI enhancement (below auto-apply threshold)
  const AUTO_APPLY_THRESHOLD = 0.85;
  const needsAI = input.emails.filter(
    (e) => e.ruleClassification.confidence < AUTO_APPLY_THRESHOLD,
  );

  // Get AI classifications for those that need it
  let aiClassifications: Map<number, BatchEmailClassification['classification']> = new Map();
  let aiCalls = 0;

  if (needsAI.length > 0) {
    const aiResults = await batchClassifyEmails({
      openai: input.openai,
      model: input.model,
      emails: needsAI.map((e) => ({
        index: e.index,
        subject: e.subject,
        from: e.from,
        snippet: e.snippet,
      })),
    });

    aiCalls = 1;
    for (const result of aiResults) {
      aiClassifications.set(result.emailIndex, result.classification);
    }
  }

  // Merge results
  const classifications = input.emails.map((email) => {
    const aiResult = aiClassifications.get(email.index);

    if (aiResult) {
      const merged = mergeBatchClassification({
        rule: email.ruleClassification,
        ai: aiResult,
      });

      return {
        emailIndex: email.index,
        eventType: merged.eventType,
        confidence: merged.confidence,
        entities: merged.entities,
        classificationSource: merged.classificationSource,
        aiSummary: aiResult.summary,
      };
    }

    // No AI needed, use rules only
    return {
      emailIndex: email.index,
      eventType: email.ruleClassification.eventType,
      confidence: email.ruleClassification.confidence,
      entities: email.ruleClassification.entities,
      classificationSource: 'rules',
      aiSummary: undefined,
    };
  });

  return {
    processed: input.emails.length,
    aiCalls,
    classifications,
  };
}
