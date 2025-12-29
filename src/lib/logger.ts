/**
 * Structured Logger for FERPA/SOC 2 Compliant Logging
 *
 * This module provides a centralized logging utility with:
 * - Structured JSON output for log aggregation
 * - Correlation ID support for request tracing
 * - PII sanitization to prevent sensitive data leakage
 * - Environment-aware log levels
 *
 * ## Usage Example
 *
 * ```typescript
 * import { getCorrelationIdFromRequest, createRequestLogger, toErrorCode } from '@/lib/logger';
 *
 * export async function POST(request: NextRequest) {
 *   const correlationId = getCorrelationIdFromRequest(request);
 *   const log = createRequestLogger(correlationId, {
 *     feature: 'goal',
 *     httpMethod: 'POST',
 *     httpPath: '/api/goals',
 *   });
 *
 *   log.info('Request started', { event: 'request.start' });
 *
 *   try {
 *     // ... handler logic
 *     log.info('Request completed', { event: 'request.success' });
 *     return NextResponse.json(result, {
 *       headers: { 'x-correlation-id': correlationId }
 *     });
 *   } catch (error) {
 *     log.error('Request failed', toErrorCode(error), { event: 'request.error' });
 *     return NextResponse.json({ error: 'Internal error' }, { status: 500 });
 *   }
 * }
 * ```
 *
 * ## PII Safety Rules
 *
 * NEVER LOG:
 * - names, emails, phone, address, ssn
 * - resume text, cover letter content, chat messages
 * - tokens, API keys, secrets, passwords
 *
 * SAFE TO LOG:
 * - internal IDs (userId, clerkId, goalId, applicationId, resumeId, universityId)
 * - metadata (role, planType, status, stage)
 * - metrics (count, durationMs, tokenCount, timestamp)
 */

import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Log severity levels */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Numeric priority for level comparison */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** Application feature areas for log categorization */
export type LogFeature =
  | 'achievements'
  | 'admin'
  | 'advisor'
  | 'ai-coach'
  | 'application'
  | 'auth'
  | 'billing'
  | 'career-path'
  | 'cover-letter'
  | 'extension'
  | 'extension-auth'
  | 'file'
  | 'gdpr'
  | 'goal'
  | 'interview-practice'
  | 'resume'
  | 'support'
  | 'system'
  | 'university'
  | 'webhook';

/** Runtime environment */
export type Environment = 'development' | 'preview' | 'production';

/** User role for log context */
export type UserRole =
  | 'individual'
  | 'student'
  | 'advisor'
  | 'university_admin'
  | 'super_admin'
  | 'staff'
  | 'unknown';

/** Subscription plan for log context */
export type PlanType = 'free' | 'premium' | 'university' | 'unknown';

/** Log context - all fields are safe to log (no PII) */
export interface LogContext {
  /** Feature area being logged */
  feature: LogFeature;
  /** Event type (e.g., 'request.start', 'data.created') */
  event: string;

  // Request context (IDs only, never raw values)
  /** Correlation ID for request tracing */
  correlationId?: string;
  /** Request ID (if different from correlation ID) */
  requestId?: string;

  // User context (IDs and metadata only)
  /** Internal Convex user ID (safe to log) */
  userId?: string;
  /** Clerk user ID (safe to log) */
  clerkId?: string;
  /** User role */
  role?: UserRole;
  /** University ID for multi-tenancy */
  tenantId?: string;
  /** Subscription plan type */
  planType?: PlanType;

  // Operation context
  /** HTTP method */
  httpMethod?: string;
  /** HTTP path (without query params) */
  httpPath?: string;
  /** HTTP status code */
  httpStatus?: number;
  /** Operation duration in milliseconds */
  durationMs?: number;

  // Error context (safe fields only)
  /** Safe error code (e.g., 'USER_NOT_FOUND', 'UNAUTHORIZED') */
  errorCode?: string;
  /** Error type name (e.g., 'ValidationError', 'AuthError') */
  errorType?: string;

  /** Additional safe metadata - automatically sanitized */
  extra?: Record<string, unknown>;
}

