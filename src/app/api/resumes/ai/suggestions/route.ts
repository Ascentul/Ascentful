import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

import type { ResumeData } from '@/components/resume/ResumeDocument';
import { evaluate } from '@/lib/ai-evaluation';
import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';
import { generateMockSuggestions } from '@/lib/resume-editor/suggestion-rules';
import type { Suggestion, SuggestionSeverity, SuggestionType } from '@/types/resume-editor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// System prompt for AI suggestions
const SYSTEM_PROMPT = `You are an expert resume coach. Analyze the resume and provide specific, actionable suggestions.

Return a JSON array of suggestions. Each suggestion must have:
- suggestionId: unique string (format: "ai-{section}-{index}")
- spanId: string identifying the section (e.g., "experience-0", "summary-text", "skills-list")
- severity: "critical" | "improve" | "optional"
- type: "metric" | "verb" | "clarity" | "ats" | "consistency" | "keyword" | "length" | "impact"
- category: "Impact" | "ATS" | "Clarity" | "Format"
- message: brief description of the issue
- proposedText: improved text or null if no specific replacement
- explainText: optional explanation of why this matters
- dismissed: false

Focus on:
1. Missing metrics/quantifiable achievements (critical/improve)
2. Weak action verbs that could be stronger (improve)
3. ATS optimization opportunities (improve)
4. Clarity and conciseness issues (optional)
5. Impact and achievement emphasis (improve)

Limit to 10-15 most important suggestions. Prioritize critical issues first.`;

interface AIResponse {
  suggestions: Array<{
    suggestionId: string;
    spanId: string;
    severity: string;
    type: string;
    category: string;
    message: string;
    proposedText: string | null;
    explainText?: string;
    dismissed: boolean;
  }>;
}

function validateSeverity(s: string): SuggestionSeverity {
  if (s === 'critical' || s === 'improve' || s === 'optional') return s;
  return 'optional';
}

function validateType(t: string): SuggestionType {
  const validTypes: SuggestionType[] = [
    'metric',
    'verb',
    'clarity',
    'ats',
    'consistency',
    'keyword',
    'length',
    'impact',
  ];
  if (validTypes.includes(t as SuggestionType)) return t as SuggestionType;
  return 'clarity';
}

function validateAISuggestions(raw: AIResponse): Suggestion[] {
  if (!raw.suggestions || !Array.isArray(raw.suggestions)) {
    return [];
  }

  return raw.suggestions
    .filter(
      (s) =>
        s.suggestionId &&
        s.spanId &&
        s.message &&
        typeof s.suggestionId === 'string' &&
        typeof s.spanId === 'string' &&
        typeof s.message === 'string',
    )
    .map((s) => ({
      suggestionId: s.suggestionId,
      spanId: s.spanId,
      severity: validateSeverity(s.severity),
      type: validateType(s.type),
      category: s.category || 'Impact',
      message: s.message,
      proposedText: typeof s.proposedText === 'string' ? s.proposedText : null,
      explainText: typeof s.explainText === 'string' ? s.explainText : undefined,
      dismissed: false,
    }));
}

function formatResumeForAI(resumeData: ResumeData): string {
  const parts: string[] = [];

  // Contact info
  if (resumeData.contactInfo?.name) parts.push(`Name: ${resumeData.contactInfo.name}`);
  if (resumeData.contactInfo?.email) parts.push(`Email: ${resumeData.contactInfo.email}`);

  // Summary
  if (resumeData.summary) {
    parts.push(`\n## Summary\n${resumeData.summary}`);
  }

  // Experience
  if (resumeData.experience?.length) {
    parts.push('\n## Experience');
    resumeData.experience.forEach((exp, i) => {
      parts.push(
        `\n### Experience ${i}: ${exp.title || 'Untitled'} at ${exp.company || 'Unknown'}`,
      );
      if (exp.location) parts.push(`Location: ${exp.location}`);
      if (exp.startDate || exp.endDate) {
        parts.push(`Dates: ${exp.startDate || ''} - ${exp.endDate || 'Present'}`);
      }
      if (exp.description) parts.push(`Description:\n${exp.description}`);
    });
  }

  // Education
  if (resumeData.education?.length) {
    parts.push('\n## Education');
    resumeData.education.forEach((edu, i) => {
      parts.push(`\n### Education ${i}: ${edu.degree || ''} in ${edu.field || ''}`);
      if (edu.school) parts.push(`School: ${edu.school}`);
      if (edu.gpa) parts.push(`GPA: ${edu.gpa}`);
    });
  }

  // Skills
  if (resumeData.skills?.length) {
    parts.push(`\n## Skills\n${resumeData.skills.join(', ')}`);
  }

  // Projects
  if (resumeData.projects?.length) {
    parts.push('\n## Projects');
    resumeData.projects.forEach((proj, i) => {
      parts.push(`\n### Project ${i}: ${proj.name || 'Untitled'}`);
      if (proj.description) parts.push(`Description: ${proj.description}`);
      if (proj.technologies) parts.push(`Technologies: ${proj.technologies}`);
    });
  }

  return parts.join('\n');
}

