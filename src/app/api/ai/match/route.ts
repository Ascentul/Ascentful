// AI-powered Resume-to-JD match scoring API route
// Uses PRO tier for comprehensive skills and experience matching

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { callAI } from '@/lib/ai/client';
import { buildMatchScoreUserPrompt, MATCH_SCORE_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { MatchScoreResponseSchema } from '@/lib/ai/schemas';
import { evaluate } from '@/lib/ai-evaluation';

export const runtime = 'nodejs';
export const maxDuration = 60;

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
    const { resume, jdAnalysis } = body;

    // Validate resume exists and has required structure
    if (!resume || typeof resume !== 'object') {
      return NextResponse.json({ error: 'Resume data is required' }, { status: 400 });
    }

    // Validate required contactInfo field
    if (!resume.contactInfo || typeof resume.contactInfo !== 'object') {
      return NextResponse.json({ error: 'Resume must include contactInfo' }, { status: 400 });
    }

    // Validate jdAnalysis exists and has required structure
    if (!jdAnalysis || typeof jdAnalysis !== 'object') {
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
      const errorMessage = result.error || 'Unknown error';
      console.error('AI match scoring failed:', errorMessage);
      return NextResponse.json(
        { error: 'Failed to calculate match score', details: errorMessage },
        { status: 500 },
      );
    }

    // Evaluate AI-generated content for safety
    const evaluation = await evaluate({
      tool_id: 'resume-match',
      input: { resume, jdAnalysis },
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
