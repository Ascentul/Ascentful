import { api } from 'convex/_generated/api';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

import {
  detectIndustryFromRole,
  INDUSTRIES,
  Industry,
} from '@/lib/career-explorer/industryTaxonomy';
import { findMajorConfig, getIndustryForMajor } from '@/lib/career-explorer/majorIndustryMapping';
import { requireConvexToken } from '@/lib/convex-auth';
import { convexServer } from '@/lib/convex-server';
import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

export const runtime = 'nodejs';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

interface GalaxyRole {
  id: string;
  title: string;
  category: string;
  fit_score: number;
  reason: string;
  skills: string[];
  growth_outlook?: string;
}

interface GalaxyRolesResponse {
  roles: GalaxyRole[];
  categories: string[];
}

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'career-path',
    httpMethod: 'POST',
    httpPath: '/api/career-explorer/galaxy-roles',
  });

  const startTime = Date.now();
  log.info('Galaxy roles generation request started', { event: 'request.start' });

  try {
    const { userId, token } = await requireConvexToken();
    log.debug('User authenticated', { event: 'auth.success', clerkId: userId });

    // Get user's career galaxy data from Convex
    const galaxyData = await convexServer.query(api.career_explorer.getCareerGalaxyData, {}, token);

    if (!galaxyData) {
      log.warn('No galaxy data found for user', { event: 'data.not_found' });
      return NextResponse.json(
        { error: 'User profile data not found' },
        { status: 404, headers: { 'x-correlation-id': correlationId } },
      );
    }

    const { profile, quizResult, savedRoleIds } = galaxyData;

    // Detect industry from profile (major, work history, or dream job)
    const detectedIndustry = detectIndustryFromProfile(profile);
    const industryConfig = INDUSTRIES[detectedIndustry];

    // Build context from profile data
    const profileContext = buildProfileContext(profile);
    const quizContext = quizResult ? buildQuizContext(quizResult) : '';
    const industryContext = buildIndustryContext(detectedIndustry, industryConfig);

    // Generate roles using OpenAI
    if (!openai) {
      log.warn('OpenAI client not configured, returning empty roles');
      return NextResponse.json(
        { roles: [], categories: [] },
        { status: 200, headers: { 'x-correlation-id': correlationId } },
      );
    }

    const prompt = buildRoleGenerationPrompt(profileContext, quizContext, industryContext);

    log.info('Starting OpenAI galaxy roles generation', {
      event: 'ai.request',
      extra: { industry: detectedIndustry },
    });

    let generatedRoles: GalaxyRolesResponse | null = null;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a career counselor and job market expert with deep knowledge of industry-specific career paths. Generate personalized career role suggestions based on the user's profile, experience, career goals, AND their industry context. Ensure role progressions are REALISTIC for the user's industry.

IMPORTANT: Return ONLY valid JSON, no markdown code blocks. The response must be a valid JSON object.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 4000,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;
      if (content) {
        try {
          generatedRoles = JSON.parse(content) as GalaxyRolesResponse;
          log.info('OpenAI galaxy roles generation completed', {
            event: 'ai.response',
            extra: { roleCount: generatedRoles?.roles?.length || 0 },
          });
        } catch (parseError) {
          log.warn('Failed to parse OpenAI response', {
            event: 'ai.parse.error',
            errorCode: toErrorCode(parseError),
          });
        }
      }
    } catch (error) {
      log.warn('OpenAI API call failed', {
        event: 'ai.fallback',
        errorCode: toErrorCode(error),
      });
    }

    // If AI generation failed, use fallback roles
    if (!generatedRoles || !generatedRoles.roles || generatedRoles.roles.length < 10) {
      log.info('Using fallback roles', { event: 'ai.fallback.used' });
      generatedRoles = generateFallbackRoles(profile);
    }

    // Mark saved roles
    const rolesWithSavedStatus = generatedRoles.roles.map((role) => ({
      ...role,
      is_saved: savedRoleIds.includes(role.id),
    }));

    const durationMs = Date.now() - startTime;
    log.info('Galaxy roles generation request completed', {
      event: 'request.success',
      httpStatus: 200,
      durationMs,
      extra: { roleCount: rolesWithSavedStatus.length },
    });

    return NextResponse.json(
      {
        roles: rolesWithSavedStatus,
        categories: generatedRoles.categories,
        profile_summary: {
          has_work_history: !!(profile.work_history && profile.work_history.length > 0),
          has_education: !!(profile.education_history && profile.education_history.length > 0),
          has_quiz_results: !!quizResult,
          dream_job: profile.dream_job,
          career_goals: profile.career_goals,
        },
      },
      {
        status: 200,
        headers: { 'x-correlation-id': correlationId },
      },
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status =
      message === 'Unauthorized' || message === 'Failed to obtain auth token' ? 401 : 500;
    log.error('Galaxy roles generation request failed', toErrorCode(error), {
      event: 'request.error',
      httpStatus: status,
      durationMs,
    });
    return NextResponse.json(
      { error: message },
      {
        status,
        headers: { 'x-correlation-id': correlationId },
      },
    );
  }
}

