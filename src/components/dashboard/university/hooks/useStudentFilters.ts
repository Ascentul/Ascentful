'use client';

import { useMemo, useState } from 'react';

import type { RoleFilter, StatusFilter, Student } from '../types';

export function useStudentFilters(students: Student[] | undefined) {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStudents = useMemo(() => {
    if (!students) return [];

    return students.filter((student) => {
      // Role filter
      if (roleFilter !== 'all' && student.role !== roleFilter) return false;

      // Status filter - active means has name (activated), pending means no name
      if (statusFilter === 'active' && !student.name) return false;
      if (statusFilter === 'pending' && student.name) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const name = (student.name || '').toLowerCase();
        const email = (student.email || '').toLowerCase();
        if (!name.includes(query) && !email.includes(query)) return false;
      }

      return true;
    });
  }, [students, roleFilter, statusFilter, searchQuery]);

  const resetFilters = () => {
    setRoleFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
  };

  return {
    // Filter state
    roleFilter,
    statusFilter,
    searchQuery,

    // Setters
    setRoleFilter,
    setStatusFilter,
    setSearchQuery,
    resetFilters,

    // Filtered results
    filteredStudents,

    // Stats
    totalCount: students?.length ?? 0,
    filteredCount: filteredStudents.length,
  };
}

export type StudentFiltersResult = ReturnType<typeof useStudentFilters>;
