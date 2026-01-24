/**
 * Convex actions for sending emails
 * Actions can call external services like Mailgun/SendGrid
 */

'use node';

import { v } from 'convex/values';

import { action } from './_generated/server';
import { sanitizeError } from './lib/piiSafe';
import { escapeHtml } from './lib/sanitizeHtml';

/**
 * Validates a URL is on the app's origin to prevent open redirect/phishing attacks.
 * Returns the validated URL if safe, or a fallback URL if the origin doesn't match.
 */
function validateAppUrl(url: string, fallbackPath: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.ascentful.io';

  try {
    const parsedUrl = new URL(url);
    const parsedAppUrl = new URL(appUrl);

    // Check if origins match (protocol + host)
    if (parsedUrl.origin === parsedAppUrl.origin) {
      return url;
    }

    // Origin doesn't match - use fallback
    console.warn(
      `[email] URL origin mismatch detected. Expected: ${parsedAppUrl.origin}, got: ${parsedUrl.origin}. Using fallback.`,
    );
    return `${appUrl}${fallbackPath}`;
  } catch {
    // Invalid URL - use fallback
    console.warn(`[email] Invalid URL provided: ${url}. Using fallback.`);
    return `${appUrl}${fallbackPath}`;
  }
}

/**
 * Sanitizes a string for use in email subject lines.
 * Strips newlines and control characters to prevent email header injection.
 */
function sanitizeSubject(input: string): string {
  return input.replace(/[\r\n\x00-\x1F\x7F]/g, ' ').trim();
}

/**
 * Send activation email to newly created user with magic link
 * This is an action because it calls external email service
 */
export const sendActivationEmail = action({
  args: {
    email: v.string(),
    name: v.string(),
    activationToken: v.string(),
  },
  handler: async (ctx, args) => {
    // Import email module (only available in actions, not mutations)
    const { sendActivationEmail: sendEmail } = await import('../src/lib/email');

    const activationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.ascentful.io'}/activate/${args.activationToken}`;

    try {
      const result = await sendEmail(args.email, args.name, activationUrl);

      return {
        success: true,
        messageId: result.id,
        message: 'Activation email sent successfully',
      };
    } catch (error) {
      // Sanitize error to avoid logging PII from email service response
      console.error('Failed to send activation email:', sanitizeError(error));

      // In development or when email service is not configured,
      // don't fail the user creation - just log the error
      const errorMessage = (error as Error).message;
      if (
        errorMessage.includes('No email service configured') ||
        errorMessage.includes('MAILGUN_SENDING_API_KEY') ||
        errorMessage.includes('SENDGRID_API_KEY')
      ) {
        console.warn('Email service not configured - user created but activation email not sent');
        return {
          success: false,
          messageId: null,
          message:
            'User created successfully, but activation email could not be sent (email service not configured)',
        };
      }

      // For other errors, still throw
      throw new Error('Failed to send activation email: ' + errorMessage);
    }
  },
});

/**
 * Send support ticket response email
 */
export const sendSupportTicketResponseEmail = action({
  args: {
    email: v.string(),
    name: v.string(),
    ticketSubject: v.string(),
    responseMessage: v.string(),
    ticketId: v.string(),
  },
  handler: async (ctx, args) => {
    const { sendSupportTicketResponseEmail: sendEmail } = await import('../src/lib/email');

    const ticketUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.ascentful.io'}/support/${args.ticketId}`;

    try {
      const result = await sendEmail(
        args.email,
        args.name,
        args.ticketSubject,
        args.responseMessage,
        ticketUrl,
      );

      return {
        success: true,
        messageId: result.id,
        message: 'Support ticket response email sent successfully',
      };
    } catch (error) {
      // Sanitize error to avoid logging PII from email service response
      console.error('Failed to send support ticket response email:', sanitizeError(error));
      // Return failure but don't throw - email is non-critical
      return {
        success: false,
        messageId: null,
        message: 'Email service not configured: ' + (error as Error).message,
      };
    }
  },
});

/**
 * Send welcome email to self-registered user
 */
