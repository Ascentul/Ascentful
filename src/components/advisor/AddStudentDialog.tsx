'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { Loader2, Search, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AddStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddStudentDialog({ open, onOpenChange }: AddStudentDialogProps) {
  const { user } = useUser();
  const clerkId = user?.id;

  const [searchQuery, setSearchQuery] = useState('');
  const [addingStudentId, setAddingStudentId] = useState<Id<'users'> | null>(null);

  // Fetch available students
  const availableStudents = useQuery(
    api.advisor_students.getAvailableStudentsForAdvisor,
    clerkId ? { clerkId } : 'skip',
  );

  // Self-assign mutation
  const selfAssignMutation = useMutation(api.advisor_students.selfAssignStudent);

  // Filter students by search query
  const filteredStudents = useMemo(() => {
    if (!availableStudents) return [];
    if (!searchQuery.trim()) return availableStudents;

    const query = searchQuery.toLowerCase();
    return availableStudents.filter(
      (student) =>
        student.name?.toLowerCase().includes(query) ||
        student.email?.toLowerCase().includes(query) ||
        student.major?.toLowerCase().includes(query),
    );
  }, [availableStudents, searchQuery]);

  // Handle adding a student
  const handleAddStudent = async (studentId: Id<'users'>) => {
    if (!clerkId) return;

    setAddingStudentId(studentId);

    try {
      const result = await selfAssignMutation({
        clerkId,
        studentId,
      });

      const student = availableStudents?.find((s) => s._id === studentId);
      const studentName = student?.name || student?.email || 'Student';

      if (result.isOwner) {
        toast.success(`Added ${studentName} as your primary student`);
      } else {
        toast.success(`Added ${studentName} to your caseload`);
      }

      // Clear search after successful add
      setSearchQuery('');
    } catch (error) {
      console.error('Failed to add student:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add student');
    } finally {
      setAddingStudentId(null);
    }
  };

  // Get initials for avatar
  const getInitials = (name: string | undefined, email: string | undefined) => {
    if (name) {
      return name
        .split(' ')
        .filter((n) => n.length > 0)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return '??';
  };

  const isLoading = availableStudents === undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add Student to Caseload
          </DialogTitle>
          <DialogDescription>
            Select a student from your university to add to your caseload.
          </DialogDescription>
        </DialogHeader>

        {/* Search Input */}
        <div className="relative">
          <label htmlFor="student-search" className="sr-only">
            Search students
          </label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="student-search"
            placeholder="Search by name, email, or major..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Student List */}
        <ScrollArea className="h-[350px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              {availableStudents && availableStudents.length === 0 ? (
                <>
                  <UserPlus className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">All students assigned</p>
                  <p className="text-sm text-muted-foreground">
                    You&apos;ve already added all available students to your caseload.
                  </p>
                </>
              ) : (
                <>
                  <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">No students found</p>
                  <p className="text-sm text-muted-foreground">
                    No students match your search &quot;{searchQuery}&quot;
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredStudents.map((student) => (
                <div
                  key={student._id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={student.profile_image} alt={student.name || 'Student'} />
                      <AvatarFallback className="bg-primary-100 text-primary-700">
                        {getInitials(student.name, student.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{student.name || 'Unnamed Student'}</p>
                      <p className="text-xs text-muted-foreground">{student.email}</p>
                      {(student.major || student.graduation_year) && (
                        <p className="text-xs text-muted-foreground">
                          {[student.major, student.graduation_year].filter(Boolean).join(' • ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleAddStudent(student._id)}
                    disabled={addingStudentId === student._id}
                  >
                    {addingStudentId === student._id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Add'
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer with count */}
        {!isLoading && availableStudents && availableStudents.length > 0 && (
          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            {searchQuery ? (
              <>
                Showing {filteredStudents.length} of {availableStudents.length} available students
              </>
            ) : (
              <>{availableStudents.length} students available to add</>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
