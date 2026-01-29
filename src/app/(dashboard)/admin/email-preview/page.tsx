'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { sanitizeUserHtml } from '@/lib/sanitize-html';

const SAMPLE_DATA = {
  email: 'student@university.edu',
  name: 'John Doe',
  firstName: 'John',
  universityName: 'Harvard University',
  inviteLink: 'https://app.ascentful.io/student-invite/abc123',
  activationUrl: 'https://app.ascentful.io/activate/xyz789',
  dashboardUrl: 'https://app.ascentful.io/dashboard',
  ticketSubject: 'Help with resume builder',
  responseMessage:
    'Hi John, thanks for reaching out! I can help you with the resume builder. Here are the steps...',
  ticketUrl: 'https://app.ascentful.io/support/ticket123',
  universityAdminName: 'Dr. Sarah Johnson',
  role: 'Career Advisor',
};

type EmailTemplate = {
  id: string;
  name: string;
  description: string;
  subject: string;
  getHtml: () => string;
};

const emailTemplates: EmailTemplate[] = [
  {
    id: 'activation',
    name: 'Account Activation',
    description: 'Admin creates a user account - user receives activation email',
    subject: 'Welcome to Ascentful - Activate Your Account',
    getHtml: () => `
      <div style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1f2937; line-height: 1.6;">
        <div style="background: linear-gradient(135deg, #5371FF 0%, #4158D0 100%); padding: 40px 20px; margin: -40px -20px 30px -20px; text-align: center; border-radius: 0;">
          <h1 style="color: #FFFFFF; font-size: 52px; margin: 0; font-weight: 700; letter-spacing: -0.5px; line-height: 1; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Ascentful</h1>
          <p style="color: rgba(255, 255, 255, 0.9); font-size: 14px; margin: 8px 0 0 0; font-weight: 600; line-height: 1.2; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Retention-first career development for universities</p>
        </div>
        <div style="text-align: center; margin-bottom: 30px; margin-top: 30px;">
          <h1 style="color: #000000; font-size: 28px; margin: 0;">Welcome to Ascentful!</h1>
        </div>

        <p style="font-size: 16px; margin-bottom: 24px;">Hi ${SAMPLE_DATA.firstName},</p>

        <p style="font-size: 16px; margin-bottom: 24px;">Your Ascentful account has been created by your university administrator. To get started, please activate your account and set your password.</p>

        <div style="background-color: #F5F7FF; border-left: 4px solid #5371FF; padding: 20px; margin: 24px 0; border-radius: 4px;">
          <p style="margin: 0; font-size: 15px;"><strong>Your login email:</strong></p>
          <p style="margin: 8px 0 0 0; font-size: 16px; color: #5371FF; font-weight: 600;">${SAMPLE_DATA.email}</p>
        </div>

        <div style="text-align: center; margin: 40px 0;">
          <a href="${SAMPLE_DATA.activationUrl}"
             style="background-color: #5371FF;
                    color: white;
                    padding: 14px 32px;
                    text-decoration: none;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 16px;
                    display: inline-block;
                    box-shadow: 0 4px 6px rgba(83, 113, 255, 0.2);">
            Activate Account & Set Password
          </a>
        </div>

        <div style="background-color: #F9FAFB; padding: 20px; margin: 24px 0; border-radius: 8px;">
          <p style="margin: 0 0 12px 0; font-weight: 600; color: #374151;">What happens next:</p>
          <ul style="margin: 0; padding-left: 20px; color: #6b7280;">
            <li style="margin-bottom: 8px;">Click the activation button above</li>
            <li style="margin-bottom: 8px;">Create your own secure password</li>
            <li style="margin-bottom: 8px;">Complete your profile setup</li>
            <li>Start using all career development tools</li>
          </ul>
        </div>

        <p style="font-size: 14px; color: #6b7280; margin-bottom: 24px; padding: 12px; background-color: #fef3c7; border-radius: 4px; border-left: 3px solid #f59e0b;">
          ⏰ <strong>Important:</strong> This activation link expires in 24 hours. Please activate your account soon.
        </p>

        <p style="font-size: 15px; color: #6b7280; margin-bottom: 24px;">
          After activation, you can log in anytime at <a href="https://app.ascentful.io" style="color: #5371FF; text-decoration: none; font-weight: 600;">https://app.ascentful.io</a>
        </p>

        <p style="font-size: 15px; color: #6b7280; margin-bottom: 24px;">
          If you did not expect this email or have questions, please contact your university administrator or our support team at <a href="mailto:support@ascentful.io" style="color: #5371FF; text-decoration: none;">support@ascentful.io</a>
        </p>

        <p style="font-size: 16px; margin-top: 32px; margin-bottom: 8px;">
          Welcome to Ascentful. We're excited to support your career journey!
        </p>

        <p style="font-size: 16px; margin-top: 24px;">
          Best,<br>
          <strong>The Ascentful Team</strong>
        </p>

        <div style="margin-top: 50px; padding-top: 25px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center;">
          <p>© ${new Date().getFullYear()} Ascentful, Inc. All rights reserved.</p>
          <p style="margin-top: 10px;">
            <a href="https://ascentful.io/privacy" style="color: #6b7280; text-decoration: none; margin: 0 12px;">Privacy Policy</a> |
            <a href="https://ascentful.io/terms" style="color: #6b7280; text-decoration: none; margin: 0 12px;">Terms of Service</a> |
            <a href="mailto:support@ascentful.io" style="color: #6b7280; text-decoration: none; margin: 0 12px;">Support</a>
          </p>
        </div>
      </div>
    `,
  },
  {
    id: 'university-student-invitation',
    name: 'University Student Invitation',
    description: 'University admin invites a student',
    subject: `You're Invited to Join ${SAMPLE_DATA.universityName} on Ascentful 🎓`,
    getHtml: () => `
      <div style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1f2937; line-height: 1.6;">
        <div style="background: linear-gradient(135deg, #5371FF 0%, #4158D0 100%); padding: 40px 20px; margin: -40px -20px 30px -20px; text-align: center; border-radius: 0;">
          <h1 style="color: #FFFFFF; font-size: 52px; margin: 0; font-weight: 700; letter-spacing: -0.5px; line-height: 1; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Ascentful</h1>
          <p style="color: rgba(255, 255, 255, 0.9); font-size: 14px; margin: 8px 0 0 0; font-weight: 600; line-height: 1.2; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Retention-first career development for universities</p>
        </div>
        <div style="text-align: center; margin-bottom: 30px; margin-top: 30px;">
          <h1 style="color: #000000; font-size: 28px; margin: 0;">You're Invited!</h1>
        </div>

        <p style="font-size: 16px; margin-bottom: 24px;">Hi ${SAMPLE_DATA.firstName},</p>

        <p style="font-size: 16px; margin-bottom: 24px;"><strong>${SAMPLE_DATA.universityName}</strong> has partnered with <strong>Ascentful</strong>, a comprehensive career development platform designed to help you plan your career, track your goals, and land your next opportunity.</p>

        <div style="background-color: #F5F7FF; border-left: 4px solid #5371FF; padding: 20px; margin: 24px 0; border-radius: 4px;">
          <p style="margin: 0 0 8px 0; font-size: 15px;">You've been invited to join using this email:</p>
          <p style="margin: 0; font-size: 16px; color: #5371FF; font-weight: 600;">${SAMPLE_DATA.email}</p>
          <p style="margin: 12px 0 0 0; font-size: 14px; color: #6b7280;">Your university has provided you with <strong>complimentary access to all premium features</strong>.</p>
        </div>

        <div style="text-align: center; margin: 40px 0;">
          <a href="${SAMPLE_DATA.inviteLink}"
             style="background-color: #5371FF;
                    color: white;
                    padding: 14px 32px;
                    text-decoration: none;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 16px;
                    display: inline-block;
                    box-shadow: 0 4px 6px rgba(83, 113, 255, 0.2);">
            Activate Your Account →
          </a>
        </div>

        <div style="background-color: #F9FAFB; padding: 20px; margin: 24px 0; border-radius: 8px;">
          <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #000000;">What You'll Have Access To</h3>
          <ul style="margin: 0; padding-left: 20px; color: #6b7280; line-height: 1.8;">
            <li style="margin-bottom: 8px;">AI-powered resume and cover letter builder</li>
            <li style="margin-bottom: 8px;">Personalized career path guidance and goal tracking</li>
            <li style="margin-bottom: 8px;">Job search, application tracking, and interview prep</li>
            <li style="margin-bottom: 8px;">Smart networking tools to manage professional connections</li>
            <li style="margin-bottom: 8px;">On-demand AI career coaching and progress insights</li>
          </ul>
        </div>

        <p style="font-size: 15px; color: #6b7280; margin-bottom: 24px;">
          If you have any questions, please contact <strong>${SAMPLE_DATA.universityName}</strong>'s Career Services Department or reach out to our team at
          <a href="mailto:support@ascentful.io" style="color: #5371FF; text-decoration: none; font-weight: 600;">support@ascentful.io</a>.
        </p>

        <p style="font-size: 16px; margin-top: 32px;">
          We're excited to support your career journey!
        </p>

        <p style="font-size: 16px; margin-top: 24px;">
          Warm regards,<br>
          <strong>The Ascentful Team</strong><br>
          <a href="https://www.ascentful.io" style="color: #5371FF; text-decoration: none;">www.ascentful.io</a>
        </p>

        <div style="margin-top: 50px; padding-top: 25px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center;">
          <p>© ${new Date().getFullYear()} Ascentful, Inc. All rights reserved.</p>
          <p style="margin-top: 10px;">
            <a href="https://ascentful.io/privacy" style="color: #6b7280; text-decoration: none; margin: 0 12px;">Privacy Policy</a> |
            <a href="https://ascentful.io/terms" style="color: #6b7280; text-decoration: none; margin: 0 12px;">Terms of Service</a> |
            <a href="mailto:support@ascentful.io" style="color: #6b7280; text-decoration: none; margin: 0 12px;">Support</a>
          </p>
        </div>
      </div>
    `,
  },
  {
    id: 'university-advisor-invitation',
    name: 'University Advisor Invitation',
    description: 'University admin invites an advisor',
    subject: "You've Been Invited to Join Ascentful's Team",
    getHtml: () => `
      <div style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1f2937; line-height: 1.6;">
        <div style="background: linear-gradient(135deg, #5371FF 0%, #4158D0 100%); padding: 40px 20px; margin: -40px -20px 30px -20px; text-align: center; border-radius: 0;">
          <h1 style="color: #FFFFFF; font-size: 52px; margin: 0; font-weight: 700; letter-spacing: -0.5px; line-height: 1; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Ascentful</h1>
          <p style="color: rgba(255, 255, 255, 0.9); font-size: 14px; margin: 8px 0 0 0; font-weight: 600; line-height: 1.2; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Retention-first career development for universities</p>
        </div>
        <div style="text-align: center; margin-bottom: 30px; margin-top: 30px;">
          <h1 style="color: #000000; font-size: 28px; margin: 0;">You've Been Invited!</h1>
        </div>

        <p style="font-size: 16px; margin-bottom: 24px;">Hi ${SAMPLE_DATA.firstName},</p>

        <p style="font-size: 16px; margin-bottom: 24px;"><strong>${SAMPLE_DATA.universityAdminName}</strong> has invited you to join <strong>Ascentful</strong>, your university's career development and advising platform.</p>

        <div style="background-color: #F5F7FF; border-left: 4px solid #5371FF; padding: 20px; margin: 24px 0; border-radius: 4px;">
          <p style="margin: 0 0 8px 0; font-size: 15px;">You've been invited using this email:</p>
          <p style="margin: 0; font-size: 16px; color: #5371FF; font-weight: 600;">${SAMPLE_DATA.email}</p>
          <p style="margin: 12px 0 0 0; font-size: 14px; color: #6b7280;">Your account will have <strong>${SAMPLE_DATA.role}</strong> access, allowing you to collaborate with students and manage university data.</p>
        </div>

        <div style="text-align: center; margin: 40px 0;">
          <a href="${SAMPLE_DATA.inviteLink}"
             style="background-color: #5371FF;
                    color: white;
                    padding: 14px 32px;
                    text-decoration: none;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 16px;
                    display: inline-block;
                    box-shadow: 0 4px 6px rgba(83, 113, 255, 0.2);">
            Activate Your Account →
          </a>
        </div>

        <div style="background-color: #F9FAFB; padding: 20px; margin: 24px 0; border-radius: 8px;">
          <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #000000;">What You'll Be Able To Do</h3>
          <ul style="margin: 0; padding-left: 20px; color: #6b7280; line-height: 1.8;">
            <li style="margin-bottom: 8px;">View and track student progress across career goals and applications</li>
            <li style="margin-bottom: 8px;">Leave advising notes and collaborate on student profiles</li>
            <li style="margin-bottom: 8px;">Manage departments, programs, and student licenses</li>
            <li style="margin-bottom: 8px;">Access dashboards showing engagement and outcomes</li>
          </ul>
        </div>

        <p style="font-size: 15px; color: #6b7280; margin-bottom: 24px;">
          If you have any questions, please contact <strong>${SAMPLE_DATA.universityAdminName}</strong> or reach us at
          <a href="mailto:support@ascentful.io" style="color: #5371FF; text-decoration: none; font-weight: 600;">support@ascentful.io</a>.
        </p>

        <p style="font-size: 16px; margin-top: 32px;">
          Welcome aboard,<br>
          <strong>The Ascentful Team</strong>
        </p>

        <div style="margin-top: 50px; padding-top: 25px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center;">
          <p>© ${new Date().getFullYear()} Ascentful, Inc. All rights reserved.</p>
          <p style="margin-top: 10px;">
            <a href="https://ascentful.io/privacy" style="color: #6b7280; text-decoration: none; margin: 0 12px;">Privacy Policy</a> |
            <a href="https://ascentful.io/terms" style="color: #6b7280; text-decoration: none; margin: 0 12px;">Terms of Service</a> |
            <a href="mailto:support@ascentful.io" style="color: #6b7280; text-decoration: none; margin: 0 12px;">Support</a>
          </p>
        </div>
      </div>
    `,
  },
  {
    id: 'super-admin-university-invitation',
    name: 'Super Admin University Invitation',
    description: 'Super admin invites a university admin',
    subject: 'Your University Has Been Added to Ascentful - Set Up Your Admin Account',
    getHtml: () => `
      <div style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1f2937; line-height: 1.6;">
        <div style="background: linear-gradient(135deg, #5371FF 0%, #4158D0 100%); padding: 40px 20px; margin: -40px -20px 30px -20px; text-align: center; border-radius: 0;">
          <h1 style="color: #FFFFFF; font-size: 52px; margin: 0; font-weight: 700; letter-spacing: -0.5px; line-height: 1; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Ascentful</h1>
          <p style="color: rgba(255, 255, 255, 0.9); font-size: 14px; margin: 8px 0 0 0; font-weight: 600; line-height: 1.2; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Retention-first career development for universities</p>
        </div>
        <div style="text-align: center; margin-bottom: 30px; margin-top: 30px;">
          <h1 style="color: #000000; font-size: 28px; margin: 0;">Welcome to Ascentful!</h1>
        </div>

        <p style="font-size: 16px; margin-bottom: 24px;">Hi ${SAMPLE_DATA.firstName},</p>

        <p style="font-size: 16px; margin-bottom: 24px;">You've been invited to create an Admin account for <strong>${SAMPLE_DATA.universityName}</strong>, giving you full access to your institution's dashboard, student management tools, and analytics.</p>

        <div style="background-color: #F5F7FF; border-left: 4px solid #5371FF; padding: 20px; margin: 24px 0; border-radius: 4px;">
          <p style="margin: 0 0 8px 0; font-size: 15px;">You've been invited using this email:</p>
          <p style="margin: 0; font-size: 16px; color: #5371FF; font-weight: 600;">${SAMPLE_DATA.email}</p>
        </div>

        <div style="text-align: center; margin: 40px 0;">
          <a href="${SAMPLE_DATA.inviteLink}"
             style="background-color: #5371FF;
                    color: white;
                    padding: 14px 32px;
                    text-decoration: none;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 16px;
                    display: inline-block;
                    box-shadow: 0 4px 6px rgba(83, 113, 255, 0.2);">
            Set Up My Admin Account →
          </a>
        </div>

        <div style="background-color: #F9FAFB; padding: 20px; margin: 24px 0; border-radius: 8px;">
          <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #000000;">With Your Admin Access, You Can:</h3>
          <ul style="margin: 0; padding-left: 20px; color: #6b7280; line-height: 1.8;">
            <li style="margin-bottom: 8px;">Add students, advisors, and department admins</li>
            <li style="margin-bottom: 8px;">Manage user licenses and invitations</li>
            <li style="margin-bottom: 8px;">Configure university programs and departments</li>
            <li style="margin-bottom: 8px;">Review analytics on student engagement and outcomes</li>
          </ul>
        </div>

        <p style="font-size: 15px; color: #6b7280; margin-bottom: 24px;">
          If you have any questions or need help getting started, contact your onboarding manager or reach out to
          <a href="mailto:support@ascentful.io" style="color: #5371FF; text-decoration: none; font-weight: 600;">support@ascentful.io</a>.
        </p>

        <p style="font-size: 16px; margin-top: 32px;">
          Welcome to Ascentful,<br>
          <strong>The Ascentful Partnerships Team</strong>
        </p>

        <div style="margin-top: 50px; padding-top: 25px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center;">
          <p>© ${new Date().getFullYear()} Ascentful, Inc. All rights reserved.</p>
          <p style="margin-top: 10px;">
            <a href="https://ascentful.io/privacy" style="color: #6b7280; text-decoration: none; margin: 0 12px;">Privacy Policy</a> |
            <a href="https://ascentful.io/terms" style="color: #6b7280; text-decoration: none; margin: 0 12px;">Terms of Service</a> |
            <a href="mailto:support@ascentful.io" style="color: #6b7280; text-decoration: none; margin: 0 12px;">Support</a>
          </p>
        </div>
      </div>
    `,
  },
  {
    id: 'welcome',
    name: 'Welcome Email',
    description: 'Self-registered user welcome email',
    subject: "Welcome to Ascentful - Let's Build Your Career OS 🚀",
    getHtml: () => `
      <div style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1f2937; line-height: 1.6;">
        <div style="background: linear-gradient(135deg, #5371FF 0%, #4158D0 100%); padding: 40px 20px; margin: -40px -20px 30px -20px; text-align: center; border-radius: 0;">
          <h1 style="color: #FFFFFF; font-size: 52px; margin: 0; font-weight: 700; letter-spacing: -0.5px; line-height: 1; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Ascentful</h1>
          <p style="color: rgba(255, 255, 255, 0.9); font-size: 14px; margin: 8px 0 0 0; font-weight: 600; line-height: 1.2; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Retention-first career development for universities</p>
        </div>
        <div style="text-align: center; margin-bottom: 30px; margin-top: 30px;">
          <h1 style="color: #000000; font-size: 28px; margin: 0;">Welcome to Ascentful 🚀</h1>
        </div>

        <p style="font-size: 16px; margin-bottom: 24px;">Hi ${SAMPLE_DATA.firstName},</p>

        <p style="font-size: 16px; margin-bottom: 24px;">Welcome to <strong>Ascentful</strong>, the Career OS that helps you plan your path, track progress, and move confidently toward your next role.</p>

        <div style="background-color: #F5F7FF; border-left: 4px solid #5371FF; padding: 20px; margin: 24px 0; border-radius: 4px;">
          <p style="margin: 0; font-size: 15px;">You've created your account using:</p>
          <p style="margin: 8px 0 0 0; font-size: 16px; color: #5371FF; font-weight: 600;">${SAMPLE_DATA.email}</p>
        </div>

        <div style="text-align: center; margin: 40px 0;">
          <a href="${SAMPLE_DATA.dashboardUrl}"
             style="background-color: #5371FF;
                    color: white;
                    padding: 14px 32px;
                    text-decoration: none;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 16px;
                    display: inline-block;
                    box-shadow: 0 4px 6px rgba(83, 113, 255, 0.2);">
            Start Building Your Career OS →
          </a>
        </div>

        <div style="background-color: #F9FAFB; padding: 20px; margin: 24px 0; border-radius: 8px;">
          <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #000000;">What You Can Do Today</h3>
          <ul style="margin: 0; padding-left: 20px; color: #6b7280; line-height: 1.8;">
            <li style="margin-bottom: 12px;">Track your full interview process, from application to offer, and schedule timely follow-ups</li>
            <li style="margin-bottom: 12px;">Set and manage career goals, explore potential paths, compare average salaries, and learn the exact steps to reach your target roles</li>
            <li style="margin-bottom: 12px;">Create AI-tailored resumes and cover letters for every job you apply to</li>
            <li style="margin-bottom: 12px;">Get personalized support and insights from your AI Career Coach whenever you need direction</li>
            <li style="margin-bottom: 12px;">See your next best action automatically based on your current progress and goals</li>
            <li style="margin-bottom: 12px;">Organize your projects, achievements, and contacts in one place for quick access and portfolio use</li>
          </ul>
        </div>

        <p style="font-size: 15px; color: #6b7280; margin-bottom: 24px;">
          Need help getting started? Reach out to <a href="mailto:support@ascentful.io" style="color: #5371FF; text-decoration: none; font-weight: 600;">support@ascentful.io</a>.
        </p>

        <p style="font-size: 16px; margin-top: 32px;">
          We're thrilled to have you on board,<br>
          <strong>The Ascentful Team</strong>
        </p>

        <div style="margin-top: 50px; padding-top: 25px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center;">
          <p>© ${new Date().getFullYear()} Ascentful, Inc. All rights reserved.</p>
          <p style="margin-top: 10px;">
            <a href="https://ascentful.io/privacy" style="color: #6b7280; text-decoration: none; margin: 0 12px;">Privacy Policy</a> |
            <a href="https://ascentful.io/terms" style="color: #6b7280; text-decoration: none; margin: 0 12px;">Terms of Service</a> |
            <a href="mailto:support@ascentful.io" style="color: #6b7280; text-decoration: none; margin: 0 12px;">Support</a>
          </p>
        </div>
      </div>
    `,
  },
  {
    id: 'support-ticket-response',
    name: 'Support Ticket Response',
    description: 'Admin responds to a support ticket',
    subject: `Re: ${SAMPLE_DATA.ticketSubject}`,
    getHtml: () => `
      <div style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1f2937; line-height: 1.6;">
        <div style="background: linear-gradient(135deg, #5371FF 0%, #4158D0 100%); padding: 40px 20px; margin: -40px -20px 30px -20px; text-align: center; border-radius: 0;">
          <h1 style="color: #FFFFFF; font-size: 52px; margin: 0; font-weight: 700; letter-spacing: -0.5px; line-height: 1; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Ascentful</h1>
          <p style="color: rgba(255, 255, 255, 0.9); font-size: 14px; margin: 8px 0 0 0; font-weight: 600; line-height: 1.2; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Retention-first career development for universities</p>
        </div>
        <div style="text-align: center; margin-bottom: 30px; margin-top: 30px;">
          <h1 style="color: #000000; font-size: 24px; margin: 0;">Support Ticket Update</h1>
        </div>

        <p style="font-size: 16px; margin-bottom: 24px;">Hi ${SAMPLE_DATA.firstName},</p>

        <p style="font-size: 16px; margin-bottom: 24px;">You have received a new response to your support ticket:</p>

        <div style="background-color: #F5F7FF; border-left: 4px solid #5371FF; padding: 16px; margin: 24px 0; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px; color: #6b7280;"><strong>Ticket:</strong></p>
          <p style="margin: 8px 0 0 0; font-size: 16px; color: #5371FF; font-weight: 600;">${SAMPLE_DATA.ticketSubject}</p>
        </div>

        <div style="background-color: #F9FAFB; padding: 20px; margin: 24px 0; border-radius: 8px;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280; font-weight: 600;">Response:</p>
          <p style="margin: 0; font-size: 15px; color: #374151; white-space: pre-wrap;">${SAMPLE_DATA.responseMessage}</p>
        </div>

        <div style="text-align: center; margin: 40px 0;">
          <a href="${SAMPLE_DATA.ticketUrl}"
             style="background-color: #5371FF;
                    color: white;
                    padding: 14px 32px;
                    text-decoration: none;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 16px;
                    display: inline-block;
                    box-shadow: 0 4px 6px rgba(83, 113, 255, 0.2);">
            View Full Conversation
          </a>
        </div>

        <p style="font-size: 15px; color: #6b7280; margin-bottom: 24px;">
          If you have any further questions, please respond through the support portal.
        </p>

        <p style="font-size: 16px; margin-top: 32px;">
          Best regards,<br>
          <strong>The Ascentful Support Team</strong>
        </p>

        <div style="margin-top: 50px; padding-top: 25px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center;">
          <p>© ${new Date().getFullYear()} Ascentful, Inc. All rights reserved.</p>
          <p style="margin-top: 10px;">
            <a href="https://ascentful.io/privacy" style="color: #6b7280; text-decoration: none; margin: 0 12px;">Privacy Policy</a> |
            <a href="https://ascentful.io/terms" style="color: #6b7280; text-decoration: none; margin: 0 12px;">Terms of Service</a> |
            <a href="mailto:support@ascentful.io" style="color: #6b7280; text-decoration: none; margin: 0 12px;">Support</a>
          </p>
        </div>
      </div>
    `,
  },
];