export const sendWelcomeEmail = action({
  args: {
    email: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const { sendWelcomeEmail: sendEmail } = await import('../src/lib/email');

    try {
      const result = await sendEmail(args.email, args.name);

      return {
        success: true,
        messageId: result.id,
        message: 'Welcome email sent successfully',
      };
    } catch (error) {
      console.error('Failed to send welcome email:', sanitizeError(error));
      throw new Error('Failed to send welcome email. Please try again later.');
    }
  },
});

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = action({
  args: {
    email: v.string(),
    name: v.string(),
    resetToken: v.string(),
  },
  handler: async (ctx, args) => {
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.ascentful.io'}/reset-password/${args.resetToken}`;

    const subject = 'Reset Your Ascentul Password';
    const text = `Hello ${args.name},

We received a request to reset your password for your Ascentul account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request this password reset, you can safely ignore this email.

Best regards,
The Ascentul Team`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="https://xzi7cpcc4c.ufs.sh/f/jgOWCCH530yezbLhC1EM8wQTKjxNoftXCJYv6Emls0pb1qyI" alt="Ascentul" style="max-width: 100%; height: auto;">
        </div>

        <h1 style="color: #0C29AB; font-size: 24px; margin-bottom: 20px;">Reset Your Password</h1>

        <p>Hello ${args.name},</p>

        <p>We received a request to reset your password for your Ascentul account.</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}"
             style="background-color: #0C29AB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
            Reset Password
          </a>
        </div>

        <p style="font-size: 14px; color: #666;">
          This link will expire in <strong>1 hour</strong>.
        </p>

        <p style="font-size: 14px; color: #666;">
          If you didn't request this password reset, you can safely ignore this email.
        </p>

        <p>Best regards,<br>The Ascentul Team</p>

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center;">
          <p>© ${new Date().getFullYear()} Ascentul, Inc. All rights reserved.</p>
        </div>
      </div>
    `;

    try {
      const { sendEmail } = await import('../src/lib/email');
      const result = await sendEmail({
        to: args.email,
        subject,
        text,
        html,
      });

      return {
        success: true,
        messageId: result.id,
        message: 'Password reset email sent successfully',
      };
    } catch (error) {
      const sanitized = sanitizeError(error);
      console.error('Failed to send password reset email:', sanitized);
      throw new Error('Failed to send password reset email: ' + sanitized.message);
    }
  },
});

/**
 * Send university invitation email to student
 */
export const sendUniversityStudentInvitationEmail = action({
  args: {
    email: v.string(),
    name: v.string(),
    universityName: v.string(),
    activationToken: v.string(),
  },
  handler: async (ctx, args) => {
    const { sendUniversityInvitationEmail: sendEmail } = await import('../src/lib/email');

    const activationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.ascentful.io'}/activate/${args.activationToken}`;

    try {
      // sendUniversityInvitationEmail expects (email, universityName, inviteLink)
      const result = await sendEmail(args.email, args.universityName, activationUrl);

      return {
        success: true,
        messageId: result.id,
        message: 'University student invitation email sent successfully',
      };
    } catch (error) {
      console.error('Failed to send university student invitation email:', sanitizeError(error));
      return {
        success: false,
        messageId: null,
        message: 'Email service not configured: ' + (error as Error).message,
      };
    }
  },
});

/**
 * Send university invitation email to advisor
 */
export const sendUniversityAdvisorInvitationEmail = action({
  args: {
    email: v.string(),
    name: v.string(),
    universityName: v.string(),
    activationToken: v.string(),
  },
  handler: async (ctx, args) => {
    const { sendUniversityAdvisorInvitationEmail: sendEmail } = await import('../src/lib/email');

    const activationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.ascentful.io'}/activate/${args.activationToken}`;

    try {
      // sendUniversityAdvisorInvitationEmail expects (email, firstName, universityAdminName, role, inviteLink)
      const firstName = args.name.split(' ')[0] || args.name;
      const result = await sendEmail(
        args.email,
        firstName,
        'University Admin',
        'Advisor',
        activationUrl,
      );

      return {
        success: true,
        messageId: result.id,
        message: 'University advisor invitation email sent successfully',
      };
    } catch (error) {
      console.error('Failed to send university advisor invitation email:', sanitizeError(error));
      return {
        success: false,
        messageId: null,
        message: 'Email service not configured: ' + (error as Error).message,
      };
    }
  },
});

/**
 * Send university admin invitation email (from super admin)
 */
