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
  const corsHeaders = getExtensionCorsHeaders(origin, 'PATCH, OPTIONS');
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// Request validation schema for updating a task
const updateTaskSchema = z.object({
  status: z.enum(['open', 'done']).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  dueAt: z.number().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
});

/**
 * PATCH /api/extension/tasks/[id]
 *
 * Updates a task's status or other fields.
 * Primarily used for marking tasks as complete.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const origin = request.headers.get('Origin');
  const corsHeaders = getExtensionCorsHeaders(origin, 'PATCH, OPTIONS');
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'extension',
    httpMethod: 'PATCH',
    httpPath: `/api/extension/tasks/${id}`,
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

    const validationResult = updateTaskSchema.safeParse(body);

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

    const updates = validationResult.data;

    // Get Convex token for server-side mutations
    const { token: convexToken } = await requireConvexToken();

    // Verify user exists
    const user = await fetchQuery(
      api.users_queries.getUserByClerkId,
      { clerkId },
      { token: convexToken },
    );

    if (!user) {
      log.warn('User not found', { event: 'user.not_found' });
      return NextResponse.json({ error: 'User not found' }, { status: 404, headers: corsHeaders });
    }

    // Build the updates object for the mutation
    const updatePayload: {
      title?: string;
      description?: string;
      due_at?: number;
      status?: 'open' | 'done';
      priority?: 'low' | 'medium' | 'high' | 'urgent';
    } = {};

    if (updates.status) updatePayload.status = updates.status;
    if (updates.title) updatePayload.title = updates.title;
    if (updates.description) updatePayload.description = updates.description;
    if (updates.dueAt) updatePayload.due_at = updates.dueAt;
    if (updates.priority) updatePayload.priority = updates.priority;

    // Update the task using followups.updateFollowup
    const result = await fetchMutation(
      api.followups.updateFollowup,
      {
        followupId: id as Id<'follow_ups'>,
        updates: updatePayload,
      },
      { token: convexToken },
    );

    const durationMs = Date.now() - startTime;
    log.info('Task updated via extension', {
      event: 'task.updated',
      durationMs,
      extra: { taskId: id, updates: Object.keys(updates) },
    });

    return NextResponse.json(
      {
        ...result,
        taskId: id,
      },
      {
        status: 200,
        headers: { ...corsHeaders, 'x-correlation-id': correlationId },
      },
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error('Error updating task', toErrorCode(error), {
      event: 'request.error',
      durationMs,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders },
    );
  }
}
