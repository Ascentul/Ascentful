import { auth } from '@clerk/nextjs/server';
import { api } from 'convex/_generated/api';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

import { evaluate } from '@/lib/ai-evaluation';
import { convexServer } from '@/lib/convex-server';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Section-specific system prompts
const SECTION_PROMPTS: Record<string, string> = {
  contact: `You are helping the user complete the Contact Information section of their resume.
Ask about and help them provide:
- Full name
- Professional email address
- Phone number
- Location (City, State/Country)
- LinkedIn profile URL (optional)
- GitHub/Portfolio URL (if relevant)

Be conversational and helpful. If they mention their career profile has this info, acknowledge it and suggest using it.`,

  summary: `You are helping the user write a compelling Professional Summary for their resume.
A great summary should be 2-4 sentences that:
- Highlight their years of experience and key expertise
- Mention their most impressive achievements or skills
- Align with their career goals
- Include relevant keywords for their target industry

Ask about their experience level, key skills, and what kind of role they're targeting to craft a personalized summary.`,

  experience: `You are helping the user add Work Experience to their resume.
For each position, help them provide:
- Job title
- Company name
- Location
- Start and end dates
- 3-5 bullet points describing achievements and responsibilities

IMPORTANT for bullet points:
- Start each with a strong action verb (Led, Developed, Managed, Created, etc.)
- Include quantifiable results whenever possible (percentages, dollar amounts, numbers)
- Focus on achievements, not just duties
- Use the STAR format: Situation, Task, Action, Result

Ask about their most recent or most impactful role first.`,

  education: `You are helping the user add Education to their resume.
Help them provide:
- School/University name
- Degree type (Bachelor's, Master's, etc.)
- Field of study/Major
- Graduation year (or expected)
- GPA (if notable, typically 3.5+)
- Relevant honors or coursework (optional)

Ask about their educational background and what's most relevant to highlight.`,

  skills: `You are helping the user add Skills to their resume.
Help them list:
- Technical skills (programming languages, tools, software)
- Soft skills (leadership, communication, problem-solving)
- Industry-specific skills
- Certifications

Ask about their expertise areas and suggest organizing skills by category if they have many.
Recommend including skills that match their target job descriptions.`,
};

interface UserProfile {
  name?: string;
  email?: string;
  current_position?: string;
  current_company?: string;
  work_history?: Array<{ title?: string; company?: string }>;
  education_history?: Array<{ field?: string; school?: string }>;
  skills?: string;
}

interface CurrentResume {
  [key: string]: unknown;
}

