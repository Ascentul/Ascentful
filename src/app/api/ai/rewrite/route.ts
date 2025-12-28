// AI-powered bullet rewrite API route
// Uses STANDARD tier for creative rewriting with alternatives

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { callAI } from '@/lib/ai/client';
import { buildRewriteUserPrompt, REWRITE_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { BulletRewriteResponseSchema } from '@/lib/ai/schemas';
import { evaluate } from '@/lib/ai-evaluation';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: Request) {
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
    const { bullet, roleContext, targetKeywords, emphasis } = body;

    if (!bullet || typeof bullet !== 'string' || bullet.trim().length === 0) {
      return NextResponse.json({ error: 'Bullet text is required' }, { status: 400 });
    }

    // Build the user prompt
    const userPrompt = buildRewriteUserPrompt(bullet, roleContext, targetKeywords, emphasis);

    // Call AI with STANDARD tier
    const result = await callAI(REWRITE_SYSTEM_PROMPT, userPrompt, BulletRewriteResponseSchema, {
      tier: 'standard',
      maxRetries: 2,
      temperature: 0.4, // Slightly higher for creative variations
    });

    if (!result.success) {
      // Log generic error - avoid logging full error which may contain PII from bullet text
      console.error('AI rewrite failed');
      return NextResponse.json({ error: 'Failed to rewrite bullet' }, { status: 500 });
    }

    // Evaluate AI-generated content for safety (PII, hallucinations, etc.)
    const evaluation = await evaluate({
      tool_id: 'resume-optimization',
      input: { bullet, roleContext, targetKeywords, emphasis },
      output: result.data as Record<string, unknown>,
      user_id: userId,
    });

    if (!evaluation.passed) {
      console.error('AI content failed safety evaluation');
      return NextResponse.json({ error: 'Content failed safety evaluation' }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      usage: result.usage,
      model: result.model,
    });
  } catch (error) {
    // Log error type only - avoid logging full error which may contain PII
    console.error('Rewrite API error:', error instanceof Error ? error.name : 'Unknown error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
