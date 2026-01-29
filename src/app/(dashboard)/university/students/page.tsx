'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useAction, useMutation, useQuery } from 'convex/react';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle,
  Download,
  ExternalLink,
  Eye,
  LineChart,
  Loader2,
  Mail,
  MoreVertical,
  Target,
  TrendingUp,
  Upload,
  User as UserIcon,
  UserCog,
  UserPlus,
  Users,
  UserX,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';

import { CommentButton } from '@/components/advisor/comments';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { UniversitySearchCommand } from '@/components/university/UniversitySearchCommand';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { useToast } from '@/hooks/use-toast';

export default function UniversityStudentsPage() {
  const router = useRouter();
  const { user, isAdmin, subscription } = useAuth();
  const { user: clerkUser } = useUser();
  const { toast } = useToast();

  // View toggle state
  const [activeView, setActiveView] = useState<'students' | 'progress'>('students');

  // Access control: Only university_admin, advisor, or super_admin can access
  // subscription.isUniversity is NOT sufficient - it includes regular students
  const canAccess =
    !!user && (isAdmin || user.role === 'university_admin' || user.role === 'advisor');

  const students = useQuery(
    api.university_admin.listStudents,
    clerkUser?.id ? { clerkId: clerkUser.id, limit: 1000 } : 'skip',
  ) as any[] | undefined;

  const departments = useQuery(
    api.university_admin.listDepartments,
    clerkUser?.id ? { clerkId: clerkUser.id } : 'skip',
  ) as any[] | undefined;

  // Asset completion and activity analytics
  const assetStats = useQuery(
    api.university_analytics.getAssetCompletionStats,
    clerkUser?.id ? { clerkId: clerkUser.id } : 'skip',
  );

  const activityTrends = useQuery(
    api.university_analytics.getActivityTrends,
    clerkUser?.id ? { clerkId: clerkUser.id } : 'skip',
  );

  const updateUserByIdMutation = useMutation(api.users.updateUserById);
  const assignStudentMutation = useMutation(api.university_admin.assignStudentByEmail);
  const createUserMutation = useMutation(api.admin_users.createUserByAdmin);
  const softDeleteUserAction = useAction(api.admin_users_actions.softDeleteUser);
  const regenerateActivationMutation = useMutation(api.admin_users.regenerateActivationToken);

  // State
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [singleInviteForm, setSingleInviteForm] = useState({
    name: '',
    email: '',
    departmentId: '' as string,
  });
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<{ name: string; email: string }[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  // Student details dialog state
  const [studentDetailsOpen, setStudentDetailsOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [editingStatus, setEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('');
  const [editingDepartment, setEditingDepartment] = useState(false);
  const [newDepartmentId, setNewDepartmentId] = useState<string>('');
  const [resendingInvite, setResendingInvite] = useState(false);

  // Delete confirmation dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);

  // Parse CSV file
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setParseError(null);

    const reader = new FileReader();
    reader.onerror = () => {
      console.error('FileReader error:', reader.error);
      setCsvFile(null);
      setCsvData([]);
      setParseError('Failed to read the file');
      toast({
        title: 'Read Error',
        description: 'Failed to read the file. Please try again.',
        variant: 'destructive',
      });
    };
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const lines = text.split('\n').filter((line) => line.trim());

        // Check if first line is header
        const hasHeader =
          lines[0].toLowerCase().includes('name') || lines[0].toLowerCase().includes('email');
        const dataLines = hasHeader ? lines.slice(1) : lines;

        const parsed = dataLines.map((line, index) => {
          const [name, email] = line.split(',').map((s) => s.trim());
          if (!name || !email) {
            throw new Error(`Invalid data at line ${index + 1}`);
          }
          if (!email.includes('@')) {
            throw new Error(`Invalid email at line ${index + 1}: ${email}`);
          }
          return { name, email };
        });

        setCsvData(parsed);
        toast({
          title: 'CSV Parsed',
          description: `Successfully parsed ${parsed.length} student records`,
        });
      } catch (error: any) {
        setParseError(error.message);
        setCsvData([]);
        toast({
          title: 'Parse Error',
          description: error.message,
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);
  };

  // Download CSV template
  const downloadTemplate = () => {
    const template =
      'Name,Email\nJohn Doe,john.doe@university.edu\nJane Smith,jane.smith@university.edu';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Single invite
  const handleSingleInvite = async () => {
    if (
      !singleInviteForm.name.trim() ||
      !singleInviteForm.email.trim() ||
      !clerkUser?.id ||
      !user?.university_id
    )
      return;

    setInviting(true);
    try {
      // Create user with activation email (instead of just inviting to sign up)
      const result = await createUserMutation({
        adminClerkId: clerkUser.id,
        email: singleInviteForm.email.trim(),
        name: singleInviteForm.name.trim(),
        role: 'student',
        university_id: user.university_id as any,
      });

      toast({
        title: 'Student Created',
        description: `Activation email sent to ${singleInviteForm.email}`,
      });
      setInviteDialogOpen(false);
      setSingleInviteForm({ name: '', email: '', departmentId: '' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create student',
        variant: 'destructive',
      });
    } finally {
      setInviting(false);
    }
  };

  // Bulk invite from CSV
  const handleBulkInvite = async () => {
    if (csvData.length === 0 || !clerkUser?.id || !user?.university_id) return;

    setInviting(true);
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    try {
      // Create all students with activation emails
      for (const student of csvData) {
        try {
          await createUserMutation({
            adminClerkId: clerkUser.id,
            email: student.email.trim(),
            name: student.name.trim(),
            role: 'student',
            university_id: user.university_id as any,
          });
          successCount++;
        } catch (e: any) {
          errorCount++;
          errors.push(`${student.email}: ${e?.message || 'Unknown error'}`);
        }
      }

      if (successCount > 0) {
        toast({
          title: 'Students Created',
          description: `Successfully created ${successCount} student${successCount > 1 ? 's' : ''} and sent activation emails${errorCount > 0 ? `. ${errorCount} failed.` : ''}`,
        });
      }

      if (errorCount > 0 && successCount === 0) {
        toast({
          title: 'All Failed',
          description: errors.join('; '),
          variant: 'destructive',
        });
      }

      setCsvDialogOpen(false);
      setCsvFile(null);
      setCsvData([]);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create students',
        variant: 'destructive',
      });
    } finally {
      setInviting(false);
    }
  };

  // Get status badge
  const getStatusBadge = (accountStatus?: string) => {
    switch (accountStatus) {
      case 'active':
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case 'pending_activation':
        return (
          <Badge variant="secondary">
            <Mail className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'suspended':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Suspended
          </Badge>
        );
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  // Handle student action menu
  const handleStudentDetails = (student: any) => {
    setSelectedStudent(student);
    setNewStatus(student.account_status || 'active');
    setNewDepartmentId(student.department_id || 'none');
    setStudentDetailsOpen(true);
  };

  const handleViewProfile = (clerkId: string) => {
    router.push(`/profile/${clerkId}`);
  };

  const handleUpdateStatus = async () => {
    if (!selectedStudent || !newStatus) return;

    setEditingStatus(true);
    try {
      await updateUserByIdMutation({
        id: selectedStudent._id,
        updates: {
          account_status: newStatus as 'active' | 'suspended' | 'pending_activation',
        },
      });
      toast({
        title: 'Status Updated',
        description: `Student status changed to ${newStatus}`,
      });
      setStudentDetailsOpen(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update student status',
        variant: 'destructive',
      });
    } finally {
      setEditingStatus(false);
    }
  };

  const handleUpdateDepartment = async () => {
    if (!selectedStudent) return;

    setEditingDepartment(true);
    try {
      // Validate department ID if not "none"
      let departmentIdToSet: string | undefined = undefined;
      if (newDepartmentId !== 'none') {
        // Check if the department exists
        const selectedDept = departments?.find((dept: any) => dept._id === newDepartmentId);
        if (!selectedDept) {
          throw new Error('Selected department does not exist');
        }
        departmentIdToSet = newDepartmentId;
      }

      await updateUserByIdMutation({
        id: selectedStudent._id,
        updates: {
          department_id: departmentIdToSet as any,
        },
      });
      toast({
        title: 'Department Updated',
        description: 'Student department assignment updated successfully',
      });
      setStudentDetailsOpen(false);
    } catch (error: any) {
      console.error('Department update error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update department',
        variant: 'destructive',
      });
    } finally {
      setEditingDepartment(false);
    }
  };

  const handleResendInvite = async () => {
    if (!selectedStudent?._id || !clerkUser?.id) return;

    // Check if the student is already active
    if (selectedStudent.account_status === 'active') {
      toast({
        title: 'Already Active',
        description: "This user account is already active and doesn't need activation.",
        variant: 'default',
      });
      return;
    }

    setResendingInvite(true);
    try {
      // Use the regenerate activation token mutation
      const result = await regenerateActivationMutation({
        adminClerkId: clerkUser.id,
        userId: selectedStudent._id as any,
      });

      if (result.success) {
        toast({
          title: 'Activation Email Resent',
          description: `New activation email has been sent to ${selectedStudent.email}`,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to resend activation email',
        variant: 'destructive',
      });
    } finally {
      setResendingInvite(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedStudent?.clerkId) return;

    setDeletingUser(true);
    try {
      await softDeleteUserAction({
        targetClerkId: selectedStudent.clerkId,
        reason: 'Deleted by university admin',
      });

      toast({
        title: 'Student Deleted',
        description: `${selectedStudent.name} has been removed from the system.`,
      });

      setDeleteConfirmOpen(false);
      setStudentDetailsOpen(false);
      setSelectedStudent(null);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete student',
        variant: 'destructive',
      });
    } finally {
      setDeletingUser(false);
    }
  };

  // Early return checks
  if (!canAccess) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle>Unauthorized</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              You do not have access to University Student Management.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!students) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#0C29AB]">Students</h1>
          <p className="text-muted-foreground">
            Manage student accounts, track progress, and invite new students
          </p>
        </div>
        <div className="flex items-center gap-2">
          <UniversitySearchCommand />
          <Button variant="outline" onClick={() => setInviteDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Student
          </Button>
          <Button onClick={() => setCsvDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Bulk Import
          </Button>
        </div>
      </div>

      {/* View Toggle Buttons */}
      <div className="flex gap-2 bg-gray-50 p-3 rounded-lg">
        <Button
          size="sm"
          variant={activeView === 'students' ? 'default' : 'outline'}
          onClick={() => setActiveView('students')}
          className={activeView === 'students' ? 'bg-[#0C29AB]' : ''}
        >
          <UserIcon className="h-4 w-4 mr-2" />
          Students
        </Button>
        <Button
          size="sm"
          variant={activeView === 'progress' ? 'default' : 'outline'}
          onClick={() => setActiveView('progress')}
          className={activeView === 'progress' ? 'bg-[#0C29AB]' : ''}
        >
          <LineChart className="h-4 w-4 mr-2" />
          Student Progress
        </Button>
      </div>

      {activeView === 'students' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{students.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Active</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {students.filter((s) => s.account_status === 'active').length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">
                  {students.filter((s) => s.account_status === 'pending_activation').length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Suspended</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {students.filter((s) => s.account_status === 'suspended').length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Students Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Students</CardTitle>
              <CardDescription>Manage student accounts and track activation status</CardDescription>
            </CardHeader>
            <CardContent>
              {students.length === 0 ? (
                <div className="text-center py-12">
                  <UserIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground mb-4">No students found.</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Start by inviting students individually or via CSV import
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" onClick={() => setInviteDialogOpen(true)}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Invite Student
                    </Button>
                    <Button onClick={() => setCsvDialogOpen(true)}>
                      <Upload className="h-4 w-4 mr-2" />
                      Bulk Import
                    </Button>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Profile</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s: any) => (
                      <TableRow
                        key={String(s._id)}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleStudentDetails(s)}
                      >
                        <TableCell>
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={s.profile_image} alt={s.name} />
                            <AvatarFallback className="text-xs">
                              {s.name
                                ?.split(' ')
                                .map((n: string) => n[0])
                                .join('')
                                .toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                        </TableCell>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>{s.email}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {s.department_id
                            ? departments?.find((d: any) => d._id === s.department_id)?.name ||
                              'Unknown'
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {s.role}
                          </Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(s.account_status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(s.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewProfile(s.clerkId)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Career Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStudentDetails(s)}>
                                <Building2 className="h-4 w-4 mr-2" />
                                Add to Department
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStudentDetails(s)}>
                                <UserX className="h-4 w-4 mr-2" />
                                Change Account Status
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Single Invite Dialog */}
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Student</DialogTitle>
                <DialogDescription>
                  Send an invitation email to a student to create their account
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="student-name">Student Name *</Label>
                  <Input
                    id="student-name"
                    placeholder="John Doe"
                    value={singleInviteForm.name}
                    onChange={(e) =>
                      setSingleInviteForm({
                        ...singleInviteForm,
                        name: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="student-email">Email Address *</Label>
                  <Input
                    id="student-email"
                    type="email"
                    placeholder="john.doe@university.edu"
                    value={singleInviteForm.email}
                    onChange={(e) =>
                      setSingleInviteForm({
                        ...singleInviteForm,
                        email: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="student-department">Department (Optional)</Label>
                  <Select
                    value={singleInviteForm.departmentId || 'none'}
                    onValueChange={(value) =>
                      setSingleInviteForm({
                        ...singleInviteForm,
                        departmentId: value === 'none' ? '' : value,
                      })
                    }
                  >
                    <SelectTrigger id="student-department">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {departments?.map((dept: any) => (
                        <SelectItem key={dept._id} value={dept._id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSingleInvite}
                  disabled={
                    inviting || !singleInviteForm.name.trim() || !singleInviteForm.email.trim()
                  }
                >
                  {inviting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  Send Invitation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* CSV Bulk Import Dialog */}
          <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Bulk Import Students</DialogTitle>
                <DialogDescription>
                  Upload a CSV file to invite multiple students at once
                </DialogDescription>
              </DialogHeader>
              <Tabs defaultValue="upload">
                <TabsList className="grid grid-cols-2">
                  <TabsTrigger value="upload">Upload CSV</TabsTrigger>
                  <TabsTrigger value="preview">Preview ({csvData.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="upload" className="space-y-4">
                  <div>
                    <Label>CSV Format</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Your CSV file should have two columns: Name and Email
                    </p>
                    <Button variant="outline" size="sm" onClick={downloadTemplate}>
                      <Download className="h-3 w-3 mr-2" />
                      Download Template
                    </Button>
                  </div>
                  <div>
                    <Label htmlFor="csv-file">Upload CSV File</Label>
                    <Input id="csv-file" type="file" accept=".csv" onChange={handleCSVUpload} />
                    {parseError && <p className="text-sm text-red-600 mt-2">{parseError}</p>}
                  </div>
                </TabsContent>
                <TabsContent value="preview">
                  {csvData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Upload className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No data to preview. Upload a CSV file first.</p>
                    </div>
                  ) : (
                    <div className="max-h-96 overflow-y-auto border rounded">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {csvData.map((student, index) => (
                            <TableRow key={index}>
                              <TableCell>{student.name}</TableCell>
                              <TableCell>{student.email}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCsvDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleBulkInvite} disabled={inviting || csvData.length === 0}>
                  {inviting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  Send {csvData.length} Invitations
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* Student Progress View */}
      {activeView === 'progress' && (
        <div className="space-y-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Active Students This Month</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <Users className="h-5 w-5 text-muted-foreground mr-2" />
                  <div className="text-2xl font-bold">
                    {students?.filter(
                      (s: any) =>
                        (s.role === 'user' || s.role === 'student') &&
                        s.last_active &&
                        Date.now() - s.last_active < 30 * 24 * 60 * 60 * 1000,
                    ).length || 0}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Unique students who engaged
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Average Applications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <Target className="h-5 w-5 text-green-600 mr-2" aria-hidden="true" />
                  <div className="text-2xl font-bold">{assetStats?.avgApplications ?? '--'}</div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {assetStats
                    ? `${assetStats.studentsWithApplications} students active`
                    : 'Per student average'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Average Goals Set</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 text-blue-600 mr-2" aria-hidden="true" />
                  <div className="text-2xl font-bold">{assetStats?.avgGoals ?? '--'}</div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {assetStats
                    ? `${assetStats.studentsWithGoals} students with goals`
                    : 'Per student average'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">At-Risk Students</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-orange-500 mr-2" />
                  <div className="text-2xl font-bold text-orange-600">
                    {students?.filter(
                      (s: any) =>
                        (s.role === 'user' || s.role === 'student') &&
                        (!s.last_active || Date.now() - s.last_active > 60 * 24 * 60 * 60 * 1000),
                    ).length || 0}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {students?.filter((s: any) => s.role === 'user' || s.role === 'student').length >
                  0
                    ? Math.round(
                        ((students?.filter(
                          (s: any) =>
                            (s.role === 'user' || s.role === 'student') &&
                            (!s.last_active ||
                              Date.now() - s.last_active > 60 * 24 * 60 * 60 * 1000),
                        ).length || 0) /
                          students?.filter((s: any) => s.role === 'user' || s.role === 'student')
                            .length) *
                          100,
                      )
                    : 0}
                  % of total students
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Progress Overview Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Asset Completion Breakdown</CardTitle>
                <CardDescription>
                  Progress across different career development tools
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!assetStats || assetStats.totalStudents === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="h-12 w-12 mx-auto mb-2 opacity-30" aria-hidden="true" />
                    <p className="font-medium">No data available</p>
                    <p className="text-sm mt-1">Asset data appears as students create content</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Resumes</span>
                        <span className="font-medium">
                          {assetStats.studentsWithResume} / {assetStats.totalStudents} students
                        </span>
                      </div>
                      <Progress
                        value={(assetStats.studentsWithResume / assetStats.totalStudents) * 100}
                        className="h-2"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Cover Letters</span>
                        <span className="font-medium">
                          {assetStats.studentsWithCoverLetter} / {assetStats.totalStudents} students
                        </span>
                      </div>
                      <Progress
                        value={
                          (assetStats.studentsWithCoverLetter / assetStats.totalStudents) * 100
                        }
                        className="h-2"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Goals</span>
                        <span className="font-medium">
                          {assetStats.studentsWithGoals} / {assetStats.totalStudents} students
                        </span>
                      </div>
                      <Progress
                        value={(assetStats.studentsWithGoals / assetStats.totalStudents) * 100}
                        className="h-2"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Applications</span>
                        <span className="font-medium">
                          {assetStats.studentsWithApplications} / {assetStats.totalStudents}{' '}
                          students
                        </span>
                      </div>
                      <Progress
                        value={
                          (assetStats.studentsWithApplications / assetStats.totalStudents) * 100
                        }
                        className="h-2"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Engagement Trends</CardTitle>
                <CardDescription>Weekly activity over the past 4 weeks</CardDescription>
              </CardHeader>
              <CardContent>
                {!activityTrends?.weeklyTrends || activityTrends.weeklyTrends.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-30" aria-hidden="true" />
                    <p className="font-medium">No activity data</p>
                    <p className="text-sm mt-1">Activity trends will appear as students engage</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activityTrends.weeklyTrends.map((week, idx) => (
                      <div key={week.week}>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Week of {week.week}</span>
                          <span className="font-medium">{week.uniqueUsers} active students</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={
                              activityTrends.weeklyTrends.length > 0
                                ? (week.uniqueUsers /
                                    Math.max(
                                      ...activityTrends.weeklyTrends.map((w) => w.uniqueUsers),
                                      1,
                                    )) *
                                  100
                                : 0
                            }
                            className="h-2 flex-1"
                          />
                          <span className="text-xs text-muted-foreground w-16">
                            {week.events} events
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* At-Risk Students Table */}
          <Card>
            <CardHeader>
              <CardTitle>At-Risk Students</CardTitle>
              <CardDescription>
                Students with low usage or low progress who may need outreach
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students
                    ?.filter(
                      (s: any) =>
                        (s.role === 'user' || s.role === 'student') &&
                        (!s.last_active || Date.now() - s.last_active > 60 * 24 * 60 * 60 * 1000),
                    )
                    .slice(0, 5)
                    .map((s: any) => (
                      <TableRow
                        key={String(s._id)}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleViewProfile(s.clerkId)}
                      >
                        <TableCell className="font-medium">{s.name || 'Unnamed'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{s.email}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {s.last_active ? new Date(s.last_active).toLocaleDateString() : 'Never'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive" className="bg-orange-500">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            At Risk
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              {students?.filter(
                (s: any) =>
                  (s.role === 'user' || s.role === 'student') &&
                  (!s.last_active || Date.now() - s.last_active > 60 * 24 * 60 * 60 * 1000),
              ).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p>No at-risk students! All students are engaged.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Student Details Dialog */}
      <Dialog open={studentDetailsOpen} onOpenChange={setStudentDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Student Details</DialogTitle>
            <DialogDescription>View and manage student account information</DialogDescription>
          </DialogHeader>
          {selectedStudent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Name</Label>
                  <p className="text-sm font-medium">{selectedStudent.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                  <p className="text-sm">{selectedStudent.email}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-sm font-medium text-muted-foreground">Advisor Notes</Label>
                  <div className="mt-1">
                    <CommentButton
                      targetType="profile"
                      targetId={selectedStudent._id}
                      studentId={selectedStudent._id}
                      section="general"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Role</Label>
                  <Badge variant="outline" className="capitalize">
                    {selectedStudent.role}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Created</Label>
                  <p className="text-sm">
                    {new Date(selectedStudent.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Last Active</Label>
                  <p className="text-sm">
                    {selectedStudent.last_active
                      ? new Date(selectedStudent.last_active).toLocaleDateString()
                      : 'Never'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Current Status
                  </Label>
                  <div className="mt-1">{getStatusBadge(selectedStudent.account_status)}</div>
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <div>
                  <Label className="text-sm font-medium">Department</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Assign student to a department for organizational purposes
                  </p>
                  <div className="flex gap-2 items-center">
                    <Select value={newDepartmentId} onValueChange={setNewDepartmentId}>
                      <SelectTrigger className="w-[250px]">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {departments?.map((dept: any) => (
                          <SelectItem key={dept._id} value={dept._id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleUpdateDepartment}
                      disabled={
                        editingDepartment ||
                        newDepartmentId === (selectedStudent.department_id || 'none')
                      }
                      size="sm"
                    >
                      {editingDepartment ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Updating...
                        </>
                      ) : (
                        'Update'
                      )}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Account Status</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Changing status to "suspended" will free up a license seat
                  </p>
                  <div className="flex gap-2 items-center">
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="pending_activation">Pending Activation</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleUpdateStatus}
                      disabled={editingStatus || newStatus === selectedStudent.account_status}
                      size="sm"
                    >
                      {editingStatus ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Updating...
                        </>
                      ) : (
                        'Update'
                      )}
                    </Button>
                  </div>
                  {selectedStudent.account_status === 'pending_activation' && (
                    <div className="mt-3">
                      <Button
                        onClick={handleResendInvite}
                        disabled={resendingInvite}
                        size="sm"
                        variant="outline"
                      >
                        {resendingInvite ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Mail className="h-4 w-4 mr-2" />
                            Resend Invite Email
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-between items-center">
            <Button
              variant="destructive"
              onClick={() => setDeleteConfirmOpen(true)}
              className="mr-auto"
            >
              <UserX className="h-4 w-4 mr-2" />
              Delete Student
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStudentDetailsOpen(false)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  if (selectedStudent?.clerkId) {
                    handleViewProfile(selectedStudent.clerkId);
                    setStudentDetailsOpen(false);
                  }
                }}
                disabled={!selectedStudent?.clerkId}
                title={!selectedStudent?.clerkId ? 'Student must activate their account first' : ''}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Career Profile
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Student Account
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the student account and
              remove all associated data.
            </DialogDescription>
          </DialogHeader>
          {selectedStudent && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-4">
              <p className="text-sm font-medium text-red-900">You are about to delete:</p>
              <p className="text-sm text-red-800 mt-2">
                <strong>Name:</strong> {selectedStudent.name}
              </p>
              <p className="text-sm text-red-800">
                <strong>Email:</strong> {selectedStudent.email}
              </p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Are you sure you want to permanently delete this student? This will:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
            <li>Remove the student from all systems</li>
            <li>Delete all career data (resumes, applications, goals, etc.)</li>
            <li>Free up a license seat</li>
            <li>Cannot be recovered</li>
          </ul>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deletingUser}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={deletingUser}>
              {deletingUser ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <UserX className="h-4 w-4 mr-2" />
                  Yes, Delete Student
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
