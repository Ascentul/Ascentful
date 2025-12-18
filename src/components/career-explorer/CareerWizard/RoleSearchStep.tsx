'use client';

import { Briefcase, GraduationCap, Loader2, Plus, Users, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { RoleSearchResult, StartingRole } from '@/lib/career-explorer/types';

interface RoleSearchStepProps {
  selectedRole: StartingRole | null;
  onRoleSelect: (role: StartingRole | null) => void;
  onContinue: () => void;
}

export function RoleSearchStep({ selectedRole, onRoleSelect, onContinue }: RoleSearchStepProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RoleSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const searchRoles = useCallback(async (searchQuery: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/career-explorer/role-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, limit: 10 }),
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data.roles || []);
      }
    } catch (error) {
      console.error('Role search error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchRoles(query);
    }, 200);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, searchRoles]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (role: RoleSearchResult) => {
    onRoleSelect({
      id: role.id,
      title: role.title,
      category: role.category,
    });
    setQuery('');
    setIsOpen(false);
  };

  const handleSelectCustom = () => {
    if (query.trim()) {
      onRoleSelect({
        id: `custom-${query.trim().toLowerCase().replace(/\s+/g, '-')}`,
        title: query.trim(),
        category: 'Custom',
      });
      setQuery('');
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    onRoleSelect(null);
    setQuery('');
    // Focus input after clearing
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) {
      // If there are results and user presses Enter, select the first one
      if (results.length > 0) {
        handleSelect(results[0]);
      } else {
        // Otherwise, use custom entry
        handleSelectCustom();
      }
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Get icon based on category
  const getIconForCategory = (category: string) => {
    if (category.toLowerCase().includes('major')) {
      return <GraduationCap className="w-5 h-5 text-amber-600" />;
    }
    if (category.toLowerCase().includes('intern')) {
      return <Users className="w-5 h-5 text-emerald-600" />;
    }
    return <Briefcase className="w-5 h-5 text-neutral-500" />;
  };

  const getIconBgForCategory = (category: string) => {
    if (category.toLowerCase().includes('major')) {
      return 'bg-amber-100';
    }
    if (category.toLowerCase().includes('intern')) {
      return 'bg-emerald-100';
    }
    return 'bg-neutral-100';
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      {/* Main heading */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-semibold text-neutral-900 mb-2">
          What&apos;s your starting point?
        </h1>
        <p className="text-neutral-500">
          Select your current role, major, or internship to get personalized career recommendations
        </p>
      </div>

      {/* Search / Selected display */}
      <div className="w-full max-w-xl">
        {selectedRole ? (
          <div className="flex items-center justify-between p-4 bg-primary-50 border-2 border-primary-200 rounded-xl">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-full ${selectedRole.category ? getIconBgForCategory(selectedRole.category) : 'bg-primary-100'} flex items-center justify-center`}
              >
                {selectedRole.category ? (
                  <span className="scale-125">{getIconForCategory(selectedRole.category)}</span>
                ) : (
                  <Briefcase className="w-6 h-6 text-primary-600" />
                )}
              </div>
              <div>
                <p className="font-semibold text-lg text-neutral-900">{selectedRole.title}</p>
                {selectedRole.category && (
                  <p className="text-sm text-neutral-500">{selectedRole.category}</p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClear}
              className="text-neutral-400 hover:text-neutral-600"
              aria-label="Clear selection"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        ) : (
          <div className="relative">
            {/* Search Input */}
            <Input
              ref={inputRef}
              type="text"
              placeholder="Search roles, majors, or internships..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              className="w-full h-14 px-4 text-lg rounded-xl border-2 focus:border-primary-400 focus:ring-primary-200"
            />

            {/* Dropdown */}
            {isOpen && (
              <div
                ref={dropdownRef}
                className="absolute z-50 w-full mt-2 bg-white border-2 border-neutral-200 rounded-xl shadow-lg max-h-[350px] overflow-y-auto"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                  </div>
                ) : (
                  <>
                    {/* Custom entry option - show when user has typed something */}
                    {query.trim() && (
                      <button
                        onClick={handleSelectCustom}
                        className="w-full flex items-center gap-3 p-4 hover:bg-primary-50 border-b border-neutral-100 transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                          <Plus className="w-5 h-5 text-primary-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-primary-700">
                            Use &quot;{query.trim()}&quot;
                          </p>
                          <p className="text-sm text-neutral-500">Add as custom role</p>
                        </div>
                      </button>
                    )}

                    {/* Search results */}
                    {results.length > 0 ? (
                      <div>
                        {query.trim() && (
                          <p className="px-4 py-2 text-xs font-medium text-neutral-500 uppercase tracking-wide bg-neutral-50">
                            Suggestions
                          </p>
                        )}
                        {results.map((role) => (
                          <button
                            key={role.id}
                            onClick={() => handleSelect(role)}
                            className="w-full flex items-center gap-3 p-4 hover:bg-neutral-50 transition-colors text-left"
                          >
                            <div
                              className={`w-10 h-10 rounded-full ${getIconBgForCategory(role.category)} flex items-center justify-center flex-shrink-0`}
                            >
                              {getIconForCategory(role.category)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-neutral-900">{role.title}</p>
                              <p className="text-sm text-neutral-500">{role.category}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : query.trim() ? null : (
                      <div className="py-8 text-center text-neutral-500">
                        Start typing to search for roles...
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Continue Button */}
        <div className="flex justify-center mt-8">
          <Button
            onClick={onContinue}
            disabled={!selectedRole}
            size="lg"
            className="min-w-[160px] text-base"
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
