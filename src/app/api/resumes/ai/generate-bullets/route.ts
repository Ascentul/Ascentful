import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

import type { Experience } from '@/components/resume/ResumeDocument';
import { evaluate } from '@/lib/ai-evaluation';

export const runtime = 'nodejs';
export const maxDuration = 30;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { experience, intent, jobTarget } = body;

    if (!experience || !experience.title) {
      return NextResponse.json({ error: 'Experience with job title is required' }, { status: 400 });
    }

    const prompt = buildPrompt(experience, intent, jobTarget);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    let response;
    try {
      response = await openai.chat.completions.create(
        {
          model: 'gpt-4o',
          temperature: 0.7,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `You are an expert resume writer. Generate 3-5 impactful bullet points for a work experience entry.

Each bullet point should:
- Start with a strong action verb (past tense)
- Include quantifiable metrics when possible (%, $, numbers)
- Focus on achievements and impact, not just duties
- Be concise (one line, 10-15 words)
- Be relevant to the job target if provided

Respond with JSON: { "bullets": ["bullet1", "bullet2", ...] }`,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        },
        { signal: controller.signal },
      );
    } finally {
      clearTimeout(timeoutId);
    }

    const content = response.choices[0]?.message?.content || '{}';
    let bullets: string[] = [];
    try {
      const parsed = JSON.parse(content);
      bullets = parsed.bullets || [];
    } catch {
      console.error('Failed to parse OpenAI response:', content);
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    const evaluation = await evaluate({
      tool_id: 'resume-suggestions',
      input: { experience, intent, jobTarget },
      output: { bullets },
      user_id: userId,
    });

    if (!evaluation.passed) {
      return NextResponse.json(
        { error: 'Generated content failed safety checks' },
        { status: 422 },
      );
    }

    return NextResponse.json({ bullets });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'AI request timed out' }, { status: 504 });
    }
    console.error(
      'Error generating bullets:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return NextResponse.json({ error: 'Failed to generate bullets' }, { status: 500 });
  }
}

function buildPrompt(experience: Partial<Experience>, intent?: string, jobTarget?: string): string {
  const parts: string[] = [];

  parts.push(`Job Title: ${experience.title}`);
  parts.push(`Company: ${experience.company || 'Not specified'}`);

  if (experience.location) {
    parts.push(`Location: ${experience.location}`);
  }

  if (experience.startDate || experience.endDate) {
    parts.push(
      `Duration: ${experience.startDate || ''} - ${experience.current ? 'Present' : experience.endDate || ''}`,
    );
  }

  if (experience.description) {
    parts.push(`Current description: ${experience.description}`);
  }

  if (jobTarget) {
    parts.push(`Target role: ${jobTarget}`);
  }

  if (intent) {
    parts.push(`Resume purpose: ${intent}`);
  }

  return parts.join('\n');
}