/**
 * Detect the primary industry from user profile data
 * Priority: major > current role > dream job > default to technology
 */
function detectIndustryFromProfile(profile: any): Industry {
  // 1. Check major (most reliable for students/new grads)
  if (profile.major) {
    const industryFromMajor = getIndustryForMajor(profile.major);
    if (industryFromMajor) {
      return industryFromMajor;
    }
  }

  // 2. Check education history for field of study
  if (profile.education_history && profile.education_history.length > 0) {
    for (const edu of profile.education_history) {
      if (edu.field_of_study) {
        const industryFromField = getIndustryForMajor(edu.field_of_study);
        if (industryFromField) {
          return industryFromField;
        }
      }
    }
  }

  // 3. Check current role
  if (profile.current_position || profile.job_title) {
    const role = profile.current_position || profile.job_title;
    return detectIndustryFromRole(role);
  }

  // 4. Check work history
  if (profile.work_history && profile.work_history.length > 0) {
    const latestRole = profile.work_history[0]?.role;
    if (latestRole) {
      return detectIndustryFromRole(latestRole);
    }
  }

  // 5. Check dream job
  if (profile.dream_job) {
    return detectIndustryFromRole(profile.dream_job);
  }

  // 6. Default to technology
  return 'technology';
}

/**
 * Build industry context string for the AI prompt
 */
function buildIndustryContext(industry: Industry, config: (typeof INDUSTRIES)[Industry]): string {
  const sections: string[] = [];

  sections.push(`Primary Industry: ${config.name}`);
  sections.push(`Career Progression Pattern: ${config.typicalProgression.join(' → ')}`);

  if (!config.hasInternships) {
    sections.push(
      `Entry Path: ${config.entryPathType.replace(/_/g, ' ')} (NOT traditional internships)`,
    );
  } else {
    sections.push(`Entry Path: Internship → Entry-level roles`);
  }

  if (config.requiredCredentials && config.requiredCredentials.length > 0) {
    sections.push(`Common Credentials: ${config.requiredCredentials.join(', ')}`);
  }

  // Add career level examples
  const levelExamples = config.careerLevels
    .slice(0, 5)
    .map((l) => `${l.name} (Level ${l.level})`)
    .join(', ');
  sections.push(`Career Levels: ${levelExamples}...`);

  return sections.join('\n');
}

function buildProfileContext(profile: any): string {
  const sections: string[] = [];

  // Note: Intentionally omit profile.name - it's unnecessary PII for role recommendations

  // Current position
  if (profile.current_position || profile.job_title) {
    sections.push(`Current Role: ${profile.current_position || profile.job_title}`);
  }
  if (profile.current_company || profile.company) {
    sections.push(`Current Company: ${profile.current_company || profile.company}`);
  }

  // Education
  if (profile.major) {
    sections.push(`Major: ${profile.major}`);
  }
  if (profile.university_name) {
    sections.push(`University: ${profile.university_name}`);
  }
  if (profile.graduation_year) {
    sections.push(`Graduation Year: ${profile.graduation_year}`);
  }
  if (profile.education_history && profile.education_history.length > 0) {
    const eduList = profile.education_history
      .map((edu: any) =>
        `${edu.degree || ''} in ${edu.field_of_study || ''} from ${edu.school || ''}`.trim(),
      )
      .filter((s: string) => s.length > 5)
      .join('; ');
    if (eduList) {
      sections.push(`Education History: ${eduList}`);
    }
  }

  // Work history
  if (profile.work_history && profile.work_history.length > 0) {
    const workList = profile.work_history
      .map((work: any) => `${work.role || ''} at ${work.company || ''}`.trim())
      .filter((s: string) => s.length > 3)
      .join('; ');
    if (workList) {
      sections.push(`Work History: ${workList}`);
    }
  }

  // Skills
  if (profile.skills) {
    sections.push(`Skills: ${profile.skills}`);
  }

  // Career aspirations
  if (profile.dream_job) {
    sections.push(`Dream Job: ${profile.dream_job}`);
  }
  if (profile.career_goals) {
    sections.push(`Career Goals: ${profile.career_goals}`);
  }

  // Experience level
  if (profile.experience_level) {
    sections.push(`Experience Level: ${profile.experience_level}`);
  }
  if (profile.industry) {
    sections.push(`Industry Interest: ${profile.industry}`);
  }

  // Bio
  if (profile.bio) {
    sections.push(`Bio: ${profile.bio}`);
  }

  return sections.join('\n');
}

