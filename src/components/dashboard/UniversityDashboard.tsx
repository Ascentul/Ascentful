'use client';

import { useAuth as useClerkAuth, useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import {
  AlertTriangle,
  Award,
  BarChart as BarChartIcon,
  BarChart3,
  BookOpen,
  Briefcase,
  ClipboardList,
  FileText,
  GraduationCap,
  Loader2,
  Mail,
  MoreVertical,
  Target,
  TrendingUp,
  UserRound,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  Dialog,
  DialogClose,
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useToast } from '@/hooks/use-toast';
import { hasAdvisorAccess, hasUniversityAdminAccess } from '@/lib/constants/roles';

import {
  AssignLicensesDialog,
  DeleteStudentDialog,
  EditStudentDialog,
  ExportReportDialog,
  ViewReportDialog,
} from './university/dialogs';
import { useAnalyticsTransforms, useStudentFilters, useUniversityData } from './university/hooks';
import {
  AnalyticsTab,
  DepartmentsTab,
  OverviewTab,
  StudentsTab,
  UsageTab,
} from './university/tabs';
import type {
  AssignLicensesData,
  Department,
  EditStudentFormData,
  Student,
  StudentProgress,
} from './university/types';

export function UniversityDashboard() {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const { getToken } = useClerkAuth();
  const { user, isLoading: authLoading } = useAuth();
  const { impersonation, getEffectiveRole } = useImpersonation();
  const [activeTab, setActiveTab] = useState('overview');
  const [analyticsView, setAnalyticsView] = useState<'engagement' | 'features' | 'risk'>(
    'engagement',
  );
  const { toast } = useToast();

  // Filter states are managed by useStudentFilters hook (declared after data fetching)

  // Platform Usage states
  const [usageTimeFilter, setUsageTimeFilter] = useState('Last 3 months');
  const [usageProgramFilter, setUsageProgramFilter] = useState('All Programs');
  const [usageView, setUsageView] = useState<'overview' | 'features' | 'programs'>('overview');

  // Dialog open states
  const [assignOpen, setAssignOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [viewReportOpen, setViewReportOpen] = useState(false);
  const [viewingReport, setViewingReport] = useState<{ name: string; type: string } | null>(null);

  // Invite students form state (used by inline invite tab - will be extracted in Phase 3)
  const [assignText, setAssignText] = useState('');
  const [assignRole, setAssignRole] = useState<'student' | 'advisor'>('student');
  const [selectedProgram, setSelectedProgram] = useState<Id<'departments'> | 'none'>('none');
  const [assigning, setAssigning] = useState(false);
  const [importingEmails, setImportingEmails] = useState(false);

  // Student filtering state
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Student management state
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: 'student',
  });
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<any>(null);
  const [updatingStudent, setUpdatingStudent] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState(false);

  // Profile load timeout state - prevents infinite spinner if Convex profile fails to load
  const [profileLoadTimedOut, setProfileLoadTimedOut] = useState(false);

  // Timeout for profile loading - if Clerk is loaded but Convex user is missing for too long
  useEffect(() => {
    // Only start timeout if Clerk user exists but Convex profile is missing and not loading
    if (clerkUser && !user && !authLoading) {
      const timeout = setTimeout(() => {
        setProfileLoadTimedOut(true);
      }, 10000); // 10 second timeout

      return () => clearTimeout(timeout);
    }
    // Reset timeout state if user becomes available
    if (user) {
      setProfileLoadTimedOut(false);
    }
  }, [clerkUser, user, authLoading]);

  // Get effective role (respects impersonation)
  const effectiveRole = getEffectiveRole();
  const isUniversityAdmin = hasUniversityAdminAccess(effectiveRole);

  // Redirect based on effective role when impersonating
  useEffect(() => {
    if (impersonation.isImpersonating) {
      // Redirect to admin if impersonating super_admin
      if (effectiveRole === 'super_admin') {
        router.replace('/admin');
        return;
      }
      // Redirect to regular dashboard if impersonating student/individual/staff/advisor
      if (effectiveRole !== 'university_admin') {
        router.replace('/dashboard');
        return;
      }
    }
  }, [impersonation.isImpersonating, effectiveRole, router]);

  // Data fetching via custom hook
  const {
    overview,
    students,
    departments,
    analytics,
    studentMetrics,
    studentProgress,
    studentFunnel,
    activeUsersData,
    momentumDistribution,
    studentGrowthData,
    activityData,
    departmentStats,
    isLoading: dataLoading,
  } = useUniversityData({
    clerkUserId: clerkUser?.id,
    universityId: user?.university_id as Id<'universities'> | undefined,
    usageProgramFilter,
  });

  // Student filtering via custom hook
  const {
    roleFilter,
    statusFilter,
    searchQuery,
    setRoleFilter,
    setStatusFilter,
    setSearchQuery,
    filteredStudents,
  } = useStudentFilters(students as Student[] | undefined);

  // Analytics data transformations via custom hook
  const {
    departmentDistributionData,
    topFeaturesData,
    progressCompletionData,
    atRiskStudentsData,
    featureEngagementByRisk,
    filteredPlatformUsageData: platformUsageData,
  } = useAnalyticsTransforms({
    overview,
    studentMetrics,
    studentProgress,
    platformUsageData: analytics?.platformUsageData,
    usageTimeFilter,
  });

  // Assign student licenses
  const assignStudent = useMutation(api.university_admin.assignStudentByEmail);

  // Student management mutations
  const updateStudentMutation = useMutation(api.university_admin.updateStudentByAdmin);
  const removeStudentMutation = useMutation(api.university_admin.removeStudentFromUniversity);
  const resendInvitationMutation = useMutation(api.admin_users.regenerateActivationToken);

  /**
   * Shared helper for assigning students and sending activation emails.
   * Used by both "Invite Students" and "Assign Licenses" modals.
   */
  const assignStudentsWithInvitations = async ({
    emailsText,
    role,
    departmentId,
  }: {
    emailsText: string;
    role: 'student' | 'advisor';
    departmentId?: Id<'departments'>;
  }): Promise<{ success: boolean; successCount: number }> => {
    if (!clerkUser?.id) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to assign students',
        variant: 'destructive',
      });
      return { success: false, successCount: 0 };
    }

    const emails = Array.from(
      new Set(
        emailsText
          .split(/[\n,]+/)
          .map((e) => e.trim())
          .filter(Boolean),
      ),
    );

    if (emails.length === 0) {
      toast({
        title: 'No emails provided',
        description: 'Please enter at least one email address',
        variant: 'destructive',
      });
      return { success: false, successCount: 0 };
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    const successfulEmails: string[] = [];

    // Step 1: Assign students in Convex (creates pending users or updates existing)
    // Map 'advisor' to 'staff' for mutation schema compatibility
    const roleForApi = role === 'advisor' ? 'staff' : role;
    for (const email of emails) {
      try {
        await assignStudent({
          clerkId: clerkUser.id,
          email,
          role: roleForApi,
          departmentId,
        });
        successCount++;
        successfulEmails.push(email);
      } catch (e: any) {
        errorCount++;
        errors.push(`${email}: ${e?.message || 'Unknown error'}`);
      }
    }

    // Step 2: Send activation emails via API
    let emailSendFailed = false;
    if (successfulEmails.length > 0) {
      try {
        const response = await fetch('/api/university/send-invitations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emails: successfulEmails }),
        });

        if (!response.ok) {
          emailSendFailed = true;
          console.error('Failed to send some activation emails');
        }
      } catch (emailError) {
        emailSendFailed = true;
        console.error('Error sending activation emails:', emailError);
        // Don't fail the whole operation if email sending fails
      }
    }

    // Step 3: Show toast notifications
    if (successCount > 0) {
      toast({
        title: 'Students assigned successfully',
        description: `${successCount} student(s) assigned${emailSendFailed ? '' : ' and activation email(s) sent'}${errorCount > 0 ? `. ${errorCount} failed` : ''}${emailSendFailed ? ' (emails failed to send - students can still log in)' : ''}`,
        variant: errorCount > 0 || emailSendFailed ? 'default' : 'success',
      });
    }

    if (errorCount > 0 && successCount === 0) {
      toast({
        title: 'Assignment failed',
        description: errors.slice(0, 3).join('; ') + (errors.length > 3 ? '...' : ''),
        variant: 'destructive',
      });
    }

    return { success: successCount > 0, successCount };
  };

  // Access is role-based only - advisors, university_admin, and super_admin can access
  const hasAccess = !!user && hasAdvisorAccess(effectiveRole);

  // Show error state if profile failed to load after timeout
  if (profileLoadTimedOut && !user) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle>Profile Load Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Unable to load your user profile. This may be due to a network issue or a problem with
              your account setup.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => window.location.reload()}>
                Retry
              </Button>
              <Button variant="outline" onClick={() => router.push('/dashboard')}>
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading spinner while auth is loading or redirecting
  // This prevents flashing the Unauthorized card for roles that will be redirected
  if (authLoading || !clerkUser || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle>Unauthorized</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              You do not have access to the University Dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Report handlers
  const handleViewReport = (reportName: string, reportType: string) => {
    setViewingReport({ name: reportName, type: reportType });
    setViewReportOpen(true);
  };

  const handleDownloadReport = async (reportName: string, reportType: string) => {
    try {
      toast({
        title: 'Download Started',
        description: `Preparing ${reportName} for download...`,
      });

      // Get authentication token
      const token = await getToken({ template: 'convex' });
      if (!token) {
        toast({
          title: 'Authentication Error',
          description: 'Please log in again to download reports.',
          variant: 'destructive',
        });
        return;
      }

      // Call the export API
      const response = await fetch('/api/university/export-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          clerkId: clerkUser?.id,
          reportType: reportType,
          reportName: reportName,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = `${reportName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}`;
        a.download = `${filename}.csv`;
        document.body.appendChild(a);
        try {
          a.click();
        } finally {
          window.URL.revokeObjectURL(url);
          a.remove();
        }

        toast({
          title: 'Download Complete',
          description: `${reportName} downloaded successfully.`,
          variant: 'success',
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Download failed with status ${response.status}`;

        toast({
          title: 'Download Failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Download Failed',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Export function
  const handleExportReports = async (filename: string) => {
    try {
      // Get the session token for authentication
      const token = await getToken();
      if (!token) {
        toast({
          title: 'Authentication required',
          description: 'Please sign in to export reports',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch('/api/university/export-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          clerkId: clerkUser?.id,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.csv`;
        document.body.appendChild(a);
        try {
          a.click();
        } finally {
          window.URL.revokeObjectURL(url);
          a.remove();
        }
        toast({
          title: 'Export successful',
          description: 'Report downloaded successfully',
          variant: 'success',
        });
        setExportDialogOpen(false);
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Export failed with status ${response.status}`;

        // For university admin configuration issues, show a more helpful message
        if (errorMessage.includes('University admin account not properly configured')) {
          toast({
            title: 'Account Configuration Required',
            description:
              'Your university admin account needs to be assigned to a university. Please contact support for assistance.',
            variant: 'destructive',
            action: (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(
                    'mailto:support@ascentful.com?subject=University Admin Account Configuration',
                    '_blank',
                  )
                }
              >
                Contact Support
              </Button>
            ),
          });
          return;
        }

        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Unable to generate report',
        variant: 'destructive',
      });
    }
  };

  // Student management functions
  const handleEditStudent = (student: any) => {
    setEditingStudent(student);
    setEditForm({
      name: student.name || '',
      email: student.email || '',
      role: student.role === 'user' ? 'student' : student.role || 'student',
    });
    setEditOpen(true);
  };

  const handleUpdateStudent = async () => {
    if (!clerkUser?.id || !editingStudent || !user?.university_id) return;

    setUpdatingStudent(true);
    try {
      const newRole = editForm.role as 'student' | 'advisor' | undefined;
      const roleChanged = newRole !== undefined && newRole !== editingStudent.role;

      const result = await updateStudentMutation({
        clerkId: clerkUser.id,
        studentId: editingStudent._id,
        updates: {
          name: editForm.name || undefined,
          // email removed - Clerk is source of truth for email
          role: newRole,
        },
      });

      // Sync role change to Clerk (Clerk is source of truth for auth)
      let clerkSyncFailed = false;
      if (roleChanged && result.studentClerkId) {
        try {
          const response = await fetch('/api/university/sync-student-role', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentClerkId: result.studentClerkId,
              universityId: user.university_id,
              newRole: newRole,
            }),
          });
          if (!response.ok) {
            clerkSyncFailed = true;
            console.error('Failed to sync role to Clerk:', await response.text());
          }
        } catch (syncError) {
          clerkSyncFailed = true;
          console.error('Failed to sync role to Clerk:', syncError);
        }
      }

      if (clerkSyncFailed) {
        toast({
          title: 'Student updated with warning',
          description:
            'Role updated locally but Clerk sync failed. The change may not take effect until the student logs out and back in.',
          variant: 'default',
        });
      } else {
        toast({
          title: 'Student updated',
          description: `${editForm.name || editingStudent.email} has been updated successfully.`,
          variant: 'success',
        });
      }
      setEditOpen(false);
      setEditingStudent(null);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to update student. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingStudent(false);
    }
  };

  const handleDeleteStudent = (student: any) => {
    setStudentToDelete(student);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteStudent = async () => {
    if (!clerkUser?.id || !studentToDelete || !user?.university_id) return;

    setDeletingStudent(true);
    try {
      await removeStudentMutation({
        clerkId: clerkUser.id,
        studentId: studentToDelete._id,
      });

      // Sync role change to Clerk (Clerk is source of truth for auth)
      // The mutation updated Convex role to 'individual', now sync to Clerk
      let clerkSyncFailed = false;
      if (studentToDelete.clerkId) {
        try {
          const response = await fetch('/api/university/remove-student-clerk-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentClerkId: studentToDelete.clerkId,
              universityId: user.university_id,
            }),
          });
          if (!response.ok) {
            clerkSyncFailed = true;
            console.error('Failed to sync role to Clerk:', await response.text());
          }
        } catch (syncError) {
          clerkSyncFailed = true;
          console.error('Failed to sync role to Clerk:', syncError);
        }
      }

      if (clerkSyncFailed) {
        toast({
          title: 'Student removed with warning',
          description:
            'Student removed locally but Clerk sync failed. Their access may not be fully revoked until they log out.',
          variant: 'default',
        });
      } else {
        toast({
          title: 'Student removed',
          description: `${studentToDelete.name || studentToDelete.email} has been removed from the university.`,
          variant: 'success',
        });
      }
      setDeleteConfirmOpen(false);
      setStudentToDelete(null);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to remove student. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeletingStudent(false);
    }
  };

  const handleResendInvitation = async (student: any) => {
    if (!clerkUser?.id) return;

    try {
      await resendInvitationMutation({
        adminClerkId: clerkUser.id,
        userId: student._id,
      });

      toast({
        title: 'Invitation sent',
        description: `Invitation resent to ${student.email}`,
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to send invitation. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Adapter for AssignLicensesDialog - converts the array-based interface to the text-based helper
  const handleAssignLicenses = async (data: AssignLicensesData) => {
    return await assignStudentsWithInvitations({
      emailsText: data.emails.join('\n'),
      role: data.role,
      departmentId: data.departmentId,
    });
  };

  if (!overview || !students || !departments) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-screen-2xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#0C29AB]">University Dashboard</h1>
          <p className="text-muted-foreground">
            Shared view of engagement, outcomes, and operations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
            onClick={() => setExportDialogOpen(true)}
          >
            Export Reports
          </button>
          {isUniversityAdmin && (
            <button
              className="inline-flex items-center rounded-md bg-primary text-white px-3 py-2 text-sm"
              onClick={() => setAssignOpen(true)}
            >
              Add Student Licenses
              {overview && overview.licenseCapacity && (
                <span className="ml-2 text-xs bg-white/20 px-2 py-1 rounded-full">
                  {Math.max(0, overview.licenseCapacity - (overview.activeLicenses ?? 0))} seats
                  left
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main Dashboard View Toggles */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeTab === 'overview' ? 'default' : 'outline'}
          onClick={() => setActiveTab('overview')}
          className={activeTab === 'overview' ? 'bg-[#0C29AB]' : ''}
        >
          Overview
        </Button>
        <Button
          variant={activeTab === 'analytics' ? 'default' : 'outline'}
          onClick={() => setActiveTab('analytics')}
          className={activeTab === 'analytics' ? 'bg-[#0C29AB]' : ''}
        >
          Analytics & Insights
        </Button>
        <Button
          variant={activeTab === 'students-list' ? 'default' : 'outline'}
          onClick={() => setActiveTab('students-list')}
          className={activeTab === 'students-list' ? 'bg-[#0C29AB]' : ''}
        >
          Students
        </Button>
        <Button
          variant={activeTab === 'departments' ? 'default' : 'outline'}
          onClick={() => setActiveTab('departments')}
          className={activeTab === 'departments' ? 'bg-[#0C29AB]' : ''}
        >
          Departments
        </Button>
        <Button
          variant={activeTab === 'usage' ? 'default' : 'outline'}
          onClick={() => setActiveTab('usage')}
          className={activeTab === 'usage' ? 'bg-[#0C29AB]' : ''}
        >
          Platform Usage
        </Button>
      </div>

      {/* Overview Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          clerkId={clerkUser?.id}
          overview={overview}
          studentMetrics={studentMetrics}
          students={students as Student[]}
          departments={departments as Department[]}
          studentProgress={studentProgress as StudentProgress[]}
          platformUsageData={platformUsageData}
          activityData={activityData}
          departmentDistributionData={departmentDistributionData}
          progressCompletionData={progressCompletionData}
          topFeaturesData={topFeaturesData}
          atRiskStudentsData={atRiskStudentsData}
          momentumDistribution={momentumDistribution}
          isUniversityAdmin={isUniversityAdmin}
          onStudentClick={(clerkId) => router.push(`/profile/${clerkId}`)}
        />
      )}

      {/* Analytics Tab Content */}
      {activeTab === 'analytics' && (
        <AnalyticsTab
          overview={overview}
          students={students as Student[]}
          activeUsersData={activeUsersData}
          studentFunnel={studentFunnel}
          activityData={activityData}
          topFeaturesData={topFeaturesData}
          atRiskStudentsData={atRiskStudentsData}
          featureEngagementByRisk={featureEngagementByRisk}
        />
      )}

      {/* Students Tab Content */}
      {(activeTab === 'students-list' ||
        activeTab === 'students-progress' ||
        activeTab === 'invite-students') && (
        <StudentsTab
          students={students as Student[]}
          departments={departments as Department[]}
          studentProgress={studentProgress as StudentProgress[]}
          studentMetrics={studentMetrics}
          overview={overview}
          onEditStudent={handleEditStudent}
          onStudentClick={(clerkId) => router.push(`/profile/${clerkId}`)}
          assignText={assignText}
          onAssignTextChange={setAssignText}
          assignRole={assignRole}
          onAssignRoleChange={setAssignRole}
          onAssign={async () => {
            setAssigning(true);
            try {
              const result = await assignStudentsWithInvitations({
                emailsText: assignText,
                role: assignRole,
                departmentId: selectedProgram !== 'none' ? selectedProgram : undefined,
              });
              if (result.success) {
                setAssignText('');
              }
            } finally {
              setAssigning(false);
            }
          }}
          assigning={assigning}
          importingEmails={importingEmails}
          onImportCsv={async (file: File) => {
            setImportingEmails(true);
            try {
              const text = await file.text();
              const emailsFromCsv = Array.from(
                text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi),
              ).map((m) => m[0]);
              const combined = [assignText, emailsFromCsv.join('\n')].filter(Boolean).join('\n');
              setAssignText(combined);
            } finally {
              setImportingEmails(false);
            }
          }}
        />
      )}

      {/* Departments Tab Content */}
      {activeTab === 'departments' && (
        <DepartmentsTab
          clerkId={clerkUser?.id}
          departments={departments as Department[]}
          students={students as Student[]}
          studentProgress={studentProgress as StudentProgress[]}
          overview={overview}
        />
      )}

      {/* Platform Usage Tab Content */}
      {activeTab === 'usage' && (
        <UsageTab
          clerkId={clerkUser?.id}
          departments={departments as Department[]}
          platformUsageData={platformUsageData}
          onViewReport={handleViewReport}
          onDownloadReport={handleDownloadReport}
        />
      )}

      {/* Extracted Dialog Components */}
      <EditStudentDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        student={editingStudent as Student | null}
        formData={editForm}
        onFormChange={setEditForm}
        onSave={handleUpdateStudent}
        isLoading={updatingStudent}
      />

      <DeleteStudentDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        student={studentToDelete as Student | null}
        onConfirm={confirmDeleteStudent}
        isLoading={deletingStudent}
      />

      <ExportReportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        defaultFilename={`university-report-${new Date().toISOString().split('T')[0]}`}
        onExport={handleExportReports}
      />

      <AssignLicensesDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        departments={departments || []}
        availableSeats={Math.max(
          0,
          (overview?.licenseCapacity ?? 0) - (overview?.activeLicenses ?? 0),
        )}
        totalSeats={overview?.licenseCapacity ?? 0}
        onAssign={handleAssignLicenses}
      />

      <ViewReportDialog
        open={viewReportOpen}
        onOpenChange={setViewReportOpen}
        reportName={viewingReport?.name || ''}
        reportType={viewingReport?.type || ''}
        clerkId={clerkUser?.id}
      />
    </div>
  );
}
