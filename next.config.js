/** @type {import('next').NextConfig} */
const nextConfig = {
  // ESLint is run separately in CI (npm run lint), so we skip it during build
  // to avoid duplicate linting and allow warnings in development
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      // Supabase storage (wildcard covers all Supabase instances - trusted CDN)
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      // UI Avatars (fallback avatars - restricted to API endpoint)
      {
        protocol: 'https',
        hostname: 'ui-avatars.com',
        pathname: '/api/**',
      },
      // Clerk profile images (img.clerk.com is the only official Clerk image CDN)
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
      // OAuth provider profile images (Google, GitHub, etc.)
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
      // Job listings (Adzuna)
      {
        protocol: 'https',
        hostname: '*.adzuna.com',
      },
      // Convex storage
      {
        protocol: 'https',
        hostname: '*.convex.cloud',
      },
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // NOTE: Do not expose server secrets via next.config.js `env`.
  // Use runtime environment variables and NEXT_PUBLIC_* for client-safe values.
}

module.exports = nextConfig
