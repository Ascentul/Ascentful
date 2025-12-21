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

// Industry-specific fallback role sets
const INDUSTRY_FALLBACK_ROLES: Record<Industry, GalaxyRole[]> = {
  healthcare: [
    {
      id: 'registered-nurse',
      title: 'Registered Nurse',
      category: 'Clinical Care',
      fit_score: 82,
      reason: 'Direct patient care with strong job security',
      skills: ['Patient Care', 'Clinical Assessment', 'Medical Documentation', 'Communication'],
      growth_outlook: 'high',
    },
    {
      id: 'nurse-practitioner',
      title: 'Nurse Practitioner',
      category: 'Advanced Practice',
      fit_score: 85,
      reason: 'Advanced clinical role with prescriptive authority',
      skills: ['Diagnosis', 'Treatment Planning', 'Patient Education', 'Clinical Leadership'],
      growth_outlook: 'high',
    },
    {
      id: 'physician-assistant',
      title: 'Physician Assistant',
      category: 'Advanced Practice',
      fit_score: 84,
      reason: 'Collaborative medical practice',
      skills: ['Clinical Assessment', 'Diagnosis', 'Treatment', 'Procedures'],
      growth_outlook: 'high',
    },
    {
      id: 'medical-technologist',
      title: 'Medical Technologist',
      category: 'Laboratory',
      fit_score: 76,
      reason: 'Essential diagnostic support role',
      skills: ['Lab Analysis', 'Quality Control', 'Medical Equipment', 'Data Analysis'],
      growth_outlook: 'medium',
    },
    {
      id: 'physical-therapist',
      title: 'Physical Therapist',
      category: 'Rehabilitation',
      fit_score: 80,
      reason: 'Help patients recover mobility',
      skills: [
        'Rehabilitation',
        'Exercise Prescription',
        'Patient Assessment',
        'Treatment Planning',
      ],
      growth_outlook: 'high',
    },
    {
      id: 'healthcare-administrator',
      title: 'Healthcare Administrator',
      category: 'Administration',
      fit_score: 78,
      reason: 'Lead healthcare operations',
      skills: ['Healthcare Management', 'Budgeting', 'Regulatory Compliance', 'Leadership'],
      growth_outlook: 'high',
    },
    {
      id: 'pharmacist',
      title: 'Pharmacist',
      category: 'Pharmacy',
      fit_score: 79,
      reason: 'Medication expertise and patient counseling',
      skills: ['Pharmacology', 'Drug Interactions', 'Patient Counseling', 'Compounding'],
      growth_outlook: 'medium',
    },
    {
      id: 'medical-coder',
      title: 'Medical Coder',
      category: 'Health Information',
      fit_score: 72,
      reason: 'Critical for healthcare revenue cycle',
      skills: ['ICD-10 Coding', 'CPT Coding', 'Medical Terminology', 'Attention to Detail'],
      growth_outlook: 'medium',
    },
    {
      id: 'clinical-research-coordinator',
      title: 'Clinical Research Coordinator',
      category: 'Research',
      fit_score: 75,
      reason: 'Advance medical knowledge through research',
      skills: [
        'Protocol Management',
        'Patient Recruitment',
        'Data Collection',
        'Regulatory Compliance',
      ],
      growth_outlook: 'high',
    },
    {
      id: 'health-informatics-specialist',
      title: 'Health Informatics Specialist',
      category: 'Health IT',
      fit_score: 77,
      reason: 'Bridge healthcare and technology',
      skills: ['EHR Systems', 'Data Analytics', 'Healthcare Workflows', 'System Implementation'],
      growth_outlook: 'high',
    },
  ],
  finance: [
    {
      id: 'financial-analyst',
      title: 'Financial Analyst',
      category: 'Analysis',
      fit_score: 82,
      reason: 'Core finance role with strong growth path',
      skills: ['Financial Modeling', 'Excel', 'Valuation', 'Research'],
      growth_outlook: 'high',
    },
    {
      id: 'investment-banker',
      title: 'Investment Banking Analyst',
      category: 'Investment Banking',
      fit_score: 80,
      reason: 'High-intensity, high-reward finance path',
      skills: ['Financial Modeling', 'M&A', 'Valuation', 'Pitch Books'],
      growth_outlook: 'high',
    },
    {
      id: 'private-equity-associate',
      title: 'Private Equity Associate',
      category: 'Investment',
      fit_score: 78,
      reason: 'Drive value in portfolio companies',
      skills: ['Due Diligence', 'LBO Modeling', 'Operations', 'Deal Sourcing'],
      growth_outlook: 'high',
    },
    {
      id: 'wealth-manager',
      title: 'Wealth Manager',
      category: 'Wealth Management',
      fit_score: 76,
      reason: 'Help individuals grow their wealth',
      skills: [
        'Portfolio Management',
        'Client Relationships',
        'Financial Planning',
        'Investment Strategy',
      ],
      growth_outlook: 'medium',
    },
    {
      id: 'risk-analyst',
      title: 'Risk Analyst',
      category: 'Risk Management',
      fit_score: 75,
      reason: 'Protect firms from financial risks',
      skills: ['Risk Modeling', 'Statistics', 'Regulatory Knowledge', 'VaR Analysis'],
      growth_outlook: 'high',
    },
    {
      id: 'quantitative-analyst',
      title: 'Quantitative Analyst',
      category: 'Quantitative Finance',
      fit_score: 79,
      reason: 'Apply math to trading strategies',
      skills: ['Python', 'Statistics', 'Machine Learning', 'Financial Mathematics'],
      growth_outlook: 'high',
    },
    {
      id: 'corporate-treasurer',
      title: 'Corporate Treasurer',
      category: 'Treasury',
      fit_score: 74,
      reason: 'Manage corporate cash and investments',
      skills: ['Cash Management', 'Forecasting', 'Banking Relationships', 'Capital Markets'],
      growth_outlook: 'medium',
    },
    {
      id: 'compliance-officer',
      title: 'Compliance Officer',
      category: 'Compliance',
      fit_score: 73,
      reason: 'Ensure regulatory adherence',
      skills: ['Regulatory Knowledge', 'Policy Development', 'Risk Assessment', 'Auditing'],
      growth_outlook: 'high',
    },
    {
      id: 'credit-analyst',
      title: 'Credit Analyst',
      category: 'Credit',
      fit_score: 74,
      reason: 'Assess creditworthiness of borrowers',
      skills: [
        'Credit Analysis',
        'Financial Statement Analysis',
        'Risk Assessment',
        'Documentation',
      ],
      growth_outlook: 'medium',
    },
    {
      id: 'financial-planner',
      title: 'Financial Planner',
      category: 'Financial Planning',
      fit_score: 77,
      reason: 'Guide individuals to financial goals',
      skills: ['Financial Planning', 'Tax Knowledge', 'Investment Strategy', 'Client Relations'],
      growth_outlook: 'high',
    },
  ],
  legal: [
    {
      id: 'associate-attorney',
      title: 'Associate Attorney',
      category: 'Legal Practice',
      fit_score: 80,
      reason: 'Foundation of legal career',
      skills: ['Legal Research', 'Brief Writing', 'Client Counseling', 'Litigation'],
      growth_outlook: 'medium',
    },
    {
      id: 'corporate-counsel',
      title: 'Corporate Counsel',
      category: 'In-House',
      fit_score: 82,
      reason: 'Business-focused legal work',
      skills: ['Contract Law', 'Corporate Governance', 'Compliance', 'Risk Management'],
      growth_outlook: 'high',
    },
    {
      id: 'paralegal',
      title: 'Paralegal',
      category: 'Legal Support',
      fit_score: 75,
      reason: 'Essential legal support role',
      skills: ['Legal Research', 'Document Preparation', 'Case Management', 'E-Discovery'],
      growth_outlook: 'medium',
    },
    {
      id: 'legal-operations-manager',
      title: 'Legal Operations Manager',
      category: 'Legal Operations',
      fit_score: 76,
      reason: 'Optimize legal department efficiency',
      skills: ['Project Management', 'Legal Technology', 'Budgeting', 'Process Improvement'],
      growth_outlook: 'high',
    },
    {
      id: 'compliance-counsel',
      title: 'Compliance Counsel',
      category: 'Compliance',
      fit_score: 78,
      reason: 'Navigate regulatory requirements',
      skills: ['Regulatory Law', 'Policy Development', 'Training', 'Risk Assessment'],
      growth_outlook: 'high',
    },
    {
      id: 'contracts-manager',
      title: 'Contracts Manager',
      category: 'Contracts',
      fit_score: 74,
      reason: 'Manage complex contract portfolios',
      skills: ['Contract Negotiation', 'Risk Analysis', 'Vendor Management', 'Legal Writing'],
      growth_outlook: 'medium',
    },
    {
      id: 'ip-attorney',
      title: 'Intellectual Property Attorney',
      category: 'IP Law',
      fit_score: 79,
      reason: 'Protect innovation and creative works',
      skills: ['Patent Law', 'Trademark Law', 'Licensing', 'Litigation'],
      growth_outlook: 'high',
    },
    {
      id: 'litigation-support',
      title: 'Litigation Support Specialist',
      category: 'Litigation',
      fit_score: 72,
      reason: 'Technology-enabled legal support',
      skills: ['E-Discovery', 'Document Review', 'Legal Technology', 'Project Management'],
      growth_outlook: 'medium',
    },
    {
      id: 'legal-recruiter',
      title: 'Legal Recruiter',
      category: 'Legal Recruiting',
      fit_score: 70,
      reason: 'Connect legal talent with opportunities',
      skills: ['Legal Industry Knowledge', 'Networking', 'Negotiation', 'Client Relations'],
      growth_outlook: 'medium',
    },
    {
      id: 'legal-tech-specialist',
      title: 'Legal Technology Specialist',
      category: 'Legal Tech',
      fit_score: 77,
      reason: 'Modernize legal practice',
      skills: ['Legal Software', 'Implementation', 'Training', 'Process Automation'],
      growth_outlook: 'high',
    },
  ],
  trades: [
    {
      id: 'electrician',
      title: 'Electrician',
      category: 'Electrical',
      fit_score: 82,
      reason: 'High-demand skilled trade',
      skills: ['Electrical Systems', 'Code Compliance', 'Troubleshooting', 'Safety'],
      growth_outlook: 'high',
    },
    {
      id: 'plumber',
      title: 'Plumber',
      category: 'Plumbing',
      fit_score: 80,
      reason: 'Essential infrastructure trade',
      skills: ['Pipe Systems', 'Code Compliance', 'Problem Solving', 'Customer Service'],
      growth_outlook: 'high',
    },
    {
      id: 'hvac-technician',
      title: 'HVAC Technician',
      category: 'HVAC',
      fit_score: 81,
      reason: 'Climate control expertise in demand',
      skills: ['HVAC Systems', 'Refrigeration', 'Diagnostics', 'Installation'],
      growth_outlook: 'high',
    },
    {
      id: 'carpenter',
      title: 'Carpenter',
      category: 'Carpentry',
      fit_score: 78,
      reason: 'Build and renovate structures',
      skills: ['Woodworking', 'Blueprint Reading', 'Math', 'Precision'],
      growth_outlook: 'medium',
    },
    {
      id: 'welder',
      title: 'Welder',
      category: 'Welding',
      fit_score: 77,
      reason: 'Join metals for construction and manufacturing',
      skills: ['Welding Techniques', 'Blueprint Reading', 'Safety', 'Quality Control'],
      growth_outlook: 'medium',
    },
    {
      id: 'construction-manager',
      title: 'Construction Manager',
      category: 'Management',
      fit_score: 83,
      reason: 'Lead construction projects',
      skills: ['Project Management', 'Budgeting', 'Safety Compliance', 'Team Leadership'],
      growth_outlook: 'high',
    },
    {
      id: 'heavy-equipment-operator',
      title: 'Heavy Equipment Operator',
      category: 'Equipment Operation',
      fit_score: 75,
      reason: 'Operate machinery for construction',
      skills: ['Equipment Operation', 'Safety', 'Maintenance', 'Precision'],
      growth_outlook: 'medium',
    },
    {
      id: 'industrial-mechanic',
      title: 'Industrial Mechanic',
      category: 'Maintenance',
      fit_score: 79,
      reason: 'Keep industrial equipment running',
      skills: ['Mechanical Systems', 'Troubleshooting', 'Preventive Maintenance', 'Hydraulics'],
      growth_outlook: 'high',
    },
    {
      id: 'solar-installer',
      title: 'Solar Panel Installer',
      category: 'Renewable Energy',
      fit_score: 84,
      reason: 'Growing green energy sector',
      skills: ['Solar Systems', 'Electrical Knowledge', 'Roofing', 'Safety'],
      growth_outlook: 'high',
    },
    {
      id: 'elevator-technician',
      title: 'Elevator Technician',
      category: 'Elevator',
      fit_score: 80,
      reason: 'Specialized high-paying trade',
      skills: ['Elevator Systems', 'Electronics', 'Safety', 'Troubleshooting'],
      growth_outlook: 'high',
    },
  ],
  education: [
    {
      id: 'teacher',
      title: 'Teacher',
      category: 'K-12 Education',
      fit_score: 80,
      reason: 'Shape future generations',
      skills: ['Instruction', 'Curriculum Development', 'Classroom Management', 'Assessment'],
      growth_outlook: 'medium',
    },
    {
      id: 'school-counselor',
      title: 'School Counselor',
      category: 'Student Services',
      fit_score: 78,
      reason: 'Support student development',
      skills: ['Counseling', 'Crisis Intervention', 'College Planning', 'Advocacy'],
      growth_outlook: 'medium',
    },
    {
      id: 'instructional-designer',
      title: 'Instructional Designer',
      category: 'Learning Design',
      fit_score: 82,
      reason: 'Create effective learning experiences',
      skills: ['Curriculum Design', 'E-Learning', 'LMS', 'Assessment Design'],
      growth_outlook: 'high',
    },
    {
      id: 'education-administrator',
      title: 'Education Administrator',
      category: 'Administration',
      fit_score: 79,
      reason: 'Lead educational institutions',
      skills: ['Leadership', 'Policy', 'Budgeting', 'Staff Development'],
      growth_outlook: 'medium',
    },
    {
      id: 'special-education-teacher',
      title: 'Special Education Teacher',
      category: 'Special Education',
      fit_score: 81,
      reason: 'Support students with special needs',
      skills: ['IEP Development', 'Adaptive Instruction', 'Behavior Management', 'Collaboration'],
      growth_outlook: 'high',
    },
    {
      id: 'curriculum-coordinator',
      title: 'Curriculum Coordinator',
      category: 'Curriculum',
      fit_score: 77,
      reason: 'Develop and align curriculum',
      skills: ['Curriculum Development', 'Standards Alignment', 'Teacher Training', 'Assessment'],
      growth_outlook: 'medium',
    },
    {
      id: 'education-technology-specialist',
      title: 'Education Technology Specialist',
      category: 'EdTech',
      fit_score: 83,
      reason: 'Integrate technology in education',
      skills: ['EdTech Tools', 'Training', 'Implementation', 'Digital Literacy'],
      growth_outlook: 'high',
    },
    {
      id: 'corporate-trainer',
      title: 'Corporate Trainer',
      category: 'Corporate Training',
      fit_score: 76,
      reason: 'Develop workplace skills',
      skills: ['Training Delivery', 'Content Development', 'Facilitation', 'Assessment'],
      growth_outlook: 'medium',
    },
    {
      id: 'academic-advisor',
      title: 'Academic Advisor',
      category: 'Higher Education',
      fit_score: 75,
      reason: 'Guide students academic journey',
      skills: ['Advising', 'Program Knowledge', 'Communication', 'Problem Solving'],
      growth_outlook: 'medium',
    },
    {
      id: 'tutoring-coordinator',
      title: 'Tutoring Coordinator',
      category: 'Academic Support',
      fit_score: 73,
      reason: 'Manage academic support services',
      skills: ['Program Management', 'Tutor Training', 'Assessment', 'Student Outreach'],
      growth_outlook: 'medium',
    },
  ],
  consulting: [
    {
      id: 'management-consultant',
      title: 'Management Consultant',
      category: 'Strategy',
      fit_score: 82,
      reason: 'Solve complex business problems',
      skills: ['Problem Solving', 'Analysis', 'Presentation', 'Client Management'],
      growth_outlook: 'high',
    },
    {
      id: 'strategy-consultant',
      title: 'Strategy Consultant',
      category: 'Strategy',
      fit_score: 84,
      reason: 'Shape business direction',
      skills: ['Strategic Thinking', 'Market Analysis', 'Financial Modeling', 'Communication'],
      growth_outlook: 'high',
    },
    {
      id: 'technology-consultant',
      title: 'Technology Consultant',
      category: 'Technology',
      fit_score: 80,
      reason: 'Drive digital transformation',
      skills: ['Technology Strategy', 'Implementation', 'Change Management', 'Architecture'],
      growth_outlook: 'high',
    },
    {
      id: 'operations-consultant',
      title: 'Operations Consultant',
      category: 'Operations',
      fit_score: 78,
      reason: 'Optimize business operations',
      skills: ['Process Improvement', 'Lean/Six Sigma', 'Analytics', 'Change Management'],
      growth_outlook: 'medium',
    },
    {
      id: 'hr-consultant',
      title: 'HR Consultant',
      category: 'Human Resources',
      fit_score: 75,
      reason: 'Transform people operations',
      skills: ['HR Strategy', 'Organizational Design', 'Talent Management', 'Change Management'],
      growth_outlook: 'medium',
    },
    {
      id: 'financial-consultant',
      title: 'Financial Consultant',
      category: 'Finance',
      fit_score: 79,
      reason: 'Advise on financial decisions',
      skills: ['Financial Analysis', 'Modeling', 'Due Diligence', 'Valuation'],
      growth_outlook: 'high',
    },
    {
      id: 'healthcare-consultant',
      title: 'Healthcare Consultant',
      category: 'Healthcare',
      fit_score: 77,
      reason: 'Improve healthcare organizations',
      skills: ['Healthcare Knowledge', 'Analytics', 'Strategy', 'Regulatory Compliance'],
      growth_outlook: 'high',
    },
    {
      id: 'sustainability-consultant',
      title: 'Sustainability Consultant',
      category: 'Sustainability',
      fit_score: 81,
      reason: 'Drive environmental impact',
      skills: ['ESG', 'Carbon Accounting', 'Strategy', 'Reporting'],
      growth_outlook: 'high',
    },
    {
      id: 'data-analytics-consultant',
      title: 'Data & Analytics Consultant',
      category: 'Analytics',
      fit_score: 83,
      reason: 'Unlock data-driven insights',
      skills: ['Data Analysis', 'Visualization', 'Strategy', 'Implementation'],
      growth_outlook: 'high',
    },
    {
      id: 'change-management-consultant',
      title: 'Change Management Consultant',
      category: 'Change Management',
      fit_score: 76,
      reason: 'Lead organizational change',
      skills: ['Change Methodology', 'Communication', 'Training', 'Stakeholder Management'],
      growth_outlook: 'medium',
    },
  ],
  retail: [
    {
      id: 'store-manager',
      title: 'Store Manager',
      category: 'Store Operations',
      fit_score: 78,
      reason: 'Lead retail operations',
      skills: ['Team Leadership', 'Sales', 'Inventory Management', 'Customer Service'],
      growth_outlook: 'medium',
    },
    {
      id: 'district-manager',
      title: 'District Manager',
      category: 'Multi-Unit Management',
      fit_score: 80,
      reason: 'Oversee multiple locations',
      skills: ['Multi-Unit Management', 'P&L', 'Leadership', 'Strategy'],
      growth_outlook: 'medium',
    },
    {
      id: 'merchandiser',
      title: 'Merchandiser',
      category: 'Merchandising',
      fit_score: 75,
      reason: 'Optimize product presentation',
      skills: ['Visual Merchandising', 'Inventory', 'Trend Analysis', 'Vendor Relations'],
      growth_outlook: 'medium',
    },
    {
      id: 'buyer',
      title: 'Retail Buyer',
      category: 'Buying',
      fit_score: 79,
      reason: 'Select products for retail',
      skills: ['Trend Analysis', 'Negotiation', 'Analytics', 'Vendor Management'],
      growth_outlook: 'medium',
    },
    {
      id: 'ecommerce-manager',
      title: 'E-commerce Manager',
      category: 'E-commerce',
      fit_score: 82,
      reason: 'Drive online sales growth',
      skills: ['E-commerce Platforms', 'Digital Marketing', 'Analytics', 'UX'],
      growth_outlook: 'high',
    },
    {
      id: 'loss-prevention-manager',
      title: 'Loss Prevention Manager',
      category: 'Loss Prevention',
      fit_score: 73,
      reason: 'Protect retail assets',
      skills: ['Security', 'Investigation', 'Risk Assessment', 'Training'],
      growth_outlook: 'medium',
    },
    {
      id: 'supply-chain-analyst',
      title: 'Supply Chain Analyst',
      category: 'Supply Chain',
      fit_score: 77,
      reason: 'Optimize retail supply chain',
      skills: ['Analytics', 'Forecasting', 'Inventory Management', 'Logistics'],
      growth_outlook: 'high',
    },
    {
      id: 'customer-experience-manager',
      title: 'Customer Experience Manager',
      category: 'Customer Experience',
      fit_score: 76,
      reason: 'Enhance customer satisfaction',
      skills: ['CX Strategy', 'Analytics', 'Process Improvement', 'Training'],
      growth_outlook: 'high',
    },
    {
      id: 'visual-merchandising-manager',
      title: 'Visual Merchandising Manager',
      category: 'Visual',
      fit_score: 74,
      reason: 'Create compelling store displays',
      skills: ['Visual Design', 'Trend Awareness', 'Project Management', 'Creativity'],
      growth_outlook: 'medium',
    },
    {
      id: 'retail-analytics-manager',
      title: 'Retail Analytics Manager',
      category: 'Analytics',
      fit_score: 81,
      reason: 'Drive data-informed decisions',
      skills: ['Data Analysis', 'SQL', 'Visualization', 'Business Intelligence'],
      growth_outlook: 'high',
    },
  ],
  hospitality: [
    {
      id: 'hotel-manager',
      title: 'Hotel Manager',
      category: 'Hotel Management',
      fit_score: 79,
      reason: 'Lead hotel operations',
      skills: ['Operations', 'Guest Relations', 'P&L Management', 'Team Leadership'],
      growth_outlook: 'medium',
    },
    {
      id: 'restaurant-manager',
      title: 'Restaurant Manager',
      category: 'Food & Beverage',
      fit_score: 77,
      reason: 'Run restaurant operations',
      skills: ['F&B Operations', 'Staff Management', 'Customer Service', 'Cost Control'],
      growth_outlook: 'medium',
    },
    {
      id: 'event-manager',
      title: 'Event Manager',
      category: 'Events',
      fit_score: 80,
      reason: 'Create memorable events',
      skills: ['Event Planning', 'Vendor Management', 'Budgeting', 'Client Relations'],
      growth_outlook: 'high',
    },
    {
      id: 'revenue-manager',
      title: 'Revenue Manager',
      category: 'Revenue Management',
      fit_score: 82,
      reason: 'Maximize hospitality revenue',
      skills: ['Pricing Strategy', 'Analytics', 'Forecasting', 'Distribution'],
      growth_outlook: 'high',
    },
    {
      id: 'front-office-manager',
      title: 'Front Office Manager',
      category: 'Front Office',
      fit_score: 75,
      reason: 'Lead guest-facing operations',
      skills: ['Guest Relations', 'Team Management', 'Problem Solving', 'Systems'],
      growth_outlook: 'medium',
    },
    {
      id: 'executive-chef',
      title: 'Executive Chef',
      category: 'Culinary',
      fit_score: 78,
      reason: 'Lead culinary operations',
      skills: ['Culinary Arts', 'Menu Development', 'Team Leadership', 'Cost Control'],
      growth_outlook: 'medium',
    },
    {
      id: 'sales-manager-hospitality',
      title: 'Hospitality Sales Manager',
      category: 'Sales',
      fit_score: 76,
      reason: 'Drive group and event sales',
      skills: ['Sales', 'Relationship Building', 'Negotiation', 'CRM'],
      growth_outlook: 'medium',
    },
    {
      id: 'spa-director',
      title: 'Spa Director',
      category: 'Spa & Wellness',
      fit_score: 74,
      reason: 'Lead wellness operations',
      skills: ['Spa Operations', 'Team Management', 'Customer Service', 'Revenue Management'],
      growth_outlook: 'medium',
    },
    {
      id: 'food-beverage-director',
      title: 'Food & Beverage Director',
      category: 'F&B',
      fit_score: 81,
      reason: 'Oversee all F&B operations',
      skills: ['F&B Management', 'P&L', 'Menu Engineering', 'Team Development'],
      growth_outlook: 'medium',
    },
    {
      id: 'guest-experience-manager',
      title: 'Guest Experience Manager',
      category: 'Guest Experience',
      fit_score: 77,
      reason: 'Elevate guest satisfaction',
      skills: ['Guest Relations', 'Service Recovery', 'Training', 'Quality Assurance'],
      growth_outlook: 'high',
    },
  ],
  manufacturing: [
    {
      id: 'production-manager',
      title: 'Production Manager',
      category: 'Production',
      fit_score: 80,
      reason: 'Lead manufacturing operations',
      skills: ['Production Planning', 'Team Leadership', 'Lean Manufacturing', 'Quality Control'],
      growth_outlook: 'medium',
    },
    {
      id: 'quality-engineer',
      title: 'Quality Engineer',
      category: 'Quality',
      fit_score: 79,
      reason: 'Ensure product quality',
      skills: ['Quality Systems', 'Six Sigma', 'Root Cause Analysis', 'Auditing'],
      growth_outlook: 'medium',
    },
    {
      id: 'manufacturing-engineer',
      title: 'Manufacturing Engineer',
      category: 'Engineering',
      fit_score: 81,
      reason: 'Optimize manufacturing processes',
      skills: ['Process Engineering', 'CAD', 'Lean', 'Automation'],
      growth_outlook: 'medium',
    },
    {
      id: 'supply-chain-manager',
      title: 'Supply Chain Manager',
      category: 'Supply Chain',
      fit_score: 82,
      reason: 'Manage end-to-end supply chain',
      skills: ['Logistics', 'Procurement', 'Planning', 'Vendor Management'],
      growth_outlook: 'high',
    },
    {
      id: 'plant-manager',
      title: 'Plant Manager',
      category: 'Operations',
      fit_score: 83,
      reason: 'Lead entire facility operations',
      skills: ['Operations Management', 'P&L', 'Safety', 'Team Development'],
      growth_outlook: 'medium',
    },
    {
      id: 'maintenance-manager',
      title: 'Maintenance Manager',
      category: 'Maintenance',
      fit_score: 77,
      reason: 'Keep equipment running optimally',
      skills: ['Preventive Maintenance', 'Team Management', 'Budgeting', 'CMMS'],
      growth_outlook: 'medium',
    },
    {
      id: 'process-engineer',
      title: 'Process Engineer',
      category: 'Process',
      fit_score: 78,
      reason: 'Design and improve processes',
      skills: ['Process Design', 'Data Analysis', 'Troubleshooting', 'Documentation'],
      growth_outlook: 'medium',
    },
    {
      id: 'automation-engineer',
      title: 'Automation Engineer',
      category: 'Automation',
      fit_score: 84,
      reason: 'Implement smart manufacturing',
      skills: ['PLC Programming', 'Robotics', 'Control Systems', 'Industry 4.0'],
      growth_outlook: 'high',
    },
    {
      id: 'safety-manager',
      title: 'Safety Manager',
      category: 'Safety',
      fit_score: 76,
      reason: 'Ensure workplace safety',
      skills: ['OSHA Compliance', 'Risk Assessment', 'Training', 'Incident Investigation'],
      growth_outlook: 'medium',
    },
    {
      id: 'industrial-engineer',
      title: 'Industrial Engineer',
      category: 'Industrial Engineering',
      fit_score: 80,
      reason: 'Optimize systems and workflows',
      skills: ['Time Studies', 'Layout Design', 'Ergonomics', 'Simulation'],
      growth_outlook: 'medium',
    },
  ],
  creative: [
    {
      id: 'graphic-designer',
      title: 'Graphic Designer',
      category: 'Design',
      fit_score: 78,
      reason: 'Create visual communications',
      skills: ['Adobe Creative Suite', 'Typography', 'Branding', 'Layout'],
      growth_outlook: 'medium',
    },
    {
      id: 'art-director',
      title: 'Art Director',
      category: 'Creative Direction',
      fit_score: 82,
      reason: 'Lead visual creative vision',
      skills: ['Creative Direction', 'Team Leadership', 'Brand Strategy', 'Presentation'],
      growth_outlook: 'medium',
    },
    {
      id: 'ux-designer',
      title: 'UX Designer',
      category: 'Digital Design',
      fit_score: 84,
      reason: 'Design user experiences',
      skills: ['User Research', 'Prototyping', 'Wireframing', 'Usability Testing'],
      growth_outlook: 'high',
    },
    {
      id: 'motion-designer',
      title: 'Motion Designer',
      category: 'Motion',
      fit_score: 79,
      reason: 'Bring designs to life',
      skills: ['After Effects', 'Animation', '3D', 'Video Editing'],
      growth_outlook: 'high',
    },
    {
      id: 'copywriter',
      title: 'Copywriter',
      category: 'Writing',
      fit_score: 77,
      reason: 'Write compelling content',
      skills: ['Writing', 'Brand Voice', 'SEO', 'Storytelling'],
      growth_outlook: 'medium',
    },
    {
      id: 'creative-director',
      title: 'Creative Director',
      category: 'Creative Leadership',
      fit_score: 85,
      reason: 'Lead creative strategy',
      skills: ['Creative Vision', 'Team Leadership', 'Client Management', 'Brand Strategy'],
      growth_outlook: 'medium',
    },
    {
      id: 'photographer',
      title: 'Photographer',
      category: 'Photography',
      fit_score: 74,
      reason: 'Capture visual stories',
      skills: ['Photography', 'Lighting', 'Post-Processing', 'Art Direction'],
      growth_outlook: 'medium',
    },
    {
      id: 'video-producer',
      title: 'Video Producer',
      category: 'Video',
      fit_score: 80,
      reason: 'Create video content',
      skills: ['Video Production', 'Editing', 'Storytelling', 'Project Management'],
      growth_outlook: 'high',
    },
    {
      id: 'brand-designer',
      title: 'Brand Designer',
      category: 'Branding',
      fit_score: 81,
      reason: 'Build brand identities',
      skills: ['Brand Identity', 'Visual Systems', 'Strategy', 'Presentation'],
      growth_outlook: 'medium',
    },
    {
      id: 'content-creator',
      title: 'Content Creator',
      category: 'Content',
      fit_score: 83,
      reason: 'Create engaging digital content',
      skills: ['Content Strategy', 'Social Media', 'Video', 'Writing'],
      growth_outlook: 'high',
    },
  ],
  technology: [
    {
      id: 'software-engineer',
      title: 'Software Engineer',
      category: 'Engineering',
      fit_score: 82,
      reason: 'Build software solutions',
      skills: ['Programming', 'Problem Solving', 'System Design', 'Collaboration'],
      growth_outlook: 'high',
    },
    {
      id: 'product-manager',
      title: 'Product Manager',
      category: 'Product',
      fit_score: 84,
      reason: 'Lead product vision and strategy',
      skills: ['Strategy', 'Communication', 'Analytics', 'Leadership'],
      growth_outlook: 'high',
    },
    {
      id: 'data-scientist',
      title: 'Data Scientist',
      category: 'Data',
      fit_score: 81,
      reason: 'Extract insights from data',
      skills: ['Python', 'Machine Learning', 'Statistics', 'SQL'],
      growth_outlook: 'high',
    },
    {
      id: 'ux-designer-tech',
      title: 'UX Designer',
      category: 'Design',
      fit_score: 80,
      reason: 'Design user experiences',
      skills: ['User Research', 'Prototyping', 'Visual Design', 'Testing'],
      growth_outlook: 'high',
    },
    {
      id: 'devops-engineer',
      title: 'DevOps Engineer',
      category: 'Operations',
      fit_score: 78,
      reason: 'Bridge development and operations',
      skills: ['CI/CD', 'Cloud', 'Automation', 'Monitoring'],
      growth_outlook: 'high',
    },
    {
      id: 'frontend-developer',
      title: 'Frontend Developer',
      category: 'Engineering',
      fit_score: 79,
      reason: 'Build user interfaces',
      skills: ['JavaScript', 'React', 'CSS', 'TypeScript'],
      growth_outlook: 'high',
    },
    {
      id: 'backend-developer',
      title: 'Backend Developer',
      category: 'Engineering',
      fit_score: 78,
      reason: 'Build server-side systems',
      skills: ['Python', 'Databases', 'APIs', 'Cloud'],
      growth_outlook: 'high',
    },
    {
      id: 'ml-engineer',
      title: 'Machine Learning Engineer',
      category: 'AI/ML',
      fit_score: 83,
      reason: 'Deploy ML at scale',
      skills: ['Python', 'TensorFlow', 'MLOps', 'Cloud'],
      growth_outlook: 'high',
    },
    {
      id: 'security-engineer',
      title: 'Security Engineer',
      category: 'Security',
      fit_score: 77,
      reason: 'Protect systems and data',
      skills: ['Security', 'Networking', 'Penetration Testing', 'Compliance'],
      growth_outlook: 'high',
    },
    {
      id: 'cloud-architect',
      title: 'Cloud Architect',
      category: 'Infrastructure',
      fit_score: 85,
      reason: 'Design cloud solutions',
      skills: ['AWS/GCP/Azure', 'Architecture', 'Networking', 'Security'],
      growth_outlook: 'high',
    },
  ],
  government: [
    {
      id: 'policy-analyst',
      title: 'Policy Analyst',
      category: 'Policy',
      fit_score: 80,
      reason: 'Shape public policy',
      skills: ['Research', 'Analysis', 'Writing', 'Stakeholder Management'],
      growth_outlook: 'medium',
    },
    {
      id: 'program-manager-gov',
      title: 'Program Manager',
      category: 'Program Management',
      fit_score: 79,
      reason: 'Manage government programs',
      skills: ['Program Management', 'Budgeting', 'Compliance', 'Stakeholder Relations'],
      growth_outlook: 'medium',
    },
    {
      id: 'budget-analyst',
      title: 'Budget Analyst',
      category: 'Finance',
      fit_score: 77,
      reason: 'Manage public finances',
      skills: ['Budgeting', 'Analysis', 'Policy Knowledge', 'Forecasting'],
      growth_outlook: 'medium',
    },
    {
      id: 'public-affairs-specialist',
      title: 'Public Affairs Specialist',
      category: 'Communications',
      fit_score: 76,
      reason: 'Communicate with the public',
      skills: ['Communications', 'Media Relations', 'Writing', 'Crisis Management'],
      growth_outlook: 'medium',
    },
    {
      id: 'grants-manager',
      title: 'Grants Manager',
      category: 'Grants',
      fit_score: 75,
      reason: 'Manage grant programs',
      skills: ['Grant Management', 'Compliance', 'Financial Management', 'Reporting'],
      growth_outlook: 'medium',
    },
    {
      id: 'city-planner',
      title: 'City Planner',
      category: 'Urban Planning',
      fit_score: 78,
      reason: 'Shape urban development',
      skills: ['Urban Planning', 'GIS', 'Community Engagement', 'Zoning'],
      growth_outlook: 'medium',
    },
    {
      id: 'intelligence-analyst',
      title: 'Intelligence Analyst',
      category: 'Intelligence',
      fit_score: 81,
      reason: 'Analyze security intelligence',
      skills: ['Analysis', 'Research', 'Writing', 'Critical Thinking'],
      growth_outlook: 'medium',
    },
    {
      id: 'contracting-officer',
      title: 'Contracting Officer',
      category: 'Procurement',
      fit_score: 74,
      reason: 'Manage government contracts',
      skills: ['FAR Knowledge', 'Negotiation', 'Contract Management', 'Compliance'],
      growth_outlook: 'medium',
    },
    {
      id: 'environmental-specialist',
      title: 'Environmental Specialist',
      category: 'Environment',
      fit_score: 79,
      reason: 'Protect environmental resources',
      skills: ['Environmental Science', 'Regulatory Compliance', 'Assessment', 'Policy'],
      growth_outlook: 'high',
    },
    {
      id: 'it-specialist-gov',
      title: 'IT Specialist',
      category: 'Technology',
      fit_score: 77,
      reason: 'Support government technology',
      skills: ['IT Systems', 'Security', 'Compliance', 'User Support'],
      growth_outlook: 'medium',
    },
  ],
  nonprofit: [
    {
      id: 'program-director',
      title: 'Program Director',
      category: 'Programs',
      fit_score: 81,
      reason: 'Lead impactful programs',
      skills: ['Program Management', 'Grant Writing', 'Evaluation', 'Team Leadership'],
      growth_outlook: 'medium',
    },
    {
      id: 'development-director',
      title: 'Development Director',
      category: 'Fundraising',
      fit_score: 83,
      reason: 'Lead fundraising efforts',
      skills: ['Fundraising', 'Donor Relations', 'Grant Writing', 'Strategy'],
      growth_outlook: 'medium',
    },
    {
      id: 'grant-writer',
      title: 'Grant Writer',
      category: 'Grants',
      fit_score: 78,
      reason: 'Secure foundation funding',
      skills: ['Grant Writing', 'Research', 'Budgeting', 'Storytelling'],
      growth_outlook: 'medium',
    },
    {
      id: 'nonprofit-executive-director',
      title: 'Executive Director',
      category: 'Leadership',
      fit_score: 85,
      reason: 'Lead nonprofit organization',
      skills: ['Leadership', 'Fundraising', 'Strategy', 'Board Relations'],
      growth_outlook: 'medium',
    },
    {
      id: 'community-organizer',
      title: 'Community Organizer',
      category: 'Community',
      fit_score: 77,
      reason: 'Build community power',
      skills: ['Organizing', 'Outreach', 'Advocacy', 'Coalition Building'],
      growth_outlook: 'medium',
    },
    {
      id: 'volunteer-coordinator',
      title: 'Volunteer Coordinator',
      category: 'Volunteer Management',
      fit_score: 74,
      reason: 'Manage volunteer programs',
      skills: ['Volunteer Management', 'Training', 'Outreach', 'Event Planning'],
      growth_outlook: 'medium',
    },
    {
      id: 'advocacy-director',
      title: 'Advocacy Director',
      category: 'Advocacy',
      fit_score: 80,
      reason: 'Lead policy advocacy',
      skills: ['Advocacy', 'Policy Analysis', 'Coalition Building', 'Communications'],
      growth_outlook: 'medium',
    },
    {
      id: 'communications-manager-nonprofit',
      title: 'Communications Manager',
      category: 'Communications',
      fit_score: 76,
      reason: 'Tell the organization story',
      skills: ['Communications', 'Social Media', 'Writing', 'Storytelling'],
      growth_outlook: 'medium',
    },
    {
      id: 'impact-measurement-manager',
      title: 'Impact Measurement Manager',
      category: 'Evaluation',
      fit_score: 79,
      reason: 'Measure program outcomes',
      skills: ['Evaluation', 'Data Analysis', 'Reporting', 'Research Methods'],
      growth_outlook: 'high',
    },
    {
      id: 'major-gifts-officer',
      title: 'Major Gifts Officer',
      category: 'Fundraising',
      fit_score: 82,
      reason: 'Cultivate major donors',
      skills: ['Donor Relations', 'Solicitation', 'Stewardship', 'Portfolio Management'],
      growth_outlook: 'medium',
    },
  ],
  academia: [
    {
      id: 'assistant-professor',
      title: 'Assistant Professor',
      category: 'Faculty',
      fit_score: 80,
      reason: 'Begin tenure-track career',
      skills: ['Research', 'Teaching', 'Grant Writing', 'Publishing'],
      growth_outlook: 'medium',
    },
    {
      id: 'research-scientist',
      title: 'Research Scientist',
      category: 'Research',
      fit_score: 82,
      reason: 'Conduct academic research',
      skills: ['Research Methods', 'Data Analysis', 'Publishing', 'Grant Writing'],
      growth_outlook: 'medium',
    },
    {
      id: 'postdoctoral-researcher',
      title: 'Postdoctoral Researcher',
      category: 'Research',
      fit_score: 78,
      reason: 'Advance research training',
      skills: ['Research', 'Publishing', 'Mentoring', 'Grant Writing'],
      growth_outlook: 'medium',
    },
    {
      id: 'lecturer',
      title: 'Lecturer',
      category: 'Teaching',
      fit_score: 76,
      reason: 'Focus on teaching excellence',
      skills: ['Teaching', 'Curriculum Development', 'Student Engagement', 'Assessment'],
      growth_outlook: 'medium',
    },
    {
      id: 'lab-manager',
      title: 'Lab Manager',
      category: 'Research Support',
      fit_score: 75,
      reason: 'Manage research operations',
      skills: ['Lab Operations', 'Team Management', 'Safety', 'Inventory Management'],
      growth_outlook: 'medium',
    },
    {
      id: 'academic-advisor',
      title: 'Academic Advisor',
      category: 'Student Services',
      fit_score: 74,
      reason: 'Guide student success',
      skills: ['Advising', 'Communication', 'Problem Solving', 'Academic Policies'],
      growth_outlook: 'medium',
    },
    {
      id: 'research-administrator',
      title: 'Research Administrator',
      category: 'Administration',
      fit_score: 77,
      reason: 'Support research operations',
      skills: ['Grant Management', 'Compliance', 'Budgeting', 'Policy'],
      growth_outlook: 'medium',
    },
    {
      id: 'department-chair',
      title: 'Department Chair',
      category: 'Leadership',
      fit_score: 83,
      reason: 'Lead academic department',
      skills: ['Leadership', 'Administration', 'Faculty Development', 'Strategic Planning'],
      growth_outlook: 'medium',
    },
    {
      id: 'grants-administrator',
      title: 'Grants Administrator',
      category: 'Grants',
      fit_score: 73,
      reason: 'Manage research funding',
      skills: ['Grant Management', 'Compliance', 'Budgeting', 'Reporting'],
      growth_outlook: 'medium',
    },
    {
      id: 'academic-program-director',
      title: 'Academic Program Director',
      category: 'Programs',
      fit_score: 79,
      reason: 'Lead academic programs',
      skills: ['Program Management', 'Curriculum', 'Accreditation', 'Student Success'],
      growth_outlook: 'medium',
    },
  ],
  science_research: [
    {
      id: 'research-scientist-sr',
      title: 'Research Scientist',
      category: 'Research',
      fit_score: 83,
      reason: 'Conduct scientific research',
      skills: ['Research Methods', 'Data Analysis', 'Publishing', 'Lab Techniques'],
      growth_outlook: 'medium',
    },
    {
      id: 'lab-technician',
      title: 'Lab Technician',
      category: 'Laboratory',
      fit_score: 75,
      reason: 'Support laboratory operations',
      skills: ['Lab Techniques', 'Equipment Operation', 'Documentation', 'Safety'],
      growth_outlook: 'medium',
    },
    {
      id: 'bioinformatics-scientist',
      title: 'Bioinformatics Scientist',
      category: 'Computational',
      fit_score: 84,
      reason: 'Analyze biological data',
      skills: ['Bioinformatics', 'Programming', 'Statistics', 'Genomics'],
      growth_outlook: 'high',
    },
    {
      id: 'clinical-research-associate',
      title: 'Clinical Research Associate',
      category: 'Clinical',
      fit_score: 79,
      reason: 'Monitor clinical trials',
      skills: ['GCP', 'Monitoring', 'Documentation', 'Communication'],
      growth_outlook: 'high',
    },
    {
      id: 'regulatory-affairs-specialist',
      title: 'Regulatory Affairs Specialist',
      category: 'Regulatory',
      fit_score: 77,
      reason: 'Navigate regulatory pathways',
      skills: ['Regulatory Knowledge', 'Documentation', 'Strategy', 'Compliance'],
      growth_outlook: 'medium',
    },
    {
      id: 'medical-science-liaison',
      title: 'Medical Science Liaison',
      category: 'Medical Affairs',
      fit_score: 81,
      reason: 'Bridge science and medicine',
      skills: [
        'Scientific Communication',
        'Relationship Building',
        'Medical Knowledge',
        'Presentation',
      ],
      growth_outlook: 'high',
    },
    {
      id: 'formulation-scientist',
      title: 'Formulation Scientist',
      category: 'Pharmaceutical',
      fit_score: 78,
      reason: 'Develop drug formulations',
      skills: ['Formulation', 'Analytical Methods', 'Documentation', 'Problem Solving'],
      growth_outlook: 'medium',
    },
    {
      id: 'quality-control-scientist',
      title: 'Quality Control Scientist',
      category: 'Quality',
      fit_score: 76,
      reason: 'Ensure product quality',
      skills: ['QC Methods', 'Documentation', 'Compliance', 'Analytical Techniques'],
      growth_outlook: 'medium',
    },
    {
      id: 'process-development-scientist',
      title: 'Process Development Scientist',
      category: 'Development',
      fit_score: 80,
      reason: 'Scale up scientific processes',
      skills: ['Process Development', 'Scale-Up', 'Documentation', 'Problem Solving'],
      growth_outlook: 'medium',
    },
    {
      id: 'principal-investigator',
      title: 'Principal Investigator',
      category: 'Research Leadership',
      fit_score: 85,
      reason: 'Lead research programs',
      skills: ['Research Leadership', 'Grant Writing', 'Team Management', 'Strategic Vision'],
      growth_outlook: 'medium',
    },
  ],
  media: [
    {
      id: 'journalist',
      title: 'Journalist',
      category: 'Editorial',
      fit_score: 77,
      reason: 'Report news stories',
      skills: ['Writing', 'Research', 'Interviewing', 'Deadline Management'],
      growth_outlook: 'low',
    },
    {
      id: 'editor',
      title: 'Editor',
      category: 'Editorial',
      fit_score: 79,
      reason: 'Shape content quality',
      skills: ['Editing', 'Writing', 'Content Strategy', 'Team Management'],
      growth_outlook: 'medium',
    },
    {
      id: 'social-media-manager',
      title: 'Social Media Manager',
      category: 'Digital',
      fit_score: 81,
      reason: 'Build social presence',
      skills: ['Social Media', 'Content Creation', 'Analytics', 'Community Management'],
      growth_outlook: 'high',
    },
    {
      id: 'video-editor',
      title: 'Video Editor',
      category: 'Production',
      fit_score: 78,
      reason: 'Create compelling video content',
      skills: ['Video Editing', 'Storytelling', 'Motion Graphics', 'Color Grading'],
      growth_outlook: 'high',
    },
    {
      id: 'podcast-producer',
      title: 'Podcast Producer',
      category: 'Audio',
      fit_score: 80,
      reason: 'Produce audio content',
      skills: ['Audio Production', 'Storytelling', 'Editing', 'Guest Booking'],
      growth_outlook: 'high',
    },
    {
      id: 'content-strategist-media',
      title: 'Content Strategist',
      category: 'Strategy',
      fit_score: 82,
      reason: 'Plan content direction',
      skills: ['Content Strategy', 'Analytics', 'SEO', 'Audience Development'],
      growth_outlook: 'high',
    },
    {
      id: 'broadcast-producer',
      title: 'Broadcast Producer',
      category: 'Broadcast',
      fit_score: 76,
      reason: 'Produce broadcast content',
      skills: ['Production', 'Coordination', 'Storytelling', 'Live Production'],
      growth_outlook: 'low',
    },
    {
      id: 'media-buyer',
      title: 'Media Buyer',
      category: 'Advertising',
      fit_score: 75,
      reason: 'Optimize ad placements',
      skills: ['Media Planning', 'Negotiation', 'Analytics', 'Budget Management'],
      growth_outlook: 'medium',
    },
    {
      id: 'audience-development-manager',
      title: 'Audience Development Manager',
      category: 'Growth',
      fit_score: 83,
      reason: 'Grow media audience',
      skills: ['Analytics', 'SEO', 'Social Media', 'Email Marketing'],
      growth_outlook: 'high',
    },
    {
      id: 'multimedia-journalist',
      title: 'Multimedia Journalist',
      category: 'Digital',
      fit_score: 79,
      reason: 'Create cross-platform content',
      skills: ['Writing', 'Video', 'Photography', 'Social Media'],
      growth_outlook: 'medium',
    },
  ],
  real_estate: [
    {
      id: 'real-estate-agent',
      title: 'Real Estate Agent',
      category: 'Sales',
      fit_score: 77,
      reason: 'Facilitate property transactions',
      skills: ['Sales', 'Negotiation', 'Market Knowledge', 'Client Relations'],
      growth_outlook: 'medium',
    },
    {
      id: 'property-manager',
      title: 'Property Manager',
      category: 'Property Management',
      fit_score: 78,
      reason: 'Manage real estate properties',
      skills: ['Property Management', 'Tenant Relations', 'Maintenance', 'Budgeting'],
      growth_outlook: 'medium',
    },
    {
      id: 'real-estate-analyst',
      title: 'Real Estate Analyst',
      category: 'Analysis',
      fit_score: 81,
      reason: 'Analyze property investments',
      skills: ['Financial Modeling', 'Market Analysis', 'Excel', 'Due Diligence'],
      growth_outlook: 'high',
    },
    {
      id: 'commercial-broker',
      title: 'Commercial Real Estate Broker',
      category: 'Commercial',
      fit_score: 80,
      reason: 'Broker commercial deals',
      skills: ['Sales', 'Market Knowledge', 'Negotiation', 'Networking'],
      growth_outlook: 'medium',
    },
    {
      id: 'real-estate-developer',
      title: 'Real Estate Developer',
      category: 'Development',
      fit_score: 83,
      reason: 'Develop real estate projects',
      skills: ['Project Management', 'Finance', 'Zoning', 'Construction'],
      growth_outlook: 'medium',
    },
    {
      id: 'asset-manager-re',
      title: 'Asset Manager',
      category: 'Asset Management',
      fit_score: 82,
      reason: 'Maximize property value',
      skills: ['Asset Management', 'Financial Analysis', 'Strategy', 'Reporting'],
      growth_outlook: 'high',
    },
    {
      id: 'acquisitions-analyst',
      title: 'Acquisitions Analyst',
      category: 'Acquisitions',
      fit_score: 79,
      reason: 'Source and analyze deals',
      skills: ['Financial Modeling', 'Due Diligence', 'Market Research', 'Underwriting'],
      growth_outlook: 'high',
    },
    {
      id: 'leasing-manager',
      title: 'Leasing Manager',
      category: 'Leasing',
      fit_score: 76,
      reason: 'Manage property leasing',
      skills: ['Leasing', 'Negotiation', 'Tenant Relations', 'Marketing'],
      growth_outlook: 'medium',
    },
    {
      id: 'real-estate-appraiser',
      title: 'Real Estate Appraiser',
      category: 'Valuation',
      fit_score: 75,
      reason: 'Determine property values',
      skills: ['Valuation', 'Market Analysis', 'Reporting', 'Compliance'],
      growth_outlook: 'medium',
    },
    {
      id: 'construction-manager-re',
      title: 'Construction Manager',
      category: 'Construction',
      fit_score: 80,
      reason: 'Oversee development construction',
      skills: ['Construction Management', 'Budgeting', 'Scheduling', 'Quality Control'],
      growth_outlook: 'medium',
    },
  ],
};

