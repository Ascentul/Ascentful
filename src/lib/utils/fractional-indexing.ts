/**
 * Fractional Indexing Utilities for Kanban Board Ordering
 *
 * Uses fractional indexing to efficiently insert items between others
 * without rewriting all neighbors. Initial values use integers (1000, 2000, 3000...)
 * and insertions calculate midpoints.
 */

export const SORT_ORDER_GAP = 1000;
export const MIN_SORT_ORDER_GAP = 0.0001;

/**
 * Calculate new sort_order for an item being inserted between two others.
 *
 * @param beforeOrder - sort_order of the item that will be above (lower value)
 * @param afterOrder - sort_order of the item that will be below (higher value)
 * @returns New sort_order value for the inserted item
 */
export function calculateSortOrder(
  beforeOrder: number | null | undefined,
  afterOrder: number | null | undefined,
): number {
  // Inserting into empty list or at the end of empty
  if (beforeOrder == null && afterOrder == null) {
    return SORT_ORDER_GAP;
  }

  // Inserting at the start (before first item)
  if (beforeOrder == null && afterOrder != null) {
    return afterOrder / 2;
  }

  // Inserting at the end (after last item)
  if (beforeOrder != null && afterOrder == null) {
    return beforeOrder + SORT_ORDER_GAP;
  }

  // Inserting between two items - use midpoint
  return (beforeOrder! + afterOrder!) / 2;
}

/**
 * Check if the gap between two sort_orders is too small and needs rebalancing.
 * When gaps become too small, floating point precision issues can occur.
 */
export function needsRebalance(
  beforeOrder: number | null | undefined,
  afterOrder: number | null | undefined,
): boolean {
  if (beforeOrder == null || afterOrder == null) {
    return false;
  }
  return Math.abs(afterOrder - beforeOrder) < MIN_SORT_ORDER_GAP;
}

/**
 * Generate initial sort_order values for a list of items.
 * Used for backfilling or rebalancing.
 *
 * @param count - Number of items to generate sort_orders for
 * @returns Array of sort_order values (1000, 2000, 3000, ...)
 */
export function generateInitialSortOrders(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i + 1) * SORT_ORDER_GAP);
}

/**
 * Get the neighbor sort_orders from a list of items for a drop position.
 *
 * @param items - Array of items with sort_order property
 * @param dropIndex - Index where the new item will be inserted
 * @returns Object with beforeOrder and afterOrder (null if at start/end)
 */
export function getNeighborSortOrders<T extends { sort_order?: number | null }>(
  items: T[],
  dropIndex: number,
): { beforeOrder: number | null; afterOrder: number | null } {
  const beforeItem = dropIndex > 0 ? items[dropIndex - 1] : null;
  const afterItem = dropIndex < items.length ? items[dropIndex] : null;

  return {
    beforeOrder: beforeItem?.sort_order ?? null,
    afterOrder: afterItem?.sort_order ?? null,
  };
}