function buildQuizContext(quizResult: any): string {
  const sections: string[] = [];

  if (quizResult.themes && quizResult.themes.length > 0) {
    const themeList = quizResult.themes
      .map((t: any) => `${t.name} (${t.weight}%): ${t.description}`)
      .join('; ');
    sections.push(`Career Themes: ${themeList}`);
  }

  if (quizResult.recommended_directions && quizResult.recommended_directions.length > 0) {
    const dirList = quizResult.recommended_directions
      .map((d: any) => `${d.title} (${d.fit_score}% fit)`)
      .join('; ');
    sections.push(`Recommended Directions: ${dirList}`);
  }

  if (quizResult.confidence_level) {
    sections.push(`Career Confidence: ${quizResult.confidence_level}`);
  }

  if (quizResult.major_context?.major) {
    sections.push(`Major Context: ${quizResult.major_context.major}`);
  }

  return sections.join('\n');
}

function buildRoleGenerationPrompt(
  profileContext: string,
  quizContext: string,
  industryContext: string,
): string {
  return `Based on the following user profile, career assessment, and INDUSTRY CONTEXT, generate exactly 25 diverse career role suggestions that would be good fits.

USER PROFILE:
${profileContext || 'No profile data available'}

${quizContext ? `CAREER QUIZ RESULTS:\n${quizContext}` : ''}

INDUSTRY CONTEXT (IMPORTANT - use this to guide role suggestions):
${industryContext}

CRITICAL RULES FOR ROLE GENERATION:
1. Follow the industry's career progression pattern - roles should follow realistic paths
2. If the industry does NOT use traditional internships (see Entry Path above), suggest the appropriate entry path instead (e.g., research assistantships for science, apprenticeships for trades, clinical rotations for healthcare)
3. Ensure promotions are realistic - typically 1-2 levels at a time, not jumping from entry to executive
4. Include industry-specific credentials/certifications where relevant
5. For non-tech industries, DO NOT default to software/tech roles unless explicitly relevant to the user's profile

Generate 25 job roles organized into 5-7 categories. Include a mix of:
- Direct fit roles (based on current skills/experience AND industry)
- Stretch roles (ambitious but achievable within the industry)
- Adjacent roles (related fields within or adjacent to their industry)
- Entry/junior roles if they're early career (using the appropriate entry path for their industry)
- Senior/leadership roles if they're experienced

For each role, provide:
- id: unique identifier (kebab-case, e.g., "research-scientist")
- title: job title (use industry-appropriate titles)
- category: category name (e.g., "Healthcare", "Research & Development", "Academia")
- fit_score: 0-100 score based on profile AND industry alignment
- reason: brief explanation of why this role fits (max 20 words)
- skills: array of 3-5 key skills for this role
- growth_outlook: "high", "medium", or "low"

Return JSON in this exact format:
{
  "roles": [
    {
      "id": "research-scientist",
      "title": "Research Scientist",
      "category": "Research & Development",
      "fit_score": 85,
      "reason": "Strong analytical skills aligned with research career path",
      "skills": ["Data Analysis", "Research Methods", "Lab Techniques", "Scientific Writing"],
      "growth_outlook": "high"
    }
  ],
  "categories": ["Research & Development", "Academia", "Industry"]
}`;
}

