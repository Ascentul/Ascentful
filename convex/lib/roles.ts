/**
 * @deprecated Use ./authorization.ts instead
 *
 * This file re-exports from authorization.ts for backward compatibility.
 * New code should import directly from './lib/authorization'.
 */

// Re-export everything from the unified authorization module
export {
  assertUniversityAccess,
  getAuthenticatedUser,
  isServiceRequest,
  requireAdvisor,
  requireMembership,
  requireSuperAdmin,
  requireUniversityAdmin,
} from './authorization';

// Backward compatibility aliases
export { assertAccountActive as checkAccountActive } from './authorization';

// Re-export requireUserAccess with original signature for backward compatibility
import type { GenericMutationCtx, GenericQueryCtx } from 'convex/server';
import type { DataModel, Id } from '../_generated/dataModel';

type QueryCtx = GenericQueryCtx<DataModel>;
type MutationCtx = GenericMutationCtx<DataModel>;

import { assertUserAccess, getAuthenticatedUser as getUser, type AuthUser } from './authorization';

/**
 * @deprecated Use assertUserAccess from authorization.ts instead
 *
 * Check if authenticated user can access another user's data
 * Kept for backward compatibility - accepts clerkId instead of userId
 */
export async function requireUserAccess(ctx: QueryCtx | MutationCtx, targetClerkId: string) {
  const authenticatedUser = await getUser(ctx);

  // Get target user by clerkId
  const targetUser = await ctx.db
    .query('users')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', targetClerkId))
    .unique();

  if (!targetUser) {
    throw new Error('Not found: Target user does not exist');
  }

  // Use the new assertUserAccess with the resolved user ID
  await assertUserAccess(ctx, authenticatedUser, targetUser._id);

  return authenticatedUser;
}
