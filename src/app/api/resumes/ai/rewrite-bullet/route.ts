import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { callAI } from '@/lib/ai/client';
import { evaluate } from '@/lib/ai-evaluation';

export const runtime = 'nodejs';
export const maxDuration = 60;

type RewriteMode = 'stronger' | 'shorter' | 'add_metric';

const MODE_PROMPTS: Record<RewriteMode, string> = {
  stronger: `Rewrite this bullet point to be more impactful and powerful.
Use stronger action verbs and emphasize achievements.
Keep the same meaning but make it more compelling.`,

  shorter: `Rewrite this bullet point to be more concise.
Reduce word count by 20-30% while preserving the key impact.
Remove filler words and redundancies.`,

  add_metric: `Rewrite this bullet point to include a quantifiable metric.
Only use metrics explicitly stated in the original bullet or provided context.
If no metric is available, return the original bullet unchanged.`,
};

const RewriteBulletResponseSchema = z.object({
  rewritten: z.string().optional(),
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

    const { bullet, mode, context } = body;

    if (!bullet || typeof bullet !== 'string') {
      return NextResponse.json({ error: 'Bullet point text is required' }, { status: 400 });
    }

    if (!mode || !['stronger', 'shorter', 'add_metric'].includes(mode)) {
      return NextResponse.json(
        { error: 'Valid mode is required: stronger, shorter, or add_metric' },
        { status: 400 },
      );
    }

    const modePrompt = MODE_PROMPTS[mode as RewriteMode];

    const contextInfo = context
      ? `\n\nContext:\nJob Title: ${context.jobTitle || 'Not specified'}\nCompany: ${context.company || 'Not specified'}\nTarget Role: ${context.targetRole || 'Not specified'}`
      : '';

    const systemPrompt = `You are an expert resume writer specializing in crafting impactful bullet points.

${modePrompt}

Rules:
- Start with a past tense action verb
- Keep it to one line (under 15 words ideally)
- Focus on results and impact
- Be specific and professional

Respond with JSON: { "rewritten": "the rewritten bullet point" }`;
    const userPrompt = `Original bullet point: "${bullet}"${contextInfo}`;

    const result = await callAI(systemPrompt, userPrompt, RewriteBulletResponseSchema, {
      tier: 'standard',
      maxRetries: 2,
      temperature: 0.7,
    });

    if (!result.success || !result.data) {
      console.error('AI rewrite failed');
      return NextResponse.json({ error: 'Failed to rewrite bullet' }, { status: 500 });
    }

    const rewritten = result.data.rewritten || bullet;
    const usedFallback = !result.data.rewritten;
    const evaluation = await evaluate({
      tool_id: 'resume-suggestions',
      input: { bullet, mode, context },
      output: { rewritten },
      user_id: userId,
    });

    if (!evaluation.passed) {
      return NextResponse.json(
        { error: 'Generated content failed safety checks' },
        { status: 422 },
      );
    }

    return NextResponse.json({ rewritten, ...(usedFallback && { fallback: true }) });
  } catch (error) {
    console.error(
      'Error rewriting bullet:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return NextResponse.json({ error: 'Failed to rewrite bullet' }, { status: 500 });
  }
}
