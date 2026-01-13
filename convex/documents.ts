/**
 * Document upload and management functions for profile documents
 */

import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { getAuthenticatedUser } from './lib/authorization';

/**
 * Generate an upload URL for profile documents (resume, cover letters, etc.)
 * This allows the client to upload directly to Convex storage
 */
export const generateDocumentUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await getAuthenticatedUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Get a document's URL from its storage ID
 * This converts the permanent storage ID to a temporary URL for display/download
 * Requires authentication and verifies the document belongs to the requesting user
 */
export const getDocumentUrl = query({
  args: {
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);

    // Fetch full user record to access profile documents
    const user = await ctx.db.get(authUser._id);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify the document belongs to this user by checking their profile
    // Only 'upload' type documents have storage_id (discriminated union)
    const resume = user.profile_resume;
    const hasResumeWithId = resume?.type === 'upload' && resume.storage_id === args.storageId;
    const hasDocWithId = user.profile_documents?.some((doc) => {
      if (doc.type === 'upload') {
        return doc.storage_id === args.storageId;
      }
      return false;
    });

    if (!hasResumeWithId && !hasDocWithId) {
      throw new Error('Document not found or unauthorized');
    }

    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) {
      throw new Error('Document URL not available');
    }

    return url;
  },
});

/**
 * Delete a document from storage
 * Called when removing a document from profile
 */
export const deleteDocument = mutation({
  args: {
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);

    // Fetch full user record to access profile documents
    const user = await ctx.db.get(authUser._id);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify the document belongs to this user by checking their profile
    // Only 'upload' type documents have storage_id (discriminated union)
    const resume = user.profile_resume;
    const hasResumeWithId = resume?.type === 'upload' && resume.storage_id === args.storageId;
    const hasDocWithId = user.profile_documents?.some((doc) => {
      if (doc.type === 'upload') {
        return doc.storage_id === args.storageId;
      }
      return false;
    });

    if (!hasResumeWithId && !hasDocWithId) {
      throw new Error('Document not found or unauthorized');
    }

    await ctx.storage.delete(args.storageId);
    return { success: true };
  },
});