function generateFallbackRoles(profile: any): GalaxyRolesResponse {
  // Generate diverse fallback roles based on whatever profile data we have
  const categories = [
    'Technology',
    'Business & Strategy',
    'Creative & Design',
    'Data & Analytics',
    'Operations & Management',
    'Marketing & Communications',
  ];

  const fallbackRoles: GalaxyRole[] = [
    // Technology roles
    {
      id: 'software-engineer',
      title: 'Software Engineer',
      category: 'Technology',
      fit_score: 80,
      reason: 'Strong foundation for tech careers',
      skills: ['Programming', 'Problem Solving', 'System Design'],
      growth_outlook: 'high',
    },
    {
      id: 'frontend-developer',
      title: 'Frontend Developer',
      category: 'Technology',
      fit_score: 78,
      reason: 'User-facing technical work',
      skills: ['JavaScript', 'React', 'CSS', 'UX'],
      growth_outlook: 'high',
    },
    {
      id: 'backend-developer',
      title: 'Backend Developer',
      category: 'Technology',
      fit_score: 77,
      reason: 'Server-side development',
      skills: ['Python', 'Databases', 'APIs', 'Cloud'],
      growth_outlook: 'high',
    },
    {
      id: 'devops-engineer',
      title: 'DevOps Engineer',
      category: 'Technology',
      fit_score: 72,
      reason: 'Bridge between dev and ops',
      skills: ['CI/CD', 'Cloud', 'Docker', 'Kubernetes'],
      growth_outlook: 'high',
    },
    {
      id: 'mobile-developer',
      title: 'Mobile Developer',
      category: 'Technology',
      fit_score: 75,
      reason: 'Growing mobile-first world',
      skills: ['iOS', 'Android', 'React Native', 'UI Design'],
      growth_outlook: 'high',
    },

    // Business roles
    {
      id: 'product-manager',
      title: 'Product Manager',
      category: 'Business & Strategy',
      fit_score: 82,
      reason: 'Lead product vision and strategy',
      skills: ['Strategy', 'Communication', 'Analytics', 'Leadership'],
      growth_outlook: 'high',
    },
    {
      id: 'business-analyst',
      title: 'Business Analyst',
      category: 'Business & Strategy',
      fit_score: 76,
      reason: 'Bridge business and technical teams',
      skills: ['Analysis', 'Documentation', 'SQL', 'Communication'],
      growth_outlook: 'medium',
    },
    {
      id: 'project-manager',
      title: 'Project Manager',
      category: 'Business & Strategy',
      fit_score: 74,
      reason: 'Coordinate complex initiatives',
      skills: ['Planning', 'Leadership', 'Risk Management', 'Agile'],
      growth_outlook: 'medium',
    },
    {
      id: 'management-consultant',
      title: 'Management Consultant',
      category: 'Business & Strategy',
      fit_score: 70,
      reason: 'Solve business challenges',
      skills: ['Strategy', 'Analysis', 'Presentation', 'Problem Solving'],
      growth_outlook: 'high',
    },
    {
      id: 'operations-manager',
      title: 'Operations Manager',
      category: 'Business & Strategy',
      fit_score: 68,
      reason: 'Optimize business processes',
      skills: ['Process Improvement', 'Leadership', 'Analytics', 'Budgeting'],
      growth_outlook: 'medium',
    },

    // Creative roles
    {
      id: 'ux-designer',
      title: 'UX Designer',
      category: 'Creative & Design',
      fit_score: 79,
      reason: 'Design user experiences',
      skills: ['Figma', 'User Research', 'Prototyping', 'Visual Design'],
      growth_outlook: 'high',
    },
    {
      id: 'ui-designer',
      title: 'UI Designer',
      category: 'Creative & Design',
      fit_score: 77,
      reason: 'Create beautiful interfaces',
      skills: ['Visual Design', 'Figma', 'Typography', 'Color Theory'],
      growth_outlook: 'high',
    },
    {
      id: 'graphic-designer',
      title: 'Graphic Designer',
      category: 'Creative & Design',
      fit_score: 73,
      reason: 'Visual communication expert',
      skills: ['Adobe Creative Suite', 'Branding', 'Typography', 'Layout'],
      growth_outlook: 'medium',
    },
    {
      id: 'content-designer',
      title: 'Content Designer',
      category: 'Creative & Design',
      fit_score: 71,
      reason: 'Design with words',
      skills: ['Writing', 'UX', 'Information Architecture', 'Research'],
      growth_outlook: 'high',
    },

    // Data roles
    {
      id: 'data-scientist',
      title: 'Data Scientist',
      category: 'Data & Analytics',
      fit_score: 81,
      reason: 'Extract insights from data',
      skills: ['Python', 'Machine Learning', 'Statistics', 'SQL'],
      growth_outlook: 'high',
    },
    {
      id: 'data-analyst',
      title: 'Data Analyst',
      category: 'Data & Analytics',
      fit_score: 78,
      reason: 'Turn data into decisions',
      skills: ['SQL', 'Excel', 'Visualization', 'Statistics'],
      growth_outlook: 'high',
    },
    {
      id: 'data-engineer',
      title: 'Data Engineer',
      category: 'Data & Analytics',
      fit_score: 75,
      reason: 'Build data infrastructure',
      skills: ['Python', 'SQL', 'ETL', 'Cloud Platforms'],
      growth_outlook: 'high',
    },
    {
      id: 'ml-engineer',
      title: 'Machine Learning Engineer',
      category: 'Data & Analytics',
      fit_score: 73,
      reason: 'Deploy ML models at scale',
      skills: ['Python', 'TensorFlow', 'MLOps', 'Cloud'],
      growth_outlook: 'high',
    },

    // Marketing roles
    {
      id: 'marketing-manager',
      title: 'Marketing Manager',
      category: 'Marketing & Communications',
      fit_score: 74,
      reason: 'Drive brand growth',
      skills: ['Strategy', 'Analytics', 'Content', 'Campaign Management'],
      growth_outlook: 'medium',
    },
    {
      id: 'digital-marketing',
      title: 'Digital Marketing Specialist',
      category: 'Marketing & Communications',
      fit_score: 72,
      reason: 'Online marketing expertise',
      skills: ['SEO', 'Social Media', 'Analytics', 'Content'],
      growth_outlook: 'high',
    },
    {
      id: 'content-strategist',
      title: 'Content Strategist',
      category: 'Marketing & Communications',
      fit_score: 70,
      reason: 'Plan content that converts',
      skills: ['Writing', 'SEO', 'Analytics', 'Strategy'],
      growth_outlook: 'high',
    },
    {
      id: 'brand-manager',
      title: 'Brand Manager',
      category: 'Marketing & Communications',
      fit_score: 68,
      reason: 'Build brand identity',
      skills: ['Strategy', 'Research', 'Creative Direction', 'Analytics'],
      growth_outlook: 'medium',
    },

    // Operations roles
    {
      id: 'technical-program-manager',
      title: 'Technical Program Manager',
      category: 'Operations & Management',
      fit_score: 76,
      reason: 'Lead complex technical programs',
      skills: ['Program Management', 'Technical Knowledge', 'Communication', 'Risk Management'],
      growth_outlook: 'high',
    },
    {
      id: 'scrum-master',
      title: 'Scrum Master',
      category: 'Operations & Management',
      fit_score: 71,
      reason: 'Facilitate agile teams',
      skills: ['Agile', 'Facilitation', 'Coaching', 'Communication'],
      growth_outlook: 'medium',
    },
    {
      id: 'customer-success-manager',
      title: 'Customer Success Manager',
      category: 'Operations & Management',
      fit_score: 69,
      reason: 'Drive customer outcomes',
      skills: ['Relationship Management', 'Communication', 'Problem Solving', 'Analytics'],
      growth_outlook: 'high',
    },
  ];

  // Adjust fit scores based on profile data
  const adjustedRoles = fallbackRoles.map((role) => {
    let scoreAdjustment = 0;

    // Boost tech roles if they have tech-related skills or major
    if (
      profile.skills?.toLowerCase().includes('programming') ||
      profile.skills?.toLowerCase().includes('javascript') ||
      profile.major?.toLowerCase().includes('computer')
    ) {
      if (role.category === 'Technology' || role.category === 'Data & Analytics') {
        scoreAdjustment += 10;
      }
    }

    // Boost business roles if they have business background
    if (
      profile.major?.toLowerCase().includes('business') ||
      profile.industry?.toLowerCase().includes('business')
    ) {
      if (role.category === 'Business & Strategy') {
        scoreAdjustment += 10;
      }
    }

    // Boost creative roles if they have design skills
    if (
      profile.skills?.toLowerCase().includes('design') ||
      profile.major?.toLowerCase().includes('design')
    ) {
      if (role.category === 'Creative & Design') {
        scoreAdjustment += 10;
      }
    }

    // Match dream job
    if (profile.dream_job) {
      const dreamJobLower = profile.dream_job.toLowerCase();
      if (
        role.title.toLowerCase().includes(dreamJobLower) ||
        dreamJobLower.includes(role.title.toLowerCase())
      ) {
        scoreAdjustment += 15;
      }
    }

    return {
      ...role,
      fit_score: Math.min(100, role.fit_score + scoreAdjustment),
    };
  });

  // Sort by fit score
  adjustedRoles.sort((a, b) => b.fit_score - a.fit_score);

  return {
    roles: adjustedRoles,
    categories,
  };
}
