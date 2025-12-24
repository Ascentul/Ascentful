// AI-powered bullet rewrite API route
// Uses STANDARD tier for creative rewriting with alternatives

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { callAI } from '@/lib/ai/client';
import { buildRewriteUserPrompt, REWRITE_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { BulletRewriteResponseSchema } from '@/lib/ai/schemas';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { bullet, roleContext, targetKeywords, emphasis } = body;

    if (!bullet) {
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
      console.error('AI rewrite failed:', result.error);
      return NextResponse.json(
        { error: 'Failed to rewrite bullet', details: result.error },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      usage: result.usage,
      model: result.model,
    });
  } catch (error) {
    console.error('Rewrite API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
