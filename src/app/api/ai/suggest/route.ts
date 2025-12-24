// AI-powered suggestions API route
// Uses STANDARD tier for generating improvement suggestions

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { callAI } from '@/lib/ai/client';
import { buildSuggestionsUserPrompt, SUGGESTIONS_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { SuggestionsResponseSchema } from '@/lib/ai/schemas';
import { evaluate } from '@/lib/ai-evaluation';

export const runtime = 'nodejs';
export const maxDuration = 45;

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { resume, jobDescription, focusAreas } = body;

    if (!resume) {
      return NextResponse.json({ error: 'Resume data is required' }, { status: 400 });
    }

    if (jobDescription !== undefined && typeof jobDescription !== 'string') {
      return NextResponse.json({ error: 'jobDescription must be a string' }, { status: 400 });
    }

    if (focusAreas !== undefined && !Array.isArray(focusAreas)) {
      return NextResponse.json({ error: 'focusAreas must be an array' }, { status: 400 });
    }

    // Build the user prompt
    const userPrompt = buildSuggestionsUserPrompt(resume, jobDescription, focusAreas);

    // Call AI with STANDARD tier
    const result = await callAI(SUGGESTIONS_SYSTEM_PROMPT, userPrompt, SuggestionsResponseSchema, {
      tier: 'standard',
      maxRetries: 2,
      temperature: 0.3,
    });

    if (!result.success) {
      console.error('AI suggestions failed:', result.error);
      return NextResponse.json(
        { error: 'Failed to generate suggestions', details: result.error },
        { status: 500 },
      );
    }

    // Evaluate AI-generated content for safety
    const evaluation = await evaluate({
      tool_id: 'resume-suggestions',
      input: { resume, jobDescription, focusAreas },
      output: result.data as Record<string, unknown>,
      user_id: userId,
    });

    if (!evaluation.passed) {
      return NextResponse.json(
        { error: 'Generated content failed safety checks' },
        { status: 422 },
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      usage: result.usage,
      model: result.model,
    });
  } catch (error) {
    console.error('Suggest API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
