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
import { UniversitySearchCommand } from '@/components/university/UniversitySearchCommand';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useToast } from '@/hooks/use-toast';
import { hasAdvisorAccess, hasUniversityAdminAccess } from '@/lib/constants/roles';

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

  // Filter states - declared at top to avoid Rules of Hooks violation
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'advisor' | 'staff'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'pending'>(
    'all',
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Platform Usage states
  const [usageTimeFilter, setUsageTimeFilter] = useState('Last 3 months');
  const [usageProgramFilter, setUsageProgramFilter] = useState('All Programs');
  const [usageView, setUsageView] = useState<'overview' | 'features' | 'programs'>('overview');

  // Assign student licenses states
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignText, setAssignText] = useState('');
  const [assignRole, setAssignRole] = useState<'student' | 'advisor'>('student');
  const [selectedProgram, setSelectedProgram] = useState<Id<'departments'> | 'none'>('none');
  const [assigning, setAssigning] = useState(false);
  const [importingEmails, setImportingEmails] = useState(false);

  // Export dialog state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFilename, setExportFilename] = useState('');

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

  // Data fetching - must be before conditional returns (Rules of Hooks)
  const overview = useQuery(
    api.university_admin.getOverview,
    clerkUser?.id ? { clerkId: clerkUser.id } : 'skip',
  );
  const students = useQuery(
    api.university_admin.listStudents,
    clerkUser?.id ? { clerkId: clerkUser.id, limit: 500 } : 'skip', // Backend max is 500
  );
  const departments = useQuery(
    api.university_admin.listDepartments,
    clerkUser?.id ? { clerkId: clerkUser.id } : 'skip',
  );

  // Compute department ID for analytics filter
  const usageDepartmentId = React.useMemo(() => {
    if (usageProgramFilter === 'All Programs' || !departments) return undefined;
    const dept = departments.find((d) => d.name === usageProgramFilter);
    return dept?._id;
  }, [usageProgramFilter, departments]);

  const analytics = useQuery(
    api.university_admin.getUniversityAnalytics,
    clerkUser?.id
      ? {
          clerkId: clerkUser.id,
          departmentId: usageDepartmentId,
        }
      : 'skip',
  );
  const studentMetrics = useQuery(
    api.university_admin.getStudentMetrics,
    clerkUser?.id ? { clerkId: clerkUser.id } : 'skip',
  );
  const studentProgress = useQuery(
    api.university_admin.getStudentProgress,
    clerkUser?.id ? { clerkId: clerkUser.id } : 'skip',
  );

  // Real student funnel data
  const studentFunnel = useQuery(
    api.analytics.getUniversityStudentFunnel,
    user?.university_id ? { universityId: user.university_id as Id<'universities'> } : 'skip',
  );

  // Real active users data for engagement view
  const activeUsersData = useQuery(
    api.analytics.getUniversityActiveUsersOverTime,
    user?.university_id
      ? { universityId: user.university_id as Id<'universities'>, timeRange: 'daily' as const }
      : 'skip',
  );

  // Helper function to get department ID from name
  const getDepartmentIdFromName = React.useCallback(
    (name: string): Id<'departments'> | undefined => {
      if (!departments || name === 'All Programs') return undefined;
      const dept = departments.find((d) => d.name === name);
      return dept?._id;
    },
    [departments],
  );

  // Use real analytics data from database
  const studentGrowthData = analytics?.studentGrowthData || [];
  const activityData = analytics?.activityData || [];
  const departmentStats = analytics?.departmentStats || [];

  // Filter platform usage data based on time filter
  const filteredPlatformUsageData = useMemo(() => {
    if (!analytics?.platformUsageData) return [];

    const data = analytics.platformUsageData;
    switch (usageTimeFilter) {
      case 'Last month':
        return data.slice(-1);
      case 'Last 3 months':
        return data.slice(-3);
      case 'Last 6 months':
        return data.slice(-6);
      default:
        return data; // All data
    }
  }, [analytics?.platformUsageData, usageTimeFilter]);

  const platformUsageData = filteredPlatformUsageData;

  // Use server-computed department distribution for accuracy at scale
  const departmentDistributionData = useMemo(() => {
    if (!overview?.departmentDistribution) return [];

    const data = overview.departmentDistribution
      .filter((d: any) => d.count > 0)
      .map((d: any) => ({
        name: d.name,
        value: d.percentage,
        count: d.count,
      }));

    // Add unassigned students
    if ((overview.unassignedStudents ?? 0) > 0) {
      const total = overview.totalStudents ?? 0;
      data.push({
        name: 'Not Assigned',
        value: total > 0 ? Math.round((overview.unassignedStudents / total) * 100) : 0,
        count: overview.unassignedStudents,
      });
    }

    return data;
  }, [overview]);

  const topFeaturesData = useMemo(() => {
    if (!studentMetrics) return [];

    return [
      { feature: 'Resume Builder', usage: studentMetrics.totalResumes },
      { feature: 'Goal Setting', usage: studentMetrics.totalGoals },
      { feature: 'Job Applications', usage: studentMetrics.totalApplications },
      { feature: 'Cover Letters', usage: studentMetrics.totalCoverLetters },
      { feature: 'Projects', usage: studentMetrics.totalProjects || 0 },
    ].sort((a, b) => b.usage - a.usage);
  }, [studentMetrics]);

  const progressCompletionData = useMemo(() => {
    if (!studentProgress || studentProgress.length === 0) return [];

    const completed = studentProgress.filter((s) => s.completion >= 80).length;
    const inProgress = studentProgress.filter((s) => s.completion > 20 && s.completion < 80).length;
    const notStarted = studentProgress.filter((s) => s.completion <= 20).length;
    const total = studentProgress.length;

    return [
      { name: 'Completed', value: Math.round((completed / total) * 100), count: completed },
      { name: 'In Progress', value: Math.round((inProgress / total) * 100), count: inProgress },
      { name: 'Not Started', value: Math.round((notStarted / total) * 100), count: notStarted },
    ];
  }, [studentProgress]);

  const atRiskStudentsData = useMemo(() => {
    if (!studentProgress || studentProgress.length === 0) return [];

    const highRisk = studentProgress.filter((s) => s.completion < 20).length;
    const mediumRisk = studentProgress.filter(
      (s) => s.completion >= 20 && s.completion < 50,
    ).length;
    const lowRisk = studentProgress.filter((s) => s.completion >= 50).length;

    return [
      { segment: 'High Risk', count: highRisk, color: '#EF4444' },
      { segment: 'Medium Risk', count: mediumRisk, color: '#F59E0B' },
      { segment: 'Low Risk', count: lowRisk, color: '#10B981' },
    ];
  }, [studentProgress]);

  // Feature engagement by risk level - computed from real student progress data
  const featureEngagementByRisk = useMemo(() => {
    if (!studentProgress || studentProgress.length === 0) {
      return [
        { feature: 'Resume Builder', highRisk: 0, mediumRisk: 0, lowRisk: 0 },
        { feature: 'Applications', highRisk: 0, mediumRisk: 0, lowRisk: 0 },
        { feature: 'Goals', highRisk: 0, mediumRisk: 0, lowRisk: 0 },
        { feature: 'Networking', highRisk: 0, mediumRisk: 0, lowRisk: 0 },
      ];
    }

    // Categorize students by risk level
    const highRiskStudents = studentProgress.filter((s) => s.completion < 20);
    const mediumRiskStudents = studentProgress.filter(
      (s) => s.completion >= 20 && s.completion < 50,
    );
    const lowRiskStudents = studentProgress.filter((s) => s.completion >= 50);

    // Helper to calculate average, returning 0 if no students
    const avg = (students: typeof studentProgress, key: keyof (typeof studentProgress)[0]) => {
      if (students.length === 0) return 0;
      const sum = students.reduce((acc, s) => acc + (Number(s[key]) || 0), 0);
      return Math.round((sum / students.length) * 10) / 10; // Round to 1 decimal
    };

    return [
      {
        feature: 'Resume Builder',
        highRisk: avg(highRiskStudents, 'resumes'),
        mediumRisk: avg(mediumRiskStudents, 'resumes'),
        lowRisk: avg(lowRiskStudents, 'resumes'),
      },
      {
        feature: 'Applications',
        highRisk: avg(highRiskStudents, 'applications'),
        mediumRisk: avg(mediumRiskStudents, 'applications'),
        lowRisk: avg(lowRiskStudents, 'applications'),
      },
      {
        feature: 'Goals',
        highRisk: avg(highRiskStudents, 'goals'),
        mediumRisk: avg(mediumRiskStudents, 'goals'),
        lowRisk: avg(lowRiskStudents, 'goals'),
      },
      {
        feature: 'Projects',
        highRisk: avg(highRiskStudents, 'projects'),
        mediumRisk: avg(mediumRiskStudents, 'projects'),
        lowRisk: avg(lowRiskStudents, 'projects'),
      },
    ];
  }, [studentProgress]);

  // Filter students based on current filters
  const filteredStudents = useMemo(() => {
    if (!students) return [];

    return students.filter((student: any) => {
      // Role filter
      if (roleFilter !== 'all' && student.role !== roleFilter) return false;

      // Status filter
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
  const handleViewReport = async (_reportName: string, _reportType: string) => {
    toast({
      title: 'Coming Soon',
      description: 'Report viewing will be available in a future update.',
    });
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
          document.body.removeChild(a);
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
  const handleExportReports = async () => {
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
        const filename =
          exportFilename.trim() || `university-report-${new Date().toISOString().split('T')[0]}`;
        a.download = `${filename}.csv`;
        document.body.appendChild(a);
        try {
          a.click();
        } finally {
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
        toast({
          title: 'Export successful',
          description: 'Report downloaded successfully',
          variant: 'success',
        });
        setExportDialogOpen(false);
        setExportFilename('');
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
          <UniversitySearchCommand />
          <button
            className="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
            onClick={() => {
              setExportFilename(`university-report-${new Date().toISOString().split('T')[0]}`);
              setExportDialogOpen(true);
            }}
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
                  {overview.licenseCapacity - (overview.activeLicenses ?? 0)} seats left
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
        <>
          {isUniversityAdmin && (
            <Card className="border-dashed bg-white/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Admin Shortcuts</CardTitle>
                <CardDescription>Quick access to configuration screens.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/u/admin/departments">Departments</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/u/admin/courses">Courses</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/u/admin/invite">Invitations</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/u/admin/settings">Settings</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Active Students This Month</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <Users className="h-5 w-5 text-muted-foreground mr-2" />
                  <div className="text-2xl font-bold">{overview?.activeStudents ?? 0}</div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Unique students who engaged
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Average Asset Completion</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <Target className="h-5 w-5 text-muted-foreground mr-2" />
                  <div className="text-2xl font-bold">
                    {studentMetrics?.avgCareerCompletion || 0}%
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">Career assets completed</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Total Applications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <Briefcase className="h-5 w-5 text-muted-foreground mr-2" />
                  <div className="text-2xl font-bold">{studentMetrics?.totalApplications || 0}</div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">Job applications submitted</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">At-Risk Students</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-muted-foreground mr-2" />
                  <div className="text-2xl font-bold">
                    {studentProgress?.filter((s) => s.completion < 30).length || 0}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {(overview?.totalStudents ?? 0) > 0
                    ? Math.round(
                        ((studentProgress?.filter((s) => s.completion < 30).length || 0) /
                          (overview?.totalStudents ?? 1)) *
                          100,
                      )
                    : 0}
                  % of total students
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Section */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{overview.totalStudents}</div>
                  {overview.studentGrowthPercent !== undefined &&
                    overview.studentGrowthPercent !== 0 && (
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <TrendingUp
                          className={`h-3 w-3 ${overview.studentGrowthPercent > 0 ? 'text-green-500' : 'text-red-500'}`}
                        />
                        <span
                          className={
                            overview.studentGrowthPercent > 0 ? 'text-green-500' : 'text-red-500'
                          }
                        >
                          {overview.studentGrowthPercent > 0 ? '+' : ''}
                          {overview.studentGrowthPercent}%
                        </span>
                        <span>from last month</span>
                      </div>
                    )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">License Usage</CardTitle>
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {overview.activeLicenses} / {overview.licenseCapacity}
                  </div>
                  <Progress
                    value={
                      overview.licenseCapacity
                        ? (overview.activeLicenses / overview.licenseCapacity) * 100
                        : 0
                    }
                    className="mt-2 h-2"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">Active Students</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center">
                    <Users className="h-5 w-5 text-muted-foreground mr-2" />
                    <div className="text-2xl font-bold">{overview.activeStudents ?? 0}</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">This month</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">Applications</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center">
                    <Award className="h-5 w-5 text-muted-foreground mr-2" />
                    <div className="text-2xl font-bold">0</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Tracked this semester</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Platform Usage</CardTitle>
                  <CardDescription>
                    Monthly feature adoption and student engagement over the last 6 months
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={platformUsageData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="goals"
                        stroke="#4F46E5"
                        strokeWidth={2}
                        name="Goals Set"
                      />
                      <Line
                        type="monotone"
                        dataKey="applications"
                        stroke="#10B981"
                        strokeWidth={2}
                        name="Applications"
                      />
                      <Line
                        type="monotone"
                        dataKey="resumes"
                        stroke="#F59E0B"
                        strokeWidth={2}
                        name="Resumes"
                      />
                      <Line
                        type="monotone"
                        dataKey="coverLetters"
                        stroke="#EF4444"
                        strokeWidth={2}
                        name="Cover Letters"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Weekly Activity</CardTitle>
                  <CardDescription>Daily logins and assignment submissions</CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={activityData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="logins" fill="#4F46E5" name="Logins">
                        <LabelList dataKey="logins" position="top" />
                      </Bar>
                      <Bar dataKey="assignments" fill="#10B981" name="Assignments">
                        <LabelList dataKey="assignments" position="top" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Student Activity Trends and Asset Completion Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="relative">
                <div className="absolute top-4 right-4 z-10">
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">
                    Coming Soon
                  </span>
                </div>
                <CardHeader>
                  <CardTitle className="text-muted-foreground">Student Activity Trends</CardTitle>
                  <CardDescription>
                    Weekly student engagement and feature usage patterns
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p className="text-sm">Activity analytics will be available soon</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="relative">
                <div className="absolute top-4 right-4 z-10">
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">
                    Coming Soon
                  </span>
                </div>
                <CardHeader>
                  <CardTitle className="text-muted-foreground">
                    Asset Completion Breakdown by Category
                  </CardTitle>
                  <CardDescription>
                    Average completion levels across resumes, cover letters, goals, applications
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p className="text-sm">Completion analytics will be available soon</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="relative">
              <div className="absolute top-4 right-4 z-10">
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">
                  Coming Soon
                </span>
              </div>
              <CardHeader>
                <CardTitle className="text-muted-foreground">Student Progress Insights</CardTitle>
                <CardDescription>
                  Goals in progress vs completed, applications by stage, and resume/cover letter
                  activity
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-sm">Progress insights will be available soon</p>
                </div>
              </CardContent>
            </Card>

            {/* Student Distribution by Department and Overall Progress side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Student Distribution by Department</CardTitle>
                  <CardDescription>
                    Enrollment breakdown across academic departments
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  {departmentDistributionData.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <p className="text-sm">No student data available</p>
                        <p className="text-xs mt-2">
                          {!departments || departments.length === 0
                            ? 'Create departments first'
                            : !students || students.length === 0
                              ? 'Invite students to see distribution'
                              : 'Assign students to departments'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={departmentDistributionData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ value }) => `${value}%`}
                          labelLine={true}
                        >
                          {departmentDistributionData.map(
                            (entry: { name: string; value: number }, index: number) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={
                                  [
                                    '#4F46E5',
                                    '#10B981',
                                    '#F59E0B',
                                    '#EC4899',
                                    '#8B5CF6',
                                    '#EF4444',
                                  ][index % 6]
                                }
                              />
                            ),
                          )}
                        </Pie>
                        <Tooltip
                          formatter={(value, name, props) => [
                            `${value}% (${props.payload.count} students)`,
                            'Enrollment',
                          ]}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Overall Progress Completion Rate */}
              <Card>
                <CardHeader>
                  <CardTitle>Overall Progress Completion Rate</CardTitle>
                  <CardDescription>
                    Percentage of students who have completed core career assets
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={progressCompletionData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        label={({ value }) => `${value}%`}
                        labelLine={true}
                      >
                        {progressCompletionData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={['#10B981', '#F59E0B', '#EF4444'][index]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name, props) => [
                          `${value}% (${props.payload.count} students)`,
                          'Students',
                        ]}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Top Features */}
            <Card>
              <CardHeader>
                <CardTitle>Top Features Used</CardTitle>
                <CardDescription>
                  Ranked bar chart of the most frequently accessed tools
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topFeaturesData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="feature" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="usage" fill="#4F46E5" name="Total Count">
                      <LabelList dataKey="usage" position="top" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* At-Risk Students Segment */}
            <Card>
              <CardHeader>
                <CardTitle>At-Risk Students Segment</CardTitle>
                <CardDescription>Students with both low progress and low usage</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={atRiskStudentsData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="segment" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#4F46E5" name="Student Count">
                      <LabelList dataKey="count" position="top" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Recent Students - Moved to bottom */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Students</CardTitle>
              <CardDescription>Latest users in your institution</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students
                    .filter((s: any) => s.role === 'user' || s.role === 'student')
                    .slice(0, 8)
                    .map((s: any) => (
                      <TableRow
                        key={s._id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => router.push(`/profile/${s.clerkId}`)}
                      >
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>{s.email}</TableCell>
                        <TableCell className="uppercase text-xs text-muted-foreground">
                          {s.role}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="text-sm text-muted-foreground">
              Showing{' '}
              {Math.min(
                8,
                students.filter((s: any) => s.role === 'user' || s.role === 'student').length,
              )}{' '}
              of {students.filter((s: any) => s.role === 'user' || s.role === 'student').length}
            </CardFooter>
          </Card>
        </>
      )}

      {/* Analytics Tab Content */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Analytics Sub-Toggles */}
          <div className="flex flex-wrap gap-2 bg-gray-50 p-3 rounded-lg">
            <Button
              size="sm"
              variant={analyticsView === 'engagement' ? 'default' : 'outline'}
              onClick={() => setAnalyticsView('engagement')}
              className={analyticsView === 'engagement' ? 'bg-[#0C29AB]' : ''}
            >
              Student Engagement
            </Button>
            <Button
              size="sm"
              variant={analyticsView === 'features' ? 'default' : 'outline'}
              onClick={() => setAnalyticsView('features')}
              className={analyticsView === 'features' ? 'bg-[#0C29AB]' : ''}
            >
              Career Tool Usage
            </Button>
            <Button
              size="sm"
              variant={analyticsView === 'risk' ? 'default' : 'outline'}
              onClick={() => setAnalyticsView('risk')}
              className={analyticsView === 'risk' ? 'bg-[#0C29AB]' : ''}
            >
              At-Risk Analysis
            </Button>
          </div>

          {/* Analytics: Engagement */}
          {analyticsView === 'engagement' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium">Daily Active Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {activeUsersData?.data?.slice(-1)?.[0]?.students ?? 0}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      of{' '}
                      {activeUsersData?.totalStudents ??
                        overview?.totalStudents ??
                        students?.length ??
                        0}{' '}
                      total students
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium">Total Students</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {activeUsersData?.totalStudents ?? overview?.totalStudents ?? 0}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Registered students</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium">Total Advisors</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{activeUsersData?.totalAdvisors ?? 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">Registered advisors</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium">Peak Daily Active (7d)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {activeUsersData?.data?.slice(-7)?.reduce((sum, d) => {
                        return Math.max(sum, d.students);
                      }, 0) ?? 0}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Peak daily active in the last 7 days
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Student Activity Trends</CardTitle>
                  <CardDescription>
                    Daily active students and advisors over the last 30 days
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={activeUsersData?.data || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="students"
                        stroke="#4F46E5"
                        strokeWidth={2}
                        name="Active Students"
                      />
                      <Line
                        type="monotone"
                        dataKey="advisors"
                        stroke="#10B981"
                        strokeWidth={2}
                        name="Active Advisors"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Weekly Activity</CardTitle>
                  <CardDescription>Daily logins and assignment submissions</CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={activityData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="logins" fill="#4F46E5" name="Logins">
                        <LabelList dataKey="logins" position="top" />
                      </Bar>
                      <Bar dataKey="assignments" fill="#10B981" name="Assignments">
                        <LabelList dataKey="assignments" position="top" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Analytics: Career Tool Usage */}
          {analyticsView === 'features' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Asset Completion Breakdown by Category</CardTitle>
                    <CardDescription>Total counts of student-created career assets</CardDescription>
                  </CardHeader>
                  <CardContent className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={topFeaturesData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="feature" angle={-45} textAnchor="end" height={80} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="usage" fill="#4F46E5" name="Total Count">
                          <LabelList dataKey="usage" position="top" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Features Used</CardTitle>
                    <CardDescription>
                      Ranked bar chart of the most frequently accessed tools
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={topFeaturesData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="feature" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="usage" fill="#4F46E5" name="Total Count">
                          <LabelList dataKey="usage" position="top" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Career Outcomes Funnel</CardTitle>
                  <CardDescription>
                    Student progression through career development stages
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={
                        studentFunnel?.funnel?.length
                          ? studentFunnel.funnel.map((item) => ({
                              stage: item.stage,
                              count: item.count,
                              percentage: item.percent,
                            }))
                          : [
                              {
                                stage: 'Active Students',
                                count:
                                  activeUsersData?.totalStudents ?? overview?.totalStudents ?? 0,
                                percentage: 100,
                              },
                            ]
                      }
                      margin={{ top: 20, right: 30, left: 120, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="stage" type="category" width={110} />
                      <Tooltip
                        formatter={(value, name, props) => [
                          `${value} students (${props.payload.percentage}%)`,
                          'Count',
                        ]}
                      />
                      <Bar dataKey="count" fill="#4F46E5" name="Students">
                        <LabelList
                          dataKey="percentage"
                          position="right"
                          formatter={(value: number) => `${value}%`}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Analytics: At-Risk */}
          {analyticsView === 'risk' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium text-red-600">High Risk</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {atRiskStudentsData.find((d) => d.segment === 'High Risk')?.count || 0}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Career completion below 20%
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium text-orange-600">
                      Medium Risk
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {atRiskStudentsData.find((d) => d.segment === 'Medium Risk')?.count || 0}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Career completion 20-50%</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium text-green-600">Low Risk</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {atRiskStudentsData.find((d) => d.segment === 'Low Risk')?.count || 0}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Career completion above 50%
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>At-Risk Students Segment</CardTitle>
                    <CardDescription>Distribution of students by risk level</CardDescription>
                  </CardHeader>
                  <CardContent className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={atRiskStudentsData}
                          dataKey="count"
                          nameKey="segment"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ value, percent }) =>
                            `${value} (${(percent * 100).toFixed(0)}%)`
                          }
                          labelLine={true}
                        >
                          {atRiskStudentsData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={['#EF4444', '#F59E0B', '#10B981'][index]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Feature Engagement by Risk Level</CardTitle>
                    <CardDescription>Average feature usage for at-risk students</CardDescription>
                  </CardHeader>
                  <CardContent className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={featureEngagementByRisk}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="feature" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="highRisk" fill="#EF4444" name="High Risk" />
                        <Bar dataKey="mediumRisk" fill="#F59E0B" name="Medium Risk" />
                        <Bar dataKey="lowRisk" fill="#10B981" name="Low Risk" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>At-Risk Students List</CardTitle>
                  <CardDescription>Students requiring immediate attention</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Risk Level</TableHead>
                        <TableHead>Last Active</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students
                        .filter(
                          (s: any) =>
                            s.engagement_status === 'at_risk' || s.engagement_status === 'moderate',
                        )
                        .slice(0, 5)
                        .map((s: any) => {
                          // Map engagement_status to risk level display
                          const riskLevel = s.engagement_status === 'at_risk' ? 'high' : 'medium';
                          // Calculate actual days since last activity
                          const daysAgo = s.last_active
                            ? Math.floor((Date.now() - s.last_active) / (1000 * 60 * 60 * 24))
                            : null;
                          return (
                            <TableRow key={s._id}>
                              <TableCell className="font-medium">{s.name || 'Unknown'}</TableCell>
                              <TableCell>{s.email}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={riskLevel === 'high' ? 'destructive' : 'default'}
                                  className={riskLevel === 'medium' ? 'bg-orange-600' : ''}
                                >
                                  {riskLevel.toUpperCase()}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {daysAgo !== null ? `${daysAgo} days ago` : 'Never'}
                              </TableCell>
                              <TableCell>
                                <Button size="sm" variant="outline">
                                  <Mail className="h-3 w-3 mr-1" />
                                  Send Reminder
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Students Tab Content */}
      {(activeTab === 'students-list' ||
        activeTab === 'students-progress' ||
        activeTab === 'invite-students') && (
        <div className="space-y-6">
          {/* Internal Toggle for Students Tab */}
          <div className="flex gap-4">
            <Button
              variant={activeTab === 'students-list' ? 'default' : 'outline'}
              onClick={() => setActiveTab('students-list')}
              className={activeTab === 'students-list' ? 'bg-[#0C29AB]' : ''}
            >
              Students
            </Button>
            <Button
              variant={activeTab === 'students-progress' ? 'default' : 'outline'}
              onClick={() => setActiveTab('students-progress')}
              className={activeTab === 'students-progress' ? 'bg-[#0C29AB]' : ''}
            >
              Student Progress
            </Button>
            <Button
              variant={activeTab === 'invite-students' ? 'default' : 'outline'}
              onClick={() => setActiveTab('invite-students')}
              className={activeTab === 'invite-students' ? 'bg-[#0C29AB]' : ''}
            >
              Invite Students
            </Button>
          </div>

          <div className="space-y-6">
            {/* Students List View */}
            {activeTab === 'students-list' && (
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
                        <div className="text-2xl font-bold">
                          {overview?.newStudentsThisMonth ?? 0}
                        </div>
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
                          .sort((a: any, b: any) => (b.created_at || 0) - (a.created_at || 0))
                          .map((s: any) => {
                            const dept = departments.find((d) => d._id === s.department_id);
                            return (
                              <TableRow key={s._id}>
                                <TableCell>
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={s.imageUrl} />
                                    <AvatarFallback>
                                      {(s.name || 'U')
                                        .split(' ')
                                        .map((n: string) => n[0])
                                        .join('')
                                        .toUpperCase()
                                        .slice(0, 2)}
                                    </AvatarFallback>
                                  </Avatar>
                                </TableCell>
                                <TableCell
                                  className="font-medium cursor-pointer hover:underline"
                                  onClick={() => router.push(`/profile/${s.clerkId}`)}
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
                                        onClick={() => router.push(`/profile/${s.clerkId}`)}
                                      >
                                        View Profile
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleEditStudent(s)}>
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
                    Showing {students.length} of {overview?.totalStudents ?? students.length}{' '}
                    enrolled students
                  </CardFooter>
                </Card>
              </>
            )}

            {/* Student Progress View */}
            {activeTab === 'students-progress' && (
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
                      <CardTitle className="text-base font-medium">
                        Applications Submitted
                      </CardTitle>
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
                        <div className="text-2xl font-bold">
                          {studentMetrics?.totalResumes || 0}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Professional documents
                      </div>
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
                      <div className="text-xs text-muted-foreground mt-1">
                        Application materials
                      </div>
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
                        {(studentProgress || []).slice(0, 10).map((progress: any) => {
                          return (
                            <TableRow key={progress.studentId}>
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
                                <Badge variant="outline">{progress.coverLetters}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Progress value={progress.completion} className="w-16 h-2" />
                                  <span className="text-sm font-medium">
                                    {progress.completion}%
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
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
                      {departments.map((d: any) => {
                        const deptStudents = students.filter((s: any) => s.department_id === d._id);
                        const deptProgress = (studentProgress || []).filter((p: any) =>
                          students.some(
                            (s: any) => s._id === p.studentId && s.department_id === d._id,
                          ),
                        );
                        const avgProgress =
                          deptProgress.length > 0
                            ? Math.round(
                                deptProgress.reduce(
                                  (sum: number, p: any) => sum + p.completion,
                                  0,
                                ) / deptProgress.length,
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
                                    <span className="text-sm text-muted-foreground">
                                      Avg Progress
                                    </span>
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
            {activeTab === 'invite-students' && (
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
                        university. This platform will help them prepare for their career
                        development journey.
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        id="studentEmailsCsvInvite"
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setImportingEmails(true);
                          try {
                            const text = await f.text();
                            // Basic parse: collect tokens that look like emails
                            const emailsFromCsv = Array.from(
                              text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi),
                            ).map((m) => m[0]);
                            const combined = [assignText, emailsFromCsv.join('\n')]
                              .filter(Boolean)
                              .join('\n');
                            setAssignText(combined);
                          } finally {
                            setImportingEmails(false);
                          }
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
                          placeholder="Enter one email per line or comma-separated&#10;Example:&#10;student1@university.edu&#10;student2@university.edu"
                          rows={8}
                          value={assignText}
                          onChange={(e) => setAssignText(e.target.value)}
                        />
                        <div className="text-xs text-muted-foreground mt-1">
                          <strong>Note:</strong> An activation email will be sent to each address,
                          allowing recipients to activate their account and access university
                          resources. No prior signup required.
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Default role for invited students:</Label>
                        <div className="flex gap-2">
                          <Button
                            variant={assignRole === 'student' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setAssignRole('student')}
                          >
                            Student
                          </Button>
                          <Button
                            variant={assignRole === 'advisor' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setAssignRole('advisor')}
                          >
                            Advisor / Staff
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <div className="text-sm text-muted-foreground">
                      {assignText.split(/[\n,]+/).filter((e) => e.trim()).length} email(s) ready to
                      invite
                    </div>
                    <Button
                      onClick={async () => {
                        setAssigning(true);
                        try {
                          const result = await assignStudentsWithInvitations({
                            emailsText: assignText,
                            role: assignRole,
                            departmentId: selectedProgram !== 'none' ? selectedProgram : undefined,
                          });
                          if (result.success) {
                            setAssignOpen(false);
                            setAssignText('');
                          }
                        } catch (e: any) {
                          toast({
                            title: 'Failed to send invitations',
                            description: e?.message || 'An unexpected error occurred',
                            variant: 'destructive',
                          });
                        } finally {
                          setAssigning(false);
                        }
                      }}
                      disabled={assigning || !assignText.trim()}
                    >
                      {assigning
                        ? 'Sending...'
                        : `Send ${assignText.split(/[\n,]+/).filter((e) => e.trim()).length} Invitation(s)`}
                    </Button>
                  </CardFooter>
                </Card>
              </>
            )}
          </div>
        </div>
      )}

      {/* Departments Tab Content */}
      {activeTab === 'departments' && (
        <div className="space-y-6">
          {/* Department Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Total Departments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <GraduationCap className="h-5 w-5 text-muted-foreground mr-2" />
                  <div className="text-2xl font-bold">{departments.length}</div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">Academic departments</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Average Students/Dept</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <Users className="h-5 w-5 text-muted-foreground mr-2" />
                  <div className="text-2xl font-bold">
                    {(overview?.departments ?? 0) > 0
                      ? Math.round(
                          ((overview?.totalStudents ?? 0) - (overview?.unassignedStudents ?? 0)) /
                            (overview?.departments ?? 1),
                        )
                      : 0}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {(overview?.unassignedStudents ?? 0) > 0 && (
                    <span className="text-amber-600">
                      {overview?.unassignedStudents ?? 0} unassigned
                    </span>
                  )}
                  {(overview?.unassignedStudents ?? 0) === 0 && 'Student distribution'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Highest Enrollment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <Award className="h-5 w-5 text-muted-foreground mr-2" />
                  <div className="text-lg font-bold">
                    {(() => {
                      const dists = overview?.departmentDistribution ?? [];
                      if (dists.length === 0) return 'N/A';
                      const highest = dists.reduce(
                        (max: any, d: any) => (d.count > max.count ? d : max),
                        { name: 'N/A', count: 0 },
                      );
                      return highest.count > 0 ? highest.name : 'N/A';
                    })()}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {(() => {
                    const dists = overview?.departmentDistribution ?? [];
                    if (dists.length === 0) return 'No students assigned';
                    const highest = dists.reduce(
                      (max: number, d: any) => Math.max(max, d.count),
                      0,
                    );
                    return highest > 0 ? `${highest} students` : 'No students assigned';
                  })()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Avg Completion</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <BarChartIcon className="h-5 w-5 text-muted-foreground mr-2" />
                  <div className="text-2xl font-bold">
                    {(() => {
                      // Calculate average completion across students with departments
                      const studentsWithDepts = students.filter((s: any) => s.department_id);
                      if (studentsWithDepts.length === 0) return '0%';

                      const progressData = studentProgress || [];
                      const totalCompletion = studentsWithDepts.reduce(
                        (sum: number, student: any) => {
                          const progress = progressData.find(
                            (p: any) => p.studentId === student._id,
                          );
                          return sum + (progress?.completion || 0);
                        },
                        0,
                      );

                      return Math.round(totalCompletion / studentsWithDepts.length) + '%';
                    })()}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Avg career assets completion
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Department Usage Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Department Student Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Student Distribution by Department</CardTitle>
                <CardDescription>Enrollment breakdown across academic departments</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={departments.map((d: any, index: number) => {
                        const deptStudents = students.filter((s: any) => s.department_id === d._id);
                        const percentage =
                          departments.length > 0 && students.length > 0
                            ? Math.round((deptStudents.length / students.length) * 100)
                            : 0;
                        return {
                          name: d.name,
                          value: percentage,
                          students: deptStudents.length,
                          color: ['#4F46E5', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4'][
                            index % 6
                          ],
                        };
                      })}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ value }) => `${value}%`}
                      labelLine={true}
                    >
                      {departments.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            ['#4F46E5', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4'][
                              index % 6
                            ]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [`${value}%`, name]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Department Utilization Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Department Utilization Trends</CardTitle>
                <CardDescription>Student engagement and activity by department</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                {!departments || departments.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <p className="text-sm">No department data available</p>
                      <p className="text-xs mt-2">Create departments to see utilization trends</p>
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={
                        departments.length > 0
                          ? departments.map((d: any, index: number) => {
                              const deptStudents = students.filter(
                                (s: any) => s.department_id === d._id,
                              );
                              const deptProgress = (studentProgress || []).filter((p: any) =>
                                students.some(
                                  (s: any) => s._id === p.studentId && s.department_id === d._id,
                                ),
                              );
                              const avgProgress =
                                deptProgress.length > 0
                                  ? Math.round(
                                      deptProgress.reduce(
                                        (sum: number, p: any) => sum + p.completion,
                                        0,
                                      ) / deptProgress.length,
                                    )
                                  : 0;
                              // Calculate utilization as percentage of students with any activity
                              const activeStudents = deptProgress.filter(
                                (p: any) => p.completion > 0,
                              ).length;
                              const utilization =
                                deptStudents.length > 0
                                  ? Math.round((activeStudents / deptStudents.length) * 100)
                                  : 0;
                              return {
                                name: d.code || d.name.substring(0, 15),
                                students: deptStudents.length,
                                utilization: utilization,
                                avgProgress: avgProgress,
                              };
                            })
                          : []
                      }
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="students" fill="#4F46E5" name="Students">
                        <LabelList dataKey="students" position="top" />
                      </Bar>
                      <Bar dataKey="utilization" fill="#10B981" name="Utilization %">
                        <LabelList
                          dataKey="utilization"
                          position="top"
                          formatter={(value: number) => `${value}%`}
                        />
                      </Bar>
                      <Bar dataKey="avgProgress" fill="#F59E0B" name="Avg Progress %">
                        <LabelList
                          dataKey="avgProgress"
                          position="top"
                          formatter={(value: number) => `${value}%`}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Department Activity Chart */}
          <Card className="relative">
            <div className="absolute top-4 right-4 z-10">
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">
                Coming Soon
              </span>
            </div>
            <CardHeader>
              <CardTitle className="text-muted-foreground">Department Activity Overview</CardTitle>
              <CardDescription>Monthly activity trends across all departments</CardDescription>
            </CardHeader>
            <CardContent className="h-80 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-sm">Department activity analytics will be available soon</p>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Department List */}
          <Card>
            <CardHeader>
              <CardTitle>Department Details</CardTitle>
              <CardDescription>Comprehensive overview of all academic departments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {departments.map((d: any, index: number) => {
                  const deptStudents = students.filter((s: any) => s.department_id === d._id);
                  const deptProgress = (studentProgress || []).filter((p: any) =>
                    students.some((s: any) => s._id === p.studentId && s.department_id === d._id),
                  );
                  const avgProgress =
                    deptProgress.length > 0
                      ? Math.round(
                          deptProgress.reduce((sum: number, p: any) => sum + p.completion, 0) /
                            deptProgress.length,
                        )
                      : 0;
                  const activeStudents = deptProgress.filter((p: any) => p.completion > 0).length;
                  const utilization =
                    deptStudents.length > 0
                      ? Math.round((activeStudents / deptStudents.length) * 100)
                      : 0;

                  return (
                    <Card key={String(d._id)} className="relative">
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
                              <span className="text-sm text-muted-foreground">Utilization</span>
                              <span className="font-medium">{utilization}%</span>
                            </div>
                            <Progress value={utilization} className="h-2" />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Avg Progress</span>
                              <span className="font-medium">{avgProgress}%</span>
                            </div>
                            <Progress value={avgProgress} className="h-2" />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Status</span>
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              Active
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Platform Usage Tab Content */}
      {activeTab === 'usage' && (
        <div className="space-y-6">
          {/* Platform Usage Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Platform Usage</CardTitle>
                  <CardDescription>
                    Monitor and analyze how students are using the Ascentful Career Development
                    platform.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <select
                    className="px-3 py-1 text-sm border rounded-md bg-white"
                    value={usageTimeFilter}
                    onChange={(e) => setUsageTimeFilter(e.target.value)}
                  >
                    <option>Last month</option>
                    <option>Last 3 months</option>
                    <option>Last 6 months</option>
                  </select>
                  <select
                    className="px-3 py-1 text-sm border rounded-md bg-white"
                    value={usageProgramFilter}
                    onChange={(e) => setUsageProgramFilter(e.target.value)}
                  >
                    <option>All Programs</option>
                    {departments?.map((dept: any) => (
                      <option key={dept._id} value={dept.name}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Card className="relative">
                  <div className="absolute top-2 right-2">
                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                      Coming Soon
                    </span>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Total Logins</p>
                        <p className="text-2xl font-bold text-muted-foreground/50">--</p>
                      </div>
                      <div className="text-green-600/50">
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="relative">
                  <div className="absolute top-2 right-2">
                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                      Coming Soon
                    </span>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                        <p className="text-2xl font-bold text-muted-foreground/50">--</p>
                      </div>
                      <div className="text-blue-600/50">
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="relative">
                  <div className="absolute top-2 right-2">
                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                      Coming Soon
                    </span>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Avg Session Time
                        </p>
                        <p className="text-2xl font-bold text-muted-foreground/50">--</p>
                      </div>
                      <div className="text-purple-600/50">
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="relative">
                  <div className="absolute top-2 right-2">
                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                      Coming Soon
                    </span>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Feature Usage</p>
                        <p className="text-2xl font-bold text-muted-foreground/50">--</p>
                      </div>
                      <div className="text-orange-600/50">
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                        </svg>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex gap-2 mb-4">
                <Button
                  variant={usageView === 'overview' ? 'default' : 'outline'}
                  size="sm"
                  className={usageView === 'overview' ? 'bg-[#0C29AB]' : ''}
                  onClick={() => setUsageView('overview')}
                >
                  Overview
                </Button>
                <Button
                  variant={usageView === 'features' ? 'default' : 'outline'}
                  size="sm"
                  className={usageView === 'features' ? 'bg-[#0C29AB]' : ''}
                  onClick={() => setUsageView('features')}
                >
                  Features
                </Button>
                <Button
                  variant={usageView === 'programs' ? 'default' : 'outline'}
                  size="sm"
                  className={usageView === 'programs' ? 'bg-[#0C29AB]' : ''}
                  onClick={() => setUsageView('programs')}
                >
                  Programs
                </Button>
              </div>

              {/* Monthly Activity Chart */}
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={platformUsageData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="applications"
                      stroke="#10B981"
                      strokeWidth={2}
                      name="Applications"
                    />
                    <Line
                      type="monotone"
                      dataKey="resumes"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      name="Resumes"
                    />
                    <Line
                      type="monotone"
                      dataKey="goals"
                      stroke="#4F46E5"
                      strokeWidth={2}
                      name="Goals"
                    />
                    <Line
                      type="monotone"
                      dataKey="coverLetters"
                      stroke="#EF4444"
                      strokeWidth={2}
                      name="Cover Letters"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Recent Reports Section */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Reports</CardTitle>
              <CardDescription>
                Access and download previously generated reports. (Sample data shown)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Report Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Monthly Student Activity Report</TableCell>
                    <TableCell>2024-01-15</TableCell>
                    <TableCell>Student Analytics</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleViewReport('Monthly Student Activity Report', 'Student Analytics')
                          }
                        >
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleDownloadReport(
                              'Monthly Student Activity Report',
                              'Student Analytics',
                            )
                          }
                        >
                          Download
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Department Usage Summary</TableCell>
                    <TableCell>2024-01-10</TableCell>
                    <TableCell>Department Analytics</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleViewReport('Department Usage Summary', 'Department Analytics')
                          }
                        >
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleDownloadReport('Department Usage Summary', 'Department Analytics')
                          }
                        >
                          Download
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Career Tool Usage Report</TableCell>
                    <TableCell>2024-01-05</TableCell>
                    <TableCell>Career Platform Analytics</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleViewReport(
                              'Career Tool Usage Report',
                              'Career Platform Analytics',
                            )
                          }
                        >
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleDownloadReport(
                              'Career Tool Usage Report',
                              'Career Platform Analytics',
                            )
                          }
                        >
                          Download
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Student Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Student full name"
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="student@university.edu"
                disabled
              />
              <p className="text-xs text-muted-foreground mt-1">
                Email cannot be changed after invitation
              </p>
            </div>
            <div>
              <Label htmlFor="edit-role">Role</Label>
              <Select
                value={editForm.role}
                onValueChange={(value) => setEditForm({ ...editForm, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="user">Student (legacy)</SelectItem>
                  <SelectItem value="advisor">Advisor / Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStudent} disabled={updatingStudent}>
              {updatingStudent ? 'Updating...' : 'Update Student'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Student</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {studentToDelete?.name || studentToDelete?.email} from
              your university? This action cannot be undone and will revoke their access to all
              university resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteStudent}
              disabled={deletingStudent}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingStudent ? 'Removing...' : 'Remove Student'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Export Reports Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export Report</DialogTitle>
            <DialogDescription>Enter a name for your report file</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="export-filename">File Name</Label>
              <Input
                id="export-filename"
                value={exportFilename}
                onChange={(e) => setExportFilename(e.target.value)}
                placeholder="university-report"
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                File will be saved as: {exportFilename.trim() || 'university-report'}.csv
              </p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleExportReports}>Export</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Licenses Modal */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Student Licenses</DialogTitle>
            {overview && overview.licenseCapacity && (
              <div className="text-sm text-muted-foreground">
                Available seats: {overview.licenseCapacity - overview.activeLicenses} of{' '}
                {overview.licenseCapacity}
              </div>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Program/Department</Label>
              <Select
                value={selectedProgram}
                onValueChange={(value) => setSelectedProgram(value as Id<'departments'> | 'none')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a program/department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific program</SelectItem>
                  {departments?.map((dept: any) => (
                    <SelectItem key={dept._id} value={dept._id}>
                      {dept.name} {dept.code && `(${dept.code})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Student Emails</Label>
              <Textarea
                placeholder="Enter one email per line or comma-separated&#10;Example:&#10;student1@university.edu&#10;student2@university.edu"
                rows={6}
                value={assignText}
                onChange={(e) => setAssignText(e.target.value)}
              />
              <div className="text-xs text-muted-foreground mt-1">
                <strong>Note:</strong> An activation email will be sent to each address, allowing
                recipients to activate their account and access university resources. No prior
                signup required.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Assign role:</Label>
              <div className="flex gap-2">
                <Button
                  variant={assignRole === 'student' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAssignRole('student')}
                >
                  Student
                </Button>
                <Button
                  variant={assignRole === 'advisor' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAssignRole('advisor')}
                >
                  Advisor / Staff
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const csvContent =
                    'email,first_name,last_name,program,cohort,role,tags\nstudent1@university.edu,John,Doe,Computer Science,2024,student,"tag1,tag2"\nstudent2@university.edu,Jane,Smith,Business,2024,student,"tag3"';
                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'student_import_template.csv';
                  document.body.appendChild(a);
                  try {
                    a.click();
                  } finally {
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                  }
                }}
              >
                Download CSV Template
              </Button>
              <input
                id="studentEmailsCsvAssign"
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setImportingEmails(true);
                  try {
                    const text = await f.text();
                    // Basic parse: collect tokens that look like emails
                    const emailsFromCsv = Array.from(
                      text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi),
                    ).map((m) => m[0]);
                    const combined = [assignText, emailsFromCsv.join('\n')]
                      .filter(Boolean)
                      .join('\n');
                    setAssignText(combined);
                  } finally {
                    setImportingEmails(false);
                  }
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('studentEmailsCsvAssign')?.click()}
                disabled={importingEmails}
              >
                {importingEmails ? 'Parsing...' : 'Import CSV'}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setAssigning(true);
                try {
                  const result = await assignStudentsWithInvitations({
                    emailsText: assignText,
                    role: assignRole,
                    departmentId: selectedProgram !== 'none' ? selectedProgram : undefined,
                  });
                  if (result.success) {
                    setAssignOpen(false);
                    setAssignText('');
                    setSelectedProgram('none');
                  }
                } catch (e: any) {
                  toast({
                    title: 'Assignment failed',
                    description: e?.message || 'An unexpected error occurred',
                    variant: 'destructive',
                  });
                } finally {
                  setAssigning(false);
                }
              }}
              disabled={assigning || !assignText.trim()}
            >
              {assigning ? 'Assigning...' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
