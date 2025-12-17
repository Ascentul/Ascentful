import { NextResponse } from 'next/server';

interface AdzunaJob {
  id: string;
  title: string;
  company: {
    display_name: string;
  };
  location: {
    display_name: string;
    area: string[];
  };
  salary_min?: number;
  salary_max?: number;
  description: string;
  redirect_url: string;
  created: string;
  category: {
    label: string;
  };
}

interface AdzunaResponse {
  results: AdzunaJob[];
  count: number;
}

interface JobResult {
  id: string;
  title: string;
  company: string;
  location: string;
  salaryMin?: number;
  salaryMax?: number;
  description: string;
  url: string;
  postedDate: string;
  category: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roleTitle, location = 'us', limit = 6 } = body;

    if (!roleTitle) {
      return NextResponse.json({ error: 'Role title is required' }, { status: 400 });
    }

    const appId = process.env.ADZUNA_APPLICATION_ID;
    const appKey = process.env.ADZUNA_API_KEY;

    // If no API keys, return mock data
    if (!appId || !appKey) {
      console.log('Adzuna API keys not configured, returning mock data');
      return NextResponse.json({
        jobs: getMockJobs(roleTitle, limit),
        totalCount: limit,
      });
    }

    // Clean up the role title for search
    const searchQuery = roleTitle.replace(/senior|junior|lead|principal|staff|intern/gi, '').trim();

    const url = new URL(`https://api.adzuna.com/v1/api/jobs/${location}/search/1`);
    url.searchParams.set('app_id', appId);
    url.searchParams.set('app_key', appKey);
    url.searchParams.set('what', searchQuery);
    url.searchParams.set('results_per_page', String(limit));
    url.searchParams.set('content-type', 'application/json');

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.error('Adzuna API error:', response.status, response.statusText);
      // Return mock data on API error
      return NextResponse.json({
        jobs: getMockJobs(roleTitle, limit),
        totalCount: limit,
      });
    }

    const data: AdzunaResponse = await response.json();

    const jobs: JobResult[] = data.results.map((job) => ({
      id: job.id,
      title: job.title,
      company: job.company.display_name,
      location: job.location.display_name,
      salaryMin: job.salary_min,
      salaryMax: job.salary_max,
      description: job.description.slice(0, 200) + '...',
      url: job.redirect_url,
      postedDate: job.created,
      category: job.category?.label || 'General',
    }));

    return NextResponse.json({
      jobs,
      totalCount: data.count,
    });
  } catch (error) {
    console.error('Adzuna jobs API error:', error);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}

// Mock data generator for when API is not available
function getMockJobs(roleTitle: string, limit: number): JobResult[] {
  const companies = [
    'Google',
    'Meta',
    'Amazon',
    'Microsoft',
    'Apple',
    'Netflix',
    'Salesforce',
    'Adobe',
    'Spotify',
    'Airbnb',
    'Uber',
    'Stripe',
  ];

  const locations = [
    'San Francisco, CA',
    'New York, NY',
    'Seattle, WA',
    'Austin, TX',
    'Boston, MA',
    'Remote',
  ];

  const titleVariations = [
    roleTitle,
    `Senior ${roleTitle}`,
    `${roleTitle} II`,
    `Lead ${roleTitle}`,
    `${roleTitle} - Remote`,
    `${roleTitle} (Hybrid)`,
  ];

  return Array.from({ length: limit }, (_, i) => ({
    id: `mock-job-${i}`,
    title: titleVariations[i % titleVariations.length],
    company: companies[i % companies.length],
    location: locations[i % locations.length],
    salaryMin: 80000 + i * 10000,
    salaryMax: 120000 + i * 15000,
    description: `Join our team as a ${roleTitle}. We're looking for talented individuals to help us build amazing products and scale our platform. Great benefits, competitive salary, and growth opportunities.`,
    url: '#',
    postedDate: new Date(Date.now() - i * 86400000).toISOString(),
    category: 'Technology',
  }));
}