export default function EmailPreviewPage() {
  const { user } = useAuth();
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate>(emailTemplates[0]);

  // Authorization check - only super admins can access email templates
  if (user?.role !== 'super_admin') {
    return (
      <div className="space-y-4">
        <PageHeader title="Unauthorized" description="Access Denied" />
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-2">Super Admin Access Required</h2>
          <p className="text-muted-foreground">
            Only Super Admins can access the Email Template Preview page.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Email Template Preview"
        description="Preview all email templates sent by the platform"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        {/* Template Selector */}
        <div className="lg:col-span-1">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Email Templates</h2>
            <div className="space-y-2">
              {emailTemplates.map((template) => (
                <Button
                  key={template.id}
                  variant={selectedTemplate.id === template.id ? 'default' : 'outline'}
                  className="w-full justify-start text-left h-auto py-3 px-4 whitespace-normal"
                  onClick={() => setSelectedTemplate(template)}
                >
                  <div className="w-full">
                    <div className="font-medium break-words">{template.name}</div>
                    <div
                      className={`text-xs mt-1 break-words ${
                        selectedTemplate.id === template.id ? 'text-white/80' : 'text-neutral-500'
                      }`}
                    >
                      {template.description}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </Card>
        </div>

        {/* Email Preview */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold mb-2">{selectedTemplate.name}</h2>
              <div className="text-sm text-neutral-600 mb-4">
                <strong>Subject:</strong> {selectedTemplate.subject}
              </div>
            </div>

            {/* Email Preview */}
            <div className="border rounded-lg overflow-hidden bg-white">
              {/* Sanitize as a defense-in-depth against injected HTML */}
              <div
                className="p-4"
                dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(selectedTemplate.getHtml()) }}
              />
            </div>

            {/* View HTML Button */}
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  const blob = new Blob([selectedTemplate.getHtml()], {
                    type: 'text/html',
                  });
                  const url = URL.createObjectURL(blob);
                  window.open(url, '_blank');
                  // Revoke the URL after a short delay to allow the browser to load it
                  setTimeout(() => URL.revokeObjectURL(url), 100);
                }}
              >
                Open in New Tab
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(selectedTemplate.getHtml());
                  alert('HTML copied to clipboard!');
                }}
              >
                Copy HTML
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