export async function POST(req: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(req);
  const log = createRequestLogger(correlationId, {
    feature: 'resume',
    httpMethod: 'POST',
    httpPath: '/api/resumes/ai/suggestions',
  });

  const startTime = Date.now();
  log.info('AI suggestions request started', { event: 'request.start' });

  const { userId } = await auth();
  if (!userId) {
    log.warn('Unauthorized request', { event: 'auth.failed' });
    return NextResponse.json(
      { error: 'Unauthorized', suggestions: [] },
      { status: 401, headers: { 'x-correlation-id': correlationId } },
    );
  }

  try {
    let resumeData: ResumeData;
    try {
      const body = await req.json();
      resumeData = body.resumeData;
    } catch {
      log.warn('Invalid JSON body', { event: 'validation.failed', errorCode: 'BAD_REQUEST' });
      return NextResponse.json(
        { error: 'Invalid JSON body', suggestions: [] },
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }

    if (!resumeData) {
      log.warn('Missing resumeData', { event: 'validation.failed', errorCode: 'BAD_REQUEST' });
      return NextResponse.json(
        { error: 'Missing resumeData', suggestions: [] },
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      log.info('No OpenAI key, using rule-based suggestions', { event: 'ai.not_configured' });
      const suggestions = generateMockSuggestions(resumeData);
      return NextResponse.json({ suggestions }, { headers: { 'x-correlation-id': correlationId } });
    }

    try {
      log.info('Starting OpenAI suggestions', { event: 'ai.request' });
      const client = new OpenAI({ apiKey });

      const resumeText = formatResumeForAI(resumeData);
      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Analyze this resume and provide suggestions:\n\n${resumeText}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content || '{"suggestions":[]}';
      let parsed: AIResponse;

      try {
        parsed = JSON.parse(content) as AIResponse;
      } catch {
        log.warn('Failed to parse AI response', { event: 'ai.parse_error' });
        const suggestions = generateMockSuggestions(resumeData);
        return NextResponse.json(
          { suggestions },
          { headers: { 'x-correlation-id': correlationId } },
        );
      }

      const suggestions = validateAISuggestions(parsed);
      log.info('OpenAI suggestions completed', {
        event: 'ai.response',
        extra: { suggestionCount: suggestions.length },
      });

      // Evaluate AI-generated suggestions (non-critical - result doesn't affect response)
      try {
        const evalResult = await evaluate({
          tool_id: 'resume-suggestions',
          input: { resumeData },
          output: { suggestions: suggestions.map((s) => ({ ...s })) },
        });

        if (!evalResult.passed) {
          log.warn('AI suggestions failed evaluation', {
            event: 'ai.evaluation.failed',
            extra: {
              score: evalResult.overall_score,
              riskFlagsCount: evalResult.risk_flags?.length ?? 0,
            },
          });
        }
      } catch (evalError) {
        log.warn('Error evaluating AI suggestions', {
          event: 'ai.evaluation.error',
          errorCode: toErrorCode(evalError),
        });
      }

      const durationMs = Date.now() - startTime;
      log.info('AI suggestions request completed', {
        event: 'request.success',
        httpStatus: 200,
        durationMs,
      });

      return NextResponse.json({ suggestions }, { headers: { 'x-correlation-id': correlationId } });
    } catch (aiError) {
      log.warn('AI suggestions error, falling back to rules', {
        event: 'ai.fallback',
        errorCode: toErrorCode(aiError),
      });
      const suggestions = generateMockSuggestions(resumeData);
      return NextResponse.json({ suggestions }, { headers: { 'x-correlation-id': correlationId } });
    }
  } catch (e) {
    const durationMs = Date.now() - startTime;
    log.error('AI suggestions request failed', toErrorCode(e), {
      event: 'request.error',
      httpStatus: 500,
      durationMs,
    });
    return NextResponse.json(
      { error: 'Failed to generate suggestions', suggestions: [] },
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}
