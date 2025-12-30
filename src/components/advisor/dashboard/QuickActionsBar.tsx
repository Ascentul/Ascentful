'use client';

/**
 * Quick Actions Bar
 *
 * A row of action buttons for common advisor tasks, providing quick access
 * to key workflows without navigating through menus.
 *
 * Business meaning: Reduces friction for high-frequency advisor tasks:
 * - Log session notes (documentation after meetings)
 * - Add follow-up tasks (action items from sessions)
 * - Create applications (help students track new opportunities)
 * - Update career goals (guide student direction)
 */

import { Briefcase, FileText, ListTodo, Plus, Target } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

interface QuickActionsBarProps {
  className?: string;
}

export function QuickActionsBar({ className }: QuickActionsBarProps) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-slate-500 mr-2">Quick actions:</span>

        <Button
          variant="outline"
          size="sm"
          asChild
          className="h-8 gap-1.5 text-slate-700 hover:text-slate-900 hover:bg-slate-100"
        >
          <Link href="/advisor/advising/sessions?action=new">
            <Plus className="h-3.5 w-3.5" />
            <FileText className="h-3.5 w-3.5" />
            Log Session
          </Link>
        </Button>

        <Button
          variant="outline"
          size="sm"
          asChild
          className="h-8 gap-1.5 text-slate-700 hover:text-slate-900 hover:bg-slate-100"
        >
          <Link href="/advisor/students">
            <ListTodo className="h-3.5 w-3.5" />
            View Students
          </Link>
        </Button>

        <Button
          variant="outline"
          size="sm"
          asChild
          className="h-8 gap-1.5 text-slate-700 hover:text-slate-900 hover:bg-slate-100"
        >
          <Link href="/advisor/applications">
            <Briefcase className="h-3.5 w-3.5" />
            View Applications
          </Link>
        </Button>

        <Button
          variant="outline"
          size="sm"
          asChild
          className="h-8 gap-1.5 text-slate-700 hover:text-slate-900 hover:bg-slate-100"
        >
          <Link href="/advisor/analytics">
            <Target className="h-3.5 w-3.5" />
            View Analytics
          </Link>
        </Button>
      </div>
    </div>
  );
}
