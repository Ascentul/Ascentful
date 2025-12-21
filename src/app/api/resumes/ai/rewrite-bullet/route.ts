import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type RewriteMode = 'stronger' | 'shorter' | 'add_metric';

const MODE_PROMPTS: Record<RewriteMode, string> = {
  stronger: `Rewrite this bullet point to be more impactful and powerful.
Use stronger action verbs and emphasize achievements.
Keep the same meaning but make it more compelling.`,

  shorter: `Rewrite this bullet point to be more concise.
Reduce word count by 20-30% while preserving the key impact.
Remove filler words and redundancies.`,

  add_metric: `Rewrite this bullet point to include a quantifiable metric.
Add a realistic percentage, number, or dollar amount that demonstrates impact.
If no specific metric is available, add a reasonable estimate (e.g., "15+ stakeholders", "3x improvement").`,
};

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bullet, mode, context } = await request.json();

    if (!bullet || typeof bullet !== 'string') {
      return NextResponse.json({ error: 'Bullet point text is required' }, { status: 400 });
    }

    if (!mode || !['stronger', 'shorter', 'add_metric'].includes(mode)) {
      return NextResponse.json(
        { error: 'Valid mode is required: stronger, shorter, or add_metric' },
        { status: 400 },
      );
    }

    const modePrompt = MODE_PROMPTS[mode as RewriteMode];

    const contextInfo = context
      ? `\n\nContext:\nJob Title: ${context.jobTitle || 'Not specified'}\nCompany: ${context.company || 'Not specified'}\nTarget Role: ${context.targetRole || 'Not specified'}`
      : '';

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an expert resume writer specializing in crafting impactful bullet points.

${modePrompt}

Rules:
- Start with a past tense action verb
- Keep it to one line (under 15 words ideally)
- Focus on results and impact
- Be specific and professional

Respond with JSON: { "rewritten": "the rewritten bullet point" }`,
        },
        {
          role: 'user',
          content: `Original bullet point: "${bullet}"${contextInfo}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return NextResponse.json({ rewritten: parsed.rewritten || bullet });
  } catch (error) {
    console.error('Error rewriting bullet:', error);
    return NextResponse.json({ error: 'Failed to rewrite bullet' }, { status: 500 });
  }
}
