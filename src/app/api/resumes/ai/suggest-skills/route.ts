import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

import type { ResumeData } from '@/components/resume/ResumeDocument';
import { callAI } from '@/lib/ai/client';
import { SkillSuggestionsResponseSchema } from '@/lib/ai/schemas';
import { evaluate } from '@/lib/ai-evaluation';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are an expert career advisor and resume writer. Analyze the provided resume data and suggest relevant skills.

Guidelines:
- Suggest 8-12 skills that would strengthen the resume
- Include a mix of hard skills (technical) and soft skills
- Prioritize skills relevant to the target role/intent if provided
- Consider skills implied by the experience but not explicitly listed
- Avoid generic skills like "hardworking" or "team player"
- Focus on skills that are commonly searched by ATS systems
- Include industry-specific terminology when appropriate

Respond with JSON: { "skills": ["skill1", "skill2", ...], "categories": { "technical": ["skill1", ...], "soft": ["skill1", ...], "tools": ["skill1", ...] } }`;

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

    const userPrompt = buildPrompt(resumeData, intent, jobTarget);

    const result = await callAI(SYSTEM_PROMPT, userPrompt, SkillSuggestionsResponseSchema, {
      tier: 'standard',
      maxRetries: 2,
      temperature: 0.7,
    });

    if (!result.success || !result.data) {
      console.error('AI skill suggestions failed:', result.error);
      return NextResponse.json(
        { error: 'Failed to generate skill suggestions', details: result.error },
        { status: 500 },
      );
    }

    const evaluation = await evaluate({
      tool_id: 'resume-suggestions',
      input: { resumeData, intent, jobTarget },
      output: result.data,
      user_id: userId,
    });

    if (!evaluation.passed) {
      return NextResponse.json(
        { error: 'Generated content failed safety checks' },
        { status: 422 },
      );
    }

    return NextResponse.json({
      skills: result.data.skills,
      categories: result.data.categories,
    });
  } catch (error) {
    console.error('Error suggesting skills:', error);
    return NextResponse.json({ error: 'Failed to suggest skills' }, { status: 500 });
  }
}

function buildPrompt(resumeData: Partial<ResumeData>, intent?: string, jobTarget?: string): string {
  const parts: string[] = [];

  // Current skills
  if (resumeData.skills && resumeData.skills.length > 0) {
    parts.push(`Current skills: ${resumeData.skills.join(', ')}`);
  }

  // Experience summary
  if (resumeData.experience && resumeData.experience.length > 0) {
    const experienceSummary = resumeData.experience
      .map((exp) => `- ${exp.title} at ${exp.company}: ${exp.description || ''}`)
      .join('\n');
    parts.push(`Work Experience:\n${experienceSummary}`);
  }

  // Education
  if (resumeData.education && resumeData.education.length > 0) {
    const educationSummary = resumeData.education
      .map((edu) => `- ${edu.degree} in ${edu.field || 'N/A'} from ${edu.school}`)
      .join('\n');
    parts.push(`Education:\n${educationSummary}`);
  }

  // Projects
  if (resumeData.projects && resumeData.projects.length > 0) {
    const projectSummary = resumeData.projects
      .map((proj) => `- ${proj.name}: ${proj.description || ''}`)
      .join('\n');
    parts.push(`Projects:\n${projectSummary}`);
  }

  // Target context
  if (jobTarget) {
    parts.push(`Target role: ${jobTarget}`);
  }

  if (intent) {
    parts.push(`Resume purpose: ${intent}`);
  }

  return parts.join('\n\n');
}
