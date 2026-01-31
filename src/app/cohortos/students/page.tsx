'use client';

import { ChevronDown, ChevronUp, Download, Search, Send, Users, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';

import { BulkOutreachModal } from '@/components/cohortos/modals';
import { StudentRow, StudentTableHeader } from '@/components/cohortos/ui/student-row';
import { Button } from '@/components/ui/button';
import {
  formatRelativeTime,
  getDaysSinceLastContact,
  getDaysSinceUpdate,
  getOutreachStatus,
  getStaleStudents,
  getStudentsWithBlockers,
  mockCoaches,
  mockStudents,
} from '@/lib/cohortos/mock-data';
import {
  OUTREACH_STATUS_CONFIG,
  type Program,
  type Status,
  type Student,
} from '@/lib/cohortos/types';
import { cn } from '@/lib/utils';

// Filter options
const programOptions = [
  { value: '', label: 'All Programs' },
  { value: 'ft-mba', label: 'FT-MBA' },
  { value: 'pt-mba', label: 'PT-MBA' },
  { value: 'emba', label: 'EMBA' },
];

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'searching', label: 'Searching' },
  { value: 'applying', label: 'Applying' },
  { value: 'interviewing', label: 'Interviewing' },
  { value: 'offered', label: 'Offered' },
  { value: 'placed', label: 'Placed' },
];

const coachOptions = [
  { value: '', label: 'All Coaches' },
  ...mockCoaches.map((c) => ({ value: c.id, label: c.name })),
];

const flagOptions = [
  { value: '', label: 'All Students' },
  { value: 'blockers', label: 'Has Blockers' },
  { value: 'stale', label: 'Not Updated (14+ days)' },
  { value: 'international-searching', label: 'International Searching' },
  { value: 'cpt-deadline', label: 'CPT Deadline Soon' },
  { value: 'non-responders', label: 'Survey Non-Responders' },
  { value: 'needs-outreach', label: 'Needs Outreach (14+ days)' },
];

type SortField = 'name' | 'status' | 'lastUpdated';
type SortOrder = 'asc' | 'desc';

// Status order for sorting
const statusOrder: Status[] = ['searching', 'applying', 'interviewing', 'offered', 'placed'];

