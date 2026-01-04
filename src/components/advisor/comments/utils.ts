/**
 * Shared utilities for the commenting system
 */

import type { GroupedReaction } from './types';

/**
 * Common reaction emojis
 */
export const REACTION_EMOJIS = ['👍', '👎', '❤️', '🎉', '🤔', '👀'];

/**
 * Group reactions by emoji for display
 */
export function groupReactions(
  reactions: Array<{ user_id: string; emoji: string; created_at: number }> | undefined,
  currentUserId: string,
): GroupedReaction[] {
  if (!reactions || reactions.length === 0) return [];

  const grouped = new Map<string, GroupedReaction>();

  for (const reaction of reactions) {
    const existing = grouped.get(reaction.emoji);
    if (existing) {
      existing.count++;
      existing.userIds.push(reaction.user_id);
      if (reaction.user_id === currentUserId) {
        existing.hasCurrentUser = true;
      }
    } else {
      grouped.set(reaction.emoji, {
        emoji: reaction.emoji,
        count: 1,
        userIds: [reaction.user_id],
        hasCurrentUser: reaction.user_id === currentUserId,
      });
    }
  }

  return Array.from(grouped.values());
}

/**
 * Get initials from name
 */
export function getInitials(name: string): string {
  if (!name.trim()) return '?';
  return name
    .split(' ')
    .filter((n) => n.length > 0)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
