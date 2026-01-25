/**
 * Account Activation API
 *
 * Creates a Clerk user with a pre-verified email (since they clicked the invite link)
 * and returns a sign-in token to log them in immediately.
 *
 * Flow:
 * 1. Validate activation token from Convex
 * 2. Create Clerk user with email + password (email auto-verified via backend API)
 * 3. Update Convex user record with Clerk ID
 * 4. Create a sign-in token for immediate login
 * 5. Return the token to frontend
 */

import { clerkClient } from '@clerk/nextjs/server';
import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { NextRequest, NextResponse } from 'next/server';

import { api } from '../../../../../convex/_generated/api';

function resolveActivationRole(pendingUser: {
  role?: string | null;
  university_id?: string | null;
}): string {
  const baseRole = pendingUser.role || (pendingUser.university_id ? 'student' : 'individual');
  if (baseRole === 'user') {
    return pendingUser.university_id ? 'student' : 'individual';
  }
  return baseRole;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Missing required fields: token and password' },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 },
      );
    }

    // Step 1: Validate activation token and get user info from Convex
    const pendingUser = await fetchQuery(api.admin_users.getUserByActivationToken, {
      token,
    });

    if (!pendingUser) {
      return NextResponse.json({ error: 'Invalid or expired activation token' }, { status: 400 });
    }

    // Check if user already has a Clerk ID (already activated)
    // Pending users have clerkId like "pending_${token}", so check for real Clerk IDs
    if (pendingUser.clerkId && !pendingUser.clerkId.startsWith('pending_')) {
      return NextResponse.json(
        { error: 'Account has already been activated. Please sign in.' },
        { status: 400 },
      );
    }

    const resolvedRole = resolveActivationRole(pendingUser);

    const clerk = await clerkClient();

    // Step 2: Create Clerk user with email + password
    // When created via backend API, email is automatically verified
    let clerkUser;
    try {
      clerkUser = await clerk.users.createUser({
        emailAddress: [pendingUser.email],
        password: password,
        firstName: pendingUser.name?.split(' ')[0] || '',
        lastName: pendingUser.name?.split(' ').slice(1).join(' ') || '',
        publicMetadata: {
          role: resolvedRole,
        },
      });
    } catch (clerkError: any) {
      console.error('Clerk user creation error:', clerkError);

      // Handle specific Clerk errors
      if (clerkError.errors) {
        const firstError = clerkError.errors[0];
        if (firstError?.code === 'form_identifier_exists') {
          return NextResponse.json(
            { error: 'This email is already registered. Please sign in instead.' },
            { status: 400 },
          );
        }
        if (firstError?.code === 'form_password_pwned') {
          return NextResponse.json(
            {
              error:
                'This password has been found in data breaches. Please choose a more secure password.',
            },
            { status: 400 },
          );
        }
        if (firstError?.message) {
          return NextResponse.json({ error: firstError.message }, { status: 400 });
        }
      }

      return NextResponse.json(
        { error: 'Failed to create account. Please try again.' },
        { status: 500 },
      );
    }

    // Step 3: Update Convex user record with Clerk ID
    try {
      await fetchMutation(api.admin_users.activateUserAccount, {
        activationToken: token,
        clerkId: clerkUser.id,
      });
    } catch (convexError) {
      console.error('Convex activation error:', convexError);
      // If Convex fails, we should clean up the Clerk user
      try {
        await clerk.users.deleteUser(clerkUser.id);
      } catch (deleteError) {
        console.error('Failed to clean up Clerk user:', deleteError);
      }
      return NextResponse.json(
        { error: 'Failed to activate account. Please try again.' },
        { status: 500 },
      );
    }

    // Step 4: Create a sign-in token for immediate login
    let signInToken;
    try {
      signInToken = await clerk.signInTokens.createSignInToken({
        userId: clerkUser.id,
        expiresInSeconds: 60, // Token valid for 60 seconds
      });
    } catch (tokenError) {
      console.error('Sign-in token creation error:', tokenError);
      // Account is created, but we couldn't get a sign-in token
      // User will need to sign in manually
      return NextResponse.json({
        success: true,
        message: 'Account activated successfully. Please sign in.',
        redirectTo: '/sign-in',
        requiresManualSignIn: true,
      });
    }

    // Step 5: Return success with sign-in token
    return NextResponse.json({
      success: true,
      message: 'Account activated successfully!',
      signInToken: signInToken.token,
      role: resolvedRole,
    });
  } catch (error) {
    console.error('Activation error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 },
    );
  }
}
