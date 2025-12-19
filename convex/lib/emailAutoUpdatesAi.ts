import { z } from 'zod';

import type { EmailEventType, ExtractedEmailEntities } from './emailAutoUpdates';
import { AUTO_UPDATE_CONFIDENCE_THRESHOLD } from './emailAutoUpdates';

export const EMAIL_AI_EXTRACTOR_PROMPT_VERSION = 'v1';

const EMAIL_EVENT_TYPES: EmailEventType[] = [
  'applied_confirmation',
  'interview_request',
  'interview_scheduled',
  'interview_rescheduled',
  'interview_reminder',
  'take_home_assignment',
  'rejection',
  'offer',
  'background_check',
  'reference_request',
  'onboarding',
];

export const EmailAiExtractorOutputSchema = z.object({
  eventType: z.enum(EMAIL_EVENT_TYPES as [EmailEventType, ...EmailEventType[]]),
  confidence: z.number().min(0).max(1),
  entities: z
    .object({
      companyName: z.string().min(2).max(60).optional(),
      roleTitle: z.string().min(3).max(80).optional(),
      interviewDateTime: z.string().max(80).optional(),
      recruiterName: z.string().max(80).optional(),
      trackingId: z.string().max(80).optional(),
      requisitionId: z.string().max(80).optional(),
    })
    .default({}),
  summary: z.string().min(1).max(160),
});

export type EmailAiExtractorOutput = z.infer<typeof EmailAiExtractorOutputSchema>;

export function buildEmailAiExtractorMessages(input: {
  subject: string;
  from: string;
  snippet?: string;
}): Array<{ role: 'system' | 'user'; content: string }> {
  const snippet = input.snippet ? input.snippet.trim() : '';
  const hasSnippet = snippet.length > 0;

  const system = `You classify job application lifecycle emails for a personal job tracker.
Return STRICT JSON only (no markdown) matching this schema:
{
  "eventType": ${EMAIL_EVENT_TYPES.map((t) => `"${t}"`).join(' | ')},
  "confidence": number (0..1),
  "entities": { "companyName"?: string, "roleTitle"?: string, "interviewDateTime"?: string, "recruiterName"?: string, "trackingId"?: string, "requisitionId"?: string },
  "summary": string (<=160 chars, one short line)
}
Rules:
- Use only the provided subject/from${hasSnippet ? '/snippet' : ''}; never assume unseen content.
- If unsure, set confidence < 0.6.
- Prefer conservative confidence; reserve >= 0.85 for very clear cases.
- Do not include any sensitive personal data in "summary".`;

  const user = `PROMPT_VERSION=${EMAIL_AI_EXTRACTOR_PROMPT_VERSION}

Subject: ${input.subject || ''}
From: ${input.from || ''}
${hasSnippet ? `Snippet: ${snippet}` : 'Snippet: [not provided]'}`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function capBelowAutoThreshold(value: number): number {
  return Math.min(value, AUTO_UPDATE_CONFIDENCE_THRESHOLD - 0.01);
}

export function mergeRuleAndAiClassification(input: {
  rule: {
    eventType?: EmailEventType;
    confidence: number;
    entities: ExtractedEmailEntities;
    reason: string;
  };
  ai: EmailAiExtractorOutput;
}): {
  eventType?: EmailEventType;
  confidence: number;
  entities: ExtractedEmailEntities;
  classificationSource: 'rules' | 'rules+ai' | 'rules+ai_conflict' | 'ai';
} {
  const mergedEntities: ExtractedEmailEntities = { ...input.rule.entities };
  const aiEntities = input.ai.entities || {};

  // Merge string entities from AI
  // AI only extracts the original string fields, not interviewRound/interviewRoundType
  if (aiEntities.companyName?.trim()) {
    mergedEntities.companyName = aiEntities.companyName.trim();
  }
  if (aiEntities.roleTitle?.trim()) {
    mergedEntities.roleTitle = aiEntities.roleTitle.trim();
  }
  if (aiEntities.interviewDateTime?.trim()) {
    mergedEntities.interviewDateTime = aiEntities.interviewDateTime.trim();
  }
  if (aiEntities.recruiterName?.trim()) {
    mergedEntities.recruiterName = aiEntities.recruiterName.trim();
  }
  if (aiEntities.trackingId?.trim()) {
    mergedEntities.trackingId = aiEntities.trackingId.trim();
  }
  if (aiEntities.requisitionId?.trim()) {
    mergedEntities.requisitionId = aiEntities.requisitionId.trim();
  }
  // interviewRound and interviewRoundType are extracted by rules, not AI

  const ruleType = input.rule.eventType;
  const aiType = input.ai.eventType;

  if (!ruleType) {
    return {
      eventType: aiType,
      confidence: clamp01(input.ai.confidence),
      entities: mergedEntities,
      classificationSource: 'ai',
    };
  }

  if (aiType === ruleType) {
    return {
      eventType: ruleType,
      confidence: clamp01(Math.max(input.rule.confidence, input.ai.confidence)),
      entities: mergedEntities,
      classificationSource: 'rules+ai',
    };
  }

  return {
    eventType: ruleType,
    confidence: clamp01(
      capBelowAutoThreshold(Math.max(input.rule.confidence, input.ai.confidence)),
    ),
    entities: mergedEntities,
    classificationSource: 'rules+ai_conflict',
  };
}
