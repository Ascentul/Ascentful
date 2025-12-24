// AI-powered Resume-to-JD match scoring API route
// Uses PRO tier for comprehensive skills and experience matching

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { callAI } from '@/lib/ai/client';
import { buildMatchScoreUserPrompt, MATCH_SCORE_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { MatchScoreResponseSchema } from '@/lib/ai/schemas';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { resume, jdAnalysis } = body;

    if (!resume) {
      return NextResponse.json({ error: 'Resume data is required' }, { status: 400 });
    }

    if (!jdAnalysis) {
      return NextResponse.json({ error: 'Job description analysis is required' }, { status: 400 });
    }

    // Build the user prompt
    const userPrompt = buildMatchScoreUserPrompt(resume, jdAnalysis);

    // Call AI with PRO tier for comprehensive analysis
    const result = await callAI(MATCH_SCORE_SYSTEM_PROMPT, userPrompt, MatchScoreResponseSchema, {
      tier: 'pro',
      maxRetries: 2,
      temperature: 0.2,
    });

    if (!result.success) {
      const errorMessage = result.error instanceof Error ? result.error.message : 'Unknown error';
      console.error('AI match scoring failed:', errorMessage);
      return NextResponse.json(
        { error: 'Failed to calculate match score', details: errorMessage },
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
    console.error('Match API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
