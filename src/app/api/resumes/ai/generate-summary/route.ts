import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { resumeData, intent, jobTarget } = await request.json();

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

    const summary = response.choices[0]?.message?.content?.trim() || '';

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error generating summary:', error);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}

function buildContext(resumeData: any, intent?: string, jobTarget?: string): string {
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

  if (resumeData.experience?.length > 0) {
    const expSummary = resumeData.experience
      .slice(0, 3)
      .map((exp: any) => `${exp.title} at ${exp.company}`)
      .join(', ');
    parts.push(`Recent experience: ${expSummary}`);
  }

  if (resumeData.skills?.length > 0) {
    parts.push(`Key skills: ${resumeData.skills.slice(0, 10).join(', ')}`);
  }

  if (resumeData.education?.length > 0) {
    const edu = resumeData.education[0];
    parts.push(`Education: ${edu.degree} in ${edu.field} from ${edu.school}`);
  }

  return parts.join('\n');
}
