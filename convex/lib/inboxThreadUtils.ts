export type ThreadPriority = 'P1' | 'P2' | 'P3';

export function priorityRank(priority: ThreadPriority): number {
  switch (priority) {
    case 'P1':
      return 1;
    case 'P2':
      return 2;
    default:
      return 3;
  }
}

export function toDescTimestamp(ts: number): number {
  return -ts;
}
