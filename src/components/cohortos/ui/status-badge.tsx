import { CheckCircle } from 'lucide-react';

import { type Status, STATUS_CONFIG } from '@/lib/cohortos/types';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: Status;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusBadge({ status, size = 'md', className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const isPlaced = status === 'placed';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-0.5 text-xs',
        config.bgColor,
        config.color,
        className,
      )}
    >
      {isPlaced && (
        <CheckCircle className={cn('flex-shrink-0', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      )}
      {config.label}
    </span>
  );
}