// Generate initial question based on section and resume state
function getInitialQuestion(
  section: string,
  userProfile: UserProfile | null,
  currentResume: CurrentResume | null,
): string {
  const hasProfileData = userProfile && Object.keys(userProfile).length > 0;

  switch (section) {
    case 'contact':
      if (hasProfileData && userProfile.name) {
        return `I see from your profile that your name is ${userProfile.name}${userProfile.email ? ` and email is ${userProfile.email}` : ''}. Would you like me to use this information for your resume, or would you prefer to update it?`;
      }
      return "Let's start with your contact information. What's your full name as you'd like it to appear on your resume?";

    case 'summary':
      if (hasProfileData && userProfile.current_position) {
        return `I see you're currently a ${userProfile.current_position}${userProfile.current_company ? ` at ${userProfile.current_company}` : ''}. What type of role are you targeting with this resume? This will help me craft a compelling summary.`;
      }
      return "Let's write a compelling professional summary. First, tell me about your current role and how many years of experience you have in your field.";

    case 'experience':
      if (hasProfileData && userProfile.work_history?.length > 0) {
        const recentJob = userProfile.work_history[0];
        return `I found your work history! Your most recent role was ${recentJob.title || 'a position'} at ${recentJob.company || 'your previous company'}. Would you like me to help you write impactful bullet points for this role, or would you prefer to add a different position?`;
      }
      return "Let's add your work experience. Tell me about your most recent or most impactful role - what was your job title and company?";

    case 'education':
      if (hasProfileData && userProfile.education_history?.length > 0) {
        const education = userProfile.education_history[0];
        return `I see you studied ${education.field || 'at'} ${education.school || 'your university'}. Would you like me to add this to your resume? I can help format it professionally.`;
      }
      return "Let's add your education. What's the highest degree you've earned or are currently pursuing?";

    case 'skills':
      if (hasProfileData && userProfile.skills) {
        return `I found these skills in your profile: ${userProfile.skills}. Would you like to use these, or should we update the list? What skills are most relevant for the roles you're targeting?`;
      }
      return "Let's list your key skills. What are your strongest technical skills or areas of expertise?";

    default:
      return 'How can I help you with your resume today?';
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = await getToken({ template: 'convex' });
    if (!token) {
      return NextResponse.json({ error: 'Failed to obtain auth token' }, { status: 401 });
    }

    const body = await request.json();
    const {
      section,
      message,
      conversationHistory = [],
      currentResumeData,
      isInitial = false,
    } = body;

    if (!section) {
      return NextResponse.json({ error: 'Section is required' }, { status: 400 });
    }

    // Fetch user profile for context
    let userProfile = null;
    try {
      userProfile = await convexServer.query(
        api.resumes.getUserProfileForResume,
        { clerkId: userId },
        token,
      );
    } catch (error) {
      console.warn('Failed to fetch user profile for resume guidance:', error);
    }

    // For initial request, return the opening question
    if (isInitial) {
      const initialQuestion = getInitialQuestion(section, userProfile, currentResumeData);
      return NextResponse.json({
        response: initialQuestion,
        suggestions: getSuggestedResponses(section, userProfile),
      });
    }

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!openai) {
      return NextResponse.json({
        response:
          "I'm sorry, AI features are not currently available. Please configure the OpenAI API key.",
        suggestions: [],
      });
    }

    // Build context about current resume state
    const resumeContext = currentResumeData
      ? `\n--- CURRENT RESUME DATA ---\n${JSON.stringify(currentResumeData, null, 2)}\n`
      : '';

    // Build user profile context
    const profileContext = userProfile
      ? `\n--- USER PROFILE DATA (from their career profile) ---\n${JSON.stringify(userProfile, null, 2)}\n`
      : '';

    const systemPrompt = `You are an expert resume writing assistant helping users build professional resumes.

${SECTION_PROMPTS[section] || 'Help the user with their resume.'}

Guidelines:
- Be conversational and encouraging
- Ask follow-up questions to gather needed information
- When you have enough information, offer to generate content for the resume
- Use the user's profile data when available to personalize suggestions
- Keep responses concise (2-3 paragraphs max)
- When generating resume content, format it clearly

${profileContext}
${resumeContext}

IMPORTANT: When you have enough information to generate resume content, include it in a special format:
[RESUME_CONTENT]
{
  "field": "the field name to update",
  "value": "the content to add",
  "action": "set" or "append"
}
[/RESUME_CONTENT]

This allows the user to easily apply your suggestions to their resume.`;

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history
    conversationHistory.forEach((msg: unknown) => {
      if (typeof msg !== 'object' || msg === null) return;
      const typedMsg = msg as { isUser?: unknown; message?: unknown };
      if (typeof typedMsg.isUser !== 'boolean' || typeof typedMsg.message !== 'string') return;
      messages.push({
        role: typedMsg.isUser ? 'user' : 'assistant',
        content: typedMsg.message,
      });
    });

    // Add current message
    messages.push({ role: 'user', content: message });

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    const response =
      completion.choices[0]?.message?.content ||
      'I apologize, but I was unable to generate a response. Please try again.';

    // Parse any resume content from the response
    const resumeContent = parseResumeContent(response);
    const cleanResponse = response
      .replace(/\[RESUME_CONTENT\][\s\S]*?\[\/RESUME_CONTENT\]/g, '')
      .trim();

    // Evaluate AI-generated content for safety
    const evaluation = await evaluate({
      tool_id: 'resume-guidance',
      input: { section, message, conversationHistory },
      output: { response: cleanResponse, resumeContent },
      user_id: userId,
    });

    if (!evaluation.passed) {
      return NextResponse.json(
        { error: 'Generated content failed safety checks' },
        { status: 422 },
      );
    }

    return NextResponse.json({
      response: cleanResponse,
      resumeContent,
      suggestions: getSuggestedResponses(section, userProfile, conversationHistory.length),
    });
  } catch (error) {
    console.error('Resume guidance API error:', error);
    return NextResponse.json({ error: 'Failed to generate AI response' }, { status: 500 });
  }
}

interface ParsedResumeContent {
  field: string;
  value: string;
  action: 'set' | 'append';
}

function parseResumeContent(response: string): ParsedResumeContent | null {
  const match = response.match(/\[RESUME_CONTENT\]([\s\S]*?)\[\/RESUME_CONTENT\]/);
  if (match) {
    try {
      return JSON.parse(match[1].trim()) as ParsedResumeContent;
    } catch {
      console.warn('Failed to parse resume content from AI response');
      return null;
    }
  }
  return null;
}

function getSuggestedResponses(
  section: string,
  userProfile: UserProfile | null,
  historyLength: number = 0,
): string[] {
  // Early conversation suggestions
  if (historyLength < 2) {
    switch (section) {
      case 'contact':
        if (userProfile?.name) {
          return [
            'Yes, use my profile information',
            'I want to update my contact info',
            'Skip to the next section',
          ];
        }
        return ['My name is...', 'Use my existing profile info', 'Help me decide what to include'];

      case 'summary':
        return [
          'I have X years of experience in...',
          "I'm targeting a role as...",
          'Write a summary based on my profile',
        ];

      case 'experience':
        if (userProfile?.work_history?.length > 0) {
          return [
            'Use my profile work history',
            'I want to add a different role',
            'Help me write bullet points',
          ];
        }
        return [
          'My most recent role was...',
          'I want to highlight achievements at...',
          'Help me quantify my accomplishments',
        ];

      case 'education':
        return ['I graduated from...', 'Use my profile education', "I'm currently studying..."];

      case 'skills':
        return [
          'My technical skills include...',
          'Use skills from my profile',
          'What skills should I include for [role]?',
        ];
    }
  }

  // Later conversation suggestions
  return [
    'Generate this for my resume',
    'Can you improve this?',
    'Add more details',
    'This looks good, apply it',
  ];
}
