import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

import { requireConvexToken } from '@/lib/convex-auth';
import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

export const runtime = 'nodejs';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// In-memory cache for salary data (in production, use Redis or similar)
const salaryCache = new Map<string, SalaryLookupResponse>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours for BLS data
const ESTIMATED_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours for AI estimates

interface SalaryLookupRequest {
  role_titles: string[];
}

interface SalaryData {
  role_title: string;
  bls_occupation_code?: string;
  bls_occupation_title?: string;
  salary_range: {
    min: number; // 10th percentile
    median: number; // 50th percentile
    max: number; // 90th percentile
  };
  source: 'BLS' | 'estimated';
  source_url?: string;
  last_updated?: string;
  experience_level?: string;
  summary?: string;
}

interface SalaryLookupResponse {
  salaries: SalaryData[];
  cached_at?: number;
}

// BLS OES data mapping - Common occupations with their codes and salary data
// Data source: https://www.bls.gov/oes/current/oes_nat.htm (May 2023)
const BLS_SALARY_DATA: Record<string, Omit<SalaryData, 'role_title'>> = {
  // Software & Technology
  'software-developer': {
    bls_occupation_code: '15-1252',
    bls_occupation_title: 'Software Developers',
    salary_range: { min: 74970, median: 132270, max: 208620 },
    source: 'BLS',
    source_url: 'https://www.bls.gov/oes/current/oes151252.htm',
    last_updated: 'May 2023',
    experience_level: 'Mid-level',
    summary: 'Design, develop, and test software applications and systems.',
  },
  'software-engineer': {
    bls_occupation_code: '15-1252',
    bls_occupation_title: 'Software Developers',
    salary_range: { min: 74970, median: 132270, max: 208620 },
    source: 'BLS',
    source_url: 'https://www.bls.gov/oes/current/oes151252.htm',
    last_updated: 'May 2023',
    experience_level: 'Mid-level',
    summary: 'Design, develop, and test software applications and systems.',
  },
  'frontend-developer': {
    bls_occupation_code: '15-1254',
    bls_occupation_title: 'Web Developers',
    salary_range: { min: 44730, median: 80730, max: 146880 },
    source: 'BLS',
    source_url: 'https://www.bls.gov/oes/current/oes151254.htm',
    last_updated: 'May 2023',
    experience_level: 'Entry to Mid-level',
    summary: 'Create and maintain websites, focusing on user interface and experience.',
  },
  'backend-developer': {
    bls_occupation_code: '15-1252',
    bls_occupation_title: 'Software Developers',
    salary_range: { min: 74970, median: 132270, max: 208620 },
    source: 'BLS',
    source_url: 'https://www.bls.gov/oes/current/oes151252.htm',
    last_updated: 'May 2023',
    experience_level: 'Mid-level',
    summary: 'Build server-side applications, APIs, and database systems.',
  },
  'devops-engineer': {
    bls_occupation_code: '15-1244',
    bls_occupation_title: 'Network and Computer Systems Administrators',
    salary_range: { min: 57570, median: 95360, max: 147670 },
    source: 'BLS',
    source_url: 'https://www.bls.gov/oes/current/oes151244.htm',
    last_updated: 'May 2023',
    experience_level: 'Mid to Senior',
    summary: 'Manage infrastructure, CI/CD pipelines, and cloud deployments.',
  },
  'mobile-developer': {
    bls_occupation_code: '15-1252',
    bls_occupation_title: 'Software Developers',
    salary_range: { min: 74970, median: 132270, max: 208620 },
    source: 'BLS',
    source_url: 'https://www.bls.gov/oes/current/oes151252.htm',
    last_updated: 'May 2023',
    experience_level: 'Mid-level',
    summary: 'Develop applications for iOS and Android mobile platforms.',
  },
  'data-scientist': {
    bls_occupation_code: '15-2051',
    bls_occupation_title: 'Data Scientists',
    salary_range: { min: 67680, median: 108020, max: 184660 },
    source: 'BLS',
    source_url: 'https://www.bls.gov/oes/current/oes152051.htm',
    last_updated: 'May 2023',
    experience_level: 'Mid to Senior',
    summary: 'Analyze complex data sets to find patterns and build predictive models.',
  },
  'data-analyst': {
    bls_occupation_code: '15-2041',
    bls_occupation_title: 'Statisticians',
    salary_range: { min: 57820, median: 104110, max: 166520 },
    source: 'BLS',
    source_url: 'https://www.bls.gov/oes/current/oes152041.htm',
    last_updated: 'May 2023',
    experience_level: 'Entry to Mid-level',
    summary: 'Collect, process, and analyze data to inform business decisions.',
  },
  'data-engineer': {
    bls_occupation_code: '15-1243',
    bls_occupation_title: 'Database Administrators and Architects',
    salary_range: { min: 62570, median: 112120, max: 178440 },
    source: 'BLS',
    source_url: 'https://www.bls.gov/oes/current/oes151243.htm',
    last_updated: 'May 2023',
    experience_level: 'Mid-level',
    summary: 'Build and maintain data pipelines and infrastructure.',
  },
  'ml-engineer': {
    bls_occupation_code: '15-2051',
    bls_occupation_title: 'Data Scientists',
    salary_range: { min: 67680, median: 108020, max: 184660 },
    source: 'BLS',
    source_url: 'https://www.bls.gov/oes/current/oes152051.htm',
    last_updated: 'May 2023',
    experience_level: 'Mid to Senior',
    summary: 'Deploy and scale machine learning models in production systems.',
  },
  // Business & Strategy
  'product-manager': {
    bls_occupation_code: '11-2021',
    bls_occupation_title: 'Marketing Managers',
    salary_range: { min: 81780, median: 157620, max: 239200 },
    source: 'BLS',
    source_url: 'https://www.bls.gov/oes/current/oes112021.htm',
    last_updated: 'May 2023',
    experience_level: 'Mid to Senior',
    summary: 'Define product vision, strategy, and roadmap to meet user needs.',
  },
  'business-analyst': {
    bls_occupation_code: '13-1111',
    bls_occupation_title: 'Management Analysts',
    salary_range: { min: 55650, median: 99410, max: 168330 },
    source: 'BLS',
    source_url: 'https://www.bls.gov/oes/current/oes131111.htm',
    last_updated: 'May 2023',
    experience_level: 'Mid-level',
    summary: 'Analyze business processes and recommend improvements.',
  },
  'project-manager': {
    bls_occupation_code: '11-9199',
    bls_occupation_title: 'Managers, All Other',
    salary_range: { min: 62600, median: 113750, max: 184300 },
    source: 'BLS',
    source_url: 'https://www.bls.gov/oes/current/oes119199.htm',
    last_updated: 'May 2023',
    experience_level: 'Mid to Senior',
    summary: 'Plan, execute, and close projects on time and within budget.',
  },
  'management-consultant': {
    bls_occupation_code: '13-1111',
    bls_occupation_title: 'Management Analysts',
    salary_range: { min: 55650, median: 99410, max: 168330 },
    source: 'BLS',
    source_url: 'https://www.bls.gov/oes/current/oes131111.htm',
    last_updated: 'May 2023',
    experience_level: 'Mid to Senior',
    summary: 'Advise organizations on improving efficiency and profitability.',
  },
  'operations-manager': {
    bls_occupation_code: '11-1021',
    bls_occupation_title: 'General and Operations Managers',
    salary_range: { min: 57250, median: 101280, max: 179120 },
    source: 'BLS',
    source_url: 'https://www.bls.gov/oes/current/oes111021.htm',
    last_updated: 'May 2023',
    experience_level: 'Senior',
    summary: 'Oversee daily operations and optimize business processes.',
  },
  // Creative & Design
  'ux-designer': {
    bls_occupation_code: '15-1255',
    bls_occupation_title: 'Web and Digital Interface Designers',
    salary_range: { min: 48780, median: 88400, max: 148310 },
    source: 'BLS',
    source_url: 'https://www.bls.gov/oes/current/oes151255.htm',
    last_updated: 'May 2023',
    experience_level: 'Mid-level',
    summary: 'Research user needs and design intuitive digital experiences.',
  },
  'ui-designer': {
    bls_occupation_code: '15-1255',
    bls_occupation_title: 'Web and Digital Interface Designers',
    salary_range: { min: 48780, median: 88400, max: 148310 },
    source: 'BLS',
    source_url: 'https://www.bls.gov/oes/current/oes151255.htm',
    last_updated: 'May 2023',
    experience_level: 'Mid-level',
    summary: 'Create visually appealing and functional user interfaces.',
  },
  'graphic-designer': {
    bls_occupation_code: '27-1024',
    bls_occupation_title: 'Graphic Designers',
    salary_range: { min: 35800, median: 57990, max: 98390 },
    source: 'BLS',
    source_url: 'https://www.bls.gov/oes/current/oes271024.htm',
    last_updated: 'May 2023',
    experience_level: 'Entry to Mid-level',
    summary: 'Create visual content for print and digital media.',
  },
  'content-designer': {
    bls_occupation_code: '27-3043',
    bls_occupation_title: 'Writers and Authors',
    salary_range: { min: 38500, median: 73150, max: 145770 },
    source: 'BLS',
    source_url: 'https://www.bls.gov/oes/current/oes273043.htm',
    last_updated: 'May 2023',
    experience_level: 'Mid-level',
    summary: 'Write clear, user-centered content for digital products.',
  },
  // Marketing
  'marketing-manager': {
    bls_occupation_code: '11-2021',
    bls_occupation_title: 'Marketing Managers',
    salary_range: { min: 81780, median: 157620, max: 239200 },
    source: 'BLS',
    source_url: 'https://www.bls.gov/oes/current/oes112021.htm',
    last_updated: 'May 2023',
    experience_level: 'Senior',
    summary: 'Develop marketing strategies and manage campaigns.',
  },
  'digital-marketing': {
    bls_occupation_code: '13-1161',
    bls_occupation_title: 'Market Research Analysts and Marketing Specialists',
    salary_range: { min: 40030, median: 74680, max: 131850 },
    source: 'BLS',
    source_url: 'https://www.bls.gov/oes/current/oes131161.htm',
    last_updated: 'May 2023',
    experience_level: 'Entry to Mid-level',
    summary: 'Execute digital marketing campaigns across online channels.',
  },
  'content-strategist': {
    bls_occupation_code: '27-3043',
    bls_occupation_title: 'Writers and Authors',
    salary_range: { min: 38500, median: 73150, max: 145770 },
    source: 'BLS',
    source_url: 'https://www.bls.gov/oes/current/oes273043.htm',
    last_updated: 'May 2023',
    experience_level: 'Mid to Senior',
    summary: 'Plan and oversee content creation and distribution strategies.',
  },
  'brand-manager': {
    bls_occupation_code: '11-2021',
    bls_occupation_title: 'Marketing Managers',
    salary_range: { min: 81780, median: 157620, max: 239200 },
    source: 'BLS',
    source_url: 'https://www.bls.gov/oes/current/oes112021.htm',
    last_updated: 'May 2023',
    experience_level: 'Senior',
    summary: 'Develop and maintain brand identity and positioning.',
  },
  // Operations
  'technical-program-manager': {
    bls_occupation_code: '15-1299',
    bls_occupation_title: 'Computer Occupations, All Other',
    salary_range: { min: 57250, median: 99860, max: 162200 },
    source: 'BLS',
    source_url: 'https://www.bls.gov/oes/current/oes151299.htm',
    last_updated: 'May 2023',
    experience_level: 'Senior',
    summary: 'Lead complex technical programs and cross-functional initiatives.',
  },
  'scrum-master': {
    bls_occupation_code: '15-1299',
    bls_occupation_title: 'Computer Occupations, All Other',
    salary_range: { min: 57250, median: 99860, max: 162200 },
    source: 'BLS',
    source_url: 'https://www.bls.gov/oes/current/oes151299.htm',
    last_updated: 'May 2023',
    experience_level: 'Mid-level',
    summary: 'Facilitate agile teams and remove obstacles to delivery.',
  },
  'customer-success-manager': {
    bls_occupation_code: '11-2022',
    bls_occupation_title: 'Sales Managers',
    salary_range: { min: 66420, median: 135160, max: 239200 },
    source: 'BLS',
    source_url: 'https://www.bls.gov/oes/current/oes112022.htm',
    last_updated: 'May 2023',
    experience_level: 'Mid to Senior',
    summary: 'Ensure customers achieve their goals with the product.',
  },
};

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'career-path',
    httpMethod: 'POST',
    httpPath: '/api/career-explorer/role-salary',
  });

  const startTime = Date.now();
  log.info('Salary lookup request started', { event: 'request.start' });

  try {
    // Authenticate user
    await requireConvexToken();

    const body = (await request.json()) as SalaryLookupRequest;
    const { role_titles } = body;

    if (!role_titles || !Array.isArray(role_titles) || role_titles.length === 0) {
      return NextResponse.json(
        { error: 'role_titles array is required' },
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Limit to 50 roles per request
    const titlesToProcess = role_titles.slice(0, 50);
    const salaries: SalaryData[] = [];

    for (const title of titlesToProcess) {
      const normalizedTitle = title.toLowerCase().replace(/\s+/g, '-');

      // Check cache first
      const cacheKey = normalizedTitle;
      const cached = salaryCache.get(cacheKey);
      if (cached && cached.cached_at && Date.now() - cached.cached_at < CACHE_TTL_MS) {
        const cachedSalary = cached.salaries[0];
        if (cachedSalary) {
          salaries.push({ ...cachedSalary, role_title: title });
          continue;
        }
      }

      // Check if we have BLS data for this role
      let salaryData: Omit<SalaryData, 'role_title'> | null =
        BLS_SALARY_DATA[normalizedTitle] || null;

      // If not found directly, try to find a match using AI
      if (!salaryData) {
        salaryData = await findBestBLSMatch(title, log);
      }

      if (salaryData) {
        const salary: SalaryData = {
          role_title: title,
          ...salaryData,
        };
        salaries.push(salary);

        // Cache the result
        salaryCache.set(cacheKey, {
          salaries: [salary],
          cached_at: Date.now(),
        });
      } else {
        // Provide an estimated salary if we can't find BLS data
        const estimatedSalary = await estimateSalary(title, log);
        salaries.push(estimatedSalary);

        // Cache estimated result with shorter TTL (4 hours vs 24 hours for BLS)
        salaryCache.set(cacheKey, {
          salaries: [estimatedSalary],
          cached_at: Date.now() - (CACHE_TTL_MS - ESTIMATED_CACHE_TTL_MS),
        });
      }
    }

    const durationMs = Date.now() - startTime;
    log.info('Salary lookup request completed', {
      event: 'request.success',
      httpStatus: 200,
      durationMs,
      extra: { roleCount: salaries.length },
    });

    return NextResponse.json(
      { salaries },
      { status: 200, headers: { 'x-correlation-id': correlationId } },
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status =
      message === 'Unauthorized' || message === 'Failed to obtain auth token' ? 401 : 500;

    log.error('Salary lookup request failed', toErrorCode(error), {
      event: 'request.error',
      httpStatus: status,
      durationMs,
    });

    return NextResponse.json(
      { error: message },
      { status, headers: { 'x-correlation-id': correlationId } },
    );
  }
}

async function findBestBLSMatch(
  roleTitle: string,
  log: ReturnType<typeof createRequestLogger>,
): Promise<Omit<SalaryData, 'role_title'> | null> {
  if (!openai) {
    log.debug('OpenAI not available, skipping AI matching', { event: 'ai.match.skip' });
    return null;
  }

  try {
    // Use AI to find the best matching BLS occupation
    const availableOccupations = Object.entries(BLS_SALARY_DATA)
      .map(([key, data]) => `${key}: ${data.bls_occupation_title}`)
      .join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a career data expert. Match job titles to BLS occupation categories.
Return ONLY the key of the best matching occupation, nothing else.
If no good match exists, return "none".`,
        },
        {
          role: 'user',
          content: `Match this job title to the best BLS occupation:

Job Title: ${roleTitle}

Available occupations:
${availableOccupations}

Return only the key (e.g., "software-engineer") or "none" if no good match.`,
        },
      ],
      max_tokens: 50,
      temperature: 0,
    });

    const matchKey = completion.choices[0]?.message?.content?.trim().toLowerCase();

    if (matchKey && matchKey !== 'none' && BLS_SALARY_DATA[matchKey]) {
      log.debug('AI matched role to BLS data', {
        event: 'ai.match',
        extra: { roleTitle, matchKey },
      });
      return BLS_SALARY_DATA[matchKey];
    }

    return null;
  } catch (error) {
    log.warn('AI matching failed', { event: 'ai.match.error', errorCode: toErrorCode(error) });
    return null;
  }
}

async function estimateSalary(
  roleTitle: string,
  log: ReturnType<typeof createRequestLogger>,
): Promise<SalaryData> {
  if (!openai) {
    log.debug('OpenAI not available, using fallback estimates', { event: 'estimate.skip' });
    return {
      role_title: roleTitle,
      salary_range: { min: 50000, median: 75000, max: 120000 },
      source: 'estimated',
      experience_level: 'Mid-level',
      summary: `Professional role as ${roleTitle}.`,
    };
  }

  try {
    // Use AI to estimate salary based on role title
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a compensation expert. Estimate realistic US salary ranges for job titles.
Return ONLY valid JSON with this exact format:
{"min": number, "median": number, "max": number, "experience_level": "Entry/Mid/Senior", "summary": "brief description"}`,
        },
        {
          role: 'user',
          content: `Estimate the US salary range for: ${roleTitle}

Provide 10th percentile (min), 50th percentile (median), and 90th percentile (max) in USD annual salary.`,
        },
      ],
      max_tokens: 150,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      return {
        role_title: roleTitle,
        salary_range: {
          min: parsed.min || 50000,
          median: parsed.median || 75000,
          max: parsed.max || 120000,
        },
        source: 'estimated',
        experience_level: parsed.experience_level || 'Mid-level',
        summary: parsed.summary || `Professional role as ${roleTitle}.`,
      };
    }
  } catch (error) {
    log.warn('Salary estimation failed', {
      event: 'estimate.error',
      errorCode: toErrorCode(error),
    });
  }

  // Fallback to generic estimates
  return {
    role_title: roleTitle,
    salary_range: { min: 50000, median: 75000, max: 120000 },
    source: 'estimated',
    experience_level: 'Mid-level',
    summary: `Professional role as ${roleTitle}.`,
  };
}
