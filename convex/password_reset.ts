/**
 * Password reset functionality
 * Allows users to reset their password via email
 */

import { v } from 'convex/values';

import { api } from './_generated/api';
import { mutation } from './_generated/server';
import { generateSecureToken } from './lib/secureTokens';

/**
 * Generate a random password reset token
 */
function generateResetToken(): string {
  return generateSecureToken('reset');
}

/**
 * Request a password reset
 * Generates a token and sends reset email
 */
export const requestPasswordReset = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // Find user by email
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .unique();

    // For security, don't reveal if user exists or not
    // Always return success message
    if (!user) {
      return {
        success: true,
        message: 'If an account exists with that email, a password reset link has been sent.',
      };
    }

    // Generate reset token (expires in 1 hour)
    const resetToken = generateResetToken();
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour

    // Save token to user
    await ctx.db.patch(user._id, {
      password_reset_token: resetToken,
      password_reset_expires_at: expiresAt,
      updated_at: Date.now(),
    });

    // Schedule password reset email
    await ctx.scheduler.runAfter(0, api.email.sendPasswordResetEmail, {
      email: user.email,
      name: user.name,
      resetToken,
    });

    return {
      success: true,
      message: 'If an account exists with that email, a password reset link has been sent.',
    };
  },
});

/**
 * Verify a password reset token
 * Check if token is valid and not expired
 */
export const verifyResetToken = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    // Find user with this reset token
    const user = await ctx.db
      .query('users')
      .withIndex('by_password_reset_token', (q) => q.eq('password_reset_token', args.token))
      .unique();

    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    // Check if token expired
    if (user.password_reset_expires_at && user.password_reset_expires_at < Date.now()) {
      throw new Error('Reset token has expired. Please request a new password reset.');
    }

    return {
      valid: true,
      email: user.email,
      name: user.name,
    };
  },
});

/**
 * Reset password using token
 * Note: Actual password change happens in Clerk
 * This clears the reset token after successful reset
 */
export const completePasswordReset = mutation({
  args: {
    token: v.string(),
    email: v.string(), // For verification
  },
  handler: async (ctx, args) => {
    // Find user with this reset token
    const user = await ctx.db
      .query('users')
      .withIndex('by_password_reset_token', (q) => q.eq('password_reset_token', args.token))
      .unique();

    if (!user) {
      throw new Error('Invalid reset token');
    }

    // Verify email matches
    if (user.email !== args.email) {
      throw new Error('Email mismatch');
    }

    // Check if token expired
    if (user.password_reset_expires_at && user.password_reset_expires_at < Date.now()) {
      throw new Error('Reset token has expired');
    }

    // Clear reset token
    await ctx.db.patch(user._id, {
      password_reset_token: undefined,
      password_reset_expires_at: undefined,
      updated_at: Date.now(),
    });

    return {
      success: true,
      message: 'Password reset completed successfully',
    };
  },
});

/**
 * Cancel a password reset request
 * Clears the reset token for a user
 */
export const cancelPasswordReset = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    // Clear reset token
    await ctx.db.patch(user._id, {
      password_reset_token: undefined,
      password_reset_expires_at: undefined,
      updated_at: Date.now(),
    });

    return {
      success: true,
      message: 'Password reset request cancelled',
    };
  },
});
