// AI-powered Job Description analysis API route
// Uses STANDARD tier (gpt-5-mini) for lightweight parsing and keyword extraction

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { callAI } from '@/lib/ai/client';
import { buildJDAnalysisUserPrompt, JD_ANALYSIS_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { JDAnalysisResponseSchema } from '@/lib/ai/schemas';
import { evaluate } from '@/lib/ai-evaluation';

export const runtime = 'nodejs';
export const maxDuration = 75; // Buffer for retries (2 × 30s timeout) + response processing

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

    // Call AI with STANDARD tier (gpt-5-mini) - lightweight prompt for fast response
    const result = await callAI(JD_ANALYSIS_SYSTEM_PROMPT, userPrompt, JDAnalysisResponseSchema, {
      tier: 'standard',
      maxRetries: 2,
      maxTokens: 4096, // Enough for JD analysis response
      timeoutMs: 30000, // 30 second timeout per attempt
    });

    if (!result.success) {
      const errorMessage = result.error || 'Unknown error';
      console.error('AI JD analysis failed:', errorMessage);
      // Return sanitized error message to the client
      const clientError =
        errorMessage.includes('API key') || errorMessage.includes('configuration')
          ? 'Service temporarily unavailable. Please try again later.'
          : errorMessage.includes('timeout') || errorMessage.includes('timed out')
            ? 'Analysis timed out. Please try again with a shorter job description.'
            : 'Failed to analyze job description. Please try again.';
      return NextResponse.json({ error: clientError }, { status: 500 });
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