/** Full log entry structure */
export interface LogEntry {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Log level */
  level: LogLevel;
  /** Human-readable message */
  message: string;
  /** Runtime environment */
  environment: Environment;
  /** Service name */
  service: string;
  /** App version if available */
  version?: string;
  /** Log context */
  context: LogContext;
}

// ============================================================================
// ENVIRONMENT DETECTION
// ============================================================================

/**
 * Detect current environment from environment variables.
 * Priority: VERCEL_ENV → NODE_ENV → 'development'
 */
export function getEnvironment(): Environment {
  // Vercel provides VERCEL_ENV automatically
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === 'production') return 'production';
  if (vercelEnv === 'preview') return 'preview';
  if (vercelEnv === 'development') return 'development';

  // Fallback to NODE_ENV
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === 'production') return 'production';
  if (nodeEnv === 'test') return 'development'; // Treat test as dev

  return 'development';
}

/**
 * Get minimum log level for current environment.
 * Production only logs info and above, dev/preview logs everything.
 */
function getMinLogLevel(): LogLevel {
  const env = getEnvironment();
  return env === 'production' ? 'info' : 'debug';
}

// ============================================================================
// PII SANITIZATION
// ============================================================================

/**
 * PII-unsafe field patterns to sanitize from extra data.
 * Fields matching these patterns will be redacted.
 */
const PII_PATTERNS = [
  'email',
  'mail',
  'name',
  'firstname',
  'lastname',
  'phone',
  'address',
  'ssn',
  'social',
  'password',
  'pwd',
  'token',
  'secret',
  'key',
  'auth',
  'credential',
  'resume',
  'cover',
  'letter',
  'message',
  'content',
  'text',
  'body',
  'bio',
  'notes',
  'description',
  'comment',
  'dob',
  'dateofbirth',
  'birthday',
];

/**
 * Recursively sanitize PII from extra context.
 * Redacts fields matching PII patterns and converts arrays to counts.
 *
 * @param obj - Object to sanitize
 * @returns Sanitized object safe for logging
 */
export function sanitizePII(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const isPIIField = PII_PATTERNS.some((pattern) => lowerKey.includes(pattern));

    if (isPIIField) {
      result[key] = '[REDACTED]';
    } else if (value === null || value === undefined) {
      result[key] = value;
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizePII(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      // Log array length, not contents (may contain PII)
      result[key] = `[Array:${value.length}]`;
    } else {
      result[key] = value;
    }
  }

  return result;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Map error to safe error code.
 * Never logs raw error.message as it may contain PII.
 *
 * @param error - Error to map
 * @returns Safe error code string
 */
export function toErrorCode(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('unauthorized') || message.includes('unauthenticated')) {
      return 'UNAUTHORIZED';
    }
    if (message.includes('not found')) return 'NOT_FOUND';
    if (message.includes('forbidden') || message.includes('access denied')) {
      return 'FORBIDDEN';
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return 'VALIDATION_ERROR';
    }
    if (message.includes('timeout')) return 'TIMEOUT';
    if (message.includes('rate limit')) return 'RATE_LIMITED';
    if (message.includes('conflict') || message.includes('duplicate')) {
      return 'CONFLICT';
    }
    if (message.includes('bad request')) return 'BAD_REQUEST';

    // Check error name/constructor
    if (error.name === 'ConvexError') return 'CONVEX_ERROR';
    if (error.name === 'ValidationError') return 'VALIDATION_ERROR';
    if (error.name === 'TypeError') return 'TYPE_ERROR';
    if (error.name === 'SyntaxError') return 'SYNTAX_ERROR';

    return 'INTERNAL_ERROR';
  }

  return 'UNKNOWN_ERROR';
}

/**
 * Extract error type from error object.
 *
 * @param error - Error to extract type from
 * @returns Error type name
 */
export function toErrorType(error: unknown): string {
  if (error instanceof Error) {
    return error.constructor.name;
  }
  return 'UnknownError';
}

// ============================================================================
// CORE LOGGING
// ============================================================================

/**
 * Main logging function - outputs single-line JSON.
 *
 * @param level - Log level
 * @param message - Human-readable message
 * @param context - Log context with feature, event, and metadata
 */
