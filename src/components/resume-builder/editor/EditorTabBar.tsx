'use client';

import { CheckCircle, FileText, Palette } from 'lucide-react';

import { cn } from '@/lib/utils';

export type EditorTab = 'content' | 'style' | 'review';

interface EditorTabBarProps {
  activeTab: EditorTab;
  onChange: (tab: EditorTab) => void;
}

const TABS: { id: EditorTab; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: 'content', label: 'Content', Icon: FileText },
  { id: 'style', label: 'Style', Icon: Palette },
  { id: 'review', label: 'Review', Icon: CheckCircle },
];

export function EditorTabBar({ activeTab, onChange }: EditorTabBarProps) {
  return (
    <div className="flex items-center border-b border-slate-200 bg-white px-4">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === tab.id
              ? 'text-primary-600 border-primary-500'
              : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300',
          )}
        >
          <tab.Icon className="h-4 w-4" />
          {tab.label}
        </button>
      ))}
    </div>
  );
}
