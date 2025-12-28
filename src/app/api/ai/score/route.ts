// AI-powered resume scoring API route
// Uses PRO tier for complex multi-dimensional analysis

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { callAI } from '@/lib/ai/client';
import { buildScoreUserPrompt, SCORE_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { ScoreResponseSchema } from '@/lib/ai/schemas';
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
    const { resume, jobDescription } = body;

    // Validate resume exists and has required structure
    if (!resume || typeof resume !== 'object') {
      return NextResponse.json({ error: 'Resume data is required' }, { status: 400 });
    }

    // Validate required contactInfo field
    if (!resume.contactInfo || typeof resume.contactInfo !== 'object') {
      return NextResponse.json(
        { error: 'Resume must include contactInfo with name and email' },
        { status: 400 },
      );
    }

    // Validate essential contact fields
    if (!resume.contactInfo.name || !resume.contactInfo.email) {
      return NextResponse.json(
        { error: 'Resume contactInfo must include name and email' },
        { status: 400 },
      );
    }

    // Build the user prompt with resume data
    const userPrompt = buildScoreUserPrompt(resume, jobDescription);

    // Call AI with PRO tier for complex analysis
    const result = await callAI(SCORE_SYSTEM_PROMPT, userPrompt, ScoreResponseSchema, {
      tier: 'pro',
      maxRetries: 2,
      temperature: 0.2,
    });

    if (!result.success) {
      console.error('AI scoring failed');
      return NextResponse.json({ error: 'Failed to score resume' }, { status: 500 });
    }

    // Evaluate AI-generated content for safety
    const evaluation = await evaluate({
      tool_id: 'resume-analysis',
      input: { resume, jobDescription },
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
    console.error('Score API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