export default function CohortosStudentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read initial filters from URL
  const initialStatus = searchParams.get('status') || '';
  const initialProgram = searchParams.get('program') || '';
  const initialCoach = searchParams.get('coach') || '';
  const initialFilter = searchParams.get('filter') || '';
  const initialSearch = searchParams.get('search') || '';

  // Filter state
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [programFilter, setProgramFilter] = useState(initialProgram);
  const [coachFilter, setCoachFilter] = useState(initialCoach);
  const [flagFilter, setFlagFilter] = useState(initialFilter);
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal state
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Sort state
  const [sortBy, setSortBy] = useState<SortField>('lastUpdated');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Update URL when filters change
  const updateURL = useCallback(
    (params: Record<string, string>) => {
      const newParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value) newParams.set(key, value);
      });
      const queryString = newParams.toString();
      router.replace(`/cohortos/students${queryString ? `?${queryString}` : ''}`, {
        scroll: false,
      });
    },
    [router],
  );

  // Filter and sort students
  const filteredStudents = useMemo(() => {
    let result = [...mockStudents];

    // Status filter
    if (statusFilter) {
      result = result.filter((s) => s.status === statusFilter);
    }

    // Program filter
    if (programFilter) {
      result = result.filter((s) => s.program === programFilter);
    }

    // Coach filter
    if (coachFilter) {
      result = result.filter((s) => s.coachId === coachFilter);
    }

    // Flag filter
    if (flagFilter === 'blockers') {
      result = result.filter((s) => s.hasBlocker);
    } else if (flagFilter === 'stale') {
      result = result.filter((s) => getDaysSinceUpdate(s) >= 14);
    } else if (flagFilter === 'international-searching') {
      result = result.filter((s) => s.isInternational && s.status === 'searching');
    } else if (flagFilter === 'cpt-deadline') {
      result = result.filter((s) => s.requiresCpt && s.cptDeadline && s.status !== 'placed');
    } else if (flagFilter === 'non-responders') {
      // For demo: student-1 and student-2 have responded to the survey
      const respondedIds = ['student-1', 'student-2'];
      result = result.filter((s) => !respondedIds.includes(s.id));
    } else if (flagFilter === 'needs-outreach') {
      // Filter for students needing outreach (14+ days since contact or never contacted)
      result = result.filter((s) => {
        if (!s.lastContactDate) return true;
        return getDaysSinceLastContact(s) >= 14;
      });
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.email.toLowerCase().includes(query) ||
          s.targetRole.toLowerCase().includes(query),
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'status':
          comparison = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
          break;
        case 'lastUpdated':
          comparison = new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime();
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [statusFilter, programFilter, coachFilter, flagFilter, searchQuery, sortBy, sortOrder]);

  // Handlers
  const handleFilterChange = (type: 'status' | 'program' | 'coach' | 'flag', value: string) => {
    const newParams: Record<string, string> = {
      status: type === 'status' ? value : statusFilter,
      program: type === 'program' ? value : programFilter,
      coach: type === 'coach' ? value : coachFilter,
      filter: type === 'flag' ? value : flagFilter,
      search: searchQuery,
    };

    if (type === 'status') setStatusFilter(value);
    if (type === 'program') setProgramFilter(value);
    if (type === 'coach') setCoachFilter(value);
    if (type === 'flag') setFlagFilter(value);

    updateURL(newParams);
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    updateURL({
      status: statusFilter,
      program: programFilter,
      coach: coachFilter,
      filter: flagFilter,
      search: value,
    });
  };

  const clearFilters = () => {
    setStatusFilter('');
    setProgramFilter('');
    setCoachFilter('');
    setFlagFilter('');
    setSearchQuery('');
    router.replace('/cohortos/students', { scroll: false });
  };

  const hasActiveFilters =
    statusFilter || programFilter || coachFilter || flagFilter || searchQuery;

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredStudents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStudents.map((s) => s.id)));
    }
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleStudentClick = (id: string) => {
    router.push(`/cohortos/students/${id}`);
  };

  const handleBulkOutreach = () => {
    setShowBulkModal(true);
  };

  // Sortable header component
  const SortableHeader = ({
    field,
    label,
    className,
  }: {
    field: SortField;
    label: string;
    className?: string;
  }) => (
    <th
      className={cn(
        'px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 select-none',
        className,
      )}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortBy === field &&
          (sortOrder === 'asc' ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          ))}
      </div>
    </th>
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Students</h1>
          <p className="text-slate-500 mt-1">Manage your cohort pipeline</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="default"
            size="sm"
            disabled={selectedIds.size === 0}
            onClick={handleBulkOutreach}
          >
            <Send className="h-4 w-4 mr-2" />
            Bulk Outreach{selectedIds.size > 0 && ` (${selectedIds.size})`}
          </Button>
          <Button variant="outline" size="sm" onClick={() => console.log('Export clicked')}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Program Filter */}
          <select
            value={programFilter}
            onChange={(e) => handleFilterChange('program', e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {programOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Coach Filter */}
          <select
            value={coachFilter}
            onChange={(e) => handleFilterChange('coach', e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {coachOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Flag Filter */}
          <select
            value={flagFilter}
            onChange={(e) => handleFilterChange('flag', e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {flagOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, or role..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Results Bar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">
          Showing <span className="font-medium">{filteredStudents.length}</span>{' '}
          {filteredStudents.length === 1 ? 'student' : 'students'}
          {hasActiveFilters && <span className="text-slate-400"> (filtered)</span>}
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedIds.size > 0 && selectedIds.size === filteredStudents.length}
              onChange={selectAll}
              className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            Select All
          </label>
          {selectedIds.size > 0 && (
            <span className="text-sm text-primary-600 font-medium">
              {selectedIds.size} selected
            </span>
          )}
        </div>
      </div>

      {/* Student Table */}
      {filteredStudents.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 w-12" />
                  <SortableHeader field="name" label="Student" />
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Program
                  </th>
                  <SortableHeader field="status" label="Status" />
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Coach
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Target Role
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Last Contact
                  </th>
                  <SortableHeader field="lastUpdated" label="Last Updated" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredStudents.map((student) => (
                  <StudentRow
                    key={student.id}
                    student={student}
                    selected={selectedIds.has(student.id)}
                    onSelect={toggleSelection}
                    onClick={handleStudentClick}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-lg text-slate-600">No students found</p>
          <p className="text-sm text-slate-500 mt-1">Try adjusting your filters or search query</p>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
              Clear Filters
            </Button>
          )}
        </div>
      )}

      {/* Bulk Outreach Modal */}
      <BulkOutreachModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        students={mockStudents.filter((s) => selectedIds.has(s.id))}
      />
    </div>
  );
}