// Categories for each industry
const INDUSTRY_CATEGORIES: Record<Industry, string[]> = {
  healthcare: [
    'Clinical Care',
    'Advanced Practice',
    'Laboratory',
    'Rehabilitation',
    'Administration',
    'Pharmacy',
    'Health Information',
    'Research',
    'Health IT',
  ],
  finance: [
    'Analysis',
    'Investment Banking',
    'Investment',
    'Wealth Management',
    'Risk Management',
    'Quantitative Finance',
    'Treasury',
    'Compliance',
    'Credit',
    'Financial Planning',
  ],
  legal: [
    'Legal Practice',
    'In-House',
    'Legal Support',
    'Legal Operations',
    'Compliance',
    'Contracts',
    'IP Law',
    'Litigation',
    'Legal Recruiting',
    'Legal Tech',
  ],
  trades: [
    'Electrical',
    'Plumbing',
    'HVAC',
    'Carpentry',
    'Welding',
    'Management',
    'Equipment Operation',
    'Maintenance',
    'Renewable Energy',
    'Elevator',
  ],
  education: [
    'K-12 Education',
    'Student Services',
    'Learning Design',
    'Administration',
    'Special Education',
    'Curriculum',
    'EdTech',
    'Corporate Training',
    'Higher Education',
    'Academic Support',
  ],
  consulting: [
    'Strategy',
    'Technology',
    'Operations',
    'Human Resources',
    'Finance',
    'Healthcare',
    'Sustainability',
    'Analytics',
    'Change Management',
  ],
  retail: [
    'Store Operations',
    'Multi-Unit Management',
    'Merchandising',
    'Buying',
    'E-commerce',
    'Loss Prevention',
    'Supply Chain',
    'Customer Experience',
    'Visual',
    'Analytics',
  ],
  hospitality: [
    'Hotel Management',
    'Food & Beverage',
    'Events',
    'Revenue Management',
    'Front Office',
    'Culinary',
    'Sales',
    'Spa & Wellness',
    'F&B',
    'Guest Experience',
  ],
  manufacturing: [
    'Production',
    'Quality',
    'Engineering',
    'Supply Chain',
    'Operations',
    'Maintenance',
    'Process',
    'Automation',
    'Safety',
    'Industrial Engineering',
  ],
  creative: [
    'Design',
    'Creative Direction',
    'Digital Design',
    'Motion',
    'Writing',
    'Creative Leadership',
    'Photography',
    'Video',
    'Branding',
    'Content',
  ],
  technology: [
    'Engineering',
    'Product',
    'Data',
    'Design',
    'Operations',
    'AI/ML',
    'Security',
    'Infrastructure',
  ],
  government: [
    'Policy',
    'Program Management',
    'Finance',
    'Communications',
    'Grants',
    'Urban Planning',
    'Intelligence',
    'Procurement',
    'Environment',
    'Technology',
  ],
  nonprofit: [
    'Programs',
    'Fundraising',
    'Grants',
    'Leadership',
    'Community',
    'Volunteer Management',
    'Advocacy',
    'Communications',
    'Evaluation',
  ],
  academia: [
    'Faculty',
    'Research',
    'Teaching',
    'Research Support',
    'Student Services',
    'Administration',
    'Grants',
    'Leadership',
    'Programs',
  ],
  science_research: [
    'Research',
    'Laboratory',
    'Computational',
    'Clinical',
    'Regulatory',
    'Medical Affairs',
    'Pharmaceutical',
    'Quality',
    'Development',
    'Research Leadership',
  ],
  media: [
    'Editorial',
    'Digital',
    'Production',
    'Audio',
    'Strategy',
    'Broadcast',
    'Advertising',
    'Growth',
  ],
  real_estate: [
    'Sales',
    'Property Management',
    'Analysis',
    'Commercial',
    'Development',
    'Asset Management',
    'Acquisitions',
    'Leasing',
    'Valuation',
    'Construction',
  ],
};

