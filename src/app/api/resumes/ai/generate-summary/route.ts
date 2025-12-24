import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

import type { ResumeData } from '@/components/resume/ResumeDocument';
import { evaluate } from '@/lib/ai-evaluation';

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

    const { resumeData, intent, jobTarget } = body;

    if (!resumeData) {
      return NextResponse.json({ error: 'Resume data is required' }, { status: 400 });
    }

    // Build context from resume data
    const context = buildContext(resumeData, intent, jobTarget);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: `You are an expert resume writer. Generate a concise, impactful professional summary for a resume.
The summary should:
- Be 2-3 sentences (50-150 words)
- Highlight key skills and experience relevant to the target
- Use strong action words and quantifiable achievements when possible
- Be written in first person without using "I"
- Be tailored to the intent (${intent || 'general job search'})

Respond with ONLY the summary text, no quotes or additional formatting.`,
        },
        {
          role: 'user',
          content: context,
        },
      ],
    });

    const summary = response.choices[0]?.message?.content?.trim();

    if (!summary) {
      return NextResponse.json(
        { error: 'Failed to generate summary - no content returned' },
        { status: 500 },
      );
    }

    const evaluation = await evaluate({
      tool_id: 'resume-suggestions',
      input: { resumeData, intent, jobTarget },
      output: { summary },
      user_id: userId,
    });

    if (!evaluation.passed) {
      return NextResponse.json(
        { error: 'Generated content failed safety checks' },
        { status: 422 },
      );
    }

    return NextResponse.json({ summary });
  } catch (error) {
    console.error(
      'Error generating summary:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}

function buildContext(
  resumeData: Partial<ResumeData>,
  intent?: string,
  jobTarget?: string,
): string {
  const parts: string[] = [];

  if (resumeData.contactInfo?.name) {
    parts.push(`Name: ${resumeData.contactInfo.name}`);
  }

  if (jobTarget) {
    parts.push(`Target role: ${jobTarget}`);
  }

  if (intent) {
    parts.push(`Purpose: ${intent}`);
  }

  const experience = resumeData.experience ?? [];
  if (experience.length > 0) {
    const expSummary = experience
      .slice(0, 3)
      .map((exp) => `${exp.title} at ${exp.company}`)
      .join(', ');
    parts.push(`Recent experience: ${expSummary}`);
  }

  const skills = resumeData.skills ?? [];
  if (skills.length > 0) {
    parts.push(`Key skills: ${skills.slice(0, 10).join(', ')}`);
  }

  const education = resumeData.education ?? [];
  if (education.length > 0) {
    const edu = education[0];
    if (edu.degree && edu.school) {
      const field = edu.field ? ` in ${edu.field}` : '';
      parts.push(`Education: ${edu.degree}${field} from ${edu.school}`);
    } else if (edu.school) {
      parts.push(`Education: ${edu.school}`);
    }
  }

  return parts.join('\n');
}
