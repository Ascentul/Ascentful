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

    const prompt = buildPrompt(resumeData, intent, jobTarget);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an expert career advisor and resume writer. Analyze the provided resume data and suggest relevant skills.

Guidelines:
- Suggest 8-12 skills that would strengthen the resume
- Include a mix of hard skills (technical) and soft skills
- Prioritize skills relevant to the target role/intent if provided
- Consider skills implied by the experience but not explicitly listed
- Avoid generic skills like "hardworking" or "team player"
- Focus on skills that are commonly searched by ATS systems
- Include industry-specific terminology when appropriate

Respond with JSON: { "skills": ["skill1", "skill2", ...], "categories": { "technical": ["skill1", ...], "soft": ["skill1", ...], "tools": ["skill1", ...] } }`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return NextResponse.json({
      skills: parsed.skills || [],
      categories: parsed.categories || { technical: [], soft: [], tools: [] },
    });
  } catch (error) {
    console.error('Error suggesting skills:', error);
    return NextResponse.json({ error: 'Failed to suggest skills' }, { status: 500 });
  }
}

function buildPrompt(resumeData: any, intent?: string, jobTarget?: string): string {
  const parts: string[] = [];

  // Current skills
  if (resumeData.skills && resumeData.skills.length > 0) {
    parts.push(`Current skills: ${resumeData.skills.join(', ')}`);
  }

  // Experience summary
  if (resumeData.experience && resumeData.experience.length > 0) {
    const experienceSummary = resumeData.experience
      .map((exp: any) => {
        const bullets = exp.bullets?.join('; ') || exp.description || '';
        return `- ${exp.title} at ${exp.company}: ${bullets}`;
      })
      .join('\n');
    parts.push(`Work Experience:\n${experienceSummary}`);
  }

  // Education
  if (resumeData.education && resumeData.education.length > 0) {
    const educationSummary = resumeData.education
      .map((edu: any) => `- ${edu.degree} in ${edu.field || 'N/A'} from ${edu.school}`)
      .join('\n');
    parts.push(`Education:\n${educationSummary}`);
  }

  // Projects
  if (resumeData.projects && resumeData.projects.length > 0) {
    const projectSummary = resumeData.projects
      .map((proj: any) => `- ${proj.name}: ${proj.description || ''}`)
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
