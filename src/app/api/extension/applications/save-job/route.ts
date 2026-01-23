import { api } from 'convex/_generated/api';
import { fetchMutation } from 'convex/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireConvexToken } from '@/lib/convex-auth';
import { getExtensionCorsHeaders } from '@/lib/extension-auth/cors';
import { verifyExtensionSessionToken } from '@/lib/extension-auth/extensionState';
import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('Origin');
  const corsHeaders = getExtensionCorsHeaders(origin, 'POST, OPTIONS');
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// Request validation schema for saving a job
const saveJobSchema = z.object({
  company: z.string().min(1, 'Company name is required'),
  jobTitle: z.string().min(1, 'Job title is required'),
  url: z.string().url().optional(),
  stage: z
    .enum([
      'Prospect',
      'Applied',
      'Interview',
      'Offer',
      'Accepted',
      'Rejected',
      'Withdrawn',
      'Archived',
    ])
    .optional()
    .default('Prospect'),
  location: z.string().optional(),
  salary: z.string().optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  jobType: z.enum(['full-time', 'part-time', 'contract', 'internship', 'temporary']).optional(),
  remote: z.enum(['onsite', 'remote', 'hybrid']).optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  atsPlatform: z
    .enum([
      'greenhouse',
      'lever',
      'workday',
      'linkedin',
      'indeed',
      'taleo',
      'icims',
      'smartrecruiters',
      'glassdoor',
      'ziprecruiter',
      'monster',
      'wellfound',
      'dice',
      'unknown',
    ])
    .optional(),
});

/**
 * POST /api/extension/applications/save-job
 *
 * Saves a job without applying (Huntr-like functionality).
 * Creates an application with the specified stage (defaults to Prospect).
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('Origin');
  const corsHeaders = getExtensionCorsHeaders(origin, 'POST, OPTIONS');
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'extension',
    httpMethod: 'POST',
    httpPath: '/api/extension/applications/save-job',
  });

  const startTime = Date.now();

  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('Authorization');
    const extensionToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    if (!extensionToken) {
      log.warn('Missing authorization header', { event: 'auth.failed' });
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401, headers: corsHeaders },
      );
    }

    // Verify the extension session token
    let clerkId: string;
    try {
      const result = verifyExtensionSessionToken(extensionToken);
      clerkId = result.clerkId;
    } catch (error) {
      log.warn('Token verification failed', {
        event: 'token.invalid',
        extra: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401, headers: corsHeaders },
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      log.warn('Invalid JSON in request body', { event: 'validation.failed' });
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400, headers: corsHeaders },
      );
    }

    const validationResult = saveJobSchema.safeParse(body);

    if (!validationResult.success) {
      log.warn('Invalid request body', {
        event: 'validation.failed',
        extra: { errors: validationResult.error.issues },
      });
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validationResult.error.issues,
        },
        { status: 400, headers: corsHeaders },
      );
    }

    const {
      company,
      jobTitle,
      url,
      stage,
      location,
      salary,
      salaryMin,
      salaryMax,
      jobType,
      remote,
      description,
      notes,
      atsPlatform,
    } = validationResult.data;

    // Get Convex token for server-side mutations
    const { token: convexToken } = await requireConvexToken();

    // Map stage to status for applications table
    type ApplicationStatus = 'saved' | 'applied' | 'interview' | 'offer' | 'rejected';
    const statusMap: Record<string, ApplicationStatus> = {
      Prospect: 'saved',
      Applied: 'applied',
      Interview: 'interview',
      Offer: 'offer',
      Accepted: 'offer',
      Rejected: 'rejected',
      Withdrawn: 'rejected',
      Archived: 'rejected',
    };
    const status: ApplicationStatus = statusMap[stage] || 'saved';

    // Build notes with job details
    const notesParts: string[] = [];
    if (notes) notesParts.push(notes);
    if (location) notesParts.push(`Location: ${location}`);
    if (salary) {
      notesParts.push(`Salary: ${salary}`);
    } else if (salaryMin || salaryMax) {
      // Use structured salary range if string salary not provided
      const minStr = salaryMin ? `$${salaryMin.toLocaleString()}` : '?';
      const maxStr = salaryMax ? `$${salaryMax.toLocaleString()}` : '?';
      notesParts.push(`Salary Range: ${minStr} - ${maxStr}`);
    }
    if (jobType) notesParts.push(`Type: ${jobType}`);
    if (remote) notesParts.push(`Remote: ${remote}`);
    if (atsPlatform && atsPlatform !== 'unknown') notesParts.push(`ATS: ${atsPlatform}`);

    const applicationNotes = notesParts.join('\n');

    // Create application with explicit stage to preserve distinct values
    // (e.g., Withdrawn vs Rejected) that would be lost in status mapping
    const applicationId = await fetchMutation(
      api.applications.createApplication,
      {
        clerkId,
        company,
        job_title: jobTitle,
        status,
        stage, // Pass explicit stage to preserve distinct values
        source: 'extension_save_job',
        url: url || undefined,
        notes: applicationNotes || undefined,
        applied_at: stage === 'Applied' ? Date.now() : undefined,
      },
      { token: convexToken },
    );

    const durationMs = Date.now() - startTime;
    log.info('Job saved via extension', {
      event: 'job.saved',
      durationMs,
      extra: { applicationId, company, stage, atsPlatform },
    });

    return NextResponse.json(
      {
        success: true,
        applicationId,
      },
      {
        status: 201,
        headers: { ...corsHeaders, 'x-correlation-id': correlationId },
      },
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error('Error saving job', toErrorCode(error), {
      event: 'request.error',
      durationMs,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders },
    );
  }
}
