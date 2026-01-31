import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Info,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';

type AlertVariant = 'warning' | 'error' | 'info' | 'success';

interface AlertCardProps {
  variant: AlertVariant;
  title: string;
  count?: number;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

const variantConfig: Record<
  AlertVariant,
  { icon: LucideIcon; borderColor: string; bgColor: string; iconColor: string; titleColor: string }
> = {
  warning: {
    icon: AlertTriangle,
    borderColor: 'border-l-amber-500',
    bgColor: 'bg-amber-50',
    iconColor: 'text-amber-500',
    titleColor: 'text-amber-800',
  },
  error: {
    icon: AlertCircle,
    borderColor: 'border-l-red-500',
    bgColor: 'bg-red-50',
    iconColor: 'text-red-500',
    titleColor: 'text-red-800',
  },
  info: {
    icon: Info,
    borderColor: 'border-l-blue-500',
    bgColor: 'bg-blue-50',
    iconColor: 'text-blue-500',
    titleColor: 'text-blue-800',
  },
  success: {
    icon: CheckCircle,
    borderColor: 'border-l-green-500',
    bgColor: 'bg-green-50',
    iconColor: 'text-green-500',
    titleColor: 'text-green-800',
  },
};

export function AlertCard({
  variant,
  title,
  count,
  description,
  actionLabel = 'View',
  onAction,
  className,
}: AlertCardProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <div className={cn('rounded-lg border-l-4 p-4', config.borderColor, config.bgColor, className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Icon className={cn('h-5 w-5 mt-0.5 flex-shrink-0', config.iconColor)} />
          <div className="flex-1 min-w-0">
            <h4 className={cn('text-sm font-medium', config.titleColor)}>
              {title}
              {count !== undefined && <span className="ml-1.5 font-semibold">({count})</span>}
            </h4>
            {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
          </div>
        </div>
        {onAction && (
          <button
            onClick={onAction}
            className={cn(
              'flex items-center gap-1 text-sm font-medium flex-shrink-0',
              config.titleColor,
              'hover:underline',
            )}
          >
            {actionLabel}
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
