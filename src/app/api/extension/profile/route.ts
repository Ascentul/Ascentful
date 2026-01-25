import { api } from 'convex/_generated/api';
import { fetchQuery } from 'convex/nextjs';
import { NextRequest, NextResponse } from 'next/server';

import { requireConvexToken } from '@/lib/convex-auth';
import { getExtensionCorsHeaders } from '@/lib/extension-auth/cors';
import { verifyExtensionSessionToken } from '@/lib/extension-auth/extensionState';
import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('Origin');
  const corsHeaders = getExtensionCorsHeaders(origin, 'GET, OPTIONS');
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * GET /api/extension/profile
 *
 * Returns the user's profile data for autofill, including:
 * - Contact information
 * - Work history
 * - Education history
 * - Skills
 * - List of resumes
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get('Origin');
  const corsHeaders = getExtensionCorsHeaders(origin, 'GET, OPTIONS');
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'extension',
    httpMethod: 'GET',
    httpPath: '/api/extension/profile',
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

    // Fetch user profile
    const user = await fetchQuery(api.users.getUserByClerkId, { clerkId }, { token: convexToken });

    if (!user) {
      log.warn('User not found', { event: 'user.not_found', clerkId });
      return NextResponse.json({ error: 'User not found' }, { status: 404, headers: corsHeaders });
    }

    // Fetch user's resumes
    const resumes = await fetchQuery(
      api.resumes.getUserResumes,
      { clerkId },
      { token: convexToken },
    );

    // Transform to extension profile format
    // Using camelCase to match TypeScript conventions in the extension
    const extensionProfile = {
      // Contact Info
      name: user.name,
      email: user.email,
      phoneNumber: user.phone_number || undefined,
      location: user.location || undefined,
      city: user.city || undefined,
      state: user.state || undefined,
      zipCode: user.zip_code || undefined,
      country: user.country || undefined,
      streetAddress: user.street_address || undefined,

      // Links
      linkedinUrl: user.linkedin_url || undefined,
      githubUrl: user.github_url || undefined,
      twitterUrl: user.twitter_url || undefined,
      website: user.website || undefined,
      portfolioUrl: user.portfolio_url || undefined,

      // Career Data
      currentPosition: user.current_position || user.job_title || undefined,
      currentCompany: user.current_company || user.company || undefined,
      skills: user.skills || undefined,
      industry: user.industry || undefined,
      experienceLevel: user.experience_level || undefined,
      yearsOfExperience: user.years_of_experience || undefined,

      // Work Authorization
      workAuthorization: user.work_authorization || undefined,
      requiresSponsorship: user.requires_sponsorship ?? undefined,

      // Job Preferences
      desiredSalary: user.desired_salary || undefined,
      availableStartDate: user.available_start_date || undefined,

      // History Arrays - transform from snake_case to camelCase
      educationHistory: (user.education_history || []).map((edu) => ({
        id: edu.id,
        school: edu.school,
        degree: edu.degree,
        fieldOfStudy: edu.field_of_study,
        startYear: edu.start_year,
        endYear: edu.end_year,
        isCurrent: edu.is_current,
        description: edu.description,
      })),

      workHistory: (user.work_history || []).map((work) => ({
        id: work.id,
        role: work.role,
        company: work.company,
        startDate: work.start_date,
        endDate: work.end_date,
        isCurrent: work.is_current,
        location: work.location,
        summary: work.summary,
      })),

      achievementsHistory: (user.achievements_history || []).map((achievement) => ({
        id: achievement.id,
        title: achievement.title,
        description: achievement.description,
        date: achievement.date,
        organization: achievement.organization,
      })),

      // University context for advisor visibility
      universityId: user.university_id || undefined,

      // Resume list for selection
      resumes: (resumes || []).map((resume) => ({
        id: resume._id,
        title: resume.title,
        templateId: resume.template_id,
        updatedAt: resume.updated_at,
        content: resume.content, // Full resume data for autofill
      })),

      // Metadata
      lastUpdated: user.updated_at,
    };

    const durationMs = Date.now() - startTime;
    log.debug('Extension profile fetched', {
      event: 'request.success',
      clerkId,
      durationMs,
      extra: { resumeCount: extensionProfile.resumes.length },
    });

    return NextResponse.json(
      { profile: extensionProfile },
      { headers: { ...corsHeaders, 'x-correlation-id': correlationId } },
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error('Error fetching extension profile', toErrorCode(error), {
      event: 'request.error',
      durationMs,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders },
    );
  }
}