function generateFallbackRoles(profile: any): GalaxyRolesResponse {
  // Detect the appropriate industry from profile
  const detectedIndustry = detectIndustryFromProfile(profile);

  // Get industry-specific roles
  const industryRoles =
    INDUSTRY_FALLBACK_ROLES[detectedIndustry] || INDUSTRY_FALLBACK_ROLES.technology;
  const categories = INDUSTRY_CATEGORIES[detectedIndustry] || INDUSTRY_CATEGORIES.technology;

  // Adjust fit scores based on profile data
  const adjustedRoles = industryRoles.map((role) => {
    let scoreAdjustment = 0;

    // Match dream job
    if (profile.dream_job) {
      const dreamJobLower = profile.dream_job.toLowerCase();
      const roleTitleLower = role.title.toLowerCase();
      if (roleTitleLower.includes(dreamJobLower) || dreamJobLower.includes(roleTitleLower)) {
        scoreAdjustment += 15;
      }
      // Partial word match
      const dreamWords = dreamJobLower.split(/\s+/);
      const titleWords = roleTitleLower.split(/\s+/);
      const matchingWords = dreamWords.filter((w: string) =>
        titleWords.some((t: string) => t.includes(w) || w.includes(t)),
      );
      if (matchingWords.length > 0) {
        scoreAdjustment += matchingWords.length * 3;
      }
    }

    // Boost roles matching skills
    if (profile.skills) {
      const skillsLower = profile.skills.toLowerCase();
      const matchingSkills = role.skills.filter((skill) =>
        skillsLower.includes(skill.toLowerCase()),
      );
      scoreAdjustment += matchingSkills.length * 2;
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
