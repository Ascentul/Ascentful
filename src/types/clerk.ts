/**
 * Type definitions for Clerk publicMetadata
 *
 * These types ensure type safety when accessing user metadata
 * throughout the application.
 */

/**
 * Valid user roles in the system
 */
import { UserRole } from '@/lib/constants/roles';

/**
 * Type definitions for Clerk publicMetadata
 *
 * These types ensure type safety when accessing user metadata
 * throughout the application.
 */

/**
 * Admin-granted subscription info (set by super admin, not Clerk Billing)
 */
export interface AdminGrantedSubscription {
  plan: 'premium_monthly';
  status: 'active' | 'inactive' | 'revoked';
  granted_by: string; // Clerk ID of admin who granted access
  granted_at: string; // ISO date string
  reason?: string;
}

/**
 * Billing metadata (can be set by Clerk Billing or admin grants)
 */
export interface BillingMetadata {
  plan?: 'premium_monthly';
  status?: 'active' | 'inactive' | 'cancelled' | 'past_due';
}

export interface ClerkPublicMetadata {
  role?: UserRole;
  university_id?: string; // Clerk stores as string, convert to Id<"universities"> when using with Convex
  admin_granted_subscription?: AdminGrantedSubscription; // Set by super admin for free pro access
  billing?: BillingMetadata; // Billing info (Clerk Billing or admin-set)
}
