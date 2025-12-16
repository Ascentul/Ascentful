'use client';

import { Briefcase, GraduationCap, Search, TrendingUp } from 'lucide-react';
import React, { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface QuickStartActionsProps {
  onAction: (action: string, data?: string) => void;
}

const POPULAR_ROLES = [
  'Software Engineer',
  'Product Manager',
  'Data Scientist',
  'UX Designer',
  'Marketing Manager',
  'Financial Analyst',
];

const POPULAR_PATHS = [
  { label: 'Tech', icon: '💻' },
  { label: 'Business', icon: '📊' },
  { label: 'Healthcare', icon: '🏥' },
  { label: 'Creative', icon: '🎨' },
];

export function QuickStartActions({ onAction }: QuickStartActionsProps) {
  const [searchValue, setSearchValue] = useState('');

  const handleSearch = () => {
    if (searchValue.trim()) {
      onAction('search-role', searchValue.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <Input
            placeholder="Search for a role..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} disabled={!searchValue.trim()}>
          Go
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-neutral-500">Quick actions</p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAction('from-major')}
            className="gap-1.5"
          >
            <GraduationCap className="w-4 h-4" />
            Paths for my major
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAction('from-dream-job')}
            className="gap-1.5"
          >
            <Briefcase className="w-4 h-4" />
            From my dream job
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAction('trending')}
            className="gap-1.5"
          >
            <TrendingUp className="w-4 h-4" />
            Trending paths
          </Button>
        </div>
      </div>

      {/* Popular Roles */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-neutral-500">Popular roles</p>
        <div className="flex flex-wrap gap-2">
          {POPULAR_ROLES.map((role) => (
            <Badge
              key={role}
              variant="secondary"
              className="cursor-pointer hover:bg-neutral-200 transition-colors"
              onClick={() => onAction('search-role', role)}
            >
              {role}
            </Badge>
          ))}
        </div>
      </div>

      {/* Industry Paths */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-neutral-500">Browse by industry</p>
        <div className="flex flex-wrap gap-2">
          {POPULAR_PATHS.map((path) => (
            <Button
              key={path.label}
              variant="ghost"
              size="sm"
              onClick={() => onAction('browse-industry', path.label)}
              className="gap-1.5"
            >
              <span>{path.icon}</span>
              {path.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
