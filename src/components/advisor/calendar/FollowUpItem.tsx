'use client';

import { Clock } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';

interface FollowUp {
  _id: string;
  student_id: string;
  student_name: string;
  title: string;
  priority: string;
  due_at?: number | null;
}

interface FollowUpItemProps {
  followUp: FollowUp;
  now: number;
  /** Route prefix for links (e.g., '/u' or '/advisor') */
  routePrefix?: string;
}

export function FollowUpItem({ followUp, now, routePrefix = '/advisor' }: FollowUpItemProps) {
  const isOverdue = followUp.due_at != null && followUp.due_at < now;

  return (
    <Link
      href={`${routePrefix}/students/${followUp.student_id}`}
      aria-label={
        isOverdue ? `Overdue follow-up: ${followUp.title}` : `Follow-up: ${followUp.title}`
      }
    >
      <div
        className={`p-3 border rounded-lg hover:bg-muted/50 cursor-pointer ${
          isOverdue ? 'border-red-300 bg-red-50' : 'border-orange-300 bg-orange-50'
        }`}
      >
        <div className="flex items-center gap-3">
          <Clock className={`h-5 w-5 ${isOverdue ? 'text-red-500' : 'text-orange-500'}`} />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div className="font-medium text-sm">{followUp.title}</div>
              <Badge variant={followUp.priority === 'urgent' ? 'destructive' : 'secondary'}>
                {followUp.priority}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">{followUp.student_name}</div>
          </div>
        </div>
      </div>
    </Link>
  );
}
