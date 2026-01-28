'use client';

import {
  ClipboardList,
  FileText,
  GraduationCap,
  Mail,
  MoreVertical,
  Target,
  Users,
} from 'lucide-react';
import { useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

import type {
  Department,
  Student,
  StudentMetrics,
  StudentProgress,
  UniversityOverview,
} from '../types';

type StudentSubTab = 'students-list' | 'students-progress' | 'invite-students';

interface StudentsTabProps {
  students: Student[];
  departments: Department[];
  studentProgress: StudentProgress[];
  studentMetrics: StudentMetrics | undefined;
  overview: UniversityOverview;
  onEditStudent: (student: Student) => void;
  onStudentClick: (clerkId: string) => void;
  // Invite form props (shared state from parent)
  assignText: string;
  onAssignTextChange: (text: string) => void;
  assignRole: 'student' | 'advisor';
  onAssignRoleChange: (role: 'student' | 'advisor') => void;
  onAssign: () => Promise<void>;
  assigning: boolean;
  importingEmails: boolean;
  onImportCsv: (file: File) => void;
}

export function StudentsTab({
  students,
  departments,
  studentProgress,
  studentMetrics,
  overview,
  onEditStudent,
  onStudentClick,
  assignText,
  onAssignTextChange,
  assignRole,
  onAssignRoleChange,
  onAssign,
  assigning,
  importingEmails,
  onImportCsv,
}: StudentsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<StudentSubTab>('students-list');

  const emailCount = assignText.split(/[\n,]+/).filter((e) => e.trim()).length;

  return (
    <div className="space-y-6">
      {/* Internal Toggle for Students Tab */}
      <div className="flex gap-4">
        <Button
          variant={activeSubTab === 'students-list' ? 'default' : 'outline'}
          onClick={() => setActiveSubTab('students-list')}
          className={activeSubTab === 'students-list' ? 'bg-[#0C29AB]' : ''}
        >
          Students
        </Button>
        <Button
          variant={activeSubTab === 'students-progress' ? 'default' : 'outline'}
          onClick={() => setActiveSubTab('students-progress')}
          className={activeSubTab === 'students-progress' ? 'bg-[#0C29AB]' : ''}
        >
          Student Progress
        </Button>
        <Button
          variant={activeSubTab === 'invite-students' ? 'default' : 'outline'}
          onClick={() => setActiveSubTab('invite-students')}
          className={activeSubTab === 'invite-students' ? 'bg-[#0C29AB]' : ''}
        >
          Invite Students
        </Button>
      </div>

      <div className="space-y-6">
        {/* Students List View */}
        {activeSubTab === 'students-list' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">Total Students</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center">
                    <Users className="h-5 w-5 text-muted-foreground mr-2" />
                    <div className="text-2xl font-bold">{overview?.totalStudents ?? 0}</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">Active Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center">
                    <Users className="h-5 w-5 text-muted-foreground mr-2" />
                    <div className="text-2xl font-bold">{overview?.activeStudents ?? 0}</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Last 30 days</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">New This Month</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center">
                    <Users className="h-5 w-5 text-muted-foreground mr-2" />
                    <div className="text-2xl font-bold">{overview?.newStudentsThisMonth ?? 0}</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">Departments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center">
                    <GraduationCap className="h-5 w-5 text-muted-foreground mr-2" />
                    <div className="text-2xl font-bold">{overview?.departments ?? 0}</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>All Students</CardTitle>
                <CardDescription>
                  {overview?.totalStudents && overview.totalStudents > 500
                    ? 'Showing up to 500 enrolled students'
                    : 'Complete list of enrolled students'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students
                      .slice()
                      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
                      .map((s) => {
                        const dept = departments.find((d) => d._id === s.department_id);
                        return (
                          <TableRow key={s._id as string}>
                            <TableCell>
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={s.imageUrl} />
                                <AvatarFallback>
                                  {(s.name || 'U')
                                    .split(' ')
                                    .map((n) => n[0])
                                    .join('')
                                    .toUpperCase()
                                    .slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                            </TableCell>
                            <TableCell
                              className="font-medium cursor-pointer hover:underline"
                              onClick={() => s.clerkId && onStudentClick(s.clerkId)}
                            >
                              {s.name || 'Unknown'}
                            </TableCell>
                            <TableCell>{s.email}</TableCell>
                            <TableCell className="uppercase text-xs text-muted-foreground">
                              {s.role}
                            </TableCell>
                            <TableCell>{dept?.name || 'Not assigned'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {s.created_at
                                ? new Date(s.created_at).toLocaleDateString()
                                : 'Unknown'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {s.last_active
                                ? new Date(s.last_active).toLocaleDateString()
                                : 'Never'}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => s.clerkId && onStudentClick(s.clerkId)}
                                  >
                                    View Profile
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => onEditStudent(s)}>
                                    Edit Student
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </CardContent>
              <CardFooter className="text-sm text-muted-foreground">
                Showing {students.length} of {overview?.totalStudents ?? students.length} enrolled
                students
              </CardFooter>
            </Card>
          </>
        )}

        {/* Student Progress View */}
        {activeSubTab === 'students-progress' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">Goals Completed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center">
                    <Target className="h-5 w-5 text-muted-foreground mr-2" />
                    <div className="text-2xl font-bold">{studentMetrics?.totalGoals || 0}</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Career goals created</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">Applications Submitted</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center">
                    <ClipboardList className="h-5 w-5 text-muted-foreground mr-2" />
                    <div className="text-2xl font-bold">
                      {studentMetrics?.totalApplications || 0}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Job applications</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">Resumes Created</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 text-muted-foreground mr-2" />
                    <div className="text-2xl font-bold">{studentMetrics?.totalResumes || 0}</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Professional documents</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">Cover Letters</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center">
                    <Mail className="h-5 w-5 text-muted-foreground mr-2" />
                    <div className="text-2xl font-bold">
                      {studentMetrics?.totalCoverLetters || 0}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Application materials</div>
                </CardContent>
              </Card>
            </div>

            {/* Individual Student Progress Table */}
            <Card>
              <CardHeader>
                <CardTitle>Student Progress Details</CardTitle>
                <CardDescription>Individual student progress tracking</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Goals</TableHead>
                      <TableHead>Applications</TableHead>
                      <TableHead>Resumes</TableHead>
                      <TableHead>Cover Letters</TableHead>
                      <TableHead>Overall Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(studentProgress || []).slice(0, 10).map((progress) => (
                      <TableRow key={(progress.studentId as string) || (progress.userId as string)}>
                        <TableCell className="font-medium">{progress.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{progress.goals}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{progress.applications}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{progress.resumes}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{progress.coverLetters || 0}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={progress.completion} className="w-16 h-2" />
                            <span className="text-sm font-medium">{progress.completion}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
              <CardFooter className="text-sm text-muted-foreground">
                Showing progress for {Math.min(10, studentProgress?.length || 0)} students
              </CardFooter>
            </Card>

            {/* Progress Summary by Department */}
            <Card>
              <CardHeader>
                <CardTitle>Progress Summary by Department</CardTitle>
                <CardDescription>Average progress metrics across departments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {departments.map((d) => {
                    const deptStudents = students.filter((s) => s.department_id === d._id);
                    const deptProgress = (studentProgress || []).filter((p) =>
                      students.some(
                        (s) => s._id === (p.studentId || p.userId) && s.department_id === d._id,
                      ),
                    );
                    const avgProgress =
                      deptProgress.length > 0
                        ? Math.round(
                            deptProgress.reduce((sum, p) => sum + p.completion, 0) /
                              deptProgress.length,
                          )
                        : 0;

                    return (
                      <Card key={String(d._id)}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between gap-2">
                            <CardTitle className="text-lg">{d.name}</CardTitle>
                            {d.code && <Badge variant="outline">{d.code}</Badge>}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Students</span>
                              <span className="font-medium">{deptStudents.length}</span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Avg Progress</span>
                                <span className="font-medium">{avgProgress}%</span>
                              </div>
                              <Progress value={avgProgress} className="h-2" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Invite Students View */}
        {activeSubTab === 'invite-students' && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Invite Students</CardTitle>
                <CardDescription>
                  Bulk invite students to join the Ascentful Career Development platform
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Send Invitations</Label>
                  <div className="text-sm text-muted-foreground mt-1">
                    Invite students to join the Ascentful Career Development Platform for your
                    university. This platform will help them prepare for their career development
                    journey.
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="studentEmailsCsvInvite"
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onImportCsv(f);
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('studentEmailsCsvInvite')?.click()}
                    disabled={importingEmails}
                  >
                    {importingEmails ? 'Parsing...' : 'Upload CSV'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Email Addresses</CardTitle>
                <CardDescription>Enter student email addresses to invite</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm">Student Email Addresses</Label>
                    <Textarea
                      placeholder={`Enter one email per line or comma-separated\nExample:\nstudent1@university.edu\nstudent2@university.edu`}
                      rows={8}
                      value={assignText}
                      onChange={(e) => onAssignTextChange(e.target.value)}
                    />
                    <div className="text-xs text-muted-foreground mt-1">
                      <strong>Note:</strong> An activation email will be sent to each address,
                      allowing recipients to activate their account and access university resources.
                      No prior signup required.
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Default role for invited students:</Label>
                    <div className="flex gap-2">
                      <Button
                        variant={assignRole === 'student' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onAssignRoleChange('student')}
                      >
                        Student
                      </Button>
                      <Button
                        variant={assignRole === 'advisor' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onAssignRoleChange('advisor')}
                      >
                        Advisor / Staff
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <div className="text-sm text-muted-foreground">
                  {emailCount} email(s) ready to invite
                </div>
                <Button onClick={onAssign} disabled={assigning || !assignText.trim()}>
                  {assigning ? 'Sending...' : `Send ${emailCount} Invitation(s)`}
                </Button>
              </CardFooter>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
