import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireConvexToken } from '@/lib/convex-auth';
import { getExtensionCorsHeaders } from '@/lib/extension-auth/cors';
import { verifyExtensionSessionToken } from '@/lib/extension-auth/extensionState';
import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('Origin');
  const corsHeaders = getExtensionCorsHeaders(origin, 'GET, PATCH, OPTIONS');
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// Request validation schema for updating an application
const updateApplicationSchema = z.object({
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
    .optional(),
  notes: z.string().optional(),
  status: z.enum(['saved', 'applied', 'interview', 'offer', 'rejected']).optional(),
});

/**
 * GET /api/extension/applications/[id]
 *
 * Get a single application by ID.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const origin = request.headers.get('Origin');
  const corsHeaders = getExtensionCorsHeaders(origin, 'GET, PATCH, OPTIONS');
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'extension',
    httpMethod: 'GET',
    httpPath: `/api/extension/applications/${id}`,
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
        extra: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401, headers: corsHeaders },
      );
    }

    // Get Convex token for server-side queries
    const { token: convexToken } = await requireConvexToken();

    // Fetch user's applications and find the one with matching ID
    const applications = await fetchQuery(
      api.applications.getUserApplications,
      { clerkId },
      { token: convexToken },
    );

    const application = applications?.find((app) => app._id === id);

    if (!application) {
      log.warn('Application not found', { event: 'not_found', extra: { applicationId: id } });
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404, headers: corsHeaders },
      );
    }

    const durationMs = Date.now() - startTime;
    log.debug('Application fetched', {
      event: 'request.success',
      durationMs,
      extra: { applicationId: id },
    });

    return NextResponse.json(
      {
        id: application._id,
        company: application.company,
        jobTitle: application.job_title,
        status: application.status,
        stage: application.stage,
        url: application.url,
        notes: application.notes,
        appliedAt: application.applied_at || application.created_at,
        createdAt: application.created_at,
        updatedAt: application.updated_at,
      },
      { headers: { ...corsHeaders, 'x-correlation-id': correlationId } },
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error('Error fetching application', toErrorCode(error), {
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
 * PATCH /api/extension/applications/[id]
 *
 * Update an application's stage, status, or notes.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const origin = request.headers.get('Origin');
  const corsHeaders = getExtensionCorsHeaders(origin, 'GET, PATCH, OPTIONS');
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'extension',
    httpMethod: 'PATCH',
    httpPath: `/api/extension/applications/${id}`,
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

    const validationResult = updateApplicationSchema.safeParse(body);

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

    const { stage, notes, status } = validationResult.data;

    // Get Convex token for server-side mutations
    const { token: convexToken } = await requireConvexToken();

    // Map stage to status if stage is provided and status is not
    let effectiveStatus = status;
    if (stage && !status) {
      const stageToStatusMap: Record<string, string> = {
        Prospect: 'saved',
        Applied: 'applied',
        Interview: 'interview',
        Offer: 'offer',
        Accepted: 'offer',
        Rejected: 'rejected',
        Withdrawn: 'rejected',
        Archived: 'rejected',
      };
      effectiveStatus = stageToStatusMap[stage] as
        | 'saved'
        | 'applied'
        | 'interview'
        | 'offer'
        | 'rejected';
    }

    // Build updates object
    const updates: Record<string, unknown> = {};

    // Persist primary stage field when provided
    if (stage !== undefined) {
      updates.stage = stage;
    }

    // Keep legacy status in sync for backward compatibility
    if (effectiveStatus) {
      updates.status = effectiveStatus;
    }

    // Allow clearing notes by sending an empty string
    if (notes !== undefined) {
      updates.notes = notes || null;
    }

    // Update application using existing mutation
    await fetchMutation(
      api.applications.updateApplication,
      {
        clerkId,
        applicationId: id as Id<'applications'>,
        updates,
      },
      { token: convexToken },
    );

    const durationMs = Date.now() - startTime;
    log.info('Application updated via extension', {
      event: 'application.updated',
      durationMs,
      extra: { applicationId: id, updates: Object.keys(updates) },
    });

    return NextResponse.json(
      {
        success: true,
        applicationId: id,
      },
      {
        status: 200,
        headers: { ...corsHeaders, 'x-correlation-id': correlationId },
      },
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error('Error updating application', toErrorCode(error), {
      event: 'request.error',
      durationMs,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders },
    );
  }
}
