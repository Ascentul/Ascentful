// AI-powered Job Description analysis API route
// Uses PRO tier for comprehensive parsing and keyword extraction

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { callAI } from '@/lib/ai/client';
import { buildJDAnalysisUserPrompt, JD_ANALYSIS_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { JDAnalysisResponseSchema } from '@/lib/ai/schemas';
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
    const { jobDescription, url } = body;

    if (!jobDescription) {
      return NextResponse.json({ error: 'Job description text is required' }, { status: 400 });
    }

    // Build the user prompt
    const userPrompt = buildJDAnalysisUserPrompt(jobDescription, url);

    // Call AI with PRO tier for complex analysis
    const result = await callAI(JD_ANALYSIS_SYSTEM_PROMPT, userPrompt, JDAnalysisResponseSchema, {
      tier: 'pro',
      maxRetries: 2,
      temperature: 0.2,
    });

    if (!result.success) {
      console.error('AI JD analysis failed:', result.error || 'Unknown error');
      return NextResponse.json({ error: 'Failed to analyze job description' }, { status: 500 });
    }

    // Evaluate AI-generated content for safety
    const evaluation = await evaluate({
      tool_id: 'jd-analysis',
      input: { jobDescription, url },
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
    console.error(
      'Analyze JD API error:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
