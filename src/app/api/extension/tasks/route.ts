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
  const corsHeaders = getExtensionCorsHeaders(origin, 'GET, POST, OPTIONS');
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// Request validation schema for creating a task
const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  dueAt: z.number().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  applicationId: z.string().min(1, 'Application ID is required'),
});

/**
 * GET /api/extension/tasks
 *
 * Returns tasks (follow-ups) for the current user.
 * Returns open tasks sorted by due date (overdue first).
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get('Origin');
  const corsHeaders = getExtensionCorsHeaders(origin, 'GET, POST, OPTIONS');
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'extension',
    httpMethod: 'GET',
    httpPath: '/api/extension/tasks',
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

    // Get Convex token for server-side queries
    const { token: convexToken } = await requireConvexToken();

    // First get the user to get their user_id
    const user = await fetchQuery(
      api.users_queries.getUserByClerkId,
      { clerkId },
      { token: convexToken },
    );

    if (!user) {
      log.warn('User not found', { event: 'user.not_found' });
      return NextResponse.json({ error: 'User not found' }, { status: 404, headers: corsHeaders });
    }

    // Fetch user's follow-ups (tasks) - we need to use a raw query since there's no dedicated endpoint
    // For now, we'll use the Kanban query which includes follow-ups
    const kanbanData = await fetchQuery(
      api.applications.getApplicationsForKanban,
      { clerkId },
      { token: convexToken },
    );

    // Extract tasks from all applications
    const now = Date.now();
    const tasks: Array<{
      id: string;
      title: string;
      description?: string;
      dueAt: number | null;
      priority: string;
      status: string;
      isOverdue: boolean;
      applicationId?: string;
      applicationCompany?: string;
    }> = [];

    // Flatten all applications and extract their action summaries
    const allApps = [
      ...kanbanData.saved,
      ...kanbanData.applied,
      ...kanbanData.interview,
      ...kanbanData.offer,
      ...kanbanData.rejected,
    ];

    for (const app of allApps) {
      if (app.actionSummary?.allActions) {
        for (const action of app.actionSummary.allActions) {
          tasks.push({
            id: action.id,
            title: action.title,
            dueAt: action.dueAt,
            priority: 'medium', // Default priority since it's not in the summary
            status: 'open',
            isOverdue: action.isOverdue,
            applicationId: app._id,
            applicationCompany: app.company,
          });
        }
      }
    }

    // Sort by: overdue first, then by due date ascending, then by title
    tasks.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      if (a.dueAt && b.dueAt) return a.dueAt - b.dueAt;
      if (a.dueAt) return -1;
      if (b.dueAt) return 1;
      return a.title.localeCompare(b.title);
    });

    // Limit to 50 most relevant tasks
    const limitedTasks = tasks.slice(0, 50);

    const durationMs = Date.now() - startTime;
    log.debug('Tasks fetched', {
      event: 'request.success',
      durationMs,
      extra: { count: limitedTasks.length },
    });

    return NextResponse.json(
      { tasks: limitedTasks },
      { headers: { ...corsHeaders, 'x-correlation-id': correlationId } },
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error('Error fetching tasks', toErrorCode(error), {
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
 * POST /api/extension/tasks
 *
 * Creates a new task (follow-up) for the user.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('Origin');
  const corsHeaders = getExtensionCorsHeaders(origin, 'GET, POST, OPTIONS');
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'extension',
    httpMethod: 'POST',
    httpPath: '/api/extension/tasks',
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

    const validationResult = createTaskSchema.safeParse(body);

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

    const { title, description, dueAt, priority, applicationId } = validationResult.data;

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

    // Create the task using the followups.createFollowup mutation
    // This mutation uses getAuthenticatedUser which will work with the Convex token
    const taskId = await fetchMutation(
      api.followups.createFollowup,
      {
        applicationId: applicationId as Id<'applications'>,
        description: title,
        notes: description,
        due_at: dueAt,
        priority,
        type: 'follow_up',
      },
      { token: convexToken },
    );

    const durationMs = Date.now() - startTime;
    log.info('Task created via extension', {
      event: 'task.created',
      durationMs,
      extra: { taskId, title, applicationId },
    });

    return NextResponse.json(
      {
        success: true,
        taskId,
      },
      {
        status: 201,
        headers: { ...corsHeaders, 'x-correlation-id': correlationId },
      },
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error('Error creating task', toErrorCode(error), {
      event: 'request.error',
      durationMs,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders },
    );
  }
}