export const sendUniversityAdminInvitationEmail = action({
  args: {
    email: v.string(),
    name: v.string(),
    universityName: v.string(),
    activationToken: v.string(),
  },
  handler: async (ctx, args) => {
    const { sendSuperAdminUniversityInvitationEmail: sendEmail } = await import('../src/lib/email');

    const activationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.ascentful.io'}/activate/${args.activationToken}`;

    try {
      // sendSuperAdminUniversityInvitationEmail expects (email, firstName, universityName, inviteLink)
      const firstName = args.name.split(' ')[0] || args.name;
      const result = await sendEmail(args.email, firstName, args.universityName, activationUrl);

      return {
        success: true,
        messageId: result.id,
        message: 'University admin invitation email sent successfully',
      };
    } catch (error) {
      console.error('Failed to send university admin invitation email:', sanitizeError(error));
      return {
        success: false,
        messageId: null,
        message: 'Email service not configured: ' + (error as Error).message,
      };
    }
  },
});

/**
 * Send payment confirmation email to user after successful payment
 */
export const sendPaymentConfirmationEmail = action({
  args: {
    email: v.string(),
    name: v.string(),
    amount: v.number(),
    plan: v.string(),
  },
  handler: async (ctx, args) => {
    const { sendPaymentConfirmationEmail: sendEmail } = await import('../src/lib/email');

    try {
      const result = await sendEmail(args.email, args.name, args.amount, args.plan);

      return {
        success: true,
        messageId: result.id,
        message: 'Payment confirmation email sent successfully',
      };
    } catch (error) {
      console.error('Failed to send payment confirmation email:', sanitizeError(error));

      // Email is non-critical, don't fail the payment process
      const errorMessage = (error as Error).message;
      if (
        errorMessage.includes('No email service configured') ||
        errorMessage.includes('MAILGUN_SENDING_API_KEY') ||
        errorMessage.includes('SENDGRID_API_KEY')
      ) {
        console.warn(
          'Email service not configured - payment processed but confirmation email not sent',
        );
        return {
          success: false,
          messageId: null,
          message:
            'Payment confirmed, but confirmation email could not be sent (email service not configured)',
        };
      }

      // Return failure but don't throw - email is non-critical
      return {
        success: false,
        messageId: null,
        message: 'Email service error: ' + errorMessage,
      };
    }
  },
});

/**
 * Send review completion notification to student
 */
export const sendReviewCompletionEmail = action({
  args: {
    email: v.string(),
    studentName: v.string(),
    reviewType: v.string(),
    reviewUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const { sendReviewCompletionEmail: sendEmail } = await import('../src/lib/email');

    try {
      const result = await sendEmail(args.email, args.studentName, args.reviewType, args.reviewUrl);

      return {
        success: true,
        messageId: result.id,
        message: 'Review completion email sent successfully',
      };
    } catch (error) {
      console.error('Failed to send review completion email:', sanitizeError(error));

      // Email is non-critical, don't fail the review completion process
      const errorMessage = (error as Error).message;
      if (
        errorMessage.includes('No email service configured') ||
        errorMessage.includes('MAILGUN_SENDING_API_KEY') ||
        errorMessage.includes('SENDGRID_API_KEY')
      ) {
        console.warn(
          'Email service not configured - review completed but notification email not sent',
        );
        return {
          success: false,
          messageId: null,
          message:
            'Review completed, but notification email could not be sent (email service not configured)',
        };
      }

      // Return failure but don't throw - email is non-critical
      return {
        success: false,
        messageId: null,
        message: 'Email service error: ' + errorMessage,
      };
    }
  },
});

/**
 * Send urgent signal notification to advisor
 * Called when a high-priority or urgent signal is created for a student
 */
