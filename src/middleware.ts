import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/onboarding(.*)',
  '/admin(.*)',
  '/university(.*)',
  '/advisor(.*)', // Advisor routes
  '/u', // Unified university workspace base
  '/u/(.*)', // Unified university workspace child routes
  '/student/advisor(.*)', // Student Advisor Hub routes
  '/account(.*)',
  '/goals(.*)',
  '/api/goals(.*)',
  '/applications(.*)',
  '/networking(.*)',
  '/contacts(.*)',
  '/career-coach(.*)',
  '/resumes(.*)',
  '/cover-letters(.*)',
  '/career-path(.*)',
  '/projects(.*)',
  '/achievements(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    const { userId, redirectToSignIn } = await auth();
    if (!userId) {
      return redirectToSignIn({ returnBackUrl: req.url });
    }

    // Role-based redirects are now handled in components to avoid middleware complexity
    // This ensures proper authentication without token parsing issues
  }
});

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/onboarding/:path*',
    '/admin/:path*',
    '/university/:path*',
    '/advisor/:path*', // Advisor routes
    '/u', // Unified university workspace base
    '/u/:path*', // Unified university workspace child routes
    '/student/advisor/:path*', // Student Advisor Hub routes
    '/account/:path*',
    '/goals/:path*',
    '/api/goals/:path*',
    '/applications/:path*',
    '/networking/:path*',
    '/contacts/:path*',
    '/career-coach/:path*',
    '/resumes/:path*',
    '/cover-letters/:path*',
    '/career-path/:path*',
    '/projects/:path*',
    '/achievements/:path*',
    // Ensure Clerk runs for API routes so auth() works in route handlers
    '/api/:path*',
  ],
};
