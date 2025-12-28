'use client';

import { AlertCircle, GraduationCap, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Student {
  _id: string;
  name: string;
  email: string;
  major?: string;
  graduation_year?: string;
  metadata?: {
    activeApplicationsCount: number;
    openFollowUpsCount: number;
    isAtRisk: boolean;
    hasOffer?: boolean;
    nextSession?: {
      id: string;
      scheduledAt?: number;
      title?: string | null;
    } | null;
    lastActivity: number;
  };
}

interface StudentsTableProps {
  students: Student[];
  isLoading?: boolean;
}

// Virtual scrolling configuration constants
const ROW_HEIGHT = 80;
const VIEWPORT_HEIGHT = 520;
const OVERSCAN = 6;
const COLUMN_COUNT = 7;

/**
 * Helper function to generate student status badge
 * Priority: At Risk > Has Offer > Active > Inactive
 */
function getStatusBadge(student: Student, activeApps: number) {
  const isAtRisk = student.metadata?.isAtRisk || false;
  const hasOffer = student.metadata?.hasOffer || false;

  if (isAtRisk) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="h-3 w-3" />
        At Risk
      </Badge>
    );
  }

  if (hasOffer) {
    return (
      <Badge variant="default" className="bg-emerald-600">
        Offer
      </Badge>
    );
  }

  if (activeApps > 0) {
    return <Badge variant="secondary">Active</Badge>;
  }

  return <Badge variant="outline">Inactive</Badge>;
}

export function StudentsTable({ students, isLoading }: StudentsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [scrollTop, setScrollTop] = useState(0);

  // Filter students by search term (memoized for performance)
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const search = searchTerm.toLowerCase();
      return (
        student.name.toLowerCase().includes(search) ||
        student.email.toLowerCase().includes(search) ||
        student.major?.toLowerCase().includes(search)
      );
    });
  }, [students, searchTerm]);

  // Virtualization: calculate visible range (must be called unconditionally for Rules of Hooks)
  const totalHeight = filteredStudents.length * ROW_HEIGHT;
  const { startIndex, endIndex } = useMemo(() => {
    if (filteredStudents.length === 0) {
      return { startIndex: 0, endIndex: 0 };
    }
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const end = Math.min(
      filteredStudents.length,
      Math.ceil((scrollTop + VIEWPORT_HEIGHT) / ROW_HEIGHT) + OVERSCAN,
    );
    return { startIndex: start, endIndex: end };
  }, [filteredStudents.length, scrollTop]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading students...</p>
        </div>
      </div>
    );
  }

  const visibleStudents = filteredStudents.slice(startIndex, endIndex);
  const translateY = startIndex * ROW_HEIGHT;

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <label htmlFor="student-search" className="sr-only">
            Search students
          </label>
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="student-search"
            placeholder="Search by name, email, or major..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {filteredStudents.length} of {students.length} students
        </div>
      </div>

      {/* Students Table */}
      {filteredStudents.length === 0 ? (
        <div className="border rounded-lg p-12 text-center">
          <p className="text-muted-foreground">
            {searchTerm ? 'No students match your search' : 'No students in your caseload'}
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div
            className="relative overflow-auto"
            style={{ maxHeight: VIEWPORT_HEIGHT }}
            onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          >
            <table className="w-full border-collapse" aria-rowcount={filteredStudents.length + 1}>
              <caption className="sr-only">
                Student caseload showing {filteredStudents.length} students with their major,
                graduation year, active applications, follow-ups, status, and profile links
              </caption>
              <thead className="bg-muted/50 sticky top-0 z-10">
                <tr className="border-b" aria-rowindex={1}>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground"
                  >
                    Student
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden sm:table-cell"
                  >
                    Major
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground hidden sm:table-cell"
                  >
                    Grad Year
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground hidden sm:table-cell"
                  >
                    Active Apps
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground hidden sm:table-cell"
                  >
                    Follow-ups
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden sm:table-cell"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="relative" style={{ height: totalHeight }}>
                {/* Spacer row for offset before visible rows */}
                {translateY > 0 && (
                  <tr style={{ height: translateY, visibility: 'hidden' }} aria-hidden="true">
                    <td colSpan={COLUMN_COUNT}></td>
                  </tr>
                )}

                {visibleStudents.map((student, index) => {
                  const activeApps = student.metadata?.activeApplicationsCount || 0;
                  const statusBadge = getStatusBadge(student, activeApps);

                  return (
                    <tr
                      key={student._id}
                      className="border-b hover:bg-muted/30 transition-colors"
                      style={{ height: ROW_HEIGHT }}
                      aria-rowindex={startIndex + index + 2}
                    >
                      <td className="px-4 py-3 align-middle">
                        <div>
                          <div className="font-medium">{student.name}</div>
                          <div className="text-xs text-muted-foreground break-words">
                            {student.email}
                          </div>
                        </div>
                        {/* Mobile-only: show additional data */}
                        <div className="sm:hidden mt-2 space-y-1 text-xs">
                          <div className="flex items-center gap-2">
                            <GraduationCap className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {student.major || 'Not set'}
                            </span>
                            <span className="text-muted-foreground">
                              • Class of {student.graduation_year || 'N/A'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-muted-foreground">Apps:</span>
                            <Badge
                              variant={activeApps > 0 ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {activeApps}
                            </Badge>
                            <span className="text-muted-foreground">
                              Follow-ups: {student.metadata?.openFollowUpsCount || 0}
                            </span>
                            {statusBadge}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle text-sm hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4 text-muted-foreground" />
                          {student.major || 'Not set'}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle text-center text-sm text-muted-foreground hidden sm:table-cell">
                        {student.graduation_year || '-'}
                      </td>
                      <td className="px-4 py-3 align-middle text-center hidden sm:table-cell">
                        <Badge variant={activeApps > 0 ? 'default' : 'secondary'}>
                          {activeApps}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-middle text-center text-sm hidden sm:table-cell">
                        {student.metadata?.openFollowUpsCount || 0}
                      </td>
                      <td className="px-4 py-3 align-middle hidden sm:table-cell">{statusBadge}</td>
                      <td className="px-4 py-3 align-middle text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled
                          title="Student profile page coming soon"
                        >
                          View Profile
                        </Button>
                      </td>
                    </tr>
                  );
                })}

                {/* Spacer row for offset after visible rows */}
                {translateY + visibleStudents.length * ROW_HEIGHT < totalHeight && (
                  <tr
                    style={{
                      height: totalHeight - translateY - visibleStudents.length * ROW_HEIGHT,
                      visibility: 'hidden',
                    }}
                    aria-hidden="true"
                  >
                    <td colSpan={COLUMN_COUNT}></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
