import { AUTO_UPDATE_CONFIDENCE_THRESHOLD } from '../../convex/lib/emailAutoUpdates';
import {
  buildEmailAiExtractorMessages,
  EMAIL_AI_EXTRACTOR_PROMPT_VERSION,
  EmailAiExtractorOutputSchema,
  mergeRuleAndAiClassification,
} from '../../convex/lib/emailAutoUpdatesAi';

describe('email auto updates ai', () => {
  it('validates AI extractor output with Zod', () => {
    const res = EmailAiExtractorOutputSchema.safeParse({
      eventType: 'rejection',
      confidence: 0.9,
      entities: { companyName: 'Acme' },
      summary: 'Clear rejection language in snippet.',
    });
    expect(res.success).toBe(true);
  });

  it('merges rule + ai when event type matches', () => {
    const merged = mergeRuleAndAiClassification({
      rule: {
        eventType: 'interview_request',
        confidence: 0.84,
        entities: { companyName: 'Acme' },
        reason: 'interview_request_phrases',
      },
      ai: {
        eventType: 'interview_request',
        confidence: 0.92,
        entities: { roleTitle: 'Software Engineer' },
        summary: 'Interview scheduling language detected.',
      },
    });

    expect(merged.classificationSource).toBe('rules+ai');
    expect(merged.eventType).toBe('interview_request');
    expect(merged.confidence).toBeGreaterThanOrEqual(0.92);
    expect(merged.entities.companyName).toBe('Acme');
    expect(merged.entities.roleTitle).toBe('Software Engineer');
  });

  it('caps confidence below auto threshold when ai disagrees', () => {
    const merged = mergeRuleAndAiClassification({
      rule: {
        eventType: 'interview_request',
        confidence: 0.84,
        entities: { companyName: 'Acme' },
        reason: 'interview_request_phrases',
      },
      ai: {
        eventType: 'offer',
        confidence: 0.99,
        entities: {},
        summary: 'Offer language detected.',
      },
    });

    expect(merged.classificationSource).toBe('rules+ai_conflict');
    expect(merged.eventType).toBe('interview_request');
    expect(merged.confidence).toBeLessThan(AUTO_UPDATE_CONFIDENCE_THRESHOLD);
  });

  it('includes prompt version and snippet marker', () => {
    const noSnippet = buildEmailAiExtractorMessages({
      subject: 'Thanks for applying',
      from: 'jobs@acme.com',
    });
    expect(noSnippet[1]?.content).toContain(`PROMPT_VERSION=${EMAIL_AI_EXTRACTOR_PROMPT_VERSION}`);
    expect(noSnippet[1]?.content).toContain('Snippet: [not provided]');

    const withSnippet = buildEmailAiExtractorMessages({
      subject: 'Interview invitation',
      from: 'recruiter@acme.com',
      snippet: '  Please share your availability. ',
    });
    expect(withSnippet[1]?.content).toContain('Snippet: Please share your availability.');
  });
});
