import { api } from 'convex/_generated/api';
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

// Request validation schema for creating a contact
const createContactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  company: z.string().optional(),
  position: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  linkedinUrl: z.string().url().optional(),
  notes: z.string().optional(),
  relationship: z.string().optional(),
});

/**
 * GET /api/extension/contacts
 *
 * Returns contacts for the current user.
 * Returns the 50 most recent contacts sorted by last contact date.
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get('Origin');
  const corsHeaders = getExtensionCorsHeaders(origin, 'GET, POST, OPTIONS');
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'extension',
    httpMethod: 'GET',
    httpPath: '/api/extension/contacts',
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

    // Fetch user's contacts
    const contacts = await fetchQuery(
      api.contacts.getUserContacts,
      { clerkId },
      { token: convexToken },
    );

    // Map contacts to a cleaner format for the extension
    const mappedContacts = (contacts || []).slice(0, 50).map((contact) => ({
      id: contact._id,
      name: contact.name,
      company: contact.company,
      position: contact.position,
      email: contact.email,
      phone: contact.phone,
      linkedinUrl: contact.linkedin_url,
      notes: contact.notes,
      relationship: contact.relationship,
      lastContact: contact.last_contact,
      createdAt: contact.created_at,
    }));

    const durationMs = Date.now() - startTime;
    log.debug('Contacts fetched', {
      event: 'request.success',
      durationMs,
      extra: { count: mappedContacts.length },
    });

    return NextResponse.json(
      { contacts: mappedContacts },
      { headers: { ...corsHeaders, 'x-correlation-id': correlationId } },
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error('Error fetching contacts', toErrorCode(error), {
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
 * POST /api/extension/contacts
 *
 * Creates a new contact for the user.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('Origin');
  const corsHeaders = getExtensionCorsHeaders(origin, 'GET, POST, OPTIONS');
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'extension',
    httpMethod: 'POST',
    httpPath: '/api/extension/contacts',
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

    const validationResult = createContactSchema.safeParse(body);

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

    const { name, company, position, email, phone, linkedinUrl, notes, relationship } =
      validationResult.data;

    // Get Convex token for server-side mutations
    const { token: convexToken } = await requireConvexToken();

    // Create the contact
    const contact = await fetchMutation(
      api.contacts.createContact,
      {
        clerkId,
        name,
        company: company || undefined,
        position: position || undefined,
        email: email || undefined,
        phone: phone || undefined,
        linkedin_url: linkedinUrl || undefined,
        notes: notes || undefined,
        relationship: relationship || undefined,
        last_contact: Date.now(),
      },
      { token: convexToken },
    );

    const durationMs = Date.now() - startTime;
    log.info('Contact created via extension', {
      event: 'contact.created',
      durationMs,
      extra: { contactId: contact?._id, name, company },
    });

    return NextResponse.json(
      {
        success: true,
        contact: contact
          ? {
              id: contact._id,
              name: contact.name,
              company: contact.company,
              position: contact.position,
              email: contact.email,
            }
          : null,
      },
      {
        status: 201,
        headers: { ...corsHeaders, 'x-correlation-id': correlationId },
      },
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error('Error creating contact', toErrorCode(error), {
      event: 'request.error',
      durationMs,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders },
    );
  }
}