export const sendUrgentSignalNotificationEmail = action({
  args: {
    advisorEmail: v.string(),
    advisorName: v.string(),
    studentName: v.string(),
    signalTitle: v.string(),
    signalDescription: v.optional(v.string()),
    signalPriority: v.string(),
    signalType: v.string(),
    queueUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const { sendEmail } = await import('../src/lib/email');

    // Validate queueUrl is on app origin to prevent phishing/open-redirect attacks
    const validatedQueueUrl = validateAppUrl(args.queueUrl, '/advisor/queue');

    const priorityEmoji = args.signalPriority === 'urgent' ? '🚨' : '⚠️';
    const priorityLabelRaw =
      args.signalPriority.charAt(0).toUpperCase() + args.signalPriority.slice(1);
    const priorityLabel = escapeHtml(priorityLabelRaw);

    // Sanitize user-provided content to prevent email header injection
    const safeSubjectTitle = sanitizeSubject(args.signalTitle);
    const safeSubjectName = sanitizeSubject(args.studentName);
    const subject = `${priorityEmoji} ${priorityLabel} Signal: ${safeSubjectTitle} - ${safeSubjectName}`;

    const text = `Hello ${args.advisorName},

A ${args.signalPriority} priority signal has been triggered for one of your students.

Student: ${args.studentName}
Signal: ${args.signalTitle}
Priority: ${priorityLabel}
Type: ${args.signalType}
${args.signalDescription ? `\nDescription: ${args.signalDescription}` : ''}

Please review and take action:
${validatedQueueUrl}

Best regards,
The Ascentul Team`;

    // Escape user-provided content for defense-in-depth
    const safeAdvisorName = escapeHtml(args.advisorName);
    const safeStudentName = escapeHtml(args.studentName);
    const safeSignalTitle = escapeHtml(args.signalTitle);
    const safeSignalType = escapeHtml(args.signalType);
    const safeSignalDescription = args.signalDescription ? escapeHtml(args.signalDescription) : '';
    const safeQueueUrl = escapeHtml(validatedQueueUrl);

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="https://xzi7cpcc4c.ufs.sh/f/jgOWCCH530yezbLhC1EM8wQTKjxNoftXCJYv6Emls0pb1qyI" alt="Ascentul" style="max-width: 100%; height: auto;">
        </div>

        <div style="background-color: ${args.signalPriority === 'urgent' ? '#FEF2F2' : '#FEF9C3'}; border-left: 4px solid ${args.signalPriority === 'urgent' ? '#DC2626' : '#CA8A04'}; padding: 16px; margin-bottom: 20px; border-radius: 4px;">
          <h2 style="color: ${args.signalPriority === 'urgent' ? '#DC2626' : '#CA8A04'}; margin: 0 0 8px 0; font-size: 18px;">
            ${priorityEmoji} ${priorityLabel} Priority Signal
          </h2>
          <p style="margin: 0; font-size: 16px; font-weight: bold;">${safeSignalTitle}</p>
        </div>

        <p>Hello ${safeAdvisorName},</p>

        <p>A ${priorityLabel.toLowerCase()} priority signal requires your attention:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Student:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${safeStudentName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Signal:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${safeSignalTitle}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Priority:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
              <span style="background-color: ${args.signalPriority === 'urgent' ? '#DC2626' : '#CA8A04'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${priorityLabel}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Type:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${safeSignalType}</td>
          </tr>
          ${
            safeSignalDescription
              ? `
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Description:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${safeSignalDescription}</td>
          </tr>
          `
              : ''
          }
        </table>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${safeQueueUrl}"
             style="background-color: #0C29AB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
            View Signal Queue
          </a>
        </div>

        <p>Best regards,<br>The Ascentul Team</p>

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center;">
          <p>You are receiving this because you are an advisor for this student.</p>
          <p>© ${new Date().getFullYear()} Ascentul, Inc. All rights reserved.</p>
        </div>
      </div>
    `;

    try {
      const result = await sendEmail({
        to: args.advisorEmail,
        subject,
        text,
        html,
      });

      return {
        success: true,
        messageId: result.id,
        message: 'Urgent signal notification email sent successfully',
      };
    } catch (error) {
      console.error('Failed to send urgent signal notification email:', sanitizeError(error));

      const errorMessage = (error as Error).message;
      if (
        errorMessage.includes('No email service configured') ||
        errorMessage.includes('MAILGUN_SENDING_API_KEY') ||
        errorMessage.includes('SENDGRID_API_KEY')
      ) {
        console.warn(
          'Email service not configured - signal created but notification email not sent',
        );
        return {
          success: false,
          messageId: null,
          message:
            'Signal created, but notification email could not be sent (email service not configured)',
        };
      }

      return {
        success: false,
        messageId: null,
        message: 'Email service error: ' + errorMessage,
      };
    }
  },
});
