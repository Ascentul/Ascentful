/**
 * CORS utilities for Chrome extension API routes
 *
 * Restricts CORS to extension origins for defense in depth.
 * While endpoints require valid extension tokens, this prevents
 * cross-origin requests from malicious websites even if a token is stolen.
 */

/**
 * Get allowed extension origins from environment variables
 * Falls back to wildcard in development for easier testing
 */
function getAllowedOrigins(): string[] {
  const origins = [
    process.env.CHROME_EXTENSION_ORIGIN, // e.g., chrome-extension://abcdef123456
    process.env.FIREFOX_EXTENSION_ORIGIN, // e.g., moz-extension://uuid
  ].filter((origin): origin is string => Boolean(origin));

  // In development without configured origins, allow all (but log a warning)
  if (origins.length === 0) {
    if (process.env.NODE_ENV === 'development') {
      return ['*'];
    }
    // In production, fail securely by not allowing any origins
    console.error(
      '[extension-cors] SECURITY: No extension origins configured in production. Set CHROME_EXTENSION_ORIGIN and/or FIREFOX_EXTENSION_ORIGIN.',
    );
    return [];
  }

  return origins;
}

/**
 * Get CORS headers for extension API responses
 *
 * @param requestOrigin - The Origin header from the incoming request
 * @param methods - Allowed HTTP methods (default: 'GET, POST, OPTIONS')
 * @returns CORS headers object
 */
export function getExtensionCorsHeaders(
  requestOrigin: string | null,
  methods: string = 'GET, POST, OPTIONS',
): Record<string, string> {
  const allowedOrigins = getAllowedOrigins();

  // If wildcard is allowed (dev mode or misconfigured), use it
  if (allowedOrigins.includes('*')) {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': methods,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    };
  }

  // No origins configured - don't set CORS headers (fail closed)
  if (allowedOrigins.length === 0) {
    return {
      'Access-Control-Allow-Methods': methods,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    };
  }

  // Check if request origin is in allowed list
  const origin =
    requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0]; // Fallback to first allowed origin

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    // Required for credentialed requests from specific origins
    'Access-Control-Allow-Credentials': 'true',
  };
}

/**
 * Check if a request origin is allowed
 *
 * @param requestOrigin - The Origin header from the incoming request
 * @returns true if the origin is allowed
 */
export function isAllowedOrigin(requestOrigin: string | null): boolean {
  if (!requestOrigin) return false;

  const allowedOrigins = getAllowedOrigins();

  // Wildcard allows all
  if (allowedOrigins.includes('*')) return true;

  return allowedOrigins.includes(requestOrigin);
}