export function log(level: LogLevel, message: string, context: LogContext): void {
  const minLevel = getMinLogLevel();
  if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[minLevel]) {
    return;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    environment: getEnvironment(),
    service: typeof window === 'undefined' ? 'ascentul-api' : 'ascentul-client',
    version: process.env.NEXT_PUBLIC_APP_VERSION,
    context: {
      ...context,
      extra: context.extra ? sanitizePII(context.extra) : undefined,
    },
  };

  // Output as single-line JSON for log aggregation
  const jsonLine = JSON.stringify(entry);

  switch (level) {
    case 'error':
      console.error(jsonLine);
      break;
    case 'warn':
      console.warn(jsonLine);
      break;
    default:
      console.log(jsonLine);
  }
}

/** Convenience logger object with level methods */
export const logger = {
  debug: (message: string, context: LogContext) => log('debug', message, context),
  info: (message: string, context: LogContext) => log('info', message, context),
  warn: (message: string, context: LogContext) => log('warn', message, context),
  error: (message: string, context: LogContext) => log('error', message, context),
};

// ============================================================================
// REQUEST HELPERS
// ============================================================================

/**
 * Extract or generate correlation ID from request.
 * Checks x-correlation-id header first, generates UUID if missing.
 *
 * @param req - Next.js request object
 * @returns Correlation ID string
 */
export function getCorrelationIdFromRequest(req: NextRequest): string {
  return req.headers.get('x-correlation-id') || uuidv4();
}

/**
 * Generate a new correlation ID.
 * Use when no request context is available (e.g., background jobs).
 *
 * @returns New UUID correlation ID
 */
export function generateCorrelationId(): string {
  return uuidv4();
}

/** Request logger interface returned by createRequestLogger */
export interface RequestLogger {
  debug: (message: string, extra?: Partial<LogContext>) => void;
  info: (message: string, extra?: Partial<LogContext>) => void;
  warn: (message: string, extra?: Partial<LogContext>) => void;
  error: (message: string, errorCode?: string, extra?: Partial<LogContext>) => void;
}

/**
 * Create a bound logger for a specific request context.
 * Pre-fills correlation ID and base context for all log calls.
 *
 * @param correlationId - Correlation ID for the request
 * @param baseContext - Base context to include in all logs
 * @returns Bound request logger
 *
 * @example
 * ```typescript
 * const log = createRequestLogger(correlationId, {
 *   feature: 'goal',
 *   httpMethod: 'POST',
 *   httpPath: '/api/goals',
 * });
 *
 * log.info('Request started', { event: 'request.start' });
 * log.error('Request failed', 'VALIDATION_ERROR', { event: 'request.error' });
 * ```
 */
export function createRequestLogger(
  correlationId: string,
  baseContext: Partial<LogContext>,
): RequestLogger {
  const mergeContext = (extra?: Partial<LogContext>): LogContext => ({
    feature: 'system',
    event: 'unknown',
    ...baseContext,
    ...extra,
    correlationId,
  });

  return {
    debug: (message: string, extra?: Partial<LogContext>) =>
      logger.debug(message, mergeContext(extra)),

    info: (message: string, extra?: Partial<LogContext>) =>
      logger.info(message, mergeContext(extra)),

    warn: (message: string, extra?: Partial<LogContext>) =>
      logger.warn(message, mergeContext(extra)),

    error: (message: string, errorCode?: string, extra?: Partial<LogContext>) =>
      logger.error(message, {
        ...mergeContext(extra),
        errorCode,
      }),
  };
}

// ============================================================================
// CONVEX HELPERS
// ============================================================================

/**
 * Create a log context object for Convex functions.
 * Use this to pass context through handler logic.
 *
 * @param feature - Feature area
 * @param correlationId - Optional correlation ID from API route
 * @returns Log context object
 *
 * @example
 * ```typescript
 * // In Convex mutation handler
 * const logCtx = createConvexLogContext('goal', args.correlationId);
 * log('info', 'Creating goal', { ...logCtx, event: 'operation.start' });
 * ```
 */
export function createConvexLogContext(
  feature: LogFeature,
  correlationId?: string,
): Partial<LogContext> {
  return {
    feature,
    correlationId,
  };
}
