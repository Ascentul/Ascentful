'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useQuery } from 'convex/react';
import { UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';

import { AddStudentDialog } from '@/components/advisor/AddStudentDialog';
import { AdvisorGate } from '@/components/advisor/AdvisorGate';
import { StudentFilters } from '@/components/advisor/StudentFilters';
import { StudentsTable } from '@/components/advisor/StudentsTable';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { hasAdvisorAccess } from '@/lib/constants/roles';

function AdvisorStudentsPageContent() {
  const { user } = useUser();
  const clerkId = user?.id;
  const userRole = user?.publicMetadata?.role as string | undefined;
  const isAdvisor = hasAdvisorAccess(userRole);

  // Only fetch caseload if user has advisor access (prevents query error for unauthorized users)
  const caseloadData = useQuery(
    api.advisor_students.getMyCaseload,
    clerkId && isAdvisor ? { clerkId } : 'skip',
  );

  // Filter state
  const [selectedMajor, setSelectedMajor] = useState('all');
  const [selectedGradYear, setSelectedGradYear] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Add Student dialog state
  const [addStudentDialogOpen, setAddStudentDialogOpen] = useState(false);

  // Extract unique majors and grad years from data
  const { majors, gradYears } = useMemo(() => {
    if (!caseloadData) return { majors: [], gradYears: [] };

    const majorsSet = new Set<string>();
    const yearsSet = new Set<string>();

    caseloadData.forEach((student) => {
      if (student.major) majorsSet.add(student.major);
      if (student.graduation_year) yearsSet.add(student.graduation_year);
    });

    return {
      majors: Array.from(majorsSet).sort(),
      gradYears: Array.from(yearsSet).sort(),
    };
  }, [caseloadData]);

  // Apply filters
  const filteredStudents = useMemo(() => {
    if (!caseloadData) return [];

    return caseloadData.filter((student) => {
      // Major filter
      if (selectedMajor !== 'all' && student.major !== selectedMajor) {
        return false;
      }

      // Grad year filter
      if (selectedGradYear !== 'all' && student.graduation_year !== selectedGradYear) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'all') {
        const isAtRisk = student.metadata?.isAtRisk || false;
        const hasApps = (student.metadata?.activeApplicationsCount || 0) > 0;
        const hasOffer = student.metadata?.hasOffer || false;

        // Match the badge priority logic: At Risk > Has Offer > Active > Inactive
        const effectiveStatus = isAtRisk
          ? 'at-risk'
          : hasOffer
            ? 'has-offer'
            : hasApps
              ? 'active'
              : 'inactive';

        if (selectedStatus !== effectiveStatus) return false;
      }

      return true;
    });
  }, [caseloadData, selectedMajor, selectedGradYear, selectedStatus]);

  const hasActiveFilters =
    selectedMajor !== 'all' || selectedGradYear !== 'all' || selectedStatus !== 'all';

  const handleClearFilters = () => {
    setSelectedMajor('all');
    setSelectedGradYear('all');
    setSelectedStatus('all');
  };

  return (
    <AdvisorGate requiredFlag="advisor.students">
      <div className="w-full">
        <div className="w-full gradient-border-bottom p-5 space-y-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Students</h1>
              <p className="text-muted-foreground mt-1">Manage your student caseload</p>
            </div>
            <Button onClick={() => setAddStudentDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Student
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Student Caseload
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <StudentFilters
                selectedMajor={selectedMajor}
                selectedGradYear={selectedGradYear}
                selectedStatus={selectedStatus}
                onMajorChange={setSelectedMajor}
                onGradYearChange={setSelectedGradYear}
                onStatusChange={setSelectedStatus}
                onClearFilters={handleClearFilters}
                majors={majors}
                gradYears={gradYears}
                hasActiveFilters={hasActiveFilters}
              />

              {/* Table */}
              <StudentsTable students={filteredStudents} isLoading={caseloadData === undefined} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Student Dialog */}
      <AddStudentDialog open={addStudentDialogOpen} onOpenChange={setAddStudentDialogOpen} />
    </AdvisorGate>
  );
}

export default function AdvisorStudentsPage() {
  return (
    <ErrorBoundary>
      <AdvisorStudentsPageContent />
    </ErrorBoundary>
  );
}
