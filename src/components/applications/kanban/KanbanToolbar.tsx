'use client';

import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';

interface KanbanToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

/**
 * Toolbar for the Kanban board with search functionality.
 * Can be extended with additional filters in the future.
 */
export function KanbanToolbar({ searchQuery, onSearchChange }: KanbanToolbarProps) {
  return (
    <div className="flex items-center gap-4 mb-6">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by company or role..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
    </div>
  );
}
