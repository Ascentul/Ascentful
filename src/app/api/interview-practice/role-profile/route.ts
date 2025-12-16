/**
 * Interview Practice - Role Profile API
 *
 * POST: Create a new role profile from job information
 * GET: List user's role profiles
 */

import { auth } from '@clerk/nextjs/server';
import { api } from 'convex/_generated/api';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

import { evaluate } from '@/lib/ai-evaluation';
import { convexServer } from '@/lib/convex-server';
import {
  buildRoleProfilePrompt,
  ROLE_PROFILE_SYSTEM_PROMPT,
} from '@/lib/interview-practice/prompts';
import type {
  InputType,
  RoleProfileAnalysis,
  RoleProfileInput,
} from '@/lib/interview-practice/types';
import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

export const runtime = 'nodejs';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/**
 * POST /api/interview-practice/role-profile
 * Create a new role profile from job information
 */
export async function POST(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'interview-practice',
    httpMethod: 'POST',
    httpPath: '/api/interview-practice/role-profile',
  });

  const startTime = Date.now();
  log.info('Role profile creation request started', { event: 'request.start' });

  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      log.warn('Unauthorized request', { event: 'auth.failed', errorCode: 'UNAUTHORIZED' });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: { 'x-correlation-id': correlationId } },
      );
    }
    const token = await getToken({ template: 'convex' });
    if (!token) {
      log.warn('Failed to obtain token', { event: 'auth.failed', errorCode: 'TOKEN_ERROR' });
      return NextResponse.json(
        { error: 'Failed to obtain auth token' },
        { status: 401, headers: { 'x-correlation-id': correlationId } },
      );
    }

    log.debug('User authenticated', { event: 'auth.success', clerkId: userId });

    const body = (await request.json()) as RoleProfileInput;
    const { input_type, job_title, company_name, job_level, job_description_text, job_url } = body;

    // Validation
    if (!job_title || job_title.trim().length === 0) {
      log.warn('Missing job title', { event: 'validation.failed', errorCode: 'BAD_REQUEST' });
      return NextResponse.json(
        { error: 'Job title is required' },
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }

    if (!input_type || !['title_company', 'jd_text', 'jd_link'].includes(input_type)) {
      log.warn('Invalid input type', { event: 'validation.failed', errorCode: 'BAD_REQUEST' });
      return NextResponse.json(
        { error: 'Invalid input type. Must be: title_company, jd_text, or jd_link' },
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Analyze job description with AI if available
    let analysis: RoleProfileAnalysis | null = null;

    if (openai) {
      log.info('Starting AI analysis of role profile', { event: 'ai.request' });

      try {
        const prompt = buildRoleProfilePrompt({
          jobTitle: job_title,
          companyName: company_name,
          jobLevel: job_level,
          jobDescriptionText: job_description_text,
        });

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: ROLE_PROFILE_SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          // Lower temperature for consistent JSON structure
          temperature: 0.3,
          response_format: { type: 'json_object' },
        });

        const content = completion.choices[0]?.message?.content;
        if (content) {
          // Parse and validate JSON response
          try {
            analysis = JSON.parse(content) as RoleProfileAnalysis;
          } catch (parseError) {
            log.error('Failed to parse AI response as JSON', toErrorCode(parseError), {
              event: 'ai.parse_error',
              extra: { content: content.substring(0, 200) },
            });
            throw new Error('Invalid JSON response from AI');
          }

          // Evaluate AI output
          const evalResult = await evaluate({
            tool_id: 'interview-role-profile-analysis',
            input: { job_title, company_name, job_description_text },
            output: analysis as unknown as Record<string, unknown>,
            user_id: userId,
          });

          if (!evalResult.passed) {
            log.warn('AI evaluation failed', {
              event: 'ai.evaluation.failed',
              extra: { riskFlags: evalResult.risk_flags },
            });
            // Continue with fallback - don't block
          }
        }

        log.info('AI analysis completed', {
          event: 'ai.success',
          extra: { competencyCount: analysis?.competencies?.length ?? 0 },
        });
      } catch (aiError) {
        log.error('AI analysis failed', toErrorCode(aiError), {
          event: 'ai.error',
        });
        // Continue without AI analysis - create basic profile
      }
    } else {
      log.info('OpenAI not configured, creating basic profile', { event: 'ai.skipped' });
    }

    // Create role profile in Convex
    const profileId = await convexServer.mutation(
      api.interview_practice.createRoleProfile,
      {
        input_type: input_type as InputType,
        job_title: job_title.trim(),
        company_name: company_name?.trim(),
        job_level: job_level?.trim(),
        job_description_text: job_description_text?.trim(),
        job_url: job_url?.trim(),
        role_summary: analysis?.role_summary,
        competencies: analysis?.competencies,
        extracted_keywords: analysis?.extracted_keywords,
        interview_type: analysis?.interview_type,
      },
      token,
    );

    // Fetch the created profile
    const profile = await convexServer.query(
      api.interview_practice.getRoleProfile,
      { profileId },
      token,
    );

    const durationMs = Date.now() - startTime;
    log.info('Role profile created', {
      event: 'request.success',
      httpStatus: 201,
      durationMs,
      extra: { profileId },
    });

    return NextResponse.json(
      { profileId, roleProfile: profile },
      { status: 201, headers: { 'x-correlation-id': correlationId } },
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error('Role profile creation failed', toErrorCode(error), {
      event: 'request.error',
      httpStatus: 500,
      durationMs,
    });
    return NextResponse.json(
      { error: 'Failed to create role profile' },
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}

/**
 * GET /api/interview-practice/role-profile
 * List user's role profiles
 */
export async function GET(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'interview-practice',
    httpMethod: 'GET',
    httpPath: '/api/interview-practice/role-profile',
  });

  const startTime = Date.now();
  log.info('Role profiles list request started', { event: 'request.start' });

  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      log.warn('Unauthorized request', { event: 'auth.failed', errorCode: 'UNAUTHORIZED' });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: { 'x-correlation-id': correlationId } },
      );
    }
    const token = await getToken({ template: 'convex' });
    if (!token) {
      return NextResponse.json(
        { error: 'Failed to obtain auth token' },
        { status: 401, headers: { 'x-correlation-id': correlationId } },
      );
    }

    const profiles = await convexServer.query(api.interview_practice.getRoleProfiles, {}, token);

    const durationMs = Date.now() - startTime;
    log.info('Role profiles retrieved', {
      event: 'request.success',
      httpStatus: 200,
      durationMs,
      extra: { count: profiles.length },
    });

    return NextResponse.json(
      { profiles },
      { status: 200, headers: { 'x-correlation-id': correlationId } },
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error('Role profiles retrieval failed', toErrorCode(error), {
      event: 'request.error',
      httpStatus: 500,
      durationMs,
    });
    return NextResponse.json(
      { error: 'Failed to retrieve role profiles' },
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}
