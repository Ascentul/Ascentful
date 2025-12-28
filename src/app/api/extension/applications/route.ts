import { api } from 'convex/_generated/api';
import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireConvexToken } from '@/lib/convex-auth';
import { verifyExtensionSessionToken } from '@/lib/extension-auth/extensionState';
import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// CORS headers for extension requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// Request validation schema
const createApplicationSchema = z.object({
  company: z.string().min(1, 'Company name is required'),
  jobTitle: z.string().min(1, 'Job title is required'),
  url: z.string().url().optional(),
  source: z.string().optional().default('extension_autofill'),
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
      'unknown',
    ])
    .optional(),
  resumeId: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * POST /api/extension/applications
 *
 * Creates a new job application from the extension autofill.
 * Automatically sets status to 'applied' and includes university_id for advisor visibility.
 */
export async function POST(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'extension',
    httpMethod: 'POST',
    httpPath: '/api/extension/applications',
  });

  const startTime = Date.now();

  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('Authorization');
    const extensionToken = authHeader?.replace('Bearer ', '');

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
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401, headers: corsHeaders },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = createApplicationSchema.safeParse(body);

    if (!validationResult.success) {
      log.warn('Invalid request body', {
        event: 'validation.failed',
        errors: validationResult.error.issues,
      });
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validationResult.error.issues,
        },
        { status: 400, headers: corsHeaders },
      );
    }

    const { company, jobTitle, url, source, atsPlatform, resumeId, notes } = validationResult.data;

    // Get Convex token for server-side mutations
    const convexToken = await requireConvexToken();

    // Build notes with ATS platform info
    const applicationNotes = [notes, atsPlatform ? `Applied via ${atsPlatform}` : null]
      .filter(Boolean)
      .join('\n');

    // Create application using existing mutation
    // The mutation automatically includes university_id for advisor visibility
    const applicationId = await fetchMutation(
      api.applications.createApplication,
      {
        clerkId,
        company,
        job_title: jobTitle,
        status: 'applied', // Default status for autofill
        source: source || 'extension_autofill',
        url: url || undefined,
        notes: applicationNotes || undefined,
        applied_at: Date.now(),
        // Note: resume_id would need to be converted to Convex Id type if passed
      },
      { token: convexToken },
    );

    const durationMs = Date.now() - startTime;
    log.info('Application created via extension', {
      event: 'application.created',
      applicationId,
      company,
      atsPlatform,
      durationMs,
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
    log.error('Error creating application', toErrorCode(error), {
      event: 'request.error',
      durationMs,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders },
    );
  }
}

/**
 * GET /api/extension/applications
 *
 * Returns recent applications for display in the extension popup.
 * Limited to the 10 most recent applications.
 */
export async function GET(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'extension',
    httpMethod: 'GET',
    httpPath: '/api/extension/applications',
  });

  const startTime = Date.now();

  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('Authorization');
    const extensionToken = authHeader?.replace('Bearer ', '');

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
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401, headers: corsHeaders },
      );
    }

    // Get Convex token for server-side queries
    const convexToken = await requireConvexToken();

    // Fetch user's recent applications
    const applications = await fetchQuery(
      api.applications.getUserApplications,
      { clerkId },
      { token: convexToken },
    );

    // Return only the 10 most recent, with minimal data
    const recentApplications = (applications || []).slice(0, 10).map((app) => ({
      id: app._id,
      company: app.company,
      jobTitle: app.job_title,
      status: app.status,
      url: app.url,
      appliedAt: app.applied_at || app.created_at,
    }));

    const durationMs = Date.now() - startTime;
    log.debug('Recent applications fetched', {
      event: 'request.success',
      count: recentApplications.length,
      durationMs,
    });

    return NextResponse.json(
      { applications: recentApplications },
      { headers: { ...corsHeaders, 'x-correlation-id': correlationId } },
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error('Error fetching applications', toErrorCode(error), {
      event: 'request.error',
      durationMs,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders },
    );
  }
}
