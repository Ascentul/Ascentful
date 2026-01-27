/**
 * Admin Health Check API
 *
 * Tests connectivity to external services (OpenAI, SendGrid, Clerk)
 * Returns status, latency, and error details
 */

import { auth } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cache health check results to avoid rate limiting
const healthCache = new Map<string, { result: HealthCheckResult; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface HealthCheckResult {
  success: boolean;
  latency: number;
  error?: string;
  details?: Record<string, unknown>;
}

interface RouteParams {
  params: Promise<{ provider: string }>;
}

async function checkOpenAI(): Promise<HealthCheckResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      latency: 0,
      error: 'OPENAI_API_KEY not configured',
    };
  }

  const start = Date.now();
  try {
    const openai = new OpenAI({ apiKey, timeout: 5000 });

    // Make a minimal API call to test connectivity
    const response = await openai.models.list();
    const latency = Date.now() - start;

    return {
      success: true,
      latency,
      details: {
        modelCount: response.data.length,
        hasGpt4: response.data.some((m) => m.id.includes('gpt-4')),
      },
    };
  } catch (error) {
    const latency = Date.now() - start;
    return {
      success: false,
      latency,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkSendGrid(): Promise<HealthCheckResult> {
  const apiKey = process.env.SENDGRID_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      latency: 0,
      error: 'SENDGRID_API_KEY not configured',
    };
  }

  const start = Date.now();
  try {
    // SendGrid API validation endpoint
    const response = await fetch('https://api.sendgrid.com/v3/scopes', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    const latency = Date.now() - start;

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        latency,
        details: {
          scopeCount: data.scopes?.length || 0,
        },
      };
    } else {
      const errorText = await response.text();
      return {
        success: false,
        latency,
        error: `HTTP ${response.status}: ${errorText.substring(0, 100)}`,
      };
    }
  } catch (error) {
    const latency = Date.now() - start;
    return {
      success: false,
      latency,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkClerk(): Promise<HealthCheckResult> {
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (!secretKey) {
    return {
      success: false,
      latency: 0,
      error: 'CLERK_SECRET_KEY not configured',
    };
  }

  const start = Date.now();
  try {
    const client = await clerkClient();
    // Make a minimal API call to test connectivity
    const users = await client.users.getUserList({ limit: 1 });
    const latency = Date.now() - start;

    return {
      success: true,
      latency,
      details: {
        connectedToClerk: true,
        sampleUserExists: users.data.length > 0,
      },
    };
  } catch (error) {
    const latency = Date.now() - start;
    return {
      success: false,
      latency,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkConvex(): Promise<HealthCheckResult> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  if (!convexUrl) {
    return {
      success: false,
      latency: 0,
      error: 'NEXT_PUBLIC_CONVEX_URL not configured',
    };
  }

  const start = Date.now();
  try {
    // Convex deployments respond to HTTP requests at the deployment URL
    const healthUrl = convexUrl.replace('.cloud', '.site');
    const response = await fetch(healthUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });

    const latency = Date.now() - start;

    return {
      success: response.ok || response.status === 405, // 405 is acceptable (method not allowed but service is up)
      latency,
      details: {
        status: response.status,
        deploymentUrl: convexUrl,
      },
    };
  } catch (error) {
    const latency = Date.now() - start;
    return {
      success: false,
      latency,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { provider } = await params;

  // Require authentication
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate provider
  const validProviders = ['openai', 'sendgrid', 'clerk', 'convex'];
  const normalizedProvider = provider.toLowerCase();

  if (!validProviders.includes(normalizedProvider)) {
    return NextResponse.json(
      { error: `Invalid provider: ${provider}. Valid options: ${validProviders.join(', ')}` },
      { status: 400 },
    );
  }

  // Check cache
  const cached = healthCache.get(normalizedProvider);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      ...cached.result,
      cached: true,
      cachedAt: new Date(cached.timestamp).toISOString(),
    });
  }

  // Run health check
  let result: HealthCheckResult;

  switch (normalizedProvider) {
    case 'openai':
      result = await checkOpenAI();
      break;
    case 'sendgrid':
      result = await checkSendGrid();
      break;
    case 'clerk':
      result = await checkClerk();
      break;
    case 'convex':
      result = await checkConvex();
      break;
    default:
      return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
  }

  // Cache result
  healthCache.set(normalizedProvider, { result, timestamp: Date.now() });

  return NextResponse.json({
    provider: normalizedProvider,
    ...result,
    cached: false,
    checkedAt: new Date().toISOString(),
  });
}
